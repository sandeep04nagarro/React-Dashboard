(function () {
  "use strict";

  const STORAGE_KEY = "todo-app:todos";
  const THEME_KEY = "todo-app:theme";
  let todos = [];
  let currentFilter = "all";

  const $ = (id) => document.getElementById(id);
  const form = $("todo-form");
  const input = $("todo-input");
  const list = $("todo-list");
  const emptyState = $("empty-state");
  const itemsLeft = $("items-left");
  const clearCompleted = $("clear-completed");
  const template = $("todo-item-template");
  const themeToggle = $("theme-toggle");

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
        id: t.id || uid(),
        text: t.text || "",
        notes: typeof t.notes === "string" ? t.notes : "",
        completed: !!t.completed,
        createdAt: t.createdAt || nowTs(),
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
      createdAt: nowTs(),
      completedAt: null,
    });
    save();
    render();
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

  function editTodo(id, text, notes) {
    const todo = todos.find((t) => t.id === id);
    if (!todo) return;
    todo.text = text.trim();
    if (typeof notes === "string") todo.notes = notes.trim();
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

  function filtered() {
    if (currentFilter === "active") return todos.filter((t) => !t.completed);
    if (currentFilter === "completed") return todos.filter((t) => t.completed);
    return todos;
  }

  function startEdit(item, todo) {
    const editEl = item.querySelector(".todo-item__edit");
    const notesEl = item.querySelector(".todo-item__notes");
    item.classList.add("is-editing");
    editEl.querySelector(".todo-item__edit-input").value = todo.text;
    editEl.querySelector(".todo-item__edit-notes").value = todo.notes || "";
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
    editTodo(todo.id, text, notes);
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

      const checkbox = item.querySelector(".todo-item__checkbox");
      checkbox.checked = todo.completed;
      checkbox.addEventListener("change", () => toggleTodo(todo.id));

      item.querySelector(".todo-item__text").textContent = todo.text;

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
    emptyState.textContent =
      todos.length === 0
        ? "No todos yet. Add one above!"
        : "No " + currentFilter + " todos.";

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
    input.focus();
  });

  clearCompleted.addEventListener("click", clearCompletedTodos);

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
