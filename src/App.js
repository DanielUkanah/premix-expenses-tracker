import React, { useState, useEffect, useMemo, useCallback } from "react";
import { Truck, Waves, ChevronLeft, ChevronRight, Plus, Trash2, Download, FileText, ArrowLeft, Loader2, FileBarChart, X, CheckSquare, Square } from "lucide-react";

// ---------- Brand tokens ----------
const MAGENTA = "#C4237F";
const MAGENTA_DARK = "#9B1B65";
const PURPLE = "#3A2472";
const PURPLE_DARK = "#281A52";
const LAVENDER = "#F5F1FA";
const INK = "#241A3D";
const LINE = "#E4DCF0";

const VEHICLES = [
  ...[1, 2, 3, 4, 5, 6, 7].map((n) => ({ id: `mixer-${n}`, name: `Mixer ${n}`, type: "mixer" })),
  ...[1, 2].map((n) => ({ id: `pump-${n}`, name: `Pump ${n}`, type: "pump" })),
];

const CATEGORIES = [
  "Fuel",
  "Maintenance & Repairs",
  "Tyres",
  "Spare Parts",
  "Driver Wages / Allowance",
  "Tolls & Levies",
  "Insurance",
  "Miscellaneous",
];

const MONTH_NAMES = ["January","February","March","April","May","June","July","August","September","October","November","December"];

function pad(n) { return String(n).padStart(2, "0"); }
function monthKey(year, month) { return `${year}-${pad(month + 1)}`; }
function todayStr() {
  const d = new Date();
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}
function fmtMoney(n) {
  return "₦" + Number(n || 0).toLocaleString("en-NG", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}
function uid() { return Math.random().toString(36).slice(2, 10) + Date.now().toString(36); }

function VehicleIcon({ type, ...props }) {
  return type === "pump" ? <Waves {...props} /> : <Truck {...props} />;
}

// ---------- External script loader for PDF export ----------
function useJsPDF() {
  const [ready, setReady] = useState(false);
  useEffect(() => {
    if (window.jspdf && window.jspdf.jsPDF) { setReady(true); return; }
    const s1 = document.createElement("script");
    s1.src = "https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js";
    s1.onload = () => {
      const s2 = document.createElement("script");
      s2.src = "https://cdnjs.cloudflare.com/ajax/libs/jspdf-autotable/3.8.2/jspdf.plugin.autotable.min.js";
      s2.onload = () => setReady(true);
      document.body.appendChild(s2);
    };
    document.body.appendChild(s1);
  }, []);
  return ready;
}

export default function App() {
  const [vehicleId, setVehicleId] = useState(null);
  return (
    <>
      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
        
        /* Responsive CSS Classes */
        .responsive-form-grid {
          display: grid;
          grid-template-columns: 1fr 1fr 2fr 1fr auto;
          gap: 10px;
          align-items: end;
        }
        
        @media (max-width: 768px) {
          .responsive-header {
            flex-direction: column !important;
            align-items: flex-start !important;
            gap: 16px !important;
          }
          .responsive-form-grid {
            grid-template-columns: 1fr !important;
          }
          .responsive-nav {
            flex-direction: column !important;
            align-items: stretch !important;
          }
          .responsive-nav > div {
            justify-content: space-between;
          }
          .responsive-export-buttons {
            width: 100%;
            justify-content: space-between;
          }
          .hide-mobile {
            display: none !important;
          }
        }
      `}</style>
      {vehicleId ? (
        <VehicleTracker vehicleId={vehicleId} onBack={() => setVehicleId(null)} />
      ) : (
        <FleetSelect onSelect={setVehicleId} />
      )}
    </>
  );
}

// ==================== FLEET SELECTION ====================
function FleetSelect({ onSelect }) {
  const mixers = VEHICLES.filter((v) => v.type === "mixer");
  const pumps = VEHICLES.filter((v) => v.type === "pump");
  const [exportOpen, setExportOpen] = useState(false);

  return (
    <div style={{ minHeight: "100vh", background: LAVENDER, fontFamily: "Inter, sans-serif", padding: "0 0 48px" }}>
      <div style={{ background: `linear-gradient(120deg, ${PURPLE_DARK} 0%, ${PURPLE} 55%, ${MAGENTA_DARK} 100%)`, padding: "36px 24px 44px", color: "#fff" }}>
        <div style={{ maxWidth: 880, margin: "0 auto" }}>
          
          <div className="responsive-header" style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
            <h1 style={{ fontFamily: "Poppins, sans-serif", fontWeight: 700, fontSize: 28, margin: 0, letterSpacing: 0.2 }}>
              Premix Expense Tracker
            </h1>
            <button
              onClick={() => setExportOpen(true)}
              style={{
                display: "flex", alignItems: "center", gap: 7, background: "rgba(255,255,255,0.15)",
                border: "1px solid rgba(255,255,255,0.35)", color: "#fff", borderRadius: 10,
                padding: "10px 16px", fontSize: 13, fontWeight: 600, cursor: "pointer", whiteSpace: "nowrap",
              }}
            >
              <FileBarChart size={16} /> Export Reports
            </button>
          </div>
          
          <p style={{ opacity: 0.85, fontSize: 14, margin: "12px 0 0" }}>Pick a mixer or pump to log and review its expenses.</p>
        </div>
      </div>

      <div style={{ maxWidth: 880, margin: "-24px auto 0", padding: "0 24px" }}>
        <FleetGroup title="Mixers" vehicles={mixers} onSelect={onSelect} />
        <FleetGroup title="Pumps" vehicles={pumps} onSelect={onSelect} />
      </div>

      {exportOpen && <ExportPanel onClose={() => setExportOpen(false)} />}
    </div>
  );
}

// ==================== MULTI-VEHICLE / MULTI-MONTH EXPORT ====================
function ExportPanel({ onClose }) {
  const jsPdfReady = useJsPDF();
  const now = new Date();
  const years = [];
  for (let y = now.getFullYear() - 3; y <= now.getFullYear() + 1; y++) years.push(y);

  const [mode, setMode] = useState("months"); // "months" | "year"
  const [selectedIds, setSelectedIds] = useState(new Set(VEHICLES.map((v) => v.id)));
  const [monthChips, setMonthChips] = useState([{ year: now.getFullYear(), month: now.getMonth() }]);
  const [chipMonth, setChipMonth] = useState(now.getMonth());
  const [chipYear, setChipYear] = useState(now.getFullYear());
  const [yearMode, setYearMode] = useState(now.getFullYear());
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState("");

  function toggleVehicle(id) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }
  function toggleAll() {
    setSelectedIds((prev) => (prev.size === VEHICLES.length ? new Set() : new Set(VEHICLES.map((v) => v.id))));
  }
  function addChip() {
    const exists = monthChips.some((c) => c.year === chipYear && c.month === chipMonth);
    if (exists) return;
    setMonthChips([...monthChips, { year: chipYear, month: chipMonth }].sort((a, b) => a.year - b.year || a.month - b.month));
  }
  function removeChip(idx) {
    setMonthChips(monthChips.filter((_, i) => i !== idx));
  }

  function monthsToExport() {
    if (mode === "year") return Array.from({ length: 12 }, (_, i) => ({ year: yearMode, month: i }));
    return monthChips;
  }

  // FIXED: Using STANDARD web localStorage instead of proprietary window.storage
  async function gatherRows() {
    const vehicles = VEHICLES.filter((v) => selectedIds.has(v.id));
    const months = monthsToExport();
    const rows = [];
    
    for (const v of vehicles) {
      for (const m of months) {
        const sKey = `expenses:${v.id}:${monthKey(m.year, m.month)}`;
        try {
          const res = localStorage.getItem(sKey);
          if (res) {
            const entries = JSON.parse(res);
            entries.forEach((e) =>
              rows.push({
                vehicle: v.name,
                monthLabel: `${MONTH_NAMES[m.month]} ${m.year}`,
                monthSort: monthKey(m.year, m.month),
                ...e,
              })
            );
          }
        } catch {
          /* nothing saved for this vehicle/month */
        }
      }
    }
    return rows;
  }

  function groupByVehicle(rows) {
    const order = [];
    const map = {};
    rows.forEach((r) => {
      if (!map[r.vehicle]) { map[r.vehicle] = []; order.push(r.vehicle); }
      map[r.vehicle].push(r);
    });
    return order.map((vehicle) => ({
      vehicle,
      rows: [...map[vehicle]].sort((a, b) => a.monthSort.localeCompare(b.monthSort) || a.date.localeCompare(b.date)),
    }));
  }

  function reportLabel() {
    if (mode === "year") return `${yearMode} Annual Report`;
    if (monthChips.length === 1) return monthChips.map((c) => `${MONTH_NAMES[c.month]} ${c.year}`)[0];
    return `${monthChips.length} Month Report`;
  }

  async function handleExportCSV() {
    setBusy(true); setStatus("");
    const rows = await gatherRows();
    setBusy(false);
    
    if (rows.length === 0) { setStatus("No expenses found for that selection."); return; }
    
    const groups = groupByVehicle(rows);
    const lines = [["Vehicle", "Month", "Date", "Category", "Description", "Amount (NGN)"]];
    let grand = 0;
    
    groups.forEach(({ vehicle, rows: list }) => {
      let subtotal = 0;
      list.forEach((r) => {
        lines.push([vehicle, r.monthLabel, r.date, r.category, r.description || "", Number(r.amount).toFixed(2)]);
        subtotal += Number(r.amount);
      });
      lines.push(["", "", "", "", `${vehicle} subtotal`, subtotal.toFixed(2)]);
      grand += subtotal;
    });
    
    lines.push(["", "", "", "", "GRAND TOTAL", grand.toFixed(2)]);
    const csv = lines.map((r) => r.map((c) => (/[",\n]/.test(String(c)) ? `"${String(c).replace(/"/g, '""')}"` : c).toString()).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `Premix_${reportLabel().replace(/\s+/g, "_")}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    setStatus("CSV downloaded.");
  }

  async function handleExportPDF() {
    if (!jsPdfReady || !window.jspdf) { setStatus("PDF engine still loading — try again in a moment."); return; }
    
    setBusy(true); setStatus("");
    const rows = await gatherRows();
    setBusy(false);
    
    if (rows.length === 0) { setStatus("No expenses found for that selection."); return; }
    
    const groups = groupByVehicle(rows);
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF();
    
    doc.setFontSize(16); doc.setTextColor(58, 36, 114);
    doc.text("Premix Expense Tracker", 14, 20);
    doc.setFontSize(12); doc.setTextColor(120, 120, 120);
    doc.text(`Generated Report — ${reportLabel()}`, 14, 28);

    let y = 36;
    let grand = 0;
    
    groups.forEach(({ vehicle, rows: list }) => {
      if (y > 250) { doc.addPage(); y = 20; }
      const subtotal = list.reduce((s, r) => s + Number(r.amount || 0), 0);
      grand += subtotal;
      
      doc.setFontSize(12); doc.setTextColor(58, 36, 114);
      doc.text(vehicle, 14, y);
      
      doc.autoTable({
        startY: y + 4,
        head: [["Month", "Date", "Category", "Description", "Amount (NGN)"]],
        body: list.map((r) => [r.monthLabel, r.date, r.category, r.description || "-", Number(r.amount).toLocaleString("en-NG", { minimumFractionDigits: 2 })]),
        foot: [["", "", "", "Subtotal", subtotal.toLocaleString("en-NG", { minimumFractionDigits: 2 })]],
        headStyles: { fillColor: [196, 35, 127], fontSize: 8 },
        footStyles: { fillColor: [245, 241, 250], textColor: [36, 26, 61], fontStyle: "bold", fontSize: 8 },
        styles: { fontSize: 8 },
        margin: { left: 14, right: 14 },
      });
      y = doc.lastAutoTable.finalY + 12;
    });
    
    if (y > 260) { doc.addPage(); y = 20; }
    doc.setFontSize(14); doc.setTextColor(196, 35, 127);
    doc.text(`Grand Total: ${fmtMoney(grand)}`, 14, y);
    doc.save(`Premix_${reportLabel().replace(/\s+/g, "_")}.pdf`);
    setStatus("PDF downloaded.");
  }

  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(36,26,61,0.55)", display: "flex", alignItems: "center", justifyContent: "center", padding: 16, zIndex: 50 }}>
      <div style={{ background: "#fff", borderRadius: 16, width: "100%", maxWidth: 620, maxHeight: "88vh", overflowY: "auto", padding: 24, fontFamily: "Inter, sans-serif" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 4 }}>
          <div style={{ fontFamily: "Poppins, sans-serif", fontWeight: 600, fontSize: 18, color: INK }}>Export Expense Report</div>
          <button onClick={onClose} style={{ background: "none", border: "none", cursor: "pointer", color: "#8B7FA8" }}><X size={20} /></button>
        </div>
        <p style={{ color: "#8B7FA8", fontSize: 13, marginTop: 4, marginBottom: 18 }}>
          Combine any vehicles with any months — or pull a full year at once.
        </p>

        {/* Vehicle picker */}
        <div style={{ marginBottom: 18 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: PURPLE, textTransform: "uppercase", letterSpacing: 0.6 }}>Vehicles</div>
            <button onClick={toggleAll} style={{ background: "none", border: "none", color: MAGENTA_DARK, fontSize: 12, fontWeight: 600, cursor: "pointer", display: "flex", alignItems: "center", gap: 5 }}>
              {selectedIds.size === VEHICLES.length ? <CheckSquare size={14} /> : <Square size={14} />} Select all
            </button>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(120px, 1fr))", gap: 8 }}>
            {VEHICLES.map((v) => {
              const on = selectedIds.has(v.id);
              return (
                <button
                  key={v.id}
                  onClick={() => toggleVehicle(v.id)}
                  style={{
                    display: "flex", alignItems: "center", gap: 6, padding: "8px 10px", borderRadius: 8,
                    border: `1px solid ${on ? MAGENTA : LINE}`, background: on ? "#FDF0F7" : "#fff",
                    color: on ? MAGENTA_DARK : "#6B6280", fontSize: 12.5, fontWeight: 600, cursor: "pointer", textAlign: "left",
                  }}
                >
                  {on ? <CheckSquare size={14} /> : <Square size={14} />} {v.name}
                </button>
              );
            })}
          </div>
        </div>

        {/* Mode toggle */}
        <div style={{ display: "flex", gap: 8, marginBottom: 14 }}>
          <button
            onClick={() => setMode("months")}
            style={{ flex: 1, padding: "8px 10px", borderRadius: 8, border: `1px solid ${mode === "months" ? MAGENTA : LINE}`, background: mode === "months" ? "#FDF0F7" : "#fff", color: mode === "months" ? MAGENTA_DARK : "#6B6280", fontWeight: 600, fontSize: 12.5, cursor: "pointer" }}
          >
            Pick specific months
          </button>
          <button
            onClick={() => setMode("year")}
            style={{ flex: 1, padding: "8px 10px", borderRadius: 8, border: `1px solid ${mode === "year" ? MAGENTA : LINE}`, background: mode === "year" ? "#FDF0F7" : "#fff", color: mode === "year" ? MAGENTA_DARK : "#6B6280", fontWeight: 600, fontSize: 12.5, cursor: "pointer" }}
          >
            Full year
          </button>
        </div>

        {mode === "months" ? (
          <div style={{ marginBottom: 18 }}>
            <div style={{ display: "flex", gap: 8, marginBottom: 10 }}>
              <select value={chipMonth} onChange={(e) => setChipMonth(Number(e.target.value))} style={selectStyle}>
                {MONTH_NAMES.map((m, i) => <option key={m} value={i}>{m}</option>)}
              </select>
              <select value={chipYear} onChange={(e) => setChipYear(Number(e.target.value))} style={selectStyle}>
                {years.map((y) => <option key={y} value={y}>{y}</option>)}
              </select>
              <button onClick={addChip} style={{ ...ghostBtnStyle }}><Plus size={14} /> Add</button>
            </div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
              {monthChips.length === 0 && <div style={{ fontSize: 12, color: "#8B7FA8" }}>No months added yet.</div>}
              {monthChips.map((c, i) => (
                <div key={i} style={{ display: "flex", alignItems: "center", gap: 6, background: LAVENDER, borderRadius: 20, padding: "5px 6px 5px 12px", fontSize: 12.5, color: PURPLE, fontWeight: 600 }}>
                  {MONTH_NAMES[c.month]} {c.year}
                  <button onClick={() => removeChip(i)} style={{ background: "none", border: "none", cursor: "pointer", color: PURPLE, display: "flex" }}><X size={13} /></button>
                </div>
              ))}
            </div>
          </div>
        ) : (
          <div style={{ marginBottom: 18 }}>
            <div style={{ fontSize: 12, color: "#8B7FA8", marginBottom: 8 }}>Includes January – December for the chosen year.</div>
            <select value={yearMode} onChange={(e) => setYearMode(Number(e.target.value))} style={selectStyle}>
              {years.map((y) => <option key={y} value={y}>{y}</option>)}
            </select>
          </div>
        )}

        {status && <div style={{ fontSize: 12.5, color: status.startsWith("No") ? "#B85C8C" : PURPLE, marginBottom: 12 }}>{status}</div>}

        <div style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}>
          <button
            onClick={handleExportCSV}
            disabled={busy || selectedIds.size === 0 || (mode === "months" && monthChips.length === 0)}
            style={ghostBtnStyle}
          >
            {busy ? <Loader2 size={14} style={{ animation: "spin 1s linear infinite" }} /> : <Download size={14} />} CSV
          </button>
          <button
            onClick={handleExportPDF}
            disabled={busy || !jsPdfReady || selectedIds.size === 0 || (mode === "months" && monthChips.length === 0)}
            style={primaryBtnStyle}
          >
            {busy ? <Loader2 size={14} style={{ animation: "spin 1s linear infinite" }} /> : <FileText size={14} />} PDF
          </button>
        </div>
      </div>
    </div>
  );
}

function FleetGroup({ title, vehicles, onSelect }) {
  return (
    <div style={{ marginTop: 28 }}>
      <div style={{ fontFamily: "Poppins, sans-serif", fontWeight: 600, fontSize: 13, letterSpacing: 1.2, textTransform: "uppercase", color: PURPLE, marginBottom: 12 }}>
        {title}
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(150px, 1fr))", gap: 14 }}>
        {vehicles.map((v) => (
          <button
            key={v.id}
            onClick={() => onSelect(v.id)}
            style={{
              position: "relative", overflow: "hidden", cursor: "pointer",
              border: `1px solid ${LINE}`, borderRadius: 14, background: "#fff",
              padding: "20px 16px", textAlign: "left", boxShadow: "0 2px 10px rgba(58,36,114,0.06)",
              transition: "transform 0.15s ease, box-shadow 0.15s ease",
            }}
            onMouseEnter={(e) => { e.currentTarget.style.transform = "translateY(-3px)"; e.currentTarget.style.boxShadow = "0 8px 20px rgba(196,35,127,0.18)"; }}
            onMouseLeave={(e) => { e.currentTarget.style.transform = "translateY(0)"; e.currentTarget.style.boxShadow = "0 2px 10px rgba(58,36,114,0.06)"; }}
          >
            <svg width="60" height="60" viewBox="0 0 60 60" style={{ position: "absolute", top: -14, right: -14, opacity: 0.9 }}>
              <polygon points="60,0 60,60 0,0" fill={v.type === "pump" ? PURPLE : MAGENTA} opacity="0.12" />
            </svg>
            <VehicleIcon type={v.type} size={22} color={v.type === "pump" ? PURPLE : MAGENTA} strokeWidth={2} />
            <div style={{ fontFamily: "Poppins, sans-serif", fontWeight: 600, fontSize: 15, color: INK, marginTop: 10 }}>{v.name}</div>
            <div style={{ fontSize: 12, color: "#8B7FA8", marginTop: 2 }}>View expenses →</div>
          </button>
        ))}
      </div>
    </div>
  );
}

// ==================== VEHICLE TRACKER ====================
function VehicleTracker({ vehicleId, onBack }) {
  const vehicle = VEHICLES.find((v) => v.id === vehicleId);
  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth());

  const [entries, setEntries] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const key = monthKey(year, month);
  const storageKey = `expenses:${vehicleId}:${key}`;
  const jsPdfReady = useJsPDF();

  const isCurrentMonth = year === now.getFullYear() && month === now.getMonth();

  // FIXED: Using STANDARD web localStorage instead of proprietary window.storage
  useEffect(() => {
    setLoading(true);
    try {
      const res = localStorage.getItem(storageKey);
      setEntries(res ? JSON.parse(res) : []);
    } catch {
      setEntries([]);
    } finally {
      setLoading(false);
    }
  }, [storageKey]);

  // FIXED: Using STANDARD web localStorage instead of proprietary window.storage
  const save = useCallback((next) => {
    setEntries(next);
    setSaving(true);
    try {
      localStorage.setItem(storageKey, JSON.stringify(next));
    } catch {
      /* best effort */
    } finally {
      setTimeout(() => setSaving(false), 300);
    }
  }, [storageKey]);

  const total = useMemo(() => entries.reduce((s, e) => s + Number(e.amount || 0), 0), [entries]);
  const sorted = useMemo(() => [...entries].sort((a, b) => a.date.localeCompare(b.date)), [entries]);

  function goMonth(delta) {
    let m = month + delta, y = year;
    if (m < 0) { m = 11; y -= 1; }
    if (m > 11) { m = 0; y += 1; }
    setMonth(m); setYear(y);
  }
  function goToday() { setMonth(now.getMonth()); setYear(now.getFullYear()); }

  function addEntry(entry) {
    save([...entries, { id: uid(), ...entry }]);
  }
  function deleteEntry(id) {
    save(entries.filter((e) => e.id !== id));
  }

  function exportCSV() {
    const header = ["Date", "Category", "Description", "Amount (NGN)"];
    const rows = sorted.map((e) => [e.date, e.category, (e.description || "").replace(/"/g, '""'), Number(e.amount).toFixed(2)]);
    rows.push(["", "", "TOTAL", total.toFixed(2)]);
    const csv = [header, ...rows]
      .map((r) => r.map((c) => (/[",\n]/.test(String(c)) ? `"${c}"` : c)).join(","))
      .join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `Premix_${vehicle.name.replace(/\s+/g, "_")}_${key}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  function exportPDF() {
    if (!jsPdfReady || !window.jspdf) return;
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF();
    doc.setFontSize(16);
    doc.setTextColor(58, 36, 114);
    doc.text("Premix Expense Tracker", 14, 20);
    doc.setFontSize(12);
    doc.setTextColor(120, 120, 120);
    doc.text(`${vehicle.name} — Expense Report — ${MONTH_NAMES[month]} ${year}`, 14, 28);

    doc.autoTable({
      startY: 36,
      head: [["Date", "Category", "Description", "Amount (NGN)"]],
      body: sorted.map((e) => [e.date, e.category, e.description || "-", Number(e.amount).toLocaleString("en-NG", { minimumFractionDigits: 2 })]),
      foot: [["", "", "Total", total.toLocaleString("en-NG", { minimumFractionDigits: 2 })]],
      headStyles: { fillColor: [196, 35, 127] },
      footStyles: { fillColor: [245, 241, 250], textColor: [36, 26, 61], fontStyle: "bold" },
      styles: { fontSize: 9 },
    });

    doc.save(`Premix_${vehicle.name.replace(/\s+/g, "_")}_${key}.pdf`);
  }

  const years = [];
  for (let y = now.getFullYear() - 3; y <= now.getFullYear() + 1; y++) years.push(y);

  return (
    <div style={{ minHeight: "100vh", background: LAVENDER, fontFamily: "Inter, sans-serif" }}>
      {/* Header */}
      <div style={{ background: `linear-gradient(120deg, ${PURPLE_DARK} 0%, ${PURPLE} 60%, ${MAGENTA_DARK} 100%)`, padding: "22px 24px", color: "#fff" }}>
        <div style={{ maxWidth: 920, margin: "0 auto" }}>
          <button onClick={onBack} style={{ background: "none", border: "none", color: "#E7D3EC", cursor: "pointer", display: "flex", alignItems: "center", gap: 6, fontSize: 13, padding: 0, marginBottom: 12 }}>
            <ArrowLeft size={15} /> Back to Fleet
          </button>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <VehicleIcon type={vehicle.type} size={28} />
            <h1 style={{ fontFamily: "Poppins, sans-serif", fontWeight: 600, fontSize: 24, margin: 0 }}>{vehicle.name}</h1>
          </div>
        </div>
      </div>

      <div style={{ maxWidth: 920, margin: "0 auto", padding: "20px 24px 48px" }}>
        {/* Month navigator */}
        <div className="responsive-nav" style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 12, background: "#fff", border: `1px solid ${LINE}`, borderRadius: 14, padding: "14px 18px", marginBottom: 18 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <button onClick={() => goMonth(-1)} style={iconBtnStyle}><ChevronLeft size={18} color={PURPLE} /></button>
            <div style={{ fontFamily: "Poppins, sans-serif", fontWeight: 600, fontSize: 16, color: INK, minWidth: 150, textAlign: "center" }}>
              {MONTH_NAMES[month]} {year}
            </div>
            <button onClick={() => goMonth(1)} style={iconBtnStyle}><ChevronRight size={18} color={PURPLE} /></button>
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <select value={month} onChange={(e) => setMonth(Number(e.target.value))} style={selectStyle}>
              {MONTH_NAMES.map((m, i) => <option key={m} value={i}>{m}</option>)}
            </select>
            <select value={year} onChange={(e) => setYear(Number(e.target.value))} style={selectStyle}>
              {years.map((y) => <option key={y} value={y}>{y}</option>)}
            </select>
            {!isCurrentMonth && (
              <button onClick={goToday} style={{ ...ghostBtnStyle, fontSize: 12 }}>Today</button>
            )}
          </div>
        </div>

        {/* Add expense */}
        <AddExpenseForm defaultDate={isCurrentMonth ? todayStr() : `${key}-01`} onAdd={addEntry} />

        {/* Table */}
        <div style={{ background: "#fff", border: `1px solid ${LINE}`, borderRadius: 14, marginTop: 18, overflow: "hidden" }}>
          <div className="responsive-nav" style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "14px 18px", borderBottom: `1px solid ${LINE}` }}>
            <div style={{ fontFamily: "Poppins, sans-serif", fontWeight: 600, color: INK }}>
              Expenses {saving && <Loader2 size={13} style={{ display: "inline", verticalAlign: "-2px", marginLeft: 6, animation: "spin 1s linear infinite" }} />}
            </div>
            <div className="responsive-export-buttons" style={{ display: "flex", gap: 8 }}>
              <button onClick={exportCSV} disabled={sorted.length === 0} style={ghostBtnStyle}>
                <Download size={14} /> <span className="hide-mobile">CSV</span>
              </button>
              <button onClick={exportPDF} disabled={sorted.length === 0 || !jsPdfReady} style={ghostBtnStyle}>
                <FileText size={14} /> <span className="hide-mobile">PDF</span>
              </button>
            </div>
          </div>

          {loading ? (
            <div style={{ padding: 32, textAlign: "center", color: "#8B7FA8", fontSize: 13 }}>Loading…</div>
          ) : sorted.length === 0 ? (
            <div style={{ padding: 32, textAlign: "center", color: "#8B7FA8", fontSize: 13 }}>
              No expenses logged for {MONTH_NAMES[month]} {year} yet.
            </div>
          ) : (
            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13.5 }}>
                <thead>
                  <tr style={{ background: LAVENDER, color: PURPLE, textAlign: "left" }}>
                    <th style={thStyle}>Date</th>
                    <th style={thStyle}>Category</th>
                    <th style={thStyle}>Description</th>
                    <th style={{ ...thStyle, textAlign: "right" }}>Amount</th>
                    <th style={thStyle}></th>
                  </tr>
                </thead>
                <tbody>
                  {sorted.map((e) => (
                    <tr key={e.id} style={{ borderTop: `1px solid ${LINE}` }}>
                      <td style={tdStyle}>{e.date}</td>
                      <td style={tdStyle}>{e.category}</td>
                      <td style={tdStyle}>{e.description || "—"}</td>
                      <td style={{ ...tdStyle, textAlign: "right", fontFamily: "'IBM Plex Mono', monospace" }}>{fmtMoney(e.amount)}</td>
                      <td style={{ ...tdStyle, textAlign: "right" }}>
                        <button onClick={() => deleteEntry(e.id)} style={{ background: "none", border: "none", cursor: "pointer", color: "#B85C8C" }}>
                          <Trash2 size={14} />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr style={{ borderTop: `2px solid ${PURPLE}` }}>
                    <td style={{ ...tdStyle, fontWeight: 700, color: INK }} colSpan={3}>Total</td>
                    <td style={{ ...tdStyle, textAlign: "right", fontWeight: 700, fontFamily: "'IBM Plex Mono', monospace", color: MAGENTA_DARK }}>{fmtMoney(total)}</td>
                    <td></td>
                  </tr>
                </tfoot>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function AddExpenseForm({ defaultDate, onAdd }) {
  const [date, setDate] = useState(defaultDate);
  const [category, setCategory] = useState(CATEGORIES[0]);
  const [description, setDescription] = useState("");
  const [amount, setAmount] = useState("");

  useEffect(() => { setDate(defaultDate); }, [defaultDate]);

  function submit(e) {
    e.preventDefault();
    if (!amount || Number(amount) <= 0 || !date) return;
    onAdd({ date, category, description: description.trim(), amount: Number(amount) });
    setDescription("");
    setAmount("");
  }

  return (
    <form onSubmit={submit} style={{ background: "#fff", border: `1px solid ${LINE}`, borderRadius: 14, padding: "16px 18px" }}>
      <div style={{ fontFamily: "Poppins, sans-serif", fontWeight: 600, color: INK, marginBottom: 12, fontSize: 14 }}>Add expense</div>
      <div className="responsive-form-grid">
        <Field label="Date">
          <input type="date" value={date} onChange={(e) => setDate(e.target.value)} style={inputStyle} required />
        </Field>
        <Field label="Category">
          <select value={category} onChange={(e) => setCategory(e.target.value)} style={inputStyle}>
            {CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
        </Field>
        <Field label="Description">
          <input type="text" value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Optional note" style={inputStyle} />
        </Field>
        <Field label="Amount (₦)">
          <input type="number" min="0" step="0.01" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="0.00" style={inputStyle} required />
        </Field>
        <button type="submit" style={{ ...primaryBtnStyle, height: 38 }}>
          <Plus size={16} /> Add
        </button>
      </div>
    </form>
  );
}

function Field({ label, children }) {
  return (
    <div>
      <div style={{ fontSize: 11, color: "#8B7FA8", marginBottom: 4, fontWeight: 600 }}>{label}</div>
      {children}
    </div>
  );
}

const inputStyle = {
  width: "100%", padding: "8px 10px", borderRadius: 8, border: `1px solid ${LINE}`,
  fontSize: 13, fontFamily: "Inter, sans-serif", color: INK, boxSizing: "border-box", background: "#fff",
};
const selectStyle = { ...inputStyle, width: "auto", padding: "7px 8px" };
const thStyle = { padding: "10px 14px", fontSize: 11.5, fontWeight: 700, letterSpacing: 0.3, textTransform: "uppercase" };
const tdStyle = { padding: "10px 14px", color: INK };
const iconBtnStyle = { background: LAVENDER, border: "none", borderRadius: 8, width: 32, height: 32, display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer" };
const ghostBtnStyle = {
  display: "flex", alignItems: "center", gap: 6, background: "#fff", border: `1px solid ${MAGENTA}`,
  color: MAGENTA_DARK, borderRadius: 8, padding: "7px 12px", fontSize: 12.5, fontWeight: 600, cursor: "pointer",
};
const primaryBtnStyle = {
  display: "flex", alignItems: "center", justifyContent: "center", gap: 6,
  background: `linear-gradient(120deg, ${MAGENTA} 0%, ${PURPLE} 100%)`, color: "#fff",
  border: "none", borderRadius: 8, padding: "8px 16px", fontSize: 13, fontWeight: 600, cursor: "pointer",
};