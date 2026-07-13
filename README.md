# Todo App

A simple, responsive todo application built with vanilla HTML, CSS, and JavaScript. No frameworks or build tools required.

## Features

- Add, complete, and delete todos
- Each todo has a priority (low/medium/high), category, and optional due date
- Search bar to filter tasks by text
- Filter tasks by priority and category
- Sort tasks (newest/oldest, priority high-low/low-high, due date soonest, A-Z)
- Edit existing todos (text + notes) inline, with Enter to save / Esc to cancel
- Duplicate a todo to create a fresh copy
- Notes / description field per task
- Creation and completion timestamps per task
- Filter by All / Active / Completed
- Overdue tasks (due date passed, not completed) are highlighted in red
- Clear all completed todos at once
- Live item counter
- Dark / light mode toggle (remembers your choice and respects system preference)
- Persists to localStorage (survives page refresh)
- Responsive layout for desktop and mobile

## Usage

Open index.html directly in any modern browser. That is it.

## File Structure

index.html   # Markup and template for todo items
style.css    # Styling and responsive layout
script.js    # Todo logic, filtering, and localStorage persistence
