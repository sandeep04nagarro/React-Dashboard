(function () {
  "use strict";

  const STORAGE_KEY = "todo-app:todos";
  const THEME_KEY = "todo-app:theme";
  const SNOOZE_KEY = "todo-app:snoozed";
  const FIRED_KEY = "todo-app:fired";
  let todos = [];
  let currentFilter = "all";
  let currentSearch = "";
  let priorityFilter = "all";
  let categoryFilter = "all";
  let currentSort = "created";
  let snoozedReminders = {};
  let firedReminders = {};

  const PRIORITIES = ["low", "medium", "high"];
  const PRIORITY_RANK = { low: 0, medium: 1, high: 2 };

  const RECURRENCES = ["daily", "weekly", "monthly", "custom"];
  const RECURRENCE_LABEL = {
    daily: "Daily",
    weekly: "Weekly",
    monthly: "Monthly",
    custom: "Custom",
  };

  const REMINDER_OFFSETS = [0, 5, 15, 60, 1440];
  const REMINDER_LABELS = {
    0: "At due time",
    5: "5 min before",
    15: "15 min before",
    60: "1 hour before",
    1440: "1 day before",
  };

  function recurrenceIntervalDays(todo) {
    if (todo.recurrence === "daily") return 1;
    if (todo.recurrence === "weekly") return 7;
    if (todo.recurrence === "monthly") return 30;
    if (todo.recurrence === "custom") {
      const n = parseInt(todo.recurrenceInterval, 10);
      return Number.isFinite(n) && n > 0 ? n : 1;
    }
    return 0;
  }

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
  const recurrenceSelect = $("todo-recurrence");
  const recurrenceCustom = $("todo-recurrence-custom");
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
  const notifPermissionBtn = $("notification-permission");
  const reminderCheckboxes = [
    $("reminder-at-due"),
    $("reminder-5min"),
    $("reminder-15min"),
    $("reminder-1hour"),
    $("reminder-1day"),
  ];
  const reminderCustomInput = $("reminder-custom-minutes");

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

  function escapeHtml(str) {
    const div = document.createElement("div");
    div.appendChild(document.createTextNode(str));
    return div.innerHTML;
  }

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
        recurrence: RECURRENCES.includes(t.recurrence) ? t.recurrence : "",
        recurrenceInterval: Number.isFinite(t.recurrenceInterval)
          ? t.recurrenceInterval
          : 1,
        recurrenceAnchor:
          typeof t.recurrenceAnchor === "number" && t.recurrenceAnchor
            ? t.recurrenceAnchor
            : null,
        reminders: Array.isArray(t.reminders) ? t.reminders.filter((r) => typeof r === "number" && r >= 0) : [],
        favorite: !!t.favorite,
        pinned: !!t.pinned,
        manualOrder: Number.isFinite(t.manualOrder) ? t.manualOrder : null,
        createdAt: typeof t.createdAt === "number" ? t.createdAt : Date.now(),
        completedAt: t.completed ? t.completedAt || null : null,
        subtasks: Array.isArray(t.subtasks)
          ? t.subtasks.filter((s) => s && typeof s.id === "string" && typeof s.text === "string").map((s) => ({
              id: s.id,
              text: s.text,
              completed: !!s.completed,
            }))
          : [],
        dependsOn: Array.isArray(t.dependsOn)
          ? t.dependsOn.filter((d) => typeof d === "string")
          : [],
      }));
    } catch (e) {
      todos = [];
    }
  }

  function save() {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(todos));
  }

  function loadSnoozed() {
    try {
      const raw = localStorage.getItem(SNOOZE_KEY);
      snoozedReminders = raw ? JSON.parse(raw) : {};
    } catch (e) {
      snoozedReminders = {};
    }
  }

  function saveSnoozed() {
    try {
      localStorage.setItem(SNOOZE_KEY, JSON.stringify(snoozedReminders));
    } catch (e) {}
  }

  function loadFired() {
    try {
      const raw = localStorage.getItem(FIRED_KEY);
      firedReminders = raw ? JSON.parse(raw) : {};
    } catch (e) {
      firedReminders = {};
    }
  }

  function saveFired() {
    try {
      localStorage.setItem(FIRED_KEY, JSON.stringify(firedReminders));
    } catch (e) {}
  }

  function snoozeKey(todoId, offsetMin) {
    return todoId + ":" + offsetMin;
  }

  function snoozeReminder(todoId, offsetMin, snoozeMinutes) {
    const key = snoozeKey(todoId, offsetMin);
    snoozedReminders[key] = Date.now() + snoozeMinutes * 60000;
    saveSnoozed();
  }

  function clearFiredForTodo(todoId) {
    Object.keys(firedReminders).forEach((k) => {
      if (k.startsWith(todoId + ":")) delete firedReminders[k];
    });
    saveFired();
  }

  function isSnoozed(key) {
    return snoozedReminders[key] && snoozedReminders[key] > Date.now();
  }

  function requestNotificationPermission() {
    if (!("Notification" in window)) {
      alert("Your browser does not support notifications.");
      return;
    }
    Notification.requestPermission().then((permission) => {
      updatePermissionUI(permission);
    });
  }

  function updatePermissionUI(permission) {
    if (!notifPermissionBtn) return;
    if (!("Notification" in window)) {
      notifPermissionBtn.classList.add("is-hidden");
      return;
    }
    if (permission === "granted") {
      notifPermissionBtn.classList.add("is-granted");
      notifPermissionBtn.querySelector(".notification-btn__label").textContent = "Notifications Enabled";
    } else if (permission === "denied") {
      notifPermissionBtn.classList.add("is-denied");
      notifPermissionBtn.querySelector(".notification-btn__label").textContent = "Notifications Blocked";
    } else {
      notifPermissionBtn.classList.remove("is-granted", "is-denied");
      notifPermissionBtn.querySelector(".notification-btn__label").textContent = "Enable Notifications";
    }
  }

  function sendNotification(todo, offsetMin) {
    if (!("Notification" in window) || Notification.permission !== "granted") return;

    let dueTimeStr = "";
    if (todo.dueDate) {
      const dueDate = new Date(todo.dueDate + "T00:00:00");
      dueTimeStr = dueDate.toLocaleDateString(undefined, { month: "short", day: "numeric" });
    }

    const offsetLabel = REMINDER_LABELS[offsetMin] || "in " + offsetMin + " min";
    const title = "🔔 " + todo.text;
    const body = offsetMin === 0
      ? "This task is now due" + (dueTimeStr ? " (" + dueTimeStr + ")" : "")
      : "Due " + offsetLabel + (dueTimeStr ? " (" + dueTimeStr + ")" : "");

    const notif = new Notification(title, {
      body: body,
      icon: "data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'><text y='.9em' font-size='90'>🔔</text></svg>",
      tag: "todo-" + todo.id + "-" + offsetMin,
      renotify: true,
    });

    notif.onclick = () => {
      window.focus();
      notif.close();
    };

    setTimeout(() => notif.close(), 15000);
  }

  function checkReminders() {
    if (!("Notification" in window) || Notification.permission !== "granted") return;

    const now = Date.now();
    todos.forEach((todo) => {
      if (todo.completed || !todo.dueDate || !todo.reminders || !todo.reminders.length) return;

      const dueTs = new Date(todo.dueDate + "T23:59:59").getTime();

      todo.reminders.forEach((offsetMin) => {
        const key = snoozeKey(todo.id, offsetMin);
        const fireAt = dueTs - offsetMin * 60000;

        if (now >= fireAt && !firedReminders[key] && !isSnoozed(key)) {
          firedReminders[key] = now;
          saveFired();
          sendNotification(todo, offsetMin);
        }
      });
    });
  }

  function collectReminders() {
    const reminders = [];
    reminderCheckboxes.forEach((cb) => {
      if (cb.checked) reminders.push(parseInt(cb.value, 10));
    });
    const customMin = parseInt(reminderCustomInput.value, 10);
    if (reminderCustomInput.value.trim() && Number.isFinite(customMin) && customMin > 0) {
      reminders.push(customMin);
    }
    return reminders.sort((a, b) => a - b);
  }

  function resetReminderForm() {
    reminderCheckboxes.forEach((cb) => { cb.checked = false; });
    if (reminderCheckboxes[2]) reminderCheckboxes[2].checked = true;
    reminderCustomInput.value = "";
  }

  function addTodo(text) {
    const maxOrder = todos.reduce((max, t) => Math.max(max, t.manualOrder || 0), 0);
    todos.unshift({
      id: uid(),
      text,
      notes: "",
      completed: false,
      priority: prioritySelect.value,
      category: categorySelect.value,
      color: colorSelect.value || "",
      dueDate: dueInput.value || "",
      recurrence: recurrenceSelect.value || "",
      recurrenceInterval: parseRecurrenceInterval(),
      recurrenceAnchor: recurrenceSelect.value ? Date.now() : null,
      reminders: collectReminders(),
      favorite: false,
      pinned: false,
      manualOrder: maxOrder + 1,
      createdAt: Date.now(),
      completedAt: null,
      subtasks: [],
      dependsOn: [],
    });
    save();
    render();
  }

  function parseRecurrenceInterval() {
    if (recurrenceSelect.value !== "custom") return 1;
    const n = parseInt(recurrenceCustom.value, 10);
    return Number.isFinite(n) && n > 0 ? n : 1;
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
    if (!todo) return;
    if (!todo.completed && !canCompleteTodo(todo)) {
      const unmet = getUnmetDependencies(todo);
      const names = unmet.map((d) => d.text).join(", ");
      alert("Cannot complete: blocked by " + names);
      return;
    }
    todo.completed = !todo.completed;
    todo.completedAt = todo.completed ? nowTs() : null;
    if (todo.completed) clearFiredForTodo(todo.id);
    save();
    if (todo.completed) processRecurrences();
    render();
  }

  // color is an optional label value ("" or one of COLOR_MAP keys); invalid values fall back to "".
  function editTodo(id, text, notes, color, recurrence, recurrenceInterval, recurrenceAnchor, reminders, dependsOn) {
    const todo = todos.find((t) => t.id === id);
    if (!todo) return;
    todo.text = text.trim();
    if (typeof notes === "string") todo.notes = notes.trim();
    if (typeof color === "string") todo.color = COLOR_MAP[color] ? color : "";
    if (typeof recurrence === "string") todo.recurrence = RECURRENCES.includes(recurrence) ? recurrence : "";
    if (Number.isFinite(recurrenceInterval) && recurrenceInterval > 0) todo.recurrenceInterval = recurrenceInterval;
    if (typeof recurrenceAnchor === "number" || recurrenceAnchor === null) todo.recurrenceAnchor = recurrenceAnchor;
    if (Array.isArray(reminders)) todo.reminders = reminders;
    if (Array.isArray(dependsOn)) todo.dependsOn = dependsOn;
    save();
    render();
  }

  function duplicateTodo(id) {
    const todo = todos.find((t) => t.id === id);
    if (!todo) return;
    const maxOrder = todos.reduce((max, t) => Math.max(max, t.manualOrder || 0), 0);
    const copy = {
      id: uid(),
      text: todo.text,
      notes: todo.notes || "",
      completed: false,
      favorite: !!todo.favorite,
      pinned: !!todo.pinned,
      color: todo.color || "",
      recurrence: todo.recurrence || "",
      recurrenceInterval: todo.recurrenceInterval || 1,
      recurrenceAnchor: todo.recurrenceAnchor || null,
      reminders: Array.isArray(todo.reminders) ? todo.reminders.slice() : [],
      manualOrder: maxOrder + 1,
      createdAt: nowTs(),
      completedAt: null,
      subtasks: [],
      dependsOn: [],
    };
    const idx = todos.findIndex((t) => t.id === id);
    todos.splice(idx, 0, copy);
    save();
    render();
  }

  function deleteTodo(id) {
    todos = todos.filter((t) => t.id !== id);
    todos.forEach((t) => {
      if (t.dependsOn) {
        t.dependsOn = t.dependsOn.filter((d) => d !== id);
      }
    });
    save();
    render();
  }

  function clearCompletedTodos() {
    todos = todos.filter((t) => !t.completed);
    save();
    render();
  }

  function nextOccurrence(anchor, intervalDays) {
    const next = new Date(anchor);
    next.setDate(next.getDate() + intervalDays);
    return next.getTime();
  }

  function spawnRecurrenceAt(original, anchor) {
    const interval = recurrenceIntervalDays(original);
    if (!interval) return;
    const maxOrder = todos.reduce((max, t) => Math.max(max, t.manualOrder || 0), 0);
    const clone = {
      id: uid(),
      text: original.text,
      notes: original.notes || "",
      completed: false,
      priority: original.priority,
      category: original.category,
      color: original.color || "",
      dueDate: original.dueDate || "",
      recurrence: original.recurrence,
      recurrenceInterval: original.recurrenceInterval || interval,
      recurrenceAnchor: anchor,
      reminders: Array.isArray(original.reminders) ? original.reminders.slice() : [],
      favorite: !!original.favorite,
      pinned: !!original.pinned,
      manualOrder: maxOrder + 1,
      createdAt: Date.now(),
      completedAt: null,
      subtasks: [],
      dependsOn: [],
    };
    todos.unshift(clone);
  }

  function processRecurrences() {
    let changed = false;
    const now = Date.now();
    todos.forEach((todo) => {
      if (!todo.recurrence) return;
      let anchor = todo.recurrenceAnchor || todo.createdAt || now;
      const interval = recurrenceIntervalDays(todo);
      if (!interval) return;
      while (nextOccurrence(anchor, interval) <= now) {
        anchor = nextOccurrence(anchor, interval);
      }
      if (anchor !== (todo.recurrenceAnchor || todo.createdAt || now)) {
        todo.recurrenceAnchor = anchor;
        spawnRecurrenceAt(todo, anchor);
        changed = true;
      }
    });
    if (changed) save();
    return changed;
  }

  function isOverdue(todo) {
    if (!todo.dueDate || todo.completed) return false;
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return new Date(todo.dueDate + "T00:00:00") < today;
  }

  function normalizeManualOrder() {
    const ordered = todos.slice().sort((a, b) => (a.manualOrder || 0) - (b.manualOrder || 0));
    ordered.forEach((t, i) => {
      t.manualOrder = i;
    });
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
      case "manual":
        result.sort((a, b) => (a.manualOrder || 0) - (b.manualOrder || 0));
        break;
    }

    if (currentSort !== "manual") {
      result.sort((a, b) => (b.pinned ? 1 : 0) - (a.pinned ? 1 : 0));
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

  function startEdit(item, todo) {
    const editEl = item.querySelector(".todo-item__edit");
    const notesEl = item.querySelector(".todo-item__notes");
    item.classList.add("is-editing");
    editEl.querySelector(".todo-item__edit-input").value = todo.text;
    editEl.querySelector(".todo-item__edit-notes").value = todo.notes || "";
    editEl.querySelector(".todo-item__edit-color").value = todo.color || "";
    editEl.querySelector(".todo-item__edit-recurrence").value = todo.recurrence || "";
    editEl.querySelector(".todo-item__edit-recurrence-custom").value = todo.recurrenceInterval || 1;
    const reminders = todo.reminders || [];
    editEl.querySelectorAll(".todo-item__edit-reminder").forEach((cb) => {
      cb.checked = reminders.includes(parseInt(cb.value, 10));
    });
    const customEl = editEl.querySelector(".todo-item__edit-reminder-custom");
    if (customEl) {
      const customReminder = reminders.find((r) => !REMINDER_OFFSETS.includes(r));
      customEl.value = customReminder || "";
    }

    const depSelect = editEl.querySelector(".todo-item__edit-depends");
    depSelect.innerHTML = '<option value="">No dependencies</option>';
    todos.forEach((t) => {
      if (t.id === todo.id) return;
      const opt = document.createElement("option");
      opt.value = t.id;
      opt.textContent = t.text;
      if (todo.dependsOn && todo.dependsOn.includes(t.id)) opt.selected = true;
      depSelect.appendChild(opt);
    });

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

  function collectEditReminders(item) {
    const reminders = [];
    item.querySelectorAll(".todo-item__edit-reminder").forEach((cb) => {
      if (cb.checked) reminders.push(parseInt(cb.value, 10));
    });
    const customEl = item.querySelector(".todo-item__edit-reminder-custom");
    if (customEl) {
      const customMin = parseInt(customEl.value, 10);
      if (customEl.value.trim() && Number.isFinite(customMin) && customMin > 0) {
        reminders.push(customMin);
      }
    }
    return reminders.sort((a, b) => a - b);
  }

  function saveEdit(item, todo) {
    const text = item.querySelector(".todo-item__edit-input").value.trim();
    if (!text) return;
    const notes = item.querySelector(".todo-item__edit-notes").value;
    const color = item.querySelector(".todo-item__edit-color").value;
    const recurrence = item.querySelector(".todo-item__edit-recurrence").value;
    const recurrenceCustom = item.querySelector(".todo-item__edit-recurrence-custom");
    const interval = parseInt(recurrenceCustom.value, 10);
    const recurrenceInterval = Number.isFinite(interval) && interval > 0 ? interval : 1;
    const recurrenceAnchor = recurrence ? (todo.recurrenceAnchor || todo.createdAt || Date.now()) : null;
    const reminders = collectEditReminders(item);
    const depSelect = item.querySelector(".todo-item__edit-depends");
    const dependsOn = depSelect
      ? Array.from(depSelect.selectedOptions).map((o) => o.value).filter(Boolean)
      : [];
    editTodo(todo.id, text, notes, color, recurrence, recurrenceInterval, recurrenceAnchor, reminders, dependsOn);
  }

  function toggleNotes(item, todo) {
    item
      .querySelector(".todo-item__notes")
      .classList.toggle("is-hidden");
  }

  function isDependencyMet(todoId, excludeId) {
    const todo = todos.find((t) => t.id === todoId);
    if (!todo || !todo.dependsOn || !todo.dependsOn.length) return true;
    return todo.dependsOn.every((depId) => {
      if (depId === excludeId) return true;
      const dep = todos.find((t) => t.id === depId);
      return dep && dep.completed;
    });
  }

  function getUnmetDependencies(todo) {
    if (!todo.dependsOn || !todo.dependsOn.length) return [];
    return todo.dependsOn
      .map((depId) => todos.find((t) => t.id === depId))
      .filter((dep) => dep && !dep.completed);
  }

  function addSubtask(todoId, text) {
    const todo = todos.find((t) => t.id === todoId);
    if (!todo) return;
    todo.subtasks.push({ id: uid(), text: text.trim(), completed: false });
    save();
    render();
  }

  function toggleSubtask(todoId, subtaskId) {
    const todo = todos.find((t) => t.id === todoId);
    if (!todo) return;
    const st = todo.subtasks.find((s) => s.id === subtaskId);
    if (!st) return;
    st.completed = !st.completed;
    if (todo.subtasks.length > 0 && todo.subtasks.every((s) => s.completed)) {
      todo.completed = true;
      todo.completedAt = nowTs();
      clearFiredForTodo(todo.id);
      processRecurrences();
    } else if (todo.completed && !todo.subtasks.every((s) => s.completed)) {
      todo.completed = false;
      todo.completedAt = null;
    }
    save();
    render();
  }

  function deleteSubtask(todoId, subtaskId) {
    const todo = todos.find((t) => t.id === todoId);
    if (!todo) return;
    todo.subtasks = todo.subtasks.filter((s) => s.id !== subtaskId);
    if (todo.subtasks.length === 0) {
      // subtasks cleared, keep parent as-is
    } else if (todo.subtasks.every((s) => s.completed)) {
      todo.completed = true;
      todo.completedAt = nowTs();
      clearFiredForTodo(todo.id);
      processRecurrences();
    }
    save();
    render();
  }

  function getSubtaskProgress(todo) {
    if (!todo.subtasks || todo.subtasks.length === 0) return null;
    const total = todo.subtasks.length;
    const done = todo.subtasks.filter((s) => s.completed).length;
    return { done, total, percent: Math.round((done / total) * 100) };
  }

  function canCompleteTodo(todo) {
    return isDependencyMet(todo.id);
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

      const recurrenceBadge = item.querySelector(".todo-item__badge--recurrence");
      if (todo.recurrence) {
        const interval = recurrenceIntervalDays(todo);
        const label =
          todo.recurrence === "custom"
            ? "Every " + interval + (interval === 1 ? " day" : " days")
            : RECURRENCE_LABEL[todo.recurrence];
        recurrenceBadge.textContent = "↻ " + label;
      } else {
        recurrenceBadge.remove();
      }

      const reminderBadge = item.querySelector(".todo-item__badge--reminder");
      if (todo.reminders && todo.reminders.length && todo.dueDate) {
        const hasSnoozed = todo.reminders.some((r) => isSnoozed(snoozeKey(todo.id, r)));
        reminderBadge.textContent = hasSnoozed ? "🔕 Reminder snoozed" : "🔔 " + todo.reminders.length + " reminder" + (todo.reminders.length === 1 ? "" : "s");
        reminderBadge.classList.toggle("is-snoozed", hasSnoozed);
      } else {
        reminderBadge.remove();
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

      const subtaskContainer = item.querySelector(".todo-item__subtasks");
      const subtaskList = item.querySelector(".todo-item__subtask-list");
      const subtaskProgress = item.querySelector(".subtask-progress");
      const subtaskAddForm = item.querySelector(".todo-item__subtask-add");
      const subtaskInput = item.querySelector(".todo-item__subtask-input");
      const subtaskToggleBtn = item.querySelector(".todo-item__subtask-toggle");

      const hasSubtasks = todo.subtasks && todo.subtasks.length > 0;
      const isExpanded = subtaskContainer.dataset.expanded === "true";

      if (hasSubtasks) {
        const progress = getSubtaskProgress(todo);
        subtaskToggleBtn.querySelector(".subtask-toggle__label").textContent =
          "Subtasks (" + progress.done + "/" + progress.total + ")";
      } else {
        subtaskToggleBtn.querySelector(".subtask-toggle__label").textContent = "Subtasks";
      }

      if (hasSubtasks || isExpanded) {
        subtaskList.innerHTML = "";
        const progress = getSubtaskProgress(todo);
        if (progress) {
          subtaskProgress.classList.remove("is-hidden");
          subtaskProgress.querySelector(".subtask-progress__text").textContent =
            progress.done + "/" + progress.total + " subtasks completed";
          subtaskProgress.querySelector(".subtask-progress__fill").style.width = progress.percent + "%";
        } else {
          subtaskProgress.classList.add("is-hidden");
        }

        todo.subtasks.forEach((st) => {
          const li = document.createElement("li");
          li.className = "subtask-item" + (st.completed ? " is-completed" : "");
          li.innerHTML =
            '<label class="subtask-item__label">' +
              '<input type="checkbox" class="subtask-item__checkbox" ' + (st.completed ? "checked" : "") + ' />' +
              '<span class="subtask-item__text">' + escapeHtml(st.text) + '</span>' +
            '</label>' +
            '<button type="button" class="subtask-item__delete" title="Remove subtask">&times;</button>';
          li.querySelector(".subtask-item__checkbox").addEventListener("change", () => toggleSubtask(todo.id, st.id));
          li.querySelector(".subtask-item__delete").addEventListener("click", () => deleteSubtask(todo.id, st.id));
          subtaskList.appendChild(li);
        });
      }

      subtaskToggleBtn.addEventListener("click", () => {
        const expanded = subtaskContainer.dataset.expanded === "true";
        if (expanded) {
          subtaskContainer.dataset.expanded = "false";
          subtaskToggleBtn.classList.remove("is-expanded");
        } else {
          subtaskContainer.dataset.expanded = "true";
          subtaskToggleBtn.classList.add("is-expanded");
        }
      });

      subtaskAddForm.addEventListener("submit", (e) => {
        e.preventDefault();
        const val = subtaskInput.value.trim();
        if (!val) return;
        addSubtask(todo.id, val);
        subtaskInput.value = "";
      });

      const depContainer = item.querySelector(".todo-item__dependencies");
      const unmetDeps = getUnmetDependencies(todo);
      if (unmetDeps.length > 0) {
        depContainer.classList.remove("is-hidden");
        depContainer.innerHTML =
          '<span class="dep-badge dep-badge--blocked" title="Blocked by incomplete tasks">⛔ Blocked by: ' +
          unmetDeps.map((d) => escapeHtml(d.text)).join(", ") +
          '</span>';
      } else if (todo.dependsOn && todo.dependsOn.length > 0) {
        depContainer.classList.remove("is-hidden");
        depContainer.innerHTML =
          '<span class="dep-badge dep-badge--met" title="All dependencies met">✅ Dependencies met</span>';
      } else {
        depContainer.classList.add("is-hidden");
      }

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

      const dragHandle = item.querySelector(".todo-item__drag-handle");
      if (currentSort === "manual") {
        dragHandle.addEventListener("dragstart", (e) => {
          e.dataTransfer.effectAllowed = "move";
          e.dataTransfer.setData("text/plain", todo.id);
          item.classList.add("dragging");
          setTimeout(() => item.classList.add("dragging"), 0);
        });
        dragHandle.addEventListener("dragend", () => {
          item.classList.remove("dragging");
          document.querySelectorAll(".todo-item.drag-above, .todo-item.drag-below").forEach((el) => {
            el.classList.remove("drag-above", "drag-below");
          });
          list.classList.remove("drag-over");
        });
        item.addEventListener("dragover", (e) => {
          e.preventDefault();
          e.dataTransfer.dropEffect = "move";
          const rect = item.getBoundingClientRect();
          const midY = rect.top + rect.height / 2;
          document.querySelectorAll(".todo-item.drag-above, .todo-item.drag-below").forEach((el) => {
            if (el !== item) el.classList.remove("drag-above", "drag-below");
          });
          if (e.clientY < midY) {
            item.classList.add("drag-above");
            item.classList.remove("drag-below");
          } else {
            item.classList.add("drag-below");
            item.classList.remove("drag-above");
          }
        });
        item.addEventListener("dragleave", () => {
          item.classList.remove("drag-above", "drag-below");
        });
        item.addEventListener("drop", (e) => {
          e.preventDefault();
          const draggedId = e.dataTransfer.getData("text/plain");
          if (!draggedId || draggedId === todo.id) return;
          const draggedTodo = todos.find((t) => t.id === draggedId);
          const targetTodo = todos.find((t) => t.id === todo.id);
          if (!draggedTodo || !targetTodo) return;
          const rect = item.getBoundingClientRect();
          const midY = rect.top + rect.height / 2;
          const insertBefore = e.clientY < midY;
          const targetOrder = targetTodo.manualOrder || 0;
          const draggedOrder = draggedTodo.manualOrder || 0;
          if (insertBefore) {
            draggedTodo.manualOrder = targetOrder - 0.5;
          } else {
            draggedTodo.manualOrder = targetOrder + 0.5;
          }
          normalizeManualOrder();
          save();
          render();
        });
        list.classList.add("drag-over");
      } else {
        dragHandle.setAttribute("draggable", "false");
        dragHandle.style.cursor = "default";
        dragHandle.style.opacity = "0.3";
      }

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
    recurrenceSelect.value = "";
    recurrenceCustom.value = "1";
    syncRecurrenceCustom();
    resetReminderForm();
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

  function syncRecurrenceCustom() {
    const show = recurrenceSelect.value === "custom";
    recurrenceCustom.classList.toggle("is-hidden", !show);
  }
  recurrenceSelect.addEventListener("change", syncRecurrenceCustom);
  syncRecurrenceCustom();

  notifPermissionBtn.addEventListener("click", requestNotificationPermission);

  let snoozeOpenId = null;
  document.addEventListener("click", (e) => {
    const wrap = e.target.closest(".todo-item__snooze-wrap");
    if (!wrap && snoozeOpenId) {
      document.querySelectorAll(".todo-item__snooze-dropdown").forEach((d) => d.classList.add("is-hidden"));
      snoozeOpenId = null;
    }
  });

  function handleSnooze(todoId, offsetMin, snoozeMinutes) {
    snoozeReminder(todoId, offsetMin, snoozeMinutes);
    const snoozedUntil = Date.now() + snoozeMinutes * 60000;
    const untilStr = new Date(snoozedUntil).toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" });
    if ("Notification" in window && Notification.permission === "granted") {
      new Notification("🔕 Reminder Snoozed", {
        body: "Reminder snoozed until " + untilStr,
        tag: "snooze-" + todoId + "-" + offsetMin,
      });
    }
    render();
  }

  list.addEventListener("click", (e) => {
    const snoozeBtn = e.target.closest(".todo-item__snooze");
    if (snoozeBtn) {
      e.stopPropagation();
      const item = snoozeBtn.closest(".todo-item");
      if (!item) return;
      const todoId = item.dataset.id;
      const dropdown = item.querySelector(".todo-item__snooze-dropdown");
      const isVisible = !dropdown.classList.contains("is-hidden");
      document.querySelectorAll(".todo-item__snooze-dropdown").forEach((d) => d.classList.add("is-hidden"));
      if (!isVisible) {
        dropdown.classList.remove("is-hidden");
        snoozeOpenId = todoId;
      } else {
        snoozeOpenId = null;
      }
      return;
    }

    const snoozeOption = e.target.closest(".todo-item__snooze-option");
    if (snoozeOption) {
      e.stopPropagation();
      const item = snoozeOption.closest(".todo-item");
      if (!item) return;
      const todoId = item.dataset.id;
      const todo = todos.find((t) => t.id === todoId);
      const snoozeMin = parseInt(snoozeOption.dataset.snooze, 10);
      if (!todo || !snoozeMin) return;
      todo.reminders.forEach((r) => handleSnooze(todoId, r, snoozeMin));
      document.querySelectorAll(".todo-item__snooze-dropdown").forEach((d) => d.classList.add("is-hidden"));
      snoozeOpenId = null;
      return;
    }
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
  loadSnoozed();
  loadFired();
  processRecurrences();
  render();
  if ("Notification" in window) {
    updatePermissionUI(Notification.permission);
  }
  checkReminders();
  setInterval(checkReminders, 30000);

  // --- Command Palette ---
  const cmdOverlay = $("command-palette-overlay");
  const cmdInput = $("command-palette-input");
  const cmdList = $("command-palette-list");
  let cmdActiveIndex = 0;

  const COMMANDS = [
    { id: "add-task", icon: "＋", label: "Add Task", shortcut: "", action() { input.focus(); input.scrollIntoView({ behavior: "smooth", block: "center" }); } },
    { id: "show-all", icon: "📋", label: "Show All Tasks", shortcut: "", action() { setFilter("all"); } },
    { id: "show-active", icon: "🔵", label: "Show Active", shortcut: "", action() { setFilter("active"); } },
    { id: "show-completed", icon: "✅", label: "Show Completed", shortcut: "", action() { setFilter("completed"); } },
    { id: "show-favorites", icon: "⭐", label: "Show Favorites", shortcut: "", action() { setFilter("favorites"); } },
    { id: "show-pinned", icon: "📌", label: "Show Pinned", shortcut: "", action() { setFilter("pinned"); } },
    { id: "toggle-theme", icon: "🌓", label: "Toggle Dark Mode", shortcut: "Ctrl+Shift+D", action() { themeToggle.click(); } },
    { id: "clear-search", icon: "🔍", label: "Clear Search", shortcut: "", action() { searchInput.value = ""; currentSearch = ""; render(); } },
    { id: "clear-completed", icon: "🗑", label: "Clear Completed Tasks", shortcut: "", action() { clearCompletedTodos(); } },
    { id: "open-dashboard", icon: "📊", label: "Open Dashboard", shortcut: "", action() { window.location.href = "dashboard.html"; } },
    { id: "sort-newest", icon: "🕐", label: "Sort: Newest First", shortcut: "", action() { setSort("created"); } },
    { id: "sort-priority", icon: "⚡", label: "Sort: Priority", shortcut: "", action() { setSort("priority"); } },
    { id: "sort-due", icon: "📅", label: "Sort: Due Date", shortcut: "", action() { setSort("due"); } },
    { id: "sort-alpha", icon: "🔤", label: "Sort: A-Z", shortcut: "", action() { setSort("alpha"); } },
    { id: "enable-notifications", icon: "🔔", label: "Enable Notifications", shortcut: "", action() { requestNotificationPermission(); } },
  ];

  function setFilter(filter) {
    currentFilter = filter;
    document.querySelectorAll(".filters__btn").forEach((b) => {
      const active = b.dataset.filter === filter;
      b.classList.toggle("is-active", active);
      b.setAttribute("aria-selected", String(active));
    });
    render();
  }

  function setSort(sort) {
    currentSort = sort;
    sortSelect.value = sort;
    render();
  }

  function openCmdPalette() {
    cmdOverlay.classList.remove("is-hidden");
    cmdInput.value = "";
    cmdActiveIndex = 0;
    renderCmdList();
    cmdInput.focus();
  }

  function closeCmdPalette() {
    cmdOverlay.classList.add("is-hidden");
    cmdInput.value = "";
  }

  function renderCmdList() {
    const query = cmdInput.value.trim().toLowerCase();
    const matches = COMMANDS.filter((c) => c.label.toLowerCase().includes(query));

    cmdList.innerHTML = "";
    if (matches.length === 0) {
      const li = document.createElement("li");
      li.className = "command-palette__empty";
      li.textContent = "No matching commands";
      cmdList.appendChild(li);
      return;
    }

    if (cmdActiveIndex >= matches.length) cmdActiveIndex = 0;

    matches.forEach((cmd, i) => {
      const li = document.createElement("li");
      li.className = "command-palette__item" + (i === cmdActiveIndex ? " is-active" : "");
      li.setAttribute("role", "option");
      li.dataset.cmdId = cmd.id;

      let html = '<span class="command-palette__item-icon" aria-hidden="true">' + cmd.icon + '</span>';
      html += '<span class="command-palette__item-label">' + escapeHtml(cmd.label) + '</span>';
      if (cmd.shortcut) {
        html += '<span class="command-palette__item-shortcut">' + cmd.shortcut + '</span>';
      }
      li.innerHTML = html;

      li.addEventListener("click", () => {
        cmd.action();
        closeCmdPalette();
      });
      li.addEventListener("mouseenter", () => {
        cmdActiveIndex = i;
        highlightCmdItem();
      });

      cmdList.appendChild(li);
    });
  }

  function highlightCmdItem() {
    const items = cmdList.querySelectorAll(".command-palette__item");
    items.forEach((el, i) => el.classList.toggle("is-active", i === cmdActiveIndex));
  }

  function executeActiveCmd() {
    const items = cmdList.querySelectorAll(".command-palette__item");
    if (items[cmdActiveIndex]) {
      items[cmdActiveIndex].click();
    }
  }

  cmdInput.addEventListener("input", () => {
    cmdActiveIndex = 0;
    renderCmdList();
  });

  cmdInput.addEventListener("keydown", (e) => {
    const items = cmdList.querySelectorAll(".command-palette__item");
    const count = items.length;
    if (e.key === "ArrowDown") {
      e.preventDefault();
      cmdActiveIndex = (cmdActiveIndex + 1) % count;
      highlightCmdItem();
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      cmdActiveIndex = (cmdActiveIndex - 1 + count) % count;
      highlightCmdItem();
    } else if (e.key === "Enter") {
      e.preventDefault();
      executeActiveCmd();
    } else if (e.key === "Escape") {
      e.preventDefault();
      closeCmdPalette();
    }
  });

  cmdOverlay.addEventListener("click", (e) => {
    if (e.target === cmdOverlay) closeCmdPalette();
  });

  document.addEventListener("keydown", (e) => {
    if ((e.ctrlKey || e.metaKey) && e.key === "k") {
      e.preventDefault();
      if (cmdOverlay.classList.contains("is-hidden")) {
        openCmdPalette();
      } else {
        closeCmdPalette();
      }
    }
  });

  const cmdTrigger = $("cmd-trigger");
  cmdTrigger.addEventListener("click", openCmdPalette);
  cmdTrigger.addEventListener("keydown", (e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); openCmdPalette(); } });
})();
