const express = require("express");
const router = express.Router();
const Alert = require("../model/Alert");

const sseClients = new Set();

function sseSend(eventName, payload) {
  const msg =
    `event: ${eventName}\n` + `data: ${JSON.stringify(payload)}\n\n`;
  for (const res of sseClients) {
    try {
      res.write(msg);
    } catch {
      // ignore
    }
  }
}

async function createAlertFromServer(doc) {
  const alert = await Alert.create(doc);
  const lean = alert.toObject();
  sseSend("alert", lean);
  return lean;
}

router.get("/", async (req, res) => {
  try {
    const limit = Math.min(Number(req.query.limit || 100), 200);
    const status = req.query.status;
    const q = {};
    if (status) q.status = status;
    const alerts = await Alert.find(q)
      .sort({ createdAt: -1 })
      .limit(limit)
      .lean();
    res.json({ success: true, alerts });
  } catch (e) {
    res.status(500).json({ success: false, error: e.message });
  }
});

router.post("/", async (req, res) => {
  try {
    const { title, message, location, severity, source, metadata, relatedBlockchainRecordId } =
      req.body;
    if (!title || !severity || !source) {
      return res.status(400).json({
        success: false,
        error: "title, severity, and source are required",
      });
    }
    const alert = await createAlertFromServer({
      title,
      message: message || "",
      location: location || "Structural monitoring",
      severity,
      source,
      metadata: metadata || undefined,
      relatedBlockchainRecordId: relatedBlockchainRecordId || undefined,
    });
    res.status(201).json({ success: true, alert });
  } catch (e) {
    res.status(500).json({ success: false, error: e.message });
  }
});

router.patch("/:id", async (req, res) => {
  try {
    const { status } = req.body;
    if (!status || !["Active", "Acknowledged", "Resolved"].includes(status)) {
      return res.status(400).json({ success: false, error: "Invalid status" });
    }
    const alert = await Alert.findByIdAndUpdate(
      req.params.id,
      { status },
      { new: true },
    ).lean();
    if (!alert) return res.status(404).json({ success: false, error: "Not found" });
    sseSend("alert_updated", alert);
    res.json({ success: true, alert });
  } catch (e) {
    res.status(500).json({ success: false, error: e.message });
  }
});

router.get("/stream", (req, res) => {
  res.writeHead(200, {
    "Content-Type": "text/event-stream",
    "Cache-Control": "no-cache, no-transform",
    Connection: "keep-alive",
  });
  res.write("\n");
  sseClients.add(res);
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

router.createAlertFromServer = createAlertFromServer;

module.exports = router;
