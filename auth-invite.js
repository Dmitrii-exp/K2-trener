/* COMPANY_INVITE_EMAIL_V1 */
/* TRIGGER_INVITATION_WIRING_V3 */
(function(){
  const qs=new URLSearchParams(location.search);
  const token=qs.get('invite')||localStorage.getItem('saletrening_invite_token')||'';
  const invitedEmail=(qs.get('email')||'').trim().toLowerCase();
  const inviteFlow=qs.get('type')==='invite'&&!!token;
  if(!inviteFlow)return;
  const originalBoot=window.boot;
  function showRegistration(email){
    const safe=window.esc?window.esc(String(email||'')):String(email||'');
    const root=document.getElementById('root');
    if(!root)return;
    root.innerHTML=`<div class="auth"><div class="auth-card"><div class="auth-brand"><div class="logo"><div class="logo-b">S</div>SaleTrening</div><span class="auth-badge">ПРИГЛАШЕНИЕ</span></div><h1>Завершите регистрацию.</h1><div class="sub">Вы приглашены в команду SaleTrening. Email из приглашения закреплён и не может быть изменён.</div><div class="field"><label>Имя</label><input id="inviteFirst" placeholder="Дмитрий"></div><div class="field"><label>Email</label><input id="inviteEmailLocked" type="email" value="${safe}" readonly style="background:#f5f5f8;color:#555;cursor:not-allowed"></div><div class="field"><label>Пароль</label><input id="invitePass" type="password" placeholder="Минимум 6 символов"></div><div class="auth-actions"><button class="primary" onclick="completeInviteRegistration()">Завершить регистрацию</button></div><div class="auth-note">Email автоматически закреплён за приглашением руководителя.</div></div></div>`;
  }
  window.completeInviteRegistration=async function(){
    const first=document.getElementById('inviteFirst')?.value.trim()||'';
    const password=document.getElementById('invitePass')?.value||'';
    if(password.length<6){window.toast('Пароль должен содержать минимум 6 символов');return}
    const {data,error}=await window.sb.auth.updateUser({password,data:{first_name:first}});
    if(error){window.toast(error.message);return}
    try{await window.acceptPendingInvitation(data?.user?.id);await originalBoot(data.user)}catch(e){console.error('completeInviteRegistration:',e);window.toast(e.message||'Не удалось принять приглашение')}
  };
  window.createCompanyInvitation=async function(){
    if(!window.state?.user||!window.state?.profile){window.toast('Профиль ещё загружается. Обновите страницу через секунду.');return}
    if(!window.state.profile.company_id||!['director','admin','manager'].includes(window.state.profile.role)){window.toast('Нет прав для приглашения сотрудников');return}
    const email=document.getElementById('inviteEmail')?.value.trim().toLowerCase();
    const role=document.getElementById('inviteRole')?.value||'employee';
    if(!email){window.toast('Укажи email сотрудника');return}
    const {data,error}=await window.sb.functions.invoke('send-company-invitation',{body:{email,role,origin:location.origin}});
    if(error){window.toast(error.message||'Не удалось отправить приглашение');return}
    if(data?.error){window.toast(data.error);return}
    const out=document.getElementById('inviteResult');
    if(out)out.innerHTML=`<div class="card" style="margin-top:14px;background:#faf9ff"><b>Приглашение отправлено</b><div class="muted" style="margin-top:6px">Письмо с приглашением автоматически отправлено на ${window.esc(email)}. Срок действия — 7 дней.</div></div>`;
    if(document.getElementById('inviteEmail'))document.getElementById('inviteEmail').value='';
  };
  window.boot=async function(user){
    const sessionEmail=String(user?.email||'').trim().toLowerCase();
    if(invitedEmail&&sessionEmail&&sessionEmail!==invitedEmail){await window.sb.auth.signOut();window.authScreen();return}
    showRegistration(sessionEmail||invitedEmail);
  };
  window.signUp=function(){window.toast('Для регистрации сотрудника используйте ссылку из приглашения на указанный Email.');};
  window.addEventListener('load',async function(){
    const {data}=await window.sb.auth.getSession();
    if(data?.session)window.boot(data.session.user);
    else{const input=document.getElementById('email');if(input&&invitedEmail){input.value=invitedEmail;input.readOnly=true;input.style.background='#f5f5f8';input.style.color='#555';input.style.cursor='not-allowed'}}
  });
})();
