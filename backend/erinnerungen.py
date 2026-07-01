"""
Erinnerungen — leitet "überfällige" Fälle direkt aus den ohnehin geladenen
Auftragsdaten ab (kein eigener Excel-Read, keine eigene DB). Eine Liste
verschwindet automatisch, sobald der Excel-Status den Schritt als erledigt zeigt.
"""
from datetime import datetime, timedelta
from zoneinfo import ZoneInfo

_BERLIN = ZoneInfo("Europe/Berlin")

VAO_ABLAUF_TAGE = 14   # Warnschwelle: VAO läuft in <= 14 Tagen ab (oder ist schon abgelaufen)
HAUSSTICH_TAGE  = 2    # Warnschwelle: Tiefbau seit > 2 Tagen abgeschlossen, Hausstich noch offen

_ABGESCHLOSSEN_STATI = {"Auftrag abgeschlossen", "Prozess abgeschlossen", "Storno"}


def _heute():
    return datetime.now(_BERLIN).date()


def _parse_datum(s: str | None, fmt: str):
    """Parst ein Datum. Gibt None bei fehlendem/unplausiblem Wert zurück
    (z.B. '1900-01-01'-Platzhalter, die in der Excel vorkommen)."""
    if not s:
        return None
    try:
        d = datetime.strptime(s, fmt).date()
    except (ValueError, TypeError):
        return None
    return d if d.year >= 2020 else None


def _leere_stadt_zeile() -> dict:
    return {"neu_gestern": 0, "neu_diese_woche": 0, "gesamt_offen": 0, "ablaufend": 0}


def vao_offene(auftraege: list[dict]) -> dict:
    """{'fehlend': [...], 'ablaufend': [...]} — je sortiert nach Dringlichkeit.
    Zusätzlich 'neu_gestern'/'neu_diese_woche'-Zählung gesamt und 'pro_stadt'
    mit derselben Aufschlüsselung je Sheet/Stadt."""
    heute = _heute()
    gestern = heute - timedelta(days=1)
    kw_heute = heute.isocalendar()[1]
    jahr_heute = heute.isocalendar()[0]

    fehlend = []
    ablaufend = []
    neu_gestern = 0
    neu_diese_woche = 0
    pro_stadt: dict = {}

    for a in auftraege:
        if a.get("status") in _ABGESCHLOSSEN_STATI:
            continue

        stadt = a.get("stadt") or "—"
        zeile = pro_stadt.setdefault(stadt, _leere_stadt_zeile())

        if not a.get("genehmigung"):
            eingang = _parse_datum(a.get("eingangsdatum"), "%Y-%m-%d")
            ist_gestern = eingang is not None and eingang == gestern
            ist_diese_woche = False
            if eingang is not None:
                iso = eingang.isocalendar()
                ist_diese_woche = iso[0] == jahr_heute and iso[1] == kw_heute

            fehlend.append(a)
            zeile["gesamt_offen"] += 1
            if ist_gestern:
                neu_gestern += 1
                zeile["neu_gestern"] += 1
            if ist_diese_woche:
                neu_diese_woche += 1
                zeile["neu_diese_woche"] += 1
            continue

        bis = _parse_datum(a.get("genehm_bis"), "%d.%m.%Y")
        if bis is not None:
            tage = (bis - heute).days
            if tage <= VAO_ABLAUF_TAGE:
                ablaufend.append({**a, "tage_bis_ablauf": tage})
                zeile["ablaufend"] += 1

    fehlend.sort(key=lambda a: a.get("adresse", ""))
    ablaufend.sort(key=lambda a: a["tage_bis_ablauf"])

    return {
        "fehlend": fehlend,
        "ablaufend": ablaufend,
        "neu_gestern": neu_gestern,
        "neu_diese_woche": neu_diese_woche,
        "pro_stadt": dict(sorted(pro_stadt.items(), key=lambda kv: kv[0])),
    }


def hausstich_offene(auftraege: list[dict]) -> list:
    """status == 'TB abgeschlossen' und TB-Termin liegt länger als HAUSSTICH_TAGE
    zurück. Fehlt ein plausibles TB-Termin-Datum, wird der Fall trotzdem gelistet
    (status allein ist Signal genug) — nur ohne Tage-Angabe, da nicht berechenbar."""
    heute = _heute()
    eindeutig = []
    unklar = []

    for a in auftraege:
        if a.get("status") != "TB abgeschlossen":
            continue

        tb = _parse_datum((a.get("tb_termin") or "")[:10], "%Y-%m-%d")
        if tb is None:
            unklar.append({**a, "tage_seit_tb": None})
            continue

        tage = (heute - tb).days
        if tage > HAUSSTICH_TAGE:
            eindeutig.append({**a, "tage_seit_tb": tage})

    eindeutig.sort(key=lambda a: -a["tage_seit_tb"])
    return eindeutig + unklar
