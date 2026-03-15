// const { getFullnodeUrl, IotaClient } = require('@iota/iota-sdk/client');
// const { getFaucetHost, requestIotaFromFaucetV1 } = require('@iota/iota-sdk/faucet');
// const { NANOS_PER_IOTA } = require('@iota/iota-sdk/utils');

// // replace <YOUR_IOTA_ADDRESS> with your actual address
// const MY_ADDRESS = '0x4c5aeaa41035ec517ad1dc52ff70b220b0696ed21b148bcb7f7f2ff86a601fa8';

// // create a new IotaClient object pointing to devnet
// const iotaClient = new IotaClient({
//     url: getFullnodeUrl('devnet'),
// });

// // Convert NANOS to IOTA
// const balance = (balance) => {
//     return Number.parseInt(balance.totalBalance) / Number(NANOS_PER_IOTA);
// };

// async function main() {

//     // store the JSON representation for the IOTA the address owns before using faucet
//     const iotaBefore = await iotaClient.getBalance({
//         owner: MY_ADDRESS,
//     });

//     await requestIotaFromFaucetV1({
//         host: getFaucetHost('devnet'),
//         recipient: MY_ADDRESS,
//     });

//     // store the JSON representation for the IOTA the address owns after using faucet
//     const iotaAfter = await iotaClient.getBalance({
//         owner: MY_ADDRESS,
//     });

//     // Output result to console.
//     console.log(
//         `Balance before faucet: ${balance(iotaBefore)} IOTA. Balance after: ${balance(
//             iotaAfter,
//         )} IOTA. Hello, IOTA!`,
//     );
// }

// main();


const { Ed25519Keypair } = require('@iota/iota-sdk/keypairs/ed25519');

const keypair = new Ed25519Keypair();

console.log("Private Key:", keypair.getSecretKey());
console.log("Address:", keypair.getPublicKey().toIotaAddress());