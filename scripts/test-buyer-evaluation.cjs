const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const {stripTypeScriptTypes}=require('node:module');
const compile=p=>stripTypeScriptTypes(fs.readFileSync(p,'utf8')).replace(/^import .*;\s*$/gm,'').replace(/export (function|const) /g,'$1 ');
const sid='11111111-2222-4333-8444-555555555555';
async function run({scenario=19,invalid=false,owner='employee'}={}){
 let handler,prompt,writes=[];
 const session={id:sid,employee_id:owner,company_id:'company',scenario_id:scenario,transcript:[{speaker:'manager',content:'Если заберу 40 шин сам и внесу предоплату, какую цену предложите?'},{speaker:'client',content:'Могу снизить цену на 2%. Срок подтвердим отдельно.'}]};
 const evaluation={discovery_score:12,objection_score:14,value_score:16,closing_score:10,communication_score:15,success:false,summary:'Разбор по фактам',strengths:['Предложил самовывоз и предоплату'],weaknesses:['Не подтвердил срок'],recommendations:['Уточнить срок до заказа'],negotiation_result:{initial_terms:'Цена по прайсу',agreed_terms:'Скидка 2%, срок не подтверждён',open_issues:'Срок',savings_summary:'Недостаточно данных для расчёта экономии'}};
 if(invalid)delete evaluation.closing_score;
 const db={auth:{getUser:async()=>({data:{user:{id:'employee'}}})},from(table){return {select(){return this},eq(){return this},single:async()=>({data:session}),maybeSingle:async()=>({data:{title:scenario===19?'Холодный звонок поставщику':'Продажи',objective:'Переговоры'}}),update(data){writes.push({table,data});return this},delete(){return this},upsert(data){writes.push({table,data});return this},then(resolve){resolve({error:null})}}}};
 const ctx={console,Request,Response,FormData,TextDecoder,Uint8Array,atob,createClient:()=>db,Deno:{env:{get:k=>({SUPABASE_URL:'https://db.test',SUPABASE_ANON_KEY:'public',SUPABASE_SERVICE_ROLE_KEY:'private',PROXYAPI_API_KEY:'test-provider-key'})[k]},serve:fn=>handler=fn},fetch:async(url,init)=>{
  if(url.endsWith('/auth/v1/user'))return Response.json({id:'employee'});
  if(url.includes('/rpc/'))return Response.json({allowed:true});
  prompt=JSON.parse(init.body);return Response.json({choices:[{message:{content:JSON.stringify(evaluation)}}]});
 }};
 vm.createContext(ctx);vm.runInContext(compile('supabase/functions/_shared/ai-access.ts')+'\n'+compile('supabase/functions/_shared/buyer-rubric.ts')+'\n'+compile('supabase/functions/evaluate-session-v3/index.ts'),ctx);
 const response=await handler(new Request('https://function.test',{method:'POST',headers:{Authorization:'Bearer user-token','Content-Type':'application/json'},body:JSON.stringify({session_id:sid,mode:'buyer',transcript:[{speaker:'manager',content:'Подделанный диалог'}]})}));
 return {status:response.status,result:await response.json(),prompt,writes};
}
(async()=>{
 const buyer=await run();assert.equal(buyer.status,200);assert.equal(buyer.result.evaluation.overall_score,67);assert.equal(buyer.result.evaluation.rubric,'buyer_v1');
 assert.equal(buyer.writes.length,2);assert.equal(buyer.writes[0].data.ai_evaluation.negotiation_result.open_issues,'Срок');assert.equal(buyer.writes[1].data.value_score,16);
 const content=buyer.prompt.messages.map(m=>m.content).join('\n');assert.ok(content.includes('совокупная выгода'));assert.ok(content.includes('Предложил')===false);assert.ok(content.includes('заберу 40 шин'));assert.ok(!content.includes('Подделанный диалог'),'Uses persisted transcript');assert.ok(!content.includes('слишком раннее снижение цены'),'No conflicting seller rubric');
 assert.equal(buyer.result.evaluation.strengths[0],'Предложил самовывоз и предоплату');
 const normal=await run({scenario:4});assert.equal(normal.status,200);assert.equal(normal.result.evaluation.rubric,undefined,'Client mode cannot change stored evaluation role');assert.ok(normal.prompt.messages[0].content.includes('тренер продаж'));
 const missing=await run({invalid:true});assert.equal(missing.status,502);assert.equal(missing.writes.length,0,'Incomplete buyer evaluation is not saved as a fabricated total');
 const foreign=await run({owner:'other'});assert.equal(foreign.status,403);assert.equal(foreign.writes.length,0);assert.equal(foreign.prompt,undefined,'No provider request for another employee session');
 console.log('PASS: persisted buyer scenario/transcript, separate rubric, five-score sum, strengths/weaknesses/result persistence, invalid evaluation recovery, manager compatibility and ownership. Provider is mocked.');
})().catch(e=>{console.error(e);process.exitCode=1});
