// Edge Function: task-completion-notification
// Called by NestJS token-service after HEAL consent payment confirmed
// Sends patient SMS, posts to NHIA Slack, and fires HCS audit log

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

serve(async (req) => {
  try {
    // Verify internal request from NestJS token-service
    const internalKey = req.headers.get('x-internal-key');
    if (internalKey !== Deno.env.get('INTERNAL_API_KEY')) {
      return new Response('Unauthorized', { status: 401 });
    }

    const { tx_id, to_patient_nhia_id, amount_heal, consent_id } = await req.json();

    const { data: patient } = await supabase
      .from('patients')
      .select('phone_number')
      .eq('nhia_id', to_patient_nhia_id)
      .single();

    if (!patient) {
      return new Response('Patient not found', { status: 404 });
    }

    // 1. Send patient SMS
    const ngnEquivalent = (amount_heal * 100).toFixed(0);
    const sent = await sendSMS(
      patient.phone_number,
      `MediLedger: ₦${ngnEquivalent} credited to your HEAL wallet. ` +
      `Consent ID: ${String(consent_id).slice(0, 8)}...`,
    );

    // 2. Post to NHIA operations Slack channel
    const slackWebhook = Deno.env.get('NHIA_SLACK_WEBHOOK');
    if (slackWebhook) {
      await fetch(slackWebhook, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          text: `💚 HEAL Payment: ${amount_heal} tokens → patient ${to_patient_nhia_id} | TX: ${tx_id}`,
        }),
      }).catch(() => {}); // Non-blocking
    }

    // 3. Update Hedera audit log (fire-and-forget to NestJS token-service)
    const nestjsUrl = Deno.env.get('NESTJS_API_URL');
    if (nestjsUrl) {
      fetch(`${nestjsUrl}/api/v1/tokens/confirm-hcs`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-internal-key': Deno.env.get('INTERNAL_API_KEY')!,
        },
        body: JSON.stringify({ tx_id, consent_id }),
      }).catch(() => {}); // Intentionally non-blocking
    }

    await supabase.from('notification_log').insert({
      type: 'task_completion_payment',
      patient_nhia_id: to_patient_nhia_id,
      consent_id,
      channel: 'sms',
      sent_at: new Date().toISOString(),
      success: sent,
    });

    return new Response(JSON.stringify({ done: true }), {
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (err) {
    console.error('task-completion-notification error:', err);
    return new Response('Internal server error', { status: 500 });
  }
});
