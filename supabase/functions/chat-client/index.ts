import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const json = (d: unknown, s = 200) => new Response(JSON.stringify(d), {
  status: s,
  headers: { ...cors, "Content-Type": "application/json" },
});

const clean = (v: unknown, n = 12000) => String(v ?? "").trim().slice(0, n);

async function giga(messages: any[]) {
  const key = clean(Deno.env.get("GIGACHAT_AUTH_KEY") || Deno.env.get("GIGACHAT_API_KEY") || Deno.env.get("GIGACHAT_CREDENTIALS"))
    .replace(/^Basic\s+/i, "").replace(/^Bearer\s+/i, "").replace(/^['\"]|['\"]$/g, "");
  if (!key) throw new Error("GIGACHAT_AUTH_KEY is missing");
  const scope = Deno.env.get("GIGACHAT_SCOPE") || "GIGACHAT_API_PERS";
  const model = Deno.env.get("GIGACHAT_MODEL") || "GigaChat-3-Ultra";

  const oauth = await fetch("https://ngw.devices.sberbank.ru:9443/api/v2/oauth", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded", Accept: "application/json", RqUID: crypto.randomUUID(), Authorization: `Basic ${key}` },
    body: new URLSearchParams({ scope }).toString(),
  });
  const oauthText = await oauth.text();
  let oauthData: any = null;
  try { oauthData = JSON.parse(oauthText); } catch {}
  if (!oauth.ok || !oauthData?.access_token) throw new Error(`OAuth ${oauth.status}: ${oauthData?.message || oauthData?.error_description || oauthText.slice(0, 800)}`);

  const response = await fetch("https://api.giga.chat/v1/chat/completions", {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json", Authorization: `Bearer ${oauthData.access_token}` },
    body: JSON.stringify({ model, messages, temperature: 0.7, max_tokens: 300 }),
  });
  const text = await response.text();
  let data: any = null;
  try { data = JSON.parse(text); } catch {}
  if (!response.ok) throw new Error(`GigaChat ${response.status}: ${data?.error?.message || data?.message || text.slice(0, 800)}`);
  const reply = data?.choices?.[0]?.message?.content;
  if (!clean(reply)) throw new Error("GigaChat returned empty response");
  return clean(reply);
}

Deno.serve(async req => {
  if (req.method === "OPTIONS") return new Response("ok", { status: 200, headers: cors });
  if (req.method !== "POST") return json({ ok: false, error: "Method not allowed" }, 405);
  try {
    if (!req.headers.get("Authorization")) return json({ ok: false, error: "Authorization required" }, 401);
    const b = await req.json();
    const message = clean(b?.message, 4000);
    if (!message) return json({ ok: false, error: "message is required" }, 400);
    const s = b?.scenario || {};
    const history = Array.isArray(b?.transcript) ? b.transcript.slice(-30).map((x: any) => `${x?.speaker === "manager" ? "МЕНЕДЖЕР" : "КЛИЕНТ"}: ${clean(x?.content, 1800)}`).join("\n") : "";
    const reply = await giga([
      { role: "system", content: `Ты живой клиент на тренировке продаж. Не обучай и не оценивай менеджера. Только играй роль клиента и естественно реагируй на последнюю реплику. Не упоминай AI или тренировку. Отвечай по-русски, обычно 1-3 предложения. Сценарий: ${clean(s.title, 500)}. Роль клиента: ${clean(s.client_role, 500) || "Клиент"}. Сложность: ${clean(s.difficulty, 300) || "средняя"}. Описание: ${clean(s.description || s.objective, 1800)}` },
      ...(history ? [{ role: "user", content: `История:\n${history}` }] : []),
      { role: "user", content: `Последняя реплика менеджера:\n${message}\n\nОтветь только репликой клиента.` },
    ]);
    return json({ ok: true, reply, session_id: clean(b?.session_id, 120) });
  } catch (e) {
    console.error("chat-client", e);
    return json({ ok: false, error: e instanceof Error ? e.message : String(e) }, 500);
  }
});
