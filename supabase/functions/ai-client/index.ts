import { withAiAccess } from "../_shared/ai-access.ts";
// Supabase Edge Function: chat-client
// File: supabase/functions/chat-client/index.ts
//
// Required Supabase secret:
// OPENAI_API_KEY
//
// Optional:
// OPENAI_MODEL
//
// Frontend request:
// POST /functions/v1/chat-client
//
// Body:
// {
//   session_id,
//   scenario_id,
//   message,
//   transcript,
//   scenario
// }

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      ...corsHeaders,
      "Content-Type": "application/json; charset=utf-8",
    },
  });
}

function cleanText(value: unknown, max = 12000) {
  return String(value ?? "").trim().slice(0, max);
}

function normalizeTranscript(value: unknown) {
  if (!Array.isArray(value)) return [];

  return value
    .slice(-24)
    .map((m: any) => ({
      speaker: m?.speaker === "manager" ? "manager" : "client",
      content: cleanText(m?.content, 1800),
    }))
    .filter((m) => m.content);
}

function difficultyRules(difficulty: string) {
  const d = difficulty.toLowerCase();

  if (d.includes("лег") || d.includes("easy")) {
    return `
Уровень: лёгкий.

Клиент достаточно открыт к диалогу.
Если менеджер задаёт хороший вопрос или даёт понятную ценность,
клиент постепенно раскрывает потребность.
Не усложняй ситуацию без причины.
`;
  }

  if (d.includes("слож") || d.includes("hard")) {
    return `
Уровень: сложный.

Клиент скептичен, сравнивает поставщиков, чувствителен к цене,
может давить на скидку и несколько раз возвращаться к сомнениям.

Хороший менеджер должен действительно продвигать разговор.
Не соглашайся на покупку слишком быстро.
`;
  }

  return `
Уровень: средний.

Клиент заинтересован, но сомневается.

На хороший вопрос раскрывай дополнительную информацию.

На слабый ответ усиливай сомнение или задавай уточняющий вопрос.
`;
}

function behaviorRules() {
  return `
Ты — живой клиент на тренировке продаж.

Твоя задача НЕ обучать менеджера и НЕ оценивать его.
Ты играешь роль клиента и реагируешь на конкретную реплику менеджера.

КРИТИЧЕСКОЕ ПРАВИЛО:

Никогда не выбирай случайную реплику из заранее заданного списка.

Каждый ответ должен быть следствием предыдущей реплики менеджера
и всего диалога.

Поведение:

1. Помни всю историю разговора.

2. Не повторяй один и тот же вопрос без причины.

3. Если менеджер не отвечает на вопрос клиента —
   вернись к нему.

4. Если менеджер отвечает по существу —
   двигай разговор дальше.

5. Если менеджер задаёт хороший вопрос —
   раскрой часть потребности.

6. Если менеджер говорит что-то бесполезное вроде:
   "ничего",
   "не знаю",
   "как хотите",
   "решайте сами",
   —
   стань более холодным или скептичным.

7. Если менеджер начинает давить —
   сопротивляйся.

8. Если менеджер даёт конкретную ценность —
   прояви больше интереса.

9. Не придумывай характеристики товара или компании,
   которых нет в сценарии или разговоре.

10. Если данных не хватает —
    попроси менеджера уточнить.

11. Не говори от имени менеджера.

12. Не упоминай, что ты AI, модель, тренажёр,
    промпт или сценарий.

13. Не давай менеджеру советы.

14. Не ставь оценку.

15. Не объясняй свои внутренние мысли.

16. Отвечай на русском естественным разговорным языком.

17. Обычно отвечай 1–3 предложениями.

18. Не превращай ответ в длинный текст.

19. Иногда используй короткие ответы,
    иногда вопросы,
    иногда сомнение —
    как реальный человек.

20. Не заканчивай каждый ответ вопросительным знаком.

21. Если менеджер сделал сильный шаг к закрытию,
    можешь перейти к обсуждению условий или следующего шага.

22. Если менеджер явно провёл разговор плохо —
    клиент может отказаться, взять паузу или сказать,
    что будет смотреть другие варианты.

Тебе разрешено:

- возражать;
- менять настроение;
- раскрывать новые обстоятельства;
- задавать неудобные вопросы;
- требовать конкретики;
- соглашаться, если менеджер действительно хорошо ведёт разговор.

Тебе запрещено:

- специально помогать менеджеру;
- делать разговор искусственно лёгким;
- повторять одну из четырёх фиксированных фраз;
- писать анализ после реплики;
- использовать списки и заголовки в ответе.
`;
}

async function callOpenAI(input: string, stream = false) {
  const apiKey = Deno.env.get("OPENAI_API_KEY");

  if (!apiKey) {
    throw new Error(
      "OPENAI_API_KEY не настроен в Supabase Secrets."
    );
  }

  const model =
    Deno.env.get("OPENAI_MODEL") ||
    "gpt-5.6-luna";

  const response = await fetch(
    "https://api.openai.com/v1/responses",
    {
      method: "POST",

      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${apiKey}`,
      },

      body: JSON.stringify({
        model,

        input,

        temperature: 0.85,

        max_output_tokens: 180,
      }),
    }
  );

  if (stream) {
    if (!response.ok) {
      const rawError = await response.text();
      throw new Error(rawError || `OpenAI HTTP ${response.status}`);
    }
    return response;
  }

  const raw = await response.text();

  let data: any = null;

  try {
    data = raw ? JSON.parse(raw) : null;
  } catch {
    // JSON не распарсился.
  }

  if (!response.ok) {
    const message =
      data?.error?.message ||
      data?.message ||
      raw ||
      `OpenAI HTTP ${response.status}`;

    throw new Error(message);
  }

  const output =
    data?.output_text ||
    data?.output
      ?.flatMap(
        (item: any) =>
          item?.content || []
      )
      ?.map(
        (item: any) =>
          item?.text || ""
      )
      ?.join(" ") ||
    "";

  if (!String(output).trim()) {
    throw new Error(
      "OpenAI не вернул текст ответа."
    );
  }

  return String(output).trim();
}

Deno.serve(withAiAccess("ai-client", async (req) => {

  // CORS preflight
  if (req.method === "OPTIONS") {
    return new Response("ok", {
      headers: corsHeaders,
    });
  }

  if (req.method !== "POST") {
    return json(
      {
        error: "Method not allowed",
      },
      405
    );
  }

  try {

    // Проверяем авторизацию пользователя.
    const auth =
      req.headers.get("Authorization");

    if (!auth?.startsWith("Bearer ")) {
      return json(
        {
          error:
            "Требуется авторизация.",
        },
        401
      );
    }

    const accessToken =
      auth
        .slice("Bearer ".length)
        .trim();

    if (!accessToken) {
      return json(
        {
          error:
            "Пустой access token.",
        },
        401
      );
    }

    const body = await req.json();

    const sessionId =
      cleanText(
        body?.session_id,
        120
      );

    const scenarioId =
      cleanText(
        body?.scenario_id,
        120
      );

    const message =
      cleanText(
        body?.message,
        4000
      );

    const transcript =
      normalizeTranscript(
        body?.transcript
      );

    const scenario =
      body?.scenario || {};

    if (!sessionId || !message) {
      return json(
        {
          error:
            "Не хватает session_id или message.",
        },
        400
      );
    }

    const scenarioTitle =
      cleanText(
        scenario?.title,
        500
      ) ||
      "Тренировка продаж";

    const clientRole =
      cleanText(
        scenario?.client_role,
        500
      ) ||
      "Клиент";

    const clientMood =
      cleanText(
        scenario?.client_mood,
        500
      ) ||
      "нейтральный";

    const difficulty =
      cleanText(
        scenario?.difficulty,
        200
      ) ||
      "Средняя";

    const description =
      cleanText(
        scenario?.description ||
          scenario?.objective,
        1800
      );

    const history =
      transcript
        .map(
          (m) =>
            `${
              m.speaker === "manager"
                ? "МЕНЕДЖЕР"
                : "КЛИЕНТ"
            }: ${m.content}`
        )
        .join("\n");

    const voiceMode = body?.stream === true || !!body?.cold_call;

    const prompt = `
${behaviorRules()}

${difficultyRules(difficulty)}

Сценарий: ${scenarioTitle}
Роль клиента: ${clientRole}

Настроение клиента в начале: ${clientMood}

Сложность: ${difficulty}

Описание/цель сценария:
${description || "не указано"}

ID тренировки:
${sessionId}

ID сценария:
${scenarioId || "не указан"}

История диалога:

${history || "(диалог только начался)"}

Последняя реплика менеджера:

${message}

Сейчас ответь ОДНОЙ естественной репликой клиента.

Не добавляй кавычки.

Не добавляй "Клиент:".

Не добавляй пояснения.

Не добавляй анализ.
`;

    const finalPrompt = voiceMode
      ? prompt + "\n\nГОЛОСОВОЙ РЕЖИМ: отвечай очень коротко и естественно, как человек по телефону. Обычно одна короткая фраза, максимум два коротких предложения. Не повторяй очевидное и не делай длинных объяснений."
      : prompt;

    const result = await callOpenAI(finalPrompt, body?.stream === true);

    if (body?.stream === true) {
      return new Response(result.body, {
        status: 200,
        headers: {
          ...corsHeaders,
          "Content-Type": "text/event-stream; charset=utf-8",
          "Cache-Control": "no-cache, no-transform",
          "Connection": "keep-alive",
        },
      });
    }

    const reply = result;

    return json({
      ok: true,

      reply,

      session_id:
        sessionId,

      model:
        Deno.env.get(
          "OPENAI_MODEL"
        ) ||
        "gpt-5.6-luna",
    });

  } catch (error) {

    console.error(
      "chat-client error:",
      error
    );

    return json(
      {
        ok: false,

        error:
          error instanceof Error
            ? error.message
            : "Неизвестная ошибка AI-клиента.",
      },
      500
    );
  }
}));
