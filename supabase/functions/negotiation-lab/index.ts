import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.118.0";
import { withAiAccess } from "../_shared/ai-access.ts";
import { actOnLab, labText, labTranscript, newDeal, newReplay } from "../_shared/negotiation-lab.ts";
const labHeaders={"Access-Control-Allow-Origin":"*","Access-Control-Allow-Headers":"authorization, x-client-info, apikey, content-type","Access-Control-Allow-Methods":"POST, OPTIONS","Content-Type":"application/json; charset=utf-8","Cache-Control":"no-store"};
const json=(body:any,status=200)=>new Response(JSON.stringify(body),{status,headers:labHeaders});
const uuid=(v:any)=>typeof v==='string'&&/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(v);
async function ask(system:string,input:any){
 const key=labText(Deno.env.get('PROXYAPI_API_KEY')||Deno.env.get('PROXYAPI_KEY'),500).replace(/^Bearer\s+/i,'').replace(/^['"]|['"]$/g,'');
 if(!key)throw Error('ИИ временно недоступен. Повторите позже.');
 const base=labText(Deno.env.get('PROXYAPI_BASE_URL')||'https://api.proxyapi.ru/openai/v1',500).replace(/\/$/,'');
 const response=await fetch(base+'/chat/completions',{method:'POST',headers:{Authorization:'Bearer '+key,'Content-Type':'application/json'},signal:AbortSignal.timeout(45000),body:JSON.stringify({model:labText(Deno.env.get('PROXYAPI_MODEL')||'gpt-5.6-luna',120),messages:[{role:'system',content:system},{role:'user',content:JSON.stringify(input)}],response_format:{type:'json_object'},max_completion_tokens:2400})});
 if(!response.ok)throw Error('ИИ временно недоступен. Повторите запрос.');
 const data=await response.json(),text=String(data?.choices?.[0]?.message?.content||'').trim().replace(/^```(?:json)?\s*/i,'').replace(/\s*```$/,'');
 try{return JSON.parse(text);}catch{throw Error('Не удалось разобрать ответ ИИ. Повторите запрос.');}
}
Deno.serve(withAiAccess("negotiation-lab", async req=>{
 if(req.method==='OPTIONS')return new Response('ok',{headers:labHeaders});
 if(req.method!=='POST')return json({ok:false,error:'Метод не поддерживается.'},405);
 let admin:any,claim:any,claimed=false;
 try{
  const url=Deno.env.get('SUPABASE_URL')!,auth=req.headers.get('Authorization')||'';
  const db=createClient(url,Deno.env.get('SUPABASE_ANON_KEY')!,{global:{headers:{Authorization:auth}}});
  const {data:{user},error:authError}=await db.auth.getUser();if(authError||!user)return json({ok:false,error:'Войдите в аккаунт.'},401);
  const b=await req.json();if(!uuid(b.id)||!uuid(b.request_id)||!Number.isInteger(b.revision)||b.revision<0)return json({ok:false,error:'Некорректный запрос. Откройте попытку заново.'},400);
  const action=b.action;if(!['review','replay','deal','reply','advance','finish'].includes(action))return json({ok:false,error:'Неизвестное действие.'},400);
  const message=typeof b.message==='string'?b.message.trim():'';if(message.length>2000)return json({ok:false,error:'Реплика должна быть не длиннее 2000 символов.'},400);
  admin=createClient(url,Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
  const {data:existing,error:readError}=await db.from('negotiation_labs').select('*').eq('id',b.id).maybeSingle();if(readError)throw Error('Не удалось загрузить попытку.');
  if(existing&&existing.owner_id!==user.id)return json({ok:false,error:'Продолжать попытку может только её автор.'},403);
  if(!existing){
   let kind=action,state:any,key:string,source:string|null=null;
   if(action==='review'){
    if(!uuid(b.source_session_id))return json({ok:false,error:'Некорректная тренировка.'},400);
    const {data:s,error}=await db.from('saletrening_sessions').select('id,employee_id,company_id,scenario_id,status,transcript').eq('id',b.source_session_id).maybeSingle();
    if(error||!s||s.employee_id!==user.id)return json({ok:false,error:'Разобрать можно только собственную доступную тренировку.'},403);
    if(s.status!=='completed')return json({ok:false,error:'Сначала завершите тренировку.'},400);
    state={role:Number(s.scenario_id)>=19&&Number(s.scenario_id)<=33?'buyer':'manager',transcript:labTranscript(s.transcript),source_session_id:s.id,finished:false};source=s.id;key='review:'+s.id;
   }else if(action==='replay'){
    if(!uuid(b.review_id)||!Number.isInteger(b.moment))return json({ok:false,error:'Некорректный эпизод.'},400);
    const {data:r,error}=await db.from('negotiation_labs').select('*').eq('id',b.review_id).maybeSingle();
    if(error||!r||r.owner_id!==user.id||r.kind!=='review'||!r.data.finished)return json({ok:false,error:'Эпизод недоступен.'},403);
    state=newReplay({...r.data,id:r.id},b.moment);source=r.source_session_id;key='replay:'+r.id+':'+b.moment;
   }else if(action==='deal'){state=newDeal(b.role);key='deal:'+b.role;}
   else return json({ok:false,error:'Попытка недоступна.'},404);
   const created=await admin.rpc('create_negotiation_lab',{p_user_id:user.id,p_id:b.id,p_kind:kind,p_source_session_id:source,p_key:key,p_data:state});if(created.error)throw Error('Не удалось создать попытку. Повторите запрос.');
  }
  const payload={action,message,revision:b.revision,...(action==='review'?{source_session_id:b.source_session_id}:action==='replay'?{review_id:b.review_id,moment:b.moment}:action==='deal'?{role:b.role}:{})};
  claim={p_user_id:user.id,p_id:b.id,p_request_id:b.request_id};
  const {data:turn,error}=await admin.rpc('claim_negotiation_lab',{...claim,p_payload:payload});if(error)throw Error('Не удалось сохранить запрос. Повторите попытку.');
  if(turn?.state==='cached')return json({ok:true,lab:turn.lab,cached:true});
  if(turn?.state!=='claimed')return json({ok:false,error:({busy:'Ответ ещё формируется. Повторите проверку чуть позже.',conflict:'Попытка изменилась. Откройте её заново или повторите ожидающий запрос.',full:'Достигнут предел запросов. Начните новую попытку.',forbidden:'Попытка недоступна.'}[turn?.state]||'Некорректный запрос.')},turn?.state==='forbidden'?404:409);
  claimed=true;
  const next=await actOnLab(turn.lab.kind,turn.lab.data,action,message,ask);
  const saved=await admin.rpc('finish_negotiation_lab',{...claim,p_data:next});if(saved.error||!saved.data)throw Error('Не удалось сохранить результат. Повторите запрос.');
  claimed=false;return json({ok:true,lab:saved.data});
 }catch(e){if(claimed&&admin&&claim){try{await admin.rpc('finish_negotiation_lab',{...claim,p_data:null});}catch{}}
  console.error('negotiation-lab request failed');return json({ok:false,error:e instanceof Error?e.message:'Не удалось выполнить запрос. Повторите попытку.'},500);
 }
}));
