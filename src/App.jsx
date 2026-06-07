import { useState, useEffect, useCallback, useMemo, useRef } from "react";

const APP_TITLE = "Meeting Duties Rota";

const JOBS = [
  "AV - Audio",
  "AV - Video",
  "Roving Mic Left",
  "Roving Mic Right / Platform",
  "Attendant - VC",
  "Attendant - Lobby",
  "Attendant - Auditorium",
];

const INITIAL_STAFF = [
  { id: 1,  name: "Person 1",  jobs: ["AV - Audio"] },
  { id: 2,  name: "Person 2",  jobs: ["AV - Video"] },
  { id: 3,  name: "Person 3",  jobs: ["Roving Mic Left","Roving Mic Right / Platform"] },
  { id: 4,  name: "Person 4",  jobs: ["Roving Mic Left","Roving Mic Right / Platform"] },
  { id: 5,  name: "Person 5",  jobs: ["Attendant - VC"] },
  { id: 6,  name: "Person 6",  jobs: ["Attendant - VC","Attendant - Auditorium"] },
  { id: 7,  name: "Person 7",  jobs: ["Attendant - Lobby"] },
  { id: 8,  name: "Person 8",  jobs: ["Attendant - Lobby"] },
  { id: 9,  name: "Person 9",  jobs: ["Attendant - Auditorium"] },
  { id: 10, name: "Person 10", jobs: ["Attendant - Auditorium","Roving Mic Left"] },
  { id: 11, name: "Person 11", jobs: ["AV - Audio","AV - Video"] },
  { id: 12, name: "Person 12", jobs: ["Roving Mic Right / Platform"] },
  { id: 13, name: "Person 13", jobs: ["Attendant - VC","Attendant - Auditorium"] },
  { id: 14, name: "Person 14", jobs: ["AV - Audio"] },
  { id: 15, name: "Person 15", jobs: ["AV - Video","Roving Mic Left"] },
];

// ── Theme tokens ──────────────────────────────────────────────────────────────
const C = {
  bg:        "#f4f5f7",
  surface:   "#ffffff",
  ink:       "#1d2330",
  inkSoft:   "#5b6472",
  inkFaint:  "#9aa3b2",
  line:      "#e7e9ee",
  lineSoft:  "#eef0f4",
  accent:    "#4f6bed",
  accentDk:  "#3a52c4",
  accentBg:  "#eef1fd",
  good:      "#1f9d6b",
  goodBg:    "#e7f6ef",
  warn:      "#d4661f",
  warnBg:    "#fdf0e6",
  bad:       "#d23b4e",
  badBg:     "#fdeaec",
  sunBg:     "#f3f6ff",
};
const FONT = "'Segoe UI', system-ui, -apple-system, 'Helvetica Neue', Arial, sans-serif";

// ── Helpers ───────────────────────────────────────────────────────────────────
function parseLocalDate(str) {
  const [y, m, d] = str.split("-").map(Number);
  return new Date(y, m - 1, d);
}
function fmtDate(d) {
  return d.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
}
function fmtDay(d) {
  return d.toLocaleDateString("en-GB", { weekday: "long" });
}
function dateKey(d) {
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`;
}
function fmtYMD(d) {
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`;
}
function getThursSuns(from, to) {
  const days = [];
  const cur = new Date(from);
  while (cur <= to) {
    if (cur.getDay() === 0 || cur.getDay() === 4) days.push(new Date(cur));
    cur.setDate(cur.getDate() + 1);
  }
  return days;
}
function autoFill(dates, staff, unavailMap) {
  const count = {};
  staff.forEach(s => { count[s.id] = {}; JOBS.forEach(j => { count[s.id][j] = 0; }); });
  const result = {};
  dates.forEach(d => { result[dateKey(d)] = {}; });
  dates.forEach(date => {
    const dk = dateKey(date);
    const usedToday = new Set();          // names already assigned a role this date
    JOBS.forEach(job => {
      const unavailSet = unavailMap[dk] || new Set();
      const eligible = staff.filter(s =>
        s.name.trim() &&
        s.jobs.includes(job) &&
        !unavailSet.has(s.name) &&
        !usedToday.has(s.name)            // no one does two roles on the same date
      );
      if (!eligible.length) { result[dk][job] = ""; return; }
      eligible.sort((a, b) => {
        const diff = (count[a.id][job]||0) - (count[b.id][job]||0);
        if (diff !== 0) return diff;
        return Object.values(count[a.id]).reduce((s,v)=>s+v,0) - Object.values(count[b.id]).reduce((s,v)=>s+v,0);
      });
      const chosen = eligible[0];
      result[dk][job] = chosen.name;
      count[chosen.id][job] = (count[chosen.id][job]||0) + 1;
      usedToday.add(chosen.name);
    });
  });
  return result;
}

// ── Storage ───────────────────────────────────────────────────────────────────
const STORAGE_KEYS = {
  staff:       "rota:staff",
  unavail:     "rota:unavail",
  dateRange:   "rota:dateRange",
  assignments: "rota:assignments",
};

// localStorage-backed persistence (per-browser, no backend).
// Kept async so the rest of the app's await-based logic is unchanged.
async function storageGet(key) {
  try {
    const raw = localStorage.getItem(key);
    return raw != null ? JSON.parse(raw) : null;
  } catch { return null; }
}
async function storageSet(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
    return true;
  } catch { return false; }
}

// ── Shared styles ─────────────────────────────────────────────────────────────
const thS = {
  padding: "11px 10px", borderBottom: `1px solid ${C.line}`,
  fontWeight: 600, textAlign: "center", fontSize: 11,
  letterSpacing: 0.4, textTransform: "uppercase", color: C.inkSoft,
  background: "#fbfbfd", whiteSpace: "nowrap",
};
const tdS = {
  padding: "9px 10px", borderBottom: `1px solid ${C.lineSoft}`,
  verticalAlign: "middle", fontSize: 13,
};
const card = {
  background: C.surface, borderRadius: 16, border: `1px solid ${C.line}`,
  boxShadow: "0 1px 2px rgba(20,30,55,0.04), 0 8px 24px rgba(20,30,55,0.05)",
};
const btnPrimary = {
  padding: "10px 20px", background: C.accent, color: "#fff", border: "none",
  borderRadius: 10, cursor: "pointer", fontFamily: "inherit", fontSize: 13,
  fontWeight: 600, letterSpacing: 0.2, transition: "background 0.15s",
};
const btnGhost = {
  padding: "10px 16px", background: "#fff", color: C.inkSoft,
  border: `1px solid ${C.line}`, borderRadius: 10, cursor: "pointer",
  fontFamily: "inherit", fontSize: 13, fontWeight: 500, transition: "all 0.15s",
};
const inputS = {
  padding: "9px 12px", border: `1px solid ${C.line}`, borderRadius: 10,
  fontFamily: "inherit", fontSize: 13, color: C.ink, background: "#fff", outline: "none",
};
const labelS = {
  display: "block", fontSize: 10, fontWeight: 600, color: C.inkFaint,
  marginBottom: 6, textTransform: "uppercase", letterSpacing: 0.8,
};

function SaveBadge({ status }) {
  const cfg = {
    saving: { bg: C.warnBg, color: C.warn, dot: C.warn, text: "Saving" },
    saved:  { bg: C.goodBg, color: C.good, dot: C.good, text: "Saved" },
    loaded: { bg: C.accentBg, color: C.accentDk, dot: C.accent, text: "Loaded" },
    error:  { bg: C.badBg,  color: C.bad,  dot: C.bad,  text: "Save failed" },
  };
  if (!status || !cfg[status]) return null;
  const { bg, color, dot, text } = cfg[status];
  return (
    <span style={{
      display: "inline-flex", alignItems: "center", gap: 6, padding: "5px 11px",
      borderRadius: 20, background: bg, color, fontSize: 11, fontWeight: 600,
      transition: "opacity 0.3s",
    }}>
      <span style={{ width: 6, height: 6, borderRadius: "50%", background: dot }} />
      {text}
    </span>
  );
}

// ── Main App ──────────────────────────────────────────────────────────────────
export default function RotaApp() {
  const today = new Date();
  const defaultFrom = fmtYMD(new Date(today.getFullYear(), today.getMonth(), 1));
  const defaultTo   = fmtYMD(new Date(today.getFullYear(), today.getMonth()+1, 0));

  const [tab, setTab]             = useState("rota");
  const [fromDate, setFromDate]   = useState(defaultFrom);
  const [toDate, setToDate]       = useState(defaultTo);
  const [staff, setStaff]         = useState(INITIAL_STAFF);
  const [unavail, setUnavail]     = useState([]);
  const [assignments, setAssignments] = useState({});
  const [autoFilled, setAutoFilled]   = useState(false);
  const [newUnavail, setNewUnavail]   = useState({ name: "", date: "" });
  const [gridPerson, setGridPerson]   = useState("");      // person selected in the new tick-box grid
  const [conflict, setConflict]       = useState(null);    // {name, dk, jobs:[...]} pending popup, or null
  const [editingCell, setEditingCell] = useState(null);
  const [saveStatus, setSaveStatus]   = useState("");
  const [loading, setLoading]         = useState(true);
  const [toast, setToast]             = useState("");
  const saveTimer = useRef(null);
  const fileInput = useRef(null);

  // ── Load all data on mount ──────────────────────────────────────────────────
  useEffect(() => {
    (async () => {
      const [savedStaff, savedUnavail, savedRange, savedAssignments] = await Promise.all([
        storageGet(STORAGE_KEYS.staff),
        storageGet(STORAGE_KEYS.unavail),
        storageGet(STORAGE_KEYS.dateRange),
        storageGet(STORAGE_KEYS.assignments),
      ]);
      let anyLoaded = false;
      if (savedStaff)   { setStaff(savedStaff);   anyLoaded = true; }
      if (savedUnavail) { setUnavail(savedUnavail); anyLoaded = true; }
      if (savedRange)   { setFromDate(savedRange.from); setToDate(savedRange.to); anyLoaded = true; }
      if (savedAssignments && Object.keys(savedAssignments).length) {
        setAssignments(savedAssignments);
        setAutoFilled(true);
        anyLoaded = true;
      }
      if (anyLoaded) {
        setSaveStatus("loaded");
        setTimeout(() => setSaveStatus(""), 3500);
      }
      setLoading(false);
    })();
  }, []);

  // ── Auto-save (debounced 1.2s) ──────────────────────────────────────────────
  const persistAll = useCallback((staffVal, unavailVal, from, to, assignVal) => {
    clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(async () => {
      setSaveStatus("saving");
      const results = await Promise.all([
        storageSet(STORAGE_KEYS.staff,       staffVal),
        storageSet(STORAGE_KEYS.unavail,     unavailVal),
        storageSet(STORAGE_KEYS.dateRange,   { from, to }),
        storageSet(STORAGE_KEYS.assignments, assignVal),
      ]);
      setSaveStatus(results.every(Boolean) ? "saved" : "error");
      setTimeout(() => setSaveStatus(""), 3000);
    }, 1200);
  }, []);

  useEffect(() => {
    if (!loading) persistAll(staff, unavail, fromDate, toDate, assignments);
  }, [staff, unavail, fromDate, toDate, assignments, loading, persistAll]);

  function flashToast(msg) {
    setToast(msg);
    setTimeout(() => setToast(""), 3000);
  }

  // ── Backup: download ────────────────────────────────────────────────────────
  function downloadBackup() {
    const payload = {
      app: "meeting-duties-rota",
      version: 1,
      exportedAt: new Date().toISOString(),
      data: { staff, unavail, dateRange: { from: fromDate, to: toDate }, assignments },
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `rota-backup-${fmtYMD(new Date())}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    flashToast("Backup downloaded");
  }

  // ── Backup: restore ─────────────────────────────────────────────────────────
  function triggerRestore() { fileInput.current?.click(); }
  function handleRestoreFile(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const parsed = JSON.parse(String(reader.result));
        const d = parsed.data || parsed;
        if (!d || !Array.isArray(d.staff)) throw new Error("Unrecognised file");
        if (!window.confirm("Restore this backup? It will replace the current people, unavailability and rota.")) return;
        setStaff(d.staff);
        setUnavail(Array.isArray(d.unavail) ? d.unavail : []);
        if (d.dateRange?.from && d.dateRange?.to) {
          setFromDate(d.dateRange.from);
          setToDate(d.dateRange.to);
        }
        const a = d.assignments || {};
        setAssignments(a);
        setAutoFilled(Object.keys(a).length > 0);
        flashToast("Backup restored");
      } catch {
        flashToast("Could not read that file — is it a rota backup?");
      } finally {
        e.target.value = "";
      }
    };
    reader.readAsText(file);
  }

  // ── Derived ─────────────────────────────────────────────────────────────────
  const dates = useMemo(() => {
    try { return getThursSuns(parseLocalDate(fromDate), parseLocalDate(toDate)); }
    catch { return []; }
  }, [fromDate, toDate]);

  const unavailMap = useMemo(() => {
    const m = {};
    unavail.forEach(u => { if (!m[u.date]) m[u.date] = new Set(); m[u.date].add(u.name); });
    return m;
  }, [unavail]);

  const summary = useMemo(() => {
    const counts = {};
    staff.forEach(s => { counts[s.name] = {}; JOBS.forEach(j => { counts[s.name][j] = 0; }); counts[s.name].__total = 0; });
    Object.values(assignments).forEach(day => {
      JOBS.forEach(job => {
        const name = day[job];
        if (name && counts[name]) { counts[name][job]++; counts[name].__total++; }
      });
    });
    return counts;
  }, [assignments, staff]);

  // ── Handlers ────────────────────────────────────────────────────────────────
  function handleAutoFill() {
    setAssignments(autoFill(dates, staff, unavailMap));
    setAutoFilled(true);
  }
  function handleCellChange(dk, job, value) {
    setAssignments(prev => ({ ...prev, [dk]: { ...(prev[dk]||{}), [job]: value } }));
  }
  function isUnavail(dk, name) {
    return !!(unavailMap[dk] && name && unavailMap[dk].has(name));
  }
  function addUnavail() {
    if (!newUnavail.name || !newUnavail.date) return;
    if (unavail.some(u => u.name === newUnavail.name && u.date === newUnavail.date)) return;
    setUnavail(prev => [...prev, { id: Date.now(), ...newUnavail }]);
    setNewUnavail({ name: "", date: "" });
  }

  // Toggle a person's unavailability for a meeting date via the tick-box grid.
  function toggleUnavail(name, dk) {
    const existing = unavail.find(u => u.name === name && u.date === dk);
    if (existing) {
      // Un-ticking: just make them available again.
      setUnavail(prev => prev.filter(u => u.id !== existing.id));
      return;
    }
    // Ticking unavailable — record it, then check for clashes with a generated rota.
    setUnavail(prev => [...prev, { id: Date.now(), name, date: dk }]);
    if (autoFilled) {
      const clashingJobs = JOBS.filter(job => assignments[dk]?.[job] === name);
      if (clashingJobs.length) setConflict({ name, dk, jobs: clashingJobs });
    }
  }

  // Next eligible person for a role on a date (fewest assignments of that role,
  // not unavailable, not already used that date). Returns "" if none.
  function nextEligible(dk, job, excludeName) {
    const unavailSet = unavailMap[dk] || new Set();
    const usedToday = new Set(JOBS.map(j => assignments[dk]?.[j]).filter(Boolean));
    const roleCount = {};
    staff.forEach(s => { roleCount[s.name] = 0; });
    Object.values(assignments).forEach(day => { const n = day[job]; if (n && roleCount[n] != null) roleCount[n]++; });
    const pool = staff.filter(s =>
      s.name.trim() && s.jobs.includes(job) &&
      s.name !== excludeName &&
      !unavailSet.has(s.name) &&
      !usedToday.has(s.name)
    );
    if (!pool.length) return "";
    pool.sort((a, b) => roleCount[a.name] - roleCount[b.name]);
    return pool[0].name;
  }

  // Resolve the conflict popup with the chosen strategy.
  function resolveConflict(mode) {
    if (!conflict) return;
    const { dk, jobs, name } = conflict;
    if (mode === "clear") {
      setAssignments(prev => {
        const day = { ...(prev[dk] || {}) };
        jobs.forEach(job => { day[job] = ""; });
        return { ...prev, [dk]: day };
      });
    } else if (mode === "reassign") {
      setAssignments(prev => {
        const day = { ...(prev[dk] || {}) };
        jobs.forEach(job => { day[job] = nextEligible(dk, job, name); });
        return { ...prev, [dk]: day };
      });
    }
    // "keep" leaves the assignment in place — it will simply show red (unavailable).
    setConflict(null);
  }

  // ── CSV export (dates × roles grid) ──────────────────────────────────────────
  function exportCSV() {
    const esc = v => {
      const s = String(v ?? "");
      return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
    };
    const header = ["Date", "Day", ...JOBS];
    const rows = dates.map(d => {
      const dk = dateKey(d);
      return [fmtDate(d), fmtDay(d), ...JOBS.map(j => assignments[dk]?.[j] || "")];
    });
    const csv = [header, ...rows].map(r => r.map(esc).join(",")).join("\r\n");
    const blob = new Blob(["\ufeff" + csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `rota-${fmtYMD(new Date())}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    flashToast("CSV downloaded");
  }

  const TABS = [
    { id: "rota",    label: "Rota" },
    { id: "setup",   label: "People & Roles" },
    { id: "unavail", label: "Unavailability" },
    { id: "summary", label: "Summary" },
  ];

  if (loading) {
    return (
      <div style={{ fontFamily: FONT, background: C.bg, minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", flexDirection: "column", gap: 14 }}>
        <div style={{ width: 34, height: 34, borderRadius: "50%", border: `3px solid ${C.line}`, borderTopColor: C.accent, animation: "rotaspin 0.8s linear infinite" }} />
        <div style={{ color: C.ink, fontSize: 15, fontWeight: 600 }}>Loading your rota…</div>
        <style>{`@keyframes rotaspin { to { transform: rotate(360deg) } }`}</style>
      </div>
    );
  }

  return (
    <div style={{ fontFamily: FONT, background: C.bg, minHeight: "100vh", color: C.ink }}>

      {/* ── Header ── */}
      <header style={{ background: C.surface, borderBottom: `1px solid ${C.line}` }}>
        <div style={{ maxWidth: 1180, margin: "0 auto", padding: "18px 24px 0" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 14, marginBottom: 16, flexWrap: "wrap" }}>
            <div style={{ width: 38, height: 38, borderRadius: 11, background: `linear-gradient(135deg, ${C.accent}, ${C.accentDk})`, display: "flex", alignItems: "center", justifyContent: "center" }}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <rect x="3" y="4" width="18" height="18" rx="2" /><line x1="16" y1="2" x2="16" y2="6" /><line x1="8" y1="2" x2="8" y2="6" /><line x1="3" y1="10" x2="21" y2="10" />
              </svg>
            </div>
            <div style={{ flex: 1, minWidth: 180 }}>
              <div style={{ fontWeight: 700, fontSize: 18, letterSpacing: -0.2 }}>{APP_TITLE}</div>
              <div style={{ color: C.inkFaint, fontSize: 12 }}>Thursday &amp; Sunday duty scheduling</div>
            </div>
            <div className="no-print" style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
              <SaveBadge status={saveStatus} />
              <button onClick={downloadBackup} style={btnGhost}
                onMouseOver={e => e.currentTarget.style.borderColor = C.accent}
                onMouseOut={e => e.currentTarget.style.borderColor = C.line}>↓ Backup</button>
              <button onClick={triggerRestore} style={btnGhost}
                onMouseOver={e => e.currentTarget.style.borderColor = C.accent}
                onMouseOut={e => e.currentTarget.style.borderColor = C.line}>↑ Restore</button>
              <input ref={fileInput} type="file" accept="application/json,.json" onChange={handleRestoreFile} style={{ display: "none" }} />
            </div>
          </div>
          <nav className="no-print" style={{ display: "flex", gap: 4 }}>
            {TABS.map(t => {
              const active = tab === t.id;
              return (
                <button key={t.id} onClick={() => setTab(t.id)} style={{
                  padding: "10px 16px", border: "none", cursor: "pointer", fontFamily: "inherit",
                  fontSize: 13, fontWeight: active ? 600 : 500, background: "transparent",
                  color: active ? C.accent : C.inkSoft,
                  borderBottom: active ? `2px solid ${C.accent}` : "2px solid transparent",
                  marginBottom: -1, transition: "color 0.15s",
                }}>{t.label}</button>
              );
            })}
          </nav>
        </div>
      </header>

      <main style={{ maxWidth: 1180, margin: "0 auto", padding: "24px 16px 60px" }}>

        {/* ══ ROTA TAB ══ */}
        {tab === "rota" && (
          <div>
            <div className="no-print" style={{ ...card, padding: 18, marginBottom: 18, display: "flex", flexWrap: "wrap", gap: 16, alignItems: "flex-end" }}>
              {[["From", fromDate, v => { setFromDate(v); setAutoFilled(false); setAssignments({}); }],
                ["To",   toDate,   v => { setToDate(v);   setAutoFilled(false); setAssignments({}); }]].map(([label, val, fn]) => (
                <div key={label}>
                  <label style={labelS}>{label}</label>
                  <input type="date" value={val} onChange={e => fn(e.target.value)} style={inputS} />
                </div>
              ))}
              <div style={{ color: C.inkSoft, fontSize: 13, paddingBottom: 9 }}>
                <strong style={{ color: C.ink, fontSize: 16 }}>{dates.length}</strong> meetings
                <span style={{ color: C.inkFaint }}> · {dates.filter(d=>d.getDay()===4).length} Thu, {dates.filter(d=>d.getDay()===0).length} Sun</span>
              </div>
              <div style={{ marginLeft: "auto", display: "flex", gap: 10, alignItems: "center" }}>
                {autoFilled && (
                  <>
                    <button onClick={() => window.print()} style={btnGhost} className="no-print"
                      onMouseOver={e => e.currentTarget.style.borderColor = C.accent}
                      onMouseOut={e => e.currentTarget.style.borderColor = C.line}>🖨 Print / PDF</button>
                    <button onClick={exportCSV} style={btnGhost} className="no-print"
                      onMouseOver={e => e.currentTarget.style.borderColor = C.accent}
                      onMouseOut={e => e.currentTarget.style.borderColor = C.line}>⤓ CSV</button>
                    <button onClick={() => { setAssignments({}); setAutoFilled(false); }} style={btnGhost} className="no-print">Clear</button>
                  </>
                )}
                <button onClick={handleAutoFill} style={btnPrimary} className="no-print"
                  onMouseOver={e => e.currentTarget.style.background = C.accentDk}
                  onMouseOut={e => e.currentTarget.style.background = C.accent}>
                  {autoFilled ? "Re-generate" : "Auto-fill rota"}
                </button>
              </div>
            </div>

            {!autoFilled && dates.length > 0 && (
              <div style={{ ...card, background: C.accentBg, border: `1px solid ${C.accent}22`, padding: 14, marginBottom: 18, color: C.accentDk, fontSize: 13, textAlign: "center" }}>
                Click <strong>Auto-fill rota</strong> to assign people automatically by role and availability — or click any cell to fill it in yourself.
              </div>
            )}
            {dates.length === 0 && (
              <div style={{ ...card, background: C.badBg, border: `1px solid ${C.bad}22`, padding: 18, color: C.bad, textAlign: "center", fontSize: 13 }}>
                No Thursdays or Sundays fall in this date range. Try adjusting the dates.
              </div>
            )}

            {dates.length > 0 && (
              <div style={{ ...card, overflow: "hidden" }}>
                <div style={{ overflowX: "auto" }}>
                  <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
                    <thead>
                      <tr>
                        <th style={{ ...thS, textAlign: "left", paddingLeft: 16 }}>Date</th>
                        <th style={thS}>Day</th>
                        {JOBS.map(j => <th key={j} style={{ ...thS, minWidth: 120 }}>{j}</th>)}
                        <th style={{ ...thS, minWidth: 90 }}>Attendance</th>
                      </tr>
                    </thead>
                    <tbody>
                      {dates.map(date => {
                        const dk = dateKey(date);
                        const isSun = date.getDay() === 0;
                        const rowBg = isSun ? C.sunBg : "#fff";
                        return (
                          <tr key={dk}>
                            <td style={{ ...tdS, paddingLeft: 16, background: rowBg, fontWeight: 600, color: C.ink, whiteSpace: "nowrap" }}>{fmtDate(date)}</td>
                            <td style={{ ...tdS, background: rowBg, color: isSun ? C.accent : C.inkSoft, fontWeight: isSun ? 600 : 400 }}>{fmtDay(date)}</td>
                            {JOBS.map(job => {
                              const val = assignments[dk]?.[job] || "";
                              const clash = isUnavail(dk, val);
                              const isEditing = editingCell?.dk===dk && editingCell?.job===job;
                              return (
                                <td key={job} style={{ ...tdS, padding: 0, background: clash ? C.badBg : rowBg }}>
                                  {isEditing ? (
                                    <select autoFocus value={val}
                                      onChange={e => { handleCellChange(dk, job, e.target.value); setEditingCell(null); }}
                                      onBlur={() => setEditingCell(null)}
                                      style={{ width:"100%", padding:"8px 6px", border:`2px solid ${C.accent}`, background:"#fff", fontFamily:"inherit", fontSize:12, borderRadius:8, color:C.ink }}>
                                      <option value="">— unassigned —</option>
                                      {staff.filter(s=>s.name.trim()&&s.jobs.includes(job)).map(s=>(
                                        <option key={s.id} value={s.name}>{s.name}{(unavailMap[dk]||new Set()).has(s.name)?" (away)":""}</option>
                                      ))}
                                    </select>
                                  ) : (
                                    <div onClick={() => setEditingCell({dk,job})} style={{
                                      padding:"9px 10px", cursor:"pointer", minHeight:20,
                                      display:"flex", alignItems:"center", gap:5,
                                      color: clash ? C.bad : (val ? C.ink : C.inkFaint),
                                      fontWeight: val && !clash ? 500 : 400,
                                    }}>
                                      {clash && <span title="Unavailable">⚠</span>}
                                      {val || <span style={{fontSize:11, fontStyle:"italic"}}>—</span>}
                                    </div>
                                  )}
                                </td>
                              );
                            })}
                            <td style={{ ...tdS, background: rowBg, color: C.inkFaint, textAlign: "center" }}>—</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
                <div style={{ padding:"11px 16px", background:"#fbfbfd", borderTop:`1px solid ${C.line}`, fontSize:11, color:C.inkFaint, display:"flex", gap:18, flexWrap:"wrap" }}>
                  <span>Blue rows are Sundays</span>
                  <span>Red cell = person is away — click to reassign</span>
                  <span style={{ marginLeft:"auto" }}>Changes save automatically</span>
                </div>
              </div>
            )}
          </div>
        )}

        {/* ══ PEOPLE & ROLES TAB ══ */}
        {tab === "setup" && (
          <div style={{ ...card, padding: 22 }}>
            <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", flexWrap:"wrap", gap:10 }}>
              <h2 style={{ margin:0, fontSize:16, fontWeight:700 }}>People &amp; Roles</h2>
              <SaveBadge status={saveStatus} />
            </div>
            <p style={{ margin:"6px 0 18px", color:C.inkSoft, fontSize:13 }}>
              Tick the roles each person can cover. Changes save automatically and apply to the next auto-fill.
            </p>
            <div style={{ overflowX:"auto" }}>
              <table style={{ width:"100%", borderCollapse:"collapse", fontSize:12 }}>
                <thead>
                  <tr>
                    <th style={{ ...thS, textAlign:"left", paddingLeft:14, minWidth:170 }}>Name</th>
                    {JOBS.map(j => <th key={j} style={{ ...thS, minWidth:96 }}>{j}</th>)}
                    <th style={{ ...thS, width:48 }}></th>
                  </tr>
                </thead>
                <tbody>
                  {staff.map(s => (
                    <tr key={s.id}>
                      <td style={{ ...tdS, padding:"5px 8px" }}>
                        <input value={s.name}
                          onChange={e => setStaff(prev=>prev.map(x=>x.id===s.id?{...x,name:e.target.value}:x))}
                          style={{ ...inputS, width:"100%", padding:"7px 10px" }} />
                      </td>
                      {JOBS.map(job => (
                        <td key={job} style={{ ...tdS, textAlign:"center", background:s.jobs.includes(job)?C.goodBg:"inherit" }}>
                          <input type="checkbox" checked={s.jobs.includes(job)}
                            onChange={e => setStaff(prev=>prev.map(x=>x.id!==s.id?x:{...x,jobs:e.target.checked?[...x.jobs,job]:x.jobs.filter(j=>j!==job)}))}
                            style={{ width:16, height:16, cursor:"pointer", accentColor:C.accent }} />
                        </td>
                      ))}
                      <td style={{ ...tdS, textAlign:"center" }}>
                        <button onClick={() => setStaff(prev=>prev.filter(x=>x.id!==s.id))}
                          style={{ background:"none", border:"none", cursor:"pointer", color:C.inkFaint, fontSize:16 }}
                          onMouseOver={e=>e.currentTarget.style.color=C.bad}
                          onMouseOut={e=>e.currentTarget.style.color=C.inkFaint}
                          title="Remove">×</button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div style={{ marginTop:16 }}>
              <button onClick={() => setStaff(prev=>[...prev,{id:Date.now(),name:"New person",jobs:[]}])} style={btnPrimary}
                onMouseOver={e => e.currentTarget.style.background = C.accentDk}
                onMouseOut={e => e.currentTarget.style.background = C.accent}>
                + Add person
              </button>
            </div>
          </div>
        )}

        {/* ══ UNAVAILABILITY TAB ══ */}
        {tab === "unavail" && (
          <div style={{ ...card, padding: 22 }}>
            <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", flexWrap:"wrap", gap:10 }}>
              <h2 style={{ margin:0, fontSize:16, fontWeight:700 }}>Unavailability</h2>
              <SaveBadge status={saveStatus} />
            </div>
            <p style={{ margin:"6px 0 18px", color:C.inkSoft, fontSize:13 }}>
              Pick a person, then tick the meeting dates they can't attend. Auto-fill skips them on those days.
            </p>

            {/* Fast tick-box grid */}
            <div style={{ marginBottom:24, background:"#fbfbfd", padding:16, borderRadius:12, border:`1px solid ${C.line}` }}>
              <div style={{ marginBottom:14 }}>
                <label style={labelS}>Person</label>
                <select value={gridPerson} onChange={e=>setGridPerson(e.target.value)} style={{ ...inputS, minWidth:220 }}>
                  <option value="">— select a person —</option>
                  {staff.filter(s=>s.name.trim()).map(s=><option key={s.id}>{s.name}</option>)}
                </select>
              </div>
              {gridPerson && dates.length === 0 && (
                <div style={{ color:C.inkFaint, fontSize:13, fontStyle:"italic" }}>
                  No meeting dates in the current range — set a date range on the Rota tab first.
                </div>
              )}
              {gridPerson && dates.length > 0 && (
                <div style={{ display:"flex", flexWrap:"wrap", gap:8 }}>
                  {dates.map(d => {
                    const dk = dateKey(d);
                    const off = (unavailMap[dk] || new Set()).has(gridPerson);
                    const isSun = d.getDay() === 0;
                    return (
                      <button key={dk} onClick={() => toggleUnavail(gridPerson, dk)}
                        style={{
                          display:"flex", alignItems:"center", gap:7, padding:"8px 12px",
                          borderRadius:9, cursor:"pointer", fontFamily:"inherit", fontSize:12,
                          fontWeight:500, transition:"all 0.12s",
                          border: off ? `1px solid ${C.bad}` : `1px solid ${C.line}`,
                          background: off ? C.badBg : "#fff",
                          color: off ? C.bad : C.ink,
                        }}>
                        <span style={{
                          width:15, height:15, borderRadius:4, flexShrink:0,
                          border: off ? `1px solid ${C.bad}` : `1px solid ${C.inkFaint}`,
                          background: off ? C.bad : "#fff",
                          color:"#fff", fontSize:11, lineHeight:"14px", textAlign:"center",
                        }}>{off ? "✓" : ""}</span>
                        <span>{fmtDate(d)}</span>
                        <span style={{ color: off ? C.bad : (isSun ? C.accent : C.inkFaint), fontSize:11 }}>
                          {isSun ? "Sun" : "Thu"}
                        </span>
                      </button>
                    );
                  })}
                </div>
              )}
              {!gridPerson && (
                <div style={{ color:C.inkFaint, fontSize:13, fontStyle:"italic" }}>
                  Select a person above to tick their unavailable dates.
                </div>
              )}
            </div>

            {/* Single add row (still available for one-off dates outside the range) */}
            <details style={{ marginBottom:22 }}>
              <summary style={{ cursor:"pointer", fontSize:12, color:C.inkSoft, marginBottom:10 }}>Add a single date manually</summary>
              <div style={{ display:"flex", gap:12, flexWrap:"wrap", alignItems:"flex-end", background:"#fbfbfd", padding:16, borderRadius:12, border:`1px solid ${C.line}` }}>
                <div>
                  <label style={labelS}>Person</label>
                  <select value={newUnavail.name} onChange={e=>setNewUnavail(p=>({...p,name:e.target.value}))} style={{ ...inputS, minWidth:190 }}>
                    <option value="">— select —</option>
                    {staff.filter(s=>s.name.trim()).map(s=><option key={s.id}>{s.name}</option>)}
                  </select>
                </div>
                <div>
                  <label style={labelS}>Date</label>
                  <input type="date" value={newUnavail.date} onChange={e=>setNewUnavail(p=>({...p,date:e.target.value}))} style={inputS} />
                </div>
                <button onClick={addUnavail} style={btnPrimary}
                  onMouseOver={e => e.currentTarget.style.background = C.accentDk}
                  onMouseOut={e => e.currentTarget.style.background = C.accent}>+ Add</button>
              </div>
            </details>

            <table style={{ width:"100%", borderCollapse:"collapse", fontSize:13 }}>
              <thead>
                <tr>
                  {["Person","Date","Day","Status",""].map(h=>(
                    <th key={h} style={{ ...thS, textAlign:"left", paddingLeft:14 }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {unavail.length === 0 && (
                  <tr><td colSpan={5} style={{ padding:24, color:C.inkFaint, textAlign:"center", fontStyle:"italic" }}>No unavailability recorded yet.</td></tr>
                )}
                {[...unavail].sort((a,b)=>a.date.localeCompare(b.date)).map(u=>{
                  const dt = parseLocalDate(u.date);
                  const isMeetingDay = dates.some(d=>dateKey(d)===u.date);
                  return (
                    <tr key={u.id}>
                      <td style={{ ...tdS, paddingLeft:14, fontWeight:600 }}>{u.name}</td>
                      <td style={{ ...tdS, paddingLeft:14 }}>{fmtDate(dt)}</td>
                      <td style={{ ...tdS, paddingLeft:14, color:C.inkSoft }}>{fmtDay(dt)}</td>
                      <td style={{ ...tdS, paddingLeft:14, color:isMeetingDay?C.warn:C.inkFaint, fontWeight:isMeetingDay?600:400 }}>
                        {isMeetingDay ? "Meeting day — will be skipped" : "No meeting scheduled"}
                      </td>
                      <td style={{ ...tdS, textAlign:"center" }}>
                        <button onClick={()=>setUnavail(prev=>prev.filter(x=>x.id!==u.id))}
                          style={{ background:"none", border:"none", cursor:"pointer", color:C.inkFaint, fontSize:16 }}
                          onMouseOver={e=>e.currentTarget.style.color=C.bad}
                          onMouseOut={e=>e.currentTarget.style.color=C.inkFaint}
                          title="Remove">×</button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* ══ SUMMARY TAB ══ */}
        {tab === "summary" && (
          <div style={{ ...card, padding: 22 }}>
            <h2 style={{ margin:"0 0 6px", fontSize:16, fontWeight:700 }}>Assignment Summary</h2>
            <p style={{ margin:"0 0 18px", color:C.inkSoft, fontSize:13 }}>
              {autoFilled
                ? `Counts across the current rota period (${dates.length} meetings).`
                : "Generate the rota first to see assignment counts."}
            </p>
            {!autoFilled ? (
              <div style={{ color:C.inkFaint, fontStyle:"italic", padding:30, textAlign:"center" }}>
                Go to the <strong>Rota</strong> tab and click Auto-fill.
              </div>
            ) : (
              <div style={{ overflowX:"auto" }}>
                <table style={{ width:"100%", borderCollapse:"collapse", fontSize:12 }}>
                  <thead>
                    <tr>
                      <th style={{ ...thS, textAlign:"left", paddingLeft:14, minWidth:150 }}>Name</th>
                      {JOBS.map(j=><th key={j} style={{ ...thS, minWidth:84 }}>{j}</th>)}
                      <th style={{ ...thS, color:C.accentDk, background:C.accentBg }}>Total</th>
                    </tr>
                  </thead>
                  <tbody>
                    {staff.filter(s=>s.name.trim()).map(s=>{
                      const sc = summary[s.name]||{};
                      const total = sc.__total||0;
                      return (
                        <tr key={s.id}>
                          <td style={{ ...tdS, paddingLeft:14, fontWeight:600 }}>{s.name}</td>
                          {JOBS.map(j=>{
                            const v=sc[j]||0;
                            return <td key={j} style={{ ...tdS, textAlign:"center", background:v>0?C.goodBg:"inherit", color:v>0?C.good:C.inkFaint, fontWeight:v>0?600:400 }}>{v>0?v:"·"}</td>;
                          })}
                          <td style={{ ...tdS, textAlign:"center", fontWeight:700, background:total>0?C.accentBg:"inherit", color:total>0?C.accentDk:C.inkFaint }}>{total||"·"}</td>
                        </tr>
                      );
                    })}
                    <tr>
                      <td style={{ ...tdS, paddingLeft:14, fontWeight:700, background:"#fbfbfd" }}>Column total</td>
                      {JOBS.map(j=>{
                        const tot = staff.reduce((acc,s)=>(acc+(summary[s.name]?.[j]||0)),0);
                        return <td key={j} style={{ ...tdS, textAlign:"center", fontWeight:700, background:"#fbfbfd", color:C.inkSoft }}>{tot||"·"}</td>;
                      })}
                      <td style={{ ...tdS, textAlign:"center", fontWeight:700, background:C.accentBg, color:C.accentDk }}>
                        {staff.reduce((acc,s)=>(acc+(summary[s.name]?.__total||0)),0)||"·"}
                      </td>
                    </tr>
                  </tbody>
                </table>
                <div style={{ marginTop:16, padding:13, background:"#fbfbfd", borderRadius:10, border:`1px solid ${C.line}`, fontSize:12, color:C.inkSoft }}>
                  If one column total is much higher than the rest, it may be worth training more people for that role.
                </div>
              </div>
            )}
          </div>
        )}
      </main>

      {toast && (
        <div style={{
          position:"fixed", bottom:24, left:"50%", transform:"translateX(-50%)",
          background:C.ink, color:"#fff", padding:"11px 20px", borderRadius:12,
          fontSize:13, fontWeight:500, boxShadow:"0 8px 30px rgba(20,30,55,0.25)", zIndex:50,
        }}>{toast}</div>
      )}

      {/* ── Unavailability conflict popup ── */}
      {conflict && (
        <div className="no-print" style={{
          position:"fixed", inset:0, background:"rgba(20,30,55,0.45)", zIndex:100,
          display:"flex", alignItems:"center", justifyContent:"center", padding:20,
        }}>
          <div style={{ ...card, maxWidth:420, width:"100%", padding:24 }}>
            <h3 style={{ margin:"0 0 8px", fontSize:16, fontWeight:700 }}>Already assigned that day</h3>
            <p style={{ margin:"0 0 18px", fontSize:13, color:C.inkSoft, lineHeight:1.5 }}>
              <strong style={{ color:C.ink }}>{conflict.name}</strong> is now marked unavailable on{" "}
              <strong style={{ color:C.ink }}>{fmtDate(parseLocalDate(conflict.dk))}</strong>, but is currently
              assigned to: <strong style={{ color:C.ink }}>{conflict.jobs.join(", ")}</strong>. What would you like to do?
            </p>
            <div style={{ display:"flex", flexDirection:"column", gap:8 }}>
              <button onClick={()=>resolveConflict("clear")} style={{ ...btnGhost, textAlign:"left" }}>
                <strong>Clear the cell(s)</strong> — leave blank to refill manually
              </button>
              <button onClick={()=>resolveConflict("reassign")} style={{ ...btnGhost, textAlign:"left" }}>
                <strong>Auto-reassign</strong> — give the role(s) to the next eligible person
              </button>
              <button onClick={()=>resolveConflict("keep")} style={{ ...btnGhost, textAlign:"left" }}>
                <strong>Keep it</strong> — leave assigned, flagged red so I decide
              </button>
            </div>
          </div>
        </div>
      )}

      <style>{`
        @media print {
          .no-print { display: none !important; }
          body { background: #fff !important; }
          @page { margin: 12mm; }
          main { padding: 0 !important; max-width: 100% !important; }
        }
      `}</style>
    </div>
  );
}
