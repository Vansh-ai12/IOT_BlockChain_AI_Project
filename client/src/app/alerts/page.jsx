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
            Live alerts from AI predictions, on-chain sensor thresholds, and sensor uploads
          </p>
        </div>

        <Link
          href="/dashboard"
          className="shrink-0 px-4 py-2 rounded border border-[#1f2a23] hover:bg-[#101713] text-sm text-gray-200"
        >
          Go to Dashboard
        </Link>
      </div>

      {error && (
        <div className="p-3 rounded-lg bg-red-950/40 border border-red-900 text-red-300 text-sm">
          {error}
        </div>
      )}

      <div className="border border-[#1f2a23] rounded-lg bg-[#0f1511] p-6">
        <h3 className="text-green-400 mb-4">Alert feed</h3>

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
                  <th className="text-left py-2 pr-2">Source</th>
                  <th className="text-left py-2 pr-2">Title</th>
                  <th className="text-left py-2 pr-2">Location</th>
                  <th className="text-left py-2 pr-2">Severity</th>
                  <th className="text-left py-2 pr-2">Time</th>
                  <th className="text-left py-2 pr-2">Status</th>
                  <th className="text-left py-2">Action</th>
                </tr>
              </thead>
              <tbody>
                {alerts.map((alert) => (
                  <tr key={alert._id} className="border-b border-[#1f2a23]">
                    <td className="py-2 pr-2 capitalize text-zinc-300">
                      {alert.source}
                    </td>
                    <td className="py-2 pr-2 text-zinc-200">{alert.title}</td>
                    <td className="py-2 pr-2">{alert.location}</td>
                    <td
                      className={
                        alert.severity === "High"
                          ? "text-red-400"
                          : alert.severity === "Medium"
                            ? "text-yellow-400"
                            : "text-zinc-400"
                      }
                    >
                      {alert.severity}
                    </td>
                    <td className="py-2 pr-2 whitespace-nowrap">
                      {formatTime(alert.createdAt)}
                    </td>
                    <td className="py-2 pr-2 text-green-400">{alert.status}</td>
                    <td className="py-2">
                      {alert.status === "Active" ? (
                        <button
                          type="button"
                          disabled={busyId === alert._id}
                          onClick={() => acknowledge(alert._id)}
                          className="text-xs px-2 py-1 rounded border border-[#1f2a23] hover:bg-[#101713] disabled:opacity-50"
                        >
                          {busyId === alert._id ? "…" : "Acknowledge"}
                        </button>
                      ) : (
                        <span className="text-zinc-600">—</span>
                      )}
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
