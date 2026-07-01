class KontaktePage {
    constructor() {
        this._alle   = [];
        this._suche  = "";
        this._container = document.getElementById("page-kontakte");
        this._load();
    }

    async _load() {
        this._container.innerHTML = `<div class="page-layout"><p style="color:var(--color-text-muted)">Lade Kontakte…</p></div>`;
        try {
            const res = await fetch("/api/kontakte");
            this._alle = await res.json();
            this._render();
        } catch {
            this._container.innerHTML = `<div class="page-layout"><p style="color:var(--color-text-muted)">Fehler beim Laden.</p></div>`;
        }
    }

    _render() {
        const suche = this._suche.toLowerCase();
        const gefiltert = suche
            ? this._alle.filter(k =>
                k.name.toLowerCase().includes(suche) ||
                k.funktion.toLowerCase().includes(suche) ||
                k.email.toLowerCase().includes(suche) ||
                k.gruppe.toLowerCase().includes(suche)
              )
            : this._alle;

        // Nach Gruppe gruppieren
        const gruppen = {};
        for (const k of gefiltert) {
            if (!gruppen[k.gruppe]) gruppen[k.gruppe] = [];
            gruppen[k.gruppe].push(k);
        }

        const gruppenHtml = Object.entries(gruppen).map(([titel, kontakte]) => `
            <div class="kontakte-gruppe">
                <div class="kontakte-gruppe-titel">${titel}</div>
                <div class="kontakte-grid">
                    ${kontakte.map(k => this._cardHtml(k)).join("")}
                </div>
            </div>
        `).join("");

        this._container.innerHTML = `
            <div class="page-layout">
                <div class="kontakte-header">
                    <h1>Kontakte</h1>
                    <input class="kontakte-suche" id="kontakte-suche" type="text"
                        placeholder="Name, Funktion, E-Mail …"
                        value="${this._suche}">
                </div>
                ${gruppenHtml || `<div class="kontakte-leer">Keine Einträge gefunden.</div>`}
            </div>
        `;

        const input = document.getElementById("kontakte-suche");
        if (input) {
            input.addEventListener("input", e => {
                this._suche = e.target.value;
                this._render();
                // Fokus erhalten
                const neu = document.getElementById("kontakte-suche");
                if (neu) { neu.focus(); neu.setSelectionRange(neu.value.length, neu.value.length); }
            });
        }
    }

    _cardHtml(k) {
        const initial = k.name.trim().charAt(0).toUpperCase();
        const emailLink = k.email
            ? `<div class="kontakt-email-row">
                <a class="kontakt-link" href="mailto:${k.email}">
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="4" width="20" height="16" rx="2"/><path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7"/></svg>
                    ${k.email}
                </a>
                <button class="kontakt-copy-btn" title="E-Mail kopieren" onclick="(function(btn){navigator.clipboard.writeText('${k.email}').then(()=>{btn.innerHTML='<svg width=\\'13\\'height=\\'13\\'viewBox=\\'0 0 24 24\\'fill=\\'none\\'stroke=\\'currentColor\\'stroke-width=\\'2\\'stroke-linecap=\\'round\\'stroke-linejoin=\\'round\\'><polyline points=\\'20 6 9 17 4 12\\'/></svg>';btn.classList.add(\\'copied\\');setTimeout(()=>{btn.innerHTML='<svg width=\\'13\\'height=\\'13\\'viewBox=\\'0 0 24 24\\'fill=\\'none\\'stroke=\\'currentColor\\'stroke-width=\\'2\\'stroke-linecap=\\'round\\'stroke-linejoin=\\'round\\'><rect x=\\'9\\'y=\\'9\\'width=\\'13\\'height=\\'13\\'rx=\\'2\\'ry=\\'2\\'/><path d=\\'M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1\\'/></svg>';btn.classList.remove(\\'copied\\')},2000)})})(this)">
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>
                </button>
               </div>`
            : "";
        const telLink = k.telefon
            ? `<a class="kontakt-link tel" href="tel:${k.telefon.replace(/\s/g,'')}">
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07A19.5 19.5 0 0 1 4.69 13.5 19.79 19.79 0 0 1 1.61 4.9 2 2 0 0 1 3.58 2.72h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L7.91 10.09a16 16 0 0 0 6 6l.92-.92a2 2 0 0 1 2.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0 1 21.5 17.5l.42-.58z"/></svg>
                ${k.telefon}
               </a>`
            : "";

        return `
            <div class="kontakt-card">
                <div class="kontakt-avatar">${initial}</div>
                <div class="kontakt-name">${k.name}</div>
                ${k.funktion ? `<div class="kontakt-funktion">${k.funktion}</div>` : ""}
                <div class="kontakt-links">
                    ${emailLink}
                    ${telLink}
                </div>
            </div>
        `;
    }

    reload() {
        this._load();
    }
}
