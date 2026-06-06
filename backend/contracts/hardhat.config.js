require('@nomiclabs/hardhat-ethers');
require('@nomiclabs/hardhat-waffle');
require('dotenv').config({ path: '../.env' });

// Hedera JSON-RPC relay endpoints for Hardhat/Ethers.js compatibility
const HEDERA_TESTNET_RPC = 'https://testnet.hashio.io/api';
const HEDERA_MAINNET_RPC = 'https://mainnet.hashio.io/api';

// Hedera chain IDs (EIP-155)
// Mainnet: 295, Testnet: 296, Previewnet: 297
module.exports = {
  solidity: {
    version: '0.8.20',
    settings: {
      optimizer: { enabled: true, runs: 200 },
      viaIR: true,
    },
  },
  networks: {
    hedera_testnet: {
      url: HEDERA_TESTNET_RPC,
      chainId: 296,
      accounts: process.env.NHIA_DEPLOYER_PRIVATE_KEY_HEX
        ? [process.env.NHIA_DEPLOYER_PRIVATE_KEY_HEX]
        : [],
      gas: 4_000_000,
      gasPrice: 1_200_000_000_000, // 1200 Gwei — above Hedera testnet relay minimum (~1100 Gwei)
    },
    hedera_mainnet: {
      url: HEDERA_MAINNET_RPC,
      chainId: 295,
      accounts: process.env.NHIA_DEPLOYER_PRIVATE_KEY_HEX
        ? [process.env.NHIA_DEPLOYER_PRIVATE_KEY_HEX]
        : [],
      gas: 4_000_000,
      gasPrice: 470_000_000_000, // 470 Gwei — Hedera mainnet minimum
    },
  },
  paths: {
    sources: './src',
    tests: './test',
    cache: './cache',
    artifacts: './artifacts',
  },
  mocha: {
    timeout: 120000, // Hedera consensus ~3-5s per TX
  },
};
