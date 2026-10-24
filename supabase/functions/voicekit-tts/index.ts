import { withAiAccess } from "../_shared/ai-access.ts";
const headers = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type", "Access-Control-Allow-Methods": "POST, OPTIONS", "Cache-Control": "no-store" };
const json = (error: string, status: number) => new Response(JSON.stringify({ ok: false, error }), { status, headers: { ...headers, "Content-Type": "application/json" } });
const voices = ["preset_pavel", "preset_maksim"];
// TTS scope requires an authenticated user, entitlement and active training.
const synthesize = withAiAccess("proxy-tts", async (req: Request) => {
  const key = (Deno.env.get("VOICEKIT_API_KEY") || "").trim();
  if (!key) return json("Voice Kit не настроен: добавьте VOICEKIT_API_KEY в секреты Supabase.", 503);
  let body;
  try { body = await req.json(); } catch { return json("Некорректный запрос озвучки.", 400); }
  const text = typeof body?.input === "string" ? body.input.trim() : "";
  if (!text || text.length > 5000) return json("Текст озвучки должен содержать от 1 до 5000 символов.", 400);
  if (!voices.includes(body?.voice)) return json("Выберите Павла или Максима для пробного Voice Kit.", 400);
  const controller = new AbortController();
  const abort = () => controller.abort();
  req.signal.addEventListener("abort", abort, { once: true });
  if (req.signal.aborted) controller.abort();
  const timeout = setTimeout(abort, 25000);
  try {
    const response = await fetch("https://ttsapi.ru/v1/synthesize", {
      method: "POST", signal: controller.signal,
      headers: { "Content-Type": "application/json", "X-Api-Key": key },
      // Standard presets and batch synthesis work on Free. No clone, premium or stream request.
      body: JSON.stringify({ text, voice: body.voice, format: "mp3", language: "ru", speed: 1.05 })
    });
    if (!response.ok) {
      if (response.status === 401) return json("Voice Kit отклонил API-ключ. Проверьте VOICEKIT_API_KEY.", 502);
      if ([402, 403, 429].includes(response.status)) return json("Voice Kit: проверьте лимит символов, баланс и доступ ключа к синтезу речи.", response.status);
      return json("Voice Kit временно не смог озвучить ответ. Попробуйте ещё раз.", 502);
    }
    if (!(response.headers.get("Content-Type") || "").toLowerCase().startsWith("audio/")) return json("Voice Kit вернул ответ без аудио.", 502);
    const audio = await response.arrayBuffer();
    if (!audio.byteLength || audio.byteLength > 10 * 1024 * 1024) return json("Voice Kit вернул некорректный аудиофайл.", 502);
    return new Response(audio, { headers: { ...headers, "Content-Type": "audio/mpeg" } });
  } catch {
    // Never expose provider exceptions, response bodies, headers or secret values.
    return json(controller.signal.aborted ? "Озвучка Voice Kit отменена или заняла слишком много времени." : "Нет соединения с Voice Kit. Повторите попытку.", 504);
  } finally {
    clearTimeout(timeout);
    req.signal.removeEventListener("abort", abort);
  }
});
Deno.serve((req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers });
  if (req.method !== "POST") return json("Метод не поддерживается.", 405);
  if (Number(req.headers.get("Content-Length") || 0) > 20000) return json("Запрос слишком большой.", 413);
  return synthesize(req);
});
