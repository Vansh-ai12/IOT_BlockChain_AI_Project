const hre = require("hardhat");

async function main() {
  const MessageBoard = await hre.ethers.getContractFactory("MessageBoard");
  const contract = await MessageBoard.deploy();

  await contract.waitForDeployment();
  console.log("Contract deployed to:", await contract.getAddress());
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});



//npx hardhat run scripts/deploy.js --network iotex_testnet