class VaoPage {
    constructor() {
        this._container  = document.getElementById("page-vao");
        this._aktivStadt = null;
        this._data       = null;
        this._filter     = { fehlend: "", ablaufend: "", ablaufend_status: "alle" };
        this._load();
    }

    async _load() {
        this._container.innerHTML = `<div class="vao-page-wrap"><p class="vao-loading">Lade VAO-Daten…</p></div>`;
        try {
            const res  = await fetch("/api/erinnerungen");
            const json = await res.json();
            this._data = json.vao;
            this._render();
        } catch {
            this._container.innerHTML = `<div class="vao-page-wrap"><p class="vao-loading">Fehler beim Laden.</p></div>`;
        }
    }

    setStadt(stadt) {
        this._aktivStadt = (stadt === "Alle Städte") ? null : stadt;
        if (this._data) this._render();
    }

    reload() { this._load(); }

    _fehlend() {
        let liste = this._data.fehlend || [];
        if (this._aktivStadt) liste = liste.filter(a => a.stadt === this._aktivStadt);
        const q = this._filter.fehlend.trim().toLowerCase();
        if (q) liste = liste.filter(a =>
            (a.kls_id  || "").toLowerCase().includes(q) ||
            (a.adresse || "").toLowerCase().includes(q) ||
            (a.name    || "").toLowerCase().includes(q)
        );
        return liste.slice().sort((a, b) => (b.eingangsdatum || "").localeCompare(a.eingangsdatum || ""));
    }

    _fehlendTotal() {
        let liste = this._data.fehlend || [];
        if (this._aktivStadt) liste = liste.filter(a => a.stadt === this._aktivStadt);
        return liste.length;
    }

    _ablaufend() {
        let liste = this._data.ablaufend || [];
        if (this._aktivStadt) liste = liste.filter(a => a.stadt === this._aktivStadt);
        const status = this._filter.ablaufend_status;
        if (status === "abgelaufen") liste = liste.filter(a => a.tage_bis_ablauf < 0);
        else if (status === "kritisch") liste = liste.filter(a => a.tage_bis_ablauf >= 0 && a.tage_bis_ablauf <= 7);
        const q = this._filter.ablaufend.trim().toLowerCase();
        if (q) liste = liste.filter(a =>
            (a.kls_id  || "").toLowerCase().includes(q) ||
            (a.adresse || "").toLowerCase().includes(q) ||
            (a.name    || "").toLowerCase().includes(q)
        );
        return liste.slice().sort((a, b) => a.tage_bis_ablauf - b.tage_bis_ablauf);
    }

    _ablaufendTotal() {
        let liste = this._data.ablaufend || [];
        if (this._aktivStadt) liste = liste.filter(a => a.stadt === this._aktivStadt);
        return liste.length;
    }

    _tageBadge(tage) {
        if (tage < 0)  return `<span class="vao-badge vao-badge-rot">abgelaufen (${Math.abs(tage)}d)</span>`;
        if (tage <= 7) return `<span class="vao-badge vao-badge-orange">${tage}d</span>`;
        return `<span class="vao-badge vao-badge-gelb">${tage}d</span>`;
    }

    _formatDatum(s) {
        if (!s) return "–";
        const d = new Date(s);
        if (isNaN(d)) return s;
        return d.toLocaleDateString("de-DE", { day: "2-digit", month: "2-digit", year: "numeric" });
    }

    _countBadge(gefiltert, gesamt) {
        return gefiltert !== gesamt
            ? `<span class="vao-section-count">${gefiltert} / ${gesamt}</span>`
            : `<span class="vao-section-count">${gefiltert}</span>`;
    }

    _fehlendTabelle(liste) {
        if (!liste.length) return `<p class="vao-leer">Keine Einträge. ✓</p>`;
        const rows = liste.map(a => `
            <tr>
                <td class="vao-td-kls">${a.kls_id || "–"}</td>
                <td class="vao-td-datum">${this._formatDatum(a.eingangsdatum)}</td>
                <td class="vao-td-adresse">${a.adresse || "–"}</td>
                <td>${a.name || "–"}</td>
                <td class="vao-td-stadt">${a.stadt || "–"}</td>
                <td class="vao-td-tel">${a.telefon || "–"}</td>
            </tr>
        `).join("");
        return `
            <div class="vao-table-wrap">
                <table class="vao-table">
                    <thead><tr>
                        <th>KLS-ID</th><th>Eingang</th><th>Adresse</th>
                        <th>Kunde</th><th>Stadt</th><th>Telefon</th>
                    </tr></thead>
                    <tbody>${rows}</tbody>
                </table>
            </div>
        `;
    }

    _ablaufendTabelle(liste) {
        if (!liste.length) return `<p class="vao-leer">Keine Einträge. ✓</p>`;
        const rows = liste.map(a => `
            <tr>
                <td class="vao-td-kls">${a.kls_id || "–"}</td>
                <td>${this._tageBadge(a.tage_bis_ablauf)}</td>
                <td class="vao-td-datum">${a.genehm_bis || "–"}</td>
                <td class="vao-td-adresse">${a.adresse || "–"}</td>
                <td>${a.name || "–"}</td>
                <td class="vao-td-stadt">${a.stadt || "–"}</td>
                <td class="vao-td-tel">${a.telefon || "–"}</td>
            </tr>
        `).join("");
        return `
            <div class="vao-table-wrap">
                <table class="vao-table">
                    <thead><tr>
                        <th>KLS-ID</th><th>Frist</th><th>Gültig bis</th>
                        <th>Adresse</th><th>Kunde</th><th>Stadt</th><th>Telefon</th>
                    </tr></thead>
                    <tbody>${rows}</tbody>
                </table>
            </div>
        `;
    }

    _render() {
        const activeId = document.activeElement?.id;

        const fehlend        = this._fehlend();
        const fehlendTotal   = this._fehlendTotal();
        const ablaufend      = this._ablaufend();
        const ablaufendTotal = this._ablaufendTotal();

        const statusChips = ["alle", "abgelaufen", "kritisch"].map(s => {
            const aktiv = this._filter.ablaufend_status === s;
            const label = s === "alle" ? "Alle" : s === "abgelaufen" ? "Abgelaufen" : "≤ 7 Tage";
            return `<button class="vao-chip${aktiv ? " vao-chip-aktiv" : ""}" data-status="${s}">${label}</button>`;
        }).join("");

        this._container.innerHTML = `
            <div class="vao-page-wrap">
                <div class="vao-page-header">
                    <h1 class="vao-page-titel">VAO — Stadtgenehmigungen</h1>
                    <p class="vao-page-sub">Verkehrsrechtliche Anordnungen: fehlende und ablaufende Genehmigungen auf einen Blick.</p>
                </div>
                <div class="vao-spalten">

                    <div class="vao-section">
                        <div class="vao-section-header">
                            <span class="vao-section-dot vao-dot-rot"></span>
                            <h2 class="vao-section-titel">Fehlende Genehmigung</h2>
                            ${this._countBadge(fehlend.length, fehlendTotal)}
                        </div>
                        <div class="vao-filter-row">
                            <input class="vao-search" id="vao-search-fehlend" type="text"
                                placeholder="KLS-ID, Adresse, Name…" value="${this._filter.fehlend}">
                        </div>
                        ${this._fehlendTabelle(fehlend)}
                    </div>

                    <div class="vao-section">
                        <div class="vao-section-header">
                            <span class="vao-section-dot vao-dot-orange"></span>
                            <h2 class="vao-section-titel">Ablaufende Genehmigung</h2>
                            ${this._countBadge(ablaufend.length, ablaufendTotal)}
                        </div>
                        <div class="vao-filter-row">
                            <input class="vao-search" id="vao-search-ablaufend" type="text"
                                placeholder="KLS-ID, Adresse, Name…" value="${this._filter.ablaufend}">
                            <div class="vao-chips">${statusChips}</div>
                        </div>
                        ${this._ablaufendTabelle(ablaufend)}
                    </div>

                </div>
            </div>
        `;

        if (activeId) {
            const el = document.getElementById(activeId);
            if (el) { el.focus(); el.setSelectionRange?.(el.value.length, el.value.length); }
        }

        document.getElementById("vao-search-fehlend").addEventListener("input", e => {
            this._filter.fehlend = e.target.value;
            this._render();
        });
        document.getElementById("vao-search-ablaufend").addEventListener("input", e => {
            this._filter.ablaufend = e.target.value;
            this._render();
        });
        this._container.querySelectorAll(".vao-chip[data-status]").forEach(btn => {
            btn.addEventListener("click", () => {
                this._filter.ablaufend_status = btn.dataset.status;
                this._render();
            });
        });
    }
}
