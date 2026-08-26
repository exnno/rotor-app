# Project Handover — Meeting Duties Rota

## Standing instruction
**Always produce an updated handover document after coding a new version of the app.**
Add a dated entry to the Version History (newest at top), and refresh the
"Current state" section so the next chat can pick up cleanly.

---

## What this project is
A React app for scheduling meeting duties (AV, roving mics, attendants). It auto-fills
a rota across all Thursdays and Sundays in a chosen date range, balancing load fairly
across people who are (a) qualified for the role and (b) not marked unavailable that
day. Four tabs: Rota, People & Roles, Unavailability, Summary.

## Current state (live and working)
- **Live URL**: https://exnno.github.io/rotor-app/
- **Repo**: GitHub repo named **`rotor-app`** (owner: exnno). Web-UI only — see constraint below.
- **Deployment**: GitHub Pages via the **"Deploy to GitHub Pages"** Actions workflow
  (`.github/workflows/deploy.yml`). Builds with Vite and publishes `dist`.
- **Pages source**: Settings → Pages → Source = **GitHub Actions** (NOT "Deploy from a branch").
- **Persistence**: `localStorage` (per-browser, per-device — not shared). Plus manual
  **Backup/Restore** via JSON file (payload **version 2** as of v5), and **Print/PDF**
  and **CSV export** of the rota.
- **Build**: clean — `✓ 30 modules transformed`. (A build showing only "2 modules" means
  the src files are missing/misplaced — see Gotchas.)

## CRITICAL CONSTRAINT — how the user works
The user edits **entirely through the GitHub website** (no terminal, no local Node, no git CLI).
All code must be delivered as **complete file contents with the exact target path**, ready
to copy-paste into the GitHub web editor. `npm`/`gh-pages` CLI approaches are NOT usable.

## Project structure
```
rotor-app/                         (repo root)
├── .github/workflows/deploy.yml   "Deploy to GitHub Pages" — build + deploy
├── .gitignore
├── README.md                      neutral wording (no org/personal names) — v4
├── index.html                     title = "Meeting Duties Rota"; loads /src/main.jsx
├── package.json                   name "rotor-app", version "1.5.0" — v5
├── package-lock.json              REQUIRED for `npm ci` in the workflow
├── vite.config.js                 base must equal "/rotor-app/"  ⚠ SEE NOTE
└── src/
    ├── main.jsx                   mounts <RotaApp /> into #root
    └── App.jsx                    the whole app (current/v5 code)
```

⚠ **vite.config.js base:** must exactly equal **`/rotor-app/`** (the repo name). If the
blank-screen / asset-404 problem ever returns, check this first.

## Features (current)
- Date-range picker → lists every Thu & Sun in range.
- Auto-fill algorithm (`autoFill` in App.jsx): per date per role, picks the eligible
  person with fewest prior assignments to that role; tie-break = fewest total. Skips
  anyone marked unavailable that day. **NEW (v4): a person can no longer be given two
  roles on the same date** — a per-date `usedToday` set excludes anyone already placed
  that day. If eligible people run out, the cell is left **blank** (a visible gap),
  never a silent double-booking.
- Click any rota cell to override manually. Unavailable picks flagged red.
- **Skipped dates (v5):** click a date in the Rota table → **Date options** popup →
  *Skip this meeting*. The row **disappears entirely** from the table, CSV, print and
  Summary, and no longer counts towards the meeting total. Skipped dates in the current
  range appear as amber chips above the table; clicking a chip restores the date. The
  date's old assignments are kept underneath, so restoring brings them back intact.
- **Blocked roles (v5):** two ways to say "this role isn't needed on this date" —
  (a) the cell dropdown's **"— not needed —"** option, or (b) the *Roles needed on this
  date* tick boxes in the Date options popup (un-tick = blocked). A blocked cell renders
  as a greyed dashed **n/a**; auto-fill leaves it alone; CSV and print both write `n/a`.
  Blocking a cell that already held someone clears that person.
- **Skips and blocks survive Re-generate** — they live in their own storage keys, so
  hitting Re-generate refills only the live cells.
- People & Roles tab: add/remove people, tick role qualifications. Auto-saves.
- **Unavailability tab (v4): tick-box date grid.** Select a person, then tick/untick
  every meeting date (Thu/Sun) in the current range — much faster than the old one-at-a-time
  add. The original single-date add is kept under a collapsed "Add a single date manually"
  `<details>` for one-off dates outside the range.
- **Post-generation conflict popup (v4):** if you tick someone unavailable *after* a rota
  is generated and they're already assigned that day, a popup offers three choices each
  time: **Clear the cell(s)**, **Auto-reassign** to the next eligible person, or **Keep it**
  (leave assigned, flagged red).
- Summary tab: assignment counts per person/role with column totals.
- **Backup / Restore** (header): JSON download / upload. Intended way to move data
  between devices, given localStorage.
- **Print / PDF (v4):** header "🖨 Print / PDF" button triggers `window.print()`. A print
  stylesheet hides all controls/tabs/nav (`.no-print`) so the output is just the rota
  table, full app styling retained, fully sanitised (no names traceable to the user).
- **CSV export (v4):** "⤓ CSV" button downloads `rota-YYYY-MM-DD.csv` as a dates × roles
  grid (Date, Day, then one column per role), UTF-8 BOM so it opens cleanly in Numbers /
  Google Sheets / Excel.
- Auto-save: debounced 1.2s; save-status badge in header.

## Key code facts (src/App.jsx)
- `JOBS` and `INITIAL_STAFF` arrays near top = default roles/people. **Anonymised** —
  generic "Person 1..15", no real names; roles are neutral (no org-specific terms).
- `storageGet` / `storageSet` (localStorage wrappers, kept async) are the ONLY
  persistence touch-points. Swap these to move to a shared backend later.
- Theme lives in one `const C = { ... }` token block near the top — change `accent` /
  `accentDk` to reskin the whole app.
- v4 additions: `toggleUnavail`, `nextEligible`, `resolveConflict`, `exportCSV` handlers;
  `gridPerson` and `conflict` state; a print `<style>` block + `.no-print` class on the
  header controls, nav, date-range card, toolbar buttons, and popup.
- v5 additions:
  - State: `skipped` (array of `"YYYY-MM-DD"`), `blocked` (`{ dk: [role, ...] }`),
    `dateMenu` (dk of the open Date options popup, or null).
  - Storage keys: `rota:skipped`, `rota:blocked`.
  - Derived: **`activeDates`** = `dates` minus skipped — this is what the rota table,
    CSV, Summary, meeting counts and the unavailability grid all iterate over. Never
    render the raw `dates` list again; `skippedInRange` drives the restore chips.
  - Handlers: `toggleSkip(dk)`, `setBlock(dk, job, on)`, `isBlocked(dk, job)`,
    `handleCellSelect(dk, job, value)` (single entry point for the cell dropdown).
  - `BLOCK_VALUE` (`"__not_needed__"`) is the dropdown sentinel for a blocked cell.
    It is a UI value only — it is never written into `assignments`.
  - `autoFill(dates, staff, unavailMap, blockedMap)` — 4th arg; blocked roles are
    skipped outright. `handleAutoFill` merges the previous assignments back in for any
    skipped date so restoring is lossless.
- `downloadBackup()` / `handleRestoreFile()` implement backup/restore.

## Deployment recap (web-UI workflow)
1. Edit a file in place via the pencil icon (guarantees correct path), or
   Add file → Create new file and type the FULL path incl. `src/`.
2. Commit to `main` → the Action rebuilds and redeploys automatically. No version
   bump needed; any commit triggers it.
3. Watch the **Actions** tab: both `build` and `deploy` jobs should be green.
4. Hard-refresh (Ctrl/⌘+Shift+R) after the green tick; allow ~1 min for the CDN.

### Files to update for v5 (copy-paste each, exact paths)
- `src/App.jsx`   ← the big one (all logic + UI changes)
- `package.json`  ← version bump to 1.5.0 only
- `HANDOVER.md`   ← this file
(`README.md` unchanged since v4.)

## Gotchas learned the hard way (check these first when "it doesn't update")
1. **Files landing in repo ROOT instead of `src/`.** The web uploader doesn't preserve
   folders. New `App.jsx`/`main.jsx` must live in `src/`. Safest: edit the existing
   `src/App.jsx` in place rather than uploading. A build showing "2 modules transformed"
   (vs 30) = src files missing → blank/raw page served.
2. **Pages source set to "Deploy from a branch."** Serves raw unbuilt files → blank page.
   Must be **GitHub Actions**.
3. **Blank screen + JS 404** = `base` in vite.config.js doesn't match repo name (`/rotor-app/`).
4. **Green Action ≠ correct content.** A run can be green while building OLD code if the
   new file went to the wrong path. Confirm the bundle hash changes.
5. Delete any stray duplicate `App.jsx`/`main.jsx` left in the repo root.

## Decisions already made (don't re-ask)
- Persistence: localStorage only (no backend), plus JSON backup/restore.
- Deployment: GitHub Pages, free hosting, via GitHub Actions.
- Look: modern light theme, blue accent, fully neutral (no org name, no real names).
- Auto-fill: no double-booking per date; blank-and-flag when eligible people run out
  (do NOT silently double-up).
- Print: keep full styling, but sanitised — strip everything that isn't the rota table.

## Open ideas / not yet done
- Shared/synced data (would need a backend; only `storageGet`/`storageSet` change).
- "Attendance" column is still a manual placeholder only (left as-is through v5).
- Bulk skip (e.g. "skip every Thursday in December") — currently one date at a time.
- A recurring "roles needed" profile (e.g. Thursdays never need Attendant - VC) rather
  than blocking per date.
- Per-person view / individual schedule export.

---

## Version History
### v5 (current) — skipped dates + blocked roles
- **Skip a meeting date:** click the date cell → Date options popup → *Skip this
  meeting*. The row vanishes from the table, CSV, print, Summary and the meeting count.
  Amber restore chips above the table bring it back, assignments intact.
- **Block roles per date:** cell dropdown gains **"— not needed —"**, and the Date
  options popup has *Roles needed on this date* tick boxes for doing several at once.
  Blocked cells show a greyed dashed **n/a** and are ignored by auto-fill.
- **Both survive Re-generate** — stored separately from `assignments` in
  `rota:skipped` / `rota:blocked`.
- Backup payload bumped to **version 2** (carries skipped + blocked); v1 backups still
  restore fine, defaulting both to empty.
- Unavailability tick-box grid and "meeting day" status now ignore skipped dates.
- `package.json` version → 1.5.0. Build verified (30 modules).

### v4 — fairness fix + faster unavailability + exports + cleanup
- **Auto-fill bug fixed:** one person can no longer hold two roles on the same date
  (per-date `usedToday` exclusion; runs out → leave blank, never double-book).
- **Unavailability tick-box grid:** pick a person, tick meeting dates in the current
  range; old single-add kept under a collapsible section.
- **Conflict popup:** marking someone unavailable after generation, when already
  assigned that day, prompts Clear / Auto-reassign / Keep (red) — each time.
- **Print / PDF:** button + print stylesheet; hides controls, keeps styling, sanitised.
- **CSV export:** dates × roles grid with UTF-8 BOM for Numbers/Sheets/Excel.
- **Cosmetic cleanup:** `package.json` name → `rotor-app`, version → 1.4.0; README
  rewritten with neutral wording (no org/personal references).
- Build verified (30 modules).

### v3 — anonymise + redesign + backup/restore
- Removed all org and personal names from defaults; neutralised role names; removed
  religious styling. New modern light theme. Added Backup/Restore in the header.
- Build verified (30 modules).

### v2-gh — initial GitHub packaging
- Wrapped Artifact v2 in a Vite + React project (package.json, vite.config.js,
  index.html, src/main.jsx).
- Replaced `window.storage` with a `localStorage` wrapper (same interface).
- Added GitHub Actions Pages deploy workflow, README, .gitignore.

<!-- Add the next version's entry above this line, newest at the top.
     Also update "Current state" each time. -->
