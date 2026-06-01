# Bread Planner Architecture

Bread Planner is a local-first planning app for bread making. Today it combines an ingredient planner, timeline builder, timer, diary, and archive for saved recipes and timelines. The next releases should keep this shape while preparing for global persistent timers, notifications, user accounts, cloud storage, sharing, and lightweight monetization.

## Core Objects

- `RecipeSnapshot`: immutable recipe data captured at a specific moment, including inputs, flour mix, ambient temperature, calculated ingredients, and dough weight.
- `TimelineSnapshot`: immutable timeline data captured at a specific moment, including name, preset, optional ambient temperature, duration, and steps.
- `JournalEntry`: a real diary/session record. It owns its `recipeSnapshot` and optional `timelineSnapshot`, plus session notes, status, timer, and planning data.
- `ArchiveState`: local archive container for saved recipes, saved timelines, and journal entries.
- `TimerState`: current timer status and elapsed-time source data.
- `TimelinePlanningState`: planning mode and target end date/time for timeline scheduling.

## Current State vs Snapshots

Current planner state is editable working state: changing ingredient values, profiles, flour mixes, timeline steps, names, temperature, or planning inputs changes what the user is preparing right now.

Snapshots are historical records. Once a journal entry captures a recipe or timeline, the diary must render from `recipeSnapshot` and `timelineSnapshot`, not from the live planner. This preserves what actually happened in a session even if the user later edits the planner, updates a saved recipe, changes a preset, or loads another timeline.

Rule for future releases: diary views, diary exports, shared journal pages, and "new trial from journal" flows must treat snapshots as the source of truth.

## Storage Today

The app currently uses browser `localStorage` with two keys:

- `bread-planner:v1`: current planner/timeline/timer working state.
- `breadPlanner.archive.v1`: saved recipes, timelines, and journal entries.

Storage access is defensive: when storage is unavailable, malformed, blocked, or full, the app falls back to in-memory/default state instead of breaking the UI. Existing keys and schemas must not be renamed during refactors because users may already have local data.

## Future Storage Direction

Keep localStorage access behind small helpers now, then evolve toward a repository/adapter boundary later:

- `storage`: capability checks and browser/local persistence adapters.
- `domain`: pure data functions, migrations, sorting, formatting, and snapshot helpers.
- `features`: application controllers/hooks for flows such as archive CRUD, planner state, timeline sessions, and diary orchestration.
- `components` and `App`: UI composition and prop wiring.

Cloud storage should be added as a second adapter/repository implementation, not by spreading network calls through UI components.

## Persistent Global Timer

A future global timer should represent an active bread session independently from the currently visible screen. It should survive refreshes, support resume/pause/finish, and connect a `JournalEntry` to its captured recipe/timeline snapshots, timer state, planning state, and ambient temperature. It should not require the user to keep the Timeline tab open.

The preparatory `ActiveBreadSession` type describes that future boundary without implementing notifications, login, cloud sync, or new timer behavior in this release.

## Module Rules

- Keep `App.tsx` as a shell/orchestrator: compose views, own top-level state, and pass props.
- Move pure helpers out of `App.tsx` when they do not depend on React state.
- Do not move broad archive workflows into a hook until the controller boundary is clear and covered by build checks.
- Keep storage keys stable.
- Keep diary data snapshot-based.
- Avoid UI, layout, and microcopy changes in internal architecture releases.
- Prefer small, buildable refactors over large moves that make behavior hard to compare.
