/* Personal, server-persisted AI mentor dialogues. */
(function(){
 'use strict';
 let owner='',epoch=0,active=null,historyOpen=false,items=[],cursor=null,more=true,listBusy=false,listError='',listVersion=0;
 const records=new Map();
 const scope=()=>String(state.user?.id||'')+':'+String(state.profile?.company_id||'');
 const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 const date=v=>new Date(v).toLocaleString('ru-RU',{day:'2-digit',month:'2-digit',year:'numeric',hour:'2-digit',minute:'2-digit'});
 function draft(){const r={id:crypto.randomUUID(),created:false,loaded:true,messages:[],draft:'',busy:false,error:'',retry:null};records.set(r.id,r);active=r.id;return r;}
 function sync(){if(owner!==scope()){owner=scope();epoch++;records.clear();active=null;historyOpen=false;items=[];listVersion++;}if(!active)draft();}
 function paint(scroll=false){if(owner!==scope()||state.view!=='ai')return;page();if(scroll)requestAnimationFrame(()=>{const box=document.getElementById('aiMessages');if(box)box.scrollTop=box.scrollHeight;});}
 function current(r,e){return epoch===e&&owner===scope()&&records.get(r.id)===r;}
 async function token(){const {data,error}=await sb.auth.getSession();if(error||!data?.session?.access_token)throw Error('Сессия истекла. Войдите снова.');return data.session.access_token;}
 async function read(params){const t=await token(),response=await fetch(SUPABASE_URL+'/rest/v1/mentor_chat_dialogues?'+new URLSearchParams(params),{headers:{apikey:SUPABASE_KEY,Authorization:'Bearer '+t},cache:'no-store',signal:AbortSignal.timeout(20000)});if(!response.ok)throw Error('Не удалось загрузить историю. Повторите попытку.');return await response.json();}
 const styles=`<style>.mentor-actions{display:flex;gap:10px;flex-wrap:wrap}.mentor-list{display:grid;gap:12px}.mentor-history-row{width:100%;text-align:left;display:block;padding:18px;border:1px solid var(--line);border-radius:16px;background:var(--card,#fff);color:inherit;cursor:pointer}.mentor-history-row strong{display:block;overflow-wrap:anywhere;margin-bottom:7px}.mentor-history-row:focus-visible{outline:3px solid var(--p);outline-offset:3px}.mentor-note{padding:14px;margin:12px 0;border:1px solid var(--line);border-radius:12px;overflow-wrap:anywhere}.mentor-chat .msg{white-space:pre-wrap;overflow-wrap:anywhere}.mentor-chat textarea{resize:none;min-width:0}.mentor-chat .composer{flex-wrap:wrap}.mentor-chat .composer textarea{flex:1 1 200px;order:0;width:auto}.mentor-chat .composer button{min-height:44px;order:1;flex:0 0 auto}@media(max-width:700px){.mentor-actions{width:100%}.mentor-actions button{flex:1;min-height:44px}.mentor-chat .composer textarea{flex-basis:100%}.mentor-chat .composer button{width:100%}}</style>`;
 window.aiChat=function(){
  sync();const r=records.get(active);
  const header='<div class="top"><div><h2>AI-чат</h2><div class="muted">'+(historyOpen?'История ваших диалогов':'Наставник по продажам и переговорам')+'</div></div><div class="mentor-actions"><button type="button" class="secondary" onclick="openMentorHistory()">История</button><button type="button" class="primary" onclick="newMentorChat()">Новый чат</button></div></div>';
  if(historyOpen)return styles+header+'<div class="mentor-list">'+items.map(x=>'<button type="button" class="mentor-history-row" data-dialogue="'+esc(x.id)+'" onclick="openMentorDialogue(this.dataset.dialogue)"><strong>'+esc(x.title||'Новый диалог')+'</strong><span class="muted">'+esc(date(x.updated_at))+'</span></button>').join('')+'</div>'+(listError?'<div role="alert" class="mentor-note">'+esc(listError)+' <button type="button" class="secondary" onclick="loadMentorHistory()">Повторить</button></div>':'')+(listBusy?'<div role="status" class="mentor-note">Загрузка истории…</div>':!items.length&&!listError?'<div class="empty">Сохранённых диалогов пока нет. Начните новый чат и отправьте сообщение.</div>':'')+(more&&!listBusy&&items.length?'<button type="button" class="secondary" style="margin-top:16px" onclick="loadMentorHistory()">Показать ещё</button>':'');
  if(r.loading)return styles+header+'<div role="status" class="empty">Загрузка диалога…</div>';
  const error=r.error?'<div role="alert" class="mentor-note">'+esc(r.error)+' <button type="button" class="secondary" '+(r.busy?'disabled':'')+' onclick="'+(r.loaded?'retryMentorMessage()':'openMentorDialogue(this.dataset.dialogue)')+'" data-dialogue="'+esc(r.id)+'">'+(r.loaded?'Повторить':'Загрузить снова')+'</button></div>':'';
  return styles+header+'<div class="chat mentor-chat"><div id="aiMessages" class="messages">'+(r.messages.length?r.messages.map(m=>'<div class="msg '+(m.role==='assistant'?'client':'manager')+'"><b>'+(m.role==='assistant'?'AI':'Вы')+':</b> '+esc(m.content)+'</div>').join(''):'<div class="empty">Чем могу помочь? Например: «Как отработать возражение дорого?»</div>')+'</div>'+(r.busy?'<div role="status" class="mentor-note">AI готовит ответ… Можно открыть другой диалог.</div>':'')+error+(r.retry&&!r.error&&!r.busy?'<div class="mentor-note">Ответ ещё не получен. <button type="button" class="secondary" onclick="retryMentorMessage()">Проверить ответ</button></div>':'')+'<div class="composer"><label for="aiMsg" class="muted" style="width:100%">Сообщение наставнику</label><textarea id="aiMsg" rows="3" maxlength="5000" placeholder="Напишите вопрос AI…" oninput="setMentorDraft(this.value)" '+(!r.loaded||r.busy||r.retry?'disabled':'')+'>'+esc(r.draft)+'</textarea><button type="button" id="aiSend" class="primary" onclick="sendAiChat()" '+(!r.loaded||r.busy||r.retry?'disabled':'')+'>Отправить</button></div></div>';
 };
 window.setMentorDraft=value=>{sync();records.get(active).draft=value;};
 window.newMentorChat=function(){sync();historyOpen=false;draft();paint();document.getElementById('aiMsg')?.focus();};
 window.openMentorHistory=function(){sync();historyOpen=true;items=[];cursor=null;more=true;listError='';listBusy=false;listVersion++;window.loadMentorHistory();};
 window.loadMentorHistory=async function(){sync();if(listBusy)return;const version=listVersion,e=epoch;listBusy=true;listError='';paint();try{
  const query={select:'id,title,updated_at',owner_id:'eq.'+state.user.id,company_id:'eq.'+state.profile.company_id,order:'updated_at.desc,id.desc',limit:'30'};if(cursor)query.or='(updated_at.lt.'+cursor.updated_at+',and(updated_at.eq.'+cursor.updated_at+',id.lt.'+cursor.id+'))';const rows=await read(query);
  if(e!==epoch||owner!==scope()||version!==listVersion)return;
  if(!Array.isArray(rows))throw Error('Некорректный ответ истории.');
  const existing=new Set(items.map(x=>x.id));items.push(...rows.filter(x=>!existing.has(x.id)));if(rows.length)cursor=rows.at(-1);more=rows.length>0;
 }catch(error){if(e===epoch&&version===listVersion)listError=error.message;}finally{if(e===epoch&&version===listVersion){listBusy=false;paint();}}};
 window.openMentorDialogue=async function(id){
  sync();historyOpen=false;let r=records.get(id);if(r?.busy){active=id;paint(true);return;}
  if(!r){r={id,created:true,loaded:false,messages:[],draft:'',busy:false,error:'',retry:null};records.set(id,r);}active=id;r.loading=true;r.error='';const e=epoch,loadVersion=(r.loadVersion||0)+1;r.loadVersion=loadVersion;paint();
  try{const rows=await read({select:'*',id:'eq.'+id,owner_id:'eq.'+state.user.id,company_id:'eq.'+state.profile.company_id});if(!current(r,e)||r.loadVersion!==loadVersion)return;const row=rows?.[0];if(!row)throw Error('Диалог недоступен.');r.messages=Array.isArray(row.messages)?row.messages:[];r.loaded=true;r.created=true;r.retry=row.status!=='ready'&&row.current_request_id?{request_id:row.current_request_id,message:row.request_content}:null;
  }catch(error){if(current(r,e)&&r.loadVersion===loadVersion){r.error=['TimeoutError','AbortError'].includes(error.name)?'Сервер не ответил вовремя. Повторите запрос.':error.message;r.loaded=false;}}finally{if(current(r,e)&&r.loadVersion===loadVersion){r.loading=false;if(active===r.id)paint(true);}}
 };
 async function send(r,retry=false){
  if(r.busy||!r.loaded)return;const e=epoch,request=retry?r.retry:{request_id:crypto.randomUUID(),message:r.draft.trim()};if(!request?.message)return;
  if(!retry){r.messages.push({role:'user',content:request.message,request_id:request.request_id});r.draft='';r.retry=request;}
  r.loadVersion=(r.loadVersion||0)+1;r.busy=true;r.error='';paint(true);
  try{
   if(!r.created){const {error}=await sb.rpc('create_mentor_dialogue',{p_id:r.id});if(error)throw Error('Не удалось создать диалог. Повторите отправку.');r.created=true;}
   if(!current(r,e))return;
   const t=await token(),response=await fetch(SUPABASE_URL+'/functions/v1/manager-ai-chat',{method:'POST',headers:{'Content-Type':'application/json',apikey:SUPABASE_KEY,Authorization:'Bearer '+t},body:JSON.stringify({dialogue_id:r.id,request_id:request.request_id,message:request.message,stats:state.stats||{},history:(state.history||[]).slice(0,20),profile:{first_name:state.profile?.first_name||'',role:state.profile?.role||'',company:state.company?.name||''}}),cache:'no-store',signal:AbortSignal.timeout(65000)});
   const result=await response.json().catch(()=>({}));if(!response.ok||!result.ok||typeof result.reply!=='string')throw Error(result.error||'Не удалось получить ответ. Повторите попытку.');
   if(!current(r,e))return;if(!r.messages.some(m=>m.role==='assistant'&&m.request_id===request.request_id))r.messages.push({role:'assistant',content:result.reply,request_id:request.request_id});r.retry=null;
  }catch(error){if(current(r,e))r.error=['TimeoutError','AbortError'].includes(error.name)?'Сервер не ответил вовремя. Повторите запрос.':error.message;}finally{if(current(r,e)){r.busy=false;if(active===r.id&&!historyOpen)paint(true);}}
 }
 window.sendAiChat=function(){sync();return send(records.get(active));};
 window.retryMentorMessage=function(){sync();return send(records.get(active),true);};
})();
