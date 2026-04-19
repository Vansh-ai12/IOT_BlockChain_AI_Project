const fs = require("fs");
const fetch = require("node-fetch");
const path = require("path");
const ProcessedFile = require("./model/ProcessedFile");

const DATASET_DIR = path.join(__dirname, "dataset");
const API_ENDPOINT = "http://localhost:9000/iota/write-data";
const INTERVAL_MS = 2000; 

const currentlyProcessing = new Set();

async function start() {
  console.log("📂 Dataset Intelligence: Monitoring directory:", DATASET_DIR);
  
  if (!fs.existsSync(DATASET_DIR)) {
    fs.mkdirSync(DATASET_DIR);
    console.warn("⚠️ Dataset directory was missing - created it.");
    return;
  }

  setInterval(async () => {
    if (currentlyProcessing.size > 0) return; // Only one file at a time globally

    try {
      const files = fs.readdirSync(DATASET_DIR).filter(f => f.endsWith(".csv"));
      
      for (const fileName of files) {
        const alreadyDone = await ProcessedFile.findOne({ fileName });
        if (alreadyDone) continue; 

        console.log(`🚀 Starting Sequential Dataset: ${fileName}`);
        currentlyProcessing.add(fileName);
        
        try {
          await processDatasetFile(fileName);
        } finally {
          currentlyProcessing.delete(fileName);
        }
        
        // Break after one file to ensure we don't start the next until the next interval tick
        // or just continue if you want them to run back-to-back but strictly one-by-one.
        break; 
      }
    } catch (err) {
      console.error("❌ Dataset scan error:", err.message);
    }
  }, 10000); 
}

async function processDatasetFile(fileName) {
  const filePath = path.join(DATASET_DIR, fileName);
  const content = fs.readFileSync(filePath, "utf8");
  const lines = content.split(/\r?\n/).filter((l) => l.trim());
  
  if (lines.length < 2) {
    console.warn(`⚠️ Skipping ${fileName}: empty or no headers.`);
    return;
  }

  const headers = lines[0].split(",").map((h) => h.trim());
  
  // Implementing SLIDING WINDOW (1-50, 2-51, etc.)
  const WINDOW_SIZE = 50;
  let maxAmpFound = 0;
  
  for (let i = 1; i <= lines.length - WINDOW_SIZE; i++) {
    const windowRows = [];
    for (let j = 0; j < WINDOW_SIZE; j++) {
      const values = lines[i + j].split(",").map((v) => v.trim());
      const row = {};
      headers.forEach((h, idx) => {
        const val = values[idx];
        row[h] = isNaN(val) ? val : parseFloat(val);
      });
      windowRows.push(row);
    }

    // Latest features (the 50th row in the window) for monitoring
    const latestFeatures = windowRows[WINDOW_SIZE - 1];
    maxAmpFound = Math.max(maxAmpFound, Math.abs(latestFeatures["24"] || 0));

    console.log(`[Simulator] ${fileName} -> Window ${i} to ${i + WINDOW_SIZE - 1}`);

    try {
      await fetch(API_ENDPOINT, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ 
          features: windowRows, // Sending the whole window
          userId: "SYSTEM_SIMULATOR",
          fileName,
          _t: Date.now(), // Unique transmission timestamp to ensure fresh hash every time
          progress: {
            current: i + WINDOW_SIZE - 1,
            total: lines.length - 1
          }
        }),
      });
      console.log(`✅ [Simulator] Sent Window ${i}-${i + WINDOW_SIZE - 1}`);
    } catch (err) {
      console.error(`❌ Window ${i} error:`, err.message);
    }

    // Wait for the interval
    await new Promise(resolve => setTimeout(resolve, INTERVAL_MS));
  }

  // 3. Mark as processed & Store important info
  console.log(`✅ Completed ${fileName}. Saving end results to DB...`);
  await ProcessedFile.create({
    fileName,
    totalRows: lines.length - 1,
    maxAmplitude: maxAmpFound,
    assessment: maxAmpFound > 8 ? "damaged" : "undamaged" 
  });
}

module.exports = { start };
