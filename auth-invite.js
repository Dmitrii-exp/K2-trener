/* SaleTrening production overrides */
(function(){
  const originalNav=window.nav;
  window.nav=function(v,t,icon){
    if(v==='ai')t='AI-чат';
    return originalNav?originalNav(v,t,icon):`<button class="${state.view===v?'active':''}" onclick="state.view='${v}';page()"><span class="nav-icon">${icon}</span>${t}</button>`;
  };

  const key=()=>`saletrening_mentor_${window.state?.user?.id||'guest'}`;
  const escM=s=>String(s??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[m]));
  const load=()=>{try{const x=JSON.parse(localStorage.getItem(key())||'[]');return Array.isArray(x)?x.slice(-40):[]}catch{return[]}};
  const save=()=>{try{localStorage.setItem(key(),JSON.stringify(state.mentorMessages||[]))}catch{}};
  function draw(){
    const box=document.getElementById('mentorMessages');if(!box)return;
    const a=state.mentorMessages||[];
    box.innerHTML=a.length?a.map(m=>`<div class="msg ${m.role==='assistant'?'client':'manager'}"><b>${m.role==='assistant'?'AI-наставник':'Вы'}:</b><div style="white-space:pre-wrap;margin-top:5px">${escM(m.text)}</div></div>`).join(''):`<div class="empty" style="background:transparent;border:0;padding:55px 20px"><div style="font-size:42px">✦</div><b style="font-size:18px;color:var(--text)">AI-наставник готов</b><div class="muted" style="margin-top:7px">Спросите, как отработать возражение, разобрать тренировку или усилить аргументацию.</div></div>`;
    box.scrollTop=box.scrollHeight;
  }
  window.clearMentorChat=function(){state.mentorMessages=[];save();draw()};
  window.sendMentorMessage=async function(){
    const input=document.getElementById('mentorInput'),button=document.getElementById('mentorSend');
    if(!input||!button)return;const text=input.value.trim();if(!text||button.disabled)return;
    if(!state.mentorMessages)state.mentorMessages=load();state.mentorMessages.push({role:'user',text});save();input.value='';draw();button.disabled=true;button.textContent='Думаю…';
    try{
      const s=await sb.auth.getSession(),token=s?.data?.session?.access_token;if(!token)throw new Error('Сессия авторизации истекла. Войдите снова.');
      const r=await fetch(`${SUPABASE_URL}/functions/v1/manager-ai-chat`,{method:'POST',headers:{'Content-Type':'application/json','apikey':SUPABASE_KEY,'Authorization':`Bearer ${token}`},body:JSON.stringify({message:text,transcript:state.mentorMessages.slice(-16),profile:{first_name:state.profile?.first_name||'',role:state.profile?.role||'',company:state.company?.name||''},stats:state.stats||{},history:(state.history||[]).slice(0,10)}),cache:'no-store'});
      const raw=await r.text();let j=null;try{j=raw?JSON.parse(raw):null}catch{}if(!r.ok||!j?.reply)throw new Error(j?.error||j?.message||raw||`HTTP ${r.status}`);
      state.mentorMessages.push({role:'assistant',text:j.reply});save();draw();
    }catch(e){console.error('manager-ai-chat:',e);state.mentorMessages.push({role:'assistant',text:`Не удалось получить ответ AI: ${e.message||'ошибка'}`});save();draw()}
    finally{button.disabled=false;button.textContent='Отправить';input.focus()}
  };
  window.aiCoach=function(){
    if(!state.mentorMessages)state.mentorMessages=load();
    return `<div class="top"><div><h2>AI-чат</h2><div class="muted">Персональный AI-наставник по продажам</div></div><div class="top-actions"><span class="pill">YandexGPT</span><button class="secondary" onclick="clearMentorChat()">Очистить чат</button></div></div><div class="chat" style="height:calc(100vh - 150px);min-height:520px"><div id="mentorMessages" class="messages"></div><div class="composer"><textarea id="mentorInput" rows="2" placeholder="Например: как ответить на возражение «Дорого»?"></textarea><button id="mentorSend" class="primary" onclick="sendMentorMessage()">Отправить</button></div></div>`;
  };
  const oldPage=window.page;
  if(oldPage)window.page=function(){const r=oldPage.apply(this,arguments);if(state.view==='ai')setTimeout(draw,0);return r};
  document.addEventListener('keydown',e=>{if(e.key==='Enter'&&!e.shiftKey&&document.activeElement?.id==='mentorInput'){e.preventDefault();sendMentorMessage()}});

  /* Preserve invitation-only registration flow. */
  const qs=new URLSearchParams(location.search),token=qs.get('invite')||localStorage.getItem('saletrening_invite_token')||'',invitedEmail=(qs.get('email')||'').trim().toLowerCase(),inviteFlow=qs.get('type')==='invite'&&!!token;
  if(!inviteFlow)return;
  const originalBoot=window.boot;
  function showInvite(email){const root=document.getElementById('root');if(!root)return;root.innerHTML=`<div class="auth"><div class="auth-card"><div class="auth-brand"><div class="logo"><div class="logo-b">S</div>SaleTrening</div><span class="auth-badge">ПРИГЛАШЕНИЕ</span></div><h1>Завершите регистрацию.</h1><div class="sub">Вы приглашены в команду SaleTrening. Email из приглашения закреплён и не может быть изменён.</div><div class="field"><label>Имя</label><input id="inviteFirst" placeholder="Дмитрий"></div><div class="field"><label>Email</label><input id="inviteEmailLocked" value="${escM(email)}" readonly style="background:#f5f5f8;color:#555"></div><div class="field"><label>Пароль</label><input id="invitePass" type="password" placeholder="Минимум 6 символов"></div><div class="auth-actions"><button class="primary" onclick="completeInviteRegistration()">Завершить регистрацию</button></div></div></div>`}
  window.completeInviteRegistration=async function(){const first=document.getElementById('inviteFirst')?.value.trim()||'',password=document.getElementById('invitePass')?.value||'';if(password.length<6){toast('Пароль должен содержать минимум 6 символов');return}const {data,error}=await sb.auth.updateUser({password,data:{first_name:first}});if(error){toast(error.message);return}try{await acceptPendingInvitation(data?.user?.id);await originalBoot(data.user)}catch(e){console.error(e);toast(e.message||'Не удалось принять приглашение')}};
  window.boot=async function(user){const email=String(user?.email||'').trim().toLowerCase();if(invitedEmail&&email&&email!==invitedEmail){await sb.auth.signOut();authScreen();return}showInvite(email||invitedEmail)};
  window.signUp=function(){toast('Для регистрации сотрудника используйте ссылку из приглашения.');};
})();
