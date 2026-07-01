"""
SharePoint / Microsoft Graph Client.
Reine API-Calls — keine Business-Logik.
"""
import os
import urllib.request
import urllib.parse
import json

CLIENT_ID     = os.environ["SHAREPOINT_CLIENT_ID"]
TENANT_ID     = os.environ["SHAREPOINT_TENANT_ID"]
CLIENT_SECRET = os.environ["SHAREPOINT_CLIENT_SECRET"]

DRIVE_ID = os.environ.get("SHAREPOINT_DRIVE_ID", "")

# Demo-Platzhalter — echte SharePoint-Ordner-IDs gehören in die Umgebung/Config,
# nicht ins Repo. Hier generische Beispielstädte.
STADT_FOLDER_IDS = {
    "stadt_a": "REPLACE_WITH_FOLDER_ID",
    "stadt_b": "REPLACE_WITH_FOLDER_ID",
    "stadt_c": "REPLACE_WITH_FOLDER_ID",
}

AUSNAHME_STAEDTE = {"beispielstadt"}


class GraphError(Exception):
    pass


def get_token() -> str:
    data = urllib.parse.urlencode({
        "grant_type":    "client_credentials",
        "client_id":     CLIENT_ID,
        "client_secret": CLIENT_SECRET,
        "scope":         "https://graph.microsoft.com/.default",
    }).encode()
    req = urllib.request.Request(
        f"https://login.microsoftonline.com/{TENANT_ID}/oauth2/v2.0/token",
        data=data, method="POST",
    )
    with urllib.request.urlopen(req, timeout=30) as r:
        return json.loads(r.read())["access_token"]


def _request(method: str, url: str, token: str, body: bytes | None = None,
             headers: dict | None = None, timeout: int = 60) -> dict | None:
    h = {"Authorization": f"Bearer {token}"}
    if headers:
        h.update(headers)
    req = urllib.request.Request(url, data=body, method=method, headers=h)
    try:
        with urllib.request.urlopen(req, timeout=timeout) as r:
            raw = r.read()
            return json.loads(raw) if raw else None
    except urllib.error.HTTPError as e:
        msg = e.read().decode("utf-8", errors="replace")
        raise GraphError(f"{method} {url} → {e.code}: {msg[:300]}") from e


def kind_finden(token: str, parent_id: str, name: str) -> dict | None:
    """Sucht ein Kind (Datei oder Ordner) unter parent_id mit exaktem Namen.
    Returns Graph-Item-Dict oder None."""
    url = (f"https://graph.microsoft.com/v1.0/drives/{DRIVE_ID}/items/"
           f"{parent_id}/children?$top=999&$select=id,name,folder,file")
    while url:
        data = _request("GET", url, token)
        for child in data.get("value", []):
            if child.get("name") == name:
                return child
        url = data.get("@odata.nextLink")
    return None


def ordner_anlegen(token: str, parent_id: str, name: str) -> dict:
    """Legt einen Ordner an. Wenn er schon existiert: gibt den bestehenden zurück."""
    bestehend = kind_finden(token, parent_id, name)
    if bestehend and "folder" in bestehend:
        return bestehend

    url = f"https://graph.microsoft.com/v1.0/drives/{DRIVE_ID}/items/{parent_id}/children"
    body = json.dumps({
        "name": name,
        "folder": {},
        "@microsoft.graph.conflictBehavior": "fail",
    }).encode()
    return _request("POST", url, token, body=body,
                    headers={"Content-Type": "application/json"})


def datei_hochladen(token: str, parent_id: str, dateiname: str, inhalt: bytes) -> dict:
    """PUT eines kleinen Files (<4 MB) — Bauakten sind typ. < 1 MB.
    Bei Namens-Konflikt benennt Graph automatisch um (z.B. 'Reischauerstr. 37 1.pdf').
    Der tatsächlich vergebene Name steht im Response unter 'name'."""
    safe_name = urllib.parse.quote(dateiname)
    url = (f"https://graph.microsoft.com/v1.0/drives/{DRIVE_ID}/items/"
           f"{parent_id}:/{safe_name}:/content"
           f"?@microsoft.graph.conflictBehavior=rename")
    return _request("PUT", url, token, body=inhalt,
                    headers={"Content-Type": "application/octet-stream"},
                    timeout=120)


def stadt_zu_folder_id(ort: str) -> tuple[str | None, bool]:
    """Mappt einen Ort-String auf (folder_id, ist_ausnahme).
    Returns (None, False) wenn unbekannt."""
    ort_lower = ort.lower()
    for schluessel, folder_id in STADT_FOLDER_IDS.items():
        if schluessel.replace("_", " ") in ort_lower or schluessel in ort_lower:
            return folder_id, False
    for ausnahme in AUSNAHME_STAEDTE:
        if ausnahme in ort_lower:
            return STADT_FOLDER_IDS["stadt_a"], True
    return None, False
