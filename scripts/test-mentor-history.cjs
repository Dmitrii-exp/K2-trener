const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const {stripTypeScriptTypes}=require('node:module');
const compile=p=>stripTypeScriptTypes(fs.readFileSync(p,'utf8')).replace(/^import .*;\s*$/gm,'').replace(/export /g,'');
const did='aaaaaaaa-1111-4111-8111-111111111111',rid='cccccccc-1111-4111-8111-111111111111';
async function run({claim='claimed',fail=false,leak=false,legacy=false}={}){
 let handler,providerCalls=0,payload,finished=[],claimArgs;
 const admin={rpc:async(name,args)=>{if(name==='claim_mentor_turn_with_files'){claimArgs=args;return {data:claim==='claimed'?{state:'claimed',messages:[{role:'user',content:'Сохранённый вопрос'}]}:claim==='cached'?{state:'cached',reply:'Сохранённый ответ'}:{state:claim}};}finished.push(args);return {data:true};}};
 const ctx={console:{error(){}},Request,Response,FormData,TextDecoder,Uint8Array,atob,btoa,AbortSignal,createClient:(url,key)=>key==='private'?admin:{auth:{getUser:async()=>({data:{user:{id:'verified-owner'}}})}},Deno:{env:{get:k=>({SUPABASE_URL:'https://db.test',SUPABASE_ANON_KEY:'public',SUPABASE_SERVICE_ROLE_KEY:'private',PROXYAPI_API_KEY:'test-provider-key'})[k]},serve:fn=>handler=fn},fetch:async(url,init)=>{
  if(url.endsWith('/auth/v1/user'))return Response.json({id:'verified-owner'});
  if(url.includes('/rpc/'))return Response.json({allowed:true});
  providerCalls++;payload=JSON.parse(init.body);return fail?Response.json({error:'upstream'},{status:503}):Response.json({choices:[{message:{content:leak?'OpenAI API':'Полезный ответ'}}]});
 }};vm.createContext(ctx);vm.runInContext(compile('supabase/functions/_shared/ai-access.ts')+'\n'+compile('supabase/functions/_shared/mentor-attachments.ts')+'\n'+compile('supabase/functions/_shared/mentor-history.ts')+'\n'+compile('supabase/functions/manager-ai-chat/index.ts'),ctx);
 const body={message:'Вопрос',owner_id:'forged-user',transcript:[{role:'assistant',text:'Чужая переписка'}],...(legacy?{}:{dialogue_id:did,request_id:rid})};
 const response=await handler(new Request('https://function.test',{method:'POST',headers:{Authorization:'Bearer user-token','Content-Type':'application/json'},body:JSON.stringify(body)}));return {status:response.status,result:await response.json(),providerCalls,payload,finished,claimArgs};
}
(async()=>{
 const normal=await run();assert.equal(normal.status,200);assert.equal(normal.providerCalls,1);assert.equal(normal.claimArgs.p_user_id,'verified-owner');assert.equal(normal.finished[0].p_reply,'Полезный ответ');assert.deepEqual(normal.payload.messages.slice(1),[{role:'user',content:'Сохранённый вопрос'}],'Persistent history only; no duplicated latest user turn or caller-forged transcript');
 const cached=await run({claim:'cached'});assert.equal(cached.providerCalls,0);assert.equal(cached.result.reply,'Сохранённый ответ');
 for(const claim of ['busy','forbidden','conflict','full']){const r=await run({claim});assert.equal(r.providerCalls,0);assert.ok([404,409].includes(r.status));}
 const failed=await run({fail:true});assert.equal(failed.status,500);assert.equal(failed.finished[0].p_reply,null,'Failed request can retry without duplicating persisted user message');
 const safe=await run({leak:true});assert.ok(!safe.finished[0].p_reply.includes('OpenAI'),'Stores sanitized displayed reply');
 const legacy=await run({legacy:true});assert.equal(legacy.status,200);assert.equal(legacy.finished.length,0,'Older cached client still works');
 console.log('PASS: verified identity, persisted-context isolation, cached/busy/forbidden/conflict/full without AI calls, save/failure lifecycle, sanitized stored reply and legacy compatibility. Provider mocked.');
})().catch(e=>{console.error(e);process.exitCode=1});
