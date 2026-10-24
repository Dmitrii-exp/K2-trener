const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
(async()=>{
 for(const file of ['index.html','deploy/index.html']){
  const html=fs.readFileSync(file,'utf8'),start=html.indexOf('function coldCallHome()'),end=html.indexOf('}const GPT_LIVE_VOICES=',start)+1;
  const fields=new Map(['coldCharacter','coldFacts','coldVoice','coldLiveVoice','coldAdvancedVoice','coldRegularVoice','coldModeTitle'].map(id=>[id,{value:({coldCharacter:'Скептик',coldFacts:'35 машин',coldVoice:'onyx',coldLiveVoice:'stone'})[id]||''}]));
  let selected='advanced',launches=0;
  const c={coldCall:{advanced:true,voice:'onyx'},state:{session:null},$:id=>fields.get(id),document:{querySelector:()=>({value:selected})},updateLiveVoiceOptions(){},toast(){}};c.window={launchColdCall(){launches++}};vm.createContext(c);
  vm.runInContext(html.slice(start,end),c);
  const helper=html.slice(html.indexOf('function setColdCallMode('),html.indexOf('/* ASSIGNED TRAININGS'));
  vm.runInContext(helper,c);
  assert.ok(c.coldCallHome().includes('name="coldCallMode"'));assert.ok(!c.coldCallHome().includes('Единственный режим'));
  c.setColdCallMode('regular');assert.equal(c.coldCall.advanced,false);assert.equal(fields.get('coldAdvancedVoice').hidden,true);assert.equal(fields.get('coldFacts').value,'35 машин');
  selected='regular';await c.startColdCall('Сложный');assert.equal(c.coldCall.advanced,false);assert.equal(c.coldCall.voice,'onyx');assert.equal(c.coldCall.character,'Скептик');assert.equal(launches,1);
  selected='advanced';await c.startColdCall('Средний');assert.equal(c.coldCall.advanced,true);assert.equal(c.coldCall.liveVoice,'stone');
 }
 for(const file of ['cold-call-voice-v5.js','deploy/cold-call-voice-v5.js']){
  const calls=[],nodes=new Map(),node=()=>({innerHTML:'',textContent:'',value:'',classList:{toggle(){}},setAttribute(){},scrollHeight:0});
  for(const id of ['page','st-cold-back','st-cold-end','st-cold-mic','st-cold-send','st-cold-input','st-cold-live','st-cold-transcript'])nodes.set(id,node());
  let plays=0,pauses=0,holdAudio=false,activePlayer;
  const c={console,Map,Blob,FormData,TextDecoder,AbortController,DOMException,URL:{createObjectURL:()=> 'blob:synthetic',revokeObjectURL(){}},setTimeout,clearTimeout,setInterval:()=>1,clearInterval(){},
   document:{getElementById:id=>nodes.get(id),createElement:node,head:{appendChild(){}}},
   state:{session:{id:'synthetic-session',scenario:{id:1}},user:{id:'synthetic-user'},messages:[]},coldCall:{advanced:false,voice:'onyx'},
   sb:{auth:{getSession:async()=>({data:{session:{access_token:'synthetic'}}})}},saveSession:async()=>{},toast(){},render(){},
   Audio:class{constructor(){activePlayer=this}async play(){plays++;if(!holdAudio)queueMicrotask(()=>this.onended?.())}pause(){pauses++}},
   fetch:async(url,o)=>{calls.push({url,o});assert.equal(o.headers.Authorization,'Bearer synthetic');if(url.endsWith('/proxy-stt')){assert.equal(o.body.get('session_id'),'synthetic-session');return{ok:true,json:async()=>({ok:true,text:'Здравствуйте'})}}if(url.endsWith('/proxy-tts')){assert.equal(JSON.parse(o.body).session_id,'synthetic-session');return{ok:true,blob:async()=>new Blob(['audio'])}}throw Error('Unexpected endpoint: '+url)}
  };c.window=c;vm.createContext(c);
  const source=fs.readFileSync(file,'utf8').replace('window.launchColdCall=launchColdCall;','window.launchColdCall=launchColdCall;window.testRegular={recognize,speak,aiClientReplyStreamAndSpeak,cleanup,arm:()=>{callOpen=true;regularTurn=new AbortController();return regularTurn},cancelRegularTurn};');
  vm.runInContext(source,c);
  await c.testRegular.recognize(new Blob(['voice']),'audio/webm');await c.testRegular.speak('Добрый день');assert.equal(plays,1);
  // SSE text arrives without a final newline. The last delta must be retained.
  c.fetch=async(url,o)=>{if(url.endsWith('/chat-client')){assert.equal(JSON.parse(o.body).stream,true);return new Response('data: {"choices":[{"delta":{"content":"Добрый день. "}}]}\n\ndata: {"choices":[{"delta":{"content":"Что предлагаете?"}}]}',{headers:{'content-type':'text/event-stream'}})}return{ok:true,blob:async()=>new Blob(['audio'])}};
  const reply=await c.testRegular.aiClientReplyStreamAndSpeak('Здравствуйте');assert.equal(reply,'Добрый день. Что предлагаете?');assert.equal(plays,3);
  holdAudio=true;const controller=c.testRegular.arm();const pending=c.testRegular.speak('Длинный ответ',controller.signal);
  while(plays<4)await new Promise(r=>setImmediate(r));c.testRegular.cancelRegularTurn();await assert.rejects(pending,e=>e.name==='AbortError');assert.ok(pauses>0);
  const again=c.testRegular.arm();const pendingExit=c.testRegular.speak('Ответ',again.signal);while(plays<5)await new Promise(r=>setImmediate(r));c.testRegular.cleanup();await assert.rejects(pendingExit,e=>e.name==='AbortError');
 }
 console.log('PASS: mode routing/preserved fields, STT/TTS session authorization, SSE final delta and ordered speech, interruption and exit cancellation (root/deploy).');
})().catch(e=>{console.error(e);process.exitCode=1});
