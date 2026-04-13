const fs = require("fs");
const fetch = require("node-fetch");
const path = require("path");

const CSV_FILE = path.join(__dirname, "dataset", "output1.csv");
const API_ENDPOINT = "http://localhost:9000/iota/write-data";
const INTERVAL_MS = 2000; 

async function runSimulation() {
  console.log("🚀 Starting FORCED Sensor Data Simulation...");
  
  if (!fs.existsSync(CSV_FILE)) {
    console.error("❌ Error: output1.csv not found.");
    process.exit(1);
  }

  const content = fs.readFileSync(CSV_FILE, "utf8");
  const lines = content.split(/\r?\n/).filter((l) => l.trim());

  if (lines.length < 2) {
    console.error("❌ Error: CSV file empty.");
    process.exit(1);
  }

  const headers = lines[0].split(",").map((h) => h.trim());

  while (true) {
    for (let i = 1; i < lines.length; i++) {
        // Send every 10th line to speed up visualization
        if (i % 10 !== 0) continue; 

      const values = lines[i].split(",").map((v) => v.trim());
      const features = {};

      headers.forEach((header, index) => {
        const val = values[index];
        features[header] = isNaN(val) ? val : parseFloat(val);
      });

      console.log(`📡 Transmitting line ${i}...`);

      try {
        await fetch(API_ENDPOINT, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ 
            features,
            userId: "FORCED_SIMULATOR_" + Date.now() // Unique ID to bypass any cache
          }),
        });
      } catch (error) {
        console.error(`❌ Error: ${error.message}`);
      }
      await new Promise((resolve) => setTimeout(resolve, INTERVAL_MS));
    }
  }
}

runSimulation();
