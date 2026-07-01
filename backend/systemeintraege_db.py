import sqlite3, os

DB_PATH = os.path.join(os.path.dirname(__file__), "systemeintraege.db")
TYPEN   = ("tb_gbs", "hausstich_gbs", "inst_gbs")

def init_db():
    con = sqlite3.connect(DB_PATH)
    con.execute("""
        CREATE TABLE IF NOT EXISTS systemeintraege (
            kls_id        TEXT PRIMARY KEY,
            tb_gbs        INTEGER NOT NULL DEFAULT 0,
            hausstich_gbs INTEGER NOT NULL DEFAULT 0,
            inst_gbs      INTEGER NOT NULL DEFAULT 0
        )
    """)
    con.commit()
    con.close()

def alle() -> list[dict]:
    con = sqlite3.connect(DB_PATH)
    rows = con.execute(
        "SELECT kls_id, tb_gbs, hausstich_gbs, inst_gbs FROM systemeintraege"
    ).fetchall()
    con.close()
    return [{"kls_id": r[0], "tb_gbs": r[1], "hausstich_gbs": r[2], "inst_gbs": r[3]} for r in rows]

def setzen(kls_id: str, typ: str, wert: int):
    if typ not in TYPEN:
        raise ValueError(f"Unbekannter Typ: {typ}")
    con = sqlite3.connect(DB_PATH)
    con.execute(f"""
        INSERT INTO systemeintraege (kls_id, {typ}) VALUES (?, ?)
        ON CONFLICT(kls_id) DO UPDATE SET {typ} = excluded.{typ}
    """, (kls_id, wert))
    con.commit()
    con.close()
