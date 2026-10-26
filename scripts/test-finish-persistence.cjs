// Execute the deployed hangup handler against the database's immutable-field contract.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');
const source = fs.readFileSync(path.join(__dirname, '../deploy/cold-call-voice-v5.js'), 'utf8');
const handler = source.slice(source.indexOf('  async function finish(){'), source.indexOf('  async function launchColdCall(){'));
async function run(code, validConversation = true) {
  const messages = [{speaker:'manager',content:'Нужны шины'}];
  if (validConversation) messages.push({speaker:'client',content:'Какой размер?'});
  const writes=[], errors=[], events=[];
  const context = {state:{session:{id:'session'},user:{id:'employee'},messages}, processing:false,
    startedAt:Date.now()-272000, flushLiveTranscriptBuffers(){}, setStatus(){}, cleanup(){},
    showFinishOverlay(){return ()=>events.push('dismiss')},
    console:{error(...args){errors.push(args)},info(){}},
    setTimeout(fn){fn()},
    sb:{from(){return {update(payload){writes.push(payload);return {eq(){return this},select(){
      // Same field allowlist as protect_saletrening_session_fields().
      const denied=Object.keys(payload).some(k=>!['transcript','updated_at'].includes(k));
      return Promise.resolve(denied?{error:{message:'session_server_fields_immutable'}}:{data:[{id:'session'}]});
    }}}}},auth:{async getSession(){return {data:{session:{access_token:'token'}}}}}},
    SUPABASE_URL:'https://example.test',SUPABASE_KEY:'public',
    async fetch(){events.push('evaluate');assert.equal(context.state.session,null);return {ok:true,async json(){return {ok:true}}}},
    async loadAll(){events.push('reload')}, render(){events.push('render')},toast(){events.push('toast')}
  };
  context.window=context;
  vm.createContext(context);vm.runInContext(code+'\nfinish();',context);
  for(let i=0;i<40;i++)await Promise.resolve();
  return {context,writes,errors,events};
}
(async()=>{
  const old = handler.replace('.update({transcript,updated_at:', '.update({transcript,duration_seconds:272,updated_at:');
  const broken=await run(old);
  assert.equal(broken.writes.length,3);
  assert.ok(broken.context.state.session,'reproduce prior failure with immutable duration');
  assert.ok(!broken.events.includes('evaluate'));
  const fixed=await run(handler);
  assert.equal(fixed.writes.length,1,'one confirmed save');
  assert.equal(fixed.context.state.session,null,'hangup leaves session after confirmed save');
  assert.ok(fixed.events.includes('evaluate'),'analysis follows save');
  assert.equal(fixed.errors.length,0);
  const incomplete=await run(handler,false);
  assert.equal(incomplete.context.state.session,null);
  assert.ok(!incomplete.events.includes('evaluate'),'incomplete calls cannot earn scores');
  console.log('PASS: original failure reproduced; fixed save, hangup, evaluation order, incomplete-call exclusion');
})().catch(e=>{console.error(e);process.exitCode=1});
