import Link from "next/link";

export default function Home() {
  return (
    <div className="min-h-screen bg-[#0b0f0c] text-white flex flex-col">

      {/* HEADER */}
      <header className="w-full border-b border-[#1f2a23]">
        <div className="max-w-7xl mx-auto flex justify-between items-center px-6 py-5">

          <h1 className="text-lg tracking-widest font-semibold text-green-400">
            STRUCTURE MONITOR
          </h1>

          <div className="flex gap-4">
            <Link
              href="/login"
              className="px-4 py-2 text-sm border border-green-400 text-green-400 rounded-md hover:bg-green-400 hover:text-black transition"
            >
              Login
            </Link>

            <Link
              href="/signup"
              className="px-4 py-2 text-sm bg-green-500 text-black rounded-md hover:bg-green-400 transition"
            >
              Sign Up
            </Link>
          </div>

        </div>
      </header>

      {/* HERO */}
      <section className="flex flex-col items-center text-center py-28 px-6">

        <h2 className="text-5xl font-semibold leading-tight max-w-3xl">
          Infrastructure Monitoring
          <span className="text-green-400"> for Structural Systems</span>
        </h2>

        

      </section>

      {/* FEATURES */}
      <section className="max-w-7xl mx-auto px-6 pb-28 grid md:grid-cols-2 gap-8">

        <div className="p-7 border border-[#1f2a23] rounded-lg bg-[#0f1511]">
          <h3 className="text-xl font-semibold text-green-400 mb-3">
            Authentication Layer
          </h3>

          <p className="text-gray-400 text-sm leading-relaxed">
            Secure operator authentication system controlling access to
            monitoring dashboards, infrastructure data pipelines,
            and structural analytics modules.
          </p>
        </div>


        <div className="p-7 border border-[#1f2a23] rounded-lg bg-[#0f1511]">
          <h3 className="text-xl font-semibold text-green-400 mb-3">
            Live readings
          </h3>

          <p className="text-gray-400 text-sm leading-relaxed">
            Pull in sensor numbers as they arrive and show them on charts and
            dashboards so you can spot issues early.
          </p>
        </div>


        <div className="p-7 border border-[#1f2a23] rounded-lg bg-[#0f1511]">
          <h3 className="text-xl font-semibold text-green-400 mb-3">
            Blockchain Data Verification
          </h3>

          <p className="text-gray-400 text-sm leading-relaxed">
            Sensor data hashes recorded on blockchain providing tamper-proof
            verification including block identifiers, timestamps, and
            cryptographic proof.
          </p>
        </div>


        <div className="p-7 border border-[#1f2a23] rounded-lg bg-[#0f1511]">
          <h3 className="text-xl font-semibold text-green-400 mb-3">
            Damage & Alert Detection
          </h3>

          <p className="text-gray-400 text-sm leading-relaxed">
            Automated anomaly detection identifies structural risks and
            generates alerts with severity levels and location metadata
            for rapid engineering response.
          </p>
        </div>

      </section>

      {/* FOOTER */}
      <footer className="text-center py-6 border-t border-[#1f2a23] text-gray-500 text-sm">
        Made By : - Manu Sharma , Vansh Jain
      </footer>

    </div>
  );
}