// Gate every billable AI handler before contacting its provider.
const headers = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type', 'Access-Control-Allow-Methods': 'POST, OPTIONS', 'Content-Type': 'application/json', 'Cache-Control': 'no-store' };
const reply = (status: number, error: string) => new Response(JSON.stringify({ ok: false, error }), { status, headers });
const messages: Record<string, string> = {
  subscription_required: 'Для этого запроса нужна действующая подписка.',
  training_required: 'Начните тренировку перед обращением к ИИ.',
  training_closed: 'Тренировка уже завершена.',
  training_expired: 'Время тренировки истекло. Начните новую тренировку.',
  rate_limit: 'Слишком много запросов. Подождите минуту.',
  request_limit: 'Достигнут предел запросов этой тренировки.',
  dialogue_limit: 'Достигнут предел диалога.'
};

function operation(slug: string, body: any): string {
  if (slug.startsWith('evaluate-session')) return 'evaluate';
  if (['yandex-test','speechkit-test'].includes(slug)) return 'diagnostic';
  if (['manager-ai-chat','negotiation-lab'].includes(slug)) return 'mentor';
  if (slug === 'gpt-live-session') return 'live';
  if (slug === 'proxy-stt') return 'stt';
  if (['proxy-tts','yandex-tts'].includes(slug)) return 'tts';
  let embedded: any = null;
  const encoded = String(body?.scenario?.system_prompt || '').match(/AI_CLIENT_SETTINGS_V3_JSON:([A-Za-z0-9+/=]+)$/);
  if (encoded) { try { embedded = JSON.parse(new TextDecoder().decode(Uint8Array.from(atob(encoded[1]), c => c.charCodeAt(0)))); } catch {} }
  const settings = body?.client_settings || body?.clientSettings || embedded || body?.scenario?.ai_settings || body?.scenario?.settings || {};
  if (slug === 'chat-client' && (settings?.mode === 'manager_chat' || body?.mode === 'manager_chat' || body?.scenario?.title === 'AI-чат')) return 'mentor';
  return 'reply';
}

export function withAiAccess(slug: string, handler: (request: Request) => Response | Promise<Response>) {
  return async (request: Request): Promise<Response> => {
    if (request.method === 'OPTIONS') return handler(request);
    if (request.method !== 'POST') return reply(405, 'Метод не поддерживается.');
    const auth = request.headers.get('Authorization') || '';
    if (!/^Bearer\s+\S+$/i.test(auth)) return reply(401, 'Необходимо войти в аккаунт.');
    const url = Deno.env.get('SUPABASE_URL') || '';
    const anon = Deno.env.get('SUPABASE_ANON_KEY') || '';
    const service = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';
    if (!url || !anon || !service) return reply(503, 'Проверка доступа временно недоступна.');
    try {
      const userResponse = await fetch(url + '/auth/v1/user', { headers: { apikey: anon, Authorization: auth } });
      if (!userResponse.ok) return [401,403].includes(userResponse.status) ? reply(401, 'Сессия истекла. Войдите снова.') : reply(503, 'Проверка доступа временно недоступна.');
      const user = await userResponse.json();
      if (!user?.id) return reply(401, 'Необходимо войти в аккаунт.');
      const contentLength = Number(request.headers.get('content-length') || 0);
      if (contentLength > 27 * 1024 * 1024) return reply(413, 'Файл слишком большой.');
      if (!(request.headers.get('content-type') || '').includes('multipart/form-data') && contentLength > 256 * 1024) return reply(413, 'Запрос слишком большой.');
      let body: any;
      if ((request.headers.get('content-type') || '').includes('multipart/form-data')) {
        const form = await request.clone().formData();
        body = { session_id: form.get('session_id') };
      } else {
        try { body = await request.clone().json(); } catch { return reply(400, 'Некорректный запрос.'); }
      }
      const id = body?.session_id == null ? null : String(body.session_id).trim();
      if (id !== null && !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)) return reply(400, 'Некорректная тренировка.');
      const accessResponse = await fetch(url + '/rest/v1/rpc/authorize_saletrening_ai_request', {
        method: 'POST', headers: { apikey: service, Authorization: 'Bearer ' + service, 'Content-Type': 'application/json' },
        body: JSON.stringify({ p_user_id: user.id, p_operation: operation(slug, body), p_session_id: id })
      });
      if (!accessResponse.ok) return reply(503, 'Проверка доступа временно недоступна.');
      const access = await accessResponse.json();
      if (access?.allowed !== true) return reply([400,401,402,403,429].includes(access?.status) ? access.status : 403, messages[access?.reason] || 'Нет доступа к этому запросу.');
      if (access.cached_evaluation) return new Response(JSON.stringify({ ok: true, cached: true, evaluation: access.cached_evaluation }), { status: 200, headers });
      return await handler(request);
    } catch {
      return reply(503, 'Сервис временно недоступен. Повторите попытку.');
    }
  };
}
