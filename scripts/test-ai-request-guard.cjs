const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const { stripTypeScriptTypes } = require('node:module');
const source = stripTypeScriptTypes(fs.readFileSync('supabase/functions/_shared/ai-access.ts','utf8')).replace('export function withAiAccess','function withAiAccess');
const id = '11111111-2222-4333-8444-555555555555';

async function run(options = {}) {
  let providerCalls = 0, gateCalls = 0, received = null, originalBody = null;
  const context = { Request, Response, FormData, TextDecoder, Uint8Array, atob, console,
    Deno: { env: { get: key => ({ SUPABASE_URL:'https://project.example', SUPABASE_ANON_KEY:'public-test', SUPABASE_SERVICE_ROLE_KEY:'private-test' })[key] } },
    fetch: async (url, init) => {
      if (url.endsWith('/auth/v1/user')) return new Response(JSON.stringify({id:'verified-user'}),{status:options.authStatus || 200});
      gateCalls++; received = JSON.parse(init.body);
      assert.equal(received.p_user_id,'verified-user','Client supplied another identity');
      return new Response(JSON.stringify(options.access || { allowed:true }), { status:options.rpcStatus || 200 });
    }
  };
  vm.runInNewContext(source, context);
  const handler = context.withAiAccess(options.slug || 'chat-client', async req => { providerCalls++; originalBody = await req.text(); return new Response('provider-response'); });
  const body = options.body || { session_id:id, message:'Здравствуйте',user_id:'attacker-selected-user' };
  const request = new Request('https://function.example',{ method:'POST', headers:{Authorization:options.noAuth ? '' : 'Bearer valid-user',...(options.form ? {} : {'Content-Type':'application/json'})}, body:options.form || JSON.stringify(body) });
  const response = await handler(request);
  return { status:response.status, text:await response.text(), providerCalls, gateCalls, received, originalBody };
}

(async()=>{
  let r=await run();assert.equal(r.status,200);assert.equal(r.providerCalls,1);assert.equal(r.received.p_operation,'reply');assert.equal(r.received.p_session_id,id);assert.ok(r.originalBody.includes('Здравствуйте'));
  for(const options of [{noAuth:true},{authStatus:401},{access:{allowed:false,status:402,reason:'subscription_required'}},{access:{allowed:false,status:403,reason:'training_required'}},{access:{allowed:false,status:429,reason:'request_limit'}},{rpcStatus:500},{authStatus:500}]){
    r=await run(options);assert.equal(r.providerCalls,0);assert.ok([401,402,403,429,503].includes(r.status));
  }
  r=await run({access:{allowed:true,cached_evaluation:{overall_score:85}},slug:'evaluate-session-v3'});assert.equal(r.providerCalls,0);assert.equal(JSON.parse(r.text).evaluation.overall_score,85);
  r=await run({body:{session_id:'invalid'}});assert.equal(r.status,400);assert.equal(r.gateCalls,0);
  r=await run({body:{client_settings:{mode:'manager_chat'}}});assert.equal(r.received.p_operation,'mentor');
  const encoded=Buffer.from(JSON.stringify({mode:'manager_chat'})).toString('base64');
  r=await run({body:{scenario:{system_prompt:'AI_CLIENT_SETTINGS_V3_JSON:'+encoded}}});assert.equal(r.received.p_operation,'mentor');
  const form=new FormData();form.set('session_id',id);form.set('file',new Blob(['audio']),'speech.webm');
  r=await run({slug:'proxy-stt',form});assert.equal(r.received.p_operation,'stt');assert.equal(r.received.p_session_id,id);assert.ok(r.originalBody.includes('audio'));
  r=await run({slug:'gpt-live-session',body:{sdp:'offer',session:{voice:'test'}}});assert.equal(r.received.p_operation,'live');assert.equal(r.received.p_session_id,null);
  for(const slug of ['ai-client','chat-client-v12','chat-client-v13','chat-client-v39','yandex-chat-client']){r=await run({slug});assert.equal(r.received.p_operation,'reply');}
  for(const slug of ['yandex-test','speechkit-test']){r=await run({slug});assert.equal(r.received.p_operation,'diagnostic');}
  const targets=['evaluate-session','chat-client','ai-client','chat-client-v12','chat-client-v13','yandex-test','yandex-chat-client','chat-client-v39','yandex-tts','speechkit-test','manager-ai-chat','evaluate-session-v2','evaluate-session-v3','proxy-stt','proxy-tts','gpt-live-session'];
  for(const slug of targets){const text=fs.readFileSync('supabase/functions/'+slug+'/index.ts','utf8');assert.ok(text.includes('Deno.serve(withAiAccess("'+slug+'", '),slug+' lacks the gate');stripTypeScriptTypes(text);}
  console.log('PASS: real-user identity, entitlement denial before AI, fail-closed errors, cached evaluation, legacy aliases, multipart integrity, all 16 handlers gated');
})().catch(e=>{console.error(e);process.exitCode=1});
