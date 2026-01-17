const express = require('express');

const app = express();

const { Web3 } = require('web3');

const web3 = new Web3('https://babel-api.testnet.iotex.io');

const userRouter = require('./routes/user');


const contractAddress = '0xC4e4a6D16d557B8651C6bB1E09BFf5e4E47e5514';
const abi = [
  {
    "anonymous": false,
    "inputs": [
      { "indexed": false, "internalType": "address", "name": "sender", "type": "address" },
      { "indexed": false, "internalType": "string", "name": "message", "type": "string" }
    ],
    "name": "MessagePosted",
    "type": "event"
  },
  {
    "inputs": [
      { "internalType": "string", "name": "message", "type": "string" }
    ],
    "name": "postMessage",
    "outputs": [],
    "stateMutability": "nonpayable",
    "type": "function"
  }
];

const contract = new web3.eth.Contract(abi, contractAddress);

// Your Metamask testnet private key:
// Must include the 0x prefix when using Web3.js in JavaScript
const privateKey = "0x28f9aa3c1074c7a0a380015b6e2d3c85a2ad5cff312ca59dfc5a19aea113e9f8"; 

const account = web3.eth.accounts.privateKeyToAccount(privateKey);
web3.eth.accounts.wallet.add(account);

async function sendMessage(text) {
  console.log(`Sending message "${text}" to the IoTeX testnet...`);

  const tx = contract.methods.postMessage(text);
  const gas = await tx.estimateGas({ from: account.address });

  const receipt = await tx.send({
    from: account.address,
    gas
  });

  console.log('Transaction receipt:', receipt);
}

sendMessage("Hello from IoTeX!");

app.get("/",(req,res)=>{
    res.send("Hello, World!");
})

app.use("/user",userRouter);



app.listen(9000,()=> console.log("Server started!!!"));