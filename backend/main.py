import threading
import time
import subprocess
import os
from datetime import datetime, timedelta
from zoneinfo import ZoneInfo
from fastapi import FastAPI, Request, Form
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse, RedirectResponse, HTMLResponse
from fastapi.middleware.cors import CORSMiddleware
from fastapi.middleware.gzip import GZipMiddleware
from starlette.middleware.base import BaseHTTPMiddleware
from excel_reader import load_alle_auftraege, load_ansprechpartner, load_kpi_wochentlich, load_kpi_status, load_verfuegbarkeit, load_kpi_nach_kw
from geocoder import geocode_alle, geocode_fehlende, cache_bereinigen
from erinnerungen import vao_offene, hausstich_offene
from todos_db import init_db
from todos import router as todos_router
import bauakten_db
from bauakten import router as bauakten_router
import systemeintraege_db
from systemeintraege import router as systemeintraege_router
from auth import (
    is_authenticated, is_allowed_country, _is_rate_limited,
    create_session_cookie, login_page, get_country, _log, USERNAME, PASSWORD
)

_BERLIN   = ZoneInfo("Europe/Berlin")
_CACHE_TTL = 300  # Sekunden bis Excel neu gelesen wird (5 Min)

_cache = {"data": None, "geo": None, "ts": 0}
_cache_lock = threading.Lock()
_refresh_running = False

def _refresh_im_hintergrund():
    global _refresh_running
    try:
        neue_daten = load_alle_auftraege()
        with _cache_lock:
            _cache["data"] = neue_daten
            _cache["geo"]  = None
            _cache["ts"]   = time.monotonic()
    finally:
        _refresh_running = False

def _get_daten():
    global _refresh_running
    now = time.monotonic()
    with _cache_lock:
        abgelaufen = _cache["data"] is None or now - _cache["ts"] > _CACHE_TTL
        kein_cache = _cache["data"] is None
    if abgelaufen and not _refresh_running:
        _refresh_running = True
        threading.Thread(target=_refresh_im_hintergrund, daemon=True).start()
    if kein_cache:
        # Erster Start: kurz warten bis Daten da sind
        for _ in range(30):
            time.sleep(0.2)
            with _cache_lock:
                if _cache["data"] is not None:
                    break
    with _cache_lock:
        return _cache["data"] or []

def _get_geo():
    daten = _get_daten()
    with _cache_lock:
        if _cache["geo"] is None:
            _cache["geo"] = geocode_alle(daten)
    return _cache["geo"]

app = FastAPI()

# --- Auth Middleware ---
_PUBLIC = {"/login", "/favicon.ico"}

class AuthMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next):
        path = request.url.path
        if path in _PUBLIC or path.startswith("/static"):
            return await call_next(request)
        if not is_allowed_country(request):
            return HTMLResponse("<h1>403 – Zugriff nicht erlaubt</h1>", status_code=403)
        if not is_authenticated(request):
            return RedirectResponse("/login")
        return await call_next(request)

app.add_middleware(AuthMiddleware)
app.add_middleware(GZipMiddleware, minimum_size=500)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:8502", "http://127.0.0.1:8502"],
    allow_methods=["GET", "POST", "PATCH", "DELETE"],
    allow_headers=["Content-Type"],
)


app.include_router(todos_router)
app.include_router(bauakten_router)
app.include_router(systemeintraege_router)

@app.on_event("startup")
def start_geocoding():
    init_db()
    bauakten_db.init_db()
    systemeintraege_db.init_db()
    def _init():
        daten = load_alle_auftraege()
        cache_bereinigen()
        geocode_fehlende(daten)
        with _cache_lock:
            _cache["data"] = daten
            _cache["geo"]  = geocode_alle(daten)
            _cache["ts"]   = time.monotonic()
    threading.Thread(target=_init, daemon=True).start()


# --- API-Routen ---

@app.get("/api/auftraege")
def get_auftraege():
    return _get_daten()

_GEO_FELDER = {"lat","lng","adresse","name","telefon","status","stadt","tb_termin","tb_team","inst_termin","inst_team","genehmigung","genehm_von","genehm_bis","kommentar","tb_kommentar","inst_kommentar","wartegrund"}

@app.get("/api/auftraege/geo")
def get_auftraege_geo():
    return [{k: v for k, v in a.items() if k in _GEO_FELDER} for a in _get_geo()]

@app.get("/api/status")
def get_status():
    return {"gesamt": len(_get_daten())}

@app.get("/api/erinnerungen")
def get_erinnerungen():
    daten = _get_daten()
    return {"vao": vao_offene(daten), "hausstich": hausstich_offene(daten)}

@app.post("/api/refresh")
def refresh():
    # 1. Aktuelle Excel vom SharePoint ziehen
    sync_script = os.path.join(os.path.dirname(__file__), "../../TelegramBot/sync_excel.py")
    sync_script = os.path.abspath(sync_script)
    if os.path.exists(sync_script):
        subprocess.run(["python3", sync_script], timeout=60)

    # 2. Cache leeren und neu laden
    with _cache_lock:
        _cache["data"] = None
        _cache["geo"]  = None
        _cache["ts"]   = 0
    _get_daten()
    return {"ok": True, "gesamt": len(_cache["data"])}

_STATUS_MAPPING = {
    "offen":                      "Offen",
    "Wartegrund":                 "Wartegrund",
    "Tiefbau terminiert":         "In Bearbeitung",
    "TB abgeschlossen":           "In Bearbeitung",
    "TB bereits abgeschlossen":   "In Bearbeitung",
    "Installation Problem":       "In Bearbeitung",
    "Installation abgeschlossen": "Abgeschlossen",
    "Auftrag abgeschlossen":      "Abgeschlossen",
    "Prozess abgeschlossen":      "Abgeschlossen",
    "Kein Verband":               "Sonstige",
    "Storno":                     "Sonstige",
}

def _zaehle(eintraege: list) -> dict:
    counts = {"gesamt": len(eintraege), "offen": 0, "wartegrund": 0, "in_bearbeitung": 0, "abgeschlossen": 0, "sonstige": 0}
    for e in eintraege:
        k = _STATUS_MAPPING.get(e["status"], "Sonstige")
        if k == "Offen":             counts["offen"]          += 1
        elif k == "Wartegrund":      counts["wartegrund"]     += 1
        elif k == "In Bearbeitung":  counts["in_bearbeitung"] += 1
        elif k == "Abgeschlossen":   counts["abgeschlossen"]  += 1
        else:                        counts["sonstige"]        += 1
    return counts

@app.get("/api/kpi")
def get_kpi():
    daten = _get_daten()
    staedte = {}
    for stadt in ["Stadt A", "Stadt D", "Stadt C", "Stadt B", "Stadt E", "Stadt F"]:
        staedte[stadt] = _zaehle([e for e in daten if e["stadt"] == stadt])
    return {"gesamt": _zaehle(daten), "nach_stadt": staedte}

_WOCHENTAGE = ["Montag","Dienstag","Mittwoch","Donnerstag","Freitag","Samstag","Sonntag"]

@app.get("/api/termine")
def get_termine():
    heute     = datetime.now(_BERLIN).date()
    montag    = heute - timedelta(days=heute.weekday())
    daten     = _get_daten()
    tage: dict = {}

    start = montag - timedelta(weeks=2)
    for i in range(42):  # 2 Wochen zurück + aktuelle + 3 vorwärts
        tage[(start + timedelta(days=i)).isoformat()] = []

    for a in daten:
        # Tiefbau — unterstützt Mehrtages-Range (tb_termin_bis)
        tb_str = a.get("tb_termin")
        if tb_str:
            try:
                dt_start = datetime.strptime(tb_str, "%Y-%m-%d %H:%M")
                tb_bis_str = a.get("tb_termin_bis")
                dt_end = datetime.strptime(tb_bis_str, "%Y-%m-%d").date() if tb_bis_str else dt_start.date()
                d = dt_start.date()
                while d <= dt_end:
                    key = d.isoformat()
                    if key in tage:
                        tage[key].append({
                            "zeit":          dt_start.strftime("%H:%M"),
                            "typ":           "tb",
                            "adresse":       a["adresse"],
                            "name":          a["name"],
                            "telefon":       a.get("telefon", ""),
                            "team":          a.get("tb_team", ""),
                            "stadt":         a["stadt"],
                            "status":        a["status"],
                            "wartegrund":    a.get("wartegrund", ""),
                            "kommentar":     a.get("kommentar", ""),
                            "tb_kommentar":  a.get("tb_kommentar", ""),
                            "inst_kommentar":a.get("inst_kommentar", ""),
                            "genehmigung":   a.get("genehmigung", False),
                            "genehm_von":    a.get("genehm_von"),
                            "genehm_bis":    a.get("genehm_bis"),
                        })
                    d += timedelta(days=1)
            except Exception:
                pass

        # Installation — immer nur ein Tag
        inst_str = a.get("inst_termin")
        if inst_str:
            try:
                dt = datetime.strptime(inst_str, "%Y-%m-%d %H:%M")
            except Exception:
                continue
            key = dt.date().isoformat()
            if key in tage:
                tage[key].append({
                    "zeit":          dt.strftime("%H:%M"),
                    "typ":           "inst",
                    "adresse":       a["adresse"],
                    "name":          a["name"],
                    "telefon":       a.get("telefon", ""),
                    "team":          a.get("inst_team", ""),
                    "stadt":         a["stadt"],
                    "status":        a["status"],
                    "wartegrund":    a.get("wartegrund", ""),
                    "kommentar":     a.get("kommentar", ""),
                    "tb_kommentar":  a.get("tb_kommentar", ""),
                    "inst_kommentar":a.get("inst_kommentar", ""),
                    "genehmigung":   a.get("genehmigung", False),
                    "genehm_von":    a.get("genehm_von"),
                    "genehm_bis":    a.get("genehm_bis"),
                })

    result = []
    for key in sorted(tage.keys()):
        dt_obj = datetime.strptime(key, "%Y-%m-%d")
        result.append({
            "datum":         key,
            "datum_display": dt_obj.strftime("%d.%m."),
            "wochentag":     _WOCHENTAGE[dt_obj.weekday()][:2],
            "ist_heute":     dt_obj.date() == heute,
            "termine":       sorted(tage[key], key=lambda x: x["zeit"]),
        })

    return result


@app.get("/api/kontakte")
def get_kontakte():
    return load_ansprechpartner()


@app.get("/api/verfuegbarkeit")
def get_verfuegbarkeit():
    return load_verfuegbarkeit()


@app.get("/api/kpi/status")
def get_kpi_status():
    return load_kpi_status()


@app.get("/api/kpi/nach-kw")
def get_kpi_nach_kw():
    return load_kpi_nach_kw()


@app.get("/api/prozess")
def get_prozess():
    import json
    pfad = os.environ.get(
        "PROZESS_PATH",
        os.path.join(os.path.dirname(__file__), "..", "sample_data", "prozess.json"),
    )
    try:
        with open(pfad, "r", encoding="utf-8") as f:
            return json.load(f)
    except FileNotFoundError:
        return {"titel": "Prozess", "untertitel": "Datei noch nicht angelegt", "schritte": []}


# --- Login / Logout ---
@app.get("/login")
def get_login():
    return login_page()

@app.post("/login")
async def post_login(request: Request, username: str = Form(...), password: str = Form(...)):
    ip = request.headers.get("CF-Connecting-IP") or request.client.host
    country = get_country(request)
    if not is_allowed_country(request):
        _log("BLOCKED_COUNTRY", ip, country, username)
        return HTMLResponse("<h1>403 – Zugriff nicht erlaubt</h1>", status_code=403)
    if _is_rate_limited(ip):
        _log("RATE_LIMITED", ip, country, username)
        return login_page("Zu viele Versuche. Bitte 15 Minuten warten.")
    if username == USERNAME and password == PASSWORD:
        _log("LOGIN_OK", ip, country, username)
        response = RedirectResponse("/", status_code=302)
        create_session_cookie(response)
        return response
    _log("LOGIN_FAIL", ip, country, username)
    return login_page("Benutzername oder Passwort falsch.")

@app.get("/logout")
def logout():
    response = RedirectResponse("/login", status_code=302)
    response.delete_cookie("gd_session")
    return response

# Frontend
app.mount("/static", StaticFiles(directory="../frontend"), name="static")

@app.get("/")
def root():
    return FileResponse("../frontend/html/index.html")
