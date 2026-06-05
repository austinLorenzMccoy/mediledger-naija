const {
  Client,
  AccountId,
  PrivateKey,
  TopicCreateTransaction,
  Hbar,
} = require('@hashgraph/sdk');
require('dotenv').config({ path: '../../.env' });

const TOPICS = [
  { name: 'mediledger.audit.main',  memo: 'MediLedger: All platform events (permanent)' },
  { name: 'mediledger.consent',     memo: 'MediLedger: Consent grants/revocations/expirations (7yr)' },
  { name: 'mediledger.claims',      memo: 'MediLedger: Insurance claim lifecycle events (7yr)' },
  { name: 'mediledger.federated',   memo: 'MediLedger: Federated learning round coordination (5yr)' },
  { name: 'mediledger.emergency',   memo: 'MediLedger: Emergency data access audit log (7yr)' },
];

async function createTopics() {
  const client = process.env.HEDERA_NETWORK === 'mainnet'
    ? Client.forMainnet()
    : Client.forTestnet();

  client.setOperator(
    AccountId.fromString(process.env.HEDERA_OPERATOR_ID),
    PrivateKey.fromString(process.env.HEDERA_OPERATOR_KEY),
  );

  const submitKey = PrivateKey.fromString(process.env.NHIA_SUBMIT_KEY);

  console.log('Creating HCS topics on Hedera', process.env.HEDERA_NETWORK ?? 'testnet', '...\n');

  const results = {};

  for (const topic of TOPICS) {
    const tx = await new TopicCreateTransaction()
      .setTopicMemo(topic.memo)
      .setSubmitKey(submitKey.publicKey)
      .setMaxTransactionFee(new Hbar(5))
      .execute(client);

    const receipt = await tx.getReceipt(client);
    const topicId = receipt.topicId.toString();
    results[topic.name] = topicId;

    console.log(`${topic.name}: ${topicId}`);
  }

  console.log('\n=== Add these to your .env ===');
  console.log(`HCS_TOPIC_AUDIT=${results['mediledger.audit.main']}`);
  console.log(`HCS_TOPIC_CONSENT=${results['mediledger.consent']}`);
  console.log(`HCS_TOPIC_CLAIMS=${results['mediledger.claims']}`);
  console.log(`HCS_TOPIC_FEDERATED=${results['mediledger.federated']}`);
  console.log(`HCS_TOPIC_EMERGENCY=${results['mediledger.emergency']}`);
  console.log('==============================\n');
}

createTopics().catch((e) => {
  console.error(e);
  process.exit(1);
});
