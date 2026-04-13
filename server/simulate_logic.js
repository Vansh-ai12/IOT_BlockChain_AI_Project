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
  let maxAmpFound = 0;

  for (let i = 1; i < lines.length; i++) {
    const values = lines[i].split(",").map((v) => v.trim());
    const features = {};
    headers.forEach((h, idx) => {
      const val = values[idx];
      features[h] = isNaN(val) ? val : parseFloat(val);
      
      // Basic heuristic for max amplitude (Ch 24)
      if (h === "24") maxAmpFound = Math.max(maxAmpFound, Math.abs(parseFloat(val) || 0));
    });

    console.log(`[Simulator] ${fileName} -> Row ${i}/${lines.length-1}`);

    try {
      await fetch(API_ENDPOINT, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ 
          features,
          userId: "SYSTEM_SIMULATOR",
          fileName,
          progress: {
            current: i,
            total: lines.length - 1
          }
        }),
      });
      console.log(`✅ [Simulator] Sent Row ${i}/${lines.length-1}`);
    } catch (err) {
      console.error(`❌ Row ${i} error:`, err.message);
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
