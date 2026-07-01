class ProzessPage {
    constructor() {
        this._container = document.getElementById("page-prozess");
        this._data       = null;
        this._aktivId    = null;
        this._aktivTab   = "uebersicht";
        this._load();
    }

    async _load() {
        this._container.innerHTML = `
            <div class="prozess-layout">
                <p class="prozess-loading">Lade Prozess…</p>
            </div>
        `;
        try {
            const res = await fetch("/api/prozess");
            this._data = await res.json();
            if (this._data.schritte && this._data.schritte.length > 0) {
                this._aktivId = this._data.schritte[0].id;
            }
            this._render();
        } catch (e) {
            this._container.innerHTML = `
                <div class="prozess-layout">
                    <p class="prozess-loading">Fehler beim Laden.</p>
                </div>
            `;
        }
    }

    _statusBadge(status) {
        const map = {
            ok:    { label: "läuft",        klass: "ok"    },
            pain:  { label: "Pain Point",   klass: "pain"  },
            offen: { label: "noch offen",   klass: "offen" },
            warn:  { label: "Aufmerksam",   klass: "warn"  },
        };
        const s = map[status] || map.offen;
        return `<span class="prozess-badge prozess-badge-${s.klass}">${s.label}</span>`;
    }

    _statusIcon(status) {
        if (status === "ok") {
            return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>`;
        }
        if (status === "pain") {
            return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M12 9v4"/><path d="M12 17h.01"/><path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/></svg>`;
        }
        return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"/><path d="M12 17h.01"/></svg>`;
    }

    _autoLabel(status) {
        const map = {
            aktiv:   "✅ läuft",
            geplant: "🔄 geplant",
            extern:  "🌐 extern",
            manuell: "✋ manuell",
        };
        return map[status] || status;
    }

    _avatar(name) {
        const initial = (name || "?").trim().charAt(0).toUpperCase();
        return `<span class="prozess-avatar" title="${name}">${initial}</span>`;
    }

    _kachelHtml(s) {
        const aktiv = s.id === this._aktivId ? "active" : "";
        const personenHtml = (s.personen && s.personen.length > 0)
            ? `<div class="prozess-kachel-personen">${s.personen.map(p => this._avatar(p)).join("")}</div>`
            : `<div class="prozess-kachel-personen leer">– kein Verantwortlicher –</div>`;
        return `
            <div class="prozess-kachel prozess-kachel-${s.status} ${aktiv}" data-id="${s.id}">
                <div class="prozess-kachel-nummer">${s.id}</div>
                <div class="prozess-kachel-status-icon prozess-kachel-status-icon-${s.status}">
                    ${this._statusIcon(s.status)}
                </div>
                <div class="prozess-kachel-titel">${s.titel}</div>
                <div class="prozess-kachel-kurz">${s.kurz || ""}</div>
                ${personenHtml}
            </div>
        `;
    }

    _detailHtml(s) {
        if (!s) return "";
        const personenListe = (s.personen && s.personen.length > 0)
            ? s.personen.map(p => `<span class="prozess-person-tag">${this._avatar(p)}<span>${p}</span></span>`).join("")
            : `<span class="prozess-person-leer">Niemand zugeordnet</span>`;
        const infosHtml = (s.infos_finden && s.infos_finden.length > 0)
            ? `<div class="prozess-detail-block">
                <div class="prozess-detail-block-titel">📍 Wo findet man die Infos</div>
                <ul class="prozess-detail-liste">${s.infos_finden.map(i => `<li>${i}</li>`).join("")}</ul>
               </div>`
            : "";
        const autoHtml = (s.automatisierung && s.automatisierung.length > 0)
            ? `<div class="prozess-detail-block">
                <div class="prozess-detail-block-titel">⚙️ Was ist automatisiert</div>
                <ul class="prozess-auto-liste">${s.automatisierung.map(a => `
                    <li class="prozess-auto-item">
                        <span class="prozess-auto-status prozess-auto-status-${a.status}">${this._autoLabel(a.status)}</span>
                        <span class="prozess-auto-tool">${a.tool}</span>
                        <span class="prozess-auto-text">${a.text || ""}</span>
                    </li>`).join("")}</ul>
               </div>`
            : "";
        const painsHtml = (s.pain_points && s.pain_points.length > 0)
            ? `<div class="prozess-detail-block">
                <div class="prozess-detail-block-titel">⚠️ Pain Points</div>
                <ul class="prozess-detail-liste">${s.pain_points.map(p => `<li>${p}</li>`).join("")}</ul>
               </div>`
            : "";
        const fragenHtml = (s.offene_fragen && s.offene_fragen.length > 0)
            ? `<div class="prozess-detail-block">
                <div class="prozess-detail-block-titel">❓ Offene Fragen</div>
                <ul class="prozess-detail-liste">${s.offene_fragen.map(f => `<li>${f}</li>`).join("")}</ul>
               </div>`
            : "";
        return `
            <div class="prozess-detail">
                <div class="prozess-detail-header">
                    <div class="prozess-detail-titel">
                        <span class="prozess-detail-nr">Schritt ${s.id}</span>
                        <h2>${s.titel}</h2>
                    </div>
                    ${this._statusBadge(s.status)}
                </div>
                <div class="prozess-detail-personen">
                    <div class="prozess-detail-label">Verantwortlich:</div>
                    <div class="prozess-detail-personen-liste">${personenListe}</div>
                </div>
                <div class="prozess-detail-block">
                    <div class="prozess-detail-block-titel">Was passiert hier</div>
                    <p>${s.beschreibung || "–"}</p>
                </div>
                ${infosHtml}
                ${autoHtml}
                ${painsHtml}
                ${fragenHtml}
            </div>
        `;
    }

    _painPointsHtml() {
        const mitPains = this._data.schritte.filter(s => s.pain_points && s.pain_points.length > 0);
        if (mitPains.length === 0) {
            return `<div class="prozess-leer">Keine Pain Points eingetragen.</div>`;
        }
        return mitPains.map(s => `
            <div class="prozess-listen-karte">
                <div class="prozess-listen-karte-header">
                    <span class="prozess-listen-nr">Schritt ${s.id}</span>
                    <span class="prozess-listen-titel">${s.titel}</span>
                </div>
                <ul class="prozess-detail-liste">
                    ${s.pain_points.map(p => `<li>${p}</li>`).join("")}
                </ul>
            </div>
        `).join("");
    }

    _fragenHtml() {
        const mitFragen = this._data.schritte.filter(s => s.offene_fragen && s.offene_fragen.length > 0);
        if (mitFragen.length === 0) {
            return `<div class="prozess-leer">Keine offenen Fragen.</div>`;
        }
        return mitFragen.map(s => `
            <div class="prozess-listen-karte">
                <div class="prozess-listen-karte-header">
                    <span class="prozess-listen-nr">Schritt ${s.id}</span>
                    <span class="prozess-listen-titel">${s.titel}</span>
                </div>
                <ul class="prozess-detail-liste">
                    ${s.offene_fragen.map(f => `<li>${f}</li>`).join("")}
                </ul>
            </div>
        `).join("");
    }

    _render() {
        const d = this._data;
        const aktiverSchritt = d.schritte.find(s => s.id === this._aktivId);

        // Tab-Inhalt
        let tabContent = "";
        if (this._aktivTab === "uebersicht") {
            tabContent = `
                <div class="prozess-pipeline-wrap">
                    <div class="prozess-pipeline">
                        ${d.schritte.map(s => this._kachelHtml(s)).join("")}
                    </div>
                </div>
                <div id="prozess-detail-container">
                    ${this._detailHtml(aktiverSchritt)}
                </div>
            `;
        } else if (this._aktivTab === "painpoints") {
            tabContent = `<div class="prozess-listen-container">${this._painPointsHtml()}</div>`;
        } else if (this._aktivTab === "fragen") {
            tabContent = `<div class="prozess-listen-container">${this._fragenHtml()}</div>`;
        }

        const tabBtn = (id, label) => `
            <button class="prozess-tab ${this._aktivTab === id ? "active" : ""}" data-tab="${id}">${label}</button>
        `;

        // Counters
        const painCount = d.schritte.reduce((n, s) => n + (s.pain_points?.length || 0), 0);
        const fragenCount = d.schritte.reduce((n, s) => n + (s.offene_fragen?.length || 0), 0);

        this._container.innerHTML = `
            <div class="prozess-layout">
                <div class="prozess-header">
                    <h1>${d.titel}</h1>
                    <p class="prozess-subtitle">${d.untertitel || ""}</p>
                </div>
                <div class="prozess-tabs">
                    ${tabBtn("uebersicht", "Übersicht")}
                    ${tabBtn("painpoints", `Pain Points${painCount ? " <span class='prozess-tab-zahl prozess-tab-zahl-pain'>" + painCount + "</span>" : ""}`)}
                    ${tabBtn("fragen", `Offene Fragen${fragenCount ? " <span class='prozess-tab-zahl'>" + fragenCount + "</span>" : ""}`)}
                </div>
                <div class="prozess-tab-content">
                    ${tabContent}
                </div>
            </div>
        `;

        this._attachEvents();
    }

    _attachEvents() {
        // Tab-Wechsel
        this._container.querySelectorAll(".prozess-tab").forEach(btn => {
            btn.addEventListener("click", () => {
                this._aktivTab = btn.dataset.tab;
                this._render();
            });
        });

        // Kachel-Klick
        this._container.querySelectorAll(".prozess-kachel").forEach(k => {
            k.addEventListener("click", () => {
                this._aktivId = parseInt(k.dataset.id, 10);
                // Nur Pipeline + Detail neu rendern (keine kompletten Tab-Wechsel)
                this._render();
                // Detail-Panel scrollen
                setTimeout(() => {
                    const det = document.getElementById("prozess-detail-container");
                    if (det) det.scrollIntoView({ behavior: "smooth", block: "nearest" });
                }, 50);
            });
        });
    }

    reload() {
        this._load();
    }
}
