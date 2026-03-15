"use client";

import { useState } from "react";

export default function Dashboard() {

  const [dataset, setDataset] = useState("");
  const [prediction, setPrediction] = useState("");

  const runModel = () => {

    // temporary demo prediction
    const result = Math.random() > 0.5 ? "Undamaged" : "Damaged";
    setPrediction(result);
  };

  return (
    <div className="min-h-screen bg-[#0b0f0c] text-white flex">

      {/* SIDEBAR */}
      <aside className="w-60 border-r border-[#1f2a23] p-6 space-y-4">

        <h2 className="text-green-400 font-semibold text-lg">
          MONITOR
        </h2>

        <button className="w-full text-left px-4 py-2 bg-green-600 text-black rounded">
          Dashboard
        </button>

        <button className="w-full text-left px-4 py-2 border border-[#1f2a23] rounded hover:bg-[#101713]">
          Sensor Data
        </button>

        <button className="w-full text-left px-4 py-2 border border-[#1f2a23] rounded hover:bg-[#101713]">
          Blockchain Records
        </button>

        <button className="w-full text-left px-4 py-2 border border-[#1f2a23] rounded hover:bg-[#101713]">
          Alerts
        </button>

      </aside>


      {/* MAIN */}
      <main className="flex-1 p-10 space-y-10">

        <h1 className="text-3xl font-semibold">
          Structural Analysis Dashboard
        </h1>


        {/* DATASET INPUT */}
        <div className="border border-[#1f2a23] rounded-lg p-6 bg-[#0f1511]">

          <h3 className="text-green-400 mb-4">
            Sensor Dataset Input
          </h3>

          <textarea
            placeholder="Paste structural sensor dataset here..."
            value={dataset}
            onChange={(e)=>setDataset(e.target.value)}
            className="w-full bg-[#0b0f0c] border border-[#1f2a23] p-4 rounded text-gray-300 outline-none"
            rows={4}
          />

          <div className="mt-4 flex gap-4">

            <button
              onClick={runModel}
              className="px-5 py-2 bg-green-500 text-black rounded hover:bg-green-400"
            >
              Run AI Prediction
            </button>

            <button className="px-5 py-2 border border-[#1f2a23] rounded hover:bg-[#101713]">
              Store Blockchain Record
            </button>

          </div>

        </div>


        {/* PREDICTION RESULT */}
        {prediction && (

          <div className="border border-[#1f2a23] rounded-lg p-6 bg-[#0f1511]">

            <h3 className="text-green-400 mb-4">
              AI Model Prediction
            </h3>

            <div className="text-lg flex justify-between">

              <span>Structure Status</span>

              <span className={
                prediction === "Undamaged"
                ? "text-green-400"
                : "text-red-400"
              }>
                {prediction}
              </span>

            </div>

          </div>

        )}


        {/* SENSOR GRAPH */}
        <div className="grid grid-cols-2 gap-6">

          <div className="p-6 border border-[#1f2a23] rounded-lg bg-[#0f1511]">

            <h3 className="text-green-400 mb-4">
              Sensor Telemetry
            </h3>

            <div className="h-40 flex items-end gap-2">

              {[40,60,35,70,50,80,45].map((h,i)=>(
                <div
                  key={i}
                  style={{height:`${h}%`}}
                  className="bg-green-500 w-6 rounded-sm"
                />
              ))}

            </div>

          </div>


          {/* HEALTH PANEL */}
          <div className="p-6 border border-[#1f2a23] rounded-lg bg-[#0f1511]">

            <h3 className="text-green-400 mb-4">
              Structural Health Metrics
            </h3>

            <div className="space-y-3 text-sm">

              <div className="flex justify-between">
                <span>Integrity</span>
                <span className="text-green-400">Stable</span>
              </div>

              <div className="flex justify-between">
                <span>Sensor Nodes</span>
                <span>12 Active</span>
              </div>

              <div className="flex justify-between">
                <span>Risk Score</span>
                <span className="text-yellow-400">Low</span>
              </div>

            </div>

          </div>

        </div>


        {/* BLOCKCHAIN RECORDS */}
        <div className="border border-[#1f2a23] rounded-lg bg-[#0f1511] p-6">

          <h3 className="text-green-400 mb-4">
            Blockchain Records
          </h3>

          <table className="w-full text-sm text-gray-400">

            <thead className="text-gray-500 border-b border-[#1f2a23]">
              <tr>
                <th className="text-left py-2">Block</th>
                <th className="text-left py-2">Timestamp</th>
                <th className="text-left py-2">Hash</th>
              </tr>
            </thead>

            <tbody>

              <tr className="border-b border-[#1f2a23]">
                <td className="py-2">82193</td>
                <td>12:40</td>
                <td>0x3fa9...8c2</td>
              </tr>

              <tr className="border-b border-[#1f2a23]">
                <td className="py-2">82192</td>
                <td>12:35</td>
                <td>0xa2f1...1bd</td>
              </tr>

            </tbody>

          </table>

        </div>

      </main>

    </div>
  );
}