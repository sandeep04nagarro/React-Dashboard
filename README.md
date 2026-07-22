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

## Usage

Open index.html directly in any modern browser. That is it.

## File Structure

index.html   # Markup and template for todo items
style.css    # Styling and responsive layout
script.js    # Todo logic, filtering, and localStorage persistence
