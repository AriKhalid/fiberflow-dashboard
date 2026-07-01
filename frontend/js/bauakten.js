// Excel-Spalten-Reihenfolge wie im alten bauakte_import.py
// (1 Eintrag = 1 Excel-Zeile; Feld-Reihenfolge so wie sie ins Sheet wandert)
const BAUAKTEN_FELDER = [
    { key: "kls_id",     label: "KLS-ID",       spalte: "A" },
    { key: "nvt_name",   label: "NVT",          spalte: "D" },
    { key: "plz",        label: "PLZ",          spalte: "P" },
    { key: "ort",        label: "Ort",          spalte: "Q" },
    { key: "strasse",    label: "Straße",       spalte: "R" },
    { key: "hnr",        label: "Hausnummer",   spalte: "S" },
    { key: "hnr_z",      label: "Hnr. Z.",      spalte: "T" },
    { key: "kunde_name", label: "Name",         spalte: "U" },
    { key: "email",      label: "E-Mail",       spalte: "V" },
    { key: "telefon",    label: "Telefon",      spalte: "W" },
];

// P–W sind in der Excel zusammenhängende Spalten (PLZ...Telefon) — als
// Tab-getrennter Block direkt in eine Zeile/mehrere Zeilen der Excel einfügbar.
// A (KLS-ID) und D (NVT) liegen isoliert dazwischen und gehören nicht zum Block.
const BLOCK_PW_FELDER = BAUAKTEN_FELDER.slice(2);

class BauaktenPage {
    constructor() {
        this._container = document.getElementById("page-bauakten");
        this._eintraege = [];
        this._isUploading = false;
        this._render();
        this._load();
    }

    async _load() {
        try {
            const res = await fetch("/api/bauakten");
            const data = res.ok ? await res.json() : [];
            this._eintraege = Array.isArray(data) ? data : [];
        } catch {
            this._eintraege = [];
        }
        this._renderListe();
    }

    reload() { this._load(); }

    _render() {
        this._container.innerHTML = `
            <div class="bauakten-layout">
                <div class="bauakten-header">
                    <h1>Bauakten</h1>
                    <p class="bauakten-subtitle">PDFs hier ablegen → Felder werden geparst und auf SharePoint abgelegt. Zelle anklicken kopiert einzelnen Wert, Spalten-Icon kopiert die ganze Spalte, „Block kopieren“ kopiert PLZ–Telefon aller Zeilen auf einmal ins Excel-Sheet der Stadt.</p>
                </div>

                <svg style="display:none">
                    <defs>
                        <symbol id="icon-imageUpload" clip-rule="evenodd" viewBox="0 0 96 96">
                            <path d="M47 6a21 21 0 0 0-12.3 3.8c-2.7 2.1-4.4 5-4.7 7.1-5.8 1.2-10.3 5.6-10.3 10.6 0 6 5.8 11 13 11h12.6V22.7l-7.1 6.8c-.4.3-.9.5-1.4.5-1 0-2-.8-2-1.7 0-.4.3-.9.6-1.2l10.3-8.8c.3-.4.8-.6 1.3-.6.6 0 1 .2 1.4.6l10.2 8.8c.4.3.6.8.6 1.2 0 1-.9 1.7-2 1.7-.5 0-1-.2-1.3-.5l-7.2-6.8v15.6h14.4c6.1 0 11.2-4.1 11.2-9.4 0-5-4-8.8-9.5-9.4C63.8 11.8 56 5.8 47 6Zm-1.7 42.7V38.4h3.4v10.3c0 .8-.7 1.5-1.7 1.5s-1.7-.7-1.7-1.5Z M27 49c-4 0-7 2-7 6v29c0 3 3 6 6 6h42c3 0 6-3 6-6V55c0-4-3-6-7-6H28Zm41 3c1 0 3 1 3 3v19l-13-6a2 2 0 0 0-2 0L44 79l-10-5a2 2 0 0 0-2 0l-9 7V55c0-2 2-3 4-3h41Z M40 62c0 2-2 4-5 4s-5-2-5-4 2-4 5-4 5 2 5 4Z"/>
                        </symbol>
                        <symbol id="icon-copy" viewBox="0 0 24 24">
                            <rect x="9" y="9" width="13" height="13" rx="2" ry="2" fill="none" stroke="currentColor" stroke-width="2"/>
                            <path fill="none" stroke="currentColor" stroke-width="2" d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>
                        </symbol>
                        <symbol id="icon-check" viewBox="0 0 24 24">
                            <polyline points="20 6 9 17 4 12" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/>
                        </symbol>
                    </defs>
                </svg>

                <fieldset class="upload_dropZone" id="bauakten-drop">
                    <legend class="upload_legend_hidden">Bauakte hochladen</legend>
                    <svg class="upload_svg" aria-hidden="true"><use href="#icon-imageUpload"></use></svg>
                    <p>Bauakte-PDF(s) per Drag &amp; Drop hier ablegen<br><i>oder</i></p>
                    <input id="bauakten-file" class="upload_input_hidden" type="file" multiple accept="application/pdf">
                    <label class="btn-upload" for="bauakten-file">PDF auswählen</label>
                    <div class="upload_gallery" id="upload_gallery"></div>
                </fieldset>

                <div class="bauakten-liste-header">
                    <h2>Eingegangene Bauakten</h2>
                    <span class="anzahl" id="bauakten-anzahl"></span>
                </div>

                <div id="bauakten-liste-container">
                    <div class="bauakten-leer">Lade…</div>
                </div>
            </div>
        `;
        this._attachEvents();
    }

    _attachEvents() {
        const zone  = document.getElementById("bauakten-drop");
        const input = document.getElementById("bauakten-file");
        const stop  = e => { e.preventDefault(); e.stopPropagation(); };

        ["dragenter", "dragover", "dragleave", "drop"].forEach(ev =>
            zone.addEventListener(ev, stop, false));
        ["dragenter", "dragover"].forEach(ev =>
            zone.addEventListener(ev, () => zone.classList.add("highlight"), false));
        ["dragleave", "drop"].forEach(ev =>
            zone.addEventListener(ev, () => zone.classList.remove("highlight"), false));

        zone.addEventListener("drop", e => {
            const alle = [...e.dataTransfer.files];
            const dateien = alle.filter(f =>
                f.type === "application/pdf" || f.name.toLowerCase().endsWith(".pdf"));
            const abgelehnt = alle.filter(f => !dateien.includes(f));
            this._upload(dateien, abgelehnt);
        }, false);

        input.addEventListener("change", e => {
            this._upload([...e.target.files], []);
            e.target.value = "";
        }, false);
    }

    async _upload(dateien, abgelehnt = []) {
        if (this._isUploading) return;
        if (!dateien.length && !abgelehnt.length) return;
        this._isUploading = true;

        const abgelehntHtml = abgelehnt.map(f =>
            this._uploadFehlerItem(`${f.name}: Nur PDFs erlaubt (z.B. keine ZIP-Dateien)`)
        ).join("");

        const gallery = document.getElementById("upload_gallery");

        if (!dateien.length) {
            gallery.innerHTML = abgelehntHtml;
            this._isUploading = false;
            return;
        }

        gallery.innerHTML = abgelehntHtml + `
            <div class="upload_item">
                <span class="upload_badge lade">Lade…</span>
                <span class="upload_item_text">${dateien.length} PDF${dateien.length === 1 ? "" : "s"} werden verarbeitet</span>
            </div>
        `;

        const fd = new FormData();
        for (const f of dateien) fd.append("files", f);

        try {
            const res = await fetch("/api/bauakten/upload", { method: "POST", body: fd });
            if (!res.ok) {
                gallery.innerHTML = abgelehntHtml + this._uploadFehlerItem(`Upload fehlgeschlagen: ${await res.text()}`);
            } else {
                const data = await res.json();
                this._zeigeUploadErgebnis(data.ergebnisse, abgelehntHtml);
            }
        } catch (e) {
            gallery.innerHTML = abgelehntHtml + this._uploadFehlerItem(`Netzwerkfehler: ${e.message}`);
        } finally {
            this._isUploading = false;
            this._load();
        }
    }

    _uploadFehlerItem(text) {
        return `
            <div class="upload_item">
                <span class="upload_badge fehler">Fehler</span>
                <span class="upload_item_text">${this._escape(text)}</span>
            </div>
        `;
    }

    _zeigeUploadErgebnis(ergebnisse, abgelehntHtml = "") {
        const gallery = document.getElementById("upload_gallery");
        gallery.innerHTML = abgelehntHtml + ergebnisse.map(r => {
            const warn = (r.warnungen && r.warnungen.length > 0)
                ? `<span class="warn">— ${this._escape(r.warnungen.join(" | "))}</span>` : "";
            return `
                <div class="upload_item">
                    <span class="upload_badge ${r.status}">${r.status}</span>
                    <span class="upload_item_text"><strong>${this._escape(r.datei)}</strong>${warn}</span>
                </div>
            `;
        }).join("");
    }

    _renderListe() {
        const cont = document.getElementById("bauakten-liste-container");
        const anzahl = document.getElementById("bauakten-anzahl");
        if (!cont) return;
        anzahl.textContent = this._eintraege.length === 0 ? "" : `${this._eintraege.length} Einträge`;

        // Scroll-Position merken — innerHTML-Neuaufbau (z.B. nach "Erledigt") würde
        // sonst die horizontale Scroll-Position des neuen Wrappers auf 0 zurücksetzen.
        const vorherigerWrapper = cont.querySelector(".bauakten-tabelle-wrapper");
        const scrollLeft = vorherigerWrapper ? vorherigerWrapper.scrollLeft : 0;

        if (this._eintraege.length === 0) {
            cont.innerHTML = `<div class="bauakten-leer">Noch keine Bauakten verarbeitet.</div>`;
            return;
        }

        const werteListe = this._eintraege.map(e => ({
            ...e,
            telefon: [e.festnetz, e.mobil].filter(Boolean).join(" / "),
        }));
        this._sortiereNachStadt(werteListe);

        const kopf = BAUAKTEN_FELDER.map(f => `
            <th class="${this._blockKlasse(f)}">
                <div class="th-inner">
                    <span class="th-spalte">${f.spalte}</span>
                    <span class="th-label">${f.label}</span>
                </div>
            </th>
        `).join("");

        let letzteStadt = null;
        const zeilen = werteListe.map(werte => {
            const stadt = werte.ort || "—";
            const stadtEsc = this._escape(stadt);
            let gruppenZeile = "";
            if (stadt !== letzteStadt) {
                letzteStadt = stadt;
                const gruppenZellen = BAUAKTEN_FELDER.map((f, idx) => `
                    <td class="${this._blockKlasse(f)}">
                        <div class="gruppe-zelle">
                            ${idx === 0 ? `<span class="gruppe-stadt-label">${stadtEsc}</span>` : ""}
                            <button class="gruppen-col-copy" data-key="${f.key}" data-stadt="${stadtEsc}"
                                    title="Spalte „${f.label}“ nur für ${stadtEsc} kopieren (zum Einfügen untereinander)">
                                <svg viewBox="0 0 24 24" class="icon-copy" aria-hidden="true"><use href="#icon-copy"></use></svg>
                                <svg viewBox="0 0 24 24" class="icon-check" aria-hidden="true"><use href="#icon-check"></use></svg>
                            </button>
                        </div>
                    </td>
                `).join("");
                gruppenZeile = `
                    <tr class="tabelle-gruppe" data-stadt="${stadtEsc}">
                        ${gruppenZellen}
                        <td colspan="2"></td>
                        <td>
                            <button class="gruppen-block-copy" data-stadt="${stadtEsc}"
                                    title="PLZ–Telefon-Block (P–W) nur für ${stadtEsc} kopieren — einmal in Excel oben links in Spalte P einfügen, füllt alle Zeilen dieser Stadt">
                                <svg viewBox="0 0 24 24" class="icon-copy" aria-hidden="true"><use href="#icon-copy"></use></svg>
                                <svg viewBox="0 0 24 24" class="icon-check" aria-hidden="true"><use href="#icon-check"></use></svg>
                                <span>Block</span>
                            </button>
                        </td>
                    </tr>
                `;
            }

            const zellen = BAUAKTEN_FELDER.map(f => {
                const wert = (werte[f.key] || "").toString();
                return `<td class="tabelle-zelle ${this._blockKlasse(f)} ${wert ? "" : "leer"}"
                            data-value="${this._escape(wert)}"
                            title="Klicken zum Kopieren">${wert ? this._escape(wert) : "—"}</td>`;
            }).join("");

            const zeit = (werte.created_at || "").replace("T", " ").slice(0, 16);
            const status = werte.warnung
                ? `<span class="status-icon warn" title="${this._escape(werte.warnung)}">⚠</span>`
                : `<span class="status-icon ok" title="Ohne Warnung verarbeitet">✓</span>`;
            const sp = werte.sharepoint_pfad
                ? `<span class="status-icon sp" title="${this._escape(werte.sharepoint_pfad)}">📁</span>`
                : "";

            return gruppenZeile + `
                <tr data-id="${werte.id}">
                    ${zellen}
                    <td class="tabelle-status">${status}${sp}</td>
                    <td class="tabelle-zeit" title="Eingegangen">${this._escape(zeit)}</td>
                    <td class="tabelle-aktionen">
                        <button class="zeile-copy" data-id="${werte.id}" title="PLZ–Telefon dieser Zeile kopieren (Tab-getrennt, P–W)">
                            <svg viewBox="0 0 24 24" class="icon-copy" aria-hidden="true"><use href="#icon-copy"></use></svg>
                            <svg viewBox="0 0 24 24" class="icon-check" aria-hidden="true"><use href="#icon-check"></use></svg>
                        </button>
                        <button class="zeile-erledigt" data-id="${werte.id}" title="Eintrag aus Staging entfernen">Erledigt</button>
                    </td>
                </tr>
            `;
        }).join("");

        cont.innerHTML = `
            <div class="bauakten-tabelle-wrapper">
                <table class="bauakten-tabelle">
                    <thead><tr>${kopf}<th>Status</th><th>Eingang</th><th>Aktionen</th></tr></thead>
                    <tbody>${zeilen}</tbody>
                </table>
            </div>
        `;
        this._werteCache = werteListe;
        this._attachTabellenEvents();

        const neuerWrapper = cont.querySelector(".bauakten-tabelle-wrapper");
        if (neuerWrapper) neuerWrapper.scrollLeft = scrollLeft;
    }

    _sortiereNachStadt(werteListe) {
        werteListe.sort((a, b) => {
            const ort = (a.ort || "").localeCompare(b.ort || "", "de");
            if (ort !== 0) return ort;
            const strasse = (a.strasse || "").localeCompare(b.strasse || "", "de");
            if (strasse !== 0) return strasse;
            return (parseInt(a.hnr, 10) || 0) - (parseInt(b.hnr, 10) || 0);
        });
    }

    _blockKlasse(f) {
        if (f.key === "plz")     return "block-pw block-pw-start";
        if (f.key === "telefon") return "block-pw block-pw-ende";
        if (BLOCK_PW_FELDER.some(b => b.key === f.key)) return "block-pw";
        return "";
    }

    _attachTabellenEvents() {
        this._container.querySelectorAll(".zeile-erledigt").forEach(btn => {
            btn.addEventListener("click", () => this._erledigen(parseInt(btn.dataset.id, 10)));
        });

        this._container.querySelectorAll(".tabelle-zelle").forEach(td => {
            td.addEventListener("click", () => this._copyText(td.dataset.value, td));
        });

        this._container.querySelectorAll(".zeile-copy").forEach(btn => {
            btn.addEventListener("click", e => {
                e.stopPropagation();
                const id = parseInt(btn.dataset.id, 10);
                const werte = (this._werteCache || []).find(w => w.id === id);
                if (!werte) return;
                const block = BLOCK_PW_FELDER.map(f => (werte[f.key] || "").toString()).join("\t");
                this._copyText(block, btn);
            });
        });

        // Spalten-Copy NUR für die Stadt der jeweiligen Trennzeile — Städte
        // dürfen sich nicht vermischen, weil jede Stadt ein eigenes Excel-Sheet hat.
        this._container.querySelectorAll(".gruppen-col-copy").forEach(btn => {
            btn.addEventListener("click", e => {
                e.stopPropagation();
                const key = btn.dataset.key;
                const stadt = btn.dataset.stadt;
                const werte = (this._werteCache || [])
                    .filter(w => (w.ort || "—") === stadt)
                    .map(w => (w[key] || "").toString());
                this._copyText(werte.join("\n"), btn);
            });
        });

        this._container.querySelectorAll(".gruppen-block-copy").forEach(btn => {
            btn.addEventListener("click", e => {
                e.stopPropagation();
                const stadt = btn.dataset.stadt;
                const tsv = (this._werteCache || [])
                    .filter(w => (w.ort || "—") === stadt)
                    .map(werte => BLOCK_PW_FELDER.map(f => (werte[f.key] || "").toString()).join("\t"))
                    .join("\n");
                this._copyText(tsv, btn);
            });
        });
    }

    async _copyText(value, el) {
        if (!value) return;
        try {
            await navigator.clipboard.writeText(value);
        } catch {
            // Fallback für ältere Browser / nicht-secure context
            const ta = document.createElement("textarea");
            ta.value = value;
            ta.style.position = "fixed";
            ta.style.opacity = "0";
            document.body.appendChild(ta);
            ta.select();
            try { document.execCommand("copy"); } catch {}
            document.body.removeChild(ta);
        }
        el.classList.add("kopiert");
        clearTimeout(el._kopiertTimer);
        el._kopiertTimer = setTimeout(() => el.classList.remove("kopiert"), 1200);
    }

    async _erledigen(id) {
        try {
            await fetch(`/api/bauakten/${id}`, { method: "DELETE" });
            this._load();
        } catch {}
    }

    _escape(s) {
        return String(s).replace(/[&<>"']/g, c => ({
            "&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"
        }[c]));
    }
}
