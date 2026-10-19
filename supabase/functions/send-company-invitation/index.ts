import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Content-Type": "application/json",
  "Cache-Control": "no-store",
};
const json = (body: unknown, status = 200, extraHeaders: Record<string, string> = {}) =>
  new Response(JSON.stringify(body), { status, headers: { ...cors, ...extraHeaders } });

function adminKey() {
  const raw = Deno.env.get("SUPABASE_SECRET_KEYS");
  if (raw) {
    try { const parsed = JSON.parse(raw); if (parsed?.default) return parsed.default; } catch (_) {}
  }
  return Deno.env.get("SUPABASE_SECRET_KEY") || Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
}
function esc(value: unknown) {
  return String(value ?? "").replace(/[&<>"]/g, (m) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;",
  }[m] || m));
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return json({ error: "method_not_allowed" }, 405);

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const key = adminKey();
  if (!supabaseUrl || !key) return json({ error: "server_not_configured", message: "Секретный ключ Supabase не настроен." }, 500);

  const auth = req.headers.get("Authorization");
  if (!auth) return json({ error: "unauthorized", message: "Нет авторизации." }, 401);

  const db = createClient(supabaseUrl, key, {
    global: { headers: { Authorization: auth } },
    auth: { autoRefreshToken: false, persistSession: false, detectSessionInUrl: false },
  });
  const { data: { user }, error: userError } = await db.auth.getUser();
  if (userError || !user) return json({ error: "unauthorized", message: userError?.message || "Пользователь не авторизован." }, 401);

  const body = await req.json().catch(() => ({}));
  const email = String(body?.email || "").trim().toLowerCase();
  const role = String(body?.role || "employee");
  const mode = String(body?.mode || "send");
  const invitationId = String(body?.invitation_id || "").trim();
  const legacyToken = String(body?.token || "").trim();

  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return json({ error: "invalid_email", message: "Некорректный Email сотрудника." }, 400);
  if (!["employee", "manager"].includes(role)) return json({ error: "invalid_role", message: "Недопустимая роль." }, 400);

  const { data: profile, error: profileError } = await db.from("profiles")
    .select("company_id,role").eq("id", user.id).single();
  if (profileError || !profile?.company_id || !["director", "admin", "manager"].includes(profile.role)) {
    return json({ error: "forbidden", message: profileError?.message || "Недостаточно прав." }, 403);
  }

  const { data: company, error: companyError } = await db.from("companies")
    .select("name").eq("id", profile.company_id).single();
  if (companyError || !company?.name) return json({ error: "company_not_found", message: "Не удалось определить название компании." }, 400);
  const companyName = String(company.name).trim();

  const admin = createClient(supabaseUrl, key, {
    global: { fetch: (input, init) => fetch(input, { ...init, signal: AbortSignal.timeout(20_000) }) },
    auth: { autoRefreshToken: false, persistSession: false, detectSessionInUrl: false },
  });

  if (mode === "create") {
    const tokenNew = crypto.randomUUID().replaceAll("-", "");
    const { data: invitation, error: invitationError } = await admin.from("company_invitations").insert({
      company_id: profile.company_id, email, role, token: tokenNew, invited_by: user.id,
      expires_at: new Date(Date.now() + 7 * 86400000).toISOString(),
    }).select("id").single();
    if (invitationError || !invitation) return json({ error: "invitation_create_failed", message: "Не удалось подготовить приглашение." }, 400);
    return json({ ok: true, mode: "create", email, role, invitation_id: invitation.id });
  }

  if (mode !== "send") return json({ error: "invalid_mode", message: "Недопустимый режим." }, 400);
  const validId = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(invitationId);
  if (!validId && !/^[0-9a-f]{32}$/i.test(legacyToken)) return json({ error: "invite_data_required", message: "Сначала создайте приглашение." }, 400);

  const invitationQuery = admin.from("company_invitations")
    .select("id,company_id,email,role,token,expires_at,accepted_at")
    .eq("company_id", profile.company_id);
  const { data: invitation, error: invitationError } = await (validId ? invitationQuery.eq("id", invitationId) : invitationQuery.eq("token", legacyToken)).maybeSingle();

  if (invitationError || !invitation) return json({ error: "invitation_not_found", message: "Ссылка приглашения не найдена." }, 404);
  if (invitation.accepted_at) return json({ error: "invitation_already_accepted", message: "Это приглашение уже использовано." }, 400);
  if (new Date(invitation.expires_at).getTime() < Date.now()) return json({ error: "invitation_expired", message: "Срок действия приглашения истёк." }, 400);
  if (String(invitation.email).toLowerCase() !== email) return json({ error: "email_mismatch", message: "Email не совпадает с созданным приглашением." }, 400);

  const resend = Deno.env.get("RESEND_API_KEY");
  const from = Deno.env.get("INVITE_FROM_EMAIL") || "SaleTrening <onboarding@resend.dev>";
  if (!resend) return json({ error: "email_service_not_configured", message: "Отправка писем временно недоступна." }, 503);

  let reservation;
  try {
    reservation = await admin.rpc("reserve_saletrening_invitation_send", {
      p_user_id: user.id, p_company_id: profile.company_id,
      p_invitation_id: invitation.id, p_email: email,
    });
  } catch {
    return json({ error: "invite_limit_unavailable", message: "Проверка лимита отправки временно недоступна." }, 503);
  }
  if (reservation.error || !reservation.data ||
      (reservation.data.allowed === true && !reservation.data.attempt_id)) {
    return json({ error: "invite_limit_unavailable", message: "Проверка лимита отправки временно недоступна." }, 503);
  }
  if (reservation.data.allowed !== true) {
    if (reservation.data.status !== 429) return json({ error: "forbidden", message: "Приглашение недоступно." }, 403);
    const retryAfter = Math.max(1, Math.min(3600, Number(reservation.data.retry_after) || 60));
    return json({ error: "invite_rate_limit", message: `Лимит отправки писем. Повторите через ${retryAfter} сек.`, retry_after: retryAfter }, 429, { "Retry-After": String(retryAfter) });
  }
  const attemptId = reservation.data.attempt_id;
  try {
    // Generate authentication links only on the server and deliver to the recipient.
    const token = invitation.token;
    const redirectTo = `https://app.sale-trener.ru/?invite=${encodeURIComponent(token)}&email=${encodeURIComponent(email)}&type=invite`;
    const { data: generated, error: generateError } = await admin.auth.admin.generateLink({
      type: "magiclink", email, options: { redirectTo },
    });
    if (generateError || !generated?.properties?.action_link) {
      return json({ error: "invite_link_failed", message: "Не удалось подготовить письмо с приглашением." }, 400);
    }

    const safeLink = esc(generated.properties.action_link);
    const safeCompanyName = esc(companyName);
    const html = `<!doctype html><html lang="ru"><body style="margin:0;background:#f5f3fb;padding:40px 16px;font-family:Arial,sans-serif;color:#171827">
  <div style="max-width:560px;margin:auto;background:#fff;border-radius:20px;padding:36px">
  <div style="font-size:22px;font-weight:800;margin-bottom:24px">SaleTrening</div>
  <h1 style="font-size:28px;margin:0 0 12px">Вас пригласили в команду</h1>
  <p style="font-size:15px;line-height:1.6;color:#656879">Добрый день!</p>
  <p style="font-size:15px;line-height:1.6;color:#656879">Руководитель компании «${safeCompanyName}» приглашает вас стать участником команды SaleTrening.</p>
  <p style="margin:28px 0"><a href="${safeLink}" target="_blank" rel="noopener" style="display:inline-block;background:#7357ff;color:#fff;text-decoration:none;padding:14px 24px;border-radius:10px;font-weight:700">Принять приглашение</a></p>
  <p style="font-size:12px;line-height:1.5;color:#8a8c99">Ссылка входа одноразовая. Приглашение в команду действует 7 дней.</p>
  </div></body></html>`;

    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${resend}`, "Content-Type": "application/json" },
      signal: AbortSignal.timeout(20_000),
      body: JSON.stringify({
        from, to: [email],
        subject: `Приглашение в команду «${companyName}» — SaleTrening`, html,
      }),
    });
    const result = await response.json().catch(() => ({}));
    if (!response.ok) return json({ error: "email_send_failed", message: "Не удалось отправить письмо. Повторите попытку." }, 502);

    return json({ ok: true, mode: "send", email, invitation_id: invitation.id });
  } catch {
    return json({ error: "email_send_failed", message: "Не удалось подтвердить отправку. Подождите минуту и проверьте почту перед повтором." }, 502);
  } finally {
    // A failed cleanup must never replace a successful provider response.
    // If the worker dies, the pending reservation expires after two minutes.
    try { await admin.rpc("finish_saletrening_invitation_send", { p_attempt_id: attemptId }); } catch { /* cooldown still applies */ }
  }
});
