"use client";

import { useMemo, useState, useEffect } from "react";
import Link from "next/link";
import MonitorShell from "../../components/MonitorShell";

const API_ALERTS = "http://localhost:9000/alerts";
const API_IOTA = "http://localhost:9000/iota";

function parseCsvTable(text) {
  const lines = String(text)
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);

  if (lines.length < 2) return null;

  const headers = lines[0].split(",").map((h) => h.trim()).filter(Boolean);
  const dataLines = lines.slice(1);
  return { headers, dataLines };
}

function lineToFeatures(headers, line) {
  const values = line.split(",").map((v) => v.trim());
  const row = {};
  for (let i = 0; i < headers.length; i += 1) {
    const key = headers[i] || `col_${i + 1}`;
    const raw = values[i] ?? "";
    const asNum = Number(raw);
    row[key] = raw !== "" && Number.isFinite(asNum) ? asNum : raw;
  }
  return row;
}

function maxNumericInRow(obj) {
  let max = 0;
  for (const v of Object.values(obj)) {
    if (typeof v === "number") max = Math.max(max, v);
  }
  return max;
}

function formatTs(iso) {
  try {
    return new Date(iso).toLocaleString(undefined, {
      day: "2-digit",
      month: "short",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hour12: true,
    });
  } catch {
    return iso || "—";
  }
}

export default function Dashboard() {
  const [dataset, setDataset] = useState("");
  const [prediction, setPrediction] = useState("");
  const [inferenceKey, setInferenceKey] = useState(0);
  const [blockchainResult, setBlockchainResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [records, setRecords] = useState([]);
  const [totalAnchored, setTotalAnchored] = useState(0);
  const [simProgress, setSimProgress] = useState(null);
  const [liveWindow, setLiveWindow] = useState(null);
  const [anchorRowNumber, setAnchorRowNumber] = useState(1);
  const [perfStats, setPerfStats] = useState(null);
  const [nowStr, setNowStr] = useState("");

  // Live clock — updates every second
  useEffect(() => {
    const tick = () => setNowStr(new Date().toLocaleString(undefined, {
      weekday: "short", day: "2-digit", month: "short",
      hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: true,
    }));
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, []);

  const csvTable = useMemo(() => parseCsvTable(dataset), [dataset]);
  const dataRowCount = csvTable?.dataLines.length ?? 0;

  // Initial fetch and SSE stream
  useEffect(() => {
    async function load() {
      try {
        const res = await fetch(`${API_IOTA}/records?limit=10`);
        const json = await res.json();
        if (json.success) {
          setRecords(json.records || []);
          setTotalAnchored(json.totalCount || 0);
        }
        
        const perfRes = await fetch(`${API_IOTA}/performance-stats`);
        const perfJson = await perfRes.json();
        if (perfJson.success) {
          setPerfStats(perfJson.summary);
        }
      } catch (err) {
        console.error("Failed to load initial data", err);
      }
    }
    load();

    const es = new EventSource(`${API_IOTA}/records/stream`);
    es.addEventListener("newRecord", (evt) => {
      try {
        const rec = JSON.parse(evt.data);
        setRecords((prev) => {
          const filtered = prev.filter((r) => r._id !== rec._id);
          return [rec, ...filtered].slice(0, 10);
        });

        // Update live window indicator
        if (rec.windowStart != null && rec.windowEnd != null) {
          setLiveWindow({ start: rec.windowStart, end: rec.windowEnd });
        }
        
        if (!rec.isDuplicate) {
          setTotalAnchored((prev) => prev + 1);
          
          // Live Performance Matrix Update
          setPerfStats((prev) => {
            if (!prev) return null;
            const newTotal = prev.totalTransactions + 1;
            return {
              ...prev,
              totalTransactions: newTotal,
              avgBlockchainTime: (prev.avgBlockchainTime * prev.totalTransactions + (rec.blockchainTimeMs || 0)) / newTotal,
              maxBlockchainTime: Math.max(prev.maxBlockchainTime, rec.blockchainTimeMs || 0),
              totalPayloadSize: prev.totalPayloadSize + (rec.payloadSizeBytes || 0),
            };
          });
        } // ADDED MISSING BRACE HERE
        
        // Update Analysis Status from AI Model
        if (rec.aiPrediction) {
          setPrediction(rec.aiPrediction);
          setInferenceKey(Date.now()); // Set unique timestamp to force visual flash
        }
      } catch (err) {
        console.warn("SSE Parse Error:", evt.data, err);
      }
    });

    es.addEventListener("simulationProgress", (evt) => {
      try {
        setSimProgress(JSON.parse(evt.data));
      } catch (err) {
        // ignore
      }
    });

    return () => es.close();
  }, []);

  const chartBars = useMemo(() => {
    // Priority: Show live simulation records if available
    if (records.length > 0) {
      // Show metrics for last 10 records
      return records.map((rec) => {
        const rows = Array.isArray(rec.features) ? rec.features : [rec.features];
        return maxNumericInRow(rows[rows.length - 1]);
      });
    }
    // Fallback: manual dataset
    if (!csvTable || csvTable.dataLines.length === 0) return [];
    return csvTable.dataLines.slice(0, 10).map((line) => {
      const row = lineToFeatures(csvTable.headers, line);
      return maxNumericInRow(row);
    });
  }, [records, csvTable]);



  const storeBlockchain = async () => {
    if (!dataset) return;
    if (!csvTable || dataRowCount < 1) {
      setBlockchainResult({
        success: false,
        error: "Paste CSV with a header row + at least 1 data row.",
      });
      return;
    }
    const idx = anchorRowNumber - 1;
    if (idx < 0 || idx >= dataRowCount) {
      setBlockchainResult({
        success: false,
        error: `Pick a row between 1 and ${dataRowCount}.`,
      });
      return;
    }
    const line = csvTable.dataLines[idx];
    const features = lineToFeatures(csvTable.headers, line);
    setLoading(true);
    setBlockchainResult(null); // Clear previous
    try {
      const res = await fetch(`${API_IOTA}/write-data`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ features }),
      });
      const json = await res.json();
      setBlockchainResult(json);
    } catch (err) {
      setBlockchainResult({ success: false, error: err.message });
    } finally {
      setLoading(false);
    }
  };

  return (
    <MonitorShell active="dashboard">
      {/* HEADER SECTION */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 gap-4">
        <div>
          <h1 className="text-3xl font-bold bg-gradient-to-r from-white via-zinc-400 to-zinc-600 bg-clip-text text-transparent">
            Blockchain Health Ledger
          </h1>
          <p className="text-zinc-500 text-sm mt-1">Real-time structural health monitoring via Immutable Blockchain Records</p>
        </div>

        <div className="flex flex-wrap gap-3 items-stretch">
          <div className="bg-[#0b0f0c] border border-[#1f2a23] px-4 py-2 rounded-xl min-w-[150px]">
            <p className="text-[9px] text-zinc-600 uppercase tracking-widest mb-1">System Time</p>
            <p className="text-[11px] font-mono text-green-400 font-bold leading-tight">{nowStr || "—"}</p>
          </div>
          <div className="bg-[#0b0f0c] border border-green-900/40 px-4 py-2 rounded-xl">
            <p className="text-[9px] text-zinc-600 uppercase tracking-widest mb-1">Live Window</p>
            {liveWindow ? (
              <div className="flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse"></span>
                <span className="text-sm font-black font-mono text-green-400">Rows {liveWindow.start}–{liveWindow.end}</span>
              </div>
            ) : (
              <span className="text-[10px] text-zinc-600 font-mono italic">Syncing...</span>
            )}
            <p className="text-[9px] text-zinc-700 mt-0.5">50-row sliding window</p>
          </div>
          <div className="bg-[#111814] border border-[#1f2a23] px-4 py-2 rounded-xl flex flex-col justify-center min-w-[120px]">
            <p className="text-[9px] text-zinc-600 uppercase tracking-widest mb-1">Building Status</p>
            <p className={`text-sm font-black uppercase tracking-tighter leading-none ${
              prediction === "Damaged" ? "text-red-500" : "text-green-400"
            }`}>
              {prediction || "Healthy"}
            </p>
          </div>
          <div className="bg-[#111814] border border-[#1f2a23] px-4 py-2 rounded-xl">
            <p className="text-[9px] text-zinc-600 uppercase tracking-widest mb-1">On Blockchain</p>
            <p className="text-2xl font-black text-white font-mono tracking-tighter leading-none">
              {totalAnchored.toLocaleString()}
            </p>
          </div>
        </div>
      </div>

      {/* WAVEFORM AND METRICS SECTION */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
        <div className="p-6 border border-[#1f2a23] rounded-2xl bg-[#0f1511] shadow-2xl relative overflow-hidden group">
          <h3 className="text-green-500 font-bold uppercase tracking-[0.3em] text-[10px] mb-8">Live Signal Waveform</h3>
          {chartBars.length === 0 ? (
            <div className="h-44 flex items-center justify-center border border-dashed border-zinc-900 rounded-xl">
               <p className="text-xs text-zinc-700 font-mono animate-pulse">WAITING FOR SENSOR STREAM...</p>
            </div>
          ) : (
            <div className="h-44 flex items-end justify-between w-full px-4 pt-8">
              {chartBars.map((val, i) => {
                const maxVal = Math.max(...chartBars, 10);
                const heightPct = Math.max(5, (val / maxVal) * 100);
                return (
                  <div key={i} className="flex flex-col items-center group w-8 h-full justify-end cursor-pointer">
                    <div className="opacity-0 group-hover:opacity-100 transition-opacity text-[10px] text-green-400 font-mono font-bold mb-2 bg-[#0b0f0c] px-2 py-0.5 rounded border border-green-900/50">
                      {typeof val === 'number' ? val.toFixed(2) : "0"}
                    </div>
                    <div 
                      style={{ height: `${heightPct}%` }}
                      className="w-1 bg-[#1a231d] rounded-t-full relative flex justify-center transition-all duration-500 group-hover:bg-green-900"
                    >
                       <div className="absolute top-0 w-2 h-2 bg-green-500 rounded-full shadow-[0_0_10px_#22c55e] group-hover:bg-white transition-colors"></div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
          <div className="mt-8 flex justify-between items-center text-[9px] text-zinc-600 font-mono uppercase tracking-widest border-t border-zinc-900 pt-4">
             <span>CHANNEL 24 AMPLITUDE</span>
             <span className="text-green-900">Live Frequency Sync</span>
          </div>
        </div>

        <div className="p-6 border border-[#1f2a23] rounded-2xl bg-[#0f1511] shadow-2xl">
          <h3 className="text-green-500 font-bold uppercase tracking-[0.3em] text-[10px] mb-8">Network & Performance Matrix</h3>
          
          <div className="grid grid-cols-2 gap-3 mb-6">
            <div className="bg-[#0b0f0c] p-3 rounded-xl border border-[#1f2a23]">
              <p className="text-[9px] text-zinc-500 uppercase tracking-widest mb-1">Per Transaction Time</p>
              <p className="text-sm font-bold text-white font-mono">
                {perfStats?.avgBlockchainTime ? (perfStats.avgBlockchainTime / 1000).toFixed(2) : "0.00"}s
              </p>
            </div>
            <div className="bg-[#0b0f0c] p-3 rounded-xl border border-[#1f2a23]">
              <p className="text-[9px] text-zinc-500 uppercase tracking-widest mb-1">Total Windows Saved</p>
              <p className="text-sm font-bold text-green-400 font-mono">
                {perfStats?.totalTransactions || "0"}
              </p>
            </div>
            <div className="bg-[#0b0f0c] p-3 rounded-xl border border-[#1f2a23]">
              <p className="text-[9px] text-zinc-500 uppercase tracking-widest mb-1">Data Reading Time</p>
              <p className="text-sm font-bold text-yellow-400 font-mono">
                {perfStats?.avgTotalTime ? ((perfStats.avgTotalTime - perfStats.avgBlockchainTime) / 1000).toFixed(2) : "0.00"}s
              </p>
            </div>
            <div className="bg-[#0b0f0c] p-3 rounded-xl border border-[#1f2a23]">
              <p className="text-[9px] text-zinc-500 uppercase tracking-widest mb-1">1 Window Total Time</p>
              <p className="text-sm font-bold text-white font-mono">
                {perfStats?.avgTotalTime ? (perfStats.avgTotalTime / 1000).toFixed(2) : "0.00"}s
              </p>
            </div>
            <div className="col-span-2 bg-[#0b0f0c] p-3 rounded-xl border border-green-900/30">
              <p className="text-[9px] text-green-500 uppercase tracking-widest mb-1">Total Data Anchored Payload</p>
              <p className="text-sm font-bold text-green-400 font-mono">
                {perfStats?.totalPayloadSize ? (perfStats.totalPayloadSize / 1024).toFixed(2) : "0.00"} KB
              </p>
            </div>
          </div>

          <div className="space-y-4">
            <div className="flex justify-between items-center p-4 bg-[#0b0f0c] rounded-xl border border-[#1f2a23]">
              <span className="text-[10px] uppercase font-bold text-zinc-500 tracking-widest">Stability Index</span>
              <span className="text-xs font-bold text-zinc-300">Synchronized</span>
            </div>
            <div className="flex justify-between items-center p-4 bg-[#0b0f0c] rounded-xl border border-[#1f2a23]">
              <span className="text-sm text-zinc-400">Blockchain Validation</span>
              <span className="text-xs font-bold text-zinc-300">Synchronized</span>
            </div>
          </div>
        </div>
      </div>

      {/* LIVE BLOCKCHAIN ACTIVITY SECTION */}
      <div className="border border-[#1f2a23] rounded-2xl bg-[#0f1511] shadow-2xl overflow-hidden">
        <div className="p-6 border-b border-[#1f2a23] flex justify-between items-center bg-[#141b17]">
          <div className="flex items-center gap-3">
             <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse"></div>
             <div>
                <h2 className="text-xl font-bold text-white tracking-tight">Last 10 On-Chain Transactions</h2>
                <p className="text-[10px] text-zinc-500 uppercase tracking-[0.2em] mt-0.5">IOTA Ledger Proofs</p>
             </div>
          </div>
          <div className="bg-[#0b0f0c] border border-green-900/30 px-3 py-1 rounded text-[10px] text-green-400 font-bold font-mono">
             NETWORK: ACTIVE
          </div>
        </div>
        
        <div className="overflow-x-auto">
          <table className="w-full text-xs text-left">
            <thead>
              <tr className="text-zinc-500 border-b border-[#1f2a23] bg-[#0b0f0c]/50">
                <th className="px-6 py-4 font-medium uppercase tracking-wider">Record ID</th>
                <th className="px-4 py-4 font-medium uppercase tracking-wider text-green-600">Verified Window</th>
                <th className="px-6 py-4 font-medium uppercase tracking-wider">Anchored At</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-900">
              {records.length === 0 ? (
                <tr>
                  <td colSpan="4" className="px-6 py-12 text-center text-zinc-700 italic font-mono uppercase tracking-widest">
                    Loading blockchain records...
                  </td>
                </tr>
              ) : (
                records.map((rec) => (
                  <tr key={rec._id} className="hover:bg-[#121a15] transition-all">
                    <td className="px-6 py-4 font-mono text-zinc-400">
                      #{String(rec._id).slice(-4).toUpperCase()}
                      {rec.isDuplicate && (
                        <span className="ml-2 text-[8px] bg-zinc-800 text-zinc-400 px-1 rounded uppercase">Duplicate</span>
                      )}
                    </td>
                    <td className="px-4 py-4">
                      {rec.windowStart != null && rec.windowEnd != null ? (
                        <span className="inline-block font-mono font-bold text-green-400 bg-green-900/10 border border-green-900/30 px-2 py-1 rounded text-[10px]">
                          Rows {rec.windowStart}–{rec.windowEnd}
                        </span>
                      ) : (
                        <span className="text-zinc-700 text-[10px]">Legacy Record</span>
                      )}
                    </td>
                    <td className="px-6 py-4 text-zinc-200">
                      {formatTs(rec.activeAt || rec.updatedAt || rec.createdAt)}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </MonitorShell>
  );
}
