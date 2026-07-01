"""
Bauakten-Router.
Orchestriert: PDF entgegennehmen → parsen → SharePoint hochladen → Staging-DB.

Parsen (CPU) und SharePoint-Upload (Netzwerk) laufen pro Batch parallel über
Thread-Pool-Tasks — bei vielen PDFs sonst unnötig langsam, weil pdfplumber +
Microsoft Graph rein sequenziell sonst den FastAPI-Event-Loop blockieren würden.
Der KLS-ID-Dupe-Check bleibt bewusst sequenziell (kein Thread-Pool), damit zwei
PDFs mit derselben KLS-ID im selben Batch sich nicht gegenseitig überholen.
"""
import asyncio
import tempfile
from pathlib import Path
from typing import List
from fastapi import APIRouter, UploadFile, File, HTTPException
from pydantic import BaseModel

import bauakten_db
import bauakte_parser
from sharepoint_client import (
    get_token, ordner_anlegen, datei_hochladen,
    stadt_zu_folder_id, GraphError,
)

router = APIRouter(prefix="/api/bauakten")


# ---------- Schemas ----------

class FeldUpdate(BaseModel):
    feld: str
    wert: str


# ---------- Helpers ----------

def _adress_ordnername(felder: dict) -> str:
    """'Reischauerstr. 37' oder 'Hedwig-Kohn-Weg 6 E'."""
    suffix = (" " + felder["hnr_z"]) if felder["hnr_z"] else ""
    return f"{felder['strasse']} {felder['hnr']}{suffix}".strip()


def _dateiname(felder: dict) -> str:
    """'Reischauerstr. 37.pdf' oder 'Hedwig-Kohn-Weg 6E.pdf'.
    Hnr_z hängt direkt an der Hausnummer (ohne Leerzeichen)."""
    return f"{felder['strasse']} {felder['hnr']}{felder['hnr_z']}.pdf"


def _parse_pdf(pdf_bytes: bytes) -> dict:
    """Nur das Parsen — läuft im Thread-Pool, kein Netzwerk."""
    with tempfile.NamedTemporaryFile(suffix=".pdf", delete=False) as tmp:
        tmp.write(pdf_bytes)
        tmp_pfad = tmp.name
    try:
        return bauakte_parser.parse(tmp_pfad)
    finally:
        Path(tmp_pfad).unlink(missing_ok=True)


def _als_duplikat_speichern(felder: dict, warnungen: list, original_name: str) -> dict:
    db_id = bauakten_db.add({
        **felder,
        "sharepoint_pfad": "",
        "warnung": " | ".join(warnungen),
    })
    return {
        "status":   "duplikat",
        "datei":    original_name,
        "db_id":    db_id,
        "felder":   felder,
        "warnungen": warnungen,
    }


def _upload_und_speichern(token: str, felder: dict, warnungen: list,
                           pdf_bytes: bytes, original_name: str) -> dict:
    """SharePoint-Upload (Netzwerk) + Staging-DB — läuft im Thread-Pool."""
    warnungen = list(warnungen)
    sharepoint_pfad = ""

    folder_id, ist_ausnahme = stadt_zu_folder_id(felder["ort"])
    if not folder_id:
        warnungen.append(f"Stadt '{felder['ort']}' unbekannt — PDF nicht hochgeladen")
    elif not felder["strasse"] or not felder["hnr"]:
        warnungen.append("Straße/Hausnummer fehlen — PDF nicht hochgeladen")
    else:
        if ist_ausnahme:
            warnungen.append(f"Ausnahme: {felder['ort']} unter Stadt A abgelegt")
        try:
            adress_name = _adress_ordnername(felder)
            adress_ordner = ordner_anlegen(token, folder_id, adress_name)
            gewuenschter_name = _dateiname(felder)
            response = datei_hochladen(token, adress_ordner["id"], gewuenschter_name, pdf_bytes)
            tatsaechlicher_name = (response or {}).get("name", gewuenschter_name)
            if tatsaechlicher_name != gewuenschter_name:
                warnungen.append(
                    f"Datei existierte schon → automatisch umbenannt zu '{tatsaechlicher_name}'"
                )
            sharepoint_pfad = f"{felder['ort']}/{adress_name}/{tatsaechlicher_name}"
        except GraphError as e:
            warnungen.append(f"SharePoint-Upload fehlgeschlagen: {e}")

    db_id = bauakten_db.add({
        **felder,
        "sharepoint_pfad": sharepoint_pfad,
        "warnung":         " | ".join(warnungen),
    })

    return {
        "status":    "ok" if not warnungen else "warnung",
        "datei":     original_name,
        "db_id":     db_id,
        "felder":    felder,
        "warnungen": warnungen,
        "sharepoint_pfad": sharepoint_pfad,
    }


# ---------- Endpoints ----------

@router.post("/upload")
async def upload(files: List[UploadFile] = File(...)):
    """Bulk-Upload mehrerer PDFs. Returns Liste mit Status pro Datei (Reihenfolge = Input)."""
    if not files:
        raise HTTPException(status_code=400, detail="Keine Dateien")

    try:
        token = get_token()
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"Token-Holen fehlgeschlagen: {e}")

    n = len(files)
    ergebnisse: list = [None] * n
    eingelesen: list = [None] * n  # (original_name, pdf_bytes) oder None bei Ablehnung

    # 1) Validieren + Einlesen — schnell, sequenziell
    for i, upload_file in enumerate(files):
        if not upload_file.filename.lower().endswith(".pdf"):
            ergebnisse[i] = {
                "status": "fehler",
                "datei":  upload_file.filename,
                "warnungen": ["Nur PDFs erlaubt (z.B. keine ZIP-Dateien)"],
            }
            continue

        inhalt = await upload_file.read()
        if not inhalt.startswith(b"%PDF"):
            ergebnisse[i] = {
                "status": "fehler",
                "datei":  upload_file.filename,
                "warnungen": ["Datei-Inhalt ist kein echtes PDF — abgelehnt"],
            }
            continue

        eingelesen[i] = (upload_file.filename, inhalt)

    # 2) Parsen — CPU-lastig, parallel im Thread-Pool
    async def _sicher_parsen(pdf_bytes: bytes):
        try:
            return await asyncio.to_thread(_parse_pdf, pdf_bytes)
        except Exception as e:
            return {"_fehler": str(e)}

    parse_ergebnisse: list = [None] * n
    indizes_zu_parsen = [i for i, e in enumerate(eingelesen) if e is not None]
    geparst = await asyncio.gather(*[_sicher_parsen(eingelesen[i][1]) for i in indizes_zu_parsen])
    for i, parse_result in zip(indizes_zu_parsen, geparst):
        parse_ergebnisse[i] = parse_result

    # 3) Dupe-Check innerhalb des Batches — schnell, sequenziell (Reihenfolge entscheidet)
    batch_kls_ids: set = set()
    upload_tasks = []  # (i, felder, warnungen, pdf_bytes, original_name)
    for i in indizes_zu_parsen:
        original_name, pdf_bytes = eingelesen[i]
        parse_result = parse_ergebnisse[i]
        if "_fehler" in parse_result:
            ergebnisse[i] = {
                "status": "fehler",
                "datei":  original_name,
                "warnungen": [f"Verarbeitung fehlgeschlagen: {parse_result['_fehler']}"],
            }
            continue

        felder    = parse_result["felder"]
        warnungen = list(parse_result["warnungen"])

        ist_dupe = felder["kls_id"] and (
            felder["kls_id"] in batch_kls_ids or bauakten_db.kls_id_existiert(felder["kls_id"])
        )
        if ist_dupe:
            warnungen.append(f"KLS-ID {felder['kls_id']} bereits in Staging — nichts hochgeladen")
            ergebnisse[i] = _als_duplikat_speichern(felder, warnungen, original_name)
        else:
            if felder["kls_id"]:
                batch_kls_ids.add(felder["kls_id"])
            upload_tasks.append((i, felder, warnungen, pdf_bytes, original_name))

    # 4) SharePoint-Upload — Netzwerk-lastig, parallel im Thread-Pool
    async def _hochladen_und_eintragen(i, felder, warnungen, pdf_bytes, original_name):
        try:
            ergebnisse[i] = await asyncio.to_thread(
                _upload_und_speichern, token, felder, warnungen, pdf_bytes, original_name
            )
        except Exception as e:
            ergebnisse[i] = {
                "status": "fehler",
                "datei":  original_name,
                "warnungen": [f"Verarbeitung fehlgeschlagen: {e}"],
            }

    await asyncio.gather(*[_hochladen_und_eintragen(*t) for t in upload_tasks])

    return {"anzahl": n, "ergebnisse": ergebnisse}


@router.get("")
def liste():
    return bauakten_db.liste()


@router.patch("/{eintrag_id}")
def feld_update(eintrag_id: int, payload: FeldUpdate):
    try:
        bauakten_db.update(eintrag_id, payload.feld, payload.wert)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    return {"ok": True}


@router.delete("/{eintrag_id}")
def loeschen(eintrag_id: int):
    bauakten_db.loeschen(eintrag_id)
    return {"ok": True}
