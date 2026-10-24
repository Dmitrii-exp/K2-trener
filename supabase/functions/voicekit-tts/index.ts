// Voice Kit trial removed at the user's request. No provider or database calls.
const headers = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type", "Access-Control-Allow-Methods": "POST, OPTIONS", "Cache-Control": "no-store", "Content-Type": "application/json" };
Deno.serve((req: Request) => req.method === "OPTIONS"
  ? new Response("ok", { headers })
  : new Response(JSON.stringify({ ok: false, code: "voicekit_disabled", error: "Обычный голосовой режим отключён." }), { status: 410, headers }));
