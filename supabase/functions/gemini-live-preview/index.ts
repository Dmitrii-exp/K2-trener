// Gemini Live trial removed at the user's request. No provider or database calls.
const headers = {
  "Content-Type": "application/json",
  "Cache-Control": "no-store",
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS"
};
Deno.serve((req: Request) => req.method === "OPTIONS"
  ? new Response("ok", { headers })
  : new Response(JSON.stringify({ ok: false, code: "gemini_disabled", error: "Gemini Live отключён." }), { status: 410, headers }));
