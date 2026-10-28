const fs=require('node:fs');
const vm=require('node:vm');
const assert=require('node:assert/strict');
const source=fs.readFileSync('manager-history.js','utf8');
const member={employee_id:'employee',employee_name:'Сотрудник'};
function row(id,score,day=1){return {id:String(id),employee_id:'employee',status:'completed',total_score:score,created_at:`2026-09-${String(day).padStart(2,'0')}T10:00:00Z`,completed_at:`2026-09-${String(day).padStart(2,'0')}T10:30:00Z`,session_scores:{discovery_score:10,objection_score:12,value_score:13,closing_score:14}};}
async function run(batches,{auth=true,fail=false,repeated=false,legacy=false,members=[member]}={}){
 let calls=0,summary;const target={innerHTML:''};
 const state={profile:{company_id:'company',role:'director'},user:{id:'manager'},team:members,view:'analytics',branchContext:{can_manage:true}};
 const context={state,URLSearchParams,AbortController,Date,Intl,console:{warn(){}},requestAnimationFrame(){},SUPABASE_URL:'https://database.example.test',SUPABASE_KEY:'public-test-key',
  document:{getElementById:()=>target,querySelectorAll:()=>[]},ResizeObserver:class{disconnect(){} observe(){}},
  analyticsSummary:members=>{summary=members;return '<div>summary</div>';},
  sb:{auth:{getSession:async()=>({data:{session:auth?{access_token:'current-user-token'}:null}})}},
  fetch:async(url,opts)=>{
   const parsed=new URL(url);assert.equal(parsed.searchParams.get('company_id'),'eq.company');assert.equal(parsed.searchParams.get('employee_id'),'in.('+members.map(e=>e.employee_id).join(',')+')');
   assert.equal(parsed.searchParams.get('status'),'eq.completed');assert.equal(parsed.searchParams.get('order'),'created_at.asc,id.asc');
   assert.equal(opts.headers.Authorization,'Bearer current-user-token');assert.equal(opts.headers.apikey,'public-test-key');assert.equal(opts.cache,'no-store');assert.ok(opts.signal);
   const expectedOffset=batches.slice(0,calls).reduce((n,b)=>n+b.length,0);
   if(!repeated)assert.equal(Number(parsed.searchParams.get('offset')),expectedOffset);
   const data=repeated?batches[0]:(batches[calls]||[]);calls++;
   return {ok:!fail,json:async()=>data};
  }
 };
 if(legacy){context.analytics=context.analyticsSummary;delete context.analyticsSummary;}
 context.window=context;vm.createContext(context);vm.runInContext(source,context);
 context.loadAll=async()=>{};
 const html=await context.analytics();return {html,calls,get summary(){return summary;},state,context,target};
}
(async()=>{
 const first=Array.from({length:500},(_,i)=>row(i,50));const result=await run([first,[row(500,80)],[]]);
 assert.equal(result.calls,3,'Reads until an empty page, including short final pages');assert.equal(result.summary[0].points.length,501,'No 200/500-row chart truncation');
 assert.ok(result.html.includes('Оценённых тренировок: 501'));assert.equal(result.state.team[0].completed_sessions,undefined,'Shared cached team is not rewritten');
 const smallerPages=await run([[row(1,40)],[row(2,80)],[row(3,55)],[]]);assert.equal(smallerPages.calls,4,'Works when server caps responses below requested page size');
 const invalid=[{...row('cancelled',99),status:'cancelled'},row('null',null),row('negative',-1),row('too high',101),row('string','50'),row('late',55,3),row('early',0,1),row('mid',80,2),{...row('other',90),employee_id:'other-company-employee'}];
 const filtered=await run([invalid,[]]);assert.deepEqual(Array.from(filtered.summary[0].points,s=>s.total_score),[0,80,55]);
 assert.ok(filtered.html.includes('спад на 25 баллов'));assert.equal(filtered.summary[0].completed_sessions,3);assert.equal(filtered.summary[0].discovery_score,10);
 const empty=await run([[]]);assert.ok(empty.html.includes('Пока нет завершённых тренировок с оценкой'));assert.ok(!empty.html.includes('type="range"'));
 const single=await run([[row('single',70)],[]]);assert.ok(single.html.includes('Для сравнения нужна ещё одна'));assert.ok(single.html.includes('max="1"'));
 const failure=await run([[]],{fail:true});assert.ok(failure.html.includes('role="alert"'));assert.ok(failure.html.includes('Повторить загрузку графиков'));
 const noAuth=await run([[]],{auth:false});assert.equal(noAuth.calls,0);assert.ok(noAuth.html.includes('role="alert"'));
 const stalled=await run([[row(1,10)]],{repeated:true});assert.equal(stalled.calls,2);assert.ok(stalled.html.includes('role="alert"'),'Repeated pages fail rather than hang or silently truncate');
 const compatible=await run([[row('legacy',60)],[]],{legacy:true});assert.ok(compatible.html.includes('Оценённых тренировок: 1'),'Older cached HTML retains a working analytics summary during rollout');
 const switching=await run([[row('first',20),{...row('second',90),employee_id:'second'}],[]],{members:[member,{employee_id:'second',employee_name:'Второй <сотрудник>'},{employee_id:'empty',employee_name:'Без тренировок'}]});
 assert.equal(switching.summary.length,1);assert.equal(switching.summary[0].employee_id,'employee');
 assert.ok(switching.html.includes('Второй &lt;сотрудник&gt;'),'Employee names are escaped in options');
 switching.context.changeAnalyticsEmployee({value:'second'});assert.equal(switching.summary[0].avg_score,90);assert.ok(switching.target.innerHTML.includes('90 из 100'));
 switching.context.changeAnalyticsEmployee({value:'empty'});assert.equal(switching.summary[0].completed_sessions,0);assert.ok(switching.target.innerHTML.includes('Пока нет завершённых тренировок'));
 const before=switching.target.innerHTML;switching.context.changeAnalyticsEmployee({value:'unauthorized'});assert.equal(switching.target.innerHTML,before);
 switching.context.clearEmployeeAnalyticsCharts();switching.context.changeAnalyticsEmployee({value:'second'});assert.equal(switching.target.innerHTML,before,'Stale selector cannot render old authorized data');
 const stale=await run([[]]);stale.context.clearEmployeeAnalyticsCharts();assert.equal(stale.context.state.view,'analytics');
 console.log('PASS: 501-point history, server page caps, valid scores including zero, chronology, own-team filtering, unchanged shared state, empty/single/error/auth and stalled pagination');
})().catch(e=>{console.error(e);process.exitCode=1;});
