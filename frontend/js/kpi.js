class KpiPage {
    constructor() {
        this._data       = null;
        this._aktivStadt = null;
        this._subPage    = "uebersicht";
        this._container  = document.getElementById("page-kpi");
        this._reqId      = 0;
        this._init();
    }

    async _init() {
        const myId = ++this._reqId;
        this._renderSkeleton();
        try {
            const res  = await fetch("/api/kpi");
            const data = await res.json();
            if (myId !== this._reqId) return;
            this._data = data;
            this._render();
        } catch {
            if (myId !== this._reqId) return;
            this._container.innerHTML = `<p class="error-msg">Fehler beim Laden der KPI-Daten.</p>`;
        }
    }

    setStadt(stadt) {
        this._aktivStadt = stadt;
        if (this._data) this._render();
    }

    setSubPage(id) {
        this._subPage = id;
        if (this._data) this._render();
    }

    _pct(zahl, gesamt) {
        if (!gesamt) return 0;
        return Math.round((zahl / gesamt) * 100);
    }

    _summaryDaten() {
        if (!this._data) return null;
        if (this._aktivStadt && this._data.nach_stadt[this._aktivStadt])
            return this._data.nach_stadt[this._aktivStadt];
        return this._data.gesamt;
    }

    _renderSkeleton() {
        this._container.innerHTML = `
            <div class="page-layout">
                <div class="page-header"><h1>KPI-Übersicht</h1></div>
                <div class="kpi-summary-row">
                    ${[1,2,3,4].map(() => `<div class="skeleton" style="height:110px"></div>`).join("")}
                </div>
                <div class="kpi-staedte-grid">
                    ${[1,2,3,4].map(() => `<div class="skeleton" style="height:200px"></div>`).join("")}
                </div>
            </div>
        `;
    }

    _render() {
        const d = this._summaryDaten();
        if (!d) return;

        const now        = new Date().toLocaleString("de-DE", { day:"2-digit", month:"2-digit", year:"numeric", hour:"2-digit", minute:"2-digit" });
        const stadtTitel = this._aktivStadt ? ` – ${this._aktivStadt}` : "";

        if (this._subPage === "status") {
            const myId = ++this._reqId;
            this._container.innerHTML = `<div class="page-layout"><p style="color:var(--color-text-muted)">Lade Status-Daten…</p></div>`;
            fetch("/api/kpi/status").then(r => r.json()).then(data => {
                if (myId !== this._reqId) return;
                const now2 = new Date().toLocaleString("de-DE", { day:"2-digit", month:"2-digit", year:"numeric", hour:"2-digit", minute:"2-digit" });
                this._container.innerHTML = `
                    <div class="page-layout">
                        <div class="page-header">
                            <div><h1>Status-Übersicht (aktuell)</h1><small>Stand: ${now2} Uhr</small></div>
                        </div>
                        ${this._renderStatusTabelle(data)}
                    </div>
                `;
            });
            return;
        }

        if (this._subPage === "nach-kw") {
            const myId = ++this._reqId;
            this._container.innerHTML = `<div class="page-layout"><p style="color:var(--color-text-muted)">Lade KW-Daten…</p></div>`;
            fetch("/api/kpi/nach-kw").then(r => r.json()).then(data => {
                if (myId !== this._reqId) return;
                const now2 = new Date().toLocaleString("de-DE", { day:"2-digit", month:"2-digit", year:"numeric", hour:"2-digit", minute:"2-digit" });
                this._container.innerHTML = `
                    <div class="page-layout">
                        <div class="page-header">
                            <div><h1>Abschlüsse pro Kalenderwoche</h1><small>Stand: ${now2} Uhr · nur "Prozess abgeschlossen"</small></div>
                        </div>
                        ${this._renderNachKwTabelle(data)}
                    </div>
                `;
            });
            return;
        }

        ++this._reqId;

        this._container.innerHTML = `
            <div class="page-layout">

                <div class="page-header">
                    <div>
                        <h1>KPI-Übersicht${stadtTitel}</h1>
                        <small>Stand: ${now} Uhr</small>
                    </div>
                </div>

                <div class="kpi-summary-row">
                    ${this._summaryCard("Aufträge gesamt", d.gesamt,         "Alle Städte zusammen",                                              "blue")}
                    ${this._summaryCard("Abgeschlossen",   d.abgeschlossen,  this._pct(d.abgeschlossen,  d.gesamt) + "% fertiggestellt",          "green",  "abgeschlossen")}
                    ${this._summaryCard("In Bearbeitung",  d.in_bearbeitung, this._pct(d.in_bearbeitung, d.gesamt) + "% laufend",                 "gray",   "in_bearbeitung")}
                    ${this._summaryCard("Offen",           d.offen,          this._pct(d.offen,          d.gesamt) + "% ausstehend",              "orange", "offen")}
                    ${this._summaryCard("Wartegrund",      d.wartegrund,     this._pct(d.wartegrund,     d.gesamt) + "% blockiert",               "amber",  "wartegrund")}
                </div>

                <div class="kpi-section-header">
                    <h4>Nach Stadt</h4>
                    <span class="kpi-section-sub">${Object.keys(this._data.nach_stadt).length} Städte</span>
                </div>

                <div class="kpi-staedte-grid">
                    ${Object.entries(this._data.nach_stadt).map(([stadt, sd]) => this._stadtCard(stadt, sd)).join("")}
                </div>

            </div>
        `;
    }

    _renderStatusTabelle(data) {
        const { staedte, status_reihenfolge, daten, gesamt } = data;

        const stadtFarben = ["st-col-1","st-col-2","st-col-3","st-col-4","st-col-5"];
        const zeilenFarbe = {
            "offen":                      "row-orange",
            "Wartegrund":                 "row-amber",
            "Tiefbau terminiert":         "row-blue",
            "TB abgeschlossen":           "row-blue-mid",
            "TB bereits abgeschlossen":   "row-blue-light",
            "Installation Problem":       "row-red",
            "Installation abgeschlossen": "row-green-light",
            "Auftrag abgeschlossen":      "row-green",
            "Prozess abgeschlossen":      "row-green-dark",
            "Storno":                     "row-gray",
        };

        const kopfZeile = staedte.map((s, i) =>
            `<th class="st-th ${stadtFarben[i] || ""}">${s}</th>`
        ).join("") + `<th class="st-th st-col-gesamt">Gesamt</th>`;

        const statusZeilen = status_reihenfolge.map(status => {
            const farbe = zeilenFarbe[status] || "";
            const zellen = staedte.map(s => {
                const val = daten[s][status] || 0;
                return `<td class="st-td">${val > 0 ? `<strong>${val}</strong>` : "<span class='st-null'>–</span>"}</td>`;
            }).join("");
            const g = gesamt[status] || 0;
            return `
                <tr class="st-row ${farbe}">
                    <td class="st-status">
                        <span class="st-dot ${farbe}"></span>
                        ${status}
                    </td>
                    ${zellen}
                    <td class="st-td st-gesamt-cell">${g > 0 ? `<strong>${g}</strong>` : "<span class='st-null'>–</span>"}</td>
                </tr>
            `;
        }).join("");

        const gesamtZellen = staedte.map(s => {
            const total = Object.values(daten[s]).reduce((a, b) => a + b, 0);
            return `<td class="st-td"><strong>${total}</strong></td>`;
        }).join("");
        const gesamtTotal = Object.values(gesamt).reduce((a, b) => a + b, 0);

        return `
            <div class="st-wrapper">
                <table class="st-table">
                    <thead>
                        <tr>
                            <th class="st-th-stadt">Status</th>
                            ${kopfZeile}
                        </tr>
                    </thead>
                    <tbody>
                        ${statusZeilen}
                        <tr class="st-row st-gesamt-row">
                            <td class="st-stadt bold">Gesamt</td>
                            ${gesamtZellen}
                            <td class="st-td st-gesamt-cell"><strong>${gesamtTotal}</strong></td>
                        </tr>
                    </tbody>
                </table>
            </div>
        `;
    }

    _tooltipFor(key) {
        const tips = {
            offen:          "Status: offen (ohne Wartegrund)",
            wartegrund:     "Status: offen + Wartegrund eingetragen",
            in_bearbeitung: "Tiefbau terminiert\nTB abgeschlossen\nTB bereits abgeschlossen\nInstallation Problem",
            abgeschlossen:  "Installation abgeschlossen\nAuftrag abgeschlossen\nProzess abgeschlossen",
            sonstige:       "Kein Verband\nStorno",
        };
        return tips[key] || "";
    }

    _summaryCard(label, value, sub, color, tooltipKey) {
        const tip = tooltipKey ? `data-tooltip="${this._tooltipFor(tooltipKey)}"` : "";
        const icons = {
            blue:   `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="3" width="20" height="14" rx="2"/><line x1="8" y1="21" x2="16" y2="21"/><line x1="12" y1="17" x2="12" y2="21"/></svg>`,
            green:  `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>`,
            orange: `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>`,
            amber:  `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>`,
            gray:   `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>`,
        };
        return `
            <div class="kpi-summary-card ${color}" ${tip}>
                <div class="kpi-card-top">
                    <div class="kpi-card-icon ${color}">${icons[color] || ""}</div>
                    <div class="cap-label">${label}</div>
                </div>
                <div class="card-value">${value}</div>
                ${sub ? `<div class="card-sub">${sub}</div>` : ""}
            </div>
        `;
    }

    _stadtCard(stadt, sd) {
        const pctAbgeschlossen = this._pct(sd.abgeschlossen,  sd.gesamt);
        const pctOffen         = this._pct(sd.offen,          sd.gesamt);
        const pctInArbeit      = this._pct(sd.in_bearbeitung, sd.gesamt);
        const highlighted      = this._aktivStadt === stadt ? "highlighted" : "";

        return `
            <div class="kpi-stadt-card ${highlighted}">
                <div class="stadt-card-header">
                    <h3>${stadt}</h3>
                    <small class="stadt-card-total">${sd.gesamt} Aufträge</small>
                </div>

                <div class="progress-bar-wrapper">
                    <div class="progress-bar-label">
                        <span>Fortschritt</span>
                        <span>${pctAbgeschlossen}% abgeschlossen</span>
                    </div>
                    <div class="progress-bar-track">
                        <div class="progress-bar-fill green"  style="width:${pctAbgeschlossen}%"></div>
                        <div class="progress-bar-fill orange" style="width:${pctOffen}%"></div>
                        <div class="progress-bar-fill blue"   style="width:${pctInArbeit}%"></div>
                    </div>
                </div>

                <div class="stadt-mini-stats">
                    <div class="mini-stat green"  data-tooltip="${this._tooltipFor("abgeschlossen")}">
                        <div class="cap-label">Abgeschl.</div>
                        <div class="ms-value">${sd.abgeschlossen}</div>
                    </div>
                    <div class="mini-stat orange" data-tooltip="${this._tooltipFor("offen")}">
                        <div class="cap-label">Offen</div>
                        <div class="ms-value">${sd.offen}</div>
                    </div>
                    <div class="mini-stat amber"  data-tooltip="${this._tooltipFor("wartegrund")}">
                        <div class="cap-label">Wartegrund</div>
                        <div class="ms-value">${sd.wartegrund || 0}</div>
                    </div>
                    <div class="mini-stat blue"   data-tooltip="${this._tooltipFor("in_bearbeitung")}">
                        <div class="cap-label">In Arbeit</div>
                        <div class="ms-value">${sd.in_bearbeitung}</div>
                    </div>
                    <div class="mini-stat gray"   data-tooltip="${this._tooltipFor("sonstige")}">
                        <div class="cap-label">Sonstige</div>
                        <div class="ms-value">${sd.sonstige}</div>
                    </div>
                </div>
            </div>
        `;
    }

    _aktuelleKW() {
        const d = new Date();
        const utc = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
        utc.setUTCDate(utc.getUTCDate() + 4 - (utc.getUTCDay() || 7));
        const yearStart = new Date(Date.UTC(utc.getUTCFullYear(), 0, 1));
        return Math.ceil((((utc - yearStart) / 86400000) + 1) / 7);
    }

    _renderNachKwTabelle(data) {
        const { labels, daten } = data;
        const aktKW = this._aktuelleKW();

        if (!daten || Object.keys(daten).length === 0) {
            return `<div class="kpi-leer">Noch keine abgeschlossenen Aufträge mit KW-Eintrag vorhanden.</div>`;
        }

        const kopfZeile = labels.map(l =>
            `<th class="st-th">${l}</th>`
        ).join("") + `<th class="st-th st-col-gesamt">Gesamt</th>`;

        // Gesamt-Summen über alle KW
        const summeSpalten = {};
        labels.forEach(l => summeSpalten[l] = 0);
        let summeGesamt = 0;

        const kwZeilen = Object.entries(daten)
            .sort(([a], [b]) => Number(a) - Number(b))
            .map(([kw, zeile]) => {
                const istAktKW = Number(kw) === aktKW;
                const zellen = labels.map(l => {
                    const val = zeile[l] || 0;
                    summeSpalten[l] += val;
                    return `<td class="st-td">${val > 0 ? `<strong>${val}</strong>` : "<span class='st-null'>–</span>"}</td>`;
                }).join("");
                summeGesamt += zeile.gesamt || 0;
                return `
                    <tr class="st-row${istAktKW ? " kw-aktuell" : ""}">
                        <td class="st-status">
                            KW ${kw}
                            ${istAktKW ? `<span class="kw-badge">Aktuell</span>` : ""}
                        </td>
                        ${zellen}
                        <td class="st-td st-gesamt-cell"><strong>${zeile.gesamt || 0}</strong></td>
                    </tr>
                `;
            }).join("");

        const summeZellen = labels.map(l =>
            `<td class="st-td"><strong>${summeSpalten[l] || 0}</strong></td>`
        ).join("");

        return `
            <div class="st-wrapper">
                <table class="st-table">
                    <thead>
                        <tr>
                            <th class="st-th-stadt">KW</th>
                            ${kopfZeile}
                        </tr>
                    </thead>
                    <tbody>
                        ${kwZeilen}
                        <tr class="st-row st-gesamt-row">
                            <td class="st-stadt bold">Gesamt</td>
                            ${summeZellen}
                            <td class="st-td st-gesamt-cell"><strong>${summeGesamt}</strong></td>
                        </tr>
                    </tbody>
                </table>
            </div>
        `;
    }

    async reload() {
        await this._init();
    }
}
