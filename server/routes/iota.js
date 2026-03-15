const express = require("express");
const router = express.Router();

const { getFullnodeUrl, IotaClient } = require("@iota/iota-sdk/client");
const {
  SerialTransactionExecutor,
  Transaction,
} = require("@iota/iota-sdk/transactions");

const client = new IotaClient({ url: getFullnodeUrl("devnet") });

const { Ed25519Keypair } = require("@iota/iota-sdk/keypairs/ed25519");

const yourKeyPair = Ed25519Keypair.fromSecretKey(
  "iotaprivkey1qzmtdzae5hjwsrpfay2rh9mdwxj59a8020fz5gg72yq6ffyr9x6vxtgpk3g",
);

const executor = new SerialTransactionExecutor({
  client,
  signer: yourKeyPair,
});

router.post("/write-data", async (req, res) => {
  try {
    const { data } = req.body;

    const tx = new Transaction();

    tx.moveCall({
      target: "0x2::tx_context::sender",
      arguments: [tx.pure(String(data))],
    });

    // execute transaction
    const result = await executor.executeTransaction(tx);

    res.json({
      success: true,
      storedData: data,
      transactionDigest: result.digest,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

module.exports = router;
