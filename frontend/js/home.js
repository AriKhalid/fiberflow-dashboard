const VAO_KARTEN_ICONS = {
    neu_gestern: `<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <path d="M12 9v4"/><path d="M12 17h.01"/>
        <path d="M10.29 3.86l-8.18 14.18A1 1 0 0 0 3 19.5h18a1 1 0 0 0 .87-1.46L13.71 3.86a1 1 0 0 0-1.72 0z"/>
    </svg>`,
    neu_diese_woche: `<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <rect x="3" y="4" width="18" height="18" rx="2"/>
        <line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/>
        <line x1="3" y1="10" x2="21" y2="10"/>
    </svg>`,
    gesamt_offen: `<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
        <polyline points="14 2 14 8 20 8"/>
        <line x1="9" y1="13" x2="15" y2="13"/><line x1="9" y1="17" x2="13" y2="17"/>
    </svg>`,
    ablaufend: `<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <circle cx="12" cy="12" r="9"/>
        <polyline points="12 7 12 12 15.5 14"/>
    </svg>`,
};

const VAO_KARTEN_DEF = [
    { key: "neu_gestern",     label: "Neu seit gestern",   desc: "Eingegangen, noch keine VAO gestellt", farbe: "#FF9500" },
    { key: "neu_diese_woche", label: "Neu diese Woche",    desc: "Eingegangen, noch keine VAO gestellt", farbe: "#0071E3" },
    { key: "gesamt_offen",    label: "Gesamt offene VAO",  desc: "Stadt-Genehmigung insgesamt noch nicht erteilt", farbe: "#FF3B30" },
    { key: "ablaufend",       label: "VAO läuft ab",       desc: "Genehmigung läuft in 14 Tagen ab oder ist abgelaufen", farbe: "#AF52DE" },
];

const WETTER_ICONS = {
    sonne:  `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="4.5"/><path d="M12 2.5v3M12 18.5v3M3.5 12h3M17.5 12h3M5.6 5.6l2.1 2.1M16.3 16.3l2.1 2.1M5.6 18.4l2.1-2.1M16.3 7.7l2.1-2.1"/></svg>`,
    wolke:  `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M6.5 19a4.5 4.5 0 0 1-.5-8.97A6 6 0 0 1 17.6 8.5 4.5 4.5 0 0 1 17 19H6.5z"/></svg>`,
    regen:  `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M6.5 15a4.5 4.5 0 0 1-.5-8.97A6 6 0 0 1 17.6 4.5 4.5 4.5 0 0 1 17 15H6.5z"/><path d="M8 19l-1 2M12 19l-1 2M16 19l-1 2"/></svg>`,
    schnee: `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M6.5 14a4.5 4.5 0 0 1-.5-8.97A6 6 0 0 1 17.6 3.5 4.5 4.5 0 0 1 17 14H6.5z"/><path d="M9 18v3M12 18v3M15 18v3"/></svg>`,
    gewitter: `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M6.5 14a4.5 4.5 0 0 1-.5-8.97A6 6 0 0 1 17.6 3.5 4.5 4.5 0 0 1 17 14H6.5z"/><path d="M12 14l-2 4h3l-2 4"/></svg>`,
    nebel:  `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="4" y1="9" x2="20" y2="9"/><line x1="4" y1="13" x2="20" y2="13"/><line x1="4" y1="17" x2="20" y2="17"/></svg>`,
};

function _wetterTyp(code) {
    if (code === 0 || code === 1) return "sonne";
    if (code === 2 || code === 3) return "wolke";
    if ([45, 48].includes(code)) return "nebel";
    if ([51, 53, 55, 56, 57, 61, 63, 65, 66, 67, 80, 81, 82].includes(code)) return "regen";
    if ([71, 73, 75, 77, 85, 86].includes(code)) return "schnee";
    if ([95, 96, 99].includes(code)) return "gewitter";
    return "wolke";
}

const WETTER_ORTE = [
    { name: "Siegen (HQ)", lat: 50.8748, lon: 8.0243 },
    { name: "Stadt A", lat: 52.2689, lon: 10.5268 },
    { name: "Stadt B", lat: 52.1623, lon: 10.5367 },
    { name: "Stadt D",       lat: 51.9847, lon: 9.8263 },
    { name: "Stadt C",     lat: 52.2389, lon: 9.8434 },
    { name: "Stadt E",      lat: 52.4794, lon: 10.5511 },
    { name: "Stadt F", lat: 51.8838, lon: 10.5689 },
];

const QUICKLINK_FARBEN = {
    maps: "#0071E3", kpi: "#34C759", termine: "#FF9500", auftraege: "#AF52DE",
    team: "#5AC8FA", todos: "#FF3B30", kontakte: "#5AC8FA", prozess: "#5856D6", bauakten: "#FF9500",
};

class HomePage {
    constructor(onNavigate) {
        this._container = document.getElementById("page-home");
        this._onNavigate = onNavigate || (() => {});
        this._vao = null;
        this._render();
        this._ladeVaoKarten();
        this._ladeWetter();
    }

    _render() {
        const now = new Date();
        const tag = now.toLocaleDateString("de-DE", { weekday: "long", day: "2-digit", month: "long", year: "numeric" });
        const stunde = now.getHours();
        const gruss = stunde < 11 ? "Guten Morgen" : stunde < 18 ? "Guten Tag" : "Guten Abend";

        this._container.innerHTML = `
            <div class="page-layout">
                <div class="home-hero-row">
                    <div class="home-card home-card-greeting">
                        <div class="home-hero-top">
                            <h1>${gruss}</h1>
                            <div class="home-hero-datum">
                                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
                                ${tag}
                            </div>
                        </div>
                        <div class="home-wetter-row" id="home-wetter-row">
                            ${WETTER_ORTE.map(o => `
                                <div class="home-wetter-chip" data-ort="${o.name}">
                                    <span class="home-wetter-chip-icon">${WETTER_ICONS.wolke}</span>
                                    <span class="home-wetter-chip-text">…</span>
                                </div>
                            `).join("")}
                        </div>
                    </div>
                    <div class="home-card home-card-kalender">
                        ${this._renderKalender(now)}
                    </div>
                </div>
                <div class="vao-card">
                    <div class="vao-card-top">
                        <div class="vao-stadt-dropdown" id="vao-stadt-dropdown">
                            <button type="button" class="vao-stadt-trigger" id="vao-stadt-trigger">
                                <svg class="vao-pin-icon" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
                                    <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7z"/>
                                    <circle cx="12" cy="9" r="2.5"/>
                                </svg>
                                <span class="vao-stadt-trigger-text">${STAEDTE[0]}</span>
                                <svg class="vao-stadt-chevron" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="6 9 12 15 18 9"/></svg>
                            </button>
                            <div class="vao-stadt-menu" id="vao-stadt-menu">
                                ${STAEDTE.map(s => `<div class="vao-stadt-option${s === STAEDTE[0] ? " aktiv" : ""}" data-value="${s}">${s}</div>`).join("")}
                            </div>
                        </div>
                    </div>
                    <p class="vao-card-text">Offene Stadt-Genehmigungen (VAO) auf einen Blick.</p>
                    <div class="vao-karten-row">
                        ${VAO_KARTEN_DEF.map(k => `
                            <div class="vao-karte" style="--accent:${k.farbe}">
                                <div class="vao-karte-icon">${VAO_KARTEN_ICONS[k.key]}</div>
                                <div class="vao-karte-body">
                                    <div class="vao-karte-label">${k.label}</div>
                                    <div class="vao-karte-zahl" data-key="${k.key}">…</div>
                                    <div class="vao-karte-desc">${k.desc}</div>
                                </div>
                            </div>
                        `).join("")}
                    </div>
                </div>
                <div class="home-quicklinks">
                    ${PAGES.filter(p => p.id !== "home").map(p => `
                        <div class="home-quicklink" data-nav="${p.id}">
                            <span class="home-quicklink-icon" style="background:${QUICKLINK_FARBEN[p.id] || "#8E8E93"}">${p.icon}</span>
                            <span class="home-quicklink-label">${p.label}</span>
                        </div>
                    `).join("")}
                </div>
            </div>
        `;

        this._container.querySelectorAll(".home-quicklink").forEach(el => {
            el.addEventListener("click", () => this._onNavigate(el.dataset.nav));
        });

        this._attachDropdownEvents();
    }

    _renderKalender(heute) {
        const jahr = heute.getFullYear();
        const monat = heute.getMonth();
        const monatsName = heute.toLocaleDateString("de-DE", { month: "long", year: "numeric" });

        const ersterTag = new Date(jahr, monat, 1);
        const anzahlTage = new Date(jahr, monat + 1, 0).getDate();
        // Wochentag des 1. (0=So..6=Sa) auf Montag-Start umrechnen (0=Mo..6=So)
        const startOffset = (ersterTag.getDay() + 6) % 7;

        const zellen = [];
        for (let i = 0; i < startOffset; i++) zellen.push(`<span class="kalender-tag leer"></span>`);
        for (let tag = 1; tag <= anzahlTage; tag++) {
            const istHeute = tag === heute.getDate();
            zellen.push(`<span class="kalender-tag${istHeute ? " heute" : ""}">${tag}</span>`);
        }

        return `
            <div class="kalender-header">${monatsName}</div>
            <div class="kalender-wochentage">
                ${["Mo","Di","Mi","Do","Fr","Sa","So"].map(t => `<span>${t}</span>`).join("")}
            </div>
            <div class="kalender-grid">${zellen.join("")}</div>
        `;
    }

    _attachDropdownEvents() {
        const dropdown = this._container.querySelector("#vao-stadt-dropdown");
        const trigger  = this._container.querySelector("#vao-stadt-trigger");
        const menu     = this._container.querySelector("#vao-stadt-menu");
        const triggerText = this._container.querySelector(".vao-stadt-trigger-text");

        trigger.addEventListener("click", e => {
            e.stopPropagation();
            dropdown.classList.toggle("offen");
        });

        menu.querySelectorAll(".vao-stadt-option").forEach(opt => {
            opt.addEventListener("click", () => {
                menu.querySelectorAll(".vao-stadt-option").forEach(o => o.classList.remove("aktiv"));
                opt.classList.add("aktiv");
                triggerText.textContent = opt.dataset.value;
                dropdown.classList.remove("offen");
                this._zeigeWerte(opt.dataset.value);
            });
        });

        document.addEventListener("click", e => {
            if (!dropdown.contains(e.target)) dropdown.classList.remove("offen");
        });
    }

    async _ladeWetter() {
        const row = this._container.querySelector("#home-wetter-row");
        if (!row) return;

        const lats = WETTER_ORTE.map(o => o.lat).join(",");
        const lons = WETTER_ORTE.map(o => o.lon).join(",");

        try {
            const res = await fetch(
                `https://api.open-meteo.com/v1/forecast?latitude=${lats}&longitude=${lons}&current_weather=true`
            );
            const data = await res.json();
            const liste = Array.isArray(data) ? data : [data];

            WETTER_ORTE.forEach((ort, i) => {
                const chip = row.querySelector(`.home-wetter-chip[data-ort="${ort.name}"]`);
                if (!chip) return;
                const w = liste[i] && liste[i].current_weather;
                if (!w) {
                    chip.querySelector(".home-wetter-chip-text").textContent = `${ort.name}: —`;
                    return;
                }
                const typ = _wetterTyp(w.weathercode);
                chip.querySelector(".home-wetter-chip-icon").innerHTML = WETTER_ICONS[typ];
                chip.querySelector(".home-wetter-chip-text").textContent = `${ort.name}: ${Math.round(w.temperature)}°C`;
            });
        } catch {
            row.querySelectorAll(".home-wetter-chip-text").forEach(t => t.textContent = "Wetter nicht verfügbar");
        }
    }

    async _ladeVaoKarten() {
        try {
            const res = await fetch("/api/erinnerungen");
            const data = res.ok ? await res.json() : null;
            this._vao = data ? data.vao : null;
        } catch {
            this._vao = null;
        }
        const aktiv = this._container.querySelector(".vao-stadt-option.aktiv");
        this._zeigeWerte(aktiv ? aktiv.dataset.value : STAEDTE[0]);
    }

    _zeigeWerte(stadt) {
        if (!this._vao) return;

        const werte = stadt === "Alle Städte"
            ? {
                neu_gestern:     this._vao.neu_gestern,
                neu_diese_woche: this._vao.neu_diese_woche,
                gesamt_offen:    this._vao.fehlend ? this._vao.fehlend.length : 0,
                ablaufend:       this._vao.ablaufend ? this._vao.ablaufend.length : 0,
            }
            : (this._vao.pro_stadt && this._vao.pro_stadt[stadt]) || { neu_gestern: 0, neu_diese_woche: 0, gesamt_offen: 0, ablaufend: 0 };

        for (const [key, wert] of Object.entries(werte)) {
            const el = this._container.querySelector(`.vao-karte-zahl[data-key="${key}"]`);
            if (el) el.textContent = wert;
        }
    }
}
