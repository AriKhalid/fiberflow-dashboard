"""
Bauakte-PDF-Parser.
Eine Funktion: parse(pdf_pfad) → dict mit Feldern + Warnungen.
Regex-Logik 1:1 portiert aus dem alten bauakte_import.py.
"""
import re
import pdfplumber
from pathlib import Path

LEERE_FELDER = {
    "kls_id":     "", "plz":      "", "ort":  "", "strasse": "",
    "hnr":        "", "hnr_z":    "", "nvt_name":   "",
    "kunde_name": "", "festnetz": "", "mobil":      "", "email":   "",
}


def parse(pdf_pfad: str | Path) -> dict:
    """Liest die erste PDF-Seite und extrahiert die bekannten Bauakte-Felder.
    Returns: {felder, warnungen}.
    `warnungen` ist eine Liste von Strings — leer wenn alles geklappt hat."""
    pdf_pfad = Path(pdf_pfad)
    felder    = dict(LEERE_FELDER)
    warnungen: list[str] = []

    try:
        with pdfplumber.open(pdf_pfad) as pdf:
            if not pdf.pages:
                return {"felder": felder, "warnungen": ["PDF hat keine Seiten"]}
            text = pdf.pages[0].extract_text() or ""
    except Exception as e:
        return {"felder": felder, "warnungen": [f"PDF konnte nicht gelesen werden: {e}"]}

    # KLS-ID
    m = re.search(r"KLS-ID:\s*(\d+)", text)
    if m:
        felder["kls_id"] = m.group(1)
    else:
        warnungen.append("KLS-ID nicht gefunden")

    # Adresse: "38116 Stadt A, Hedwig-Kohn-Weg 12" oder "...Weg 6 E"
    m = re.search(
        r"Adresse:\s*(\d{5})\s+([^,]+),\s+(.+?)\s+(\d+)\s*([A-Za-z]*)\s*$",
        text, re.MULTILINE,
    )
    if m:
        felder["plz"]     = m.group(1).strip()
        felder["ort"]     = m.group(2).strip()
        felder["strasse"] = m.group(3).strip()
        felder["hnr"]     = m.group(4).strip()
        felder["hnr_z"]   = m.group(5).strip()
    else:
        warnungen.append("Adresse nicht erkannt")

    # NVT Name
    m = re.search(r"NVT Name:\s*(\S+)", text)
    if m:
        felder["nvt_name"] = m.group(1).strip()

    # Kunde Name
    m = re.search(r"Kunde Name[:\s]+([^\n]+)", text)
    if m:
        felder["kunde_name"] = m.group(1).strip()
    else:
        warnungen.append("Kundenname nicht gefunden")

    # Kunde Telefon
    m = re.search(r"Kunde Telefon:\s*Festnetz:\s*(\S+)\s+Mobil:\s*(\S+)", text)
    if m:
        festnetz_val = m.group(1).strip()
        mobil_val    = m.group(2).strip()
        felder["festnetz"] = "" if festnetz_val == "/" else festnetz_val
        felder["mobil"]    = "" if mobil_val    == "/" else mobil_val

    # Kunde E-Mail
    m = re.search(r"Kunde E-Mail[:\s]+(\S+@\S+)", text)
    if m:
        felder["email"] = m.group(1).strip()

    return {"felder": felder, "warnungen": warnungen}
