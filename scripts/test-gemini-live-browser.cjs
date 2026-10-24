// Real Chromium/WebAudio + synthetic Auth/token/provider. No paid API requests.
const {chromium}=require(process.env.CODEX_PRIMARY_RUNTIME_NODE_MODULES+'/playwright');
const http=require('node:http'),fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const root=path.resolve(__dirname,'..');
const pageHtml=`<!doctype html><html lang="ru"><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1"><link rel="stylesheet" href="/assets/app.css"><link rel="stylesheet" href="/assets/gemini-live-preview.css"><body style="margin:24px;background:#f7f6fc"><main><h1>Холодный звонок</h1><label for="coldCharacter">Характер</label><select id="coldCharacter"><option>Скептик</option></select><textarea id="coldFacts">35 грузовиков</textarea><button id="entry" onclick="STGeminiLive.open()">Попробовать Gemini Live</button></main><script>var state={session:null};var sb={auth:{getSession:async()=>({data:{session:{access_token:'synthetic'}}})}};function toast(t){document.body.dataset.toast=t}</script><script src="/gemini-live-preview.js"></script>`;
const server=http.createServer((req,res)=>{const p=req.url.split('?')[0];if(p==='/'){res.setHeader('Content-Type','text/html; charset=utf-8');return res.end(pageHtml);}const target=path.join(root,p);if(!target.startsWith(root+'/')||!fs.existsSync(target)){res.statusCode=404;return res.end();}res.setHeader('Content-Type',p.endsWith('.css')?'text/css':'text/javascript');res.end(fs.readFileSync(target));});
(async()=>{let browser;try{
 await new Promise(r=>server.listen(0,'127.0.0.1',r));
 browser=await chromium.launch({headless:true,args:['--use-fake-device-for-media-stream','--use-fake-ui-for-media-stream','--autoplay-policy=no-user-gesture-required']});
 const context=await browser.newContext({permissions:['microphone'],viewport:{width:1280,height:850}});const page=await context.newPage();const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.addInitScript(()=>{
  const original=navigator.mediaDevices.getUserMedia.bind(navigator.mediaDevices);window.testTracks=[];navigator.mediaDevices.getUserMedia=async c=>{const stream=await original(c);testTracks.push(...stream.getTracks());return stream};
  window.testSockets=[];window.testPackets=[];
  class MockSocket{static OPEN=1;constructor(url){this.url=url;this.readyState=1;testSockets.push(this);setTimeout(()=>this.onopen?.(),10)}send(s){const p=JSON.parse(s);testPackets.push(p);if(p.setup)setTimeout(()=>this.onmessage?.({data:JSON.stringify({setupComplete:{}})}),20)}close(){this.readyState=3;this.onclose?.()}receive(data){this.onmessage?.({data:JSON.stringify(data)})}get bufferedAmount(){return 0}}
  window.WebSocket=MockSocket;
 });
 let mode='success';await page.route('**/functions/v1/gemini-live-preview',async route=>{assert.equal(JSON.parse(route.request().postData()).character,'Скептик');if(mode==='missing')return route.fulfill({status:503,contentType:'application/json',body:JSON.stringify({error:'Gemini пока не подключён. Администратору нужно добавить GEMINI_API_KEY в секреты Supabase.'})});await route.fulfill({contentType:'application/json',body:JSON.stringify({ok:true,token:'auth_tokens/synthetic=',model:'gemini-3.1-flash-live-preview',api_version:'v1alpha',duration_seconds:180,expires_at:new Date(Date.now()+180000).toISOString(),scored:false})});});
 await page.goto('http://127.0.0.1:'+server.address().port);
 await page.locator('#entry').click();await page.locator('#gemini-preview-voice').selectOption('Orus');assert.equal(await page.locator('#gemini-preview-voice option').count(),6);
 await page.getByRole('button',{name:'Начать звонок',exact:true}).click();await page.waitForFunction(()=>document.querySelector('#gemini-preview-status').textContent.includes('Соединение установлено'));
 await page.waitForFunction(()=>testPackets.some(p=>p.realtimeInput?.audio?.mimeType==='audio/pcm;rate=16000'));
 await page.evaluate(() => {
   testSockets.at(-1).receive({ serverContent: {
     inputTranscription: { text: 'Здравствуйте' },
     outputTranscription: { text: 'Добрый день' },
     modelTurn: { parts: [{ inlineData: { mimeType: 'audio/pcm;rate=24000', data: btoa('\0'.repeat(4800)) } }] }
   } });
 });
 await page.waitForFunction(()=>document.querySelector('.gemini-transcript').textContent.includes('Добрый день'));
 await page.evaluate(()=>testSockets.at(-1).receive({serverContent:{interrupted:true}}));await page.waitForFunction(()=>document.querySelector('#gemini-preview-status').textContent==='Слушаю вас…');
 await page.getByRole('button',{name:'Микрофон вкл.',exact:true}).click();assert.equal(await page.evaluate(()=>testTracks.at(-1).enabled),false);
 await page.getByRole('button',{name:'Завершить',exact:true}).click();assert.equal(await page.evaluate(()=>testTracks.every(t=>t.readyState==='ended')),true);assert.equal(await page.evaluate(()=>testSockets.every(s=>s.readyState===3)),true);
 await page.keyboard.press('Escape');assert.equal(await page.locator('dialog').count(),0);assert.equal(await page.locator('#entry').evaluate(e=>document.activeElement===e),true);
 mode='missing';await page.locator('#entry').click();await page.getByRole('button',{name:'Начать звонок',exact:true}).click();await page.waitForFunction(()=>document.querySelector('#gemini-preview-status').textContent.includes('GEMINI_API_KEY'));assert.equal(await page.getByRole('button',{name:'Начать звонок',exact:true}).isEnabled(),true);
 await page.setViewportSize({width:390,height:844});assert.equal(await page.locator('dialog').evaluate(e=>e.scrollWidth<=e.clientWidth),true);await page.screenshot({path:'/tmp/gemini-trial-mobile.png'});
 await page.keyboard.press('Escape');assert.deepEqual(errors,[]);console.log('PASS: real Chromium/WebAudio capture, setup, transcript, interruptions, mute, cleanup, focus/Escape, error/retry, six voices and mobile layout; Auth/Google are mocked.');
 }finally{await browser?.close();await new Promise(r=>server.close(r));}})().catch(e=>{console.error(e);process.exitCode=1});
