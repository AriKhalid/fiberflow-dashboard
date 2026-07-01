from fastapi import APIRouter, HTTPException, Query
from pydantic import BaseModel
from typing import Optional
from todos_db import get_conn

router = APIRouter(prefix="/api/todos")


# ---------- Schemas ----------

class SpalteCreate(BaseModel):
    name: str
    farbe: Optional[str] = "#0071E3"

class SpalteUpdate(BaseModel):
    name: Optional[str] = None
    farbe: Optional[str] = None
    position: Optional[int] = None

class TodoCreate(BaseModel):
    spalte_id: int
    titel: str
    beschreibung: Optional[str] = None
    prioritaet: Optional[str] = "normal"
    zugewiesen: Optional[str] = None
    stadt: Optional[str] = None
    faellig_am: Optional[str] = None

class TodoUpdate(BaseModel):
    spalte_id: Optional[int] = None
    titel: Optional[str] = None
    beschreibung: Optional[str] = None
    prioritaet: Optional[str] = None
    zugewiesen: Optional[str] = None
    stadt: Optional[str] = None
    faellig_am: Optional[str] = None
    position: Optional[int] = None

class KommentarCreate(BaseModel):
    autor: str
    text: str


# ---------- Spalten ----------

@router.get("/spalten")
def get_spalten(
    prioritaet: Optional[str] = Query(None),
    zugewiesen: Optional[str] = Query(None),
):
    with get_conn() as conn:
        spalten = [dict(r) for r in conn.execute(
            "SELECT * FROM spalten WHERE geloescht_am IS NULL ORDER BY position"
        ).fetchall()]

        if not spalten:
            return spalten

        ids = [s["id"] for s in spalten]
        placeholders = ",".join("?" * len(ids))
        todo_sql  = f"SELECT * FROM todos WHERE spalte_id IN ({placeholders}) AND geloescht_am IS NULL"
        todo_args: list = list(ids)
        if prioritaet:
            todo_sql += " AND prioritaet = ?"
            todo_args.append(prioritaet)
        if zugewiesen:
            todo_sql += " AND zugewiesen = ?"
            todo_args.append(zugewiesen)
        todo_sql += " ORDER BY spalte_id, position"

        todos_by_spalte: dict = {}
        for t in conn.execute(todo_sql, todo_args).fetchall():
            t_dict = dict(t)
            todos_by_spalte.setdefault(t_dict["spalte_id"], []).append(t_dict)

        for s in spalten:
            s["todos"] = todos_by_spalte.get(s["id"], [])
        return spalten

@router.post("/spalten", status_code=201)
def create_spalte(body: SpalteCreate):
    with get_conn() as conn:
        max_pos = conn.execute(
            "SELECT COALESCE(MAX(position)+1, 0) FROM spalten WHERE geloescht_am IS NULL"
        ).fetchone()[0]
        cur = conn.execute(
            "INSERT INTO spalten (name, farbe, position) VALUES (?, ?, ?)",
            (body.name, body.farbe, max_pos)
        )
        return dict(conn.execute("SELECT * FROM spalten WHERE id = ?", (cur.lastrowid,)).fetchone())

@router.patch("/spalten/{spalte_id}")
def update_spalte(spalte_id: int, body: SpalteUpdate):
    felder = {k: v for k, v in body.model_dump().items() if v is not None}
    if not felder:
        raise HTTPException(400, "Keine Felder angegeben")
    sql = ", ".join(f"{k} = ?" for k in felder)
    with get_conn() as conn:
        conn.execute(
            f"UPDATE spalten SET {sql} WHERE id = ? AND geloescht_am IS NULL",
            (*felder.values(), spalte_id)
        )
        row = conn.execute("SELECT * FROM spalten WHERE id = ?", (spalte_id,)).fetchone()
        if not row:
            raise HTTPException(404, "Spalte nicht gefunden")
        return dict(row)

@router.delete("/spalten/{spalte_id}", status_code=204)
def delete_spalte(spalte_id: int):
    with get_conn() as conn:
        count = conn.execute(
            "SELECT COUNT(*) FROM todos WHERE spalte_id = ? AND geloescht_am IS NULL",
            (spalte_id,)
        ).fetchone()[0]
        if count > 0:
            raise HTTPException(400, f"Spalte hat noch {count} Karte(n) — erst verschieben oder löschen")
        conn.execute(
            "UPDATE spalten SET geloescht_am = datetime('now') WHERE id = ?",
            (spalte_id,)
        )


# ---------- Todos ----------

@router.post("", status_code=201)
def create_todo(body: TodoCreate):
    with get_conn() as conn:
        max_pos = conn.execute(
            "SELECT COALESCE(MAX(position)+1, 0) FROM todos WHERE spalte_id = ? AND geloescht_am IS NULL",
            (body.spalte_id,)
        ).fetchone()[0]
        cur = conn.execute(
            """INSERT INTO todos (spalte_id, titel, beschreibung, prioritaet, zugewiesen, stadt, faellig_am, position)
               VALUES (?, ?, ?, ?, ?, ?, ?, ?)""",
            (body.spalte_id, body.titel, body.beschreibung, body.prioritaet,
             body.zugewiesen, body.stadt, body.faellig_am, max_pos)
        )
        return dict(conn.execute("SELECT * FROM todos WHERE id = ?", (cur.lastrowid,)).fetchone())

@router.patch("/{todo_id}")
def update_todo(todo_id: int, body: TodoUpdate):
    felder = {k: v for k, v in body.model_dump().items() if v is not None}
    if not felder:
        raise HTTPException(400, "Keine Felder angegeben")
    set_parts = ["geaendert_am = datetime('now')"]
    values = []
    for k, v in felder.items():
        set_parts.append(f"{k} = ?")
        values.append(v)
    sql = ", ".join(set_parts)
    with get_conn() as conn:
        conn.execute(
            f"UPDATE todos SET {sql} WHERE id = ? AND geloescht_am IS NULL",
            (*values, todo_id)
        )
        row = conn.execute("SELECT * FROM todos WHERE id = ?", (todo_id,)).fetchone()
        if not row:
            raise HTTPException(404, "Todo nicht gefunden")
        return dict(row)

@router.delete("/{todo_id}", status_code=204)
def delete_todo(todo_id: int):
    with get_conn() as conn:
        conn.execute(
            "UPDATE todos SET geloescht_am = datetime('now') WHERE id = ?",
            (todo_id,)
        )


# ---------- Kommentare ----------

@router.get("/{todo_id}/kommentare")
def get_kommentare(todo_id: int):
    with get_conn() as conn:
        return [dict(r) for r in conn.execute(
            "SELECT * FROM kommentare WHERE todo_id = ? AND geloescht_am IS NULL ORDER BY erstellt_am",
            (todo_id,)
        ).fetchall()]

@router.post("/{todo_id}/kommentare", status_code=201)
def create_kommentar(todo_id: int, body: KommentarCreate):
    with get_conn() as conn:
        exists = conn.execute(
            "SELECT 1 FROM todos WHERE id = ? AND geloescht_am IS NULL", (todo_id,)
        ).fetchone()
        if not exists:
            raise HTTPException(404, "Todo nicht gefunden")
        cur = conn.execute(
            "INSERT INTO kommentare (todo_id, autor, text) VALUES (?, ?, ?)",
            (todo_id, body.autor, body.text)
        )
        return dict(conn.execute("SELECT * FROM kommentare WHERE id = ?", (cur.lastrowid,)).fetchone())

@router.delete("/kommentare/{kommentar_id}", status_code=204)
def delete_kommentar(kommentar_id: int):
    with get_conn() as conn:
        conn.execute(
            "UPDATE kommentare SET geloescht_am = datetime('now') WHERE id = ?",
            (kommentar_id,)
        )
