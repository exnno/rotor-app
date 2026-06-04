# West Bridgford — Meeting Duties Rota

A React app for organising meeting duties (AV, roving mics, attendants). Auto-fills
a rota across Thursdays and Sundays in a chosen date range, balancing load across
qualified, available staff. Data persists in the browser via `localStorage`.

## Run locally

```bash
npm install
npm run dev
```

Then open the URL Vite prints (usually http://localhost:5173).

## Deploy to GitHub Pages

1. Create a new GitHub repository named **`west-bridgford-rota`**.
   (If you use a different name, change `base` in `vite.config.js` to `/<your-repo-name>/`.)
2. Push this project to the `main` branch:
   ```bash
   git init
   git add .
   git commit -m "Initial commit"
   git branch -M main
   git remote add origin https://github.com/<you>/west-bridgford-rota.git
   git push -u origin main
   ```
3. In the repo: **Settings → Pages → Build and deployment → Source → GitHub Actions**.
4. Every push to `main` builds and publishes automatically. Your site appears at:
   `https://<you>.github.io/west-bridgford-rota/`

## Notes on data storage

Data is saved with `localStorage`, so it is **per-browser and per-device** — staff,
unavailability, and assignments are not shared between people or computers. To clear
everything, clear the site's storage in your browser, or open DevTools and run
`localStorage.clear()`.

If you later want a shared rota everyone can see, that requires a small backend
(e.g. a database or a serverless store); the persistence layer in `src/App.jsx`
(`storageGet` / `storageSet`) is the only place that would need changing.

## Customising

- **Staff and jobs**: edit `INITIAL_STAFF` and `JOBS` near the top of `src/App.jsx`,
  or just use the in-app "Staff & Jobs" tab (changes save automatically).
- **Repo/site name**: keep `base` in `vite.config.js` in sync with the repo name.
