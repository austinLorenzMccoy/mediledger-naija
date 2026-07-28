/**
 * Deploy ZK verifier contracts to Hedera HSCS.
 * Run AFTER setup-circuits.sh has generated contracts/src/VaultIntegrityVerifier.sol.
 *
 *   npx hardhat run scripts/deploy-verifier.js --network hedera_testnet
 *
 * Env:
 *   NHIA_DEPLOYER_PRIVATE_KEY_HEX
 *   CONSENT_CONTRACT_ADDRESS  (0x… EVM address of ConsentRegistry — optional Phase 2)
 *   TRANSFER_CONSENT_ADMIN=true  (if set, transfer ConsentRegistry admin to the wrapper)
 */
const hre = require("hardhat");

async function main() {
  const [deployer] = await hre.ethers.getSigners();
  console.log(`Deploying ZK contracts with account: ${deployer.address}`);
  console.log(`Network: ${hre.network.name}`);

  console.log("\n▶ Deploying VaultIntegrityVerifier...");
  const Verifier = await hre.ethers.getContractFactory("VaultIntegrityVerifier");
  const verifier = await Verifier.deploy();
  await verifier.deployed();
  console.log(`✓ VaultIntegrityVerifier deployed: ${verifier.address}`);

  const consentRegistryAddr = process.env.CONSENT_CONTRACT_ADDRESS;
  if (consentRegistryAddr) {
    console.log("\n▶ Deploying VaultAwareConsentRegistry...");
    const VaultConsent = await hre.ethers.getContractFactory("VaultAwareConsentRegistry");
    const vaultConsent = await VaultConsent.deploy(verifier.address, consentRegistryAddr);
    await vaultConsent.deployed();
    console.log(`✓ VaultAwareConsentRegistry deployed: ${vaultConsent.address}`);

    if (process.env.TRANSFER_CONSENT_ADMIN === "true") {
      console.log("\n▶ Transferring ConsentRegistry admin → VaultAwareConsentRegistry...");
      const registry = await hre.ethers.getContractAt("ConsentRegistry", consentRegistryAddr);
      const tx = await registry.transferAdmin(vaultConsent.address);
      await tx.wait();
      console.log("✓ ConsentRegistry.nhiaAdmin is now VaultAwareConsentRegistry");
    } else {
      console.log("\n⚠  Not transferring ConsentRegistry admin.");
      console.log("   grantConsentWithProof will fail until you run:");
      console.log(`   ConsentRegistry.transferAdmin(${vaultConsent.address})`);
      console.log("   Or re-run with TRANSFER_CONSENT_ADMIN=true");
    }

    console.log("\n═══════════════════════════════════════════════");
    console.log("Add to backend/.env:");
    console.log(`VAULT_VERIFIER_CONTRACT_ADDRESS=${verifier.address}`);
    console.log(`VAULT_AWARE_CONSENT_ADDRESS=${vaultConsent.address}`);
    console.log("═══════════════════════════════════════════════");
  } else {
    console.log("\n(Skipping VaultAwareConsentRegistry — set CONSENT_CONTRACT_ADDRESS to deploy)");
    console.log("\n═══════════════════════════════════════════════");
    console.log("Add to backend/.env:");
    console.log(`VAULT_VERIFIER_CONTRACT_ADDRESS=${verifier.address}`);
    console.log("═══════════════════════════════════════════════");
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
