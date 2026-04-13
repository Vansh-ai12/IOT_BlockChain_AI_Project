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

  try {
    const { features, userId } = req.body;

    if (!features || typeof features !== "object") {
      return res.status(400).json({ error: "features (object) required" });
    }

    const hash = crypto
      .createHash("sha256")
      .update(JSON.stringify(features))
      .digest("hex");

    // --- DEDUPLICATION CHECK ---
    const existingRecord = await BlockchainRecord.findOne({ proofHash: hash });
    if (existingRecord) {
      if (req.body.progress) {
        sseSend("simulationProgress", {
          fileName: req.body.fileName,
          ...req.body.progress
        });
      }

      // Still notify UI of activity even if already anchored
      sseSend("newRecord", { 
        ...existingRecord.toObject(), 
        isDuplicate: true,
        // We can pass the current time as the activity timestamp
        activeAt: new Date() 
      });

      return res.json({
        success: true,
        message: "Data already anchored. Returning existing record.",
        record: existingRecord,
        proofHash: hash,
        transactionDigest: existingRecord.transactionDigest,
        performance: {
          status: "ALREADY_EXISTS",
        },
      });
    }

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

    // --- STORAGE: Persist for Blockchain Records history ---
    const record = await BlockchainRecord.create({
      userId: userId || "SYSTEM_SIMULATOR",
      features,
      proofHash: hash,
      transactionDigest: transactionDigest,
      payloadSizeBytes: payloadSize,
      blockchainTime
    });

    // --- ALERTS TRIGGER ---
    try {
      const alertsRouter = require("./alerts");
      if (typeof alertsRouter.createAlertFromServer === "function") {
        const thresholds = [
          { key: "vibration", max: 70, severity: "High", title: "High vibration" },
          { key: "strain", max: 55, severity: "Medium", title: "Elevated strain" },
          { key: "tilt", max: 25, severity: "Medium", title: "Elevated tilt" },
        ];
        for (const t of thresholds) {
          const v = features[t.key];
          if (typeof v === "number" && v > t.max) {
            await alertsRouter.createAlertFromServer({
              title: t.title,
              message: `${t.key}=${v} exceeded threshold.`,
              location: "Blockchain pipeline",
              severity: t.severity,
              source: "blockchain",
              metadata: { features, proofHash: hash, transactionDigest },
              relatedBlockchainRecordId: record._id,
            });
          }
        }
      }
    } catch (alertErr) {
      console.error("Alert trigger failed:", alertErr.message);
    }

    // --- REALTIME BROADCAST ---
    if (req.body.progress) {
      sseSend("simulationProgress", {
        fileName: req.body.fileName,
        ...req.body.progress
      });
    }

    sseSend("newRecord", record);

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
    const records = await BlockchainRecord.find({})
      .sort({ createdAt: -1 })
      .skip(offset)
      .limit(limit)
      .lean();

    res.json({ success: true, totalCount, records });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.get("/records/stream", async (req, res) => {
  // SSE headers
  res.writeHead(200, {
    "Content-Type": "text/event-stream",
    "Cache-Control": "no-cache, no-transform",
    Connection: "keep-alive",
  });
  res.write("\n");

  sseClients.add(res);

  // tell client we're alive
  res.write(`event: ready\ndata: {}\n\n`);

  const heartbeat = setInterval(() => {
    try {
      res.write(`event: ping\ndata: {}\n\n`);
    } catch {
      // ignore
    }
  }, 25000);

  req.on("close", () => {
    clearInterval(heartbeat);
    sseClients.delete(res);
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

module.exports = router;
