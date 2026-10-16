import { withAiAccess } from "../_shared/ai-access.ts";
import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...cors, "Content-Type": "application/json; charset=utf-8" },
  });
}

Deno.serve(withAiAccess("yandex-test", async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { status: 200, headers: cors });
  if (req.method !== "POST") return json({ ok: false, error: "Method not allowed" }, 405);

  try {
    const apiKey = Deno.env.get("YANDEX_API_KEY")?.trim();
    const folderId = Deno.env.get("YANDEX_FOLDER_ID")?.trim();
    if (!apiKey) return json({ ok: false, error: "YANDEX_API_KEY is missing" }, 500);
    if (!folderId) return json({ ok: false, error: "YANDEX_FOLDER_ID is missing" }, 500);

    const modelUri = `gpt://${folderId}/yandexgpt/latest`;
    const response = await fetch("https://llm.api.cloud.yandex.net/foundationModels/v1/completion", {
      method: "POST",
      headers: {
        Authorization: `Api-Key ${apiKey}`,
        "x-folder-id": folderId,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        modelUri,
        completionOptions: { stream: false, temperature: 0.2, maxTokens: "100" },
        messages: [
          { role: "system", text: "Ты тестовый AI-клиент проекта TrenerSale. Отвечай кратко на русском языке." },
          { role: "user", text: "Ответь одной фразой: Yandex AI подключён и работает." },
        ],
      }),
    });

    const text = await response.text();
    let data: any = null;
    try { data = JSON.parse(text); } catch {}

    if (!response.ok) {
      const detail = data?.message !== undefined
        ? (typeof data.message === "string" ? data.message : JSON.stringify(data.message))
        : data?.error !== undefined
          ? (typeof data.error === "string" ? data.error : JSON.stringify(data.error))
          : text.slice(0, 1500);
      return json({
        ok: false,
        yandex_status: response.status,
        yandex_request_id: response.headers.get("x-request-id"),
        model_uri: modelUri,
        folder_id_suffix: folderId.slice(-6),
        error: `Yandex HTTP ${response.status}: ${detail}`,
        raw: data ?? text.slice(0, 1500),
      }, 502);
    }

    const reply = data?.result?.alternatives?.[0]?.message?.text || data?.alternatives?.[0]?.message?.text || "";
    if (!reply) return json({ ok: false, error: `Yandex returned an empty response: ${text.slice(0, 1500)}` }, 502);

    return json({ ok: true, provider: "yandex", model: modelUri, reply });
  } catch (error) {
    console.error("yandex-test:", error);
    return json({ ok: false, error: error instanceof Error ? error.message : String(error) }, 500);
  }
}));
