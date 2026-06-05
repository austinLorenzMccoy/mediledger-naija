// Edge Function: emergency-access-alert
// Called by NestJS emergency-service AFTER returning data (async, non-blocking)
// Alerts patient that their emergency health data was accessed

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
    // Verify internal request from NestJS emergency-service
    const internalKey = req.headers.get('x-internal-key');
    if (internalKey !== Deno.env.get('INTERNAL_API_KEY')) {
      return new Response('Unauthorized', { status: 401 });
    }

    const { patient_nhia_id, provider_name, hospital_name, accessed_at } = await req.json();

    const { data: patient } = await supabase
      .from('patients')
      .select('phone_number')
      .eq('nhia_id', patient_nhia_id)
      .single();

    if (!patient) {
      return new Response('Patient not found', { status: 404 });
    }

    const accessedDate = new Date(accessed_at).toLocaleString('en-NG', {
      timeZone: 'Africa/Lagos',
    });

    const message =
      `MediLedger ALERT: Your emergency health data was accessed ` +
      `by ${provider_name} at ${hospital_name} on ${accessedDate}. ` +
      `Not you? Call NHIA: 0800-MEDILEDGER`;

    const sent = await sendSMS(patient.phone_number, message);

    await supabase.from('notification_log').insert({
      type: 'emergency_access_alert',
      patient_nhia_id,
      channel: 'sms',
      sent_at: new Date().toISOString(),
      success: sent,
    });

    return new Response(JSON.stringify({ alerted: sent }), {
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (err) {
    console.error('emergency-access-alert error:', err);
    return new Response('Internal server error', { status: 500 });
  }
});
