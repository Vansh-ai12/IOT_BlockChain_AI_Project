"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import MonitorShell from "../../components/MonitorShell";

const API_BASE = "http://localhost:9000/alerts";

function formatTime(iso) {
  try {
    return new Date(iso).toLocaleString();
  } catch {
    return iso || "—";
  }
}

export default function Alerts() {
  const [alerts, setAlerts] = useState([]);
  const [error, setError] = useState("");
  const [busyId, setBusyId] = useState(null);

  const loadAlerts = useCallback(async () => {
    try {
      setError("");
      const res = await fetch(`${API_BASE}?limit=100`, { cache: "no-store" });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Failed to load alerts");
      setAlerts(json.alerts || []);
    } catch (e) {
      setError(e.message);
    }
  }, []);

  useEffect(() => {
    loadAlerts();
  }, [loadAlerts]);

  useEffect(() => {
    const es = new EventSource(`${API_BASE}/stream`);
    es.addEventListener("alert", (evt) => {
      try {
        const row = JSON.parse(evt.data);
        setAlerts((prev) => {
          if (prev.some((a) => a._id === row._id)) return prev;
          return [row, ...prev];
        });
      } catch {
        // ignore
      }
    });
    es.addEventListener("alert_updated", (evt) => {
      try {
        const row = JSON.parse(evt.data);
        setAlerts((prev) =>
          prev.map((a) => (a._id === row._id ? row : a)),
        );
      } catch {
        // ignore
      }
    });
    return () => es.close();
  }, []);

  const acknowledge = async (id) => {
    setBusyId(id);
    try {
      const res = await fetch(`${API_BASE}/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "Acknowledged" }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Update failed");
      setAlerts((prev) =>
        prev.map((a) => (a._id === id ? json.alert : a)),
      );
    } catch (e) {
      setError(e.message);
    } finally {
      setBusyId(null);
    }
  };

  return (
    <MonitorShell active="alerts">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-semibold">Damage Alerts</h1>
          <p className="text-zinc-500 text-sm mt-1">
            Real-time structural health monitoring and blockchain ledger records.
          </p>
        </div>

        <div className="flex gap-2">
          <button
            onClick={() => {
              // PRIVACY FILTER: Remove technical IDs and Blockchain Hashes
              const cleanAlerts = alerts.map(({ title, severity, status, createdAt }) => ({
                alert: title,
                severity,
                status,
                time: createdAt
              }));
              const blob = new Blob([JSON.stringify(cleanAlerts, null, 2)], { type: "application/json" });
              const url = URL.createObjectURL(blob);
              const a = document.createElement("a");
              a.href = url;
              a.download = `health_report_${Date.now()}.json`;
              a.click();
            }}
            disabled={!alerts.length}
            className="shrink-0 px-4 py-2 rounded bg-white text-black text-xs font-bold uppercase tracking-widest hover:bg-zinc-200 transition-all shadow-[0_0_15px_rgba(255,255,255,0.1)]"
          >
            Save Records
          </button>
          <Link
            href="/dashboard"
            className="shrink-0 px-4 py-2 rounded border border-[#1f2a23] hover:bg-[#101713] text-xs text-zinc-400 font-medium uppercase tracking-wider"
          >
            Dashboard
          </Link>
        </div>
      </div>

      {error && (
        <div className="p-3 rounded-lg bg-red-950/40 border border-red-900 text-red-300 text-sm">
          {error}
        </div>
      )}

      <div className="border border-[#1f2a23] rounded-lg bg-[#0f1511] p-6">
        <h3 className="text-sm font-bold uppercase tracking-[0.2em] text-zinc-500 mb-6 px-1 border-l-2 border-green-500 pl-3">AI Result Stream</h3>

        {alerts.length === 0 ? (
          <p className="text-sm text-zinc-500">
            No alerts yet. Run <span className="text-zinc-400">AI Prediction</span> when it returns Damaged, anchor sensor rows that exceed vibration/tilt/strain limits,
            or upload a CSV on Sensor Data with high readings.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-gray-400 min-w-[720px]">
              <thead className="border-b border-[#1f2a23]">
                <tr>
                  <th className="text-left py-4 pr-2 uppercase tracking-[0.3em] text-[9px] text-zinc-600">AI Evaluation</th>
                  <th className="text-left py-4 pr-2 uppercase tracking-[0.3em] text-[9px] text-zinc-600">Priority</th>
                  <th className="text-left py-4 pr-2 uppercase tracking-[0.3em] text-[9px] text-zinc-600">Recorded At</th>
                  <th className="text-right py-4 uppercase tracking-[0.3em] text-[9px] text-zinc-600">Action</th>
                </tr>
              </thead>
              <tbody>
                {alerts.map((alert) => (
                  <tr key={alert._id} className="border-b border-[#1f2a23]/30 hover:bg-white/[0.01] transition-all">
                    <td className="py-5 pr-2">
                       <span className={`text-sm font-black tracking-widest uppercase ${
                         alert.title === "Damaged" ? "text-red-500" : "text-green-400"
                       }`}>
                         {alert.title}
                       </span>
                    </td>
                    <td className="py-5 pr-2">
                      <span
                        className={`text-[9px] font-black px-2 py-0.5 rounded border ${
                          alert.severity === "High"
                            ? "bg-red-500/10 text-red-500 border-red-500/20"
                            : alert.severity === "Medium"
                              ? "bg-yellow-500/10 text-yellow-500 border-yellow-500/20"
                              : "bg-zinc-900 text-zinc-600 border-zinc-800"
                        }`}
                      >
                        {alert.severity}
                      </span>
                    </td>
                    <td className="py-5 pr-2 whitespace-nowrap text-zinc-500 font-mono text-[10px]">
                      {formatTime(alert.createdAt)}
                    </td>
                    <td className="py-5 text-right">
                      <div className="flex items-center justify-end gap-3">
                        {alert.status === "Active" ? (
                          <>
                            <span className="w-1.5 h-1.5 rounded-full bg-green-500/50" title="Active" />
                            <button
                              type="button"
                              disabled={busyId === alert._id}
                              onClick={() => acknowledge(alert._id)}
                              className="text-[9px] uppercase tracking-widest font-black px-3 py-1.5 bg-zinc-100 text-black rounded hover:bg-white transition-all disabled:opacity-50"
                            >
                              {busyId === alert._id ? "…" : "Acknowledge"}
                            </button>
                          </>
                        ) : (
                          <span className="text-[9px] uppercase font-bold text-zinc-700 font-mono">
                            LOGGED
                          </span>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </MonitorShell>
  );
}
