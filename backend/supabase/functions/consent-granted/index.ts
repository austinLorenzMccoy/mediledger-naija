// Edge Function: consent-granted
// Triggered by DB Webhook on consent_agreements INSERT (status=active)
// Sends SMS to patient via Africa's Talking

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
    const { consent_id, patient_nhia_id, requester_name, monthly_heal } = await req.json();

    const { data: patient, error } = await supabase
      .from('patients')
      .select('phone_number')
      .eq('nhia_id', patient_nhia_id)
      .single();

    if (error || !patient) {
      return new Response('Patient not found', { status: 404 });
    }

    const message =
      `MediLedger: You granted data access to ${requester_name}. ` +
      `You'll earn ${monthly_heal} HEAL/month. ` +
      `Manage at mediledger-nigeria.vercel.app`;

    const sent = await sendSMS(patient.phone_number, message);

    await supabase.from('notification_log').insert({
      type: 'consent_granted',
      patient_nhia_id,
      consent_id,
      channel: 'sms',
      sent_at: new Date().toISOString(),
      success: sent,
    });

    return new Response(JSON.stringify({ sent }), {
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (err) {
    console.error('consent-granted error:', err);
    return new Response('Internal server error', { status: 500 });
  }
});
