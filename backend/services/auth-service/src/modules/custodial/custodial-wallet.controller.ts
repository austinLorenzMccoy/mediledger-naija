import { Controller, Post, Body, Headers, UnauthorizedException, Param } from '@nestjs/common';
import { CustodialWalletService } from './custodial-wallet.service';

class CreateCustodialDto {
  patientId: string;
  phoneNumber: string;
}

@Controller('wallet/custodial')
export class CustodialWalletController {
  constructor(private readonly custodialService: CustodialWalletService) {}

  private checkInternalKey(key: string | undefined) {
    if (key !== process.env.INTERNAL_API_KEY) throw new UnauthorizedException();
  }

  @Post()
  async createWallet(
    @Body() dto: CreateCustodialDto,
    @Headers('x-internal-key') key: string,
  ) {
    this.checkInternalKey(key);
    return this.custodialService.createCustodialWallet(dto.patientId, dto.phoneNumber);
  }

  @Post(':patientId/request-migration')
  async requestMigration(
    @Param('patientId') patientId: string,
    @Headers('x-internal-key') key: string,
  ) {
    this.checkInternalKey(key);
    return this.custodialService.requestSelfCustodyMigration(patientId);
  }

  @Post(':patientId/complete-migration')
  async completeMigration(
    @Param('patientId') patientId: string,
    @Headers('x-internal-key') key: string,
  ) {
    this.checkInternalKey(key);
    return this.custodialService.completeSelfCustodyMigration(patientId);
  }
}
