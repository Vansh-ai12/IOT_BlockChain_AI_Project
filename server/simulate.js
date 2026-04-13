const fs = require("fs");
const fetch = require("node-fetch");
const path = require("path");

/**
 * SENSOR DATA SIMULATOR
 * This script reads a CSV file line by line and sends it to the server's IOTA route
 * to simulate a real-time sensor environment.
 */

const CSV_FILE = path.join(__dirname, "sensor_data.csv");
const API_ENDPOINT = "http://localhost:9000/iota/write-data";
const INTERVAL_MS = 5000; // 5 seconds between transmissions

async function runSimulation() {
  console.log("🚀 Starting Sensor Data Simulation...");
  
  if (!fs.existsSync(CSV_FILE)) {
    console.error("❌ Error: sensor_data.csv not found.");
    process.exit(1);
  }

  const content = fs.readFileSync(CSV_FILE, "utf8");
  const lines = content.split(/\r?\n/).filter((l) => l.trim());

  if (lines.length < 2) {
    console.error("❌ Error: CSV file must have headers and at least one data row.");
    process.exit(1);
  }

  const headers = lines[0].split(",").map((h) => h.trim());

  // Loop infinitely (or until end of file)
  let loopCount = 0;
  while (true) {
    loopCount++;
    console.log(`\n--- Simulation Cycle ${loopCount} ---`);

    for (let i = 1; i < lines.length; i++) {
      const values = lines[i].split(",").map((v) => v.trim());
      const features = {};

      headers.forEach((header, index) => {
        const val = values[index];
        features[header] = isNaN(val) ? val : parseFloat(val);
      });

      console.log(`📡 Transmitting reading from line ${i+1}:`);
      console.dir(features);

      try {
        const response = await fetch(API_ENDPOINT, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ 
            features,
            userId: "65f1a2b3c4d5e6f7a8b9c0d1" // Simulated User ID
          }),
        });

        const result = await response.json();

        if (result.success) {
          console.log(`✅ Success! Tx Digest: ${result.transactionDigest}`);
        } else {
          console.error(`❌ Server Error: ${result.error}`);
        }
      } catch (error) {
        console.error(`❌ Connection Error: ${error.message}`);
        console.log("Is the server running at http://localhost:9000?");
      }

      console.log(`⏳ Waiting ${INTERVAL_MS / 1000}s...`);
      await new Promise((resolve) => setTimeout(resolve, INTERVAL_MS));
    }
    
    console.log("\n🔄 Dataset end reached. Restarting simulation...");
  }
}

runSimulation();
