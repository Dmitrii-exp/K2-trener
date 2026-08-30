import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Content-Type": "application/json",
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: cors });

function getAdminKey() {
  // New Supabase projects expose named secret keys in SUPABASE_SECRET_KEYS.
  // Keep legacy fallbacks for older projects.
  const secretKeys = Deno.env.get("SUPABASE_SECRET_KEYS");
  if (secretKeys) {
    try {
      const parsed = JSON.parse(secretKeys);
      if (parsed?.default) return parsed.default;
    } catch (_) {}
  }
  return (
    Deno.env.get("SUPABASE_SECRET_KEY") ||
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ||
    ""
  );
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return json({ error: "method_not_allowed" }, 405);

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const adminKey = getAdminKey();
  if (!supabaseUrl || !adminKey) {
    return json({
      error: "server_not_configured",
      message: "В Edge Function не найден секретный ключ Supabase. Нужен SUPABASE_SECRET_KEYS/default или legacy service_role.",
    }, 500);
  }

  const authHeader = req.headers.get("Authorization") || "";
  if (!authHeader) return json({ error: "unauthorized" }, 401);

  // User-scoped client: used only for authentication and RLS-protected data.
  const caller = createClient(supabaseUrl, adminKey, {
    global: { headers: { Authorization: authHeader } },
    auth: { autoRefreshToken: false, persistSession: false, detectSessionInUrl: false },
  });

  const {
    data: { user },
    error: userError,
  } = await caller.auth.getUser();
  if (userError || !user) {
    return json({ error: "unauthorized", message: userError?.message || "Пользователь не авторизован" }, 401);
  }

  const body = await req.json().catch(() => ({}));
  const email = String(body?.email || "").trim().toLowerCase();
  const role = String(body?.role || "employee");
  const mode = body?.mode === "generate" ? "generate" : "send";

  if (!email || !/^([^\s@]+)@([^\s@]+)\.[^\s@]+$/.test(email)) {
    return json({ error: "invalid_email", message: "Некорректный Email сотрудника" }, 400);
  }
  if (!["employee", "manager"].includes(role)) {
    return json({ error: "invalid_role", message: "Недопустимая роль приглашения" }, 400);
  }

  const { data: profile, error: profileError } = await caller
    .from("profiles")
    .select("company_id,role")
    .eq("id", user.id)
    .single();

  if (
    profileError ||
    !profile?.company_id ||
    !["director", "admin", "manager"].includes(profile.role)
  ) {
    return json({
      error: "forbidden",
      message: profileError?.message || `Недостаточно прав для приглашения. Роль профиля: ${profile?.role || "не определена"}`,
    }, 403);
  }

  const origin = String(body?.origin || "").replace(/\/$/, "");
  if (!origin) return json({ error: "origin_required", message: "Не передан адрес сайта" }, 400);

  const token = crypto.randomUUID().replaceAll("-", "");
  const { error: invitationError } = await caller
    .from("company_invitations")
    .insert({
      company_id: profile.company_id,
      email,
      role,
      token,
      invited_by: user.id,
      expires_at: new Date(Date.now() + 7 * 86400000).toISOString(),
    });

  if (invitationError) {
    return json({ error: "invitation_create_failed", message: invitationError.message }, 400);
  }

  const redirectTo = `${origin}/?invite=${encodeURIComponent(token)}&email=${encodeURIComponent(email)}&type=invite`;

  // IMPORTANT: separate admin client. The caller JWT must not be present in
  // the Authorization header of Auth Admin requests.
  const admin = createClient(supabaseUrl, adminKey, {
    auth: { autoRefreshToken: false, persistSession: false, detectSessionInUrl: false },
  });

  const { data: generated, error: generateError } =
    await admin.auth.admin.generateLink({
      type: "magiclink",
      email,
      options: { redirectTo },
    });

  if (generateError || !generated?.properties?.action_link) {
    await caller.from("company_invitations").delete().eq("token", token);
    return json({
      error: "invite_link_failed",
      message: generateError?.message || "Не удалось создать ссылку приглашения",
      redirect_to: redirectTo,
    }, 400);
  }

  const actionLink = generated.properties.action_link;
  if (mode === "generate") {
    return json({ ok: true, mode: "generate", email, invitation_id: generated.user?.id || null, invite_url: actionLink });
  }

  const resendKey = Deno.env.get("RESEND_API_KEY");
  const from = Deno.env.get("INVITE_FROM_EMAIL") || "SaleTrening <onboarding@resend.dev>";

  if (!resendKey) {
    return json({
      error: "email_service_not_configured",
      message: "RESEND_API_KEY не найден среди секретов Supabase Edge Functions. Ключ Vercel здесь не используется.",
      invite_url: actionLink,
    }, 503);
  }

  const html = `<!doctype html><html><body style="font-family:Arial,sans-serif;background:#f6f5fb;padding:32px"><div style="max-width:560px;margin:auto;background:#fff;border-radius:18px;padding:32px;box-shadow:0 10px 30px rgba(0,0,0,.08)"><h1 style="margin-top:0">Приглашение в SaleTrening</h1><p>Вас пригласили присоединиться к команде SaleTrening.</p><p>Нажмите кнопку ниже, чтобы войти и завершить регистрацию.</p><p><a href="${actionLink}" style="display:inline-block;background:#6d45ff;color:#fff;text-decoration:none;padding:13px 22px;border-radius:10px;font-weight:700">Принять приглашение</a></p><p style="color:#777;font-size:13px">Если кнопка не открывается, скопируйте эту ссылку в браузер:<br>${actionLink}</p></div></body></html>`;

  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${resendKey}` },
    body: JSON.stringify({ from, to: [email], subject: "Приглашение в SaleTrening", html }),
  });

  const result = await res.json().catch(() => ({}));
  if (!res.ok) {
    return json({
      error: "email_send_failed",
      message: result?.message || `Resend вернул HTTP ${res.status}`,
      invite_url: actionLink,
    }, 502);
  }

  return json({ ok: true, mode: "send", email, invitation_id: generated.user?.id || null, invite_url: actionLink, email_id: result?.id || null });
});
