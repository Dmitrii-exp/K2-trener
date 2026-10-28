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
   if(name==='assign_company_branch')return await new Promise(resolve=>window.finishAssignment=resolve);
   return {data:null,error:null};
  };render();
 });
 await page.getByRole('button',{name:'Сохранить назначение'}).waitFor();
 assert.equal(await page.locator('#page img').count(),0,'Branch name is escaped');
 await page.getByLabel('Сотрудник',{exact:true}).focus();
 await page.keyboard.press('ArrowDown');await page.keyboard.press('Tab');
 assert.equal(await page.locator('#branchTarget').evaluate(el=>el===document.activeElement),true);
 await page.getByRole('button',{name:'Сохранить назначение'}).click();
 assert.equal(await page.locator('#assignBranchButton').isDisabled(),true);
 await page.evaluate(()=>assignCompanyBranch('company'));
 const calls=await page.evaluate(()=>rpcCalls.filter(c=>c.name==='assign_company_branch'));
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
 const call=await page.evaluate(()=>rpcCalls.filter(c=>c.name==='assign_company_branch').at(-1));
 assert.deepEqual(call.args,{p_company_id:'company',p_branch_id:'branch',p_employee_id:'employee',p_branch_role:'branch_director'});
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
 await page.evaluate(()=>{state.branchContext={can_manage:false,branch_role:'branch_director'};render();});
 assert.equal(await page.getByRole('button',{name:'Назначить должность и филиал',exact:true}).count(),0,'Only network managers can assign');
 assert.deepEqual(errors,[]);
 console.log('PASS: real Chromium, assignment parameters, duplicate save, RPC failure recovery, escaping, select keyboard, obsolete response, role navigation, employee directory and 390px layout; responsive TOP at 320/390/440px, desktop table, per-employee assignment, errors, focus, Escape and first-branch creation');
 }finally{await browser.close();await new Promise(r=>server.close(r));}
})().catch(e=>{console.error(e);server.close();process.exitCode=1;});
