"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";

const navItem =
  "block w-full text-left px-4 py-2 rounded border border-[#1f2a23] hover:bg-[#101713] transition-colors";
const navActive = "bg-green-600 text-black border-green-600 hover:bg-green-500";

export default function MonitorShell({ active, children }) {
  const router = useRouter();

  const handleLogout = () => {
    localStorage.removeItem("auth_token");
    router.push("/login");
  };

  return (
    <div className="min-h-screen bg-[#0b0f0c] text-white flex">
      <aside className="w-60 shrink-0 border-r border-[#1f2a23] p-6 flex flex-col">
        <h2 className="text-green-400 font-semibold text-lg">MONITOR</h2>

        <nav className="mt-4 space-y-3">
          <Link
            href="/dashboard"
            className={`${navItem} ${active === "dashboard" ? navActive : ""}`}
          >
            Dashboard
          </Link>
          <Link
            href="/sensor-data"
            className={`${navItem} ${active === "sensor-data" ? navActive : ""}`}
          >
            Sensor Data
          </Link>
          <Link
            href="/alerts"
            className={`${navItem} ${active === "alerts" ? navActive : ""}`}
          >
            Alerts
          </Link>
        </nav>

        <div className="mt-auto pt-6">
          <button
            type="button"
            onClick={handleLogout}
            className="w-full text-left px-4 py-2 border border-red-900/60 text-red-300 rounded hover:bg-red-950/30"
          >
            Logout
          </button>
        </div>
      </aside>

      <main className="flex-1 min-w-0 p-6 md:p-10 space-y-8">{children}</main>
    </div>
  );
}
