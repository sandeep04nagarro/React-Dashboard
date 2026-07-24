# Todo App

A simple, responsive todo application built with vanilla HTML, CSS, and JavaScript. No frameworks or build tools required.

## Features

- Add, complete, and delete todos
- Each todo has a priority (low/medium/high), category, optional colored label, and optional due date
- Recurring tasks: recreate automatically daily, weekly, monthly, or on a custom interval (editable per task)
- Star/favorite tasks and pin important tasks to the top
- Assign a color label to tasks (e.g. 🔴 Work, 🟢 Personal, 🔵 Study), shown as a colored badge and editable inline
- Search bar to filter tasks by text
- Filter tasks by priority and category, or by favorites / pinned
- Sort tasks (newest/oldest, priority high-low/low-high, due date soonest, A-Z, manual drag-to-reorder; pinned always float first)
- Manual drag-and-drop reordering: select "Manual (drag to reorder)" from the sort dropdown and use the grip handle to reorder tasks
- Edit existing todos (text + notes) inline, with Enter to save / Esc to cancel
- Duplicate a todo to create a fresh copy (carries favorite/pinned state)
- Notes / description field per task
- Creation and completion timestamps per task
- Filter by All / Active / Completed
- Overdue tasks (due date passed, not completed) are highlighted in red
- Clear all completed todos at once
- Live item counter
- Progress bar that displays completion percentage (e.g. "Completed: 8 / 12" with a visual bar)
- Dark / light mode toggle (remembers your choice and respects system preference)
- Persists to localStorage (survives page refresh)
- Responsive layout for desktop and mobile
- **Productivity Analytics Dashboard** with stats, charts, and a monthly heatmap
- **Task Dependencies & Subtasks**: break tasks into subtasks with progress tracking; set dependencies between tasks to block completion until prerequisites are met

## Productivity Dashboard

Open `pages/dashboard.html` to view analytics about your task completion habits:

- **Stats**: Tasks completed today, this week, completion rate, average completion time, current streak, and longest streak
- **Charts**: Tasks completed per day (last 30 days), completion by category, completion by priority, most productive weekday, and overdue trend
- **Monthly Heatmap**: GitHub-style calendar heatmap showing daily task completions with month navigation
- **Smart Reminders & Browser Notifications**: set reminder offsets per task (at due time, 5 min, 15 min, 1 hr, 1 day, or custom minutes) and receive browser notifications before tasks are due. Snooze reminders directly from the task UI (10 min, 30 min, 1 hr, 1 day options).

## Usage

Open `pages/index.html` directly in any modern browser. That is it.

## File Structure

pages/
  index.html       # Markup and template for todo items
  dashboard.html   # Productivity analytics dashboard
css/
  style.css        # Todo app styling and responsive layout
  dashboard.css    # Dashboard styling
js/
  script.js        # Todo logic, filtering, and localStorage persistence
  dashboard.js     # Analytics computation and chart rendering
