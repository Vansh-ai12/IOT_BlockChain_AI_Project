"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import MonitorShell from "../../components/MonitorShell";

const API_BASE = "http://localhost:9000/iota";

function formatTs(iso) {
  try {
    return new Date(iso).toLocaleString();
  } catch {
    return iso || "—";
  }
}

export default function BlockchainRecordsPage() {
  const [records, setRecords] = useState([]);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        setError("");
        const res = await fetch(`${API_BASE}/records?limit=50`, {
          cache: "no-store",
        });
        const json = await res.json();
        if (!res.ok) throw new Error(json.error || "Failed to load records");
        if (!cancelled) setRecords(json.records || []);
      } catch (e) {
        if (!cancelled) setError(e.message);
      }
    }
    load();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    const es = new EventSource(`${API_BASE}/records/stream`);
    es.addEventListener("newRecord", (evt) => {
      try {
        const rec = JSON.parse(evt.data);
        setRecords((prev) => {
          const exists = prev.some((r) => r._id === rec._id);
          if (exists) return prev;
          // Keep only last 100 in head to prevent UI lag with 8000+ rows
          return [rec, ...prev].slice(0, 100);
        });
      } catch (err) {
        console.warn("SSE Parse Error:", err);
      }
    });
    es.addEventListener("error", () => {
      // Reconnects automatically
    });
    return () => {
      es.close();
    };
  }, []);

  const lastUpdate = useMemo(
    () => (records[0]?.createdAt ? formatTs(records[0].createdAt) : "—"),
    [records],
  );

  return (
    <MonitorShell active="blockchain-records">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-semibold">Blockchain Records</h1>
          <p className="text-zinc-500 text-sm mt-1">
            Immutable audit trail for sensor feature rows anchored from the dashboard
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

      <div className="grid gap-4 sm:grid-cols-3">
        <div className="border border-[#1f2a23] rounded-lg bg-[#0f1511] p-4">
          <p className="text-xs text-zinc-500 uppercase tracking-wide">Total anchored</p>
          <p className="text-2xl font-semibold text-green-400 mt-1">{records.length}</p>
        </div>
        <div className="border border-[#1f2a23] rounded-lg bg-[#0f1511] p-4">
          <p className="text-xs text-zinc-500 uppercase tracking-wide">Network</p>
          <p className="text-lg font-medium mt-1">IOTA Tangle</p>
        </div>
        <div className="border border-[#1f2a23] rounded-lg bg-[#0f1511] p-4">
          <p className="text-xs text-zinc-500 uppercase tracking-wide">Last update</p>
          <p className="text-lg font-medium mt-1 text-zinc-300">
            {lastUpdate}
          </p>
        </div>
      </div>

      <div className="border border-[#1f2a23] rounded-lg bg-[#0f1511] p-6">
        <h3 className="text-green-400 mb-4">On-chain ledger</h3>
        <p className="text-sm text-gray-500 mb-6">
          Each row is a tamper-evident reference: feature JSON + hash + IOTA transaction digest. Use{" "}
          <span className="text-zinc-400">Store Blockchain Record</span> on the dashboard to
          append new entries.
        </p>

        <div className="overflow-x-auto">
          <table className="w-full text-sm text-gray-400 min-w-[640px]">
            <thead className="text-gray-500 border-b border-[#1f2a23]">
              <tr>
                <th className="text-left py-2 pr-4">Record</th>
                <th className="text-left py-2 pr-4">Timestamp</th>
                <th className="text-left py-2 pr-4">Proof hash</th>
                <th className="text-left py-2 pr-4">Tx digest</th>
                <th className="text-left py-2">Features</th>
              </tr>
            </thead>
            <tbody>
              {records.map((row) => (
                <tr key={row._id} className="border-b border-[#1f2a23]">
                  <td className="py-3 pr-4 text-zinc-300 font-mono text-xs">
                    {String(row._id).slice(-8)}
                  </td>
                  <td className="py-3 pr-4 whitespace-nowrap">{formatTs(row.createdAt)}</td>
                  <td className="py-3 pr-4 font-mono text-xs">{row.proofHash}</td>
                  <td className="py-3 pr-4 font-mono text-xs">{row.transactionDigest}</td>
                  <td className="py-3">
                    <pre className="text-xs text-zinc-400 overflow-x-auto">
                      {JSON.stringify(row.features ?? {}, null, 0)}
                    </pre>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </MonitorShell>
  );
}
