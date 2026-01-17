require("@nomicfoundation/hardhat-toolbox");

module.exports = {
  solidity: "0.8.21",
  networks: {
    iotex_testnet: {
      url: "https://babel-api.testnet.iotex.io",
      accounts: ["28f9aa3c1074c7a0a380015b6e2d3c85a2ad5cff312ca59dfc5a19aea113e9f8"]
    }
  }
};