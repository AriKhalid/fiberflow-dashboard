// Gleiche Spalten wie in termine.js — TB1/2/3 nach tb_team, EB1/2 nach inst_team
const SE_SPALTEN = [
    {
        id:       "tb1",
        label:    "TB 1",
        kuerzel:  "tb",
        match:    a => !!a.tb_termin && a.tb_team === "Team 1",
        tagKey:   a => a.tb_termin   ? a.tb_termin.slice(0, 10)   : null,
        zeit:     a => a.tb_termin   ? a.tb_termin.slice(11, 16)  : null,
        schritte: ["tb_gbs", "hausstich_gbs"],
    },
    {
        id:       "tb2",
        label:    "TB 2",
        kuerzel:  "tb",
        match:    a => !!a.tb_termin && a.tb_team === "Team 2",
        tagKey:   a => a.tb_termin   ? a.tb_termin.slice(0, 10)   : null,
        zeit:     a => a.tb_termin   ? a.tb_termin.slice(11, 16)  : null,
        schritte: ["tb_gbs", "hausstich_gbs"],
    },
    {
        id:       "tb3",
        label:    "TB 3",
        kuerzel:  "tb",
        match:    a => !!a.tb_termin && a.tb_team !== "Team 1" && a.tb_team !== "Team 2",
        tagKey:   a => a.tb_termin   ? a.tb_termin.slice(0, 10)   : null,
        zeit:     a => a.tb_termin   ? a.tb_termin.slice(11, 16)  : null,
        schritte: ["tb_gbs", "hausstich_gbs"],
    },
    {
        id:       "eb1",
        label:    "EB 1",
        kuerzel:  "eb",
        match:    a => !!a.inst_termin && a.inst_team === "Team 1",
        tagKey:   a => a.inst_termin ? a.inst_termin.slice(0, 10) : null,
        zeit:     a => a.inst_termin ? a.inst_termin.slice(11, 16): null,
        schritte: ["inst_gbs"],
    },
    {
        id:       "eb2",
        label:    "EB 2",
        kuerzel:  "eb",
        match:    a => !!a.inst_termin && a.inst_team !== "Team 1",
        tagKey:   a => a.inst_termin ? a.inst_termin.slice(0, 10) : null,
        zeit:     a => a.inst_termin ? a.inst_termin.slice(11, 16): null,
        schritte: ["inst_gbs"],
    },
];

const SE_SCHRITT_DEF = {
    tb_gbs:        { label: "TB → GBS",   dot: "se-dot-blau",   applicable: a => !!a.tb_termin },
    hausstich_gbs: { label: "Hausstich",   dot: "se-dot-orange", applicable: a => a.status === "TB abgeschlossen" },
    inst_gbs:      { label: "Inst → GBS",  dot: "se-dot-gruen",  applicable: a => !!a.inst_termin },
};

const _ABGESCHLOSSEN = new Set([
    "Auftrag abgeschlossen", "Prozess abgeschlossen", "Storno", "Installation abgeschlossen",
]);

class SystemeintraegePage {
    constructor() {
        this._container    = document.getElementById("page-systemeintraege");
        this._aktivStadt   = null;
        this._auftraege    = [];
        this._status       = new Map();
        this._wochenOffset = 0;
        this._heute        = new Date();
        this._heute.setHours(0, 0, 0, 0);
        this._load();
    }

    async _load() {
        this._container.innerHTML = `<div class="page-layout"><p class="se-loading">Lade Daten…</p></div>`;
        try {
            const [auftraegeRes, statusRes] = await Promise.all([
                fetch("/api/auftraege"),
                fetch("/api/systemeintraege"),
            ]);
            this._auftraege = await auftraegeRes.json();
            const statusListe = await statusRes.json();
            this._status = new Map(statusListe.map(e => [e.kls_id, e]));
            this._render();
        } catch {
            this._container.innerHTML = `<div class="page-layout"><p class="se-loading">Fehler beim Laden.</p></div>`;
        }
    }

    setStadt(stadt) {
        this._aktivStadt = (stadt === "Alle Städte") ? null : stadt;
        if (this._auftraege.length) this._render();
    }

    reload() { this._load(); }

    _wochenTage() {
        const mo = addTage(getMontag(this._heute), this._wochenOffset * 7);
        return Array.from({ length: 5 }, (_, i) => addTage(mo, i));
    }

    _istErledigt(kls_id, typ) {
        return (this._status.get(kls_id)?.[typ] ?? 0) === 1;
    }

    async _toggle(kls_id, typ) {
        const done = this._istErledigt(kls_id, typ);
        try {
            await fetch(`/api/systemeintraege/${encodeURIComponent(kls_id)}/${typ}`, {
                method: done ? "DELETE" : "POST",
            });
            const cur = this._status.get(kls_id) || { kls_id, tb_gbs: 0, hausstich_gbs: 0, inst_gbs: 0 };
            cur[typ] = done ? 0 : 1;
            this._status.set(kls_id, cur);
            this._render();
        } catch (e) { console.error("Toggle fehlgeschlagen", e); }
    }

    _zellenAuftraege(spalte, datum) {
        const key = datumKey(datum);
        return this._auftraege.filter(a => {
            if (_ABGESCHLOSSEN.has(a.status)) return false;
            if (this._aktivStadt && a.stadt !== this._aktivStadt) return false;
            if (!a.kls_id) return false;
            return spalte.match(a) && spalte.tagKey(a) === key;
        });
    }

    _render() {
        const tage  = this._wochenTage();
        const mo    = tage[0];
        const fr    = tage[4];
        const kw    = kwNummer(mo);
        const moStr = `${mo.getDate()}. ${MONATE[mo.getMonth()]}`;
        const frStr = `${fr.getDate()}. ${MONATE[fr.getMonth()]} ${fr.getFullYear()}`;

        const alleIds = new Set();
        tage.forEach(d => SE_SPALTEN.forEach(s => this._zellenAuftraege(s, d).forEach(a => alleIds.add(a.kls_id))));
        const gesamt = alleIds.size;

        this._container.innerHTML = `
            <div class="page-layout">
                <div class="page-header">
                    <div>
                        <h1>Systemeinträge</h1>
                        <small>${gesamt} Auftrag${gesamt !== 1 ? "träge" : ""} diese Woche</small>
                    </div>
                    <div class="termine-nav">
                        <button class="termine-nav-btn" id="se-prev">
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="15 18 9 12 15 6"/></svg>
                        </button>
                        <div class="termine-nav-label">
                            <span class="nav-kw">KW ${kw}</span>
                            <span class="nav-range">${moStr} – ${frStr}</span>
                        </div>
                        <button class="termine-nav-btn" id="se-next">
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="9 18 15 12 9 6"/></svg>
                        </button>
                    </div>
                </div>

                <div class="termine-grid-wrapper">
                    <div class="termine-grid">
                        ${this._renderHeader()}
                        ${tage.map(d => this._renderZeile(d)).join("")}
                    </div>
                </div>
            </div>
        `;

        document.getElementById("se-prev").addEventListener("click", () => { this._wochenOffset--; this._render(); });
        document.getElementById("se-next").addEventListener("click", () => { this._wochenOffset++; this._render(); });

        this._container.querySelectorAll(".se-check-btn:not([disabled])").forEach(btn => {
            btn.addEventListener("click", e => {
                e.stopPropagation();
                this._toggle(btn.dataset.kls, btn.dataset.typ);
            });
        });
    }

    _renderHeader() {
        return `
            <div class="tg-header-corner"></div>
            ${SE_SPALTEN.map(s => `<div class="tg-header ${s.kuerzel}">${s.label}</div>`).join("")}
        `;
    }

    _renderZeile(datum) {
        const istHeute = datumKey(datum) === datumKey(this._heute);
        const rowClass = istHeute ? "tg-row-heute" : "";
        const tagName  = WOCHENTAGE_KURZ[datum.getDay()];
        const tagStr   = `${String(datum.getDate()).padStart(2,"0")}.${String(datum.getMonth()+1).padStart(2,"0")}.`;

        const dayCell = `
            <div class="tg-day ${rowClass}">
                <div class="tg-day-name">${tagName}</div>
                <div class="tg-day-date">${tagStr}</div>
                ${istHeute ? `<span class="tg-heute-badge">Heute</span>` : ""}
            </div>
        `;

        const iconOffen = `<svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><circle cx="12" cy="12" r="10"/></svg>`;
        const iconDone  = `<svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>`;

        const cells = SE_SPALTEN.map(spalte => {
            const liste = this._zellenAuftraege(spalte, datum);
            return `
                <div class="tg-cell tg-cell-slots ${rowClass}">
                    ${liste.map(a => {
                        const zeit = spalte.zeit(a);
                        const kreise = spalte.schritte.map(typ => {
                            const def        = SE_SCHRITT_DEF[typ];
                            const applicable = def.applicable(a);
                            const done       = applicable && this._istErledigt(a.kls_id, typ);
                            const icon       = done ? iconDone : applicable ? iconOffen : `<span class="se-strich">–</span>`;
                            return `
                                <button class="se-check-btn ${done ? "done" : ""} ${!applicable ? "se-btn-na" : ""}"
                                    data-kls="${a.kls_id}" data-typ="${typ}"
                                    ${!applicable ? "disabled" : ""}>
                                    <span class="se-dot ${def.dot}"></span>
                                    ${icon}
                                    <span>${def.label}</span>
                                </button>
                            `;
                        }).join("");

                        return `
                            <div class="se-auftrag">
                                ${zeit ? `<div class="se-auftrag-zeit">${zeit} Uhr</div>` : ""}
                                <div class="se-auftrag-adresse">${a.adresse || "–"}</div>
                                <div class="se-auftrag-kls">${a.kls_id}</div>
                                <div class="se-auftrag-kreise">${kreise}</div>
                            </div>
                        `;
                    }).join("")}
                </div>
            `;
        }).join("");

        return dayCell + cells;
    }
}
