/* SaleTrening invitation flow — isolated from the main auth UI. */
(function () {
  'use strict';

  const qs = new URLSearchParams(window.location.search);
  const token = qs.get('invite');
  const invitedEmail = (qs.get('email') || '').trim().toLowerCase();
  const isInvite = qs.get('type') === 'invite' && !!token;
  if (!isInvite) return;

  const root = document.getElementById('root');
  if (!root) return;

  const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (m) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;'
  }[m]));

  const css = `
    .invite-page{min-height:100vh;display:grid;place-items:center;padding:32px 18px;background:radial-gradient(circle at 20% 10%,#eee9ff,transparent 35%),linear-gradient(135deg,#fafaff,#f2efff);font-family:Inter,ui-sans-serif,Arial,sans-serif;color:#171827}
    .invite-card{width:min(520px,100%);background:#fff;border:1px solid #e5e3ee;border-radius:28px;padding:34px;box-shadow:0 25px 80px rgba(51,32,96,.13)}
    .invite-logo{display:flex;align-items:center;gap:11px;font-size:20px;font-weight:850}.invite-logo-b{width:42px;height:42px;border-radius:13px;background:linear-gradient(135deg,#7357ff,#9b86ff);color:#fff;display:grid;place-items:center;box-shadow:0 8px 20px rgba(109,74,255,.22)}
    .invite-badge{display:inline-block;margin-top:24px;font-size:11px;font-weight:800;color:#6548ee;background:#eeeaff;padding:7px 10px;border-radius:999px}
    .invite-card h1{font-size:32px;line-height:1.1;margin:16px 0 9px;letter-spacing:-.7px}.invite-sub{color:#7b7e91;line-height:1.55;font-size:14px}
    .invite-field{margin:16px 0}.invite-field label{display:block;font-size:13px;color:#686b7c;margin-bottom:7px}.invite-field input{width:100%;box-sizing:border-box;border:1px solid #e1e1e9;border-radius:12px;padding:13px 14px;font:inherit;outline:none;background:#fff}.invite-field input:focus{border-color:#7357ff;box-shadow:0 0 0 3px #7357ff18}.invite-field input[readonly]{background:#f5f5f8;color:#626274;cursor:not-allowed}
    .invite-actions{margin-top:20px}.invite-btn{width:100%;border:0;border-radius:12px;padding:13px 17px;background:linear-gradient(135deg,#7357ff,#6548ed);color:#fff;font-weight:800;font-size:14px;cursor:pointer}.invite-btn:disabled{opacity:.65;cursor:wait}.invite-error{display:none;margin-top:14px;padding:12px 14px;border-radius:12px;background:#fff3f4;border:1px solid #f0ced3;color:#b33b4b;font-size:13px;line-height:1.45}.invite-success{display:none;margin-top:14px;padding:14px;border-radius:12px;background:#f0fbf7;border:1px solid #c9eddf;color:#187957;font-size:13px;line-height:1.45}
    @media(max-width:560px){.invite-page{padding:16px}.invite-card{padding:25px;border-radius:22px}.invite-card h1{font-size:28px}}
  `;
  const style = document.createElement('style');
  style.id = 'saletrening-invite-isolated';
  style.textContent = css;
  document.head.appendChild(style);

  let supabaseClient = null;
  let invitationReady = false;

  function render(email, loading = false) {
    root.innerHTML = `<main class="invite-page">
      <section class="invite-card" aria-label="Приглашение в SaleTrening">
        <div class="invite-logo"><span class="invite-logo-b">S</span><span>SaleTrening</span></div>
        <span class="invite-badge">ПРИГЛАШЕНИЕ В КОМАНДУ</span>
        <h1>Завершите регистрацию</h1>
        <div class="invite-sub">Вас пригласили присоединиться к команде. Email из приглашения закреплён и не может быть изменён.</div>
        <div class="invite-field"><label for="inviteFirst">Имя</label><input id="inviteFirst" autocomplete="given-name" placeholder="Ваше имя"></div>
        <div class="invite-field"><label for="inviteEmail">Email</label><input id="inviteEmail" value="${esc(email)}" readonly tabindex="-1"></div>
        <div class="invite-field"><label for="invitePassword">Пароль</label><input id="invitePassword" type="password" autocomplete="new-password" placeholder="Минимум 6 символов"></div>
        <div class="invite-actions"><button id="inviteComplete" class="invite-btn" ${loading ? 'disabled' : ''}>${loading ? 'Подготавливаем приглашение…' : 'Завершить регистрацию'}</button></div>
        <div id="inviteError" class="invite-error"></div><div id="inviteSuccess" class="invite-success"></div>
      </section>
    </main>`;
    const button = document.getElementById('inviteComplete');
    if (button) button.addEventListener('click', complete);
  }

  function message(text) { const el = document.getElementById('inviteError'); if (el) { el.textContent = text; el.style.display = 'block'; } }
  function success(text) { const el = document.getElementById('inviteSuccess'); if (el) { el.innerHTML = text; el.style.display = 'block'; } }

  async function init() {
    render(invitedEmail, true);
    try {
      if (!window.supabase || !window.SUPABASE_URL || !window.SUPABASE_KEY) throw new Error('Сервис авторизации ещё не загрузился. Обновите страницу.');
      supabaseClient = window.supabase.createClient(window.SUPABASE_URL, window.SUPABASE_KEY, { auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true } });
      const { data, error } = await supabaseClient.auth.getSession();
      if (error) throw error;
      let session = data?.session || null;

      if (!session) {
        supabaseClient.auth.onAuthStateChange((event, s) => {
          if (s && !invitationReady) { session = s; invitationReady = true; }
        });
        await new Promise((resolve) => setTimeout(resolve, 700));
        const current = await supabaseClient.auth.getSession();
        session = current.data?.session || session;
      }

      if (!session?.user) {
        render(invitedEmail);
        message('Ссылка приглашения открыта. Если форма не активировалась, откройте ссылку ещё раз в этой вкладке.');
        return;
      }

      const email = String(session.user.email || invitedEmail).trim().toLowerCase();
      if (invitedEmail && email !== invitedEmail) {
        await supabaseClient.auth.signOut();
        render(invitedEmail);
        message('Эта ссылка приглашения предназначена для другого Email. Откройте письмо в почте, указанной в приглашении.');
        return;
      }
      render(email);
    } catch (e) {
      console.error('[invite] init:', e);
      render(invitedEmail);
      message(e?.message || 'Не удалось подготовить приглашение.');
    }
  }

  async function complete() {
    const first = document.getElementById('inviteFirst')?.value.trim() || '';
    const password = document.getElementById('invitePassword')?.value || '';
    const button = document.getElementById('inviteComplete');
    const error = document.getElementById('inviteError');
    if (error) error.style.display = 'none';
    if (!first) return message('Введите имя.');
    if (password.length < 6) return message('Пароль должен содержать минимум 6 символов.');
    if (!supabaseClient) return message('Авторизация ещё не готова. Обновите страницу.');
    try {
      button.disabled = true; button.textContent = 'Создаём аккаунт…';
      const sessionResult = await supabaseClient.auth.getSession();
      const user = sessionResult.data?.session?.user;
      if (!user) throw new Error('Сессия приглашения не найдена. Откройте ссылку из письма ещё раз.');
      if (invitedEmail && String(user.email || '').toLowerCase() !== invitedEmail) throw new Error('Email не совпадает с приглашением.');

      const { error: updateError } = await supabaseClient.auth.updateUser({ password, data: { first_name: first } });
      if (updateError) throw updateError;

      const { data: accepted, error: rpcError } = await supabaseClient.rpc('accept_company_invitation', { p_token: token });
      if (rpcError) throw rpcError;
      if (!accepted?.ok) throw new Error('Приглашение не было принято.');

      success('Регистрация завершена. Перенаправляем в ваш кабинет…');
      window.history.replaceState({}, document.title, window.location.pathname);
      setTimeout(() => window.location.reload(), 700);
    } catch (e) {
      console.error('[invite] complete:', e);
      message(e?.message || 'Не удалось завершить регистрацию.');
      button.disabled = false; button.textContent = 'Завершить регистрацию';
    }
  }

  window.__SALE_TRAINING_INVITE_FLOW__ = true;
  window.boot = function () { return Promise.resolve(); };

  // Invitation creation fix: route the manager button through the Edge Function
  // so the function creates the invitation and sends the email via Resend.
  window.createCompanyInvitation = async function () {
    if (!window.state || !window.sb) {
      if (typeof window.toast === 'function') window.toast('Профиль ещё загружается. Обновите страницу через секунду.');
      return;
    }
    const profile = window.state.profile;
    const user = window.state.user;
    if (!user || !profile) return window.toast?.('Профиль ещё загружается. Обновите страницу через секунду.');
    if (!profile.company_id || !['director','admin','manager'].includes(profile.role)) {
      return window.toast?.('Нет прав для приглашения сотрудников');
    }
    const email = document.getElementById('inviteEmail')?.value.trim().toLowerCase() || '';
    const role = document.getElementById('inviteRole')?.value || 'employee';
    if (!email) return window.toast?.('Укажи email сотрудника');

    const button = document.querySelector('#inviteBox button.primary');
    if (button) { button.disabled = true; button.textContent = 'Отправляем…'; }
    try {
      const { data, error } = await window.sb.functions.invoke('send-company-invitation', {
        body: { email, role, origin: window.location.origin }
      });
      if (error) throw error;
      if (!data?.ok) throw new Error(data?.error || 'Не удалось отправить приглашение');

      const result = document.getElementById('inviteResult');
      if (result) {
        const link = data.invite_url || data.url || '';
        result.innerHTML = `<div class="card" style="margin-top:14px;background:#faf9ff"><b>Приглашение отправлено</b><div class="muted" style="margin:6px 0">Письмо отправлено на ${esc(email)}. Срок действия: 7 дней.</div>${link ? `<input id="inviteLink" value="${esc(link)}" readonly style="width:100%;border:1px solid var(--line);border-radius:10px;padding:10px;background:#fff"><div style="display:flex;gap:8px;margin-top:8px"><button class="primary" onclick="navigator.clipboard.writeText(document.getElementById('inviteLink').value);toast('Ссылка скопирована')">Копировать ссылку</button></div>` : ''}</div>`;
      }
      window.toast?.('Приглашение отправлено на email');
    } catch (e) {
      console.error('[invite] send-company-invitation:', e);
      window.toast?.('Не удалось отправить приглашение: ' + (e?.message || 'ошибка'));
    } finally {
      if (button) { button.disabled = false; button.textContent = 'Создать приглашение'; }
    }
  };

  init();
})();