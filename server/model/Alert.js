const mongoose = require("mongoose");

const alertSchema = new mongoose.Schema(
  {
    title: { type: String, required: true, trim: true },
    message: { type: String, trim: true, default: "" },
    location: { type: String, trim: true, default: "Structural monitoring" },
    severity: {
      type: String,
      enum: ["High", "Medium", "Low"],
      required: true,
    },
    source: {
      type: String,
      enum: ["prediction", "blockchain", "sensor"],
      required: true,
    },
    status: {
      type: String,
      enum: ["Active", "Acknowledged", "Resolved"],
      default: "Active",
    },
    metadata: { type: mongoose.Schema.Types.Mixed },
    relatedBlockchainRecordId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "BlockchainRecord",
    },
  },
  { timestamps: true },
);

module.exports = mongoose.model("Alert", alertSchema);
