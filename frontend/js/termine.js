const SPALTEN = [
    { id: "tb1", label: "TB 1", kuerzel: "tb", match: t => t.typ === "tb"   && t.team === "Team 1" },
    { id: "tb2", label: "TB 2", kuerzel: "tb", match: t => t.typ === "tb"   && t.team === "Team 2" },
    { id: "tb3", label: "TB 3", kuerzel: "tb", match: t => t.typ === "tb"   && t.team !== "Team 1" && t.team !== "Team 2" },
    { id: "eb1", label: "EB 1", kuerzel: "eb", match: t => t.typ === "inst" && t.team === "Team 1" },
    { id: "eb2", label: "EB 2", kuerzel: "eb", match: t => t.typ === "inst" && t.team !== "Team 1" },
];

const WOCHENTAGE_KURZ = ["So", "Mo", "Di", "Mi", "Do", "Fr", "Sa"];
const MONATE = ["Jan","Feb","Mär","Apr","Mai","Jun","Jul","Aug","Sep","Okt","Nov","Dez"];

function getMontag(datum) {
    const d = new Date(datum);
    const tag = d.getDay(); // 0=So, 1=Mo...
    const diff = tag === 0 ? -6 : 1 - tag;
    d.setDate(d.getDate() + diff);
    d.setHours(0, 0, 0, 0);
    return d;
}

function addTage(datum, n) {
    const d = new Date(datum);
    d.setDate(d.getDate() + n);
    return d;
}

function datumKey(datum) {
    const y = datum.getFullYear();
    const m = String(datum.getMonth() + 1).padStart(2, "0");
    const d = String(datum.getDate()).padStart(2, "0");
    return `${y}-${m}-${d}`;
}

function kwNummer(datum) {
    const d = new Date(Date.UTC(datum.getFullYear(), datum.getMonth(), datum.getDate()));
    d.setUTCDate(d.getUTCDate() + 4 - (d.getUTCDay() || 7));
    const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
    return Math.ceil((((d - yearStart) / 86400000) + 1) / 7);
}

function formatWhatsAppZelle(spalteLabel, kuerzel, datumStr, termine) {
    const typLabel = kuerzel === "tb" ? "⛏ Tiefbau" : "🔧 Installation";
    const lines = [`${typLabel} ${spalteLabel} – ${datumStr}`, ""];
    termine.forEach((t, i) => {
        lines.push(`🕐 ${t.zeit} Uhr`);
        lines.push(`📍 ${t.adresse}`);
        if (t.name)    lines.push(`👤 ${t.name}`);
        if (t.telefon) lines.push(`📞 ${t.telefon}`);
        lines.push(`🗺 maps.google.com/?q=${encodeURIComponent(t.adresse)}`);
        if (t.kommentar?.trim())      lines.push(`💬 ${t.kommentar.trim()}`);
        if (t.tb_kommentar?.trim())   lines.push(`⛏ ${t.tb_kommentar.trim()}`);
        if (t.inst_kommentar?.trim()) lines.push(`🔧 ${t.inst_kommentar.trim()}`);
        if (i < termine.length - 1) lines.push("");
    });
    return lines.join("\n");
}

class TerminePage {
    constructor() {
        this._data           = null;
        this._verfuegbarkeit = null;
        this._aktivStadt     = null;
        this._wochenOffset = 0; // 0 = aktuelle Woche, +n = vorwärts, -n = zurück
        this._heute        = new Date();
        this._heute.setHours(0, 0, 0, 0);
        this._container    = document.getElementById("page-termine");
        this._init();
    }

    async _init() {
        this._renderSkeleton();
        try {
            const [termineRes, verfRes] = await Promise.all([
                fetch("/api/termine"),
                fetch("/api/verfuegbarkeit"),
            ]);
            this._data          = await termineRes.json();
            this._verfuegbarkeit = await verfRes.json();
            this._render();
        } catch {
            this._container.innerHTML = `<p class="error-msg">Fehler beim Laden der Termine.</p>`;
        }
    }

    setStadt(stadt) {
        this._aktivStadt = stadt;
        if (this._data) this._render();
    }

    _wochenMontag() {
        const basis = getMontag(this._heute);
        return addTage(basis, this._wochenOffset * 7);
    }

    _wochenTage() {
        const mo = this._wochenMontag();
        return Array.from({ length: 5 }, (_, i) => addTage(mo, i)); // Mo–Fr
    }

    _tagDaten(datum) {
        const key = datumKey(datum);
        const eintrag = (this._data || []).find(t => t.datum === key);
        const termine = eintrag ? eintrag.termine : [];
        return this._aktivStadt ? termine.filter(t => t.stadt === this._aktivStadt) : termine;
    }

    _zeitSlots(datum) {
        const termine = this._tagDaten(datum);
        const zeiten = [...new Set(termine.map(t => t.zeit).filter(Boolean))];
        return zeiten.sort((a, b) => {
            const toMin = z => { const [h, m] = (z || "0").split(":").map(Number); return h * 60 + (m || 0); };
            return toMin(a) - toMin(b);
        });
    }

    _renderSkeleton() {
        this._container.innerHTML = `
            <div class="page-layout">
                <div class="page-header"><h1>Termine</h1></div>
                <div class="skeleton" style="height:300px"></div>
            </div>
        `;
    }

    _render() {
        const tage    = this._wochenTage();
        const mo      = tage[0];
        const fr      = tage[4];
        const kw      = kwNummer(mo);
        const gesamt  = tage.reduce((s, d) => s + this._tagDaten(d).length, 0);
        const stadtLabel = this._aktivStadt ? ` – ${this._aktivStadt}` : "";

        const moStr = `${mo.getDate()}. ${MONATE[mo.getMonth()]}`;
        const frStr = `${fr.getDate()}. ${MONATE[fr.getMonth()]} ${fr.getFullYear()}`;

        this._container.innerHTML = `
            <div class="page-layout">

                <div class="page-header">
                    <div>
                        <h1>Termine${stadtLabel}</h1>
                        <small>${gesamt} Termin${gesamt !== 1 ? "e" : ""} diese Woche</small>
                    </div>
                    <div class="termine-nav">
                        <button class="termine-nav-btn" id="btn-prev" ${this._wochenOffset <= -2 ? "disabled" : ""}>
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                                <polyline points="15 18 9 12 15 6"/>
                            </svg>
                        </button>
                        <div class="termine-nav-label">
                            <span class="nav-kw">KW ${kw}</span>
                            <span class="nav-range">${moStr} – ${frStr}</span>
                        </div>
                        <button class="termine-nav-btn" id="btn-next" ${this._wochenOffset >= 3 ? "disabled" : ""}>
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                                <polyline points="9 18 15 12 9 6"/>
                            </svg>
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

        document.getElementById("btn-prev").addEventListener("click", () => {
            if (this._wochenOffset > -2) { this._wochenOffset--; this._render(); }
        });
        document.getElementById("btn-next").addEventListener("click", () => {
            if (this._wochenOffset < 3) { this._wochenOffset++; this._render(); }
        });

        this._attachDetailPanel();
    }

    _teamAbwesendDieseWoche(teamName) {
        if (!this._verfuegbarkeit || !this._verfuegbarkeit.length) return false;
        const tage   = this._wochenTage();
        const wStart = datumKey(tage[0]);
        const wEnd   = datumKey(tage[4]);
        return this._verfuegbarkeit.some(e => e.team === teamName && e.von <= wEnd && e.bis >= wStart);
    }

    _teamAbwesendAmTag(teamName, datum) {
        if (!this._verfuegbarkeit || !this._verfuegbarkeit.length) return false;
        const key = datumKey(datum);
        return this._verfuegbarkeit.some(e => e.team === teamName && e.von <= key && e.bis >= key);
    }

    _spalteTeam(id) {
        return { tb1: "Tiefbau 1", tb2: "Tiefbau 2", tb3: "Tiefbau 3", eb1: "Einblassen 1", eb2: "Einblassen 2" }[id] || null;
    }

    _renderHeader() {
        const SPALTE_TEAM = {
            tb1: "Tiefbau 1", tb2: "Tiefbau 2", tb3: "Tiefbau 3",
            eb1: "Einblassen 1", eb2: "Einblassen 2",
        };
        const warnSvg = `<span class="team-warn-badge" title="Abwesenheit diese Woche">
            <svg width="8" height="8" viewBox="0 0 10 10" fill="white"><polygon points="5,1 9,9 1,9"/></svg>
        </span>`;
        return `
            <div class="tg-header-corner"></div>
            ${SPALTEN.map(s => {
                const hatAbw = this._teamAbwesendDieseWoche(SPALTE_TEAM[s.id]);
                return `<div class="tg-header ${s.kuerzel}">${s.label}${hatAbw ? warnSvg : ""}</div>`;
            }).join("")}
        `;
    }

    _renderZeile(datum) {
        const istHeute = datumKey(datum) === datumKey(this._heute);
        const rowClass = istHeute ? "tg-row-heute" : "";
        const tagName  = WOCHENTAGE_KURZ[datum.getDay()];
        const tagDatum = `${String(datum.getDate()).padStart(2,"0")}.${String(datum.getMonth()+1).padStart(2,"0")}.`;
        const heuteLabel = istHeute ? `<span class="tg-heute-badge">Heute</span>` : "";
        const slots = this._zeitSlots(datum);

        const dayCell = `
            <div class="tg-day ${rowClass}">
                <div class="tg-day-name">${tagName}</div>
                <div class="tg-day-date">${tagDatum}</div>
                ${heuteLabel}
            </div>
        `;

        const alle = this._tagDaten(datum);
        const datumAnzeige = `${String(datum.getDate()).padStart(2,"0")}.${String(datum.getMonth()+1).padStart(2,"0")}.${datum.getFullYear()}`;

        const copyIconSvg = `<svg width="13" height="13" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg"><rect x="5" y="5" width="9" height="9" rx="1.5" stroke="currentColor" stroke-width="1.5"/><path d="M11 5V3.5A1.5 1.5 0 0 0 9.5 2h-6A1.5 1.5 0 0 0 2 3.5v6A1.5 1.5 0 0 0 3.5 11H5" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/></svg>`;

        const teamCells = SPALTEN.map(spalte => {
            const teamName   = this._spalteTeam(spalte.id);
            const urlaubHeute = teamName ? this._teamAbwesendAmTag(teamName, datum) : false;
            const urlaubClass = urlaubHeute ? " tg-cell-urlaub" : "";
            if (!slots.length) {
                return `<div class="tg-cell ${rowClass}${urlaubClass}"></div>`;
            }
            const cellTermine = alle.filter(t => spalte.match(t));
            const copyData = cellTermine.length ? encodeURIComponent(JSON.stringify({
                spalteLabel: spalte.label,
                kuerzel: spalte.kuerzel,
                datumAnzeige,
                termine: cellTermine,
            })) : "";
            return `
                <div class="tg-cell tg-cell-slots ${rowClass}${urlaubClass}">
                    ${cellTermine.length ? `
                        <button class="tg-cell-copy-btn" data-cell="${copyData}" title="Alle Termine für WhatsApp kopieren">
                            ${copyIconSvg}
                        </button>
                    ` : ""}
                    ${slots.map(zeit => {
                        const treffer = cellTermine.filter(t => t.zeit === zeit);
                        return `
                            <div class="tg-slot ${treffer.length ? "belegt" : "frei"}">
                                ${treffer.length ? `<div class="tg-slot-zeit">${zeit} Uhr</div>` : ""}
                                ${treffer.map(t => `
                                    <div class="tg-termin ${spalte.kuerzel}"
                                         data-termin="${encodeURIComponent(JSON.stringify(t))}">
                                        <div class="tg-termin-adresse">${t.adresse}</div>
                                        ${t.name ? `<div class="tg-termin-name">${t.name}</div>` : ""}
                                    </div>
                                `).join("")}
                            </div>
                        `;
                    }).join("")}
                </div>
            `;
        }).join("");

        return dayCell + teamCells;
    }

    _attachDetailPanel() {
        this._container.querySelectorAll(".tg-termin").forEach(el => {
            el.addEventListener("click", e => {
                e.stopPropagation();
                const t = JSON.parse(decodeURIComponent(el.dataset.termin));
                this._showDetail(t);
            });
        });

        const checkSvg = `<svg width="13" height="13" viewBox="0 0 16 16" fill="none"><polyline points="2 8 6 12 14 4" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
        const copySvg  = `<svg width="13" height="13" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg"><rect x="5" y="5" width="9" height="9" rx="1.5" stroke="currentColor" stroke-width="1.5"/><path d="M11 5V3.5A1.5 1.5 0 0 0 9.5 2h-6A1.5 1.5 0 0 0 2 3.5v6A1.5 1.5 0 0 0 3.5 11H5" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/></svg>`;

        this._container.querySelectorAll(".tg-cell-copy-btn").forEach(btn => {
            btn.addEventListener("click", e => {
                e.stopPropagation();
                const { spalteLabel, kuerzel, datumAnzeige, termine } = JSON.parse(decodeURIComponent(btn.dataset.cell));
                const text = formatWhatsAppZelle(spalteLabel, kuerzel, datumAnzeige, termine);
                navigator.clipboard.writeText(text).then(() => {
                    btn.classList.add("copied");
                    btn.innerHTML = checkSvg;
                    setTimeout(() => {
                        btn.classList.remove("copied");
                        btn.innerHTML = copySvg;
                    }, 2000);
                });
            });
        });
    }

    _showDetail(t) {
        this._closeDetail();

        const typLabel = t.typ === "tb" ? "Tiefbau" : "Installation";
        const hatKommentar     = t.kommentar?.trim();
        const hatTbKommentar   = t.tb_kommentar?.trim();
        const hatInstKommentar = t.inst_kommentar?.trim();

        const icon = (path) => `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${path}</svg>`;
        const iconPhone    = icon(`<path d="M22 16.92v3a2 2 0 01-2.18 2 19.79 19.79 0 01-8.63-3.07 19.5 19.5 0 01-6-6A19.79 19.79 0 012.12 4.18 2 2 0 014.11 2h3a2 2 0 012 1.72c.127.96.361 1.903.7 2.81a2 2 0 01-.45 2.11L8.09 9.91a16 16 0 006 6l1.27-1.27a2 2 0 012.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0122 16.92z"/>`);
        const iconLocation = icon(`<path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7z"/><circle cx="12" cy="9" r="2.5"/>`);
        const iconClose    = icon(`<line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>`);

        const panel = document.createElement("div");
        panel.className = "detail-panel";
        panel.innerHTML = `
            <div class="detail-panel-header">
                <div>
                    <div class="detail-panel-title">${t.adresse}</div>
                    <span class="detail-typ-badge ${t.typ}" style="margin-top:6px;display:inline-flex">
                        ${typLabel} · ${t.zeit} Uhr
                    </span>
                </div>
                <button class="detail-panel-close" id="detail-close">${iconClose}</button>
            </div>
            <div class="detail-panel-body">

                <div class="detail-section">
                    <div class="detail-section-label">Kunde</div>
                    ${t.name ? `<div class="detail-row">${iconLocation}<span>${t.name}</span></div>` : ""}
                    ${t.telefon ? `<div class="detail-row">${iconPhone}<a class="tel-link" href="tel:${t.telefon}">${t.telefon}</a></div>` : ""}
                    <div class="detail-row">${iconLocation}<span>${t.stadt}</span></div>
                </div>

                ${t.team ? `
                <div class="detail-section">
                    <div class="detail-section-label">Team</div>
                    <div class="detail-row"><span>${t.team}</span></div>
                </div>` : ""}

                ${t.wartegrund ? `
                <div class="detail-section">
                    <div class="detail-section-label">Wartegrund</div>
                    <div class="detail-kommentar" style="border-left-color:#FF9F0A">${t.wartegrund}</div>
                </div>` : ""}

                <div class="detail-section">
                    <div class="detail-section-label">Kommentar</div>
                    <div class="detail-kommentar">${hatKommentar || "—"}</div>
                </div>

                <div class="detail-section">
                    <div class="detail-section-label">Tiefbau Kommentar</div>
                    <div class="detail-kommentar tb">${hatTbKommentar || "—"}</div>
                </div>

                <div class="detail-section">
                    <div class="detail-section-label">Installation Kommentar</div>
                    <div class="detail-kommentar inst">${hatInstKommentar || "—"}</div>
                </div>

                <div class="detail-section">
                    <div class="detail-section-label">Stadt Genehmigung</div>
                    ${t.genehmigung
                        ? `<div class="detail-row genehm-ja">
                               <span>✅ Erteilt</span>
                               ${t.genehm_von ? `<span class="genehm-datum">${t.genehm_von}${t.genehm_bis ? ` – ${t.genehm_bis}` : ""}</span>` : ""}
                           </div>`
                        : `<div class="detail-row genehm-nein">❌ Nicht erteilt</div>`
                    }
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

    async reload() {
        await this._init();
    }
}
