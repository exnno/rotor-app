# Meeting Duties Rota

A React app for organising meeting duties (e.g. AV, roving mics, attendants). Auto-fills
a rota across Thursdays and Sundays in a chosen date range, balancing load across
qualified, available people. Data persists in the browser via `localStorage`.

## Run locally

```bash
npm install
npm run dev
```

Then open the URL Vite prints (usually http://localhost:5173).

## Deploy to GitHub Pages

1. Create a GitHub repository named **`rotor-app`**.
   (If you use a different name, change `base` in `vite.config.js` to `/<your-repo-name>/`.)
2. Push this project to the `main` branch.
3. In the repo: **Settings → Pages → Build and deployment → Source → GitHub Actions**.
4. Every push to `main` builds and publishes automatically. The site appears at:
   `https://<you>.github.io/rotor-app/`

## Notes on data storage

Data is saved with `localStorage`, so it is **per-browser and per-device** — people,
unavailability, and assignments are not shared between users or computers. Use the
in-app **Backup** / **Restore** buttons to move data between devices. To clear
everything, clear the site's storage in your browser.

If you later want a shared rota everyone can see, that requires a small backend; the
persistence layer in `src/App.jsx` (`storageGet` / `storageSet`) is the only place
that would need changing.

## Customising

- **People and roles**: edit `INITIAL_STAFF` and `JOBS` near the top of `src/App.jsx`,
  or use the in-app "People & Roles" tab (changes save automatically).
- **Repo/site name**: keep `base` in `vite.config.js` in sync with the repo name.
