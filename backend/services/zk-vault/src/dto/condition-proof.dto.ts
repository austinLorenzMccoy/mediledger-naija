import { IsString, IsNumber } from 'class-validator';

export class ConditionProofDto {
  @IsString()
  nhiaId: string;

  @IsString()
  vaultKeyHex: string;

  @IsString()
  recordHash: string; // health_records.record_hash (SHA-256 hex)

  @IsNumber()
  recordValue: number; // conditionCode * 10_000 + actualValue

  @IsNumber()
  conditionCode: number; // LOINC code (e.g. 882 for blood type)

  @IsNumber()
  conditionValue: number; // expected value (e.g. 6 for O+)
}
