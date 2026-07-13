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

  const $ = (id) => document.getElementById(id);
  const form = $("todo-form");
  const input = $("todo-input");
  const prioritySelect = $("todo-priority");
  const categorySelect = $("todo-category");
  const dueInput = $("todo-due");
  const list = $("todo-list");
  const emptyState = $("empty-state");
  const itemsLeft = $("items-left");
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

  function load() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      const parsed = raw ? JSON.parse(raw) : [];
      todos = parsed.map((t) => ({
        id: t.id,
        text: t.text,
        completed: !!t.completed,
        priority: PRIORITIES.includes(t.priority) ? t.priority : "medium",
        category: typeof t.category === "string" && t.category ? t.category : "general",
        dueDate: typeof t.dueDate === "string" ? t.dueDate : "",
        createdAt: typeof t.createdAt === "number" ? t.createdAt : Date.now(),
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
      completed: false,
      priority: prioritySelect.value,
      category: categorySelect.value,
      dueDate: dueInput.value || "",
      createdAt: Date.now(),
    });
    save();
    render();
  }

  function toggleTodo(id) {
    const todo = todos.find((t) => t.id === id);
    if (todo) {
      todo.completed = !todo.completed;
      save();
      render();
    }
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

  function render() {
    list.innerHTML = "";
    const visible = filtered();

    visible.forEach((todo) => {
      const item = template.content.firstElementChild.cloneNode(true);
      item.dataset.id = todo.id;
      item.classList.toggle("is-completed", todo.completed);
      item.classList.toggle("is-overdue", isOverdue(todo));

      const checkbox = item.querySelector(".todo-item__checkbox");
      checkbox.checked = todo.completed;
      checkbox.addEventListener("change", () => toggleTodo(todo.id));

      item.querySelector(".todo-item__text").textContent = todo.text;

      const priorityBadge = item.querySelector(".todo-item__badge--priority");
      priorityBadge.textContent = todo.priority;
      priorityBadge.classList.add("is-" + todo.priority);

      item.querySelector(".todo-item__badge--category").textContent = todo.category;

      const dueBadge = item.querySelector(".todo-item__badge--due");
      if (todo.dueDate) {
        dueBadge.textContent = formatDueDate(todo.dueDate);
        dueBadge.classList.toggle("is-overdue", isOverdue(todo));
      } else {
        dueBadge.remove();
      }

      item
        .querySelector(".todo-item__delete")
        .addEventListener("click", () => deleteTodo(todo.id));

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
