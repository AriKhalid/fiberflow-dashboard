const STATUS_FARBEN = {
    "offen":                      { color: "#FF9500", bg: "#FFF3E0" },
    "wartegrund":                 { color: "#FF6B00", bg: "#FFF0E0" },
    "tiefbau terminiert":         { color: "#0071E3", bg: "#E3F0FF" },
    "tb abgeschlossen":           { color: "#5AC8FA", bg: "#E3F6FF" },
    "tb bereits abgeschlossen":   { color: "#93C5FD", bg: "#EFF6FF" },
    "installation problem":       { color: "#FF3B30", bg: "#FFE5E5" },
    "installation abgeschlossen": { color: "#34C759", bg: "#E6F9ED" },
    "kein verband":               { color: "#AF52DE", bg: "#F3E6FF" },
    "auftrag abgeschlossen":      { color: "#30D158", bg: "#E6F9ED" },
    "prozess abgeschlossen":      { color: "#30D158", bg: "#E6F9ED" },
    "default":                    { color: "#AEAEB2", bg: "#F0F0F2" },
};

const VERSTECKT_STANDARD = ["auftrag abgeschlossen", "prozess abgeschlossen", "storno"];

const STATUS_BADGES = [
    { label: "Alle",                       value: "alle",                     gruppe: null },
    { label: "Offen",                      value: "offen",                    farbe: STATUS_FARBEN["offen"] },
    { label: "Wartegrund",                 value: "wartegrund",               farbe: STATUS_FARBEN["wartegrund"] },
    { label: "Tiefbau terminiert",         value: "tiefbau terminiert",       farbe: STATUS_FARBEN["tiefbau terminiert"] },
    { label: "TB abgeschlossen",           value: "tb abgeschlossen",         farbe: STATUS_FARBEN["tb abgeschlossen"] },
    { label: "TB bereits abgeschl.",       value: "tb bereits abgeschlossen", farbe: STATUS_FARBEN["tb bereits abgeschlossen"] },
    { label: "Inst. Problem",              value: "installation problem",     farbe: STATUS_FARBEN["installation problem"] },
    { label: "Inst. abgeschlossen",        value: "installation abgeschlossen", farbe: STATUS_FARBEN["installation abgeschlossen"] },
    { label: "Kein Verband",               value: "kein verband",             farbe: STATUS_FARBEN["kein verband"] },
    { label: "Abgeschlossen",              value: "abgeschlossen",            farbe: { color: "#30D158", bg: "#E6F9ED" }, versteckt: true },
];

function statusFarbe(status) {
    return STATUS_FARBEN[(status || "").toLowerCase()] || STATUS_FARBEN.default;
}

function makeIcon(status) {
    const { color } = statusFarbe(status);
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="28" height="36" viewBox="0 0 28 36">
        <path d="M14 1C7.4 1 2 6.4 2 13c0 8.5 12 22 12 22S26 21.5 26 13C26 6.4 20.6 1 14 1z"
              fill="${color}" stroke="white" stroke-width="2"/>
        <circle cx="14" cy="13" r="5" fill="white"/>
    </svg>`;
    return L.divIcon({ html: svg, iconSize: [28, 36], iconAnchor: [14, 36], popupAnchor: [0, -36], className: "" });
}

function makeRouteIcon(typ) {
    const color = typ === "start" ? "#34C759" : "#FF3B30";
    const label = typ === "start" ? "A" : "B";
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="34" height="44" viewBox="0 0 34 44">
        <path d="M17 1C9.3 1 3 7.3 3 15c0 10 14 28 14 28S31 25 31 15C31 7.3 24.7 1 17 1z"
              fill="${color}" stroke="white" stroke-width="2.5"/>
        <text x="17" y="19" text-anchor="middle" dominant-baseline="middle"
              fill="white" font-size="14" font-weight="700" font-family="-apple-system,sans-serif">${label}</text>
    </svg>`;
    return L.divIcon({ html: svg, iconSize: [34, 44], iconAnchor: [17, 44], popupAnchor: [0, -44], className: "" });
}

class MapsPage {
    constructor() {
        this.map          = null;
        this.alle         = [];
        this.alleGesamt   = [];
        this.stadtFilter  = null;
        this.statusFilter = "alle";
        this.markers      = [];
        this._badgesListenerBound  = false;
        this._searchIndex          = [];
        this._autocompleteTimerA   = null;
        this._autocompleteTimerB   = null;
        // Route
        this.routeStart       = null;
        this.routeZiel        = null;
        this.routeLayer       = null;
        this.routeMarkerStart = null;
        this.routeMarkerZiel  = null;
        this._init();
    }

    async _init() {
        this._renderSkeleton();
        await this._loadDaten();
        this._initMap();
        this._initRoutePanel();
        this._renderBadges();
        this._renderMarkers();
    }

    _renderSkeleton() {
        document.getElementById("page-maps").innerHTML = `
            <div class="maps-page">
                <div class="maps-header">
                    <h1>Karte</h1>
                    <button class="route-toggle-btn" id="route-toggle-btn">
                        <svg width="15" height="15" viewBox="0 0 16 16" fill="none">
                            <circle cx="3" cy="13" r="2" stroke="currentColor" stroke-width="1.5"/>
                            <circle cx="13" cy="3" r="2" stroke="currentColor" stroke-width="1.5"/>
                            <path d="M3 11V7a4 4 0 0 1 4-4h2" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
                            <path d="M13 5v4a4 4 0 0 1-4 4H7" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
                        </svg>
                        Route berechnen
                    </button>
                </div>

                <div class="route-panel" id="route-panel">
                    <div class="route-inputs">
                        <div class="route-input-row">
                            <span class="route-badge start">A</span>
                            <div class="route-autocomplete-wrap" id="wrap-start">
                                <input class="route-input" id="route-input-start" type="text"
                                    placeholder="Team 1 — Adresse oder Name eingeben…" autocomplete="off"/>
                                <div class="route-dropdown" id="route-dropdown-start"></div>
                            </div>
                            <button class="route-clear-field" id="clear-start" title="Zurücksetzen">✕</button>
                        </div>
                        <div class="route-input-row">
                            <span class="route-badge ziel">B</span>
                            <div class="route-autocomplete-wrap" id="wrap-ziel">
                                <input class="route-input" id="route-input-ziel" type="text"
                                    placeholder="Team 2 — Adresse oder Name eingeben…" autocomplete="off"/>
                                <div class="route-dropdown" id="route-dropdown-ziel"></div>
                            </div>
                            <button class="route-clear-field" id="clear-ziel" title="Zurücksetzen">✕</button>
                        </div>
                    </div>
                    <div class="route-result" id="route-result">
                        <div class="route-result-item">
                            <svg width="14" height="14" viewBox="0 0 16 16" fill="none"><path d="M2 8h12M10 4l4 4-4 4" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>
                            <span id="route-distanz"></span>
                        </div>
                        <div class="route-result-item">
                            <svg width="14" height="14" viewBox="0 0 16 16" fill="none"><circle cx="8" cy="8" r="6" stroke="currentColor" stroke-width="1.5"/><path d="M8 5v3l2 2" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/></svg>
                            <span id="route-dauer"></span>
                        </div>
                        <button class="route-gmaps-btn" id="route-gmaps-btn">
                            <svg width="12" height="12" viewBox="0 0 16 16" fill="none"><path d="M14 1L1 6l5 3 3 5 5-13z" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round"/></svg>
                            In Google Maps
                        </button>
                    </div>
                </div>

                <div class="maps-badges" id="maps-badges"></div>
                <div class="map-wrapper">
                    <div id="map"><div class="map-loading">Karte wird geladen…</div></div>
                </div>
            </div>
        `;
    }

    async _loadDaten() {
        try {
            const [resGeo, resAlle] = await Promise.all([
                fetch("/api/auftraege/geo"),
                fetch("/api/auftraege"),
            ]);
            this.alle       = await resGeo.json();
            this.alleGesamt = await resAlle.json();
            this._buildSearchIndex();
        } catch {
            this.alle = [];
            this.alleGesamt = [];
            this._searchIndex = [];
        }
    }

    _buildSearchIndex() {
        this._searchIndex = this.alle
            .filter(a => a.lat && a.lng)
            .map(a => ({
                ref:     a,
                adresse: (a.adresse   || "").toLowerCase(),
                name:    (a.name      || "").toLowerCase(),
                team_tb: (a.tb_team   || "").toLowerCase(),
                team_in: (a.inst_team || "").toLowerCase(),
            }));
    }

    _initMap() {
        this.map = L.map("map").setView([52.27, 10.52], 10);
        L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
            attribution: '© <a href="https://openstreetmap.org">OpenStreetMap</a>',
            maxZoom: 19,
        }).addTo(this.map);
    }

    _initRoutePanel() {
        const btn = document.getElementById("route-toggle-btn");
        btn.addEventListener("click", () => {
            const panel = document.getElementById("route-panel");
            const aktiv = panel.classList.toggle("active");
            btn.classList.toggle("active", aktiv);
            if (!aktiv) this._clearRoute();
        });

        this._initAutocomplete("start");
        this._initAutocomplete("ziel");

        document.getElementById("clear-start").addEventListener("click", () => this._clearSeite("start"));
        document.getElementById("clear-ziel").addEventListener("click",  () => this._clearSeite("ziel"));
        document.getElementById("route-gmaps-btn").addEventListener("click", () => this._openGoogleMaps());
    }

    _initAutocomplete(seite) {
        const input    = document.getElementById(`route-input-${seite}`);
        const dropdown = document.getElementById(`route-dropdown-${seite}`);
        const timerKey = seite === "start" ? "_autocompleteTimerA" : "_autocompleteTimerB";

        input.addEventListener("input", () => {
            clearTimeout(this[timerKey]);
            const q = input.value.trim().toLowerCase();
            if (q.length < 2) { dropdown.innerHTML = ""; dropdown.classList.remove("open"); return; }

            this[timerKey] = setTimeout(() => {
                const treffer = this._searchIndex
                    .filter(s => s.adresse.includes(q) || s.name.includes(q) || s.team_tb.includes(q) || s.team_in.includes(q))
                    .slice(0, 8)
                    .map(s => s.ref);

                if (!treffer.length) {
                    dropdown.innerHTML = `<div class="route-dropdown-empty">Keine Ergebnisse</div>`;
                    dropdown.classList.add("open");
                    return;
                }

                dropdown.innerHTML = treffer.map((a, i) => {
                    const { color, bg } = statusFarbe(a.status);
                    const teams = [a.tb_team, a.inst_team].filter(Boolean).join(" / ");
                    return `
                        <div class="route-dropdown-item" data-idx="${i}">
                            <div class="rdi-adresse">${this._highlight(a.adresse, q)}</div>
                            <div class="rdi-meta">
                                ${a.name ? `<span>${this._highlight(a.name, q)}</span>` : ""}
                                ${teams ? `<span class="rdi-team">${teams}</span>` : ""}
                                <span class="rdi-status" style="background:${bg};color:${color}">${a.status || "—"}</span>
                            </div>
                        </div>`;
                }).join("");

                dropdown.classList.add("open");

                dropdown.querySelectorAll(".route-dropdown-item").forEach((el, i) => {
                    el.addEventListener("mousedown", e => {
                        e.preventDefault();
                        this._waehleAdresse(seite, treffer[i]);
                    });
                });
            }, 200);
        });

        input.addEventListener("blur", () => {
            setTimeout(() => { dropdown.classList.remove("open"); }, 150);
        });

        input.addEventListener("focus", () => {
            if (dropdown.innerHTML && dropdown.childElementCount) dropdown.classList.add("open");
        });
    }

    _highlight(text, query) {
        if (!text) return "";
        const escaped = query.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
        return text.replace(new RegExp(`(${escaped})`, "gi"), "<mark>$1</mark>");
    }

    _waehleAdresse(seite, a) {
        const input    = document.getElementById(`route-input-${seite}`);
        const dropdown = document.getElementById(`route-dropdown-${seite}`);
        input.value = a.adresse;
        dropdown.classList.remove("open");

        if (seite === "start") {
            this.routeStart = a;
            if (this.routeMarkerStart) this.routeMarkerStart.remove();
            this.routeMarkerStart = L.marker([a.lat, a.lng], { icon: makeRouteIcon("start"), zIndexOffset: 1000 }).addTo(this.map);
            this.map.setView([a.lat, a.lng], 14);
        } else {
            this.routeZiel = a;
            if (this.routeMarkerZiel) this.routeMarkerZiel.remove();
            this.routeMarkerZiel = L.marker([a.lat, a.lng], { icon: makeRouteIcon("ziel"), zIndexOffset: 1000 }).addTo(this.map);
        }

        if (this.routeStart && this.routeZiel) {
            this._berechneRoute();
        }
    }

    async _berechneRoute() {
        const { lat: lat1, lng: lng1 } = this.routeStart;
        const { lat: lat2, lng: lng2 } = this.routeZiel;
        const result = document.getElementById("route-result");
        document.getElementById("route-distanz").textContent = "Wird berechnet…";
        document.getElementById("route-dauer").textContent   = "";
        document.getElementById("route-gmaps-btn").style.display = "none";
        result.classList.add("visible");

        try {
            const url  = `https://router.project-osrm.org/route/v1/driving/${lng1},${lat1};${lng2},${lat2}?overview=full&geometries=geojson`;
            const res  = await fetch(url);
            const data = await res.json();

            if (data.routes && data.routes[0]) {
                const route     = data.routes[0];
                const distKm    = (route.distance / 1000).toFixed(1);
                const minuten   = Math.round(route.duration / 60);
                const stunden   = Math.floor(minuten / 60);
                const min       = minuten % 60;
                const dauerText = stunden > 0 ? `${stunden} Std. ${min} Min.` : `${minuten} Min.`;

                if (this.routeLayer) this.routeLayer.remove();
                this.routeLayer = L.geoJSON(route.geometry, {
                    style: { color: "#0071E3", weight: 5, opacity: 0.85, lineCap: "round", lineJoin: "round" }
                }).addTo(this.map);
                this.map.fitBounds(this.routeLayer.getBounds(), { padding: [60, 60] });

                document.getElementById("route-distanz").textContent = `${distKm} km`;
                document.getElementById("route-dauer").textContent   = `ca. ${dauerText}`;
                document.getElementById("route-gmaps-btn").style.display = "";
            } else {
                this._fallbackLinie(lat1, lng1, lat2, lng2);
            }
        } catch {
            this._fallbackLinie(lat1, lng1, lat2, lng2);
        }
    }

    _fallbackLinie(lat1, lng1, lat2, lng2) {
        const dist = this._luftlinie(lat1, lng1, lat2, lng2);
        if (this.routeLayer) this.routeLayer.remove();
        this.routeLayer = L.polyline([[lat1, lng1], [lat2, lng2]], {
            color: "#0071E3", weight: 3, dashArray: "8 6", opacity: 0.75
        }).addTo(this.map);
        this.map.fitBounds([[lat1, lng1], [lat2, lng2]], { padding: [60, 60] });
        document.getElementById("route-distanz").textContent = `~${dist.toFixed(1)} km Luftlinie`;
        document.getElementById("route-dauer").textContent   = "(keine Straßenroute)";
        document.getElementById("route-gmaps-btn").style.display = "";
    }

    _luftlinie(lat1, lng1, lat2, lng2) {
        const R    = 6371;
        const dLat = (lat2 - lat1) * Math.PI / 180;
        const dLng = (lng2 - lng1) * Math.PI / 180;
        const a    = Math.sin(dLat / 2) ** 2 + Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLng / 2) ** 2;
        return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    }

    _openGoogleMaps() {
        if (!this.routeStart || !this.routeZiel) return;
        const url = `https://www.google.com/maps/dir/${this.routeStart.lat},${this.routeStart.lng}/${this.routeZiel.lat},${this.routeZiel.lng}`;
        window.open(url, "_blank");
    }

    _clearSeite(seite) {
        document.getElementById(`route-input-${seite}`).value = "";
        document.getElementById(`route-dropdown-${seite}`).classList.remove("open");
        if (seite === "start") {
            this.routeStart = null;
            if (this.routeMarkerStart) { this.routeMarkerStart.remove(); this.routeMarkerStart = null; }
        } else {
            this.routeZiel = null;
            if (this.routeMarkerZiel) { this.routeMarkerZiel.remove(); this.routeMarkerZiel = null; }
        }
        if (this.routeLayer) { this.routeLayer.remove(); this.routeLayer = null; }
        document.getElementById("route-result").classList.remove("visible");
    }

    _clearRoute() {
        this._clearSeite("start");
        this._clearSeite("ziel");
    }

    _zaehle(value) {
        const quelle = this.stadtFilter
            ? this.alle.filter(a => a.stadt === this.stadtFilter)
            : this.alle;

        if (value === "alle") return quelle.filter(a => !VERSTECKT_STANDARD.includes((a.status || "").toLowerCase())).length;
        if (value === "abgeschlossen") return quelle.filter(a => ["auftrag abgeschlossen", "prozess abgeschlossen"].includes((a.status || "").toLowerCase())).length;
        return quelle.filter(a => (a.status || "").toLowerCase() === value).length;
    }

    _renderBadges() {
        const container = document.getElementById("maps-badges");
        if (!container) return;

        container.innerHTML = STATUS_BADGES.map(b => {
            const count  = this._zaehle(b.value);
            const active = this.statusFilter === b.value;
            const farbe  = b.farbe;

            if (b.value === "alle") {
                return `
                    <button class="map-badge ${active ? "active" : ""}" data-status="alle"
                        style="${active ? "border-color:#1D1D1F;background:#1D1D1F;color:#fff;" : ""}">
                        <span class="badge-label">Alle aktiven</span>
                        <span class="badge-count">${count}</span>
                    </button>`;
            }

            const borderColor = active ? farbe.color : "transparent";
            const bgColor     = active ? farbe.color : farbe.bg;
            const textColor   = active ? "#fff" : farbe.color;

            return `
                <button class="map-badge ${active ? "active" : ""} ${b.versteckt ? "badge-versteckt" : ""}"
                    data-status="${b.value}"
                    style="background:${bgColor};border-color:${borderColor};color:${textColor};">
                    <span class="badge-dot" style="background:${farbe.color};"></span>
                    <span class="badge-label">${b.label}</span>
                    <span class="badge-count" style="background:${active ? "rgba(255,255,255,0.25)" : farbe.color};color:#fff;">${count}</span>
                </button>`;
        }).join("");

        if (!this._badgesListenerBound) {
            this._badgesListenerBound = true;
            container.addEventListener("click", e => {
                const btn = e.target.closest(".map-badge");
                if (!btn) return;
                this.statusFilter = btn.dataset.status;
                this._renderBadges();
                this._renderMarkers();
            });
        }
    }

    _renderMarkers() {
        this.markers.forEach(m => m.remove());
        this.markers = [];

        let daten = this.stadtFilter
            ? this.alle.filter(a => a.stadt === this.stadtFilter)
            : this.alle;

        if (this.statusFilter === "abgeschlossen") {
            daten = daten.filter(a => ["auftrag abgeschlossen", "prozess abgeschlossen"].includes((a.status || "").toLowerCase()));
        } else if (this.statusFilter === "alle") {
            daten = daten.filter(a => !VERSTECKT_STANDARD.includes((a.status || "").toLowerCase()));
        } else {
            daten = daten.filter(a => (a.status || "").toLowerCase() === this.statusFilter);
        }

        daten.forEach(a => {
            if (!a.lat || !a.lng) return;
            const { color, bg } = statusFarbe(a.status);
            const marker = L.marker([a.lat, a.lng], { icon: makeIcon(a.status) });
            const genehm = a.genehmigung
                ? `✅ Ja${a.genehm_von ? ` · ${a.genehm_von}` : ""}${a.genehm_bis ? ` – ${a.genehm_bis}` : ""}`
                : `❌ Nein`;
            marker.bindPopup(`
                <div class="popup-title">📍 ${a.adresse}</div>
                <div class="popup-row">👤 ${a.name || "—"}</div>
                ${a.telefon ? `<div class="popup-row">📞 ${a.telefon}</div>` : ""}
                ${a.tb_termin ? `<div class="popup-row">⛏ TB: ${a.tb_termin} · ${a.tb_team || "—"}</div>` : ""}
                ${a.inst_termin ? `<div class="popup-row">🔧 Inst: ${a.inst_termin} · ${a.inst_team || "—"}</div>` : ""}
                <div class="popup-row">🏛 Genehmigung: ${genehm}</div>
                ${a.wartegrund ? `<div class="popup-row" style="color:#B35900;font-weight:600">⏳ Wartegrund: ${a.wartegrund}</div>` : ""}
                <div class="popup-row">💬 Kommentar: ${a.kommentar || "—"}</div>
                <div class="popup-row">⛏ TB-Kommentar: ${a.tb_kommentar || "—"}</div>
                <div class="popup-row">🔧 Inst-Kommentar: ${a.inst_kommentar || "—"}</div>
                <span class="popup-status" style="background:${bg};color:${color}">${a.status || "—"}</span>
            `);
            marker.addTo(this.map);
            this.markers.push(marker);
        });
    }

    async reload() {
        await this._loadDaten();
        this._renderBadges();
        this._renderMarkers();
    }

    setStadt(stadt) {
        this.stadtFilter = stadt;
        this._renderBadges();
        this._renderMarkers();
    }
}
