import { withAiAccess } from "../_shared/ai-access.ts";
import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const OPENAI_API_KEY = (Deno.env.get("OPENAI_API_KEY") || "").trim();

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "Content-Type": "application/json",
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type"
    }
  });
}

function keyMeta(key: string) {
  return {
    configured: Boolean(key),
    length: key.length,
    startsWithSk: key.startsWith("sk-"),
    hasWhitespace: /\s/.test(key)
  };
}

Deno.serve(withAiAccess("gpt-live-session", async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", {
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type"
      }
    });
  }

  if (!OPENAI_API_KEY) {
    return json({
      ok: false,
      error: "OPENAI_API_KEY is not configured in Supabase",
      key_meta: keyMeta(OPENAI_API_KEY)
    }, 500);
  }

  try {
    const body = await req.json();
    const sdp = String(body?.sdp || "");
    if (!sdp) return json({ ok: false, error: "Missing SDP offer" }, 400);

    const session = body?.session || {};
    const clientRoleGuard = `РОЛЕВАЯ ГРАНИЦА: ты всегда только КЛИЕНТ. Никогда не становись продавцом, менеджером, поставщиком или консультантом. Менеджер всегда ведёт продажу и говорит первым. Не начинай продажу сам, не придумывай реплики или действия менеджера и не предлагай товар, цену, скидку или условия сделки без его инициативы. Если менеджер здоровается или говорит «Здравствуйте, я Лёша», ответь коротко как клиент — например «Здравствуйте» — и дай менеджеру самому продолжить. Не отвечай автоматически «Что хотели?» и не перехватывай ведение разговора. Встречные вопросы задавай только при необходимости для естественного ответа или после того, как менеджер уже вовлёк тебя в предметное обсуждение.`;
    const clientInstructions = String(session.instructions || "Ты потенциальный клиент в тренировочном холодном B2B-звонке. Говори естественно на русском языке, живо и кратко, как реальный человек по телефону. Не помогай менеджеру продавать. Отвечай как клиент с указанным характером, задавай уместные вопросы, выражай сомнения и возражения. Не выдумывай факты, которых нет в контексте. Не упоминай, что ты ИИ или что это тренировка.");
    const conciseClientReplyRule = `ФОРМАТ РЕПЛИК: не отвечай односложно и не ограничивайся голыми «да», «нет», «не знаю», «интересно», «не интересно». Отвечай коротко, но содержательно: обычно 1 короткое предложение или 1–2 короткие фразы с причиной, условием или контекстом. Например: «Да, закупаем, но зависит от цены», «Прямо сейчас не актуально, закупка будет позже», «Да, работаем с этим размером, но сейчас есть поставщик». Не говори длинными монологами и не веди разговор вместо менеджера.`;
    const payload = {
      session: {
        model: "gpt-live-1",
        instructions: clientInstructions + "\n\n" + clientRoleGuard + "\n\n" + conciseClientReplyRule,
        audio: {
          output: { voice: String(session.voice || "marin") }
        },
        input: Array.isArray(session.input) ? session.input.slice(-40) : [],
        store: false
      },
      transport: { type: "webrtc", sdp }
    };

    const r = await fetch("https://api.openai.com/v1/live/sessions", {
      method: "POST",
      headers: {
        "Authorization": "Bearer " + OPENAI_API_KEY,
        "Content-Type": "application/json"
      },
      body: JSON.stringify(payload)
    });

    const raw = await r.text();

    if (!r.ok) {
      let detail: unknown = raw;
      try { detail = JSON.parse(raw); } catch {}
      return json({
        ok: false,
        error: "OpenAI GPT-Live session creation failed",
        detail,
        key_meta: keyMeta(OPENAI_API_KEY)
      }, r.status);
    }

    let data: any = {};
    try {
      data = JSON.parse(raw);
    } catch {
      return json({ ok: false, error: "Invalid OpenAI response" }, 502);
    }

    return json({ ok: true, session: data.session, transport: data.transport });
  } catch (e) {
    return json({
      ok: false,
      error: e instanceof Error ? e.message : String(e),
      key_meta: keyMeta(OPENAI_API_KEY)
    }, 500);
  }
}));
