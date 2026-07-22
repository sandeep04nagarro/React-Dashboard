(function () {
  "use strict";

  var STORAGE_KEY = "todo-app:todos";
  var THEME_KEY = "todo-app:theme";
  var DAY_MS = 86400000;
  var CATEGORY_COLORS = ["#4f46e5", "#10b981", "#f59e0b", "#ef4444", "#8b5cf6"];
  var PRIORITY_COLORS = { high: "#ef4444", medium: "#f59e0b", low: "#10b981" };

  var root = document.documentElement;

  function currentTheme() {
    return root.getAttribute("data-theme") === "dark" ? "dark" : "light";
  }

  function applyTheme(theme) {
    root.setAttribute("data-theme", theme);
    var isDark = theme === "dark";
    themeToggle.setAttribute("aria-pressed", String(isDark));
    themeToggle.setAttribute("aria-label", isDark ? "Switch to light mode" : "Switch to dark mode");
  }

  var themeToggle = document.getElementById("theme-toggle");
  themeToggle.addEventListener("click", function () {
    var next = currentTheme() === "dark" ? "light" : "dark";
    applyTheme(next);
    try { localStorage.setItem(THEME_KEY, next); } catch (e) {}
    renderAll();
  });

  function loadTodos() {
    try {
      var raw = localStorage.getItem(STORAGE_KEY);
      return raw ? JSON.parse(raw) : [];
    } catch (e) {
      return [];
    }
  }

  function toDateKey(ts) {
    var d = new Date(ts);
    return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0");
  }

  function todayKey() { return toDateKey(Date.now()); }

  function startOfDay(ts) {
    var d = new Date(ts);
    d.setHours(0, 0, 0, 0);
    return d.getTime();
  }

  function daysBetween(a, b) {
    return Math.round(Math.abs(a - b) / DAY_MS);
  }

  function getCompletedTodos(todos) {
    return todos.filter(function (t) { return t.completed && t.completedAt; });
  }

  function computeStats(todos) {
    var completed = getCompletedTodos(todos);
    var today = todayKey();
    var now = Date.now();
    var weekAgo = startOfDay(now - 6 * DAY_MS);

    var completedToday = completed.filter(function (t) { return toDateKey(t.completedAt) === today; }).length;
    var completedThisWeek = completed.filter(function (t) { return t.completedAt >= weekAgo; }).length;
    var rate = todos.length > 0 ? Math.round((completed.length / todos.length) * 100) : 0;

    var totalTimeMs = 0;
    var countWithTime = 0;
    completed.forEach(function (t) {
      if (t.createdAt && t.completedAt) {
        var diff = new Date(t.completedAt).getTime() - new Date(t.createdAt).getTime();
        if (diff >= 0) {
          totalTimeMs += diff;
          countWithTime++;
        }
      }
    });
    var avgTimeDays = countWithTime > 0 ? (totalTimeMs / countWithTime / DAY_MS) : 0;
    var avgTimeLabel = avgTimeDays < 1
      ? (avgTimeDays * 24).toFixed(1) + "h"
      : avgTimeDays.toFixed(1) + "d";

    var streakInfo = computeStreaks(todos);

    return {
      today: completedToday,
      week: completedThisWeek,
      rate: rate,
      avgTime: avgTimeLabel,
      streak: streakInfo.current,
      longestStreak: streakInfo.longest
    };
  }

  function computeStreaks(todos) {
    var completed = getCompletedTodos(todos);
    if (completed.length === 0) return { current: 0, longest: 0 };

    var daySet = {};
    completed.forEach(function (t) {
      daySet[toDateKey(t.completedAt)] = true;
    });

    var days = Object.keys(daySet).sort();
    var today = todayKey();
    var yesterday = toDateKey(Date.now() - DAY_MS);

    var longest = 0;
    var current = 0;

    var currentStreak = 0;
    for (var i = 0; i < days.length; i++) {
      if (i === 0) {
        currentStreak = 1;
      } else {
        var prev = new Date(days[i - 1] + "T00:00:00").getTime();
        var curr = new Date(days[i] + "T00:00:00").getTime();
        if (curr - prev === DAY_MS) {
          currentStreak++;
        } else {
          currentStreak = 1;
        }
      }
      if (currentStreak > longest) longest = currentStreak;
    }

    currentStreak = 0;
    if (daySet[today] || daySet[yesterday]) {
      var checkDay = daySet[today] ? today : yesterday;
      currentStreak = 0;
      var d = new Date(checkDay + "T00:00:00").getTime();
      while (daySet[toDateKey(d)]) {
        currentStreak++;
        d -= DAY_MS;
      }
    }

    return { current: current, longest: longest };
  }

  function computeDailyData(todos) {
    var completed = getCompletedTodos(todos);
    var counts = {};
    for (var i = 29; i >= 0; i--) {
      var d = new Date(Date.now() - i * DAY_MS);
      counts[toDateKey(d)] = 0;
    }
    completed.forEach(function (t) {
      var key = toDateKey(t.completedAt);
      if (counts.hasOwnProperty(key)) counts[key]++;
    });
    var keys = Object.keys(counts).sort();
    return {
      labels: keys.map(function (k) {
        var parts = k.split("-");
        return parseInt(parts[2], 10) + "";
      }),
      values: keys.map(function (k) { return counts[k]; }),
      fullLabels: keys
    };
  }

  function computeCategoryData(todos) {
    var completed = getCompletedTodos(todos);
    var counts = {};
    completed.forEach(function (t) {
      var cat = t.category || "general";
      counts[cat] = (counts[cat] || 0) + 1;
    });
    var keys = Object.keys(counts).sort(function (a, b) { return counts[b] - counts[a]; });
    return {
      labels: keys,
      values: keys.map(function (k) { return counts[k]; })
    };
  }

  function computePriorityData(todos) {
    var completed = getCompletedTodos(todos);
    var counts = { high: 0, medium: 0, low: 0 };
    completed.forEach(function (t) {
      var p = t.priority || "medium";
      counts[p] = (counts[p] || 0) + 1;
    });
    var keys = ["high", "medium", "low"].filter(function (k) { return counts[k] > 0; });
    return {
      labels: keys,
      values: keys.map(function (k) { return counts[k]; })
    };
  }

  function computeWeekdayData(todos) {
    var completed = getCompletedTodos(todos);
    var counts = [0, 0, 0, 0, 0, 0, 0];
    completed.forEach(function (t) {
      var d = new Date(t.completedAt);
      counts[d.getDay()]++;
    });
    var labels = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
    return { labels: labels, values: counts };
  }

  function computeOverdueTrend(todos) {
    var counts = {};
    for (var i = 29; i >= 0; i--) {
      var d = new Date(Date.now() - i * DAY_MS);
      counts[toDateKey(d)] = 0;
    }
    todos.forEach(function (t) {
      if (!t.dueDate || t.completed) return;
      var due = new Date(t.dueDate + "T00:00:00").getTime();
      var now = Date.now();
      if (due < now) {
        var createdDay = startOfDay(t.createdAt);
        var keys = Object.keys(counts).sort();
        keys.forEach(function (k) {
          var kTs = new Date(k + "T00:00:00").getTime();
          if (kTs >= createdDay && kTs <= now) {
            counts[k]++;
          }
        });
      }
    });
    var keys = Object.keys(counts).sort();
    return {
      labels: keys.map(function (k) {
        var parts = k.split("-");
        return parseInt(parts[2], 10) + "";
      }),
      values: keys.map(function (k) { return counts[k]; }),
      fullLabels: keys
    };
  }

  function cssVar(name) {
    return getComputedStyle(root).getPropertyValue(name).trim();
  }

  function hexToRgba(hex, alpha) {
    if (!hex || hex.charAt(0) !== "#") return "rgba(100,100,100," + alpha + ")";
    var r = parseInt(hex.slice(1, 3), 16);
    var g = parseInt(hex.slice(3, 5), 16);
    var b = parseInt(hex.slice(5, 7), 16);
    return "rgba(" + r + "," + g + "," + b + "," + alpha + ")";
  }

  function setupCanvas(canvas) {
    var rect = canvas.parentElement.getBoundingClientRect();
    var dpr = window.devicePixelRatio || 1;
    var w = rect.width - 32;
    var h = parseInt(canvas.getAttribute("height"), 10) || 180;
    canvas.width = w * dpr;
    canvas.height = h * dpr;
    canvas.style.width = w + "px";
    canvas.style.height = h + "px";
    var ctx = canvas.getContext("2d");
    ctx.scale(dpr, dpr);
    return { ctx: ctx, w: w, h: h };
  }

  function drawBarChart(canvas, data, color) {
    var s = setupCanvas(canvas);
    var ctx = s.ctx, w = s.w, h = s.h;
    var pad = { top: 20, right: 10, bottom: 30, left: 35 };
    var chartW = w - pad.left - pad.right;
    var chartH = h - pad.top - pad.bottom;
    var max = Math.max.apply(null, data.values.concat([1]));
    var barColor = color || cssVar("--chart-bar");
    var gridColor = cssVar("--chart-grid");
    var textColor = cssVar("--chart-text");

    ctx.clearRect(0, 0, w, h);

    ctx.strokeStyle = gridColor;
    ctx.lineWidth = 0.5;
    for (var i = 0; i <= 4; i++) {
      var y = pad.top + chartH - (chartH * i / 4);
      ctx.beginPath();
      ctx.moveTo(pad.left, y);
      ctx.lineTo(w - pad.right, y);
      ctx.stroke();
      ctx.fillStyle = textColor;
      ctx.font = "10px system-ui";
      ctx.textAlign = "right";
      ctx.fillText(Math.round(max * i / 4), pad.left - 5, y + 3);
    }

    var barW = Math.max(2, (chartW / data.values.length) - 2);
    var gap = (chartW - barW * data.values.length) / (data.values.length + 1);

    data.values.forEach(function (v, idx) {
      var x = pad.left + gap + idx * (barW + gap);
      var barH = (v / max) * chartH;
      var y = pad.top + chartH - barH;

      ctx.fillStyle = barColor;
      ctx.beginPath();
      var r = Math.min(3, barW / 2);
      ctx.moveTo(x, y + r);
      ctx.arcTo(x, y, x + r, y, r);
      ctx.arcTo(x + barW, y, x + barW, y + r, r);
      ctx.lineTo(x + barW, pad.top + chartH);
      ctx.lineTo(x, pad.top + chartH);
      ctx.closePath();
      ctx.fill();

      if (data.labels.length <= 31) {
        ctx.fillStyle = textColor;
        ctx.font = "9px system-ui";
        ctx.textAlign = "center";
        ctx.fillText(data.labels[idx], x + barW / 2, h - pad.bottom + 14);
      }
    });
  }

  function drawLineChart(canvas, data, color) {
    var s = setupCanvas(canvas);
    var ctx = s.ctx, w = s.w, h = s.h;
    var pad = { top: 20, right: 10, bottom: 30, left: 35 };
    var chartW = w - pad.left - pad.right;
    var chartH = h - pad.top - pad.bottom;
    var max = Math.max.apply(null, data.values.concat([1]));
    var lineColor = color || cssVar("--chart-line");
    var gridColor = cssVar("--chart-grid");
    var textColor = cssVar("--chart-text");

    ctx.clearRect(0, 0, w, h);

    ctx.strokeStyle = gridColor;
    ctx.lineWidth = 0.5;
    for (var i = 0; i <= 4; i++) {
      var gy = pad.top + chartH - (chartH * i / 4);
      ctx.beginPath();
      ctx.moveTo(pad.left, gy);
      ctx.lineTo(w - pad.right, gy);
      ctx.stroke();
      ctx.fillStyle = textColor;
      ctx.font = "10px system-ui";
      ctx.textAlign = "right";
      ctx.fillText(Math.round(max * i / 4), pad.left - 5, gy + 3);
    }

    var points = data.values.map(function (v, idx) {
      var x = pad.left + (idx / Math.max(data.values.length - 1, 1)) * chartW;
      var y = pad.top + chartH - (v / max) * chartH;
      return { x: x, y: y };
    });

    if (points.length > 1) {
      ctx.beginPath();
      ctx.moveTo(points[0].x, pad.top + chartH);
      ctx.lineTo(points[0].x, points[0].y);
      for (var j = 1; j < points.length; j++) {
        ctx.lineTo(points[j].x, points[j].y);
      }
      ctx.lineTo(points[points.length - 1].x, pad.top + chartH);
      ctx.closePath();
      ctx.fillStyle = hexToRgba(lineColor, 0.1);
      ctx.fill();

      ctx.beginPath();
      ctx.moveTo(points[0].x, points[0].y);
      for (var k = 1; k < points.length; k++) {
        ctx.lineTo(points[k].x, points[k].y);
      }
      ctx.strokeStyle = lineColor;
      ctx.lineWidth = 2;
      ctx.stroke();
    }

    points.forEach(function (p) {
      ctx.beginPath();
      ctx.arc(p.x, p.y, 3, 0, Math.PI * 2);
      ctx.fillStyle = lineColor;
      ctx.fill();
    });

    if (data.labels.length <= 31) {
      var step = data.labels.length > 15 ? Math.ceil(data.labels.length / 15) : 1;
      data.labels.forEach(function (label, idx) {
        if (idx % step === 0 || idx === data.labels.length - 1) {
          var x = pad.left + (idx / Math.max(data.labels.length - 1, 1)) * chartW;
          ctx.fillStyle = textColor;
          ctx.font = "9px system-ui";
          ctx.textAlign = "center";
          ctx.fillText(label, x, h - pad.bottom + 14);
        }
      });
    }
  }

  function drawDonutChart(canvas, data, colors) {
    var s = setupCanvas(canvas);
    var ctx = s.ctx, w = s.w, h = s.h;
    var total = data.values.reduce(function (a, b) { return a + b; }, 0);
    if (total === 0) return;

    ctx.clearRect(0, 0, w, h);

    var cx = w / 2;
    var cy = h / 2;
    var radius = Math.min(w, h) / 2 - 20;
    var innerRadius = radius * 0.55;

    var startAngle = -Math.PI / 2;
    data.values.forEach(function (v, idx) {
      var sliceAngle = (v / total) * Math.PI * 2;
      ctx.beginPath();
      ctx.arc(cx, cy, radius, startAngle, startAngle + sliceAngle);
      ctx.arc(cx, cy, innerRadius, startAngle + sliceAngle, startAngle, true);
      ctx.closePath();
      ctx.fillStyle = colors[idx % colors.length];
      ctx.fill();
      startAngle += sliceAngle;
    });

    ctx.fillStyle = cssVar("--text");
    ctx.font = "bold 16px system-ui";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(total, cx, cy - 6);
    ctx.font = "10px system-ui";
    ctx.fillStyle = cssVar("--muted");
    ctx.fillText("total", cx, cy + 10);
  }

  function buildLegend(containerId, labels, colors) {
    var el = document.getElementById(containerId);
    el.innerHTML = "";
    labels.forEach(function (label, idx) {
      var item = document.createElement("span");
      item.className = "chart-legend__item";
      var swatch = document.createElement("span");
      swatch.className = "chart-legend__swatch";
      swatch.style.background = colors[idx % colors.length];
      var text = document.createTextNode(label);
      item.appendChild(swatch);
      item.appendChild(text);
      el.appendChild(item);
    });
  }

  var heatmapMonth = new Date().getMonth();
  var heatmapYear = new Date().getFullYear();

  function renderHeatmap(todos) {
    var container = document.getElementById("heatmap-container");
    var label = document.getElementById("heatmap-month-label");
    var monthNames = ["January", "February", "March", "April", "May", "June",
      "July", "August", "September", "October", "November", "December"];
    label.textContent = monthNames[heatmapMonth] + " " + heatmapYear;

    var completed = getCompletedTodos(todos);
    var counts = {};
    completed.forEach(function (t) {
      var d = new Date(t.completedAt);
      if (d.getMonth() === heatmapMonth && d.getFullYear() === heatmapYear) {
        var key = d.getDate();
        counts[key] = (counts[key] || 0) + 1;
      }
    });

    var maxCount = Math.max.apply(null, Object.keys(counts).map(function (k) { return counts[k]; }).concat([1]));

    var firstDay = new Date(heatmapYear, heatmapMonth, 1);
    var startDow = firstDay.getDay();
    var daysInMonth = new Date(heatmapYear, heatmapMonth + 1, 0).getDate();

    container.innerHTML = "";

    var dayNames = ["S", "M", "T", "W", "T", "F", "S"];
    var labelsRow = document.createElement("div");
    labelsRow.className = "heatmap__labels";
    dayNames.forEach(function (name) {
      var lbl = document.createElement("span");
      lbl.className = "heatmap__label";
      lbl.textContent = name;
      labelsRow.appendChild(lbl);
    });
    container.appendChild(labelsRow);

    var weeks = [];
    var currentWeek = [];
    for (var p = 0; p < startDow; p++) {
      currentWeek.push(null);
    }
    for (var day = 1; day <= daysInMonth; day++) {
      currentWeek.push(day);
      if (currentWeek.length === 7) {
        weeks.push(currentWeek);
        currentWeek = [];
      }
    }
    if (currentWeek.length > 0) {
      while (currentWeek.length < 7) currentWeek.push(null);
      weeks.push(currentWeek);
    }

    weeks.forEach(function (week) {
      var weekEl = document.createElement("div");
      weekEl.className = "heatmap__week";
      week.forEach(function (day) {
        var cell = document.createElement("div");
        cell.className = "heatmap__day";
        if (day !== null) {
          var count = counts[day] || 0;
          if (count > 0) {
            var level = count <= maxCount * 0.25 ? 1
              : count <= maxCount * 0.5 ? 2
              : count <= maxCount * 0.75 ? 3 : 4;
            cell.classList.add("heatmap__day--l" + level);
          }
          cell.title = monthNames[heatmapMonth] + " " + day + ": " + (counts[day] || 0) + " tasks completed";
        }
        weekEl.appendChild(cell);
      });
      container.appendChild(weekEl);
    });
  }

  function renderStats(stats) {
    document.getElementById("stat-today").textContent = stats.today;
    document.getElementById("stat-week").textContent = stats.week;
    document.getElementById("stat-rate").textContent = stats.rate + "%";
    document.getElementById("stat-avg-time").textContent = stats.avgTime;
    document.getElementById("stat-streak").textContent = stats.streak + "d";
    document.getElementById("stat-longest-streak").textContent = stats.longestStreak + "d";
  }

  function renderAll() {
    var todos = loadTodos();
    var completed = getCompletedTodos(todos);
    var noData = document.getElementById("no-data");
    noData.classList.toggle("is-hidden", completed.length > 0);

    var stats = computeStats(todos);
    renderStats(stats);

    var daily = computeDailyData(todos);
    drawBarChart(document.getElementById("chart-daily"), daily, cssVar("--chart-bar"));

    var catData = computeCategoryData(todos);
    var catColors = CATEGORY_COLORS;
    drawDonutChart(document.getElementById("chart-category"), catData, catColors);
    buildLegend("legend-category", catData.labels, catColors);

    var priData = computePriorityData(todos);
    var priColors = priData.labels.map(function (l) { return PRIORITY_COLORS[l] || "#6b7280"; });
    drawDonutChart(document.getElementById("chart-priority"), priData, priColors);
    buildLegend("legend-priority", priData.labels.map(function (l) {
      return l.charAt(0).toUpperCase() + l.slice(1);
    }), priColors);

    var weekdayData = computeWeekdayData(todos);
    drawBarChart(document.getElementById("chart-weekday"), weekdayData, cssVar("--chart-bar"));

    var overdueData = computeOverdueTrend(todos);
    drawLineChart(document.getElementById("chart-overdue"), overdueData, cssVar("--danger"));

    renderHeatmap(todos);
  }

  document.getElementById("heatmap-prev").addEventListener("click", function () {
    heatmapMonth--;
    if (heatmapMonth < 0) { heatmapMonth = 11; heatmapYear--; }
    renderAll();
  });

  document.getElementById("heatmap-next").addEventListener("click", function () {
    heatmapMonth++;
    if (heatmapMonth > 11) { heatmapMonth = 0; heatmapYear++; }
    renderAll();
  });

  window.addEventListener("resize", function () {
    clearTimeout(window._resizeTimer);
    window._resizeTimer = setTimeout(renderAll, 150);
  });

  renderAll();
})();
