const path = require('path');
const {
  Client,
  AccountId,
  PrivateKey,
  TokenCreateTransaction,
  TokenType,
  TokenSupplyType,
  Hbar,
} = require('@hashgraph/sdk');
require('dotenv').config({ path: path.join(__dirname, '../../.env') });

async function createHealToken() {
  const client = process.env.HEDERA_NETWORK === 'mainnet'
    ? Client.forMainnet()
    : Client.forTestnet();

  client.setOperator(
    AccountId.fromString(process.env.HEDERA_OPERATOR_ID),
    PrivateKey.fromStringECDSA(process.env.HEDERA_OPERATOR_KEY),
  );

  const adminKey  = PrivateKey.fromStringECDSA(process.env.NHIA_ADMIN_KEY);
  const freezeKey = PrivateKey.fromStringECDSA(process.env.NHIA_ADMIN_KEY);
  const treasuryId = AccountId.fromString(process.env.NHIA_TREASURY_ID);

  console.log('Creating HEAL Token on Hedera', process.env.HEDERA_NETWORK ?? 'testnet', '...');

  const tx = await new TokenCreateTransaction()
    .setTokenName('HEAL Token')
    .setTokenSymbol('HEAL')
    .setTokenType(TokenType.FungibleCommon)
    .setDecimals(4)
    .setInitialSupply(100_000_000_0000)  // 10,000,000 HEAL × 10^4
    .setMaxSupply(1_000_000_000_0000)    // 100,000,000 HEAL × 10^4
    .setSupplyType(TokenSupplyType.Finite)
    .setTreasuryAccountId(treasuryId)
    .setAdminKey(adminKey.publicKey)
    .setFreezeKey(freezeKey.publicKey)
    .setMaxTransactionFee(new Hbar(30))
    .execute(client);

  const receipt = await tx.getReceipt(client);
  const tokenId = receipt.tokenId.toString();

  console.log('\nHEAL Token created successfully!');
  console.log('Token ID:', tokenId);
  console.log('Treasury:', treasuryId.toString());
  console.log('\nAdd to .env: HEAL_TOKEN_ID=' + tokenId);
}

createHealToken().catch((e) => {
  console.error(e);
  process.exit(1);
});
