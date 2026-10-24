// Voice runtime regressions. No network, microphone, or database access.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const nodes = new Map();
const element = () => ({innerHTML:'', textContent:'', value:'Ответ', disabled:false,
  classList:{toggle(){}}, setAttribute(){}, scrollHeight:0});
for(const id of ['page','st-cold-back','st-cold-end','st-cold-mic','st-cold-send','st-cold-input','st-cold-live','st-cold-transcript']) nodes.set(id,element());
let inserts=0, renders=0, failSave=false, aiCalls=0;
let resolveInsert;
const context={console:{log:console.log,warn(){},error(){}}, Map, Blob, setTimeout, clearTimeout,
  fetch:async()=>{throw new Error("TTS disabled in offline regression")},
  setInterval(){return 1}, clearInterval(){},
  document:{getElementById:id=>nodes.get(id)||null,createElement:element,head:{appendChild(){}}},
  state:{user:{id:'employee'},profile:{company_id:'company'},scenarios:[{id:1}],messages:[]},
  coldCall:{difficulty:'Средний',advanced:false},
  sb:{from(){return {insert(){inserts++;return {select(){return {single(){return new Promise(resolve=>{resolveInsert=resolve})}}}}}}}},
  saveSession:async()=>{if(failSave)throw new Error('Simulated save failure')},
  aiClientReply:async()=>{aiCalls++;return 'Ответ клиента'},
  render(){renders++},toast(){},
};
context.window=context;
vm.createContext(context);
// Expose private recorder helpers in the test harness only.
const source=fs.readFileSync(require('node:path').join(__dirname,'../cold-call-voice-v5.js'),'utf8');
vm.runInContext(source.replace('window.launchColdCall=launchColdCall;',
  'window.launchColdCall=launchColdCall;window.testRecorders={startLiveRecorder,stopLiveRecorders};'),context);
(async()=>{
  const launch=context.launchColdCall();
  await context.launchColdCall();
  assert.equal(inserts,1,'double launch must create one session');
  resolveInsert({data:{id:'session'}});await launch;
  nodes.get('page').innerHTML='';
  context.trainingCallPage();
  assert.ok(nodes.get('page').innerHTML.includes('st-cold-card'), 'navigation must retain the V5 phone renderer');
  assert.ok(!nodes.get('page').innerHTML.includes('cold-call-portrait'), 'retired renderer must not return');
  failSave=true;
  await nodes.get('st-cold-send').onclick();
  assert.equal(aiCalls,0,'failed persistence must not start AI request');
  failSave=false;nodes.get('st-cold-input').value='Повторить';
  await nodes.get('st-cold-send').onclick();
  assert.equal(aiCalls,1,'send must recover after save failure');
  nodes.get('st-cold-back').onclick();
  assert.equal(renders,1,'back must call application renderer');
  assert.equal(context.state.session,null);
  context.MediaRecorder=class {
    static isTypeSupported(){return true}
    constructor(){this.mimeType='audio/webm';this.state='inactive'}
    start(){this.state='recording'}
    stop(){this.state='inactive';this.ondataavailable({data:new Blob(['audio'])});this.onstop()}
  };
  const stream={getTracks(){return [{}]}};
  context.testRecorders.startLiveRecorder('manager',stream);
  context.testRecorders.startLiveRecorder('client',stream);
  const recordings=await context.testRecorders.stopLiveRecorders();
  assert.ok(recordings.manager.blob.size>0,'manager recording must be retained');
  assert.ok(recordings.client.blob.size>0,'client recording must be retained');
  console.log('PASS: duplicate voice launch, save failure recovery, back navigation, both live recorders');
})().catch(e=>{console.error(e);process.exitCode=1});
