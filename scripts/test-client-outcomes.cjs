const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const {stripTypeScriptTypes}=require('node:module');
const compile=path=>stripTypeScriptTypes(fs.readFileSync(path,'utf8')).replace(/^import .*;\s*$/gm,'').replace(/export (function|const) /g,'$1 ');
const shared=compile('supabase/functions/_shared/client-outcomes.ts');
const session='11111111-2222-4333-8444-555555555555';
let handler,payload,operation;
const context={console,Request,Response,FormData,TextDecoder,Uint8Array,atob,escape,decodeURIComponent,
 Deno:{env:{get:key=>({SUPABASE_URL:'https://db.test',SUPABASE_ANON_KEY:'public',SUPABASE_SERVICE_ROLE_KEY:'private',PROXYAPI_API_KEY:'test-provider-key'})[key]},serve:fn=>{handler=fn;}},
 fetch:async(url,init)=>{
  if(url.endsWith('/auth/v1/user'))return Response.json({id:'verified-manager'});
  if(url.includes('/rpc/')){operation=JSON.parse(init.body).p_operation;return Response.json({allowed:true});}
  payload=JSON.parse(init.body);return Response.json({choices:[{message:{content:'Ответ провайдера'}}]});
 }
};
vm.createContext(context);
vm.runInContext(compile('supabase/functions/_shared/ai-access.ts')+'\n'+shared+'\n'+compile('supabase/functions/_shared/supplier-behavior.ts')+'\n'+compile('supabase/functions/_shared/product-catalog-data.ts')+'\n'+compile('supabase/functions/_shared/product-catalog.ts')+'\n'+compile('supabase/functions/chat-client/index.ts'),context);
async function call(extra={}){
 const body={session_id:session,message:'Качество и применимость подтверждаем документацией. Кто отвечает за закупку?',scenario:{id:1,title:'Шины',client_role:'Техник',objective:'Обсудить качество шин'},transcript:[{speaker:'client',content:'За цену не отвечаю, оцениваю качество шин.'}],...extra};
 const result=await handler(new Request('https://function.test',{method:'POST',headers:{Authorization:'Bearer test-user','Content-Type':'application/json'},body:JSON.stringify(body)}));
 assert.equal(result.status,200);return payload.messages;
}
(async()=>{
 const messages=await call(),prompt=messages[0].content;
 assert.ok(prompt.includes('ПРАВИЛА ИСХОДА РАЗГОВОРА'));
 for(const text of ['Хорошо, отправляйте КП','Извините, но мне не интересно ваше предложение','88005353555','восемь, восемьсот, пятьсот тридцать пять, тридцать пять, пятьдесят пять','Не превращай техника в закупщика','не выдавай номер сразу после приветствия','не подтверждение заказа','не звони','не отправляй сообщения'])assert.ok(prompt.includes(text),text);
 for(const metric of ['Пробег на ведущей оси составил 180 тысяч километров.', 'По нашему опыту получается 0,28 рубля на километр.']){
  const dialogue=await call({message:metric});
  assert.ok(dialogue.at(-1).content.includes(metric));
  const policy=dialogue[0].content;
  assert.ok(policy.includes('одной такой цифры в разговоре достаточно'));
  assert.ok(policy.includes('Не требуй второй показатель, официальные данные'));
  assert.ok(policy.includes('Не откладывай КП'));
 }
 assert.equal(operation,'reply');assert.ok(messages.some(m=>m.content.includes('За цену не отвечаю')),'Preserves actual authority and conversation');
 assert.ok(!prompt.includes('Хорошо, оформляем'),'Conflicting purchase example removed');
 const opened=await call({opening:true,message:''});assert.ok(opened.at(-1).content.includes('Менеджер должен говорить первым'));
 for(const extra of [{client_settings:{mode:'manager_chat'}},{mode:'manager_chat'},{scenario:{id:19,title:'Переговоры закупщика'}}]){
  const other=await call(extra);assert.ok(!other[0].content.includes('ПРАВИЛА ИСХОДА РАЗГОВОРА'),'Mentor and supplier roles keep their existing workflow');
 }
 const sizeQuestion='Какие типоразмеры вас интересуют?';
 const sizing=(await call({message:sizeQuestion,transcript:[]}))[0].content;
 for(const size of ['315/70 R22.5','385/65 R22.5','315/80 R22.5']) assert.ok(sizing.includes(size),size);
 const openingPrice='По какой цене вы сейчас покупаете 315/70 R22.5?';
 const first=(await call({message:openingPrice,transcript:[{speaker:'manager',content:openingPrice}]}))[0].content;
 assert.ok(first.includes('впервые спрашивает закупочную цену'));
 assert.ok(!first.includes('"price_rub":'),'first purchase-price question has no catalogue prices');
 const pricingHistory=[{speaker:'manager',content:openingPrice},{speaker:'client',content:'Покажите сначала своё предложение.'}];
 const compared=(await call({message:'Сколько платите за RoadX HD780 315/70?',transcript:pricingHistory}))[0].content;
 const prices=JSON.parse(compared.split('КОНЕЦ СПРАВОЧНИКА.')[0].trim().split('\n').at(-1));
 assert.ok(prices.length>0&&prices.every(row=>row.name.includes('315/70')));
 assert.ok(prices.some(row=>row.name.includes('RoadX HD780')&&row.price_rub===31500));
 const unavailable=(await call({message:'Сколько платите за 999/99 R22.5?',transcript:pricingHistory}))[0].content;
 assert.ok(!unavailable.includes('"price_rub":'),'another size must never supply a substitute price');
 const supplier={console};vm.createContext(supplier);vm.runInContext(compile('supabase/functions/_shared/supplier-behavior.ts'),supplier);
 let previous=[];
 for(let i=0;i<80;i++){const r=supplier.buildSupplierBehavior({recent_persona_ids:previous},()=>((i*7)%36)/36);assert.ok(!previous.includes(r.persona.id));previous=[...previous,r.persona.id].slice(-20);}
 const seller=supplier.buildSupplierBehavior({persona_id:'sp1-1-2',difficulty:'Сложный',session_id:'session'});const sellerAgain=supplier.buildSupplierBehavior({persona_id:'sp1-1-2',difficulty:'Сложный',session_id:'session'},()=>0.99);assert.equal(seller.instructions,sellerAgain.instructions);assert.ok(seller.instructions.includes('"max_discount_percent":2'));assert.ok(!seller.instructions.includes('ПРАВИЛА ИСХОДА РАЗГОВОРА'));
 const live={console};vm.createContext(live);vm.runInContext(shared+'\n'+compile('supabase/functions/_shared/cold-call-behavior.ts'),live);
 const technician={persona_id:'cc2-2-6-1',facts:'Техник отвечает за качество, а не цену. Нужны грузовые шины.',difficulty:'Сложный'};
 const one=live.buildColdCallBehavior(technician,()=>0),again=live.buildColdCallBehavior(technician,()=>0.99);
 assert.equal(one.instructions,again.instructions,'Reconnect retains role, contact and outcome rules');
 assert.ok(one.instructions.includes('оплату согласует другой сотрудник'));
 assert.ok(one.instructions.includes(prompt.slice(prompt.indexOf('ПРАВИЛА ИСХОДА РАЗГОВОРА')).trim()),'Voice and text share exactly the same outcome contract');
 console.log('PASS: actual text handler receives outcome contract and transcript; opening/mentor/supplier boundaries; voice authority, fixed contact and reconnect continuity. Provider responses are mocked; model decisions are not asserted.');
})().catch(e=>{console.error(e);process.exitCode=1;});
