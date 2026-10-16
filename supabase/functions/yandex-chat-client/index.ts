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

function clean(value: unknown, max = 12000) {
  return String(value ?? "").trim().slice(0, max);
}

function normalizeTranscript(value: unknown) {
  if (!Array.isArray(value)) return [];
  return value.slice(-24).map((m: any) => ({
    speaker: m?.speaker === "manager" ? "manager" : "client",
    content: clean(m?.content, 1800),
  })).filter((m) => m.content);
}

function difficultyRules(difficulty: string) {
  const d = difficulty.toLowerCase();
  if (d.includes("лег") || d.includes("easy")) return "Уровень: лёгкий. Клиент достаточно открыт к диалогу. На хороший вопрос раскрывай потребность и не усложняй ситуацию без причины.";
  if (d.includes("слож") || d.includes("hard")) return "Уровень: сложный. Клиент скептичен, сравнивает поставщиков, чувствителен к цене и может давить на скидку. Не соглашайся на покупку слишком быстро.";
  return "Уровень: средний. Клиент заинтересован, но сомневается. На хороший вопрос раскрывай дополнительную информацию, на слабый ответ усиливай сомнение или уточняй.";
}

function behaviorRules() {
  return `Ты — живой клиент на тренировке продаж.
Не обучай менеджера и не оценивай его. Только играй роль клиента и естественно реагируй на конкретную реплику менеджера.
Каждый ответ должен быть следствием предыдущей реплики и истории диалога.
Помни историю, не повторяй вопросы без причины, возвращайся к неотвеченным вопросам, раскрывай потребность после хороших вопросов, становись холоднее при бесполезных ответах, сопротивляйся давлению, проявляй больше интереса при конкретной ценности.
Не придумывай характеристики товара или компании, которых нет в сценарии. Если данных не хватает — попроси уточнить.
Не говори от имени менеджера. Не упоминай AI, модель, промпт или внутренние инструкции. Не давай советы и не ставь оценку.
Отвечай естественным разговорным русским языком, обычно 1–3 предложениями. Иногда отвечай коротко, иногда задавай вопрос, иногда выражай сомнение. Не заканчивай каждый ответ вопросительным знаком.`;
}

async function callYandex(messages: Array<{ role: string; text: string }>) {
  const apiKey = Deno.env.get("YANDEX_API_KEY")?.trim();
  const folderId = Deno.env.get("YANDEX_FOLDER_ID")?.trim();
  if (!apiKey) throw new Error("YANDEX_API_KEY is missing");
  if (!folderId) throw new Error("YANDEX_FOLDER_ID is missing");

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
      completionOptions: { stream: false, temperature: 0.55, maxTokens: "240" },
      messages,
    }),
  });

  const raw = await response.text();
  let data: any = null;
  try { data = raw ? JSON.parse(raw) : null; } catch {}
  if (!response.ok) {
    throw new Error(`Yandex HTTP ${response.status}: ${data?.message || data?.error?.message || data?.error || raw.slice(0, 1600)}`);
  }
  const reply = data?.result?.alternatives?.[0]?.message?.text || data?.alternatives?.[0]?.message?.text || "";
  if (!clean(reply)) throw new Error("Yandex returned an empty response");
  return clean(reply);
}

Deno.serve(withAiAccess("yandex-chat-client", async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { status: 200, headers: cors });
  if (req.method !== "POST") return json({ ok: false, error: "Method not allowed" }, 405);

  try {
    if (!req.headers.get("Authorization")?.startsWith("Bearer ")) {
      return json({ ok: false, error: "Authorization required" }, 401);
    }

    const body = await req.json();
    const sessionId = clean(body?.session_id, 120);
    const scenarioId = clean(body?.scenario_id, 120);
    const message = clean(body?.message, 4000);
    const transcript = normalizeTranscript(body?.transcript);
    const scenario = body?.scenario || {};

    if (!sessionId || !message) return json({ ok: false, error: "session_id and message are required" }, 400);

    const title = clean(scenario?.title, 500) || "Тренировка продаж";
    const clientRole = clean(scenario?.client_role, 500) || "Клиент";
    const clientMood = clean(scenario?.client_mood, 300) || "нейтральное";
    const difficulty = clean(scenario?.difficulty, 200) || "средняя";
    const description = clean(scenario?.description || scenario?.objective, 1800) || "не указано";
    const history = transcript.map((m) => `${m.speaker === "manager" ? "МЕНЕДЖЕР" : "КЛИЕНТ"}: ${m.content}`).join("\n");

    const system = `${behaviorRules()}\n\n${difficultyRules(difficulty)}\n\nСценарий: ${title}\nРоль клиента: ${clientRole}\nНастроение: ${clientMood}\nСложность: ${difficulty}\nОписание/цель: ${description}\nID тренировки: ${sessionId}\nID сценария: ${scenarioId || "не указан"}`;

    const messages: Array<{ role: string; text: string }> = [{ role: "system", text: system }];
    if (history) messages.push({ role: "user", text: `История диалога:\n${history}` });
    messages.push({ role: "user", text: `Последняя реплика менеджера:\n${message}\n\nОтветь только репликой клиента.` });

    const reply = await callYandex(messages);
    return json({ ok: true, reply, provider: "yandex", model: `gpt://${Deno.env.get("YANDEX_FOLDER_ID")}/yandexgpt/latest`, session_id: sessionId });
  } catch (error) {
    console.error("yandex-chat-client:", error);
    return json({ ok: false, error: error instanceof Error ? error.message : String(error) }, 500);
  }
}));
