/**
 * AI Health Guardian client — proxies through Next.js rewrite → AI service.
 * Requires authenticated session; backend still enforces internal key in prod via gateway.
 */

export type AiInsight = {
  type?: string;
  condition: string;
  display_name?: string;
  severity: string;
  confidence: number;
  explanation?: string;
  clinical_detail?: string;
  recommended_action?: string;
};

export type AiInferResponse = {
  patient_nhia_id: string;
  inference_at: string;
  model_version: string;
  insights: AiInsight[];
  privacy_guarantee?: Record<string, unknown>;
  hcs_audit_ref?: string;
  error?: string;
};

function internalHeaders(): HeadersInit {
  // Browser cannot hold service role; gateway may inject key server-side.
  // For local dev, optional public key only if gateway allows public infer.
  return {
    'Content-Type': 'application/json',
    ...(process.env.NEXT_PUBLIC_INTERNAL_API_KEY
      ? { 'x-internal-key': process.env.NEXT_PUBLIC_INTERNAL_API_KEY }
      : {}),
  };
}

export const aiApi = {
  async infer(nhiaId: string): Promise<AiInferResponse> {
    const res = await fetch(`/api/v1/ai/infer/${encodeURIComponent(nhiaId)}`, {
      method: 'POST',
      headers: internalHeaders(),
    });
    const body = await res.json().catch(() => ({}));
    if (!res.ok) {
      return {
        patient_nhia_id: nhiaId,
        inference_at: new Date().toISOString(),
        model_version: 'unavailable',
        insights: [],
        error: body.detail ?? body.message ?? `AI service error (${res.status})`,
      };
    }
    return body as AiInferResponse;
  },

  async getCachedInsights(nhiaId: string): Promise<AiInferResponse | null> {
    try {
      const res = await fetch(`/api/v1/ai/insights/${encodeURIComponent(nhiaId)}`, {
        headers: internalHeaders(),
      });
      if (!res.ok) return null;
      return (await res.json()) as AiInferResponse;
    } catch {
      return null;
    }
  },
};
