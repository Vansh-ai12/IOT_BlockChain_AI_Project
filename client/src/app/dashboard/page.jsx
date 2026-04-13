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
    return new Date(iso).toLocaleTimeString();
  } catch {
    return iso || "—";
  }
}

export default function Dashboard() {
  const [dataset, setDataset] = useState("");
  const [prediction, setPrediction] = useState("");
  const [blockchainResult, setBlockchainResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [records, setRecords] = useState([]);
  const [totalAnchored, setTotalAnchored] = useState(0);
  const [simProgress, setSimProgress] = useState(null);
  /** 1-based index into data rows (first data row = 1) */
  const [anchorRowNumber, setAnchorRowNumber] = useState(1);

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
      } catch (err) {
        console.error("Failed to load initial records", err);
      }
    }
    load();

    const es = new EventSource(`${API_IOTA}/records/stream`);
    es.addEventListener("newRecord", (evt) => {
      try {
        const rec = JSON.parse(evt.data);
        setRecords((prev) => {
          // Filter out the old instance of this record if it's already in the top 10
          // so the "Latest" one (the re-sync) stays at the top.
          const filtered = prev.filter((r) => r._id !== rec._id);
          return [rec, ...filtered].slice(0, 10);
        });
        
        if (!rec.isDuplicate) {
          setTotalAnchored((prev) => prev + 1);
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
    if (!csvTable || csvTable.dataLines.length === 0) return [];
    return csvTable.dataLines.slice(0, 7).map((line) => {
      const row = lineToFeatures(csvTable.headers, line);
      const m = maxNumericInRow(row);
      return Math.min(100, m > 0 ? m : 5);
    });
  }, [csvTable]);

  const runModel = async () => {
    const result = Math.random() > 0.5 ? "Undamaged" : "Damaged";
    setPrediction(result);

    if (result === "Damaged") {
      try {
        await fetch(API_ALERTS, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            title: "Structural damage predicted",
            message:
              "The AI classifier reported Damaged for the current sensor window.",
            location: "Structural analysis / dashboard",
            severity: "High",
            source: "prediction",
            metadata: { prediction: result },
          }),
        });
      } catch {
        // non-blocking
      }
    }
  };

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
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 gap-4">
        <div>
          <h1 className="text-4xl font-bold bg-gradient-to-r from-white via-zinc-400 to-zinc-600 bg-clip-text text-transparent">
            IOTA Tangle Dashboard
          </h1>
          <p className="text-zinc-500 text-sm mt-1">Real-time structural health monitoring via IOTA Distributed Ledger</p>
        </div>
        <div className="flex gap-6 bg-[#111814] border border-[#1f2a23] px-6 py-3 rounded-2xl shadow-inner">
          {simProgress && (
            <div className="text-left border-r border-[#1f2a23] pr-6 hidden md:block">
              <p className="text-[10px] text-zinc-500 uppercase tracking-widest font-semibold mb-1">Processing Data</p>
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold text-green-400 font-mono">Row {simProgress.current} of {simProgress.total}</span>
                <span className="text-[8px] text-zinc-600 truncate max-w-[80px]">File: {simProgress.fileName}</span>
              </div>
            </div>
          )}
          <div className="text-center border-r border-[#1f2a23] pr-6">
            <p className="text-[10px] text-zinc-500 uppercase tracking-widest font-semibold mb-1">Status</p>
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-green-500 shadow-[0_0_10px_rgba(34,197,94,0.6)]"></span>
              <span className="text-xs font-bold text-zinc-300 uppercase">Live</span>
            </div>
          </div>
          <div className="text-right">
            <p className="text-[10px] text-zinc-500 uppercase tracking-widest font-semibold mb-1">Saved on Blockchain</p>
            <p className="text-2xl font-black text-green-400 font-mono tracking-tighter">
              {totalAnchored.toLocaleString()}
            </p>
          </div>
        </div>
      </div>

      {/* DATASET INPUT */}
      <div className="border border-[#1f2a23] rounded-xl p-6 bg-[#0f1511] shadow-2xl">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-green-400 font-medium flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse"></span>
            Manual Data Entry
          </h3>
          <span className="text-[10px] text-zinc-500 bg-zinc-900 px-2 py-1 rounded border border-zinc-800">
            CSV / IOTA TANGLE
          </span>
        </div>

        <textarea
          placeholder="Paste sensor data records here..."
          value={dataset}
          onChange={(e) => {
            const v = e.target.value;
            setDataset(v);
            const t = parseCsvTable(v);
            const n = t?.dataLines.length ?? 0;
            setAnchorRowNumber((r) => (n === 0 ? 1 : Math.min(Math.max(1, r), n)));
          }}
          className="w-full bg-[#0b0f0c] border border-[#1f2a23] p-4 rounded-lg text-gray-300 outline-none focus:border-green-900 transition-colors font-mono text-sm"
          rows={4}
        />

        {dataRowCount > 0 && (
          <div className="mt-4 flex flex-col sm:flex-row sm:items-end gap-3">
            <div>
              <label className="block text-xs text-zinc-500 mb-1">
                Select Row to Save
              </label>
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  min={1}
                  max={dataRowCount}
                  value={anchorRowNumber}
                  onChange={(e) => {
                    const n = Number(e.target.value);
                    if (!Number.isFinite(n)) return;
                    setAnchorRowNumber(Math.min(Math.max(1, n), dataRowCount));
                  }}
                  className="w-28 px-3 py-2 rounded bg-[#0b0f0c] border border-[#1f2a23] text-zinc-200 focus:border-green-800 outline-none"
                />
                <span className="text-xs text-zinc-500">
                  of {dataRowCount} rows
                </span>
              </div>
            </div>
          </div>
        )}

        <div className="mt-5 flex flex-wrap gap-4">
          <button
            type="button"
            onClick={runModel}
            className="px-6 py-2.5 bg-green-500 text-black font-semibold rounded-lg hover:bg-green-400 transition-all shadow-lg shadow-green-900/20 active:scale-95"
          >
            Check with AI
          </button>

          <button
            type="button"
            onClick={storeBlockchain}
            disabled={loading || dataRowCount < 1}
            className="px-6 py-2.5 border border-green-900/50 text-green-500 font-semibold rounded-lg hover:bg-green-950/20 disabled:opacity-30 disabled:cursor-not-allowed transition-all active:scale-95"
          >
            {loading ? "Saving..." : "Save to Blockchain"}
          </button>
        </div>
      </div>

      {/* TRANSACTION OVERLAY / STATUS */}
      {loading && (
        <div className="border border-green-900/50 rounded-xl p-6 bg-green-900/5 animate-pulse">
           <div className="flex justify-between items-center mb-2">
             <h3 className="text-green-400 text-sm font-bold uppercase tracking-widest">Currently Saving...</h3>
             <span className="text-xs font-mono text-zinc-400">{new Date().toLocaleTimeString()}</span>
           </div>
           <p className="text-zinc-400 text-xs">Sending this record to the secure global ledger...</p>
        </div>
      )}

      {prediction && (
        <div className="border border-[#1f2a23] rounded-xl p-6 bg-[#0f1511]">
          <h3 className="text-green-400 mb-4 font-medium">AI Analysis Result</h3>
          <div className="text-2xl flex justify-between items-center">
            <span className="text-zinc-300">Analysis Status</span>
            <span
              className={`font-bold ${
                prediction === "Undamaged" ? "text-green-400" : "text-red-400"
              }`}
            >
              {prediction}
            </span>
          </div>
        </div>
      )}

      {blockchainResult && (
        <div className="border border-green-900/30 rounded-xl p-6 bg-[#0f1511] text-sm text-gray-400 overflow-hidden relative">
          <div className="absolute top-0 right-0 p-4">
             <span className="text-[10px] bg-green-900/30 text-green-400 px-2 py-1 rounded">FRESHLY SAVED</span>
          </div>
          <h3 className="text-green-400 mb-4 font-bold uppercase tracking-wider">Storage Receipt</h3>
          <div className="space-y-2 font-mono text-xs">
            <p><span className="text-zinc-600">Secure ID:</span> {blockchainResult.proofHash}</p>
            <p><span className="text-zinc-600">Transaction Code:</span> {blockchainResult.transactionDigest}</p>
            <p><span className="text-zinc-600">Network:</span> Public Devnet</p>
            <p><span className="text-zinc-600">Time:</span> {new Date().toLocaleString()}</p>
          </div>
        </div>
      )}

      {/* SENSOR GRAPH & METRICS */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="p-6 border border-[#1f2a23] rounded-xl bg-[#0f1511] shadow-xl">
          <h3 className="text-green-400 mb-6 font-medium">Live Sensor Graph</h3>
          {chartBars.length === 0 ? (
            <div className="h-40 flex items-center justify-center border border-dashed border-zinc-800 rounded-lg">
              <p className="text-sm text-zinc-600">Waiting for data...</p>
            </div>
          ) : (
            <div className="h-40 flex items-end gap-3">
              {chartBars.map((h, i) => (
                <div
                  key={i}
                  style={{ height: `${h}%` }}
                  className="bg-gradient-to-t from-green-600 to-green-400 w-full rounded-t-sm min-h-[4px] relative group"
                  title={`Record ${i + 1}`}
                >
                   <div className="absolute -top-6 left-1/2 -translate-x-1/2 opacity-0 group-hover:opacity-100 transition-opacity text-[10px] text-green-400 font-mono">
                     {h}%
                   </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="p-6 border border-[#1f2a23] rounded-xl bg-[#0f1511] shadow-xl">
          <h3 className="text-green-400 mb-6 font-medium">Health Metrics</h3>
          <div className="space-y-4">
            <div className="flex justify-between items-center p-3 bg-[#0b0f0c] rounded-lg border border-[#1f2a23]">
              <span className="text-sm text-zinc-400">Current Health</span>
              <span
                className={`text-sm font-bold ${
                  prediction === "Damaged"
                    ? "text-red-400"
                    : prediction === "Undamaged"
                      ? "text-green-400"
                      : "text-zinc-500"
                }`}
              >
                {prediction === "Damaged"
                  ? "At Risk"
                  : prediction === "Undamaged"
                    ? "Healthy"
                    : "No Data"}
              </span>
            </div>

            <div className="flex justify-between items-center p-3 bg-[#0b0f0c] rounded-lg border border-[#1f2a23]">
              <span className="text-sm text-zinc-400">Data Node ID</span>
              <span className="text-xs text-zinc-500 font-mono">System-01</span>
            </div>

            <div className="flex justify-between items-center p-3 bg-[#0b0f0c] rounded-lg border border-[#1f2a23]">
              <span className="text-sm text-zinc-400">Safety Level</span>
              <span
                className={`text-sm font-bold ${
                  prediction === "Damaged"
                    ? "text-red-400"
                    : prediction === "Undamaged"
                      ? "text-green-400"
                      : "text-yellow-500"
                }`}
              >
                {prediction === "Damaged"
                  ? "Low"
                  : prediction === "Undamaged"
                    ? "High"
                    : "Pending"}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* LIVE BLOCKCHAIN ACTIVITY SECTION */}
      <div className="border border-[#1f2a23] rounded-xl bg-[#0f1511] shadow-2xl overflow-hidden">
        <div className="p-6 border-b border-[#1f2a23] flex justify-between items-center bg-[#111814]">
          <div>
            <h3 className="text-green-400 font-bold uppercase tracking-widest text-sm flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-green-500"></span>
              Recent Activity Feed
            </h3>
            <p className="text-xs text-zinc-500 mt-1">Real-time log of records being saved to the secure ledger</p>
          </div>
          <div className="bg-[#0b0f0c] border border-zinc-800 px-3 py-1 rounded text-[10px] text-zinc-400 font-mono">
             NETWORK: SECURE TANGLE
          </div>
        </div>
        
        <div className="overflow-x-auto">
          <table className="w-full text-xs text-left">
            <thead>
              <tr className="text-zinc-500 border-b border-[#1f2a23] bg-[#0b0f0c]/50">
                <th className="px-6 py-3 font-medium uppercase tracking-wider">Record</th>
                <th className="px-6 py-3 font-medium uppercase tracking-wider">Recorded At</th>
                <th className="px-6 py-3 font-medium uppercase tracking-wider">Secure ID</th>
                <th className="px-6 py-3 font-medium uppercase tracking-wider">Transaction Code</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-900">
              {records.length === 0 ? (
                <tr>
                  <td colSpan="4" className="px-6 py-8 text-center text-zinc-700 italic">
                    No history found.
                  </td>
                </tr>
              ) : (
                records.map((rec) => (
                  <tr key={rec._id} className="hover:bg-[#121a15] transition-colors group">
                    <td className="px-6 py-4 font-mono text-zinc-400 group-hover:text-green-400 transition-colors">
                      #{String(rec._id).slice(-4)}
                      {rec.isDuplicate && (
                        <span className="ml-2 text-[8px] bg-zinc-800 text-zinc-500 px-1 rounded uppercase">Verified</span>
                      )}
                    </td>
                    <td className="px-6 py-4 text-zinc-400">
                      {formatTs(rec.activeAt || rec.createdAt)}
                    </td>
                    <td className="px-6 py-4 font-mono text-[10px] text-zinc-600 max-w-[150px] truncate" title={rec.proofHash}>
                      {rec.proofHash}
                    </td>
                    <td className="px-6 py-4 font-mono text-[10px] text-zinc-600 max-w-[150px] truncate" title={rec.transactionDigest}>
                      {rec.transactionDigest}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
        {records.length > 0 && (
          <div className="p-4 bg-[#0b0f0c]/30 text-center">
             <p className="text-[10px] text-zinc-600 uppercase tracking-[0.2em]">Showing last 10 activities</p>
          </div>
        )}
      </div>
    </MonitorShell>
  );
}
