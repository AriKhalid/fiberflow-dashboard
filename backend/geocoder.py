import json
import os
import time
import urllib.request
import urllib.parse

CACHE_PATH = os.path.join(os.path.dirname(__file__), "geocache.json")

# Bekannte Stadtgrenzen — Einträge außerhalb werden als falsch erkannt
STADT_BOUNDS = {
    "Stadt B": {"lat": (52.12, 52.22), "lng": (10.48, 10.65)},
    "Stadt A":  {"lat": (52.20, 52.34), "lng": (10.42, 10.64)},
    "Stadt D":        {"lat": (51.96, 52.03), "lng": (9.78,  9.92)},
    "Stadt C":      {"lat": (52.21, 52.27), "lng": (9.79,  9.90)},
    "Stadt E":       {"lat": (52.46, 52.52), "lng": (10.50, 10.58)},
    "Stadt F":  {"lat": (51.85, 51.92), "lng": (10.50, 10.65)},
}

def _load_cache() -> dict:
    if os.path.exists(CACHE_PATH):
        with open(CACHE_PATH, "r", encoding="utf-8") as f:
            return json.load(f)
    return {}

def _save_cache(cache: dict):
    with open(CACHE_PATH, "w", encoding="utf-8") as f:
        json.dump(cache, f, ensure_ascii=False, indent=2)

def _parse_adresse(adresse: str) -> tuple[str, str]:
    """Trennt 'Musterstr. 1A, Stadt B' in ('Musterstr. 1A', 'Stadt B')."""
    teile = adresse.rsplit(",", 1)
    if len(teile) == 2:
        return teile[0].strip(), teile[1].strip()
    return adresse.strip(), ""

def _koordinaten_plausibel(lat: float, lng: float, stadt: str) -> bool:
    """Prüft ob Koordinaten innerhalb der bekannten Stadtgrenzen liegen."""
    bounds = STADT_BOUNDS.get(stadt)
    if not bounds:
        return True  # Unbekannte Stadt → nicht prüfen
    return (bounds["lat"][0] <= lat <= bounds["lat"][1] and
            bounds["lng"][0] <= lng <= bounds["lng"][1])

def _fetch_nominatim(params: dict) -> tuple[float, float] | None:
    query = urllib.parse.urlencode(params)
    url = f"https://nominatim.openstreetmap.org/search?{query}"
    req = urllib.request.Request(url, headers={"User-Agent": "FiberFlowDashboard/1.0"})
    try:
        with urllib.request.urlopen(req, timeout=8) as resp:
            data = json.loads(resp.read())
        if data:
            return float(data[0]["lat"]), float(data[0]["lon"])
    except Exception:
        pass
    return None

def _geocode_fetch(adresse: str, cache: dict) -> tuple[float, float] | None:
    """Führt Nominatim-Requests durch. Erwartet bereits geladenen Cache (kein File-I/O)."""
    strasse, stadt = _parse_adresse(adresse)
    result = None
    if stadt:
        result = _fetch_nominatim({
            "street": strasse,
            "city": stadt,
            "country": "de",
            "format": "json",
            "limit": 1,
            "addressdetails": 0,
        })
        time.sleep(1)
        if result and not _koordinaten_plausibel(result[0], result[1], stadt):
            result = None
    if not result:
        result = _fetch_nominatim({"q": adresse + ", Deutschland", "format": "json", "limit": 1})
        time.sleep(1)
        if result and not _koordinaten_plausibel(result[0], result[1], stadt):
            result = None
    return result


def geocode(adresse: str) -> tuple[float, float] | None:
    cache = _load_cache()
    if adresse in cache:
        return tuple(cache[adresse]) if cache[adresse] else None
    result = _geocode_fetch(adresse, cache)
    cache[adresse] = list(result) if result else None
    _save_cache(cache)
    return result


def geocode_alle(auftraege: list[dict]) -> list[dict]:
    """Gibt sofort alle Einträge zurück die bereits im Cache sind."""
    cache = _load_cache()
    result = []
    for a in auftraege:
        adresse = a.get("adresse", "")
        if not adresse:
            continue
        coords = cache.get(adresse)
        if coords:
            result.append({**a, "lat": coords[0], "lng": coords[1]})
    return result


def geocode_fehlende(auftraege: list[dict]):
    """Geocodiert alle Adressen die noch nicht im Cache sind (für Hintergrund-Task)."""
    cache = _load_cache()
    fehlend = [a for a in auftraege if a.get("adresse") and a["adresse"] not in cache]
    for a in fehlend:
        adresse = a["adresse"]
        result = _geocode_fetch(adresse, cache)
        cache[adresse] = list(result) if result else None
        _save_cache(cache)


def cache_bereinigen():
    """Entfernt Einträge aus dem Cache deren Koordinaten außerhalb der Stadtgrenzen liegen."""
    cache = _load_cache()
    entfernt = []

    for adresse, coords in list(cache.items()):
        if not coords:
            continue
        _, stadt = _parse_adresse(adresse)
        if not _koordinaten_plausibel(coords[0], coords[1], stadt):
            entfernt.append(adresse)
            del cache[adresse]

    if entfernt:
        _save_cache(cache)

    return entfernt
