import { IsString, IsArray, ArrayMaxSize, ArrayMinSize } from 'class-validator';

export class SealVaultDto {
  @IsString()
  nhiaId: string;

  @IsString()
  vaultKeyHex: string; // AES-256 key as 64-char hex string (from CloudHSM)

  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(8)
  @IsString({ each: true })
  recordHashes: string[]; // SHA-256 hex strings from health_records.record_hash
}
