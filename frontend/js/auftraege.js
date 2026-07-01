const STATUS_MAPPING_A = {
    "offen":                      "offen",
    "Wartegrund":                 "wartegrund",
    "Tiefbau terminiert":         "in_bearbeitung",
    "TB abgeschlossen":           "in_bearbeitung",
    "TB bereits abgeschlossen":   "in_bearbeitung",
    "Installation Problem":       "in_bearbeitung",
    "Installation abgeschlossen": "abgeschlossen",
    "Auftrag abgeschlossen":      "abgeschlossen",
    "Prozess abgeschlossen":      "abgeschlossen",
    "Kein Verband":               "sonstige",
    "Storno":                     "sonstige",
};

const STATUS_LABEL = {
    offen:          "Offen",
    wartegrund:     "Wartegrund",
    in_bearbeitung: "In Bearbeitung",
    abgeschlossen:  "Abgeschlossen",
    sonstige:       "Storniert / Kein Verband",
};

const SPALTEN_DEF = [
    { key: "stadt",       label: "Stadt" },
    { key: "adresse",     label: "Adresse" },
    { key: "name",        label: "Kunde" },
    { key: "status",      label: "Status",        nosort: true },
    { key: "genehmigung", label: "Genehmigung",   nosort: true },
    { key: "tb_termin",   label: "Tiefbau" },
    { key: "inst_termin", label: "Installation" },
];

const PRO_SEITE = 30;

class AuftraegePage {
    constructor() {
        this._alle           = [];
        this._aktivStadt     = null;
        this._filter         = "alle";
        this._filterGenehm   = "alle";
        this._suche          = "";
        this._sortKey        = "adresse";
        this._sortAsc        = true;
        this._seite          = 0;
        this._gefiltert      = null;  // Cache für gefilterte+sortierte Liste
        this._detailPanel    = null;
        this._detailBackdrop = null;
        this._escHandler     = null;
        this._debounceTimer  = null;
        this._container      = document.getElementById("page-auftraege");
        this._init();
    }

    async _init() {
        this._renderSkeleton();
        try {
            const res  = await fetch("/api/auftraege");
            this._alle = await res.json();
            this._renderLayout();
            this._renderTabelle();
        } catch {
            this._container.innerHTML = `<p class="error-msg">Fehler beim Laden.</p>`;
        }
    }

    setStadt(stadt) {
        this._aktivStadt = stadt;
        this._seite = 0;
        this._gefiltert = null;
        if (this._alle.length) {
            this._updateHeader();
            this._renderTabelle();
        }
    }

    _kategorie(status) {
        return STATUS_MAPPING_A[status] || "sonstige";
    }

    _gefilterteAuftraege() {
        if (this._gefiltert) return this._gefiltert;

        let liste = this._alle;

        if (this._aktivStadt)
            liste = liste.filter(a => a.stadt === this._aktivStadt);

        if (this._filter !== "alle")
            liste = liste.filter(a => this._kategorie(a.status) === this._filter);

        if (this._filterGenehm === "ja")
            liste = liste.filter(a => a.genehmigung === true);
        else if (this._filterGenehm === "nein")
            liste = liste.filter(a => !a.genehmigung);

        if (this._suche) {
            const q = this._suche.toLowerCase();
            liste = liste.filter(a =>
                (a.adresse || "").toLowerCase().includes(q) ||
                (a.name    || "").toLowerCase().includes(q) ||
                (a.telefon || "").toLowerCase().includes(q)
            );
        }

        const key = this._sortKey;
        const asc = this._sortAsc;
        liste = liste.slice().sort((a, b) => {
            const va = (a[key] || "").toString().toLowerCase();
            const vb = (b[key] || "").toString().toLowerCase();
            return asc ? va.localeCompare(vb) : vb.localeCompare(va);
        });

        this._gefiltert = liste;
        return liste;
    }

    _invalidateCache() {
        this._gefiltert = null;
    }

    _renderSkeleton() {
        this._container.innerHTML = `
            <div class="page-layout">
                <div class="page-header"><h1>Aufträge</h1></div>
                <div class="skeleton" style="height:400px"></div>
            </div>
        `;
    }

    // Einmalig das komplette Layout inkl. Toolbar aufbauen
    _renderLayout() {
        const stadtLabel = this._aktivStadt ? ` – ${this._aktivStadt}` : "";
        this._container.innerHTML = `
            <div class="page-layout">
                <div class="page-header" id="auftraege-header">
                    <div>
                        <h1>Aufträge${stadtLabel}</h1>
                        <small id="auftraege-count"></small>
                    </div>
                </div>

                <div class="auftraege-toolbar">
                    <div class="auftraege-search-wrapper">
                        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                            <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
                        </svg>
                        <input class="auftraege-search" id="auftraege-suche"
                            placeholder="Suche nach Adresse, Kunde, Telefon…"
                            value="${this._suche}">
                    </div>
                    <div class="auftraege-filter" id="auftraege-filter">
                        ${["alle","offen","wartegrund","in_bearbeitung","abgeschlossen","sonstige"].map(f => `
                            <button class="auftraege-filter-btn ${this._filter === f ? "active" : ""}" data-f="${f}">
                                ${f === "alle" ? "Alle" : STATUS_LABEL[f]}
                            </button>
                        `).join("")}
                    </div>
                    <div class="auftraege-filter" id="auftraege-filter-genehm">
                        <button class="auftraege-filter-btn ${this._filterGenehm === "alle" ? "active" : ""}" data-g="alle">Genehmigung: Alle</button>
                        <button class="auftraege-filter-btn genehm-ja ${this._filterGenehm === "ja" ? "active" : ""}" data-g="ja">✅ Erteilt</button>
                        <button class="auftraege-filter-btn genehm-nein ${this._filterGenehm === "nein" ? "active" : ""}" data-g="nein">❌ Nicht erteilt</button>
                    </div>
                </div>

                <div class="auftraege-table-wrapper" id="auftraege-table-area"></div>
            </div>
        `;

        // Events nur einmal binden
        document.getElementById("auftraege-suche").addEventListener("input", e => {
            this._suche = e.target.value;
            this._seite = 0;
            this._invalidateCache();
            clearTimeout(this._debounceTimer);
            this._debounceTimer = setTimeout(() => this._renderTabelle(), 250);
        });

        document.getElementById("auftraege-filter").addEventListener("click", e => {
            const btn = e.target.closest(".auftraege-filter-btn");
            if (!btn) return;
            this._filter = btn.dataset.f;
            this._seite  = 0;
            this._invalidateCache();
            document.querySelectorAll("#auftraege-filter .auftraege-filter-btn").forEach(b => b.classList.toggle("active", b.dataset.f === this._filter));
            this._renderTabelle();
        });

        document.getElementById("auftraege-filter-genehm").addEventListener("click", e => {
            const btn = e.target.closest(".auftraege-filter-btn");
            if (!btn) return;
            this._filterGenehm = btn.dataset.g;
            this._seite = 0;
            this._invalidateCache();
            document.querySelectorAll("#auftraege-filter-genehm .auftraege-filter-btn").forEach(b => b.classList.toggle("active", b.dataset.g === this._filterGenehm));
            this._renderTabelle();
        });
    }

    _updateHeader() {
        const h1 = this._container.querySelector(".page-header h1");
        if (h1) h1.textContent = "Aufträge" + (this._aktivStadt ? ` – ${this._aktivStadt}` : "");
    }

    // Nur Tabelle + Pagination aktualisieren (Toolbar bleibt)
    _renderTabelle() {
        const area = document.getElementById("auftraege-table-area");
        if (!area) return;

        const gefiltert    = this._gefilterteAuftraege();
        const seitenAnzahl = Math.max(1, Math.ceil(gefiltert.length / PRO_SEITE));
        if (this._seite >= seitenAnzahl) this._seite = seitenAnzahl - 1;

        const von  = this._seite * PRO_SEITE;
        const bis  = Math.min(von + PRO_SEITE, gefiltert.length);
        const page = gefiltert.slice(von, bis);

        const countEl = document.getElementById("auftraege-count");
        if (countEl) countEl.textContent = `${gefiltert.length} von ${this._alle.length} Einträgen`;

        area.innerHTML = `
            <table class="auftraege-table">
                <thead>
                    <tr>
                        ${SPALTEN_DEF.map(s => `
                            <th data-key="${s.key}"
                                class="${!s.nosort && this._sortKey === s.key ? (this._sortAsc ? "sort-asc" : "sort-desc") : ""}">
                                ${s.label}
                                ${!s.nosort ? `<span class="sort-icon">${this._sortKey === s.key ? (this._sortAsc ? "▲" : "▼") : "⇅"}</span>` : ""}
                            </th>
                        `).join("")}
                    </tr>
                </thead>
                <tbody>
                    ${page.length === 0
                        ? `<tr><td colspan="7" class="auftraege-empty">Keine Aufträge gefunden.</td></tr>`
                        : page.map((a, i) => this._renderZeile(a, i)).join("")
                    }
                </tbody>
            </table>
            ${this._renderPagination(gefiltert.length, seitenAnzahl)}
        `;

        // Sortierung
        area.querySelectorAll(".auftraege-table th[data-key]").forEach(th => {
            th.addEventListener("click", () => {
                const key = th.dataset.key;
                if (SPALTEN_DEF.find(s => s.key === key)?.nosort) return;
                if (this._sortKey === key) this._sortAsc = !this._sortAsc;
                else { this._sortKey = key; this._sortAsc = true; }
                this._seite = 0;
                this._invalidateCache();
                this._renderTabelle();
            });
        });

        // Pagination
        area.querySelectorAll(".page-btn[data-page]").forEach(btn => {
            btn.addEventListener("click", () => {
                this._seite = parseInt(btn.dataset.page);
                this._renderTabelle();
                area.scrollIntoView({ behavior: "smooth", block: "start" });
            });
        });

        // Zeilen-Klick → Detail
        area.querySelectorAll(".auftraege-table tbody tr[data-idx]").forEach(row => {
            row.addEventListener("click", () => {
                const idx = parseInt(row.dataset.idx);
                this._showDetail(gefiltert[von + idx]);
            });
        });
    }

    _renderZeile(a, idx) {
        const kat   = this._kategorie(a.status);
        const label = STATUS_LABEL[kat] || a.status;

        const tbZelle = a.tb_termin
            ? `<div class="termin-cell">
                   <span class="t-datum">${a.tb_termin.slice(0,10).split("-").reverse().join(".")}</span>
                   ${a.tb_team ? `<span class="t-team">${a.tb_team}</span>` : ""}
               </div>`
            : `<span class="no-termin">—</span>`;

        const instZelle = a.inst_termin
            ? `<div class="termin-cell">
                   <span class="t-datum">${a.inst_termin.slice(0,10).split("-").reverse().join(".")}</span>
                   ${a.inst_team ? `<span class="t-team">${a.inst_team}</span>` : ""}
               </div>`
            : `<span class="no-termin">—</span>`;

        const tel = a.telefon
            ? `<a class="tel-link" href="tel:${a.telefon}">${a.telefon}</a>`
            : "";

        const genehm = a.genehmigung
            ? `<div class="genehm-cell ja">
                   <span>✅ Erteilt</span>
                   ${a.genehm_von ? `<span class="genehm-range">${a.genehm_von}${a.genehm_bis ? ` – ${a.genehm_bis}` : ""}</span>` : ""}
               </div>`
            : `<span class="genehm-cell nein">❌ Nein</span>`;

        return `
            <tr data-idx="${idx}" style="cursor:pointer">
                <td>
                    <span class="stadt-tag">${a.stadt}</span>
                    ${a.ansprechpartner ? `<div class="ansprechpartner">${a.ansprechpartner}</div>` : ""}
                </td>
                <td>${a.adresse}</td>
                <td>
                    <div>${a.name || "—"}</div>
                    ${tel ? `<div class="tel-row">${tel}</div>` : ""}
                </td>
                <td><span class="status-badge ${kat}">${label}</span></td>
                <td>${genehm}</td>
                <td>${tbZelle}</td>
                <td>${instZelle}</td>
            </tr>
        `;
    }

    _showDetail(a) {
        this._closeDetail();
        if (!a) return;

        const icon = (path) => `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${path}</svg>`;
        const iconPhone    = icon(`<path d="M22 16.92v3a2 2 0 01-2.18 2 19.79 19.79 0 01-8.63-3.07 19.5 19.5 0 01-6-6A19.79 19.79 0 012.12 4.18 2 2 0 014.11 2h3a2 2 0 012 1.72c.127.96.361 1.903.7 2.81a2 2 0 01-.45 2.11L8.09 9.91a16 16 0 006 6l1.27-1.27a2 2 0 012.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0122 16.92z"/>`);
        const iconLocation = icon(`<path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7z"/><circle cx="12" cy="9" r="2.5"/>`);
        const iconClose    = icon(`<line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>`);

        const kat = this._kategorie(a.status);

        const genehm = a.genehmigung
            ? `<div class="detail-row genehm-ja"><span>✅ Erteilt</span>${a.genehm_von ? `<span class="genehm-datum">${a.genehm_von}${a.genehm_bis ? ` – ${a.genehm_bis}` : ""}</span>` : ""}</div>`
            : `<div class="detail-row genehm-nein">❌ Nicht erteilt</div>`;

        const tb = a.tb_termin
            ? `<div class="detail-row"><span>${a.tb_termin.slice(0,10).split("-").reverse().join(".")}${a.tb_team ? ` · ${a.tb_team}` : ""}</span></div>`
            : `<div class="detail-row"><span>—</span></div>`;

        const inst = a.inst_termin
            ? `<div class="detail-row"><span>${a.inst_termin.slice(0,10).split("-").reverse().join(".")}${a.inst_team ? ` · ${a.inst_team}` : ""}</span></div>`
            : `<div class="detail-row"><span>—</span></div>`;

        const panel = document.createElement("div");
        panel.className = "detail-panel";
        panel.innerHTML = `
            <div class="detail-panel-header">
                <div>
                    <div class="detail-panel-title">${a.adresse}</div>
                    <span class="status-badge ${kat}" style="margin-top:6px;display:inline-flex">${STATUS_LABEL[kat] || a.status}</span>
                </div>
                <button class="detail-panel-close" id="detail-close">${iconClose}</button>
            </div>
            <div class="detail-panel-body">

                <div class="detail-section">
                    <div class="detail-section-label">Kunde</div>
                    ${a.name ? `<div class="detail-row">${iconLocation}<span>${a.name}</span></div>` : ""}
                    ${a.telefon ? `<div class="detail-row">${iconPhone}<a class="tel-link" href="tel:${a.telefon}">${a.telefon}</a></div>` : ""}
                    <div class="detail-row">${iconLocation}<span>${a.stadt}${a.ansprechpartner ? ` · ${a.ansprechpartner}` : ""}</span></div>
                </div>

                <div class="detail-section">
                    <div class="detail-section-label">Tiefbau</div>
                    ${tb}
                </div>

                <div class="detail-section">
                    <div class="detail-section-label">Installation</div>
                    ${inst}
                </div>

                <div class="detail-section">
                    <div class="detail-section-label">Stadt Genehmigung</div>
                    ${genehm}
                </div>

                ${a.wartegrund ? `
                <div class="detail-section">
                    <div class="detail-section-label">Wartegrund</div>
                    <div class="detail-kommentar" style="border-left-color:#FF9F0A">${a.wartegrund}</div>
                </div>` : ""}

                <div class="detail-section">
                    <div class="detail-section-label">Kommentar</div>
                    <div class="detail-kommentar">${a.kommentar || "—"}</div>
                </div>

                <div class="detail-section">
                    <div class="detail-section-label">Tiefbau Kommentar</div>
                    <div class="detail-kommentar tb">${a.tb_kommentar || "—"}</div>
                </div>

                <div class="detail-section">
                    <div class="detail-section-label">Installation Kommentar</div>
                    <div class="detail-kommentar inst">${a.inst_kommentar || "—"}</div>
                </div>

            </div>
        `;

        const backdrop = document.createElement("div");
        backdrop.className = "detail-backdrop";
        backdrop.addEventListener("click", () => this._closeDetail());

        document.body.appendChild(backdrop);
        document.body.appendChild(panel);

        this._detailPanel    = panel;
        this._detailBackdrop = backdrop;

        requestAnimationFrame(() => panel.classList.add("visible"));

        panel.querySelector("#detail-close").addEventListener("click", () => this._closeDetail());

        this._escHandler = (e) => { if (e.key === "Escape") this._closeDetail(); };
        document.addEventListener("keydown", this._escHandler);
    }

    _closeDetail() {
        if (this._detailPanel) {
            this._detailPanel.remove();
            this._detailBackdrop.remove();
            this._detailPanel    = null;
            this._detailBackdrop = null;
        }
        if (this._escHandler) {
            document.removeEventListener("keydown", this._escHandler);
            this._escHandler = null;
        }
    }

    _renderPagination(gesamt, seitenAnzahl) {
        if (seitenAnzahl <= 1) return "";

        const von = this._seite * PRO_SEITE + 1;
        const bis = Math.min((this._seite + 1) * PRO_SEITE, gesamt);

        const buttons = [];
        const fenster = 2;
        for (let i = 0; i < seitenAnzahl; i++) {
            if (i === 0 || i === seitenAnzahl - 1 || Math.abs(i - this._seite) <= fenster) {
                buttons.push(i);
            } else if (buttons[buttons.length - 1] !== "…") {
                buttons.push("…");
            }
        }

        return `
            <div class="auftraege-pagination">
                <span class="pagination-info">${von}–${bis} von ${gesamt} Einträgen</span>
                <div class="pagination-btns">
                    <button class="page-btn" data-page="${this._seite - 1}" ${this._seite === 0 ? "disabled" : ""}>
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="15 18 9 12 15 6"/></svg>
                    </button>
                    ${buttons.map(b => b === "…"
                        ? `<button class="page-btn" disabled>…</button>`
                        : `<button class="page-btn ${b === this._seite ? "active" : ""}" data-page="${b}">${b + 1}</button>`
                    ).join("")}
                    <button class="page-btn" data-page="${this._seite + 1}" ${this._seite >= seitenAnzahl - 1 ? "disabled" : ""}>
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="9 18 15 12 9 6"/></svg>
                    </button>
                </div>
            </div>
        `;
    }

    async reload() {
        const res  = await fetch("/api/auftraege");
        this._alle = await res.json();
        this._renderTabelle();
    }
}
