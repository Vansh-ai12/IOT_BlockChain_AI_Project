"use client";

import Link from "next/link";
import { useState, useEffect, useMemo } from "react";
import MonitorShell from "../../components/MonitorShell";

const API_ALERTS = "http://localhost:9000/alerts";

function parseSensorCsv(text) {
  const lines = String(text)
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);
  if (lines.length < 2) return { headers: [], rows: [] };

  const headers = lines[0].split(",").map((h) => h.trim()).filter(Boolean);
  const rows = [];
  for (let i = 1; i < lines.length; i += 1) {
    const values = lines[i].split(",").map((v) => v.trim());
    const row = {};
    for (let j = 0; j < headers.length; j += 1) {
      const key = headers[j];
      const raw = values[j] ?? "";
      const n = Number(raw);
      row[key] = raw !== "" && Number.isFinite(n) ? n : raw;
    }
    rows.push(row);
  }
  return { headers, rows };
}

function rowMaxNumeric(row, headers) {
  let max = 0;
  for (const h of headers) {
    const v = row[h];
    if (typeof v === "number") max = Math.max(max, v);
  }
  return max;
}

async function postSensorThresholdAlerts(rows, headers) {
  const thresholds = [
    {
      key: "vibration",
      max: 70,
      severity: "High",
      title: "High vibration (sensor CSV)",
    },
    {
      key: "strain",
      max: 55,
      severity: "Medium",
      title: "Elevated strain (sensor CSV)",
    },
    {
      key: "tilt",
      max: 25,
      severity: "Medium",
      title: "Elevated tilt (sensor CSV)",
    },
  ];

  for (const row of rows) {
    for (const t of thresholds) {
      const v = row[t.key];
      if (typeof v === "number" && v > t.max) {
        try {
          await fetch(API_ALERTS, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              title: t.title,
              message: `${t.key}=${v} exceeded threshold ${t.max} in uploaded sensor file.`,
              location: "Sensor Data / CSV upload",
              severity: t.severity,
              source: "sensor",
              metadata: { row, thresholdKey: t.key, thresholdMax: t.max },
            }),
          });
        } catch {
          // non-blocking
        }
      }
    }
  }
}

export default function SensorData() {
  const [headers, setHeaders] = useState([]);
  const [rows, setRows] = useState([]);
  const [aiStatus, setAiStatus] = useState("Waiting for signal...");

  const [anchoring, setAnchoring] = useState(false);
  const [anchorProgress, setAnchorProgress] = useState(0);
  const [anchorError, setAnchorError] = useState("");

  useEffect(() => {
    // SSE Listener for real-time simulation updates
    // Matching 'newRecord' event from server/routes/iota.js
    const es = new EventSource("http://localhost:9000/iota/records/stream");
    
    es.addEventListener("newRecord", (evt) => {
      try {
        const rec = JSON.parse(evt.data);
        if (rec.aiPrediction) {
          setAiStatus(rec.aiPrediction);
        }
        if (rec.features) {
          const isArray = Array.isArray(rec.features);
          const latestRow = isArray ? rec.features[rec.features.length - 1] : rec.features;
          
          setHeaders(Object.keys(latestRow));
          
          if (isArray) {
            // When receiving a window, use the entire window to make the chart lively
            setRows(rec.features.reverse().slice(0, 50)); 
          } else {
            setRows((prev) => [rec.features, ...prev].slice(0, 50));
          }
        }
      } catch (err) {
        console.warn("SSE parse error:", err);
      }
    });

    return () => es.close();
  }, []);

  const handleFileUpload = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();

    reader.onload = async (event) => {
      const text = event.target.result;
      const { headers: h, rows: r } = parseSensorCsv(text);
      setHeaders(h);
      setRows(r);
      if (r.length) await postSensorThresholdAlerts(r, h);
    };

    reader.readAsText(file);
  };

  const anchorAllToBlockchain = async () => {
    if (!rows.length) {
      setAnchorError("Please upload a CSV file first!");
      return;
    }
    setAnchoring(true);
    setAnchorError("");
    setAnchorProgress(0);

    try {
      for (let i = 0; i < rows.length; i++) {
        const res = await fetch("http://localhost:9000/iota/write-data", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ features: rows[i] }),
        });
        if (!res.ok) throw new Error(`Row ${i + 1} failed`);
        setAnchorProgress(i + 1);
      }
    } catch (err) {
      setAnchorError(err.message);
    } finally {
      setAnchoring(false);
    }
  };

  const evaluation = useMemo(() => {
    if (rows.length === 0) return null;
    // Map to your real numeric columns (24 and 25 seem most dynamic)
    const activeCol1 = "24";
    const activeCol2 = "25";
    
    const peakVal1 = Math.max(...rows.map((r) => Math.abs(r[activeCol1] || 0)));
    const peakVal2 = Math.max(...rows.map((r) => Math.abs(r[activeCol2] || 0)));

    let statusColor = "text-green-400";
    if (aiStatus === "Damaged") {
      statusColor = "text-red-500";
    }

    return { peakVal1, peakVal2, status: aiStatus, statusColor };
  }, [rows, aiStatus]);

  const chartPoints = useMemo(() => {
    if (rows.length === 0) return null;
    // Show all 50 samples from the sliding window for a complete structural profile
    const data = [...rows].reverse().slice(0, 50); 
    // Channels 24, 25, and 0 for baseline
    const cols = ["24", "25", "0"];
    
    const getPath = (key) => {
      const vals = data.map(r => r[key] || 0);
      const maxAbs = Math.max(...vals.map(Math.abs), 1);
      
      return data.map((r, i) => {
        const x = (i / (data.length - 1)) * 100;
        // Center-aligned scaling for +/- data
        const y = 50 - ((r[key] || 0) / (maxAbs * 2)) * 100;
        return `${x},${y}`;
      }).join(" ");
    };

    return {
      c24: getPath("24"),
      c25: getPath("25"), 
      c0: getPath("0")
    };
  }, [rows]);

  return (
    <MonitorShell active="sensor-data">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-semibold text-white">Sensor Intelligence</h1>
          <p className="text-zinc-500 text-sm">Monitoring {headers.length} high-precision data streams from the structure</p>
        </div>
        <Link
          href="/dashboard"
          className="shrink-0 px-4 py-2 rounded border border-[#1f2a23] hover:bg-[#101713] text-sm text-gray-200"
        >
          Go to Dashboard
        </Link>
      </div>


      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="border border-[#1f2a23] rounded-lg p-6 bg-[#0f1511] relative overflow-hidden">
          <h3 className="text-zinc-500 text-xs uppercase tracking-widest mb-2">Overall Structural Health</h3>
          <p className={`text-3xl font-bold ${evaluation?.statusColor || "text-zinc-600"}`}>
            {evaluation?.status || "Waiting for signal..."}
          </p>
          <div className="mt-4 flex items-center gap-2 text-xs">
            <span className="w-2 h-2 rounded-full bg-green-400 animate-pulse"></span>
            <span className="text-zinc-400">AI monitoring Primary Strain (CH-24) for anomalies...</span>
          </div>
        </div>

        <div className="md:col-span-2 border border-[#1f2a23] rounded-lg p-6 bg-[#0f1511]">
          <h3 className="text-zinc-500 text-xs uppercase tracking-widest mb-2">Primary Vibration Signal (Channel 24)</h3>
          <div className="flex items-baseline gap-4">
            <p className="text-5xl font-black text-white font-mono tracking-tighter">
              {evaluation ? evaluation.peakVal1.toFixed(4) : "0.0000"}
            </p>
            <span className="text-zinc-600 text-sm font-bold uppercase tracking-widest">Magnitude (Hz)</span>
          </div>
          <div className="mt-6 h-2 w-full bg-[#1a231d] rounded-full overflow-hidden border border-green-900/20">
            <div 
              className="h-full bg-gradient-to-r from-green-600 to-green-400 transition-all duration-300" 
              style={{ width: `${evaluation ? Math.min(100, evaluation.peakVal1 * 10) : 0}%` }}
            ></div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 border border-[#1f2a23] rounded-lg bg-[#0f1511] p-6 shadow-2xl">
          <div className="flex justify-between items-center mb-6">
            <h3 className="text-green-400 font-bold uppercase tracking-widest text-sm flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-green-500"></span>
              Live Signal Waveform (Main Structural Oscillation)
            </h3>
            <div className="flex gap-4 text-[10px] uppercase font-bold">
              <span className="flex items-center gap-1 text-green-500">Strain Axis (CH-24)</span>
              <span className="flex items-center gap-1 text-zinc-700 decoration-line-through">Static Axis (CH-0)</span>
            </div>
          </div>
          
          <div className="h-64 w-full relative">
            {chartPoints ? (
              <svg viewBox="0 0 100 100" preserveAspectRatio="none" className="w-full h-full overflow-visible">
                {/* Grid Lines */}
                <line x1="0" y1="25" x2="100" y2="25" stroke="#101814" strokeWidth="0.5" />
                <line x1="0" y1="75" x2="100" y2="75" stroke="#101814" strokeWidth="0.5" />
                {/* Zero Baseline */}
                <line x1="0" y1="50" x2="100" y2="50" stroke="#1f2a23" strokeWidth="1" strokeDasharray="4,4" />
                
                {/* Channel 25 (Secondary) */}
                <polyline points={chartPoints.c25} fill="none" stroke="#2563eb" strokeWidth="1" strokeOpacity="0.5" strokeLinejoin="round" />
                
                {/* Channel 24 (Primary) */}
                <polyline points={chartPoints.c24} fill="none" stroke="#22c55e" strokeWidth="1.5" strokeLinejoin="round" />
              </svg>
            ) : (
              <div className="flex items-center justify-center h-full text-zinc-700 italic">Syncing Channel 24 stream...</div>
            )}
          </div>
          <p className="mt-4 text-[10px] text-zinc-600 italic">Showing the most recent 30 samples of structural oscillation.</p>
        </div>

        <div className="border border-[#1f2a23] rounded-lg bg-[#0f1511] p-6 flex flex-col justify-between shadow-xl">
          <div>
            <h3 className="text-green-400 mb-4 font-bold uppercase tracking-wider text-xs">Ledger Synchronization</h3>
            <div className="p-4 bg-[#0b0f0c] rounded border border-[#1f2a23] mb-4">
              <p className="text-xs text-zinc-500 mb-2 font-mono tracking-tighter">DATA SOURCE: Structural Sensors</p>
              <p className="text-[10px] text-zinc-600 leading-relaxed font-medium">
                We have filtered out redundant noise (Indices 9 and 25). 
                Channel 24 is being streamed to the Immutable Ledger for permanent tracking.
              </p>
            </div>
          </div>

          <button
            onClick={anchorAllToBlockchain}
            disabled={anchoring || !rows.length}
            className="w-full py-4 bg-green-500 text-black font-black uppercase tracking-tighter rounded-lg hover:bg-green-400 disabled:opacity-50 transition-all shadow-[0_0_20px_rgba(34,197,94,0.3)] hover:scale-[1.02] active:scale-95 mb-3"
          >
            {anchoring ? `SYNCING ${anchorProgress}/${rows.length}` : "Sync Signal Records"}
          </button>

          <button
            onClick={() => {
              // PRIVACY FILTER: Remove technical database details
              const cleanRows = rows.map((row) => {
                const { _id, proofHash, metadata, createdAt, updatedAt, ...visibleData } = row;
                return visibleData;
              });
              const blob = new Blob([JSON.stringify(cleanRows, null, 2)], { type: "application/json" });
              const url = URL.createObjectURL(blob);
              const a = document.createElement("a");
              a.href = url;
              a.download = `signal_records_${Date.now()}.json`;
              a.click();
            }}
            disabled={!rows.length}
            className="w-full py-2 bg-zinc-900 text-zinc-400 border border-[#1f2a23] text-[10px] font-bold uppercase tracking-widest rounded-lg hover:bg-zinc-800 transition-all"
          >
            Download Signal Log
          </button>
        </div>
      </div>

      <div className="border border-[#1f2a23] rounded-lg bg-[#0f1511] p-6 shadow-2xl">
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-green-400 font-bold uppercase tracking-widest text-sm">Filtered Data Matrix</h3>
          <span className="text-[9px] text-zinc-600 font-mono">CHANNELS 20-24 ONLY (OPTIMIZED)</span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-xs text-gray-400 min-w-[700px]">
            <thead className="border-b border-[#1f2a23] text-zinc-500 uppercase font-bold">
              <tr>
                <th className="text-left py-4 px-2">Seq ID</th>
                <th className="text-left py-4 px-2">Status</th>
                <th className="text-left py-4 px-2">CH-20</th>
                <th className="text-left py-4 px-2">CH-21 (Vib)</th>
                <th className="text-left py-4 px-2">CH-22 (Tilt)</th>
                <th className="text-left py-4 px-2">CH-23 (Tilt)</th>
                <th className="text-left py-4 px-2 bg-[#121c15] text-green-400">CH-24 (PRIMARY STRAIN)</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-900/50">
              {rows.slice(0, 50).map((row, i) => {
                const val24 = Math.abs(row["24"] || 0);
                const isCrit = val24 > 8;

                return (
                  <tr key={i} className="hover:bg-[#0b0f0c] group transition-colors">
                    <td className="py-3 px-2 font-mono text-zinc-600">ID-{String(rows.length - i).padStart(4, '0')}</td>
                    <td className="py-3 px-2">
                       <div className={`px-2 py-0.5 rounded text-[9px] font-bold w-fit ${isCrit ? "bg-red-500/80 text-white" : "bg-green-900/20 text-green-500"}`}>
                         {isCrit ? "ANOMALY" : "STABLE"}
                       </div>
                    </td>
                    <td className="py-3 px-2 text-zinc-600">{row["20"]?.toFixed(6)}</td>
                    <td className="py-3 px-2 text-zinc-600">{row["21"]?.toFixed(6)}</td>
                    <td className="py-3 px-2 text-zinc-600">{row["22"]?.toFixed(6)}</td>
                    <td className="py-3 px-2 text-zinc-500 font-medium">{row["23"]?.toFixed(6)}</td>
                    <td className={`py-3 px-2 font-mono font-bold bg-[#121c15]/30 ${isCrit ? "text-red-400" : "text-green-400"}`}>
                      {row["24"]?.toFixed(4)}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </MonitorShell>
  );
}
