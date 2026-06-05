import { IsObject, IsArray, IsString } from 'class-validator';

export class VerifyProofDto {
  @IsObject()
  proof: {
    pi_a: string[];
    pi_b: string[][];
    pi_c: string[];
    protocol: string;
    curve: string;
  };

  @IsArray()
  @IsString({ each: true })
  publicSignals: string[];
}
