import sqlite3
from datetime import datetime
from zoneinfo import ZoneInfo

DB_PATH = "bauakten.db"
_BERLIN = ZoneInfo("Europe/Berlin")


def init_db():
    con = sqlite3.connect(DB_PATH)
    con.execute("""
        CREATE TABLE IF NOT EXISTS bauakten_staging (
            id           INTEGER PRIMARY KEY AUTOINCREMENT,
            kls_id       TEXT,
            plz          TEXT,
            ort          TEXT,
            strasse      TEXT,
            hnr          TEXT,
            hnr_z        TEXT,
            nvt_name     TEXT,
            kunde_name   TEXT,
            festnetz     TEXT,
            mobil        TEXT,
            email        TEXT,
            sharepoint_pfad TEXT,
            warnung      TEXT,
            created_at   TEXT NOT NULL
        )
    """)
    con.commit()
    con.close()


def add(daten: dict) -> int:
    con = sqlite3.connect(DB_PATH)
    cur = con.cursor()
    cur.execute("""
        INSERT INTO bauakten_staging
        (kls_id, plz, ort, strasse, hnr, hnr_z, nvt_name, kunde_name,
         festnetz, mobil, email, sharepoint_pfad, warnung, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    """, (
        daten.get("kls_id", ""),
        daten.get("plz", ""),
        daten.get("ort", ""),
        daten.get("strasse", ""),
        daten.get("hnr", ""),
        daten.get("hnr_z", ""),
        daten.get("nvt_name", ""),
        daten.get("kunde_name", ""),
        daten.get("festnetz", ""),
        daten.get("mobil", ""),
        daten.get("email", ""),
        daten.get("sharepoint_pfad", ""),
        daten.get("warnung", ""),
        datetime.now(_BERLIN).isoformat(timespec="seconds"),
    ))
    neue_id = cur.lastrowid
    con.commit()
    con.close()
    return neue_id


def liste() -> list:
    con = sqlite3.connect(DB_PATH)
    con.row_factory = sqlite3.Row
    rows = con.execute("SELECT * FROM bauakten_staging ORDER BY id DESC").fetchall()
    con.close()
    return [dict(r) for r in rows]


def update(eintrag_id: int, feld: str, wert: str):
    erlaubt = {"kls_id", "plz", "ort", "strasse", "hnr", "hnr_z",
               "nvt_name", "kunde_name", "festnetz", "mobil", "email"}
    if feld not in erlaubt:
        raise ValueError(f"Feld nicht editierbar: {feld}")
    con = sqlite3.connect(DB_PATH)
    con.execute(f"UPDATE bauakten_staging SET {feld} = ? WHERE id = ?", (wert, eintrag_id))
    con.commit()
    con.close()


def loeschen(eintrag_id: int):
    con = sqlite3.connect(DB_PATH)
    con.execute("DELETE FROM bauakten_staging WHERE id = ?", (eintrag_id,))
    con.commit()
    con.close()


def kls_id_existiert(kls_id: str) -> bool:
    con = sqlite3.connect(DB_PATH)
    row = con.execute("SELECT 1 FROM bauakten_staging WHERE kls_id = ?", (kls_id,)).fetchone()
    con.close()
    return row is not None
