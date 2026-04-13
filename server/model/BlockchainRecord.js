const mongoose = require("mongoose");

const blockchainRecordSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      required: false,
      index: true,
    },
    features: {
      type: mongoose.Schema.Types.Mixed,
      required: true,
    },
    proofHash: {
      type: String,
      required: true,
      index: true,
      unique: true,
    },
    transactionDigest: {
      type: String,
      required: true,
      index: true,
    },
    payloadSizeBytes: {
      type: Number,
      required: true,
    },
  },
  { timestamps: true },
);

module.exports = mongoose.model("BlockchainRecord", blockchainRecordSchema);

