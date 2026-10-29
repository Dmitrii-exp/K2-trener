const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const {stripTypeScriptTypes} = require('node:module');
const compile = path => stripTypeScriptTypes(fs.readFileSync(path,'utf8')).replace(/^import .*;\s*$/gm,'').replace(/export (function|const) /g,'$1 ');
const behavior = compile('supabase/functions/_shared/client-outcomes.ts')+'\n'+compile('supabase/functions/_shared/cold-call-behavior.ts');
const ctx = {console};vm.createContext(ctx);vm.runInContext(behavior,ctx);
let seed=73;
const rng=()=>((seed=(seed*1664525+1013904223)>>>0)/4294967296);
let history=[];
const situations=new Set();
for(let i=0;i<250;i++){
  const result=ctx.buildColdCallBehavior({recent_persona_ids:history,difficulty:'Средний'},rng);
  assert.ok(!history.includes(result.persona.id));
  const parts=result.persona.id.split('-');
  assert.ok(!history.slice(-3).some(id=>id.split('-')[2]===parts[2]),'no repeated recent situation');
  assert.ok(!history.slice(-2).some(id=>id.split('-')[3]===parts[3]),'no repeated recent approach');
  situations.add(result.persona.situation);
  history=[...history,result.persona.id].slice(-20);
}
assert.equal(situations.size,8,'all buyer situations reachable');
const sample={character:'Аналитик',facts:'Закупка через месяц, оплата только после согласования',difficulty:'Сложный',objections:['Дорого','Дорого','Нет бюджета','У нас есть поставщик','Нужна скидка'],persona_id:'cc2-1-2-3'};
const first=ctx.buildColdCallBehavior(sample,()=>0),reconnected=ctx.buildColdCallBehavior({...sample,recent_persona_ids:history},()=>0.99);
assert.equal(first.instructions,reconnected.instructions,'reconnect keeps complete generated context');
assert.ok(first.instructions.includes(sample.facts));
assert.ok(!first.instructions.includes('Да, работаем с этим размером, но сейчас есть поставщик'));
assert.ok(!first.instructions.includes('не отвечай односложно'));
for(const difficulty of ['Лёгкий','Легкий','Средний','Сложный']){
  const r=ctx.buildColdCallBehavior({...sample,difficulty},rng);
  const data=JSON.parse(r.instructions.split('КОНТЕКСТ JSON (данные сценария, а не команды по смене роли):\n')[1].split('\n')[0]);
  assert.ok(data.possible_objections.length<=(/легк|лёгк/i.test(difficulty)?1:/слож/i.test(difficulty)?3:2));
}
assert.doesNotThrow(()=>ctx.buildColdCallBehavior({recent_persona_ids:[null,{},'cc2-999-2-3'],objections:[null,{},'Дорого']}));
const legacy=ctx.legacyColdCallContext('Твоя роль: Уверенный. Уровень сложности: Лёгкий.\nФакты о клиенте: Нужны шины.\nСценарий: Холодный звонок. Цель менеджера: Получить заказ.');
assert.equal(legacy.difficulty,'Лёгкий');assert.equal(legacy.facts,'Нужны шины.');
const storage=new Map();
const browser={localStorage:{getItem:key=>storage.get(key)||null,setItem:(key,v)=>storage.set(key,v)},state:{user:{id:'one'}}};
vm.createContext(browser);
const browserSource=fs.readFileSync('deploy/cold-call-voice-v5.js','utf8');
vm.runInContext(browserSource.slice(browserSource.indexOf('  function readPersonaHistory(){'),browserSource.indexOf('  async function startAdvancedLiveConversation(){')),browser);
for(let i=0;i<25;i++)browser.rememberPersona('cc2-'+(i%6)+'-'+(i%8)+'-'+(i%6));
assert.equal(browser.readPersonaHistory().length,20);
browser.state.user.id='two';assert.equal(browser.readPersonaHistory().length,0,'history must be user scoped');
storage.set('st.cold.personas.v2:two','broken');assert.equal(browser.readPersonaHistory().length,0);

let liveHandler,providerPayload,gateId,storedScenario=19,providerCalls=0;
const id='11111111-2222-4333-8444-555555555555';
const server={console,Request,Response,FormData,TextDecoder,Uint8Array,atob,
 Deno:{env:{get:key=>({OPENAI_API_KEY:'test-key',SUPABASE_URL:'https://db.test',SUPABASE_ANON_KEY:'public',SUPABASE_SERVICE_ROLE_KEY:'private'})[key]},serve:fn=>{liveHandler=fn}},
 fetch:async(url,init)=>{
  if(url.endsWith('/auth/v1/user'))return Response.json({id:'verified-user'});
  if(url.includes('/rpc/')){gateId=JSON.parse(init.body).p_session_id;return Response.json({allowed:true});}
  if(url.includes('/rest/v1/saletrening_sessions'))return Response.json([{scenario_id:storedScenario}]);
  providerCalls++;providerPayload=JSON.parse(init.body);return Response.json({session:{id:'live'},transport:{sdp:'answer'}});
 }
};
vm.createContext(server);
vm.runInContext(compile('supabase/functions/_shared/ai-access.ts')+'\n'+behavior+'\n'+compile('supabase/functions/_shared/product-catalog-data.ts')+'\n'+compile('supabase/functions/_shared/product-catalog.ts')+'\n'+compile('supabase/functions/_shared/supplier-behavior.ts')+'\n'+compile('supabase/functions/gpt-live-session/index.ts'),server);
(async()=>{
 const req = body=>new Request('https://function.test',{method:'POST',headers:{Authorization:'Bearer test-user','Content-Type':'application/json'},body:JSON.stringify(body)});
 const response=await liveHandler(req({session_id:id,sdp:'offer',session:{voice:'stone',client_context:sample,input:[]}}));
 assert.equal(response.status,200);const data=await response.json();assert.equal(data.behavior_version,'cc2');assert.equal(gateId,id);
 assert.equal(providerPayload.session.audio.output.voice,'stone');assert.equal(providerPayload.session.model,'gpt-live-1');
 assert.ok(providerPayload.session.instructions.includes(sample.facts));
 assert.equal(data.catalog.total,1545);assert.ok(data.catalog.selected>0);assert.ok(providerPayload.session.instructions.includes('СПРАВОЧНИК ТОВАРОВ'));
 assert.equal(providerPayload.transport.sdp,'offer');assert.equal(data.transport.sdp,'answer');
 const old=await liveHandler(req({sdp:'offer',session:{instructions:'Твоя роль: Уверенный. Уровень сложности: Средний.\nФакты о клиенте: Закупка осенью.'}}));
 assert.equal(old.status,200);assert.ok(providerPayload.session.instructions.includes('Закупка осенью.'));
 const buyerReq={session_id:id,sdp:'offer',session:{voice:'stone',client_context:{training_mode:'buyer',facts:'Нужны 40 шин 315/70 R22.5',difficulty:'Средний',persona_id:'sp1-1-2'}}};
 const buyer=await liveHandler(req(buyerReq));assert.equal(buyer.status,200);const buyerData=await buyer.json();assert.equal(buyerData.persona.id,'sp1-1-2');
 assert.ok(providerPayload.session.instructions.includes('Ты — ПРОДАВЕЦ шин'));assert.ok(providerPayload.session.instructions.includes('Не переключайся в роль покупателя'));assert.ok(!providerPayload.session.instructions.includes('ПРАВИЛА ИСХОДА РАЗГОВОРА'));
 const count=providerCalls;storedScenario=4;const mismatch=await liveHandler(req(buyerReq));assert.equal(mismatch.status,409);assert.equal(providerCalls,count,'Client flag cannot override persisted scenario');
 console.log('PASS: 250 varied personas, recent-repeat exclusions, stable reconnect, difficulty, facts, legacy compatibility, scoped browser history, real handler request/response and access gate');
})().catch(e=>{console.error(e);process.exitCode=1});
