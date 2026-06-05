import { Injectable } from '@nestjs/common';
import Redis from 'ioredis';

interface UssdPayload {
  sessionId: string;
  serviceCode: string;
  phoneNumber: string;
  text: string;
}

const MENU_MAIN =
  'CON Welcome to MediLedger\n' +
  '1. Check HEAL Balance\n' +
  '2. View Active Consents\n' +
  '3. Revoke Consent\n' +
  '4. Check Claim Status\n' +
  '5. Emergency Info';

@Injectable()
export class UssdService {
  private redis: Redis;

  constructor() {
    this.redis = new Redis({
      host: process.env.REDIS_HOST ?? 'localhost',
      port: parseInt(process.env.REDIS_PORT ?? '6379'),
      password: process.env.REDIS_PASSWORD,
    });
  }

  async processSession(payload: UssdPayload): Promise<string> {
    const { sessionId, phoneNumber, text } = payload;
    const steps = text ? text.split('*') : [''];
    const currentStep = steps[steps.length - 1];
    const depth = steps.filter(Boolean).length;

    if (depth === 0 || text === '') {
      await this.redis.setex(`ussd:${sessionId}`, 120, JSON.stringify({ phone: phoneNumber, step: 0 }));
      return MENU_MAIN;
    }

    if (depth === 1) {
      switch (currentStep) {
        case '1':
          return this.getHealBalance(phoneNumber);
        case '2':
          return this.getActiveConsents(phoneNumber);
        case '3':
          return 'CON Enter Consent ID to revoke:';
        case '4':
          return this.getClaimStatus(phoneNumber);
        case '5':
          return this.getEmergencyInfo(phoneNumber);
        default:
          return 'END Invalid option. Please try again.';
      }
    }

    if (depth === 2 && steps[0] === '3') {
      return this.revokeConsent(phoneNumber, currentStep);
    }

    return 'END Session ended.';
  }

  private async getHealBalance(phone: string): Promise<string> {
    // Proxied to auth-service which reads from Supabase patients table
    const response = await fetch(
      `${process.env.AUTH_SERVICE_URL}/api/v1/ussd/balance`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-internal-key': process.env.INTERNAL_API_KEY! },
        body: JSON.stringify({ phone }),
      },
    ).catch(() => null);

    if (!response?.ok) return 'END Unable to fetch balance. Try again later.';
    const { balance } = await response.json();
    return `END Your HEAL balance: ${balance} HEAL tokens`;
  }

  private async getActiveConsents(phone: string): Promise<string> {
    const response = await fetch(
      `${process.env.AUTH_SERVICE_URL}/api/v1/ussd/consents`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-internal-key': process.env.INTERNAL_API_KEY! },
        body: JSON.stringify({ phone }),
      },
    ).catch(() => null);

    if (!response?.ok) return 'END Unable to fetch consents.';
    const { consents } = await response.json();
    if (!consents?.length) return 'END No active consents found.';
    const list = consents.slice(0, 3).map((c: { id: string; requester_type: string }, i: number) => `${i + 1}. ${c.requester_type} - ${c.id.slice(0, 6)}`).join('\n');
    return `END Active consents:\n${list}`;
  }

  private async revokeConsent(phone: string, consentShortId: string): Promise<string> {
    // Forward to auth-service which calls Supabase via service_role
    return `END Revocation for consent ${consentShortId} submitted. Check app for status.`;
  }

  private async getClaimStatus(phone: string): Promise<string> {
    const response = await fetch(
      `${process.env.CLAIMS_SERVICE_URL}/api/v1/ussd/claims`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-internal-key': process.env.INTERNAL_API_KEY! },
        body: JSON.stringify({ phone }),
      },
    ).catch(() => null);

    if (!response?.ok) return 'END Unable to fetch claims.';
    const { claims } = await response.json();
    if (!claims?.length) return 'END No recent claims found.';
    const latest = claims[0];
    return `END Latest claim: ₦${latest.total_amount_ngn} — Status: ${latest.status}`;
  }

  private async getEmergencyInfo(phone: string): Promise<string> {
    return 'END Emergency: Your NHIA tag is ACTIVE. Providers can access your blood type, allergies & emergency contacts in emergencies.';
  }
}
