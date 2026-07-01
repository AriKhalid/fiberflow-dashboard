const TEAM_LISTE = ["Tiefbau 1", "Tiefbau 2", "Tiefbau 3", "Einblassen 1", "Einblassen 2"];
const MONATE_LANG_TEAM = ["Januar","Februar","März","April","Mai","Juni","Juli","August","September","Oktober","November","Dezember"];
const WD_KURZ_TEAM = ["So","Mo","Di","Mi","Do","Fr","Sa"];

function _teamDatumKey(d) {
    return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`;
}

class TeamPage {
    constructor() {
        this._data = null;
        this._heute = new Date();
        this._heute.setHours(0, 0, 0, 0);
        this._monat = new Date(this._heute.getFullYear(), this._heute.getMonth(), 1);
        this._container = document.getElementById("page-team");
        this._init();
    }

    async _init() {
        this._renderSkeleton();
        try {
            const res = await fetch("/api/verfuegbarkeit");
            this._data = await res.json();
            this._render();
        } catch {
            this._container.innerHTML = `<p class="error-msg">Fehler beim Laden der Verfügbarkeit.</p>`;
        }
    }

    reload() { this._init(); }

    _render() {
        const jahr        = this._monat.getFullYear();
        const monat       = this._monat.getMonth();
        const tage        = new Date(jahr, monat + 1, 0).getDate();
        const heuteStr    = _teamDatumKey(this._heute);
        const monatStart  = `${jahr}-${String(monat+1).padStart(2,"0")}-01`;
        const monatEnd    = `${jahr}-${String(monat+1).padStart(2,"0")}-${String(tage).padStart(2,"0")}`;
        const data        = this._data || [];

        const heuteAbwesend = data.filter(e => e.von <= heuteStr && e.bis >= heuteStr);
        const gesamtImMonat = data.filter(e => e.von <= monatEnd && e.bis >= monatStart).length;

        const dayNums = Array.from({ length: tage }, (_, i) => i + 1);

        const heuteBox = heuteAbwesend.length > 0 ? `
            <div class="team-heute-box">
                <div class="team-heute-title">Heute abwesend (${heuteAbwesend.length})</div>
                <div class="team-heute-list">
                    ${heuteAbwesend.map(e => `
                        <div class="team-heute-card ${e.name ? "" : "ganzes-team"}">
                            <div class="team-heute-name">${e.name || "Ganzes Team"}</div>
                            <div class="team-heute-team">${e.team}</div>
                            <div class="team-heute-grund">${e.grund || "—"}</div>
                        </div>
                    `).join("")}
                </div>
            </div>
        ` : "";

        const ganttRows = TEAM_LISTE.map(team => {
            const teamAbw = data.filter(e => e.team === team && e.von <= monatEnd && e.bis >= monatStart);
            const cells = dayNums.map(d => {
                const dayStr = `${jahr}-${String(monat+1).padStart(2,"0")}-${String(d).padStart(2,"0")}`;
                const dt     = new Date(jahr, monat, d);
                const isWE   = dt.getDay() === 0 || dt.getDay() === 6;
                const isH    = dayStr === heuteStr;
                const treffer = teamAbw.filter(e => e.von <= dayStr && e.bis >= dayStr);
                const ganzes  = treffer.some(e => !e.name);
                const einzel  = treffer.some(e => e.name);
                const title   = treffer.map(e => `${e.name || "Ganzes Team"}: ${e.grund}`).join(" | ");
                let cls = "team-gantt-cell";
                if (isWE) cls += " wochenende";
                if (isH)  cls += " heute";
                if (ganzes)      cls += " absent-ganz";
                else if (einzel) cls += " absent-einzel";
                return `<div class="${cls}"${title ? ` title="${title}"` : ""}></div>`;
            }).join("");

            return `<div class="team-gantt-label">${team}</div>${cells}`;
        }).join("");

        const headerCells = dayNums.map(d => {
            const dt   = new Date(jahr, monat, d);
            const isWE = dt.getDay() === 0 || dt.getDay() === 6;
            const isH  = d === this._heute.getDate() && monat === this._heute.getMonth() && jahr === this._heute.getFullYear();
            return `<div class="team-day-header${isWE ? " wochenende" : ""}${isH ? " heute" : ""}">
                <div class="team-day-num">${d}</div>
                <div class="team-day-wd">${WD_KURZ_TEAM[dt.getDay()]}</div>
            </div>`;
        }).join("");

        this._container.innerHTML = `
            <div class="page-layout">
                <div class="page-header">
                    <div>
                        <h1>Team Verfügbarkeit</h1>
                        <small>${gesamtImMonat} Einträge im ${MONATE_LANG_TEAM[monat]}</small>
                    </div>
                    <div class="termine-nav">
                        <button class="termine-nav-btn" id="team-prev">
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="15 18 9 12 15 6"/></svg>
                        </button>
                        <div class="termine-nav-label">
                            <span class="nav-kw">${MONATE_LANG_TEAM[monat]} ${jahr}</span>
                        </div>
                        <button class="termine-nav-btn" id="team-next">
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="9 18 15 12 9 6"/></svg>
                        </button>
                    </div>
                </div>

                ${heuteBox}

                ${data.length === 0 ? `<div class="team-leer">Keine Einträge im Sheet "Verfügbarkeit" gefunden.</div>` : `
                <div class="team-gantt-wrapper">
                    <div class="team-gantt" style="grid-template-columns: 140px repeat(${tage}, minmax(28px, 1fr))">
                        <div class="team-gantt-label team-gantt-header-label">Team</div>
                        ${headerCells}
                        ${ganttRows}
                    </div>
                </div>
                <div class="team-legende">
                    <div class="team-legende-item"><span class="legende-box ganzes"></span> Ganzes Team abwesend</div>
                    <div class="team-legende-item"><span class="legende-box einzel"></span> Einzelperson abwesend</div>
                </div>
                `}
            </div>
        `;

        document.getElementById("team-prev").addEventListener("click", () => {
            this._monat = new Date(this._monat.getFullYear(), this._monat.getMonth() - 1, 1);
            this._render();
        });
        document.getElementById("team-next").addEventListener("click", () => {
            this._monat = new Date(this._monat.getFullYear(), this._monat.getMonth() + 1, 1);
            this._render();
        });
    }

    _renderSkeleton() {
        this._container.innerHTML = `
            <div class="page-layout">
                <div class="page-header"><h1>Team Verfügbarkeit</h1></div>
                <div class="skeleton" style="height:300px"></div>
            </div>
        `;
    }
}
