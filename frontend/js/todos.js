const STAEDTE_OPTS = ["", "Stadt A", "Stadt D", "Stadt C", "Stadt B", "Stadt E", "Stadt F"];
const PRIO_OPTS    = [
    { value: "niedrig", label: "Niedrig" },
    { value: "normal",  label: "Normal"  },
    { value: "hoch",    label: "Hoch"    },
];

const ICONS_T = {
    plus:    `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>`,
    dots:    `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><circle cx="12" cy="5" r="1.5" fill="currentColor"/><circle cx="12" cy="12" r="1.5" fill="currentColor"/><circle cx="12" cy="19" r="1.5" fill="currentColor"/></svg>`,
    edit:    `<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>`,
    trash:   `<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/></svg>`,
    close:   `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>`,
    clock:   `<svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>`,
    send:    `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg>`,
};

function heute() {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`;
}

function formatDatum(str) {
    if (!str) return null;
    const [y, m, d] = str.split("-");
    return `${d}.${m}.${y}`;
}

class TodosPage {
    constructor() {
        this._spalten        = [];
        this._aktivStadt     = null;
        this._filterPrio     = null;
        this._filterZugewies = null;
        this._container      = document.getElementById("page-todos");
        this._dragCardId     = null;
        this._detailPanel    = null;
        this._detailBackdrop = null;
        this._escHandler     = null;
        this._init();
    }

    async _init() {
        this._renderSkeleton();
        await this._load();
    }

    async _load() {
        try {
            const res = await fetch("/api/todos/spalten");
            this._spalten = await res.json();
            this._render();
        } catch {
            this._container.innerHTML = `<p style="color:var(--color-red);padding:var(--space-lg)">Fehler beim Laden der Aufgaben.</p>`;
        }
    }

    setStadt(stadt) {
        this._aktivStadt = stadt;
        this._render();
    }

    _alleZugewiesenen() {
        const namen = new Set();
        for (const s of this._spalten)
            for (const t of s.todos)
                if (t.zugewiesen) namen.add(t.zugewiesen);
        return [...namen].sort();
    }

    _renderFilterBar() {
        const zugewiesenOpts = this._alleZugewiesenen();
        return `
            <div class="todos-filterbar">
                <span class="todos-filter-label">Filter:</span>
                <div class="todos-filter-group">
                    <button class="todos-filter-btn ${!this._filterPrio ? "active" : ""}" data-filter-prio="">Alle</button>
                    <button class="todos-filter-btn prio-hoch ${this._filterPrio === "hoch" ? "active" : ""}" data-filter-prio="hoch">Hoch</button>
                    <button class="todos-filter-btn prio-normal ${this._filterPrio === "normal" ? "active" : ""}" data-filter-prio="normal">Normal</button>
                    <button class="todos-filter-btn prio-niedrig ${this._filterPrio === "niedrig" ? "active" : ""}" data-filter-prio="niedrig">Niedrig</button>
                </div>
                ${zugewiesenOpts.length > 0 ? `
                <div class="todos-filter-group">
                    <select class="todos-filter-select" id="filter-zugewiesen">
                        <option value="">Alle Mitarbeiter</option>
                        ${zugewiesenOpts.map(n => `
                            <option value="${n}" ${this._filterZugewies === n ? "selected" : ""}>${n}</option>
                        `).join("")}
                    </select>
                </div>` : ""}
                ${(this._filterPrio || this._filterZugewies) ? `
                    <button class="todos-filter-reset" id="btn-filter-reset">× zurücksetzen</button>
                ` : ""}
            </div>
        `;
    }

    _render() {
        const stadtLabel = this._aktivStadt ? ` – ${this._aktivStadt}` : "";
        this._container.innerHTML = `
            <div class="page-layout">
                <div class="page-header">
                    <h1>Aufgaben${stadtLabel}</h1>
                </div>
                ${this._renderFilterBar()}
                <div class="todos-board" id="todos-board">
                    ${this._spalten.map(s => this._renderSpalte(s)).join("")}
                    <div class="todo-add-spalte">
                        <button class="todo-add-spalte-btn" id="btn-add-spalte">
                            ${ICONS_T.plus} Spalte hinzufügen
                        </button>
                    </div>
                </div>
            </div>
        `;
        this._attachBoardEvents();
        this._attachFilterEvents();
    }

    _attachFilterEvents() {
        this._container.querySelectorAll("[data-filter-prio]").forEach(btn => {
            btn.addEventListener("click", () => {
                this._filterPrio = btn.dataset.filterPrio || null;
                this._render();
            });
        });
        const sel = document.getElementById("filter-zugewiesen");
        if (sel) {
            sel.addEventListener("change", () => {
                this._filterZugewies = sel.value || null;
                this._render();
            });
        }
        document.getElementById("btn-filter-reset")?.addEventListener("click", () => {
            this._filterPrio     = null;
            this._filterZugewies = null;
            this._render();
        });
    }

    _renderSpalte(spalte) {
        let karten = spalte.todos;
        if (this._aktivStadt)     karten = karten.filter(t => !t.stadt || t.stadt === this._aktivStadt);
        if (this._filterPrio)     karten = karten.filter(t => t.prioritaet === this._filterPrio);
        if (this._filterZugewies) karten = karten.filter(t => t.zugewiesen === this._filterZugewies);

        return `
            <div class="todo-spalte" data-spalte-id="${spalte.id}">
                <div class="todo-spalte-header">
                    <div class="todo-spalte-farbe" style="background:${spalte.farbe}"></div>
                    <span class="todo-spalte-name">${spalte.name}</span>
                    <span class="todo-spalte-count">${karten.length}</span>
                    <button class="todo-spalte-menu-btn" data-menu-spalte="${spalte.id}" title="Spalte bearbeiten">
                        ${ICONS_T.dots}
                    </button>
                </div>
                <div class="todo-spalte-body" data-drop-spalte="${spalte.id}">
                    ${karten.map(t => this._renderCard(t)).join("")}
                </div>
                <button class="todo-add-card-btn" data-add-card-spalte="${spalte.id}">
                    ${ICONS_T.plus} Karte hinzufügen
                </button>
            </div>
        `;
    }

    _renderCard(todo) {
        const istUeberfaellig = todo.faellig_am && todo.faellig_am < heute();
        return `
            <div class="todo-card" draggable="true"
                 data-card-id="${todo.id}" data-prio="${todo.prioritaet}">
                <div class="todo-card-titel">${todo.titel}</div>
                ${todo.beschreibung ? `<div class="todo-card-beschreibung">${todo.beschreibung}</div>` : ""}
                <div class="todo-card-footer">
                    <span class="todo-badge prio-${todo.prioritaet}">${this._prioLabel(todo.prioritaet)}</span>
                    ${todo.stadt    ? `<span class="todo-badge stadt">${todo.stadt}</span>` : ""}
                    ${todo.zugewiesen ? `<span class="todo-badge zugewiesen">${todo.zugewiesen}</span>` : ""}
                    ${todo.faellig_am ? `
                        <span class="todo-faellig ${istUeberfaellig ? "ueberfaellig" : ""}">
                            ${ICONS_T.clock} ${formatDatum(todo.faellig_am)}
                        </span>` : ""}
                </div>
            </div>
        `;
    }

    _prioLabel(p) {
        return { niedrig: "Niedrig", normal: "Normal", hoch: "Hoch" }[p] || p;
    }

    _attachBoardEvents() {
        const board = document.getElementById("todos-board");

        // Karte hinzufügen
        board.querySelectorAll(".todo-add-card-btn").forEach(btn => {
            btn.addEventListener("click", () => {
                this._showKartenModal(null, parseInt(btn.dataset.addCardSpalte));
            });
        });

        // Spalte Menü
        board.querySelectorAll("[data-menu-spalte]").forEach(btn => {
            btn.addEventListener("click", e => {
                e.stopPropagation();
                this._showSpalteMenu(btn, parseInt(btn.dataset.menuSpalte));
            });
        });

        // Spalte hinzufügen
        document.getElementById("btn-add-spalte").addEventListener("click", () => {
            this._showSpalteModal();
        });

        // Karte klicken → Detail
        board.querySelectorAll(".todo-card").forEach(card => {
            card.addEventListener("click", () => {
                const todo = this._findTodo(parseInt(card.dataset.cardId));
                if (todo) this._showDetail(todo);
            });
        });

        // Drag & Drop
        board.querySelectorAll(".todo-card").forEach(card => {
            card.addEventListener("dragstart", e => {
                this._dragCardId = parseInt(card.dataset.cardId);
                card.classList.add("dragging");
                e.dataTransfer.effectAllowed = "move";
            });
            card.addEventListener("dragend", () => {
                card.classList.remove("dragging");
            });
        });

        board.querySelectorAll("[data-drop-spalte]").forEach(zone => {
            zone.addEventListener("dragover", e => {
                e.preventDefault();
                zone.closest(".todo-spalte").classList.add("drag-over");
            });
            zone.addEventListener("dragleave", () => {
                zone.closest(".todo-spalte").classList.remove("drag-over");
            });
            zone.addEventListener("drop", async e => {
                e.preventDefault();
                zone.closest(".todo-spalte").classList.remove("drag-over");
                const zielSpalteId = parseInt(zone.dataset.dropSpalte);
                if (this._dragCardId) {
                    await this._moveTodo(this._dragCardId, zielSpalteId);
                    this._dragCardId = null;
                }
            });
        });

    }

    _findTodo(id) {
        for (const s of this._spalten) {
            const t = s.todos.find(t => t.id === id);
            if (t) return t;
        }
        return null;
    }

    async _moveTodo(todoId, zielSpalteId) {
        const todo = this._findTodo(todoId);
        if (!todo || todo.spalte_id === zielSpalteId) return;
        await fetch(`/api/todos/${todoId}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ spalte_id: zielSpalteId }),
        });
        await this._load();
    }

    // ---- Spalten-Menü ----

    _showSpalteMenu(btn, spalteId) {
        this._closeDropdown();
        const rect = btn.getBoundingClientRect();
        const menu = document.createElement("div");
        menu.className = "todo-dropdown";
        menu.id = "todo-dropdown";
        menu.style.cssText = `position:fixed;top:${rect.bottom + 4}px;left:${rect.left}px`;
        const spalte = this._spalten.find(s => s.id === spalteId);
        menu.innerHTML = `
            <button class="todo-dropdown-item" id="dd-rename">${ICONS_T.edit} Umbenennen</button>
            <button class="todo-dropdown-item danger" id="dd-delete">${ICONS_T.trash} Löschen</button>
        `;
        document.body.appendChild(menu);

        // Dropdown schließen bei Klick außerhalb — setTimeout damit der aktuelle Klick nicht sofort feuert
        setTimeout(() => {
            document.addEventListener("click", e => {
                if (!menu.contains(e.target)) this._closeDropdown();
            }, { once: true });
        }, 0);

        menu.querySelector("#dd-rename").addEventListener("click", e => {
            e.stopPropagation();
            this._closeDropdown();
            this._showSpalteModal(spalte);
        });

        menu.querySelector("#dd-delete").addEventListener("click", async e => {
            e.stopPropagation();
            this._closeDropdown();
            if (spalte.todos.length > 0) {
                alert(`Spalte "${spalte.name}" hat noch ${spalte.todos.length} Karte(n).\nBitte zuerst alle Karten verschieben oder löschen.`);
                return;
            }
            if (!confirm(`Spalte "${spalte.name}" wirklich löschen?`)) return;
            await fetch(`/api/todos/spalten/${spalteId}`, { method: "DELETE" });
            await this._load();
        });
    }

    _closeDropdown() {
        document.getElementById("todo-dropdown")?.remove();
    }

    // ---- Spalte Modal ----

    _showSpalteModal(spalte = null) {
        const isEdit = !!spalte;
        const farben = ["#0071E3", "#34C759", "#FF9500", "#FF3B30", "#AF52DE", "#5AC8FA", "#FF6B00", "#8E8E93"];

        this._openModal({
            titel: isEdit ? "Spalte umbenennen" : "Neue Spalte",
            body: `
                <div class="form-group">
                    <label class="form-label">Name</label>
                    <input class="form-input" id="m-spalte-name" placeholder="z.B. Review" value="${spalte?.name || ""}">
                </div>
                <div class="form-group">
                    <label class="form-label">Farbe</label>
                    <div style="display:flex;gap:8px;flex-wrap:wrap">
                        ${farben.map(f => `
                            <div class="farb-option ${spalte?.farbe === f ? "selected" : ""}"
                                 data-farbe="${f}"
                                 style="width:28px;height:28px;border-radius:50%;background:${f};cursor:pointer;
                                        box-sizing:border-box;border:3px solid ${spalte?.farbe === f ? "#1D1D1F" : "transparent"}">
                            </div>`).join("")}
                    </div>
                </div>
            `,
            onSave: async () => {
                const name  = document.getElementById("m-spalte-name").value.trim();
                const farbe = document.querySelector(".farb-option.selected")?.dataset.farbe || "#0071E3";
                if (!name) { alert("Bitte einen Namen eingeben."); return false; }
                if (isEdit) {
                    await fetch(`/api/todos/spalten/${spalte.id}`, {
                        method: "PATCH",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({ name, farbe }),
                    });
                } else {
                    await fetch("/api/todos/spalten", {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({ name, farbe }),
                    });
                }
                await this._load();
                return true;
            }
        });

        // Farb-Picker Logik
        document.querySelectorAll(".farb-option").forEach(el => {
            el.addEventListener("click", () => {
                document.querySelectorAll(".farb-option").forEach(o => {
                    o.classList.remove("selected");
                    o.style.border = "3px solid transparent";
                });
                el.classList.add("selected");
                el.style.border = "3px solid #1D1D1F";
            });
        });
    }

    // ---- Karten Modal ----

    _showKartenModal(todo = null, defaultSpalteId = null) {
        const isEdit = !!todo;

        this._openModal({
            titel: isEdit ? "Karte bearbeiten" : "Neue Karte",
            body: `
                <div class="form-group">
                    <label class="form-label">Titel *</label>
                    <input class="form-input" id="m-titel" placeholder="Aufgabe beschreiben..." value="${todo?.titel || ""}">
                </div>
                <div class="form-group">
                    <label class="form-label">Beschreibung</label>
                    <textarea class="form-textarea" id="m-beschreibung" placeholder="Details...">${todo?.beschreibung || ""}</textarea>
                </div>
                <div class="form-row">
                    <div class="form-group">
                        <label class="form-label">Spalte</label>
                        <select class="form-select" id="m-spalte">
                            ${this._spalten.map(s => `
                                <option value="${s.id}" ${(todo?.spalte_id || defaultSpalteId) === s.id ? "selected" : ""}>${s.name}</option>
                            `).join("")}
                        </select>
                    </div>
                    <div class="form-group">
                        <label class="form-label">Priorität</label>
                        <select class="form-select" id="m-prio">
                            ${PRIO_OPTS.map(p => `
                                <option value="${p.value}" ${todo?.prioritaet === p.value ? "selected" : ""}>${p.label}</option>
                            `).join("")}
                        </select>
                    </div>
                </div>
                <div class="form-row">
                    <div class="form-group">
                        <label class="form-label">Zugewiesen an</label>
                        <input class="form-input" id="m-zugewiesen" placeholder="Name..." value="${todo?.zugewiesen || ""}">
                    </div>
                    <div class="form-group">
                        <label class="form-label">Stadt</label>
                        <select class="form-select" id="m-stadt">
                            <option value="">Alle</option>
                            ${STAEDTE_OPTS.filter(Boolean).map(s => `
                                <option value="${s}" ${todo?.stadt === s ? "selected" : ""}>${s}</option>
                            `).join("")}
                        </select>
                    </div>
                </div>
                <div class="form-group">
                    <label class="form-label">Fällig am</label>
                    <input class="form-input" type="date" id="m-faellig" value="${todo?.faellig_am || ""}">
                </div>
                ${isEdit ? `
                    <div style="padding-top:var(--space-sm);border-top:1px solid var(--color-border)">
                        <button class="btn btn-danger" id="btn-delete-todo">Karte löschen</button>
                    </div>` : ""}
            `,
            onSave: async () => {
                const titel = document.getElementById("m-titel").value.trim();
                if (!titel) { alert("Bitte einen Titel eingeben."); return false; }
                const body = {
                    spalte_id:    parseInt(document.getElementById("m-spalte").value),
                    titel,
                    beschreibung: document.getElementById("m-beschreibung").value.trim() || null,
                    prioritaet:   document.getElementById("m-prio").value,
                    zugewiesen:   document.getElementById("m-zugewiesen").value.trim() || null,
                    stadt:        document.getElementById("m-stadt").value || null,
                    faellig_am:   document.getElementById("m-faellig").value || null,
                };
                if (isEdit) {
                    await fetch(`/api/todos/${todo.id}`, {
                        method: "PATCH",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify(body),
                    });
                } else {
                    await fetch("/api/todos", {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify(body),
                    });
                }
                await this._load();
                return true;
            }
        });

        if (isEdit) {
            document.getElementById("btn-delete-todo")?.addEventListener("click", async () => {
                if (!confirm(`Karte "${todo.titel}" wirklich löschen?`)) return;
                await fetch(`/api/todos/${todo.id}`, { method: "DELETE" });
                this._closeModal();
                await this._load();
            });
        }
    }

    // ---- Modal Helper ----

    _openModal({ titel, body, onSave }) {
        this._closeModal();
        const backdrop = document.createElement("div");
        backdrop.className = "todo-modal-backdrop";
        backdrop.innerHTML = `
            <div class="todo-modal" id="todo-modal">
                <div class="todo-modal-header">
                    <span class="todo-modal-title">${titel}</span>
                    <button class="detail-panel-close" id="modal-close">${ICONS_T.close}</button>
                </div>
                <div class="todo-modal-body">${body}</div>
                <div class="todo-modal-footer">
                    <button class="btn btn-ghost" id="modal-cancel">Abbrechen</button>
                    <button class="btn btn-primary" id="modal-save">Speichern</button>
                </div>
            </div>
        `;
        document.body.appendChild(backdrop);
        this._modalBackdrop = backdrop;

        backdrop.addEventListener("click", e => { if (e.target === backdrop) this._closeModal(); });
        document.getElementById("modal-close").addEventListener("click",  () => this._closeModal());
        document.getElementById("modal-cancel").addEventListener("click", () => this._closeModal());
        document.getElementById("modal-save").addEventListener("click", async () => {
            const ok = await onSave();
            if (ok !== false) this._closeModal();
        });

        document.getElementById("todo-modal").querySelector(".form-input")?.focus();
    }

    _closeModal() {
        this._modalBackdrop?.remove();
        this._modalBackdrop = null;
    }

    // ---- Detail-Panel ----

    _showDetail(todo) {
        this._closeDetail();

        const istUeberfaellig = todo.faellig_am && todo.faellig_am < heute();
        const prioLabel = this._prioLabel(todo.prioritaet);

        const backdrop = document.createElement("div");
        backdrop.className = "detail-backdrop";
        backdrop.addEventListener("click", () => this._closeDetail());

        const panel = document.createElement("div");
        panel.className = "detail-panel";
        panel.style.width = "340px";
        panel.innerHTML = `
            <div class="detail-panel-header">
                <div>
                    <div class="detail-panel-title">${todo.titel}</div>
                    <span class="todo-badge prio-${todo.prioritaet}" style="margin-top:6px;display:inline-block">
                        ${prioLabel}
                    </span>
                </div>
                <button class="detail-panel-close" id="detail-close">${ICONS_T.close}</button>
            </div>
            <div class="detail-panel-body" id="detail-body">
                ${todo.beschreibung ? `
                    <div class="detail-section">
                        <div class="detail-section-label">Beschreibung</div>
                        <div style="font-size:13px;color:var(--color-text-secondary);line-height:1.5">${todo.beschreibung}</div>
                    </div>` : ""}

                <div class="detail-section">
                    <div class="detail-section-label">Details</div>
                    ${todo.zugewiesen ? `<div class="detail-row" style="font-size:13px">👤 ${todo.zugewiesen}</div>` : ""}
                    ${todo.stadt      ? `<div class="detail-row" style="font-size:13px">📍 ${todo.stadt}</div>`      : ""}
                    ${todo.faellig_am ? `
                        <div class="detail-row" style="font-size:13px;${istUeberfaellig ? "color:var(--color-red)" : ""}">
                            ${ICONS_T.clock} Fällig: ${formatDatum(todo.faellig_am)}${istUeberfaellig ? " ⚠️" : ""}
                        </div>` : ""}
                </div>

                <div class="detail-section" id="kommentare-section">
                    <div class="detail-section-label">Kommentare</div>
                    <div class="kommentar-list" id="kommentar-list">
                        <div style="font-size:12px;color:var(--color-text-muted)">Wird geladen…</div>
                    </div>
                    <div class="kommentar-form" style="margin-top:var(--space-sm)">
                        <div class="kommentar-form-row">
                            <input class="form-input" id="k-autor" placeholder="Dein Name" style="max-width:110px">
                            <input class="form-input" id="k-text"  placeholder="Kommentar schreiben…">
                        </div>
                        <button class="btn btn-primary" id="btn-kommentar-send" style="align-self:flex-end">
                            ${ICONS_T.send} Senden
                        </button>
                    </div>
                </div>
            </div>
            <div class="todo-detail-actions">
                <button class="btn btn-danger" id="btn-detail-delete">${ICONS_T.trash}</button>
                <button class="btn btn-ghost" id="btn-detail-edit" style="flex:1">Bearbeiten</button>
            </div>
        `;

        document.body.appendChild(backdrop);
        document.body.appendChild(panel);
        this._detailPanel    = panel;
        this._detailBackdrop = backdrop;

        requestAnimationFrame(() => panel.classList.add("visible"));

        panel.querySelector("#detail-close").addEventListener("click", () => this._closeDetail());
        panel.querySelector("#btn-detail-edit").addEventListener("click", () => {
            this._closeDetail();
            this._showKartenModal(todo);
        });
        panel.querySelector("#btn-detail-delete").addEventListener("click", async () => {
            if (!confirm(`Aufgabe "${todo.titel}" wirklich löschen?`)) return;
            await fetch(`/api/todos/${todo.id}`, { method: "DELETE" });
            this._closeDetail();
            await this._load();
        });

        panel.querySelector("#btn-kommentar-send").addEventListener("click", () => {
            this._sendKommentar(todo.id);
        });
        panel.querySelector("#k-text").addEventListener("keydown", e => {
            if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); this._sendKommentar(todo.id); }
        });

        this._escHandler = e => { if (e.key === "Escape") this._closeDetail(); };
        document.addEventListener("keydown", this._escHandler);

        this._loadKommentare(todo.id);
    }

    async _loadKommentare(todoId) {
        const list = document.getElementById("kommentar-list");
        if (!list) return;
        try {
            const res  = await fetch(`/api/todos/${todoId}/kommentare`);
            const data = await res.json();
            if (data.length === 0) {
                list.innerHTML = `<div style="font-size:12px;color:var(--color-text-muted)">Noch keine Kommentare.</div>`;
            } else {
                list.innerHTML = data.map(k => `
                    <div class="kommentar-item">
                        <div class="kommentar-meta">
                            <span>${k.autor}</span>
                            <span>${k.erstellt_am.slice(0,16).replace("T"," ")}</span>
                        </div>
                        <div class="kommentar-text">${k.text}</div>
                    </div>
                `).join("");
            }
        } catch {
            list.innerHTML = `<div style="font-size:12px;color:var(--color-red)">Fehler beim Laden.</div>`;
        }
    }

    async _sendKommentar(todoId) {
        const autor = document.getElementById("k-autor")?.value.trim();
        const text  = document.getElementById("k-text")?.value.trim();
        if (!autor) { alert("Bitte deinen Namen eingeben."); return; }
        if (!text)  return;
        await fetch(`/api/todos/${todoId}/kommentare`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ autor, text }),
        });
        document.getElementById("k-text").value = "";
        await this._loadKommentare(todoId);
    }

    _closeDetail() {
        this._detailPanel?.remove();
        this._detailBackdrop?.remove();
        this._detailPanel    = null;
        this._detailBackdrop = null;
        if (this._escHandler) {
            document.removeEventListener("keydown", this._escHandler);
            this._escHandler = null;
        }
    }

    _renderSkeleton() {
        this._container.innerHTML = `
            <div class="page-layout">
                <div class="page-header"><h1>Aufgaben</h1></div>
                <div class="todos-skeleton">
                    <div class="skeleton-spalte"></div>
                    <div class="skeleton-spalte"></div>
                    <div class="skeleton-spalte"></div>
                </div>
            </div>
        `;
    }
}
