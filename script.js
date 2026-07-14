(function () {
  "use strict";

  const STORAGE_KEY = "todo-app:todos";
  const THEME_KEY = "todo-app:theme";
  let todos = [];
  let currentFilter = "all";
  let currentSearch = "";
  let priorityFilter = "all";
  let categoryFilter = "all";
  let currentSort = "created";

  const PRIORITIES = ["low", "medium", "high"];
  const PRIORITY_RANK = { low: 0, medium: 1, high: 2 };

  const COLORS = [
    { value: "red", emoji: "🔴", label: "Work" },
    { value: "green", emoji: "🟢", label: "Personal" },
    { value: "blue", emoji: "🔵", label: "Study" },
    { value: "yellow", emoji: "🟡", label: "Urgent" },
    { value: "purple", emoji: "🟣", label: "Other" },
  ];
  const COLOR_MAP = COLORS.reduce((acc, c) => {
    acc[c.value] = c;
    return acc;
  }, {});

  const $ = (id) => document.getElementById(id);
  const form = $("todo-form");
  const input = $("todo-input");
  const prioritySelect = $("todo-priority");
  const categorySelect = $("todo-category");
  const colorSelect = $("todo-color");
  const dueInput = $("todo-due");
  const list = $("todo-list");
  const emptyState = $("empty-state");
  const itemsLeft = $("items-left");
  const progressText = $("progress-text");
  const progressPercent = $("progress-percent");
  const progressTrack = document.querySelector(".progress__track");
  const progressFill = $("progress-fill");
  const clearCompleted = $("clear-completed");
  const template = $("todo-item-template");
  const themeToggle = $("theme-toggle");
  const searchInput = $("search-input");
  const priorityFilterSelect = $("priority-filter");
  const categoryFilterSelect = $("category-filter");
  const sortSelect = $("sort-select");

  const root = document.documentElement;

  function currentTheme() {
    return root.getAttribute("data-theme") === "dark" ? "dark" : "light";
  }

  function applyTheme(theme) {
    root.setAttribute("data-theme", theme);
    const isDark = theme === "dark";
    themeToggle.setAttribute("aria-pressed", String(isDark));
    themeToggle.setAttribute("aria-label", isDark ? "Switch to light mode" : "Switch to dark mode");
  }

  function initTheme() {
    let theme = "light";
    try {
      const saved = localStorage.getItem(THEME_KEY);
      if (saved === "dark" || saved === "light") {
        theme = saved;
      } else if (
        window.matchMedia &&
        window.matchMedia("(prefers-color-scheme: dark)").matches
      ) {
        theme = "dark";
      }
    } catch (e) {
      theme = "light";
    }
    applyTheme(theme);
  }

  themeToggle.addEventListener("click", () => {
    const next = currentTheme() === "dark" ? "light" : "dark";
    applyTheme(next);
    try {
      localStorage.setItem(THEME_KEY, next);
    } catch (e) {}
  });

  const uid = () =>
    Date.now().toString(36) + Math.random().toString(36).slice(2, 8);

  function formatTs(ts) {
    if (!ts) return "";
    try {
      return new Date(ts).toLocaleString(undefined, {
        month: "short",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      });
    } catch (e) {
      return "";
    }
  }

  function nowTs() {
    return new Date().toISOString();
  }

  function load() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      const parsed = raw ? JSON.parse(raw) : [];
      todos = parsed.map((t) => ({
        id: t.id,
        text: t.text,
        notes: typeof t.notes === "string" ? t.notes : "",
        completed: !!t.completed,
        priority: PRIORITIES.includes(t.priority) ? t.priority : "medium",
        category: typeof t.category === "string" && t.category ? t.category : "general",
        color: typeof t.color === "string" && COLOR_MAP[t.color] ? t.color : "",
        dueDate: typeof t.dueDate === "string" ? t.dueDate : "",
        favorite: !!t.favorite,
        pinned: !!t.pinned,
        createdAt: typeof t.createdAt === "number" ? t.createdAt : Date.now(),
        completedAt: t.completed ? t.completedAt || null : null,
      }));
    } catch (e) {
      todos = [];
    }
  }

  function save() {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(todos));
  }

  function addTodo(text) {
    todos.unshift({
      id: uid(),
      text,
      notes: "",
      completed: false,
      priority: prioritySelect.value,
      category: categorySelect.value,
      color: colorSelect.value || "",
      dueDate: dueInput.value || "",
      favorite: false,
      pinned: false,
      createdAt: Date.now(),
      completedAt: null
    });
    save();
    render();
  }

  function toggleFavorite(id) {
    const todo = todos.find((t) => t.id === id);
    if (todo) {
      todo.favorite = !todo.favorite;
      save();
      render();
    }
  }

  function togglePin(id) {
    const todo = todos.find((t) => t.id === id);
    if (todo) {
      todo.pinned = !todo.pinned;
      save();
      render();
    }
  }

  function toggleTodo(id) {
    const todo = todos.find((t) => t.id === id);
    if (todo) {
      todo.completed = !todo.completed;
      todo.completedAt = todo.completed ? nowTs() : null;
      save();
      render();
    }
  }

  function editTodo(id, text, notes, color) {
    const todo = todos.find((t) => t.id === id);
    if (!todo) return;
    todo.text = text.trim();
    if (typeof notes === "string") todo.notes = notes.trim();
    if (typeof color === "string") todo.color = COLOR_MAP[color] ? color : "";
    save();
    render();
  }

  function duplicateTodo(id) {
    const todo = todos.find((t) => t.id === id);
    if (!todo) return;
    const copy = {
      id: uid(),
      text: todo.text,
      notes: todo.notes || "",
      completed: false,
      favorite: !!todo.favorite,
      pinned: !!todo.pinned,
      color: todo.color || "",
      createdAt: nowTs(),
      completedAt: null,
    };
    const idx = todos.findIndex((t) => t.id === id);
    todos.splice(idx, 0, copy);
    save();
    render();
  }

  function deleteTodo(id) {
    todos = todos.filter((t) => t.id !== id);
    save();
    render();
  }

  function clearCompletedTodos() {
    todos = todos.filter((t) => !t.completed);
    save();
    render();
  }

  function isOverdue(todo) {
    if (!todo.dueDate || todo.completed) return false;
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return new Date(todo.dueDate + "T00:00:00") < today;
  }

  function filtered() {
    let result = todos.slice();

    if (currentFilter === "active") result = result.filter((t) => !t.completed);
    else if (currentFilter === "completed") result = result.filter((t) => t.completed);
    else if (currentFilter === "favorites") result = result.filter((t) => t.favorite);
    else if (currentFilter === "pinned") result = result.filter((t) => t.pinned);

    if (currentSearch) {
      const q = currentSearch.toLowerCase();
      result = result.filter((t) => t.text.toLowerCase().includes(q));
    }

    if (priorityFilter !== "all") {
      result = result.filter((t) => t.priority === priorityFilter);
    }

    if (categoryFilter !== "all") {
      result = result.filter((t) => t.category === categoryFilter);
    }

    switch (currentSort) {
      case "created":
        result.sort((a, b) => b.createdAt - a.createdAt);
        break;
      case "created-asc":
        result.sort((a, b) => a.createdAt - b.createdAt);
        break;
      case "priority":
        result.sort((a, b) => PRIORITY_RANK[b.priority] - PRIORITY_RANK[a.priority]);
        break;
      case "priority-asc":
        result.sort((a, b) => PRIORITY_RANK[a.priority] - PRIORITY_RANK[b.priority]);
        break;
      case "due":
        result.sort((a, b) => {
          if (!a.dueDate) return 1;
          if (!b.dueDate) return -1;
          return a.dueDate.localeCompare(b.dueDate);
        });
        break;
      case "alpha":
        result.sort((a, b) => a.text.localeCompare(b.text));
        break;
    }

    result.sort((a, b) => (b.pinned ? 1 : 0) - (a.pinned ? 1 : 0));

    return result;
  }

  function formatDueDate(dueDate) {
    if (!dueDate) return "";
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const due = new Date(dueDate + "T00:00:00");
    const diffDays = Math.round((due - today) / 86400000);
    if (diffDays === 0) return "Today";
    if (diffDays === 1) return "Tomorrow";
    if (diffDays === -1) return "Yesterday";
    if (diffDays < 0) return Math.abs(diffDays) + "d overdue";
    if (diffDays <= 7) return "In " + diffDays + "d";
    return due.toLocaleDateString(undefined, { month: "short", day: "numeric" });
  }

  function startEdit(item, todo) {
    const editEl = item.querySelector(".todo-item__edit");
    const notesEl = item.querySelector(".todo-item__notes");
    item.classList.add("is-editing");
    editEl.querySelector(".todo-item__edit-input").value = todo.text;
    editEl.querySelector(".todo-item__edit-notes").value = todo.notes || "";
    editEl.querySelector(".todo-item__edit-color").value = todo.color || "";
    editEl.querySelector(".todo-item__edit-input").focus();
    notesEl.classList.add("is-hidden");
  }

  function cancelEdit(item) {
    item.classList.remove("is-editing");
    const todo = todos.find((t) => t.id === item.dataset.id);
    if (todo && todo.notes) {
      item
        .querySelector(".todo-item__notes")
        .classList.remove("is-hidden");
    }
  }

  function saveEdit(item, todo) {
    const text = item.querySelector(".todo-item__edit-input").value.trim();
    if (!text) return;
    const notes = item.querySelector(".todo-item__edit-notes").value;
    const color = item.querySelector(".todo-item__edit-color").value;
    editTodo(todo.id, text, notes, color);
  }

  function toggleNotes(item, todo) {
    item
      .querySelector(".todo-item__notes")
      .classList.toggle("is-hidden");
  }

  function render() {
    list.innerHTML = "";
    const visible = filtered();

    visible.forEach((todo) => {
      const item = template.content.firstElementChild.cloneNode(true);
      item.dataset.id = todo.id;
      item.classList.toggle("is-completed", todo.completed);
      item.classList.toggle("is-overdue", isOverdue(todo));
      item.classList.toggle("is-pinned", todo.pinned);
      item.classList.toggle("is-favorite", todo.favorite);

      const checkbox = item.querySelector(".todo-item__checkbox");
      checkbox.checked = todo.completed;
      checkbox.addEventListener("change", () => toggleTodo(todo.id));

      item.querySelector(".todo-item__text").textContent = todo.text;

      const starBtn = item.querySelector(".todo-item__star");
      starBtn.classList.toggle("is-active", todo.favorite);
      starBtn.setAttribute("aria-pressed", String(todo.favorite));
      starBtn.title = todo.favorite ? "Unstar task" : "Star task";
      starBtn.addEventListener("click", () => toggleFavorite(todo.id));

      const pinBtn = item.querySelector(".todo-item__pin");
      pinBtn.classList.toggle("is-active", todo.pinned);
      pinBtn.setAttribute("aria-pressed", String(todo.pinned));
      pinBtn.title = todo.pinned ? "Unpin task" : "Pin task";
      pinBtn.addEventListener("click", () => togglePin(todo.id));

      const priorityBadge = item.querySelector(".todo-item__badge--priority");
      priorityBadge.textContent = todo.priority;
      priorityBadge.classList.add("is-" + todo.priority);

      item.querySelector(".todo-item__badge--category").textContent = todo.category;

      const colorBadge = item.querySelector(".todo-item__badge--color");
      if (todo.color && COLOR_MAP[todo.color]) {
        const c = COLOR_MAP[todo.color];
        colorBadge.textContent = c.emoji + " " + c.label;
        colorBadge.classList.add("is-" + c.value);
      } else {
        colorBadge.remove();
      }

      const dueBadge = item.querySelector(".todo-item__badge--due");
      if (todo.dueDate) {
        dueBadge.textContent = formatDueDate(todo.dueDate);
        dueBadge.classList.toggle("is-overdue", isOverdue(todo));
      } else {
        dueBadge.remove();
      }

      const meta = item.querySelector(".todo-item__meta");
      const createdSpan = meta.querySelector(".todo-item__created");
      createdSpan.title = new Date(todo.createdAt).toLocaleString();
      createdSpan.textContent = "Created: " + formatTs(todo.createdAt);
      if (todo.completed && todo.completedAt) {
        const comp = meta.querySelector(".todo-item__completed");
        comp.title = new Date(todo.completedAt).toLocaleString();
        comp.textContent = "Completed: " + formatTs(todo.completedAt);
      } else {
        meta.querySelector(".todo-item__completed").remove();
      }

      const notesEl = item.querySelector(".todo-item__notes");
      notesEl.textContent = todo.notes || "";
      if (!todo.notes) notesEl.classList.add("is-hidden");

      item
        .querySelector(".todo-item__edit-btn")
        .addEventListener("click", () => startEdit(item, todo));

      item
        .querySelector(".todo-item__duplicate")
        .addEventListener("click", () => duplicateTodo(todo.id));

      item
        .querySelector(".todo-item__notes-toggle")
        .addEventListener("click", () => toggleNotes(item, todo));

      item
        .querySelector(".todo-item__delete")
        .addEventListener("click", () => deleteTodo(todo.id));

      item
        .querySelector(".todo-item__save")
        .addEventListener("click", () => saveEdit(item, todo));

      item
        .querySelector(".todo-item__cancel")
        .addEventListener("click", () => cancelEdit(item));

      const editForm = item.querySelector(".todo-item__edit");
      editForm
        .querySelector(".todo-item__edit-input")
        .addEventListener("keydown", (e) => {
          if (e.key === "Enter") {
            e.preventDefault();
            saveEdit(item, todo);
          } else if (e.key === "Escape") {
            e.preventDefault();
            cancelEdit(item);
          }
        });

      list.appendChild(item);
    });

    const hasItems = visible.length > 0;
    emptyState.classList.toggle("is-hidden", hasItems);
    if (todos.length === 0) {
      emptyState.textContent = "No todos yet. Add one above!";
    } else if (visible.length === 0) {
      const parts = [];
      if (currentSearch) parts.push('matching "' + currentSearch + '"');
      if (currentFilter !== "all") parts.push(currentFilter);
      emptyState.textContent = "No " + (parts.join(" / ") || currentFilter) + " todos.";
    }

    const total = todos.length;
    const completed = todos.filter((t) => t.completed).length;
    const percent = total === 0 ? 0 : Math.round((completed / total) * 100);

    progressText.textContent = "Completed: " + completed + " / " + total;
    progressPercent.textContent = percent + "%";
    progressFill.style.width = percent + "%";
    if (progressTrack) {
      progressTrack.setAttribute("aria-valuenow", String(percent));
    }

    const remaining = todos.filter((t) => !t.completed).length;
    itemsLeft.textContent =
      remaining + " item" + (remaining === 1 ? "" : "s") + " left";

    const hasCompleted = todos.some((t) => t.completed);
    clearCompleted.disabled = !hasCompleted;
  }

  form.addEventListener("submit", (e) => {
    e.preventDefault();
    const text = input.value.trim();
    if (!text) return;
    addTodo(text);
    input.value = "";
    dueInput.value = "";
    colorSelect.value = "";
    input.focus();
  });

  clearCompleted.addEventListener("click", clearCompletedTodos);

  searchInput.addEventListener("input", () => {
    currentSearch = searchInput.value.trim();
    render();
  });

  priorityFilterSelect.addEventListener("change", () => {
    priorityFilter = priorityFilterSelect.value;
    render();
  });

  categoryFilterSelect.addEventListener("change", () => {
    categoryFilter = categoryFilterSelect.value;
    render();
  });

  sortSelect.addEventListener("change", () => {
    currentSort = sortSelect.value;
    render();
  });

  document.querySelectorAll(".filters__btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      currentFilter = btn.dataset.filter;
      document.querySelectorAll(".filters__btn").forEach((b) => {
        const active = b === btn;
        b.classList.toggle("is-active", active);
        b.setAttribute("aria-selected", String(active));
      });
      render();
    });
  });

  initTheme();
  load();
  render();
})();
