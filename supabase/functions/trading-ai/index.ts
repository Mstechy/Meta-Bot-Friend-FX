import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { messages, context } = await req.json();
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY is not configured");

    const systemPrompt = `You are an expert AI trading assistant for a forex trading platform. You provide:

1. **Trade Signals**: Analyze market conditions and provide BUY/SELL signals with entry, stop loss, and take profit levels.
2. **Money Management**: Calculate optimal position sizes based on account balance and risk tolerance (1-2% per trade).
3. **Market Analysis**: Provide technical and fundamental analysis for forex pairs.
4. **Discipline Coaching**: Help traders maintain discipline, avoid overtrading, and stick to their strategy.
5. **Risk Assessment**: Evaluate trades honestly - tell the truth about risks, don't sugarcoat.
6. **Research**: When asked, provide deep analysis based on price action, trends, support/resistance.

Current Market Context:
${context ? JSON.stringify(context) : "No live market data provided"}

Rules:
- Always include specific price levels (entry, SL, TP) when giving signals
- When giving a trade signal, ALWAYS include an action tag in this exact format: [BUY SYMBOL ENTRY SL:STOPLOSS TP:TAKEPROFIT] or [SELL SYMBOL ENTRY SL:STOPLOSS TP:TAKEPROFIT]. Example: [BUY EURUSD 1.0856 SL:1.0800 TP:1.0920]. This lets the user execute with one tap.
- Calculate risk-reward ratio for every trade suggestion
- Be honest about uncertainty - say "I don't know" when appropriate
- Warn about high-risk situations
- Recommend position sizing based on 1-2% risk rule
- Format responses with clear sections using markdown
- If the trader is emotional or undisciplined, address it directly
- Provide reasoning for every recommendation`;

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [
          { role: "system", content: systemPrompt },
          ...messages,
        ],
        stream: true,
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(JSON.stringify({ error: "Rate limit exceeded. Please wait a moment." }), {
          status: 429,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (response.status === 402) {
        return new Response(JSON.stringify({ error: "AI credits exhausted. Please add credits." }), {
          status: 402,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const t = await response.text();
      console.error("AI gateway error:", response.status, t);
      return new Response(JSON.stringify({ error: "AI service error" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(response.body, {
      headers: { ...corsHeaders, "Content-Type": "text/event-stream" },
    });
  } catch (e) {
    console.error("trading-ai error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
