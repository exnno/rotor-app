import { useState, useEffect, useCallback, useMemo, useRef } from "react";

const JOBS = [
  "AV - Audio",
  "AV - Video",
  "Roving Mic Left",
  "Roving Mic Right / Platform",
  "Attendant - VC",
  "Attendant - Lobby / Unlocking Elder",
  "Attendant Auditorium",
];

const INITIAL_STAFF = [
  { id: 1,  name: "James Birchley",  jobs: ["AV - Audio"] },
  { id: 2,  name: "Peter Birchley",  jobs: ["AV - Video"] },
  { id: 3,  name: "Staff Member 3",  jobs: ["Roving Mic Left","Roving Mic Right / Platform"] },
  { id: 4,  name: "Staff Member 4",  jobs: ["Roving Mic Left","Roving Mic Right / Platform"] },
  { id: 5,  name: "Staff Member 5",  jobs: ["Attendant - VC"] },
  { id: 6,  name: "Staff Member 6",  jobs: ["Attendant - VC","Attendant Auditorium"] },
  { id: 7,  name: "Staff Member 7",  jobs: ["Attendant - Lobby / Unlocking Elder"] },
  { id: 8,  name: "Staff Member 8",  jobs: ["Attendant - Lobby / Unlocking Elder"] },
  { id: 9,  name: "Staff Member 9",  jobs: ["Attendant Auditorium"] },
  { id: 10, name: "Staff Member 10", jobs: ["Attendant Auditorium","Roving Mic Left"] },
  { id: 11, name: "Staff Member 11", jobs: ["AV - Audio","AV - Video"] },
  { id: 12, name: "Staff Member 12", jobs: ["Roving Mic Right / Platform"] },
  { id: 13, name: "Staff Member 13", jobs: ["Attendant - VC","Attendant Auditorium"] },
  { id: 14, name: "Staff Member 14", jobs: ["AV - Audio"] },
  { id: 15, name: "Staff Member 15", jobs: ["AV - Video","Roving Mic Left"] },
];

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
    JOBS.forEach(job => {
      const unavailSet = unavailMap[dk] || new Set();
      const eligible = staff.filter(s => s.name.trim() && s.jobs.includes(job) && !unavailSet.has(s.name));
      if (!eligible.length) { result[dk][job] = ""; return; }
      eligible.sort((a, b) => {
        const diff = (count[a.id][job]||0) - (count[b.id][job]||0);
        if (diff !== 0) return diff;
        return Object.values(count[a.id]).reduce((s,v)=>s+v,0) - Object.values(count[b.id]).reduce((s,v)=>s+v,0);
      });
      const chosen = eligible[0];
      result[dk][job] = chosen.name;
      count[chosen.id][job] = (count[chosen.id][job]||0) + 1;
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

// ── Styles ────────────────────────────────────────────────────────────────────
const thS = {
  padding: "10px 8px", border: "1px solid rgba(255,255,255,0.12)",
  fontWeight: "bold", textAlign: "center", fontSize: 11, letterSpacing: 0.3,
};
const tdS = {
  padding: "6px 8px", border: "1px solid #e8e4dc", verticalAlign: "middle", fontSize: 12,
};

function SaveBadge({ status }) {
  const cfg = {
    saving: { bg: "#fffbea", color: "#7a6000", text: "💾 Saving…" },
    saved:  { bg: "#e8f5e9", color: "#2e7d32", text: "✅ Saved!" },
    loaded: { bg: "#e3f0ff", color: "#1a4a8a", text: "📂 Data loaded" },
    error:  { bg: "#ffe0e0", color: "#c00",    text: "❌ Save failed" },
  };
  if (!status || !cfg[status]) return null;
  const { bg, color, text } = cfg[status];
  return (
    <span style={{
      display: "inline-block", padding: "4px 12px", borderRadius: 20,
      background: bg, color, fontSize: 11, fontWeight: "bold", transition: "opacity 0.3s",
    }}>{text}</span>
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
  const [editingCell, setEditingCell] = useState(null);
  const [saveStatus, setSaveStatus]   = useState("");
  const [loading, setLoading]         = useState(true);
  const saveTimer = useRef(null);

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
      if (savedStaff)       { setStaff(savedStaff);             anyLoaded = true; }
      if (savedUnavail)     { setUnavail(savedUnavail);          anyLoaded = true; }
      if (savedRange)       { setFromDate(savedRange.from); setToDate(savedRange.to); anyLoaded = true; }
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

  // ── Auto-save whenever key data changes (debounced 1.2s) ───────────────────
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

  // Trigger auto-save whenever these change
  useEffect(() => {
    if (!loading) persistAll(staff, unavail, fromDate, toDate, assignments);
  }, [staff, unavail, fromDate, toDate, assignments, loading, persistAll]);

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
    const result = autoFill(dates, staff, unavailMap);
    setAssignments(result);
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
    const duplicate = unavail.some(u => u.name === newUnavail.name && u.date === newUnavail.date);
    if (duplicate) return;
    setUnavail(prev => [...prev, { id: Date.now(), ...newUnavail }]);
    setNewUnavail({ name: "", date: "" });
  }

  const TABS = [
    { id: "rota",    label: "📅 Rota" },
    { id: "setup",   label: "👥 Staff & Jobs" },
    { id: "unavail", label: "🚫 Unavailability" },
    { id: "summary", label: "📊 Summary" },
  ];

  if (loading) {
    return (
      <div style={{ fontFamily: "Georgia, serif", background: "#f7f5f0", minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", flexDirection: "column", gap: 16 }}>
        <div style={{ fontSize: 40 }}>⛪</div>
        <div style={{ color: "#1a1a2e", fontSize: 16, fontWeight: "bold" }}>Loading your rota data…</div>
        <div style={{ color: "#888", fontSize: 13 }}>Restoring saved staff, unavailability and assignments</div>
      </div>
    );
  }

  return (
    <div style={{ fontFamily: "Georgia, serif", background: "#f7f5f0", minHeight: "100vh", color: "#1a1a2e" }}>

      {/* ── Header ── */}
      <div style={{ background: "linear-gradient(135deg, #1a1a2e 0%, #16213e 60%, #0f3460 100%)", padding: "18px 24px 0", boxShadow: "0 4px 20px rgba(0,0,0,0.3)" }}>
        <div style={{ maxWidth: 1140, margin: "0 auto" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 14, marginBottom: 14 }}>
            <div style={{ width: 40, height: 40, borderRadius: 10, background: "linear-gradient(135deg,#e8c842,#f0a500)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 20 }}>⛪</div>
            <div style={{ flex: 1 }}>
              <div style={{ color: "#e8c842", fontWeight: "bold", fontSize: 19, letterSpacing: 1 }}>WEST BRIDGFORD</div>
              <div style={{ color: "#a0b4cc", fontSize: 11, letterSpacing: 2, textTransform: "uppercase" }}>Meeting Duties Rota</div>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <SaveBadge status={saveStatus} />
              <span style={{ color: "#4a6080", fontSize: 10, fontStyle: "italic" }}>auto-saves as you work</span>
            </div>
          </div>
          <div style={{ display: "flex", gap: 2 }}>
            {TABS.map(t => (
              <button key={t.id} onClick={() => setTab(t.id)} style={{
                padding: "8px 16px", border: "none", cursor: "pointer", fontFamily: "inherit",
                fontSize: 12, fontWeight: tab === t.id ? "bold" : "normal",
                background: tab === t.id ? "#f7f5f0" : "transparent",
                color: tab === t.id ? "#1a1a2e" : "#a0b4cc",
                borderRadius: "6px 6px 0 0", transition: "all 0.15s",
              }}>{t.label}</button>
            ))}
          </div>
        </div>
      </div>

      <div style={{ maxWidth: 1140, margin: "0 auto", padding: "22px 14px" }}>

        {/* ══ ROTA TAB ══ */}
        {tab === "rota" && (
          <div>
            {/* Date range + auto-fill controls */}
            <div style={{ background: "#fff", borderRadius: 12, padding: 18, marginBottom: 18, boxShadow: "0 2px 12px rgba(0,0,0,0.07)", display: "flex", flexWrap: "wrap", gap: 14, alignItems: "flex-end" }}>
              {[["From Date", fromDate, v => { setFromDate(v); setAutoFilled(false); setAssignments({}); }],
                ["To Date",   toDate,   v => { setToDate(v);   setAutoFilled(false); setAssignments({}); }]].map(([label, val, fn]) => (
                <div key={label}>
                  <label style={{ display: "block", fontSize: 10, fontWeight: "bold", color: "#666", marginBottom: 4, textTransform: "uppercase", letterSpacing: 1 }}>{label}</label>
                  <input type="date" value={val} onChange={e => fn(e.target.value)}
                    style={{ padding: "8px 10px", border: "2px solid #e0ddd5", borderRadius: 8, fontFamily: "inherit", fontSize: 13, color: "#1a1a2e" }} />
                </div>
              ))}
              <div style={{ color: "#888", fontSize: 12, paddingBottom: 6 }}>
                → <strong style={{ color: "#0f3460" }}>{dates.length}</strong> meetings &nbsp;
                <span style={{ color: "#aaa" }}>({dates.filter(d=>d.getDay()===4).length} Thu · {dates.filter(d=>d.getDay()===0).length} Sun)</span>
              </div>
              <div style={{ marginLeft: "auto", display: "flex", gap: 10, alignItems: "center" }}>
                {autoFilled && (
                  <button onClick={() => { setAssignments({}); setAutoFilled(false); }}
                    style={{ padding: "9px 16px", background: "#f0f0f0", color: "#555", border: "none", borderRadius: 8, cursor: "pointer", fontFamily: "inherit", fontSize: 12 }}>
                    🗑 Clear
                  </button>
                )}
                <button onClick={handleAutoFill} style={{
                  padding: "10px 22px", background: "linear-gradient(135deg,#0f3460,#16213e)",
                  color: "#e8c842", border: "none", borderRadius: 8, cursor: "pointer",
                  fontFamily: "inherit", fontSize: 13, fontWeight: "bold",
                  boxShadow: "0 4px 12px rgba(15,52,96,0.3)",
                }}>⚡ {autoFilled ? "Re-generate" : "Auto-Fill Rota"}</button>
              </div>
            </div>

            {!autoFilled && dates.length > 0 && (
              <div style={{ background: "#fffbea", border: "2px dashed #e8c842", borderRadius: 10, padding: 14, marginBottom: 18, color: "#7a6000", fontSize: 13, textAlign: "center" }}>
                Click <strong>⚡ Auto-Fill Rota</strong> to assign staff automatically based on their qualifications and availability — or click any cell to fill in manually.
              </div>
            )}
            {dates.length === 0 && (
              <div style={{ background: "#fff3f3", border: "2px dashed #e88", borderRadius: 10, padding: 18, color: "#c00", textAlign: "center" }}>
                No Thursdays or Sundays found in this date range. Please adjust your dates.
              </div>
            )}

            {dates.length > 0 && (
              <div style={{ background: "#fff", borderRadius: 12, boxShadow: "0 2px 12px rgba(0,0,0,0.07)", overflow: "hidden" }}>
                <div style={{ overflowX: "auto" }}>
                  <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 11 }}>
                    <thead>
                      <tr>
                        <th style={{ ...thS, background: "#1a1a2e", color: "#e8c842", width: 100 }}>Date</th>
                        <th style={{ ...thS, background: "#1a1a2e", color: "#e8c842", width: 82 }}>Day</th>
                        {JOBS.map(j => <th key={j} style={{ ...thS, background: "#1a1a2e", color: "#e8c842", minWidth: 118 }}>{j}</th>)}
                        <th style={{ ...thS, background: "#2d2d2d", color: "#777", minWidth: 86 }}>Attendance<br/><span style={{fontSize:9,fontStyle:"italic",fontWeight:"normal"}}>manual on day</span></th>
                      </tr>
                    </thead>
                    <tbody>
                      {dates.map((date, ri) => {
                        const dk = dateKey(date);
                        const isSun = date.getDay() === 0;
                        const rowBg = isSun ? "#eef3f9" : (ri%2===0 ? "#fff" : "#fafaf7");
                        return (
                          <tr key={dk}>
                            <td style={{ ...tdS, background: rowBg, fontWeight: "bold", color: "#0f3460", whiteSpace: "nowrap", fontSize: 11 }}>{fmtDate(date)}</td>
                            <td style={{ ...tdS, background: rowBg, color: isSun?"#0f3460":"#555", fontWeight: isSun?"bold":"normal", fontStyle: "italic", fontSize: 11 }}>{fmtDay(date)}</td>
                            {JOBS.map(job => {
                              const val = assignments[dk]?.[job] || "";
                              const clash = isUnavail(dk, val);
                              const isEditing = editingCell?.dk===dk && editingCell?.job===job;
                              return (
                                <td key={job} style={{ ...tdS, background: clash?"#ffe0e0":rowBg, padding: 0, position: "relative" }}>
                                  {isEditing ? (
                                    <select autoFocus value={val}
                                      onChange={e => { handleCellChange(dk, job, e.target.value); setEditingCell(null); }}
                                      onBlur={() => setEditingCell(null)}
                                      style={{ width:"100%", padding:"6px 4px", border:"2px solid #e8c842", background:"#fffbea", fontFamily:"inherit", fontSize:11, borderRadius:4 }}>
                                      <option value="">— unassigned —</option>
                                      {staff.filter(s=>s.name.trim()&&s.jobs.includes(job)).map(s=>(
                                        <option key={s.id} value={s.name}>{s.name}{(unavailMap[dk]||new Set()).has(s.name)?" ⚠️":""}</option>
                                      ))}
                                    </select>
                                  ) : (
                                    <div onClick={() => setEditingCell({dk,job})} style={{
                                      padding:"7px 7px", cursor:"pointer", minHeight:30,
                                      display:"flex", alignItems:"center", gap:4,
                                      color: clash?"#c00":(val?"#1a1a2e":"#ccc"),
                                    }}>
                                      {clash && <span title="Unavailable">⚠️</span>}
                                      {val || <span style={{fontSize:9,fontStyle:"italic"}}>click to assign</span>}
                                    </div>
                                  )}
                                </td>
                              );
                            })}
                            <td style={{ ...tdS, background:"#efefef", color:"#bbb", textAlign:"center", fontStyle:"italic", fontSize:11 }}>___</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
                <div style={{ padding:"9px 14px", background:"#f7f5f0", borderTop:"1px solid #e0ddd5", fontSize:10, color:"#999", display:"flex", gap:18, flexWrap:"wrap" }}>
                  <span>🔵 Blue rows = Sundays</span>
                  <span>⚠️ Red cell = person marked unavailable — click to reassign</span>
                  <span>Click any cell to change or override an assignment</span>
                  <span style={{ marginLeft:"auto", fontStyle:"italic" }}>All changes save automatically</span>
                </div>
              </div>
            )}
          </div>
        )}

        {/* ══ STAFF & JOBS TAB ══ */}
        {tab === "setup" && (
          <div style={{ background:"#fff", borderRadius:12, padding:20, boxShadow:"0 2px 12px rgba(0,0,0,0.07)" }}>
            <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:4, flexWrap:"wrap", gap:10 }}>
              <h2 style={{ margin:0, color:"#1a1a2e", fontSize:16 }}>Staff & Job Qualifications</h2>
              <SaveBadge status={saveStatus} />
            </div>
            <p style={{ margin:"0 0 16px", color:"#888", fontSize:12 }}>
              Tick the jobs each person is qualified to do. Changes save automatically and apply to the next auto-fill.
            </p>
            <div style={{ overflowX:"auto" }}>
              <table style={{ width:"100%", borderCollapse:"collapse", fontSize:11 }}>
                <thead>
                  <tr>
                    <th style={{ ...thS, background:"#1a1a2e", color:"#e8c842", textAlign:"left", paddingLeft:12, minWidth:170 }}>Name</th>
                    {JOBS.map(j => <th key={j} style={{ ...thS, background:"#1a1a2e", color:"#e8c842", minWidth:100 }}>{j}</th>)}
                    <th style={{ ...thS, background:"#1a1a2e", color:"#666", width:50 }}></th>
                  </tr>
                </thead>
                <tbody>
                  {staff.map((s, si) => (
                    <tr key={s.id} style={{ background:si%2===0?"#fff":"#fafaf7" }}>
                      <td style={{ ...tdS, padding:"4px 8px" }}>
                        <input value={s.name}
                          onChange={e => setStaff(prev=>prev.map(x=>x.id===s.id?{...x,name:e.target.value}:x))}
                          style={{ width:"100%", padding:"5px 7px", border:"1px solid #ddd", borderRadius:6, fontFamily:"inherit", fontSize:12 }} />
                      </td>
                      {JOBS.map(job => (
                        <td key={job} style={{ ...tdS, textAlign:"center", background:s.jobs.includes(job)?"#e8f5e9":"inherit" }}>
                          <input type="checkbox" checked={s.jobs.includes(job)}
                            onChange={e => setStaff(prev=>prev.map(x=>x.id!==s.id?x:{...x,jobs:e.target.checked?[...x.jobs,job]:x.jobs.filter(j=>j!==job)}))}
                            style={{ width:15, height:15, cursor:"pointer", accentColor:"#0f3460" }} />
                        </td>
                      ))}
                      <td style={{ ...tdS, textAlign:"center" }}>
                        <button onClick={() => setStaff(prev=>prev.filter(x=>x.id!==s.id))}
                          style={{ background:"none", border:"none", cursor:"pointer", color:"#e55", fontSize:15 }}>✕</button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div style={{ marginTop:14, display:"flex", gap:10, flexWrap:"wrap", alignItems:"center" }}>
              <button onClick={() => setStaff(prev=>[...prev,{id:Date.now(),name:"New Person",jobs:[]}])}
                style={{ padding:"8px 18px", background:"#0f3460", color:"#e8c842", border:"none", borderRadius:8, cursor:"pointer", fontFamily:"inherit", fontSize:13 }}>
                + Add Person
              </button>
              <span style={{ fontSize:11, color:"#aaa", fontStyle:"italic" }}>Changes save automatically as you type</span>
            </div>
          </div>
        )}

        {/* ══ UNAVAILABILITY TAB ══ */}
        {tab === "unavail" && (
          <div style={{ background:"#fff", borderRadius:12, padding:20, boxShadow:"0 2px 12px rgba(0,0,0,0.07)" }}>
            <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:4, flexWrap:"wrap", gap:10 }}>
              <h2 style={{ margin:0, color:"#1a1a2e", fontSize:16 }}>Unavailability — Specific Dates</h2>
              <SaveBadge status={saveStatus} />
            </div>
            <p style={{ margin:"0 0 16px", color:"#888", fontSize:12 }}>
              Add one row per person per date they cannot attend. Auto-fill skips them on that day. Saves automatically.
            </p>

            {/* Add form */}
            <div style={{ display:"flex", gap:10, marginBottom:20, flexWrap:"wrap", alignItems:"flex-end", background:"#f7f5f0", padding:14, borderRadius:10 }}>
              <div>
                <label style={{ display:"block", fontSize:10, color:"#666", marginBottom:4, fontWeight:"bold", textTransform:"uppercase", letterSpacing:1 }}>Person</label>
                <select value={newUnavail.name} onChange={e=>setNewUnavail(p=>({...p,name:e.target.value}))}
                  style={{ padding:"8px 10px", border:"2px solid #e0ddd5", borderRadius:8, fontFamily:"inherit", fontSize:12, minWidth:180 }}>
                  <option value="">— select —</option>
                  {staff.filter(s=>s.name.trim()).map(s=><option key={s.id}>{s.name}</option>)}
                </select>
              </div>
              <div>
                <label style={{ display:"block", fontSize:10, color:"#666", marginBottom:4, fontWeight:"bold", textTransform:"uppercase", letterSpacing:1 }}>Date</label>
                <input type="date" value={newUnavail.date} onChange={e=>setNewUnavail(p=>({...p,date:e.target.value}))}
                  style={{ padding:"8px 10px", border:"2px solid #e0ddd5", borderRadius:8, fontFamily:"inherit", fontSize:12 }} />
              </div>
              <button onClick={addUnavail}
                style={{ padding:"9px 18px", background:"#0f3460", color:"#e8c842", border:"none", borderRadius:8, cursor:"pointer", fontFamily:"inherit", fontSize:13, fontWeight:"bold" }}>
                + Add
              </button>
            </div>

            <table style={{ width:"100%", borderCollapse:"collapse", fontSize:12 }}>
              <thead>
                <tr>
                  {["Person","Date","Day","Status in current range",""].map(h=>(
                    <th key={h} style={{ ...thS, background:"#1a1a2e", color:"#e8c842", textAlign:"left", paddingLeft:12 }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {unavail.length === 0 && (
                  <tr><td colSpan={5} style={{ padding:20, color:"#aaa", textAlign:"center", fontStyle:"italic" }}>No unavailability recorded yet.</td></tr>
                )}
                {[...unavail].sort((a,b)=>a.date.localeCompare(b.date)).map((u,ui)=>{
                  const dt = parseLocalDate(u.date);
                  const isMeetingDay = dates.some(d=>dateKey(d)===u.date);
                  return (
                    <tr key={u.id} style={{ background:ui%2===0?"#fff":"#fafaf7" }}>
                      <td style={{ ...tdS, paddingLeft:12, fontWeight:"bold" }}>{u.name}</td>
                      <td style={{ ...tdS, paddingLeft:12 }}>{fmtDate(dt)}</td>
                      <td style={{ ...tdS, paddingLeft:12 }}>{fmtDay(dt)}</td>
                      <td style={{ ...tdS, paddingLeft:12, color:isMeetingDay?"#c00":"#aaa", fontWeight:isMeetingDay?"bold":"normal" }}>
                        {isMeetingDay ? "⚠️ Meeting day — will be skipped in auto-fill" : "No meeting scheduled"}
                      </td>
                      <td style={{ ...tdS, textAlign:"center" }}>
                        <button onClick={()=>setUnavail(prev=>prev.filter(x=>x.id!==u.id))}
                          style={{ background:"none", border:"none", cursor:"pointer", color:"#e55", fontSize:14 }}>✕</button>
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
          <div style={{ background:"#fff", borderRadius:12, padding:20, boxShadow:"0 2px 12px rgba(0,0,0,0.07)" }}>
            <h2 style={{ margin:"0 0 4px", color:"#1a1a2e", fontSize:16 }}>Assignment Summary</h2>
            <p style={{ margin:"0 0 16px", color:"#888", fontSize:12 }}>
              {autoFilled
                ? `Counts for current rota period (${dates.length} meetings). Green = assigned, amber = totals.`
                : "Generate the rota first to see assignment counts."}
            </p>
            {!autoFilled ? (
              <div style={{ color:"#bbb", fontStyle:"italic", padding:30, textAlign:"center" }}>
                Go to the <strong>Rota</strong> tab and click ⚡ Auto-Fill.
              </div>
            ) : (
              <div style={{ overflowX:"auto" }}>
                <table style={{ width:"100%", borderCollapse:"collapse", fontSize:11 }}>
                  <thead>
                    <tr>
                      <th style={{ ...thS, background:"#1a1a2e", color:"#e8c842", textAlign:"left", paddingLeft:12, minWidth:150 }}>Staff Name</th>
                      {JOBS.map(j=><th key={j} style={{ ...thS, background:"#1a1a2e", color:"#e8c842", minWidth:88 }}>{j}</th>)}
                      <th style={{ ...thS, background:"#e8c842", color:"#1a1a2e", minWidth:65 }}>TOTAL</th>
                    </tr>
                  </thead>
                  <tbody>
                    {staff.filter(s=>s.name.trim()).map((s,si)=>{
                      const sc = summary[s.name]||{};
                      const total = sc.__total||0;
                      return (
                        <tr key={s.id} style={{ background:si%2===0?"#fff":"#fafaf7" }}>
                          <td style={{ ...tdS, paddingLeft:12, fontWeight:"bold" }}>{s.name}</td>
                          {JOBS.map(j=>{
                            const v=sc[j]||0;
                            return <td key={j} style={{ ...tdS, textAlign:"center", background:v>0?"#e8f5e9":"inherit", color:v>0?"#2e7d32":"#ddd", fontWeight:v>0?"bold":"normal" }}>{v>0?v:"—"}</td>;
                          })}
                          <td style={{ ...tdS, textAlign:"center", fontWeight:"bold", background:total>0?"#fffbea":"#f8f8f8", color:total>0?"#7a6000":"#ccc" }}>{total||"—"}</td>
                        </tr>
                      );
                    })}
                    {/* Totals row */}
                    <tr style={{ borderTop:"2px solid #1a1a2e" }}>
                      <td style={{ ...tdS, paddingLeft:12, fontWeight:"bold", background:"#eef3f9", color:"#1a1a2e" }}>COLUMN TOTAL</td>
                      {JOBS.map(j=>{
                        const tot = staff.reduce((acc,s)=>(acc+(summary[s.name]?.[j]||0)),0);
                        return <td key={j} style={{ ...tdS, textAlign:"center", fontWeight:"bold", background:"#eef3f9", color:"#0f3460" }}>{tot||"—"}</td>;
                      })}
                      <td style={{ ...tdS, textAlign:"center", fontWeight:"bold", background:"#fffbea", color:"#7a6000" }}>
                        {staff.reduce((acc,s)=>(acc+(summary[s.name]?.__total||0)),0)||"—"}
                      </td>
                    </tr>
                  </tbody>
                </table>
                <div style={{ marginTop:14, padding:12, background:"#f7f5f0", borderRadius:8, fontSize:11, color:"#888" }}>
                  💡 If any column total is much higher than others, consider whether more people need training for that role.
                </div>
              </div>
            )}
          </div>
        )}

      </div>
    </div>
  );
}
