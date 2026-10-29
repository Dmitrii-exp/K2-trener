(function(){
  const isManager=()=>state.branchContext?.branch_role
    ? state.branchContext.branch_role==='branch_director'
    : ["director","admin","manager"].includes(state.profile?.role);
  window.canViewCompanyHistory=isManager;
  function empName(id){
    const e=(state.historyEmployees||[]).find(x=>x.id===id);
    if(!e)return id===state.user?.id?(state.profile?.first_name||state.user?.email||"Сотрудник"):"Сотрудник";
    return String([e.first_name,e.last_name].filter(Boolean).join(" ")).trim()||"Сотрудник";
  }
  window.loadAll=async function(){
    state.branchContext=null;
    const context=await sb.rpc('company_branch_context');
    if(context.error)throw new Error('Не удалось проверить права доступа к филиалу');
    state.branchContext=context.data||{};
    const ah=await sb.from("saletrening_sessions").select("status,scenario_id,total_score,created_at,completed_at,difficulty_level,deal_closed,voice_mode").eq("employee_id",state.user.id).eq("status","completed").order("completed_at",{ascending:false}).limit(1000);
    state.achievementHistory=ah.data||[];
    let q=await sb.from("saletrening_scenarios").select("*").eq("active",true).order("id");
    state.scenarios=q.data||[];
    state.historyEmployees=[];
    let ss=await sb.from("my_training_stats").select("*").eq("employee_id",state.user.id).maybeSingle();
    state.stats=ss.data||{completed_sessions:0,avg_score:0,best_score:0,active_sessions:0};
    if(isManager()&&state.profile.company_id){
      const p=await sb.from("profiles").select("id,first_name,last_name,role,company_id").eq("company_id",state.profile.company_id);
      state.historyEmployees=p.data||[];
      const h=await sb.from("saletrening_sessions").select("id,employee_id,scenario_id,status,total_score,ai_summary,created_at,completed_at,duration_seconds").eq("company_id",state.profile.company_id).order("created_at",{ascending:false}).limit(200);
      state.history=h.data||[];
      const ids=state.historyEmployees.filter(x=>x.id!==state.user.id).map(x=>x.id);
      const sessions=state.history.filter(x=>ids.includes(x.employee_id));
      const completed=sessions.filter(x=>x.status==="completed"&&x.total_score!=null);
      let scores=[];
      if(completed.length){
        const sq=await sb.from("session_scores").select("session_id,discovery_score,objection_score,value_score,closing_score,communication_score").eq("company_id",state.profile.company_id);
        if(!sq.error)scores=(sq.data||[]).filter(x=>completed.some(y=>y.id===x.session_id));
      }
      state.team=state.historyEmployees.filter(x=>x.id!==state.user.id).map(m=>{
        const ms=sessions.filter(x=>x.employee_id===m.id),cs=ms.filter(x=>x.status==="completed"&&x.total_score!=null);
        const vals=cs.map(x=>Number(x.total_score)||0),sc=scores.filter(x=>cs.some(y=>y.id===x.session_id));
        const avg=k=>{const a=sc.map(x=>Number(x[k])).filter(Number.isFinite);return a.length?Math.round(a.reduce((u,v)=>u+v,0)/a.length):0};
        const last=ms[0]||null;
        return {employee_role:m.role,employee_id:m.id,employee_name:empName(m.id),sessions_count:ms.length,completed_sessions:cs.length,avg_score:vals.length?Math.round(vals.reduce((u,v)=>u+v,0)/vals.length):0,discovery_score:avg("discovery_score"),objection_score:avg("objection_score"),value_score:avg("value_score"),closing_score:avg("closing_score"),last_training_at:last?.created_at||null,last_training_status:last?.status||null,last_training_id:last?.id||null};
      }).sort((a,b)=>new Date(b.last_training_at||0)-new Date(a.last_training_at||0));
    }else{
      const h=await sb.from("saletrening_sessions").select("id,scenario_id,status,total_score,ai_summary,created_at,completed_at,duration_seconds").eq("employee_id",state.user.id).order("created_at",{ascending:false}).limit(50);
      state.history=h.data||[];state.team=[];
    }
  };
  window.historyPage=async function(){
    await window.loadAll();
    const manager=isManager(),filter=state.historyEmployeeFilter||"all";
    const items=(state.history||[]).filter(x=>!manager||filter==="all"||x.employee_id===filter);
    const status=s=>({completed:"Завершена",started:"Не завершена",in_progress:"В процессе",limit_exceeded:"Лимит превышен",insufficient_data:"Недостаточно данных",cancelled:"Отменена"}[s]||s||"—");
    const date=v=>v?new Date(v).toLocaleString("ru-RU",{day:"2-digit",month:"2-digit",year:"numeric",hour:"2-digit",minute:"2-digit"}):"—";
    const opts=manager?'<select id="historyEmployeeFilter" onchange="state.historyEmployeeFilter=this.value;page()" style="min-width:220px"><option value="all">Все сотрудники</option>'+(state.historyEmployees||[]).filter(x=>x.id!==state.user.id).map(x=>'<option value="'+esc(x.id)+'" '+(filter===x.id?"selected":"")+'>'+esc(empName(x.id))+'</option>').join("")+'</select>':"";
    if(!items.length)return '<div class="top"><div><h2>История тренировок</h2><div class="muted">'+(manager?(state.branchContext?.branch_role==='branch_director'?"История сотрудников филиала":"История всей команды"):"Последние тренировки менеджера")+'</div></div>'+opts+'</div><div class="empty">'+(manager&&filter!=="all"?"У выбранного сотрудника пока нет тренировок.":"История пока пуста.")+'</div>';
    return '<div class="top"><div><h2>История тренировок</h2><div class="muted">'+(manager?(filter==="all"?(state.branchContext?.branch_role==='branch_director'?"История сотрудников филиала":"История всей команды"):"История: "+esc(empName(filter))):"Последние тренировки менеджера")+'</div></div><div style="display:flex;gap:10px;align-items:center;flex-wrap:wrap">'+opts+'<span class="pill">'+items.length+' записей</span></div></div><div class="card" style="padding:0;overflow:hidden"><div style="display:grid">'+items.map((x,i)=>{const sc=state.scenarios.find(s=>String(s.id)===String(x.scenario_id));return '<button type="button" class="history-row" onclick="openHistorySession(this.dataset.id)" data-id="'+esc(x.id)+'" style="border:0;border-bottom:'+(i===items.length-1?'0':'1px')+' solid var(--line);background:#fff;text-align:left;padding:18px 20px;display:grid;grid-template-columns:minmax(0,1fr) auto;gap:12px;width:100%"><div><div style="font-weight:800;font-size:16px">'+esc(sc?.title||"Тренировка")+'</div><div class="muted" style="margin-top:5px">'+(manager?esc(empName(x.employee_id))+' · ':"")+date(x.created_at)+' · '+status(x.status)+'</div></div><div style="text-align:right"><div style="font-size:22px;font-weight:850">'+(x.total_score==null?'—':esc(x.total_score))+'</div><div class="muted">'+(x.total_score==null?"без оценки":"балл")+'</div></div></button>'}).join("")+'</div></div>';
  };
  window.openHistorySession=async function(id){
    const p=$("page");if(!p)return;p.innerHTML='<div class="empty">Загрузка отчёта…</div>';
    let rq=sb.from("saletrening_sessions").select("id,employee_id,company_id,scenario_id,status,total_score,ai_summary,ai_evaluation,transcript,created_at,completed_at,duration_seconds").eq("id",id);
    rq=isManager()?rq.eq("company_id",state.profile.company_id):rq.eq("employee_id",state.user.id);
    const r=await rq.maybeSingle();if(r.error||!r.data){p.innerHTML='<div class="empty">Не удалось открыть тренировку.</div>';return}
    const q=await sb.from("session_scores").select("overall_score,discovery_score,objection_score,value_score,closing_score,communication_score,next_step_score,strengths,weaknesses,recommendations").eq("session_id",id).maybeSingle();
    if(q.error){p.innerHTML='<div class="empty">Не удалось загрузить оценку тренировки.</div>';return}
    const buyer=Number(r.data.scenario_id)>=19&&Number(r.data.scenario_id)<=33;
    const x=r.data,ev=(x.ai_evaluation&&typeof x.ai_evaluation==="object")?x.ai_evaluation:{},s=q.data||{...ev},sc=state.scenarios.find(v=>String(v.id)===String(x.scenario_id)),tr=Array.isArray(x.transcript)?x.transcript:[];
    const total=Number.isFinite(Number(s.overall_score))&&Number(s.overall_score)>0?Math.round(Number(s.overall_score)):null;
    const n=v=>{const z=Number(v);return Number.isFinite(z)?Math.max(0,Math.min(20,Math.round(z))):0};
    const date=v=>v?new Date(v).toLocaleString("ru-RU",{day:"2-digit",month:"2-digit",year:"numeric",hour:"2-digit",minute:"2-digit"}):"—";
    const status=({completed:"Завершена",started:"Не завершена",in_progress:"В процессе",limit_exceeded:"Лимит превышен",insufficient_data:"Недостаточно данных",cancelled:"Отменена"}[x.status]||x.status||"—");
    const arr=v=>Array.isArray(v)?v.filter(Boolean):[];
    const criteria=buyer?[["Выяснение условий поставщика",n(s.discovery_score)],["Работа с отказами продавца",n(s.objection_score)],["Аргументация и торг",n(s.value_score)],["Выгода и защита интересов",n(s.communication_score)],["Фиксация договорённостей",n(s.closing_score)]]:[["Выявление потребности",n(s.discovery_score)],["Презентация продукта",n(s.value_score)],["Работа с возражениями",n(s.objection_score)],["Дожим / закрытие сделки",n(s.closing_score)],["Коммуникация",n(s.communication_score)]];
    const dialog=tr.length?tr.map(m=>{const sp=String(m?.speaker||m?.role||"").toLowerCase(),man=["manager","user","employee"].includes(sp),txt=m?.content??m?.text??m?.message??"";return '<div class="msg '+(man?"manager":"client")+'"><b>'+(man?(buyer?"Закупщик":"Менеджер"):(buyer?"Продавец":"Клиент"))+':</b> '+esc(txt)+'</div>'}).join(""):'<div class="empty">Полный диалог не сохранён.</div>';
    const list=(a,empty)=>a.length?'<ul class="report-list">'+a.map(v=>'<li>'+esc(v)+'</li>').join("")+'</ul>':'<div class="report-empty">'+empty+'</div>';
    p.innerHTML='<div class="report-page"><div class="report-top"><button class="secondary" onclick="state.view=\'history\';page()">← К истории</button><span class="pill">'+esc(status)+'</span></div><div class="report-title-row"><div><h2>'+esc(sc?.title||"Тренировка")+'</h2><div class="muted">'+(isManager()?esc(empName(x.employee_id))+' · ':"")+date(x.created_at)+'</div></div></div><div class="report-summary-grid"><div class="report-score-card"><div class="report-card-label">Итоговый балл</div><div class="report-score">'+(total===null?'—':total)+' <span>'+(total===null?"оценка не сформирована":"из 100")+'</span></div></div><div class="report-info-card"><div class="report-card-label">Сценарий</div><strong>'+esc(sc?.title||"Тренировка")+'</strong></div><div class="report-info-card"><div class="report-card-label">Завершена</div><strong>'+date(x.completed_at)+'</strong></div></div>'+(total===null?'':'<section class="report-section"><div class="report-section-title"><h3>Критерии оценки</h3><span>5 × 20 = 100</span></div><div class="criteria-grid">'+criteria.map(v=>'<div class="criterion"><div class="criterion-head"><span>'+esc(v[0])+'</span><b>'+v[1]+' / 20</b></div><div class="criterion-bar"><i style="width:'+(v[1]*5)+'%"></i></div></div>').join("")+'</div><div class="criteria-total"><span>Итог</span><b>'+total+' / 100</b></div></section>')+'<section class="report-section"><h3>Анализ AI</h3><div class="analysis-grid"><div class="analysis-card positive"><h3>Сильные стороны</h3>'+list(arr(s.strengths),"Нет сохранённых сильных сторон.")+'</div><div class="analysis-card negative"><h3>Что улучшить</h3>'+list(arr(s.weaknesses),"Недостаточно данных для оценки.")+'</div></div>'+(arr(s.recommendations).length?'<div class="recommendation-card"><strong>Рекомендации</strong>'+list(arr(s.recommendations),"")+'</div>':"")+(x.ai_summary?'<div class="ai-conclusion"><strong>Вывод AI</strong><p>'+esc(x.ai_summary)+'</p></div>':"")+'</section>'+(buyer&&typeof buyerNegotiationResult==='function'?buyerNegotiationResult(ev):'')+'<section class="report-section"><h3>Полный диалог</h3><div class="messages report-dialog">'+dialog+'</div></section></div>';
  };
})();
/* Employee analytics: full authorized score history, responsive ordinal charts. */
(function(){
  const renderSummary=typeof analyticsSummary==='function'?analyticsSummary:window.analytics;
  let generation=0,controller=null,observer=null,selectedEmployeeId=null,loadedMembers=[],loadedToken=null;
  const chartData=new WeakMap();
  const escape=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const date=v=>{const d=new Date(v);return Number.isFinite(d.getTime())?d.toLocaleString('ru-RU',{day:'2-digit',month:'2-digit',year:'numeric',hour:'2-digit',minute:'2-digit'}):'Дата не сохранена';};
  const score=s=>s.total_score!==null&&s.total_score!==undefined&&typeof s.total_score==='number'&&Number.isFinite(s.total_score)&&s.total_score>=0&&s.total_score<=100;
  window.clearEmployeeAnalyticsCharts=function(){
    generation++;loadedMembers=[];loadedToken=null;controller?.abort();controller=null;observer?.disconnect();observer=null;
  };
  async function readHistory(members,signal){
    const companyId=state.profile?.company_id;
    if(!companyId)throw new Error('Company missing');
    const asOf=new Date().toISOString(),seen=new Set(),rows=[];
    let offset=0;
    for(;;){
      const {data,error}=await sb.auth.getSession();
      const token=data?.session?.access_token;
      if(error||!token)throw new Error('Session expired');
      const params=new URLSearchParams({
        select:'id,employee_id,status,total_score,voice_mode,created_at,completed_at,session_scores(overall_score,discovery_score,objection_score,value_score,closing_score,communication_score)',
        company_id:'eq.'+companyId,employee_id:'in.('+members.map(e=>e.employee_id).join(',')+')',
        status:'eq.completed',created_at:'lte.'+asOf,or:'(completed_at.lte.'+asOf+',completed_at.is.null)',
        order:'created_at.asc,id.asc',limit:'500',offset:String(offset)
      });
      const response=await fetch(SUPABASE_URL+'/rest/v1/saletrening_sessions?'+params,{
        headers:{apikey:SUPABASE_KEY,Authorization:'Bearer '+token},signal,cache:'no-store'
      });
      if(!response.ok)throw new Error('History unavailable');
      const batch=await response.json();
      if(!Array.isArray(batch))throw new Error('Invalid history');
      if(!batch.length)break;
      let added=0;
      for(const row of batch){if(row.id&&!seen.has(row.id)){seen.add(row.id);rows.push(row);added++;}}
      if(!added)throw new Error('History pagination stalled');
      offset+=batch.length;
    }
    return rows;
  }
  function series(members,rows){
    const grouped=new Map(members.map(e=>[e.employee_id,[]]));
    for(const s of rows){if(s.status==='completed'&&score(s)&&grouped.has(s.employee_id))grouped.get(s.employee_id).push(s);}
    return members.map(e=>{
      const points=grouped.get(e.employee_id).sort((a,b)=>{
        const at=new Date(a.completed_at||a.created_at).getTime()||0,bt=new Date(b.completed_at||b.created_at).getTime()||0;
        return at-bt||String(a.id).localeCompare(String(b.id));
      });
      const skill=key=>{const values=points.map(s=>{const details=Array.isArray(s.session_scores)?s.session_scores[0]:s.session_scores;return details?.[key];}).filter(v=>typeof v==='number'&&Number.isFinite(v));return values.length?Math.round(values.reduce((a,b)=>a+b,0)/values.length):0;};
      return {...e,points,completed_sessions:points.length,avg_score:points.length?Math.round(points.reduce((a,s)=>a+s.total_score,0)/points.length):0,
        discovery_score:skill('discovery_score'),objection_score:skill('objection_score'),value_score:skill('value_score'),closing_score:skill('closing_score')};
    });
  }
  function selectedDescription(point,index){
    return 'Тренировка №'+(index+1)+' · '+point.total_score+' из 100 · '+date(point.completed_at||point.created_at)+' · '+(point.voice_mode?'Голосовая':'Текстовая');
  }
  function draw(card){
    const record=chartData.get(card);if(!record||!card.isConnected)return;
    const {points,name}=record,plot=card.querySelector('.employee-progress-plot');
    if(!plot)return;
    const width=Math.max(240,Math.round(plot.clientWidth)),height=238,left=36,right=16,top=24,bottom=182;
    const x=i=>points.length===1?(left+width-right)/2:left+(width-left-right)*i/(points.length-1);
    const y=value=>bottom-(bottom-top)*value/100;
    const index=Math.max(0,Math.min(points.length-1,Number(card.querySelector('input[type="range"]').value)-1));
    const grid=[0,25,50,75,100].map(v=>'<line x1="'+left+'" x2="'+(width-right)+'" y1="'+y(v)+'" y2="'+y(v)+'" stroke="var(--line)"/><text x="'+(left-9)+'" y="'+(y(v)+4)+'" text-anchor="end">'+v+'</text>').join('');
    const ticks=points.length<=6?points.map((_,i)=>i):[...new Set([0,Math.round((points.length-1)/4),Math.round((points.length-1)/2),Math.round((points.length-1)*3/4),points.length-1])];
    const labels=ticks.map(i=>'<text x="'+x(i)+'" y="204" text-anchor="middle">'+(i+1)+'</text>').join('');
    const line=points.length>1?'<polyline class="employee-progress-line" points="'+points.map((p,i)=>x(i)+','+y(p.total_score)).join(' ')+'" fill="none" stroke="var(--p)" stroke-width="2.5" stroke-linejoin="round"/>':'';
    const dots=points.length<=30?points.map((p,i)=>'<circle cx="'+x(i)+'" cy="'+y(p.total_score)+'" r="3" fill="var(--p)"/>').join(''):'';
    plot.innerHTML='<svg width="100%" height="238" viewBox="0 0 '+width+' '+height+'" role="img" aria-label="'+escape('Баллы сотрудника '+name+' по '+points.length+' тренировкам; вертикальная шкала от 0 до 100')+'"><g font-size="12" fill="var(--muted)" font-family="inherit"><text x="0" y="12">Баллы</text>'+grid+labels+'<text x="'+((left+width-right)/2)+'" y="229" text-anchor="middle">Номер тренировки</text></g>'+line+dots+'<circle class="employee-progress-selected" cx="'+x(index)+'" cy="'+y(points[index].total_score)+'" r="5" fill="var(--p)" stroke="var(--card,#fff)" stroke-width="2"/></svg>';
    card.querySelector('output').textContent=selectedDescription(points[index],index);
  }
  window.selectEmployeeAnalyticsTraining=function(input){const card=input.closest('.employee-progress-card');if(card)draw(card);};
  function cards(members,token){
    return '<section class="employee-progress-section"><h3>Динамика сотрудника</h3><p class="muted">По горизонтали — оценённые тренировки по порядку, по вертикали — баллы от 0 до 100. Слева ранние, справа последние.</p>'+members.map((e,i)=>{
      const points=e.points,latest=points.at(-1),difference=points.length>1?latest.total_score-points.at(-2).total_score:null;
      const trend=difference===null?(points.length?'Для сравнения нужна ещё одна оценённая тренировка.':'Пока нет завершённых тренировок с оценкой.'):difference>0?'К предыдущей тренировке: рост на '+difference+' баллов.':difference<0?'К предыдущей тренировке: спад на '+Math.abs(difference)+' баллов.':'Результат не изменился по сравнению с предыдущей тренировкой.';
      const title='<div class="employee-progress-heading"><h4>'+escape(e.employee_name)+'</h4><span class="pill">Оценённых тренировок: '+points.length+'</span></div><p class="muted">'+trend+'</p>';
      if(!points.length)return '<article class="card employee-progress-card">'+title+'</article>';
      return '<article class="card employee-progress-card" data-analytics-token="'+token+'" data-analytics-member="'+i+'">'+title+'<div class="employee-progress-plot"></div><label class="muted" for="employee-progress-'+token+'-'+i+'">Выбрать тренировку</label><input id="employee-progress-'+token+'-'+i+'" type="range" min="1" max="'+points.length+'" value="'+points.length+'" step="1" aria-label="'+escape('Тренировка сотрудника '+e.employee_name)+'" oninput="selectEmployeeAnalyticsTraining(this)"><output aria-live="polite">'+escape(selectedDescription(latest,points.length-1))+'</output></article>';
    }).join('')+'</section>';
  }
  function mount(members,token){
    if(generation!==token||state.view!=='analytics')return;
    observer=new ResizeObserver(entries=>{for(const e of entries)draw(e.target.closest('.employee-progress-card'));});
    for(const card of document.querySelectorAll('[data-analytics-token="'+token+'"]')){
      const member=members[Number(card.dataset.analyticsMember)];
      chartData.set(card,{points:member.points,name:member.employee_name});draw(card);observer.observe(card.querySelector('.employee-progress-plot'));
    }
  }
  function employeeResult(member,token){
    return renderSummary([member],true)+cards([member],token);
  }
  window.changeAnalyticsEmployee=function(input){
    if(loadedToken!==generation||state.view!=='analytics'||!window.canViewCompanyHistory())return;
    const member=loadedMembers.find(e=>e.employee_id===input.value);
    const target=document.getElementById('employee-analytics-result');
    if(!member||!target)return;
    selectedEmployeeId=member.employee_id;
    observer?.disconnect();observer=null;
    target.innerHTML=employeeResult(member,loadedToken);
    mount([member],loadedToken);
  };
  window.analytics=async function(){
    window.clearEmployeeAnalyticsCharts();const token=generation;
    controller=new AbortController();const signal=controller.signal;
    try{
      await window.loadAll();
      if(generation!==token)return '';
      if(!window.canViewCompanyHistory())return '<div class="empty">Нет доступа к аналитике команды.</div>';
      const members=state.team||[];
      if(!members.length)return renderSummary(members);
      const rows=await readHistory(members,signal);
      if(generation!==token)return '';
      const complete=series(members,rows);
      loadedMembers=complete;loadedToken=token;
      const selected=complete.find(e=>e.employee_id===selectedEmployeeId)||complete[0];
      selectedEmployeeId=selected.employee_id;
      requestAnimationFrame(()=>mount([selected],token));
      return `<style>
        .employee-analytics-picker{margin-bottom:24px;max-width:480px}
        .employee-analytics-picker label{display:block;margin-bottom:8px;font-weight:600}
        .employee-analytics-picker select{width:100%;min-width:0;min-height:44px}
        .employee-analytics-picker select:focus-visible{outline:3px solid var(--p);outline-offset:3px}
        .employee-progress-section{margin-top:28px}
        .employee-progress-card{padding:20px;margin-top:16px;min-width:0}
        .employee-progress-heading{display:flex;gap:12px;align-items:center;justify-content:space-between;flex-wrap:wrap}
        .employee-progress-heading h4{font-size:18px;margin:0;overflow-wrap:anywhere;min-width:0}
        .employee-progress-plot{width:100%;height:238px;min-width:0}
        .employee-progress-plot svg{display:block;overflow:visible}
        .employee-progress-card input[type=range]{display:block;width:100%;margin:12px 0 16px;accent-color:var(--p);min-height:32px;cursor:pointer}
        .employee-progress-card input:focus-visible{outline:3px solid var(--p);outline-offset:3px}
        .employee-progress-card output{display:block;font-size:13px;line-height:1.6;overflow-wrap:anywhere;min-height:42px}
        @media(max-width:700px){.employee-progress-card{padding:16px}}
      </style><div class="field employee-analytics-picker"><label for="analytics-employee">Сотрудник</label><select id="analytics-employee" onchange="changeAnalyticsEmployee(this)">`+complete.map(e=>'<option value="'+escape(e.employee_id)+'"'+(e.employee_id===selectedEmployeeId?' selected':'')+'>'+escape(e.employee_name)+'</option>').join('')+'</select></div><div id="employee-analytics-result">'+employeeResult(selected,token)+'</div>';
    }catch(error){
      if(generation!==token||error?.name==='AbortError')return '';
      console.warn('[SaleTrener analytics] score history unavailable');
      return '<div class="top"><h2>Аналитика сотрудника</h2></div><div class="empty" role="alert">Не удалось загрузить полную историю оценок. <button class="secondary" onclick="page()">Повторить загрузку графиков</button></div>';
    }
  };
})();
