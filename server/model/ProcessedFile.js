const mongoose = require('mongoose');

const ProcessedFileSchema = new mongoose.Schema({
  fileName: {
    type: String,
    required: true,
    unique: true
  },
  totalRows: {
    type: Number,
    required: true
  },
  assessment: {
    type: String,
    enum: ['undamaged', 'damaged', 'unknown'],
    default: 'unknown'
  },
  maxAmplitude: {
    type: Number,
    default: 0
  },
  processedAt: {
    type: Date,
    default: Date.now
  }
});

module.exports = mongoose.model('ProcessedFile', ProcessedFileSchema);
