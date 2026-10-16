/* Manager invitation controls. Authentication links stay on the server. */
(function () {
  'use strict';
  let pending = null;
  let busy = false;
  const element = id => document.getElementById(id);
  const escape = value => String(value ?? '').replace(/[&<>"']/g, ch => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[ch]));
  const notify = message => window.toast?.(message);
  const api = () => typeof sb !== 'undefined' ? sb : window.supabase?.createClient('https://svxykakyrloqzloerygb.supabase.co', 'sb_publishable_r7wu9xAgaiIZBTg4tBiJvQ_CVKHaUoi');

  async function invoke(body) {
    const client = api();
    if (!client) throw new Error('Обновите страницу и попробуйте снова.');
    const { data: sessionData, error: sessionError } = await client.auth.getSession();
    if (sessionError) throw sessionError;
    if (!sessionData?.session?.access_token) throw new Error('Войдите в аккаунт снова.');
    const { data, error } = await client.functions.invoke('send-company-invitation', {
      body,
      headers: { Authorization: 'Bearer ' + sessionData.session.access_token }
    });
    if (error) throw error;
    if (!data?.ok) throw new Error(data?.message || 'Не удалось обработать приглашение.');
    return data;
  }

  window.createCompanyInvitation = async function () {
    if (busy) return;
    const email = element('inviteEmail')?.value.trim().toLowerCase() || '';
    const role = element('inviteRole')?.value || 'employee';
    const out = element('inviteResult');
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return notify('Проверьте email сотрудника.');
    const button = document.querySelector('#inviteBox button.primary');
    busy = true;
    pending = null;
    if (button) { button.disabled = true; button.textContent = 'Готовим приглашение…'; }
    if (out) { out.setAttribute('aria-live', 'polite'); out.textContent = 'Готовим приглашение…'; }
    try {
      const data = await invoke({ mode: 'create', email, role });
      if (data.invitation_id) pending = { email, role, invitation_id: data.invitation_id };
      // Rolling deployment compatibility; never render or log authentication URLs.
      else if (data.token) pending = { email, role, token: data.token };
      else throw new Error('Обновите страницу и попробуйте снова.');
      if (out) out.innerHTML = `<div class="card" style="margin-top:14px;background:#faf9ff"><b>Приглашение подготовлено</b><div class="muted" style="margin:6px 0">Письмо со ссылкой для регистрации получит только сотрудник: <strong>${escape(email)}</strong>.</div><button type="button" id="sendInvitationButton" class="primary" style="margin-top:10px" onclick="sendCompanyInvitation()">Отправить приглашение</button></div>`;
      notify('Приглашение подготовлено');
    } catch (_) {
      if (out) out.innerHTML = '<div class="card" role="alert" style="margin-top:14px;background:#fff5f5"><b>Не удалось подготовить приглашение</b><div class="muted" style="margin-top:6px">Проверьте email и повторите попытку. Если вход истёк, войдите снова.</div></div>';
      notify('Не удалось подготовить приглашение');
    } finally {
      busy = false;
      if (button) { button.disabled = false; button.textContent = 'Создать приглашение'; }
    }
  };

  window.sendCompanyInvitation = async function () {
    if (busy) return;
    if (!pending) return notify('Сначала создайте приглашение.');
    const draft = pending;
    const button = element('sendInvitationButton');
    const createButton = document.querySelector('#inviteBox button.primary');
    const out = element('inviteResult');
    busy = true;
    if (button) { button.disabled = true; button.textContent = 'Отправляем письмо…'; }
    if (createButton) createButton.disabled = true;
    try {
      await invoke({ mode: 'send', email: draft.email, role: draft.role, ...(draft.invitation_id ? { invitation_id: draft.invitation_id } : { token: draft.token }) });
      if (out) out.innerHTML = `<div class="card" role="status" style="margin-top:14px;background:#f1fbf7"><b>✓ Приглашение отправлено</b><div class="muted" style="margin:6px 0">Письмо отправлено на <strong>${escape(draft.email)}</strong>.</div></div>`;
      pending = null;
      notify('Письмо с приглашением отправлено');
    } catch (_) {
      if (out) out.innerHTML = '<div class="card" role="alert" style="margin-top:14px;background:#fff5f5"><b>Не удалось подтвердить отправку</b><div class="muted" style="margin-top:6px">Проверьте, пришло ли сотруднику письмо. При необходимости повторите отправку.</div><button type="button" id="sendInvitationButton" class="primary" style="margin-top:10px" onclick="sendCompanyInvitation()">Повторить отправку</button></div>';
      notify('Не удалось подтвердить отправку письма');
    } finally {
      busy = false;
      if (createButton) createButton.disabled = false;
    }
  };
})();
