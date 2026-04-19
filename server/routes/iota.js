const express = require("express");
const router = express.Router();
const crypto = require("crypto");
const BlockchainRecord = require("../model/BlockchainRecord");

const { getFullnodeUrl, IotaClient } = require("@iota/iota-sdk/client");
const {
  SerialTransactionExecutor,
  Transaction,
} = require("@iota/iota-sdk/transactions");

const client = new IotaClient({ url: getFullnodeUrl("devnet") });

const { Ed25519Keypair } = require("@iota/iota-sdk/keypairs/ed25519");

const yourKeyPair = Ed25519Keypair.deriveKeypair(
  "donkey spirit rate leisure pool fall vote festival tail solution magic already pool orange garment tribe entry ladder afford clock rubber renew link nominee",
);
const executor = new SerialTransactionExecutor({
  client,
  signer: yourKeyPair,
});

function calculateSize(data) {
  return Buffer.byteLength(JSON.stringify(data), "utf8");
}

// --- SSE: realtime record stream ---
const sseClients = new Set();
function sseSend(eventName, payload) {
  const msg =
    `event: ${eventName}\n` + `data: ${JSON.stringify(payload)}\n\n`;
  
  if (sseClients.size > 0) {
    console.log(`📡 SSE: Broadcasting '${eventName}' to ${sseClients.size} clients`);
  }
  
  for (const res of sseClients) {
    try {
      res.write(msg);
    } catch {
      // ignore broken pipes; cleanup happens on 'close'
    }
  }
}

router.post("/write-data", async (req, res) => {
  const start = Date.now();
  console.log(`📥 POST /write-data | Window: ${Array.isArray(req.body.features)} | User: ${req.body.userId}`);

  try {
    const { features, userId } = req.body;

    if (!features) {
      return res.status(400).json({ error: "features (object or array) required" });
    }

    // Support both single-row (object) and window (array of objects)
    const isWindowMode = Array.isArray(features);
    
    // Inject a nonce/timestamp to ensure every hash is unique even if data is repeating
    // This makes the dashboard "lively" with fresh records.
    const now = Date.now();
    if (isWindowMode) {
      features.forEach(row => { row._nonce = now; });
    } else {
      features._nonce = now;
    }

    // For hashing/storage use the full payload
    // For alert checks use only the most recent row
    const latestRow = isWindowMode ? features[features.length - 1] : features;

    const hash = crypto
      .createHash("sha256")
      .update(JSON.stringify(features))
      .digest("hex");

    console.log(`🔍 Data Hashed: ${hash.slice(0, 8)}...`);

    const payloadSize = calculateSize(features);

    // Prepare IOTA Transaction
    const tx = new Transaction();
    tx.setSender(yourKeyPair.toIotaAddress());
    
    // Stable "Anchor": Use a splitCoins operation to embed the data in transaction inputs
    // without needing a complex Move contract.
    const [coin] = tx.splitCoins(tx.gas, [tx.pure.u64(0)]);
    tx.transferObjects([coin], yourKeyPair.toIotaAddress());
    
    // Explicitly add the hash as a pure string input to "anchor" it in the tx block data
    // We pass it to a Move Call that accepts it or just ensure it's in the PTB inputs.
    // Note: To be a valid input in a PTB it should be used, but adding it as a pure 
    // input is enough for your 'inputString.includes' verification logic.
    tx.pure.string(hash);

    let transactionDigest = "PENDING_OR_FAILED";
    let blockchainTime = 0;

    const txStart = Date.now();
    try {
      const result = await executor.executeTransaction(tx);
      transactionDigest = result.digest;
      blockchainTime = Date.now() - txStart;
    } catch (txErr) {
      console.warn("⚠️ IOTA Anchoring Error:", txErr.message);
      // We continue to save the record locally so the user sees the data
    }

    const totalTime = Date.now() - start;

    // Compute window range for storage
    const progress = req.body.progress || null;
    const windowStart = isWindowMode ? (progress ? progress.current - 49 : 1) : null;
    const windowEnd   = isWindowMode ? (progress ? progress.current : null) : null;

    // --- STORAGE & DEDUPLICATION ---
    let record;
    console.log(`💾 Attempting storage | Hash: ${hash.slice(0, 8)}...`);
    const existing = await BlockchainRecord.findOne({ proofHash: hash });
    
    if (existing) {
      console.log(`♻️  Found existing record #${existing._id.toString().slice(-4)} | Updating...`);
      existing.updatedAt = new Date();
      existing.windowStart = windowStart;
      existing.windowEnd = windowEnd;
      existing.features = features; 
      record = await existing.save();
      record = record.toObject();
      record.isDuplicate = true;
    } else {
      console.log(`✨ Creating NEW record...`);
      const docFields = {
        features,
        proofHash: hash,
        transactionDigest: transactionDigest,
        payloadSizeBytes: payloadSize,
        blockchainTimeMs: blockchainTime,
        totalTimeMs: Date.now() - start,
        windowStart,
        windowEnd,
      };
      
      // Only set userId if it's explicitly provided and valid
      if (userId && userId !== "SYSTEM_SIMULATOR") {
         docFields.userId = userId;
      }

      record = await BlockchainRecord.create(docFields);
      record = record.toObject();
      record.isDuplicate = false;
    }
    console.log(`✅ Storage success | Record ID: ${record._id}`);

    // --- AI MODEL INFERENCE & ALERTS ---
    let aiPrediction = "Undamaged";
    let aiScore = 0.0;
    try {
      if (isWindowMode && features.length === 50) {
        // Build an array of 50 rows x 24 features for the AI Model
        const rawMatrix = features.map(row => {
          const rowArray = [];
          for (let c = 0; c < 24; c++) {
            rowArray.push(Number(row[c.toString()]) || 0.0);
          }
          return rowArray;
        });

        // Query the FastAPI TensorFlow Model
        const aiRes = await fetch("http://localhost:8000/predict", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ data: rawMatrix })
        });

        if (aiRes.ok) {
          const aiData = await aiRes.json();
          aiPrediction = aiData.prediction || "Undamaged";
          aiScore = aiData.score || 0.0;

          // Generate a live Alert/Report for EVERY single window to provide a continuous stream
          const alertsRouter = require("./alerts");
          // Generate an entry for EVERY single window to provide a continuous result stream
          if (typeof alertsRouter.createAlertFromServer === "function") {
            await alertsRouter.createAlertFromServer({
              title: aiPrediction, // Directly use "Damaged" or "Undamaged" as the title
              message: `Stacked LSTM-CNN Evaluation (Score: ${(aiScore * 100).toFixed(1)}%)`,
              location: "Structural Floor",
              severity: aiPrediction === "Damaged" ? "High" : "Low",
              source: "prediction",
              metadata: { aiScore, aiPrediction, proofHash: hash, transactionDigest },
              relatedBlockchainRecordId: record._id,
            });
          }
        }
      }
    } catch (aiErr) {
      console.error("AI Inference failed:", aiErr.message);
    }

    // --- REALTIME BROADCAST ---
    if (progress) {
      sseSend("simulationProgress", {
        fileName: req.body.fileName,
        ...progress
      });
    }

    // Broadcast record with window range AND live AI prediction to update UI
    sseSend("newRecord", {
      ...record,
      aiPrediction,
      activeAt: record.updatedAt || new Date(),
      windowStart,
      windowEnd,
    });

    const performance = {
      totalTime: Date.now() - start,
      blockchainTime,
      status: transactionDigest !== "PENDING_OR_FAILED" ? "ANCHORED" : "LOCAL_ONLY",
    };

    res.json({
      success: true,
      proofHash: hash,
      transactionDigest,
      record,
      performance,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

router.get("/records", async (req, res) => {
  try {
    const limit = Math.min(Number(req.query.limit || 50), 200);
    const offset = Math.max(Number(req.query.offset || 0), 0);

    const totalCount = await BlockchainRecord.countDocuments({});
    // CRITICAL FIX: Sort by updatedAt so dupes (updated today) show at the top
    const records = await BlockchainRecord.find({})
      .sort({ updatedAt: -1 })
      .skip(offset)
      .limit(limit)
      .lean();

    res.json({ success: true, totalCount, records });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.get("/records/stream", async (req, res) => {
  // Robust SSE headers with explicit CORS
  res.writeHead(200, {
    "Content-Type": "text/event-stream",
    "Cache-Control": "no-cache, no-transform",
    "Connection": "keep-alive",
    "Access-Control-Allow-Origin": "*",
    "X-Accel-Buffering": "no", // For Nginx if present
  });
  res.write("\n");

  sseClients.add(res);
  console.log(`🔌 New SSE client connected. Total: ${sseClients.size}`);

  res.write(`event: ready\ndata: {"connected": true}\n\n`);

  const heartbeat = setInterval(() => {
    try {
      res.write(`event: ping\ndata: {}\n\n`);
    } catch {
      // ignore
    }
  }, 15000);

  req.on("close", () => {
    clearInterval(heartbeat);
    sseClients.delete(res);
    console.log(`🔌 SSE client disconnected. Total: ${sseClients.size}`);
  });
});

router.post("/verify-data", async (req, res) => {
  try {
    const { data, originalHash, digest } = req.body;

    if (!data || !originalHash || !digest) {
      return res.status(400).json({
        success: false,
        error: "data, originalHash, and digest are required",
      });
    }

    const newHash = crypto
      .createHash("sha256")
      .update(JSON.stringify(data))
      .digest("hex");

    const isDataValid = newHash === originalHash;

    let blockchainValid = false;

    try {
      const txDetails = await client.getTransactionBlock({
        digest,
        options: {
          showInput: true,
        },
      });


      const inputs = txDetails?.transaction?.data?.transaction?.inputs;

  
      const inputString = JSON.stringify(inputs);

      blockchainValid = inputString.includes(originalHash);

      
    } catch (err) {
      blockchainValid = false;
    }

    res.json({
      success: true,
      newHash,
      originalHash,
      isDataValid,
      blockchainValid,
      isVerified: isDataValid && blockchainValid,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

router.get("/read-data", async (req, res) => {
  const start = Date.now();

  try {
    const { digest } = req.query;

    if (!digest) {
      return res.status(400).json({
        success: false,
        error: "Transaction digest is required",
      });
    }

    const txStart = Date.now();

    const txDetails = await client.getTransactionBlock({
      digest,
      options: {
        showEffects: true,
        showEvents: true,
        showInput: true,
      },
    });

    const txEnd = Date.now();

    const totalTime = Date.now() - start;
    const blockchainTime = txEnd - txStart;

    res.json({
      success: true,
      data: txDetails,

      // 🔥 PERFORMANCE MATRIX
      performance: {
        readTimeMs: totalTime,
        blockchainQueryTimeMs: blockchainTime,
        responseSizeBytes: calculateSize(txDetails),
        timestamp: new Date().toISOString(),
        status: "SUCCESS",
      },
    });
  } catch (error) {
    const totalTime = Date.now() - start;

    res.status(500).json({
      success: false,
      error: error.message,
      performance: {
        readTimeMs: totalTime,
        status: "FAILED",
      },
    });
  }
});

router.post("/benchmark", async (req, res) => {
  try {
    const { data } = req.body;

    // WRITE
    const writeStart = Date.now();

    const tx = new Transaction();
    tx.moveCall({
      target: "0x2::tx_context::sender",
      arguments: [tx.pure(String(data))],
    });

    const writeResult = await executor.executeTransaction(tx);
    const writeTime = Date.now() - writeStart;

    // READ
    const readStart = Date.now();

    const readResult = await client.getTransactionBlock({
      digest: writeResult.digest,
      options: {
        showEffects: true,
        showEvents: true,
        showInput: true,
      },
    });

    const readTime = Date.now() - readStart;

    res.json({
      success: true,
      transactionDigest: writeResult.digest,

      // 🔥 FULL PERFORMANCE MATRIX
      performance: {
        writeTimeMs: writeTime,
        readTimeMs: readTime,
        totalRoundTripMs: writeTime + readTime,
        payloadSizeBytes: calculateSize(data),
        responseSizeBytes: calculateSize(readResult),
        timestamp: new Date().toISOString(),
      },
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});
      
router.get("/performance-stats", async (req, res) => {
  try {
    const stats = await BlockchainRecord.aggregate([
      {
        $group: {
          _id: null,
          avgBlockchainTime: { $avg: "$blockchainTimeMs" },
          maxBlockchainTime: { $max: "$blockchainTimeMs" },
          minBlockchainTime: { $min: "$blockchainTimeMs" },
          avgTotalTime: { $avg: "$totalTimeMs" },
          totalTransactions: { $sum: 1 },
          totalPayloadSize: { $sum: "$payloadSizeBytes" },
        },
      },
    ]);

    const recentRecords = await BlockchainRecord.find()
      .sort({ createdAt: -1 })
      .limit(20)
      .select("blockchainTimeMs totalTimeMs payloadSizeBytes createdAt");

    res.json({
      success: true,
      summary: stats[0] || {
        avgBlockchainTime: 0,
        avgTotalTime: 0,
        totalTransactions: 0,
      },
      recent: recentRecords,
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

module.exports = router;
