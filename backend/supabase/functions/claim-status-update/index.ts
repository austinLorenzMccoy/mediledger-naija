// Edge Function: claim-status-update
// Triggered by DB Webhook on insurance_claims UPDATE
// Sends SMS + web push notification to patient on meaningful status changes

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const supabase = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
);

async function sendSMS(to: string, message: string): Promise<boolean> {
  const response = await fetch('https://api.africastalking.com/version1/messaging', {
    method: 'POST',
    headers: {
      apiKey: Deno.env.get('AT_API_KEY')!,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams({
      username: Deno.env.get('AT_USERNAME')!,
      to,
      message,
      from: 'MEDILEDGER',
    }),
  });
  return response.ok;
}

async function triggerWebPush(nhia_id: string, notification: { title: string; body: string }) {
  // Web push via VAPID — delegated to NestJS api-gateway push endpoint
  const nestjsUrl = Deno.env.get('NESTJS_API_URL');
  if (!nestjsUrl) return;
  await fetch(`${nestjsUrl}/api/v1/push/send`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-internal-key': Deno.env.get('INTERNAL_API_KEY')!,
    },
    body: JSON.stringify({ nhia_id, ...notification }),
  }).catch(() => {}); // Non-blocking; fire-and-forget
}

const STATUS_MESSAGES: Record<string, (record: Record<string, unknown>) => string> = {
  approved: (r) =>
    `✅ Your insurance claim for ₦${Number(r.approved_amount_ngn).toLocaleString('en-NG')} has been APPROVED.`,
  rejected: (r) =>
    `❌ Claim rejected: ${r.rejection_reason ?? 'Contact your HMO for details.'}`,
  paid: (r) =>
    `💰 Payment of ₦${Number(r.approved_amount_ngn).toLocaleString('en-NG')} processed to your provider.`,
  hmo_review: () =>
    `📋 Your claim is under HMO review. You'll hear back within 48 hours.`,
};

serve(async (req) => {
  try {
    const { record, old_record } = await req.json(); // Supabase DB Webhook payload

    if (record.status === old_record?.status) {
      return new Response('no-op', { status: 200 });
    }

    const messageFactory = STATUS_MESSAGES[record.status as string];
    if (!messageFactory) {
      return new Response('no-op', { status: 200 });
    }

    const { data: patient } = await supabase
      .from('patients')
      .select('phone_number, nhia_id')
      .eq('id', record.patient_id)
      .single();

    if (!patient) {
      return new Response('Patient not found', { status: 404 });
    }

    const message = messageFactory(record as Record<string, unknown>);
    const sent = await sendSMS(patient.phone_number, `MediLedger: ${message}`);

    await triggerWebPush(patient.nhia_id, { title: 'Claim Update', body: message });

    await supabase.from('notification_log').insert({
      type: 'claim_status_update',
      patient_nhia_id: patient.nhia_id,
      claim_id: record.id,
      channel: 'sms',
      sent_at: new Date().toISOString(),
      success: sent,
    });

    return new Response('ok', { status: 200 });
  } catch (err) {
    console.error('claim-status-update error:', err);
    return new Response('Internal server error', { status: 500 });
  }
});
