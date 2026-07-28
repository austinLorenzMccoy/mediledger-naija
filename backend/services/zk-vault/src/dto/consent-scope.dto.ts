import { IsString, IsArray, ArrayMaxSize, ArrayMinSize, IsNumber } from 'class-validator';

export class ConsentScopeDto {
  @IsString()
  nhiaId: string;

  @IsString()
  consentId: string;

  /** Encoded record_type values in the consent scope (max 10). */
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(10)
  @IsNumber({}, { each: true })
  scopeItems: number[];

  /** Encoded record_type being requested. */
  @IsNumber()
  requestedType: number;

  /**
   * keccak256 scope hash from ConsentRegistry (hex string, optional integrity tag).
   * Circuit currently does not bind this to scopeItems — passed as public signal for audit.
   */
  @IsString()
  scopeHash: string;
}
