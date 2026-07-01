import sqlite3
import os

DB_PATH = os.path.join(os.path.dirname(__file__), "todos.db")

def get_conn() -> sqlite3.Connection:
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA foreign_keys = ON")
    return conn

def init_db():
    with get_conn() as conn:
        conn.executescript("""
            CREATE TABLE IF NOT EXISTS spalten (
                id           INTEGER PRIMARY KEY AUTOINCREMENT,
                name         TEXT    NOT NULL,
                farbe        TEXT    NOT NULL DEFAULT '#0071E3',
                position     INTEGER NOT NULL DEFAULT 0,
                erstellt_am  TEXT    NOT NULL DEFAULT (datetime('now')),
                geloescht_am TEXT
            );

            CREATE TABLE IF NOT EXISTS todos (
                id            INTEGER PRIMARY KEY AUTOINCREMENT,
                spalte_id     INTEGER NOT NULL REFERENCES spalten(id) ON DELETE RESTRICT,
                titel         TEXT    NOT NULL,
                beschreibung  TEXT,
                prioritaet    TEXT    NOT NULL DEFAULT 'normal',
                zugewiesen    TEXT,
                stadt         TEXT,
                faellig_am    TEXT,
                position      INTEGER NOT NULL DEFAULT 0,
                erstellt_am   TEXT    NOT NULL DEFAULT (datetime('now')),
                geaendert_am  TEXT    NOT NULL DEFAULT (datetime('now')),
                geloescht_am  TEXT
            );

            CREATE TABLE IF NOT EXISTS kommentare (
                id           INTEGER PRIMARY KEY AUTOINCREMENT,
                todo_id      INTEGER NOT NULL REFERENCES todos(id) ON DELETE CASCADE,
                autor        TEXT    NOT NULL DEFAULT 'Unbekannt',
                text         TEXT    NOT NULL,
                erstellt_am  TEXT    NOT NULL DEFAULT (datetime('now')),
                geloescht_am TEXT
            );

            CREATE INDEX IF NOT EXISTS idx_todos_spalte_id  ON todos(spalte_id);
            CREATE INDEX IF NOT EXISTS idx_todos_aktiv      ON todos(geloescht_am);
            CREATE INDEX IF NOT EXISTS idx_spalten_aktiv    ON spalten(geloescht_am);
            CREATE INDEX IF NOT EXISTS idx_kommentare_todo  ON kommentare(todo_id);
        """)

        # Migration: geloescht_am zu bestehenden Tabellen hinzufügen falls noch nicht vorhanden
        for table in ("spalten", "todos", "kommentare"):
            cols = [r[1] for r in conn.execute(f"PRAGMA table_info({table})").fetchall()]
            if "geloescht_am" not in cols:
                conn.execute(f"ALTER TABLE {table} ADD COLUMN geloescht_am TEXT")

        # Standard-Spalten nur wenn noch keine aktiven existieren
        count = conn.execute("SELECT COUNT(*) FROM spalten WHERE geloescht_am IS NULL").fetchone()[0]
        if count == 0:
            conn.executemany(
                "INSERT INTO spalten (name, farbe, position) VALUES (?, ?, ?)",
                [
                    ("Offen",     "#FF9500", 0),
                    ("In Arbeit", "#0071E3", 1),
                    ("Erledigt",  "#34C759", 2),
                ]
            )
