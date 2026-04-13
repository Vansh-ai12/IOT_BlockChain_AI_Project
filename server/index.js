const express = require('express');
const cors = require('cors');
const mongoose = require('mongoose');




const userRouter = require('./routes/user');

const iotaRouter = require('./routes/iota');
const alertsRouter = require('./routes/alerts');

const app = express();


// Connect to MongoDB
mongoose.connect('mongodb://127.0.0.1:27017/ai_blockchain_db')
  .then(async () => {
    console.log('MongoDB successfully connected');
    
    // --- ONE-TIME DATA CLEANUP ---
    try {
      const BlockchainRecord = require('./model/BlockchainRecord');
      const records = await BlockchainRecord.find({}).sort({ createdAt: 1 });
      const seen = new Set();
      const duplicates = [];

      for (const rec of records) {
        if (seen.has(rec.proofHash)) {
          duplicates.push(rec._id);
        } else {
          seen.add(rec.proofHash);
        }
      }

      if (duplicates.length > 0) {
        await BlockchainRecord.deleteMany({ _id: { $in: duplicates } });
        console.log(`🧹 Cleaned up ${duplicates.length} duplicate records.`);
      }
    } catch (err) {
      console.warn("Cleanup warning:", err.message);
    }
  })
  .catch(err => console.error('MongoDB connection error:', err));

app.use(cors());
app.use(express.json());

app.use(express.urlencoded({ extended: true }));


app.get("/",(req,res)=>{
    res.send("Hello, World!");
})

app.use("/iota", iotaRouter);

app.use("/alerts", alertsRouter);

app.use("/user",userRouter);

// --- AUTO-START SENSOR SIMULATION ---
// This starts the periodic anchoring of sensor data from sensor_data.csv
try {
    const simulator = require('./simulate_logic'); 
    simulator.start();
    console.log("📡 Sensor simulation started automatically.");
} catch (err) {
    console.warn("⚠️ Could not start auto-simulator:", err.message);
}

app.listen(9000,()=> console.log("Server started on port 9000!!!"));