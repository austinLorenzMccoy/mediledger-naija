import { Injectable, OnModuleInit, Logger } from '@nestjs/common';
import {
  Client,
  AccountId,
  PrivateKey,
  ContractExecuteTransaction,
  ContractCallQuery,
  ContractId,
  Hbar,
} from '@hashgraph/sdk';

@Injectable()
export class HederaService implements OnModuleInit {
  private readonly logger = new Logger(HederaService.name);
  private client: Client;
  private contractId: ContractId;

  onModuleInit() {
    const operatorId = AccountId.fromString(process.env.HEDERA_OPERATOR_ID!);
    const operatorKey = PrivateKey.fromString(process.env.HEDERA_OPERATOR_KEY!);

    this.client = process.env.HEDERA_NETWORK === 'mainnet'
      ? Client.forMainnet()
      : Client.forTestnet();

    this.client.setOperator(operatorId, operatorKey);
    this.contractId = ContractId.fromString(process.env.CLAIMS_CONTRACT_ID!);
    this.logger.log(`Hedera client initialized — contract: ${this.contractId}`);
  }

  // Submit a claim to ClaimsProcessor.sol on Hedera
  async submitClaimToContract(
    claimId: string,
    patientAccountId: string,
    providerAccountId: string,
    totalAmountTinybars: number,
  ): Promise<string> {
    const { ContractFunctionParameters } = require('@hashgraph/sdk');

    const params = new ContractFunctionParameters()
      .addString(claimId)
      .addAddress(patientAccountId)
      .addAddress(providerAccountId)
      .addUint256(totalAmountTinybars);

    const tx = await new ContractExecuteTransaction()
      .setContractId(this.contractId)
      .setGas(300_000)
      .setFunction('submitClaim', params)
      .setMaxTransactionFee(new Hbar(2))
      .execute(this.client);

    const receipt = await tx.getReceipt(this.client);
    this.logger.log(`submitClaim TX: ${tx.transactionId} — status: ${receipt.status}`);
    return tx.transactionId.toString();
  }

  // Execute HMO approval on-chain
  async approveClaimOnChain(claimId: string, approvedAmount: number): Promise<string> {
    const { ContractFunctionParameters } = require('@hashgraph/sdk');

    const params = new ContractFunctionParameters()
      .addString(claimId)
      .addUint256(approvedAmount);

    const tx = await new ContractExecuteTransaction()
      .setContractId(this.contractId)
      .setGas(200_000)
      .setFunction('approveClaim', params)
      .setMaxTransactionFee(new Hbar(2))
      .execute(this.client);

    const receipt = await tx.getReceipt(this.client);
    this.logger.log(`approveClaim TX: ${tx.transactionId} — status: ${receipt.status}`);
    return tx.transactionId.toString();
  }

  // Query contract for on-chain claim status
  async getClaimStatusOnChain(claimId: string): Promise<string> {
    const { ContractFunctionParameters } = require('@hashgraph/sdk');

    const params = new ContractFunctionParameters().addString(claimId);

    const result = await new ContractCallQuery()
      .setContractId(this.contractId)
      .setGas(100_000)
      .setFunction('getClaimStatus', params)
      .execute(this.client);

    return result.getString(0);
  }
}
