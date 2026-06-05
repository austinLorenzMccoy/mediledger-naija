const { ethers } = require('hardhat');
require('dotenv').config({ path: '../../.env' });

async function main() {
  const [deployer] = await ethers.getSigners();
  console.log('Deploying MediLedger contracts with account:', deployer.address);
  console.log('Account balance:', ethers.utils.formatEther(await deployer.getBalance()), 'HBAR');

  const NHIA_ADMIN  = process.env.NHIA_ADMIN_ADDRESS;
  const NHIA_GOV    = process.env.NHIA_GOVERNANCE_ADDRESS;

  if (!NHIA_ADMIN || !NHIA_GOV) {
    throw new Error('NHIA_ADMIN_ADDRESS and NHIA_GOVERNANCE_ADDRESS must be set in .env');
  }

  // ── 1. Deploy ConsentRegistry ────────────────────────────────────────
  console.log('\nDeploying ConsentRegistry...');
  const ConsentRegistry = await ethers.getContractFactory('ConsentRegistry');
  const consentRegistry = await ConsentRegistry.deploy(NHIA_ADMIN, NHIA_GOV);
  await consentRegistry.deployed();
  console.log('ConsentRegistry deployed to:', consentRegistry.address);

  // ── 2. Deploy ClaimsProcessor ────────────────────────────────────────
  console.log('\nDeploying ClaimsProcessor...');
  const ClaimsProcessor = await ethers.getContractFactory('ClaimsProcessor');
  const claimsProcessor = await ClaimsProcessor.deploy(NHIA_ADMIN);
  await claimsProcessor.deployed();
  console.log('ClaimsProcessor deployed to:', claimsProcessor.address);

  // ── 3. Deploy EnrollmentVerifier ─────────────────────────────────────
  console.log('\nDeploying EnrollmentVerifier...');
  const EnrollmentVerifier = await ethers.getContractFactory('EnrollmentVerifier');
  const enrollmentVerifier = await EnrollmentVerifier.deploy(NHIA_ADMIN);
  await enrollmentVerifier.deployed();
  console.log('EnrollmentVerifier deployed to:', enrollmentVerifier.address);

  // ── Output .env additions ─────────────────────────────────────────────
  console.log('\n=== Add these to your .env ===');
  console.log(`CONSENT_REGISTRY_ADDRESS=${consentRegistry.address}`);
  console.log(`CLAIMS_PROCESSOR_ADDRESS=${claimsProcessor.address}`);
  console.log(`ENROLLMENT_VERIFIER_ADDRESS=${enrollmentVerifier.address}`);
  console.log('==============================\n');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
