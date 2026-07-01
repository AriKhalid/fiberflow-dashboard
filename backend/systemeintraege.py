from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
import systemeintraege_db as db

router = APIRouter(prefix="/api/systemeintraege")

@router.get("")
def get_alle():
    return db.alle()

@router.post("/{kls_id}/{typ}")
def post_setzen(kls_id: str, typ: str):
    try:
        db.setzen(kls_id, typ, 1)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    return {"ok": True}

@router.delete("/{kls_id}/{typ}")
def delete_zurueck(kls_id: str, typ: str):
    try:
        db.setzen(kls_id, typ, 0)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    return {"ok": True}
