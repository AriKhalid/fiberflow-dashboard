// Globaler Fetch-Interceptor: Bei Session-Ablauf (Redirect → Login) automatisch weiterleiten
(function() {
    const _origFetch = window.fetch;
    window.fetch = async function(...args) {
        const res = await _origFetch(...args);
        if (res.redirected && new URL(res.url).pathname === "/login") {
            window.location.href = "/login";
        }
        return res;
    };
})();

const ICONS = {
    home: `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <path d="M3 9.5L12 3l9 6.5V20a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V9.5z"/>
        <path d="M9 21V12h6v9"/>
    </svg>`,
    maps: `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7z"/>
        <circle cx="12" cy="9" r="2.5"/>
    </svg>`,
    kpi: `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <rect x="3" y="3" width="18" height="18" rx="2"/>
        <path d="M7 16l3-4 3 3 3-5"/>
    </svg>`,
    auftraege: `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <path d="M9 5H7a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2h-2"/>
        <rect x="9" y="3" width="6" height="4" rx="1"/>
        <line x1="9" y1="12" x2="15" y2="12"/>
        <line x1="9" y1="16" x2="13" y2="16"/>
    </svg>`,
    termine: `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <rect x="3" y="4" width="18" height="18" rx="2"/>
        <line x1="16" y1="2" x2="16" y2="6"/>
        <line x1="8" y1="2" x2="8" y2="6"/>
        <line x1="3" y1="10" x2="21" y2="10"/>
        <line x1="8" y1="14" x2="8" y2="14" stroke-width="3" stroke-linecap="round"/>
        <line x1="12" y1="14" x2="12" y2="14" stroke-width="3" stroke-linecap="round"/>
        <line x1="16" y1="14" x2="16" y2="14" stroke-width="3" stroke-linecap="round"/>
    </svg>`,
    todos: `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <rect x="3" y="3" width="5" height="18" rx="1"/>
        <rect x="10" y="3" width="5" height="12" rx="1"/>
        <rect x="17" y="3" width="5" height="15" rx="1"/>
    </svg>`,
    kontakte: `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/>
        <circle cx="9" cy="7" r="4"/>
        <path d="M23 21v-2a4 4 0 0 0-3-3.87"/>
        <path d="M16 3.13a4 4 0 0 1 0 7.75"/>
    </svg>`,
    team: `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <rect x="3" y="4" width="18" height="18" rx="2"/>
        <line x1="16" y1="2" x2="16" y2="6"/>
        <line x1="8" y1="2" x2="8" y2="6"/>
        <line x1="3" y1="10" x2="21" y2="10"/>
        <circle cx="8" cy="16" r="2"/>
        <circle cx="16" cy="16" r="2"/>
        <path d="M6 21v-1a2 2 0 0 1 4 0v1"/>
        <path d="M14 21v-1a2 2 0 0 1 4 0v1"/>
    </svg>`,
    prozess: `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <rect x="2" y="3" width="6" height="5" rx="1"/>
        <rect x="16" y="3" width="6" height="5" rx="1"/>
        <rect x="9" y="16" width="6" height="5" rx="1"/>
        <path d="M5 8v2a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8"/>
        <path d="M12 12v4"/>
    </svg>`,
    bauakten: `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
        <polyline points="14 2 14 8 20 8"/>
        <line x1="12" y1="18" x2="12" y2="12"/>
        <polyline points="9 15 12 12 15 15"/>
    </svg>`,
    vao: `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <path d="M9 11l3 3L22 4"/>
        <path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/>
    </svg>`,
    systemeintraege: `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <line x1="10" y1="6" x2="21" y2="6"/>
        <line x1="10" y1="12" x2="21" y2="12"/>
        <line x1="10" y1="18" x2="21" y2="18"/>
        <polyline points="3 6 4 7 6 5"/>
        <polyline points="3 12 4 13 6 11"/>
        <polyline points="3 18 4 19 6 17"/>
    </svg>`,
    chevron_left: `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
        <polyline points="15 18 9 12 15 6"/>
    </svg>`,
    chevron_right: `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
        <polyline points="9 18 15 12 9 6"/>
    </svg>`,
    refresh: `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
        <polyline points="23 4 23 10 17 10"/>
        <path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"/>
    </svg>`,
};

const PAGES = [
    { divider: "Übersicht" },
    { id: "home",      icon: ICONS.home,      label: "Start" },
    { id: "auftraege", icon: ICONS.auftraege,  label: "Aufträge" },
    { id: "termine",   icon: ICONS.termine,    label: "Termine" },
    { id: "maps",      icon: ICONS.maps,       label: "Karte" },
    { id: "kpi",       icon: ICONS.kpi,        label: "KPI", sub: [
        { id: "uebersicht", label: "Übersicht" },
        { id: "status",     label: "Status" },
        { id: "nach-kw",    label: "Nach KW" },
    ]},
    { id: "team",      icon: ICONS.team,       label: "Team" },
    { id: "kontakte",  icon: ICONS.kontakte,   label: "Kontakte" },
    { id: "todos",     icon: ICONS.todos,      label: "Aufgaben" },
    { id: "prozess", icon: ICONS.prozess, label: "Prozess", group: true, pages: [
        { label: "Dokumentation",  page: "prozess"          },
        { label: "Bauakten",       page: "bauakten"         },
        { label: "VAO",            page: "vao"              },
        { label: "Systemeinträge", page: "systemeintraege"  },
    ]},
];

const PROZESS_PAGES = new Set(["prozess", "bauakten", "vao", "systemeintraege"]);

const STAEDTE = ["Alle Städte", "Stadt A", "Stadt D", "Stadt C", "Stadt B", "Stadt E", "Stadt F"];

class Sidebar {
    constructor({ onPageChange, onStadtChange, onRefresh, onSubPageChange }) {
        this.onPageChange    = onPageChange;
        this.onStadtChange   = onStadtChange;
        this.onRefresh       = onRefresh || (() => {});
        this.onSubPageChange = onSubPageChange || (() => {});
        this.activePage      = PAGES.find(p => p.id).id;
        this.activeSubPage   = "uebersicht";
        this.collapsed       = false;
        this.prozessOffen    = false;
        this._render();
        this._attachEvents();
    }

    _chevronSvg() {
        return `<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="9 18 15 12 9 6"/></svg>`;
    }

    _renderPage(p) {
        if (p.divider) {
            return `<div class="sidebar-nav-divider"><span class="sidebar-nav-divider-label">${p.divider}</span></div>`;
        }

        // Prozessfluss-Gruppe: aufklappbarer Ordner
        if (p.group) {
            const isActive  = PROZESS_PAGES.has(this.activePage);
            const isOpen    = this.prozessOffen || isActive;
            return `
                <button class="nav-item ${isActive ? "active" : ""}" data-group="${p.id}">
                    <span class="nav-icon">${p.icon}</span>
                    <span class="nav-label">${p.label}</span>
                    <span class="nav-chevron ${isOpen ? "open" : ""}">${this._chevronSvg()}</span>
                </button>
                ${isOpen ? `
                <div class="sub-nav">
                    ${p.pages.map(s => `
                        <button class="sub-nav-item ${this.activePage === s.page ? "active" : ""}"
                            data-grouppage="${s.page}">
                            <span class="nav-label">${s.label}</span>
                        </button>
                    `).join("")}
                </div>` : ""}
            `;
        }

        // KPI und andere Seiten mit Sub-Navigation (sub-views, nicht separate Seiten)
        const hasKpiSub = p.sub && p.id === this.activePage;
        return `
            <button class="nav-item ${p.id === this.activePage ? "active" : ""}" data-page="${p.id}">
                <span class="nav-icon">${p.icon}</span>
                <span class="nav-label">${p.label}</span>
                ${p.sub ? `<span class="nav-chevron ${p.id === this.activePage ? "open" : ""}">${this._chevronSvg()}</span>` : ""}
            </button>
            ${hasKpiSub ? `
                <div class="sub-nav">
                    ${p.sub.map(s => `
                        <button class="sub-nav-item ${s.id === this.activeSubPage ? "active" : ""} ${s.disabled ? "disabled" : ""}"
                            data-subpage="${s.id}" ${s.disabled ? "disabled" : ""}>
                            <span class="nav-label">${s.label}</span>
                        </button>
                    `).join("")}
                </div>
            ` : ""}
        `;
    }

    _render() {
        const sidebar = document.getElementById("sidebar");
        sidebar.innerHTML = `
            <div class="sidebar-header">
                <div class="sidebar-logo">G</div>
                <span class="sidebar-title">FiberFlow</span>
            </div>

            <div class="sidebar-divider"></div>

            <nav class="sidebar-nav">
                ${PAGES.map(p => this._renderPage(p)).join("")}
            </nav>

            <div class="sidebar-section">
                <div class="sidebar-section-title">Stadt</div>
                <select class="sidebar-select" id="stadt-select">
                    ${STAEDTE.map(s => `<option value="${s}">${s}</option>`).join("")}
                </select>
            </div>

            <div class="sidebar-bottom">
                <div class="sidebar-refresh">
                    <button class="refresh-btn" id="refresh-btn" title="Daten aktualisieren">
                        <span class="refresh-icon" id="refresh-icon">${ICONS.refresh}</span>
                        <span class="nav-label">Aktualisieren</span>
                    </button>
                </div>
                <div class="sidebar-toggle">
                    <button class="toggle-btn" id="toggle-btn" title="Sidebar ein-/ausklappen">
                        <span id="toggle-icon">${ICONS.chevron_left}</span>
                    </button>
                </div>
            </div>
        `;
    }

    _attachEvents() {
        document.getElementById("sidebar").addEventListener("click", e => {
            // KPI sub-view (data-subpage)
            const subItem = e.target.closest(".sub-nav-item[data-subpage]:not(.disabled)");
            if (subItem) { this._setSubPage(subItem.dataset.subpage); return; }

            // Prozessfluss-Unterseiten (data-grouppage) → navigieren zu Seite
            const groupPage = e.target.closest(".sub-nav-item[data-grouppage]");
            if (groupPage) { this._setPage(groupPage.dataset.grouppage); return; }

            // Prozess-Gruppe toggeln (data-group)
            const groupBtn = e.target.closest(".nav-item[data-group]");
            if (groupBtn) { this.prozessOffen = !this.prozessOffen; this._render(); return; }

            // Normale Seitennavigation
            const item = e.target.closest(".nav-item[data-page]");
            if (item) this._setPage(item.dataset.page);

            if (e.target.closest("#toggle-btn")) this._toggle();
            if (e.target.closest("#refresh-btn")) this._refresh();
        });

        document.getElementById("sidebar").addEventListener("change", e => {
            if (e.target.id === "stadt-select") {
                this.onStadtChange(e.target.value === "Alle Städte" ? null : e.target.value);
            }
        });
    }

    _setPage(pageId) {
        this.activePage = pageId;
        // Wenn eine Prozess-Unterseite ausgewählt wird, Gruppe offen lassen
        if (PROZESS_PAGES.has(pageId)) this.prozessOffen = true;
        this._render();
        this.onPageChange(pageId);
    }

    _setSubPage(subId) {
        this.activeSubPage = subId;
        this._render();
        this.onSubPageChange(subId);
    }

    setActivePage(pageId) {
        this._setPage(pageId);
    }

    async _refresh() {
        const icon = document.getElementById("refresh-icon");
        const btn  = document.getElementById("refresh-btn");
        if (!icon || btn.disabled) return;
        btn.disabled = true;
        icon.style.animation = "spin 0.8s linear infinite";
        try {
            const res  = await fetch("/api/refresh", { method: "POST" });
            icon.style.animation = "";
            if (!res.ok) {
                icon.innerHTML = `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#FF3B30" stroke-width="2.5" stroke-linecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>`;
                setTimeout(() => { icon.innerHTML = ICONS.refresh; btn.disabled = false; }, 2000);
                return;
            }
            icon.innerHTML = `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#34C759" stroke-width="2.5" stroke-linecap="round"><polyline points="20 6 9 17 4 12"/></svg>`;
            this.onRefresh();
            setTimeout(() => {
                icon.innerHTML = ICONS.refresh;
                icon.style.color = "";
                btn.disabled = false;
            }, 2000);
        } catch {
            icon.style.animation = "";
            icon.innerHTML = `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#FF3B30" stroke-width="2.5" stroke-linecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>`;
            setTimeout(() => { icon.innerHTML = ICONS.refresh; btn.disabled = false; }, 2000);
        }
    }

    _toggle() {
        this.collapsed = !this.collapsed;
        document.getElementById("sidebar").classList.toggle("collapsed", this.collapsed);
        document.getElementById("main-content").classList.toggle("collapsed", this.collapsed);
        document.getElementById("toggle-icon").innerHTML = this.collapsed
            ? ICONS.chevron_right
            : ICONS.chevron_left;
    }
}
