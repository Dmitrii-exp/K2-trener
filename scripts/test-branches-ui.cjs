const { chromium } = require('playwright');
const fs = require('node:fs');
const path = require('node:path');
const http = require('node:http');
const assert = require('node:assert/strict');
const server=http.createServer((req,res)=>{
  const file=path.join(process.cwd(),decodeURIComponent(req.url.split('?')[0]==='/'?'/index.html':req.url.split('?')[0]));
  if(!file.startsWith(process.cwd()+path.sep)){res.writeHead(403).end();return;}
  fs.readFile(file,(err,data)=>{if(err){res.writeHead(404).end();return;}res.setHeader('Content-Type',file.endsWith('.js')?'text/javascript':file.endsWith('.css')?'text/css':file.endsWith('.svg')?'image/svg+xml':file.endsWith('.html')?'text/html':'application/octet-stream');res.end(data);});
});
(async()=>{
 await new Promise(r=>server.listen(0,'127.0.0.1',r));
 const browser=await chromium.launch({headless:true,...(process.env.UI_BROWSER_CHANNEL?{channel:process.env.UI_BROWSER_CHANNEL}:{})});
 try{
 const page=await browser.newPage({viewport:{width:1440,height:1000}});
 const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.route('https://**/*',route=>route.abort());
 await page.goto('http://127.0.0.1:'+server.address().port);
 await page.waitForFunction(()=>typeof window.companyBranchesPage==='function');
 await page.evaluate(()=>{
  state.user={id:'u',email:'test@example.test'};state.profile={id:'u',first_name:'Тест',role:'director',company_id:'company'};
  state.company={id:'company',name:'Тест'};state.branchContext={can_manage:true};state.view='branches';window.rpcCalls=[];
  sb.rpc=async(name,args)=>{
   rpcCalls.push({name,args});
   if(name==='list_company_branches')return {data:window.noBranches?[]:[{branch_id:'branch',branch_name:'Филиал <img src=x onerror=alert(1)>',director_name:'Руководитель',employee_count:2}]};
   if(name==='list_company_branch_candidates')return {data:[{employee_id:'employee',employee_name:'Сотрудник'}]};
   if(name==='company_team_directory')return {data:[{employee_name:'Сотрудник',branch_name:'Филиал'}]};
   if(name==='company_top_public')return {data:[{employee_name:'Иван Оченьдлинноеимябезпробеловдляпроверкиадаптивности',branch_name:'Не назначен',text_count:10,voice_count:32,best_score:90,average_score:84.5}]};
   if(name==='create_company_branch'){window.noBranches=false;return {data:'branch'};}
   if(name==='set_company_position')return await new Promise(resolve=>window.finishAssignment=resolve);
   return {data:null,error:null};
  };render();
 });
 await page.getByRole('button',{name:'Сохранить назначение'}).waitFor();
 assert.equal(await page.locator('.nav').getByRole('button',{name:'Мой прогресс',exact:true}).count(),0);
 assert.equal(await page.locator('.nav').getByRole('button',{name:'Сценарии',exact:true}).count(),0);
 assert.equal(await page.locator('.nav').getByRole('button',{name:'Тренировки',exact:true}).count(),1);
 assert.equal(await page.locator('#page img').count(),0,'Branch name is escaped');
 await page.getByLabel('Сотрудник',{exact:true}).focus();
 await page.keyboard.press('ArrowDown');await page.keyboard.press('Tab');
 assert.equal(await page.locator('#branchTarget').evaluate(el=>el===document.activeElement),true);
 await page.getByRole('button',{name:'Сохранить назначение'}).click();
 assert.equal(await page.locator('#assignBranchButton').isDisabled(),true);
 await page.evaluate(()=>assignCompanyBranch('company'));
 const calls=await page.evaluate(()=>rpcCalls.filter(c=>c.name==='set_company_position'));
 assert.equal(calls.length,1);assert.equal(calls[0].args.p_company_id,'company');
 await page.evaluate(()=>finishAssignment({error:new Error('transport error')}));
 await page.getByRole('alert').filter({hasText:'Изменения не сохранены'}).waitFor();
 assert.equal(await page.locator('#branchEmployee').inputValue(),'employee');
 await page.getByRole('button',{name:'Создать филиал',exact:true}).click();
 assert.equal(await page.locator('#branchName').evaluate(el=>el===document.activeElement),true);
 // Late async pages cannot replace a later navigation destination.
 await page.evaluate(()=>{setPageHTML(document.getElementById('page'),new Promise(resolve=>window.finishOldPage=resolve));setPageHTML(document.getElementById('page'),'<h2>Новая страница</h2>');finishOldPage('<h2>Устаревшая страница</h2>');});
 await page.getByRole('heading',{name:'Новая страница'}).waitFor();
 assert.equal(await page.getByRole('heading',{name:'Устаревшая страница'}).count(),0);
 await page.evaluate(()=>{state.branchContext={branch_role:'branch_director',can_manage:false};state.view='team';state.team=[];render();});
 assert.equal(await page.getByRole('button',{name:'Пригласить сотрудника'}).count(),0);
 assert.equal(await page.locator('.nav button').filter({hasText:'Филиалы'}).count(),0);
 assert.equal(await page.locator('.nav button').filter({hasText:'Аналитика'}).count(),1);
 await page.evaluate(()=>{state.branchContext={branch_role:'employee',can_manage:false};state.profile.role='employee';state.view='team';render();});
 await page.getByRole('columnheader',{name:'Филиал'}).waitFor();
 assert.equal(await page.getByRole('columnheader').count(),2,'Employee directory exposes only name and branch');
 await page.setViewportSize({width:390,height:844});
 await page.evaluate(()=>{state.profile.role='director';state.branchContext={can_manage:true};state.view='branches';render();});
 await page.getByRole('button',{name:'Сохранить назначение'}).waitFor();
 assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true,'No page overflow on mobile');
 fs.mkdirSync('test-results',{recursive:true});await page.screenshot({path:'test-results/branches-mobile.png',fullPage:true});
 // Both reported regressions: all TOP fields fit on phones, and team has assignment controls.
 for(const width of [320,390,440]){
   await page.setViewportSize({width,height:844});
   await page.evaluate(()=>{state.view='top';page();});
   const card=page.locator('.company-top-mobile .company-top-card');await card.waitFor();
   for(const label of ['Текстовые','Холодные звонки','Лучший балл','Средний балл'])await card.getByText(label,{exact:true}).waitFor();
   assert.deepEqual(await card.locator('dd').allTextContents(),['10','32','90','84.5']);
   assert.equal(await page.locator('.company-top-desktop').isVisible(),false);
   assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true,'TOP fits '+width+'px');
   assert.equal(await card.evaluate(el=>el.scrollWidth<=el.clientWidth),true,'No clipped TOP card content');
 }
 await page.screenshot({path:'test-results/top-mobile.png',fullPage:true});
 await page.setViewportSize({width:1440,height:1000});
 assert.equal(await page.locator('.company-top-desktop').isVisible(),true);
 assert.equal(await page.locator('.company-top-desktop th').count(),7);
 await page.setViewportSize({width:390,height:844});
 await page.evaluate(()=>{state.view='team';state.team=[{employee_id:'employee',employee_name:'Сотрудник',sessions_count:2,completed_sessions:1,avg_score:74}];render();});
 const assign=page.getByRole('button',{name:'Назначить должность и филиал',exact:true});
 await assign.click();
 const dialog=page.getByRole('dialog');await dialog.getByLabel('Должность',{exact:true}).waitFor();
 await dialog.getByLabel('Должность',{exact:true}).selectOption('branch_director');
 await dialog.getByRole('button',{name:'Сохранить назначение'}).click();
 assert.equal(await dialog.locator('#employeeBranchSave').isDisabled(),true);
 const call=await page.evaluate(()=>rpcCalls.filter(c=>c.name==='set_company_position').at(-1));
 assert.deepEqual(call.args,{p_company_id:'company',p_branch_id:'branch',p_employee_id:'employee',p_position:'branch_director'});
 await page.evaluate(()=>finishAssignment({error:new Error('network failure')}));
 await dialog.getByRole('alert').filter({hasText:'Изменения не сохранены'}).waitFor();
 assert.equal(await dialog.getByLabel('Должность',{exact:true}).inputValue(),'branch_director');
 await dialog.getByRole('button',{name:'Сохранить назначение'}).click();
 await page.evaluate(()=>finishAssignment({data:null,error:null}));
 await dialog.waitFor({state:'detached'});
 assert.equal(await assign.evaluate(el=>el===document.activeElement),true,'Assignment restores card button focus');
 await assign.click();await dialog.getByLabel('Должность',{exact:true}).waitFor();
 await page.keyboard.press('Escape');await dialog.waitFor({state:'detached'});
 await page.evaluate(()=>window.noBranches=true);await assign.click();
 await dialog.getByText('Сначала создайте филиал, чтобы назначить в него сотрудника.').waitFor();
 await dialog.getByRole('button',{name:'Создать филиал',exact:true}).click();
 await dialog.getByRole('alert').filter({hasText:'Введите название филиала'}).waitFor();
 await dialog.getByLabel('Название филиала',{exact:true}).fill('Ставрополь');
 await dialog.getByRole('button',{name:'Создать филиал',exact:true}).click();
 await dialog.getByLabel('Должность',{exact:true}).waitFor();
 assert.equal(await dialog.getByLabel('Филиал',{exact:true}).inputValue(),'branch');
 assert.equal(await dialog.evaluate(el=>{const r=el.getBoundingClientRect();return r.left>=0&&r.right<=innerWidth&&r.top>=0&&r.bottom<=innerHeight}),true,'Assignment dialog fits phone');
 await page.screenshot({path:'test-results/team-assignment-mobile.png',fullPage:true});
 await dialog.getByRole('button',{name:'Отмена',exact:true}).click();
 await assign.click();await dialog.getByLabel('Должность',{exact:true}).waitFor();
 assert.equal(await dialog.locator('option[value="network_director"]').count(),0,'Network director option is hidden from normal company directors');
 await dialog.getByRole('button',{name:'Отмена',exact:true}).click();
 await page.evaluate(()=>{state.branchContext.can_assign_network_director=true;window.noBranches=true;});
 await assign.click();await dialog.getByLabel('Должность',{exact:true}).waitFor();
 assert.equal(await dialog.getByLabel('Должность',{exact:true}).inputValue(),'network_director');
 assert.equal(await dialog.getByLabel('Филиал',{exact:true}).isVisible(),false,'Network role needs no branch');
 await dialog.getByRole('button',{name:'Сохранить назначение'}).click();
 const networkCall=await page.evaluate(()=>rpcCalls.filter(c=>c.name==='set_company_position').at(-1));
 assert.deepEqual(networkCall.args,{p_company_id:'company',p_branch_id:null,p_employee_id:'employee',p_position:'network_director'});
 await page.evaluate(()=>finishAssignment({data:null,error:null}));await dialog.waitFor({state:'detached'});
 await page.getByText('Руководитель сети · SaleTrening',{exact:true}).waitFor();
 await page.evaluate(()=>{state.branchContext={can_manage:false,branch_role:'branch_director'};render();});
 assert.equal(await page.getByRole('button',{name:'Назначить должность и филиал',exact:true}).count(),0,'Only network managers can assign');
 // Per-employee growth charts use real SVG layout and current-user REST reads.
 let historyFailure=false,historyRequests=0;
 const historyRows=[
   {id:'a',employee_id:'employee',status:'completed',total_score:40,created_at:'2026-09-01T10:00:00Z',completed_at:'2026-09-01T10:30:00Z',session_scores:{discovery_score:10}},
   {id:'b',employee_id:'employee',status:'completed',total_score:80,created_at:'2026-09-02T10:00:00Z',completed_at:'2026-09-02T10:30:00Z',session_scores:{discovery_score:12}},
   {id:'c',employee_id:'employee',status:'completed',total_score:55,created_at:'2026-09-03T10:00:00Z',completed_at:'2026-09-03T10:30:00Z',voice_mode:true,session_scores:{discovery_score:14}},
   {id:'d',employee_id:'employee2',status:'completed',total_score:70,created_at:'2026-09-01T10:00:00Z',completed_at:'2026-09-01T10:30:00Z'}
 ];
 await page.route(/\/rest\/v1\/saletrening_sessions\?/,async route=>{
   const cors={'access-control-allow-origin':'*','access-control-allow-headers':'authorization,apikey','access-control-allow-methods':'GET, OPTIONS'};
   if(route.request().method()==='OPTIONS'){await route.fulfill({status:204,headers:cors});return;}
   historyRequests++;
   assert.equal(route.request().headers().authorization,'Bearer chart-test-token');
   const offset=Number(new URL(route.request().url()).searchParams.get('offset'));
   await route.fulfill({status:historyFailure?503:200,headers:cors,contentType:'application/json',body:JSON.stringify(offset?[]:historyRows)});
 });
 await page.evaluate(()=>{
   window.loadAll=async()=>{};
   sb.auth.getSession=async()=>({data:{session:{access_token:'chart-test-token'}}});
   state.profile.role='director';state.branchContext={can_manage:true};
   state.team=[{employee_id:'employee',employee_name:'Сотрудник'},{employee_id:'employee2',employee_name:'Одна тренировка'},{employee_id:'employee3',employee_name:'Без тренировок'}];
   state.view='analytics';page();
 });
 const charts=page.locator('.employee-progress-card');await page.locator('.employee-progress-line').waitFor();
 assert.equal(await charts.count(),1);assert.equal(await charts.nth(0).getByText('К предыдущей тренировке: спад на 25 баллов.',{exact:true}).count(),1);
 const employeeSelect=page.getByLabel('Сотрудник',{exact:true});
 assert.equal(await employeeSelect.locator('option').count(),3);
 await employeeSelect.focus();await employeeSelect.press('ArrowDown');await employeeSelect.press('Enter');
 await page.waitForFunction(()=>document.querySelector('#analytics-employee').value==='employee2');
 assert.equal(await charts.count(),1);assert.equal(await charts.locator('polyline').count(),0,'One training is a point, not fabricated trend');
 assert.equal(await charts.locator('output').textContent().then(t=>t.includes('70 из 100')),true);
 assert.equal(await page.getByText('Средний команды',{exact:true}).count(),0,'Individual metrics use employee labels');
 assert.equal(await page.getByText('Навыки сотрудника',{exact:true}).count(),1);
 await employeeSelect.selectOption('employee3');
 assert.equal(await charts.locator('svg').count(),0,'No training does not become a zero score');
 await charts.getByText('Пока нет завершённых тренировок с оценкой.',{exact:true}).waitFor();
 await employeeSelect.selectOption('employee');
 assert.equal(await page.evaluate(()=>document.activeElement.id),'analytics-employee','Selection keeps keyboard focus');
 const linePoints=await charts.nth(0).locator('polyline').evaluate(el=>Array.from({length:el.points.numberOfItems},(_,i)=>({x:el.points.getItem(i).x,y:el.points.getItem(i).y})));
 assert.equal(linePoints.length,3);assert.ok(linePoints[0].x<linePoints[1].x&&linePoints[1].x<linePoints[2].x);assert.ok(linePoints[1].y<linePoints[0].y&&linePoints[2].y>linePoints[1].y,'Shows growth then decline');
 const slider=charts.nth(0).getByRole('slider');await slider.focus();await slider.press('Home');
 await charts.nth(0).locator('output').filter({hasText:'Тренировка №1 · 40 из 100'}).waitFor();
 await slider.press('End');await charts.nth(0).locator('output').filter({hasText:'Тренировка №3 · 55 из 100'}).waitFor();
 for(const width of [320,390,1440]){
   await page.setViewportSize({width,height:1000});
   await page.waitForFunction(()=>Array.from(document.querySelectorAll('.employee-progress-plot')).every(p=>Math.abs(p.querySelector('svg').viewBox.baseVal.width-p.clientWidth)<=2));
   assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true,'Analytics fits '+width+'px');
   await charts.nth(0).getByText('Баллы',{exact:true}).waitFor();await charts.nth(0).getByText('Номер тренировки',{exact:true}).waitFor();
 }
 await page.setViewportSize({width:390,height:1000});
 await page.waitForFunction(()=>Array.from(document.querySelectorAll('.employee-progress-plot')).every(p=>Math.abs(p.querySelector('svg').viewBox.baseVal.width-p.clientWidth)<=2));
 await employeeSelect.focus();await employeeSelect.press('Space');
 await page.screenshot({path:'test-results/employee-analytics-selector-open.png',fullPage:true});
 await employeeSelect.press('Escape');
 await page.screenshot({path:'test-results/employee-analytics-mobile.png',fullPage:true});
 await employeeSelect.selectOption('employee2');await page.evaluate(()=>page());
 await page.waitForFunction(()=>document.querySelector('#analytics-employee')?.value==='employee2');
 assert.equal(await charts.count(),1,'Remembered employee is shown after refresh');
 await page.evaluate(()=>{state.team=state.team.filter(e=>e.employee_id!=='employee2');page();});
 await page.waitForFunction(()=>document.querySelector('#analytics-employee')?.value==='employee');
 assert.equal(await employeeSelect.locator('option').count(),2,'Removed employees cannot remain selected');
 assert.equal(historyRequests,6,'Switches use cached history; only page refresh revalidates and reloads');
 historyFailure=true;await page.evaluate(()=>page());
 await page.getByRole('alert').filter({hasText:'Не удалось загрузить полную историю оценок'}).waitFor();
 assert.equal(await page.locator('.employee-progress-card').count(),0,'Failed history is not silently rendered as empty employee scores');
 historyFailure=false;await page.getByRole('button',{name:'Повторить загрузку графиков'}).click();await page.locator('.employee-progress-line').waitFor();
 const beforeForbidden=historyRequests;
 await page.evaluate(()=>{state.branchContext={branch_role:'employee',can_manage:false};state.view='analytics';page();});
 await page.getByText('Нет доступа к аналитике команды.',{exact:true}).waitFor();assert.equal(historyRequests,beforeForbidden);
 await page.evaluate(()=>{state.view='scenarios';page();});
 await page.waitForFunction(()=>state.view==='training');
 await page.evaluate(()=>{state.view='progress';page();});
 await page.waitForFunction(()=>state.view==='history');
 // Purchasing cold calls: setup switching and the persisted buyer report.
 await page.evaluate(()=>{
  window.__stColdCallActive=false;state.report=null;state.scenarios=[{id:4,title:'Холодный звонок — выход на ЛПР',difficulty:'Средний'},{id:9,title:'Холодный звонок',difficulty:'Сложный'},{id:19,title:'Холодный звонок поставщику',difficulty:'Средний'}];state.view='coldcall';page();
  window.launchColdCall=async()=>{window.buyerLaunch={id:coldCallScenario(coldCall.difficulty)?.id,mode:coldCall.mode,facts:coldCall.facts,objections:state.clientObjections};};
 });
 await page.getByRole('button',{name:'Менеджер',exact:true}).waitFor();
 await page.locator('#coldFacts').fill('Факты менеджера');await page.locator('#coldDifficulty').selectOption('Средний');
 await page.getByRole('button',{name:'Закупщик',exact:true}).focus();await page.keyboard.press('Enter');
 assert.equal(await page.locator('#coldModeBuyer').getAttribute('aria-pressed'),'true');
 assert.equal(await page.locator('#coldModeBuyer').evaluate(el=>document.activeElement===el),true);
 await page.getByLabel('Факты о закупке',{exact:false}).fill('40 шин 315/70 R22.5');await page.locator('#coldDifficulty').selectOption('Сложный');
 assert.equal(await page.getByText('Возражения клиента',{exact:true}).isVisible(),false);
 await page.getByRole('button',{name:'Менеджер',exact:true}).click();assert.equal(await page.locator('#coldFacts').inputValue(),'Факты менеджера');assert.equal(await page.locator('#coldDifficulty').inputValue(),'Средний');
 await page.getByRole('button',{name:'Закупщик',exact:true}).click();assert.equal(await page.locator('#coldFacts').inputValue(),'40 шин 315/70 R22.5');assert.equal(await page.locator('#coldDifficulty').inputValue(),'Сложный');
 for(const width of [320,390,1440]){await page.setViewportSize({width,height:1000});assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true,'Buyer setup fits '+width+'px');}
 await page.setViewportSize({width:390,height:1000});await page.screenshot({path:'test-results/buyer-cold-call-setup-mobile.png',fullPage:true});
 await page.getByRole('button',{name:'Начать тренировку →',exact:true}).click();
 const launch=await page.evaluate(()=>buyerLaunch);assert.equal(launch.id,19);assert.equal(launch.mode,'buyer');assert.deepEqual(launch.objections,[]);
 await page.evaluate(async()=>{
  const saved={id:'buyer-session',employee_id:'u',company_id:'company',scenario_id:19,status:'completed',created_at:'2026-10-29T10:00:00Z',completed_at:'2026-10-29T10:08:00Z',ai_evaluation:{negotiation_result:{initial_terms:'Прайс',agreed_terms:'Скидка 2%',savings_summary:'Недостаточно данных для расчёта экономии',open_issues:'Срок <img src=x onerror=alert(1)>'}},transcript:[{speaker:'manager',content:'Уточним доставку'},{speaker:'client',content:'Доставку рассчитаем отдельно'}]};
  const scores={overall_score:67,discovery_score:12,objection_score:14,value_score:16,communication_score:15,closing_score:10,strengths:['Предложил самовывоз'],weaknesses:['Не подтвердил срок'],recommendations:['Уточнить срок']};
  sb.from=table=>({select(){return this},eq(){return this},maybeSingle:async()=>({data:table==='saletrening_sessions'?saved:scores})});
  state.branchContext={can_manage:true};state.profile.role='director';await openHistorySession('buyer-session');
 });
 await page.getByText('Аргументация и торг',{exact:true}).waitFor();await page.getByText('Выгода и защита интересов',{exact:true}).waitFor();
 await page.getByText('Предложил самовывоз',{exact:true}).waitFor();await page.getByText('Не подтвердил срок',{exact:true}).waitFor();
 await page.getByText('Результат переговоров закупщика',{exact:true}).waitFor();assert.equal(await page.locator('#page img').count(),0,'Report results are escaped');
 await page.getByText('Закупщик:',{exact:true}).waitFor();await page.getByText('Продавец:',{exact:true}).waitFor();
 assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true,'Buyer report fits mobile');
 await page.screenshot({path:'test-results/buyer-negotiation-report-mobile.png',fullPage:true});
 // Personal mentor history: separate dialogues, refresh, failure/retry and in-flight switching.
 const mentorCors={'access-control-allow-origin':'*','access-control-allow-headers':'authorization,apikey,content-type,prefer','access-control-allow-methods':'GET,POST,OPTIONS'};
 const dialogues=new Map(),mentorRequests=[];let pendingRoute,pendingBody,firstReady;const pendingReady=new Promise(resolve=>firstReady=resolve);let failOnce=true,historyFails=false;
 const saveMentorAnswer=(body,reply)=>{const row=dialogues.get(body.dialogue_id);row.messages.push({role:'assistant',content:reply,request_id:body.request_id});row.status='ready';row.updated_at=new Date().toISOString();};
 await page.route(/\/rest\/v1\/mentor_chat_dialogues\?/,async route=>{
  if(route.request().method()==='OPTIONS'){await route.fulfill({status:204,headers:mentorCors});return;}
  if(historyFails){await route.fulfill({status:503,body:'{}',headers:{'access-control-allow-origin':'*'}});return;}
  const q=new URL(route.request().url()).searchParams;
  let rows=[...dialogues.values()].filter(x=>'eq.'+x.owner_id===q.get('owner_id')&&'eq.'+x.company_id===q.get('company_id'));
  if(q.get('id'))rows=rows.filter(x=>'eq.'+x.id===q.get('id'));
  if(q.get('or'))rows=[];
  await route.fulfill({status:200,contentType:'application/json',headers:{'access-control-allow-origin':'*'},body:JSON.stringify(rows)});
 });
 await page.route(/\/functions\/v1\/manager-ai-chat$/,async route=>{
  if(route.request().method()==='OPTIONS'){await route.fulfill({status:204,headers:mentorCors});return;}
  const body=route.request().postDataJSON();mentorRequests.push(body);assert.equal(body.transcript,undefined,'Browser does not supply persistent mentor context');
  const row=dialogues.get(body.dialogue_id);if(!row.messages.some(x=>x.role==='user'&&x.request_id===body.request_id))row.messages.push({role:'user',content:body.message,request_id:body.request_id,attachments:body.attachments||[]});
  if(row.messages.length===1)row.title=body.message;row.status='pending';row.current_request_id=body.request_id;row.request_content=body.message;
  if(body.message==='Первый вопрос'){pendingRoute=route;pendingBody=body;firstReady();return;}
  if(body.message==='Повтор'&&failOnce){failOnce=false;row.status='failed';await route.fulfill({status:500,contentType:'application/json',headers:{'access-control-allow-origin':'*'},body:JSON.stringify({ok:false,error:'Временная ошибка'})});return;}
  const reply=body.message==='Второй вопрос'?'Ответ второго диалога <img src=x onerror=alert(1)>':'Продолжение диалога';saveMentorAnswer(body,reply);
  await route.fulfill({status:200,contentType:'application/json',headers:{'access-control-allow-origin':'*'},body:JSON.stringify({ok:true,reply,dialogue_id:body.dialogue_id,request_id:body.request_id})});
 });
 const setupMentor=async()=>page.evaluate(()=>{state.user={id:'u',email:'test@example.test'};state.profile={id:'u',first_name:'Тест',role:'director',company_id:'company'};state.company={id:'company',name:'Тест'};state.branchContext={can_manage:true};state.view='ai';state.session=null;sb.auth.getSession=async()=>({data:{session:{access_token:'chart-test-token'}}});render();});
 await setupMentor();
 await page.evaluate(()=>{sb.rpc=async(name,args)=>{if(name==='create_mentor_dialogue')return await window.createMentorFixture(args.p_id);return {data:null};};});
 await page.exposeFunction('createMentorFixture',async id=>{if(!dialogues.has(id))dialogues.set(id,{id,owner_id:'u',company_id:'company',title:'Новый диалог',messages:[],status:'ready',updated_at:new Date().toISOString()});return {data:id};});
 await page.locator('#page').getByRole('button',{name:'История',exact:true}).click();await page.getByText('Сохранённых диалогов пока нет.',{exact:false}).waitFor();
 await page.getByRole('button',{name:'Новый чат',exact:true}).click();await page.getByLabel('Сообщение наставнику').fill('Первый вопрос');await page.locator('#aiSend').click();await pendingReady;
 await page.getByRole('button',{name:'Новый чат',exact:true}).click();assert.equal(await page.locator('#aiMessages').getByText('Первый вопрос',{exact:false}).count(),0);
 await page.getByLabel('Сообщение наставнику').fill('Второй вопрос');await page.locator('#aiSend').click();await page.getByText('Ответ второго диалога',{exact:false}).waitFor();assert.equal(await page.locator('#page img').count(),0,'Mentor output is escaped');
 saveMentorAnswer(pendingBody,'Ответ первого диалога');await pendingRoute.fulfill({status:200,contentType:'application/json',headers:{'access-control-allow-origin':'*'},body:JSON.stringify({ok:true,reply:'Ответ первого диалога',dialogue_id:pendingBody.dialogue_id,request_id:pendingBody.request_id})});
 await page.locator('#page').getByRole('button',{name:'История',exact:true}).click();await page.getByRole('button',{name:'Первый вопрос',exact:false}).waitFor();assert.equal(await page.locator('.mentor-history-row').count(),2);
 await page.getByRole('button',{name:'Первый вопрос',exact:false}).click();await page.getByText('Ответ первого диалога',{exact:false}).waitFor();assert.equal(await page.locator('#aiMessages').getByText('Ответ второго диалога',{exact:false}).count(),0);
 await page.reload();await setupMentor();
 await page.evaluate(()=>{sb.rpc=async(name,args)=>name==='create_mentor_dialogue'?await window.createMentorFixture(args.p_id):{data:null};});
 await page.locator('#page').getByRole('button',{name:'История',exact:true}).click();await page.getByRole('button',{name:'Второй вопрос',exact:false}).click();await page.getByText('Ответ второго диалога',{exact:false}).waitFor();
 await page.getByLabel('Сообщение наставнику').fill('Продолжим');await page.locator('#aiSend').click();await page.getByText('Продолжение диалога',{exact:false}).waitFor();
 for(const width of [320,390,1440]){await page.setViewportSize({width,height:1000});assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true,'Mentor dialogue fits '+width+'px');}
 await page.setViewportSize({width:390,height:1000});const areaBox=await page.locator('#aiMsg').boundingBox(),sendBox=await page.locator('#aiSend').boundingBox();assert.ok(sendBox.y>=areaBox.y+areaBox.height-1,'Mobile Send button follows the message field');await page.screenshot({path:'test-results/mentor-dialogue-mobile.png',fullPage:true});
 await page.getByRole('button',{name:'Новый чат',exact:true}).click();await page.getByLabel('Сообщение наставнику').fill('Повтор');await page.locator('#aiSend').click();await page.getByRole('alert').filter({hasText:'Временная ошибка'}).waitFor();
 await page.getByRole('button',{name:'Повторить',exact:true}).click();await page.getByText('Продолжение диалога',{exact:false}).waitFor();
 const retried=mentorRequests.filter(x=>x.message==='Повтор');assert.equal(retried.length,2);assert.equal(retried[0].request_id,retried[1].request_id);assert.equal(await page.locator('#aiMessages .msg.manager').count(),1,'Retry keeps one user message');
 historyFails=true;await page.locator('#page').getByRole('button',{name:'История',exact:true}).click();await page.getByRole('alert').filter({hasText:'Не удалось загрузить историю'}).waitFor();historyFails=false;await page.getByRole('button',{name:'Повторить',exact:true}).click();await page.locator('.mentor-history-row').first().waitFor();
 await page.screenshot({path:'test-results/mentor-history-mobile.png',fullPage:true});
 let uploads=0;await page.route(/\/storage\/v1\/object\/mentor-private\//,async route=>{uploads++;assert.equal(route.request().headers()['x-upsert'],'false');await route.fulfill({status:200,headers:mentorCors,body:'{}'});});
 await page.getByRole('button',{name:'Новый чат',exact:true}).click();
 await page.locator('#mentorFileInput').setInputFiles({name:'bad.exe',mimeType:'application/octet-stream',buffer:Buffer.from('no')});await page.getByRole('alert').filter({hasText:'Поддерживаются'}).waitFor();assert.equal(uploads,0);
 await page.locator('#mentorFileInput').setInputFiles([{name:'Условия.txt',mimeType:'text/plain',buffer:Buffer.from('Доставка завтра')},{name:'photo.png',mimeType:'image/png',buffer:Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aY9kAAAAASUVORK5CYII=','base64')}]);
 await page.locator('.mentor-file-draft img').waitFor();assert.equal(await page.locator('.mentor-file-draft').count(),2);await page.locator('.mentor-remove').first().click();assert.equal(await page.locator('.mentor-file-draft').count(),1);
 for(const width of [320,390,1440]){await page.setViewportSize({width,height:1000});assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true,'Attachment composer fits '+width+'px');}
 await page.setViewportSize({width:390,height:1000});const composerBounds=await page.locator('.mentor-chat .composer').boundingBox(),chatBounds=await page.locator('.mentor-chat').boundingBox();assert.ok(composerBounds.y+composerBounds.height<=chatBounds.y+chatBounds.height+1,'Attachment composer is not clipped');await page.screenshot({path:'test-results/mentor-attachments-mobile.png',fullPage:true});
 await page.locator('#aiSend').click();await page.getByText('Продолжение диалога',{exact:false}).waitFor();assert.equal(uploads,1);const attachmentRequest=mentorRequests.at(-1);assert.equal(attachmentRequest.message,'Проанализируй прикреплённые файлы.');assert.equal(attachmentRequest.attachments.length,1);assert.equal(attachmentRequest.attachments[0].type,'image/png');assert.ok(!JSON.stringify(attachmentRequest).includes('base64'),'Browser request has private refs, not large data');
 await page.getByRole('button',{name:'История',exact:true}).click();await page.getByRole('button',{name:'Проанализируй прикреплённые файлы.',exact:false}).click();await page.locator('.mentor-file').waitFor();assert.match(await page.locator('.mentor-file').textContent(),/photo.png/,'Saved attachment restored from history');
 await page.evaluate(()=>{state.user={id:'other',email:'other@example.test'};state.profile={id:'other',company_id:'other-company',role:'employee'};state.view='ai';page();});assert.equal(await page.locator('#aiMessages .msg').count(),0,'Account switching clears cached messages');
 await page.locator('#page').getByRole('button',{name:'История',exact:true}).click();await page.getByText('Сохранённых диалогов пока нет.',{exact:false}).waitFor();
 // Private topic-based notes: create/edit/save, drafts, retry, conflict copy and reload.
 const topicRows=new Map(),noteRows=new Map(),noteCalls=[];let releaseNoteSave,noteReady,holdNote=true,uncertainNote=false,notesReadFails=false;
 const noteSaveReady=new Promise(resolve=>noteReady=resolve);
 const writeNote=(name,args)=>{
  const isTopic=name==='save_personal_topic',rows=isTopic?topicRows:noteRows;const old=rows.get(args.p_id);
  const title=args.p_title.trim()||(args.p_content||'').trim().split('\n')[0].slice(0,80)||'Без названия';
  if(old&&old.last_request_id===args.p_request_id)return {data:old};
  if(old&&old.revision!==args.p_revision)return {error:{message:'Changed',status:409,data:{code:'40001'}}};
  const row={id:args.p_id,owner_id:'u',company_id:'company',title,revision:(old?.revision||0)+1,last_request_id:args.p_request_id,created_at:old?.created_at||new Date().toISOString(),updated_at:new Date().toISOString(),...(!isTopic?{topic_id:args.p_topic_id,content:args.p_content}:{})};rows.set(row.id,row);return {data:row};
 };
 await page.exposeFunction('saveNotesFixture',async(name,args)=>{
  noteCalls.push({name,args});
  if(name==='save_personal_note'&&holdNote){noteReady();return await new Promise(resolve=>releaseNoteSave=()=>{holdNote=false;resolve(writeNote(name,args));});}
  const result=writeNote(name,args);if(name==='save_personal_note'&&uncertainNote){uncertainNote=false;return {error:{message:'Connection lost after commit',status:503}};}return result;
 });
 await page.route(/\/rest\/v1\/(personal_note_topics|personal_notes)\?/,async route=>{
  if(route.request().method()==='OPTIONS'){await route.fulfill({status:204,headers:mentorCors});return;}
  if(notesReadFails){await route.fulfill({status:503,headers:mentorCors,body:'{}'});return;}
  const url=new URL(route.request().url()),q=url.searchParams;const source=url.pathname.endsWith('personal_note_topics')?topicRows:noteRows;
  let rows=[...source.values()].filter(r=>'eq.'+r.owner_id===q.get('owner_id')&&'eq.'+r.company_id===q.get('company_id'));
  if(q.get('id'))rows=rows.filter(r=>'eq.'+r.id===q.get('id'));if(q.get('topic_id'))rows=rows.filter(r=>'eq.'+r.topic_id===q.get('topic_id'));if(q.get('or'))rows=[];
  await route.fulfill({status:200,headers:mentorCors,contentType:'application/json',body:JSON.stringify(rows)});
 });
 const setupNotes=async()=>page.evaluate(()=>{state.user={id:'u',email:'test@example.test'};state.profile={id:'u',first_name:'Тест',role:'director',company_id:'company'};state.company={id:'company',name:'Тест'};state.branchContext={can_manage:true};state.session=null;state.view='notes';sb.auth.getSession=async()=>({data:{session:{access_token:'chart-test-token'}}});sb.rpc=async(name,args)=>await window.saveNotesFixture(name,args);render();});
 await setupNotes();await page.getByText('Создайте первую тему, например «Идеи» или «Работа с клиентами».',{exact:true}).waitFor();
 assert.equal(await page.locator('.nav').getByRole('button',{name:'Заметки',exact:true}).count(),1);
 await page.getByRole('button',{name:'Создать тему',exact:true}).click();await page.getByRole('button',{name:'Сохранить тему',exact:true}).click();await page.getByRole('alert').filter({hasText:'Введите название темы.'}).waitFor();assert.equal(await page.getByLabel('Название темы',{exact:true}).getAttribute('aria-invalid'),'true');
 await page.getByLabel('Название темы',{exact:true}).fill('Работа <img src=x onerror=alert(1)>');await page.getByRole('button',{name:'Сохранить тему',exact:true}).click();await page.locator('#notesNewEntry').waitFor();assert.equal(await page.locator('#page img').count(),0);
 await page.getByRole('button',{name:'Переименовать тему',exact:true}).click();await page.getByLabel('Название темы',{exact:true}).fill('Работа с клиентами');await page.getByRole('button',{name:'Сохранить тему',exact:true}).click();await page.getByRole('heading',{name:'Работа с клиентами',exact:true}).waitFor();assert.equal(topicRows.size,1);
 await page.locator('#notesNewEntry').click();await page.getByLabel('Заголовок записи',{exact:true}).fill('Идея');await page.getByLabel('Текст записи',{exact:true}).fill('Первый текст\n<img src=x onerror=alert(1)>');await page.getByRole('button',{name:'Сохранить запись',exact:true}).click();await noteSaveReady;
 assert.equal(await page.locator('#personalNoteSave').isDisabled(),true);await page.evaluate(()=>savePersonalNote(document.getElementById('personalNoteSave').dataset.key));assert.equal(noteCalls.filter(x=>x.name==='save_personal_note').length,1,'Duplicate save is blocked');releaseNoteSave();
 await page.getByRole('status').filter({hasText:'Сохранено ·'}).waitFor();assert.equal(noteRows.size,1);assert.equal(await page.locator('#page img').count(),0);
 await page.getByLabel('Текст записи',{exact:true}).fill('Черновик');await page.locator('.nav').getByRole('button',{name:'AI-чат',exact:true}).click();await page.locator('.nav').getByRole('button',{name:'Заметки',exact:true}).click();assert.equal(await page.getByLabel('Текст записи',{exact:true}).inputValue(),'Черновик','Draft survives in-app navigation');
 await page.getByRole('button',{name:'Выйти',exact:true}).click();await page.getByRole('dialog',{name:'Есть несохранённые заметки'}).waitFor();await page.keyboard.press('Escape');await page.locator('#notesLeaveDialog').waitFor({state:'detached'});assert.equal(await page.getByLabel('Текст записи',{exact:true}).inputValue(),'Черновик');
 uncertainNote=true;await page.getByRole('button',{name:'Сохранить запись',exact:true}).click();await page.getByRole('alert').filter({hasText:'Не удалось сохранить запись'}).waitFor();const pendingId=noteCalls.at(-1).args.p_request_id;
 await page.getByRole('button',{name:'Сохранить запись',exact:true}).click();await page.getByRole('status').filter({hasText:'Сохранено ·'}).waitFor();assert.equal(noteCalls.at(-1).args.p_request_id,pendingId,'Unknown commit retries same request');assert.equal([...noteRows.values()][0].revision,2,'Retry does not duplicate update');
 await page.reload();await setupNotes();await page.getByRole('button',{name:'Работа с клиентами',exact:true}).click();await page.getByRole('button',{name:'Идея',exact:false}).click();await page.getByLabel('Текст записи',{exact:true}).waitFor();assert.equal(await page.getByLabel('Текст записи',{exact:true}).inputValue(),'Черновик','Saved note survives reload');
 await page.getByLabel('Текст записи',{exact:true}).fill('Мой вариант');const original=[...noteRows.values()][0];original.revision++;original.content='Из другого окна';
 await page.getByRole('button',{name:'Сохранить запись',exact:true}).click();await page.getByRole('alert').filter({hasText:'Запись изменена в другом окне'}).waitFor();assert.equal(await page.getByLabel('Текст записи',{exact:true}).inputValue(),'Мой вариант');await page.getByRole('button',{name:'Сохранить копию',exact:true}).click();await page.getByRole('status').filter({hasText:'Сохранено ·'}).waitFor();assert.equal(noteRows.size,2);assert.equal(original.content,'Из другого окна','Conflict never overwrites remote data');
 for(const width of [320,390,1440]){await page.setViewportSize({width,height:1000});assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true,'Notes fit '+width+'px');}
 await page.setViewportSize({width:390,height:1000});await page.screenshot({path:'test-results/personal-notes-mobile.png',fullPage:true});
 await page.getByRole('button',{name:'Создать тему',exact:true}).click();await page.getByLabel('Название темы',{exact:true}).fill('Идеи');await page.getByRole('button',{name:'Сохранить тему',exact:true}).click();await page.getByRole('heading',{name:'Идеи',exact:true}).waitFor();assert.equal(await page.locator('.notes-workspace .notes-row').count(),0,'Topics keep separate note lists');
 notesReadFails=true;await page.getByRole('button',{name:'Обновить темы',exact:true}).click();await page.getByRole('alert').filter({hasText:'Не удалось загрузить заметки'}).waitFor();notesReadFails=false;await page.getByRole('button',{name:'Повторить',exact:true}).click();await page.getByRole('button',{name:'Работа с клиентами',exact:true}).waitFor();
 await page.evaluate(()=>{state.user={id:'another',email:'another@example.test'};state.profile={id:'another',company_id:'other-company',role:'employee'};state.branchContext={can_manage:false};state.view='notes';render();});await page.getByText('Создайте первую тему, например «Идеи» или «Работа с клиентами».',{exact:true}).waitFor();assert.equal(await page.locator('.notes-row').count(),0,'Account/company change clears private cached notes');
 assert.deepEqual(errors,[]);
 console.log('PASS: real Chromium, assignment parameters, duplicate save, RPC failure recovery, escaping, select keyboard, obsolete response, role navigation, employee directory and 390px layout; responsive TOP at 320/390/440px, desktop table, per-employee assignment, errors, focus, Escape and first-branch creation');
 }finally{await browser.close();await new Promise(r=>server.close(r));}
})().catch(e=>{console.error(e);server.close();process.exitCode=1;});
