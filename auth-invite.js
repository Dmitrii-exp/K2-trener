/* SaleTrening invitation flow + manager invitation sender. */
(function () {
  'use strict';

  const SUPABASE_URL = 'https://svxykakyrloqzloerygb.supabase.co';
  const SUPABASE_KEY = 'sb_publishable_r7wu9xAgaiIZBTg4tBiJvQ_CVKHaUoi';
  const client = window.supabase?.createClient(SUPABASE_URL, SUPABASE_KEY, { auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true } });

  const qs = new URLSearchParams(window.location.search);
  const token = qs.get('invite');
  const invitedEmail = (qs.get('email') || '').trim().toLowerCase();
  const isInvite = qs.get('type') === 'invite' && !!token;
  const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (m) => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[m]));

  /* ---------- Manager: send invitation by email ---------- */
  window.createCompanyInvitation = async function () {
    if (!client) return window.toast?.('Supabase ещё не загрузился. Обновите страницу.');
    const button = document.querySelector('#inviteBox button.primary');
    const result = document.getElementById('inviteResult');
    try {
      const { data: sessionData, error: sessionError } = await client.auth.getSession();
      if (sessionError) throw sessionError;
      const user = sessionData?.session?.user;
      if (!user) throw new Error('Сессия руководителя не найдена. Войдите в аккаунт заново.');

      const { data: profile, error: profileError } = await client.from('profiles').select('company_id,role').eq('id', user.id).single();
      if (profileError) throw profileError;
      if (!profile?.company_id || !['director','admin','manager'].includes(profile.role)) throw new Error('Нет прав для приглашения сотрудников');

      const email = document.getElementById('inviteEmail')?.value.trim().toLowerCase() || '';
      const role = document.getElementById('inviteRole')?.value || 'employee';
      if (!email) throw new Error('Укажи email сотрудника');
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new Error('Проверь email сотрудника');

      if (button) { button.disabled = true; button.textContent = 'Отправляем письмо…'; }
      if (result) result.innerHTML = '<div class="muted" style="margin-top:10px">Отправляем приглашение на email…</div>';

      const { data, error } = await client.functions.invoke('send-company-invitation', {
        body: { email, role, origin: window.location.origin }
      });
      if (error) throw new Error(error.message || 'Ошибка вызова Edge Function');
      if (!data?.ok) throw new Error(data?.message || data?.error || 'Письмо не отправлено');

      const link = data.invite_url || '';
      if (result) result.innerHTML = `<div class="card" style="margin-top:14px;background:#f1fbf7;border-color:#c9eddf"><b>✓ Приглашение отправлено</b><div class="muted" style="margin:6px 0">Письмо отправлено на <strong>${esc(email)}</strong>.</div>${link ? `<div class="muted" style="margin-top:8px">Резервная ссылка:</div><input id="inviteLink" value="${esc(link)}" readonly style="width:100%;border:1px solid var(--line);border-radius:10px;padding:10px;background:#fff"><div style="margin-top:8px"><button type="button" class="secondary" onclick="navigator.clipboard.writeText(document.getElementById('inviteLink').value);toast('Ссылка скопирована')">Скопировать ссылку</button></div>` : ''}</div>`;
      window.toast?.('Письмо с приглашением отправлено');
    } catch (e) {
      console.error('[invite] send-company-invitation:', e);
      if (result) result.innerHTML = `<div class="card" style="margin-top:14px;background:#fff5f5;border-color:#f0ced3"><b>Не удалось отправить письмо</b><div class="muted" style="margin-top:6px">${esc(e?.message || 'Неизвестная ошибка')}</div></div>`;
      window.toast?.('Не удалось отправить приглашение: ' + (e?.message || 'ошибка'));
    } finally {
      if (button) { button.disabled = false; button.textContent = 'Создать приглашение'; }
    }
  };

  /* ---------- Recipient: isolated invitation registration page ---------- */
  if (!isInvite) return;
  const root = document.getElementById('root');
  if (!root || !client) return;

  const css = `
    .invite-page{min-height:100vh;display:grid;place-items:center;padding:32px 18px;background:radial-gradient(circle at 20% 10%,#eee9ff,transparent 35%),linear-gradient(135deg,#fafaff,#f2efff);font-family:Inter,ui-sans-serif,Arial,sans-serif;color:#171827}
    .invite-card{width:min(520px,100%);background:#fff;border:1px solid #e5e3ee;border-radius:28px;padding:34px;box-shadow:0 25px 80px rgba(51,32,96,.13)}
    .invite-logo{display:flex;align-items:center;gap:11px;font-size:20px;font-weight:850}.invite-logo-b{width:42px;height:42px;border-radius:13px;background:linear-gradient(135deg,#7357ff,#9b86ff);color:#fff;display:grid;place-items:center;box-shadow:0 8px 20px rgba(109,74,255,.22)}
    .invite-badge{display:inline-block;margin-top:24px;font-size:11px;font-weight:800;color:#6548ee;background:#eeeaff;padding:7px 10px;border-radius:999px}.invite-card h1{font-size:32px;line-height:1.1;margin:16px 0 9px;letter-spacing:-.7px}.invite-sub{color:#7b7e91;line-height:1.55;font-size:14px}
    .invite-field{margin:16px 0}.invite-field label{display:block;font-size:13px;color:#686b7c;margin-bottom:7px}.invite-field input{width:100%;box-sizing:border-box;border:1px solid #e1e1e9;border-radius:12px;padding:13px 14px;font:inherit;outline:none;background:#fff}.invite-field input:focus{border-color:#7357ff;box-shadow:0 0 0 3px #7357ff18}.invite-field input[readonly]{background:#f5f5f8;color:#626274;cursor:not-allowed}
    .invite-actions{margin-top:20px}.invite-btn{width:100%;border:0;border-radius:12px;padding:13px 17px;background:linear-gradient(135deg,#7357ff,#6548ed);color:#fff;font-weight:800;font-size:14px;cursor:pointer}.invite-btn:disabled{opacity:.65;cursor:wait}.invite-error,.invite-success{display:none;margin-top:14px;padding:12px 14px;border-radius:12px;font-size:13px;line-height:1.45}.invite-error{background:#fff3f4;border:1px solid #f0ced3;color:#b33b4b}.invite-success{background:#f0fbf7;border:1px solid #c9eddf;color:#187957}@media(max-width:560px){.invite-page{padding:16px}.invite-card{padding:25px;border-radius:22px}.invite-card h1{font-size:28px}}
  `;
  const style = document.createElement('style'); style.id='saletrening-invite-isolated'; style.textContent=css; document.head.appendChild(style);

  function render(email, loading=false){
    root.innerHTML=`<main class="invite-page"><section class="invite-card"><div class="invite-logo"><span class="invite-logo-b">S</span><span>SaleTrening</span></div><span class="invite-badge">ПРИГЛАШЕНИЕ В КОМАНДУ</span><h1>Завершите регистрацию</h1><div class="invite-sub">Вас пригласили присоединиться к команде. Email из приглашения закреплён и не может быть изменён.</div><div class="invite-field"><label>Имя</label><input id="inviteFirst" autocomplete="given-name" placeholder="Ваше имя"></div><div class="invite-field"><label>Email</label><input id="inviteEmail" value="${esc(email)}" readonly></div><div class="invite-field"><label>Пароль</label><input id="invitePassword" type="password" autocomplete="new-password" placeholder="Минимум 6 символов"></div><div class="invite-actions"><button id="inviteComplete" class="invite-btn" ${loading?'disabled':''}>${loading?'Проверяем приглашение…':'Завершить регистрацию'}</button></div><div id="inviteError" class="invite-error"></div><div id="inviteSuccess" class="invite-success"></div></section></main>`;
    document.getElementById('inviteComplete')?.addEventListener('click',complete);
  }
  const errorBox=()=>document.getElementById('inviteError');
  function message(t){const e=errorBox();if(e){e.textContent=t;e.style.display='block'}}
  function success(t){const e=document.getElementById('inviteSuccess');if(e){e.innerHTML=t;e.style.display='block'}}

  async function init(){
    render(invitedEmail,true);
    try{
      const {data,error}=await client.auth.getSession(); if(error) throw error;
      let session=data?.session||null;
      if(!session){await new Promise(r=>setTimeout(r,1000));session=(await client.auth.getSession()).data?.session||null;}
      if(!session?.user){render(invitedEmail);message('Не удалось подтвердить ссылку приглашения. Откройте ссылку из письма ещё раз.');return;}
      const actual=String(session.user.email||'').toLowerCase();
      if(invitedEmail&&actual!==invitedEmail){await client.auth.signOut();render(invitedEmail);message('Email не совпадает с приглашением. Используйте адрес, на который пришло письмо.');return;}
      render(actual||invitedEmail);
    }catch(e){console.error('[invite] init:',e);render(invitedEmail);message(e?.message||'Не удалось открыть приглашение.');}
  }

  async function complete(){
    const first=document.getElementById('inviteFirst')?.value.trim()||''; const password=document.getElementById('invitePassword')?.value||''; const button=document.getElementById('inviteComplete'); if(errorBox())errorBox().style.display='none';
    if(!first)return message('Введите имя.'); if(password.length<6)return message('Пароль должен содержать минимум 6 символов.');
    try{
      button.disabled=true;button.textContent='Создаём аккаунт…';
      const {data}=await client.auth.getSession(); const user=data?.session?.user; if(!user)throw new Error('Сессия приглашения не найдена.');
      const {error:updateError}=await client.auth.updateUser({password,data:{first_name:first}});if(updateError)throw updateError;
      const {data:accepted,error:rpcError}=await client.rpc('accept_company_invitation',{p_token:token});if(rpcError)throw rpcError;if(!accepted?.ok)throw new Error('Приглашение не было принято.');
      success('Регистрация завершена. Перенаправляем в ваш кабинет…');window.history.replaceState({},document.title,window.location.pathname);setTimeout(()=>window.location.reload(),700);
    }catch(e){console.error('[invite] complete:',e);message(e?.message||'Не удалось завершить регистрацию.');button.disabled=false;button.textContent='Завершить регистрацию';}
  }

  window.__SALE_TRAINING_INVITE_FLOW__=true;
  window.boot=function(){return Promise.resolve()};
  init();
})();