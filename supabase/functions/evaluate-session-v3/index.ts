import { withAiAccess } from "../_shared/ai-access.ts";
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

const cors={"Access-Control-Allow-Origin":"*","Access-Control-Allow-Headers":"authorization, x-client-info, apikey, content-type","Access-Control-Allow-Methods":"POST, OPTIONS"};
const json=(b:unknown,s=200)=>new Response(JSON.stringify(b),{status:s,headers:{...cors,"Content-Type":"application/json"}});
const c=(v:unknown,m=12000)=>String(v??"").trim().slice(0,m);
const skill=(v:any)=>{const n=Number(v);return Number.isFinite(n)&&n>=1&&n<=20?Math.round(n):null};
function key(){return c(Deno.env.get("PROXYAPI_API_KEY")||Deno.env.get("PROXYAPI_KEY")||"").replace(/^Bearer\s+/i,"").trim()}
async function ask(messages:any[]){
  const k=key();if(!k)throw Error("ProxyAPI API key is missing in Supabase Secrets (PROXYAPI_API_KEY)");
  const base=c(Deno.env.get("PROXYAPI_BASE_URL")||"https://api.proxyapi.ru/openai/v1").replace(/\/$/,"");
  const model=c(Deno.env.get("PROXYAPI_MODEL")||"gpt-5.6-luna");
  const r=await fetch(`${base}/chat/completions`,{method:"POST",headers:{"Content-Type":"application/json",Authorization:`Bearer ${k}`},body:JSON.stringify({model,messages,max_completion_tokens:2400,prompt_cache_key:"saletrening-evaluation-v2"})});
  const t=await r.text();let d:any;try{d=JSON.parse(t)}catch{d=null}
  if(!r.ok)throw Error(`ProxyAPI HTTP ${r.status}: ${d?.error?.message||d?.message||t.slice(0,1000)}`);
  const text=d?.choices?.[0]?.message?.content||"";if(!c(text))throw Error("ProxyAPI returned an empty evaluation");return {text:c(text),model};
}
function pj(s:string){const x=s.trim().replace(/^```json\s*/i,"").replace(/^```\s*/i,"");try{return JSON.parse(x)}catch{const a=x.indexOf("{"),b=x.lastIndexOf("}");if(a>=0&&b>a)try{return JSON.parse(x.slice(a,b+1))}catch{}return null}}
function cleanList(v:any,max=5){return Array.isArray(v)?v.map((x:any)=>c(x,1000)).filter(Boolean).slice(0,max):[]}

Deno.serve(withAiAccess("evaluate-session-v3", async req=>{
  if(req.method==="OPTIONS")return new Response("ok",{headers:cors});
  if(req.method!=="POST")return json({ok:false,error:"Method not allowed"},405);
  try{
    const auth=req.headers.get("Authorization");if(!auth)return json({ok:false,error:"Authorization required"},401);
    const url=Deno.env.get("SUPABASE_URL")!,anon=Deno.env.get("SUPABASE_ANON_KEY")!,service=Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const db=createClient(url,anon,{global:{headers:{Authorization:auth}}});
    const {data:{user}}=await db.auth.getUser();if(!user)return json({ok:false,error:"Unauthorized"},401);
    const body=await req.json(),sid=c(body.session_id,120);
    const {data:s,error}=await db.from("saletrening_sessions").select("id,employee_id,company_id,scenario_id,transcript").eq("id",sid).single();
    if(error||!s)return json({ok:false,error:"Session not found"},404);
    if(s.employee_id!==user.id)return json({ok:false,error:"Forbidden"},403);
    const tr=Array.isArray(s.transcript)?s.transcript:[];if(!tr.length)return json({ok:false,error:"Session transcript is empty"},400);const managerTurns=tr.filter((m:any)=>["manager","user","employee"].includes(String(m?.speaker||m?.role||"").toLowerCase())&&c(m?.content??m?.text??m?.message));if(!managerTurns.length){const admin=createClient(url,service),now=new Date().toISOString();await admin.from("session_scores").delete().eq("session_id",sid);const {error:ue}=await admin.from("saletrening_sessions").update({total_score:null,ai_summary:"Недостаточно данных для честной оценки: в сохранённом диалоге нет ни одной реплики менеджера.",ai_evaluation:null,feedback:"Оценка не сформирована: нет реплик менеджера.",status:"insufficient_data",completed_at:now,updated_at:now}).eq("id",sid).eq("employee_id",user.id);if(ue)return json({ok:false,error:ue.message},500);return json({ok:true,scored:false,reason:"no_manager_messages"});}
    const {data:scenario}=await db.from("saletrening_scenarios").select("title,description,objective,objections").eq("id",s.scenario_id).maybeSingle();
    const title=c(scenario?.title),free=/свобод|free/i.test(title);

    const prompt=`Ты профессиональный тренер по продажам. Твоя задача — НЕ просто поставить оценки, а внимательно разобрать КАЖДУЮ реплику менеджера и клиента и на основании фактического диалога составить персональный разбор менеджера.

${free?"Это СВОБОДНАЯ тренировка: оцени разговор целиком.":"Это ОБЫЧНАЯ целевая тренировка: учитывай цель сценария и выбранные возражения, но анализируй весь фактический диалог."}

КРИТИЧЕСКИ ВАЖНО:
1. strengths и weaknesses ОБЯЗАТЕЛЬНО должны быть заполнены, если в диалоге есть хотя бы 1 реплика менеджера.
2. Дай обычно 3-5 сильных сторон и 3-5 слабых сторон. Не пиши общие фразы вроде «хорошо общался» без доказательства.
3. Каждая сильная/слабая сторона должна описывать КОНКРЕТНОЕ действие менеджера, видимое в диалоге. Можно кратко привести его формулировку в кавычках.
4. Слабые стороны ищи, в частности: слишком раннее снижение цены/скидка без выяснения причины, грубость или давление, спор с клиентом, перебивание, игнорирование вопроса, отсутствие вопросов о потребности, презентация характеристик вместо выгод, отсутствие аргументации цены, преждевременная цена, уступка без обмена, отсутствие следующего шага, попытка закрыть сделку слишком рано, слабая работа с возражением, повторение одного аргумента, потеря инициативы.
5. Сильные стороны ищи, в частности: не называл цену до выяснения потребности, задавал уточняющие вопросы, выявил мотив/проблему, удерживал внимание, использовал выгоду вместо характеристики, спокойно отработал возражение, не спорил, аргументировал цену, подтвердил понимание клиента, сделал резюме, предложил следующий шаг, получил обязательство клиента.
6. Если конкретного поведения не было, НЕ выдумывай его. Но не оставляй массивы пустыми только потому, что поведение было смешанным: укажи реально наблюдаемые плюсы и минусы.
7. Рекомендации должны быть практическими: что именно менеджеру изменить в следующем разговоре и как лучше сформулировать.
8. Оценивай только наблюдаемое поведение менеджера. Не приписывай ему намерения.

ШКАЛА: пять навыков по 1-20: выявление потребности, работа с возражениями, презентация ценности, закрытие, коммуникация. 1 — очень плохо; 13-16 — хорошо; 17-20 — отлично. Общий балл = сумма пяти навыков (5-100).

success=true только если клиент явно готов купить/оформить, просит счет/договор/реквизиты либо подтверждает заказ.

Верни ТОЛЬКО валидный JSON без markdown и без комментариев строго такого вида:
{
  "overall_score": 0,
  "discovery_score": 0,
  "objection_score": 0,
  "value_score": 0,
  "closing_score": 0,
  "communication_score": 0,
  "success": false,
  "outcome": "краткий фактический результат разговора",
  "summary": "краткий профессиональный вывод",
  "strengths": ["конкретная сильная сторона №1 с доказательством из диалога", "конкретная сильная сторона №2"],
  "weaknesses": ["конкретная слабая сторона №1 с доказательством из диалога", "конкретная слабая сторона №2"],
  "recommendations": ["конкретная рекомендация №1", "конкретная рекомендация №2"]
}

Сценарий:
${JSON.stringify({title,description:scenario?.description,objective:scenario?.objective,objections:scenario?.objections})}

ПОЛНЫЙ ДИАЛОГ (анализируй его фактически, реплика за репликой):
${JSON.stringify(tr)}`;

    const r=await ask([{role:"system",content:"Строгий профессиональный тренер продаж. Анализируй только факты из диалога. Всегда возвращай валидный JSON. strengths и weaknesses не должны быть пустыми при наличии реплик менеджера."},{role:"user",content:prompt}]);
    const p=pj(r.text);if(!p)return json({ok:false,error:"Invalid ProxyAPI JSON"},502);
    const skills={discovery_score:skill(p.discovery_score),objection_score:skill(p.objection_score),value_score:skill(p.value_score),closing_score:skill(p.closing_score),communication_score:skill(p.communication_score)};
    const total=Object.values(skills).reduce((a,b)=>a+b,0);
    const strengths=cleanList(p.strengths),weaknesses=cleanList(p.weaknesses),recommendations=cleanList(p.recommendations);
    const ev={overall_score:Math.max(5,Math.min(100,total)),...skills,success:Boolean(p.success),outcome:c(p.outcome,500),summary:c(p.summary,5000),strengths,weaknesses,recommendations};
    const admin=createClient(url,service),now=new Date().toISOString();
    const {error:ue}=await admin.from("saletrening_sessions").update({total_score:ev.overall_score,ai_summary:ev.summary,ai_evaluation:ev,feedback:ev.summary,status:"completed",completed_at:now,updated_at:now}).eq("id",sid).eq("employee_id",user.id);
    if(ue)return json({ok:false,error:ue.message},500);
    const {error:se}=await admin.from("session_scores").upsert({session_id:sid,employee_id:user.id,company_id:s.company_id,overall_score:ev.overall_score,discovery_score:skills.discovery_score,objection_score:skills.objection_score,value_score:skills.value_score,closing_score:skills.closing_score,communication_score:skills.communication_score,strengths,weaknesses,recommendations},{onConflict:"session_id"});
    if(se)return json({ok:false,error:`Session score save failed: ${se.message}`},500);
    return json({ok:true,provider:"proxyapi",model:r.model,evaluation:ev});
  }catch(e){return json({ok:false,error:e instanceof Error?e.message:String(e)},500)}
}));
