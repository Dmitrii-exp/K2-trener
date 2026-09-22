(function(){
  const isManager=()=>["director","admin","manager"].includes(state.profile?.role);
  function empName(id){
    const e=(state.historyEmployees||[]).find(x=>x.id===id);
    if(!e)return id===state.user?.id?(state.profile?.first_name||state.user?.email||"Сотрудник"):"Сотрудник";
    return String([e.first_name,e.last_name].filter(Boolean).join(" ")).trim()||"Сотрудник";
  }
  window.loadAll=async function(){
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
        return {employee_id:m.id,employee_name:empName(m.id),sessions_count:ms.length,completed_sessions:cs.length,avg_score:vals.length?Math.round(vals.reduce((u,v)=>u+v,0)/vals.length):0,discovery_score:avg("discovery_score"),objection_score:avg("objection_score"),value_score:avg("value_score"),closing_score:avg("closing_score"),last_training_at:last?.created_at||null,last_training_status:last?.status||null,last_training_id:last?.id||null};
      }).sort((a,b)=>new Date(b.last_training_at||0)-new Date(a.last_training_at||0));
    }else{
      const h=await sb.from("saletrening_sessions").select("id,scenario_id,status,total_score,ai_summary,created_at,completed_at,duration_seconds").eq("employee_id",state.user.id).order("created_at",{ascending:false}).limit(50);
      state.history=h.data||[];state.team=[];
    }
  };
  window.historyPage=function(){
    const manager=isManager(),filter=state.historyEmployeeFilter||"all";
    const items=(state.history||[]).filter(x=>!manager||filter==="all"||x.employee_id===filter);
    const status=s=>({completed:"Завершена",started:"Не завершена",in_progress:"В процессе",limit_exceeded:"Лимит превышен",insufficient_data:"Недостаточно данных",cancelled:"Отменена"}[s]||s||"—");
    const date=v=>v?new Date(v).toLocaleString("ru-RU",{day:"2-digit",month:"2-digit",year:"numeric",hour:"2-digit",minute:"2-digit"}):"—";
    const opts=manager?'<select id="historyEmployeeFilter" onchange="state.historyEmployeeFilter=this.value;page()" style="min-width:220px"><option value="all">Все сотрудники</option>'+(state.historyEmployees||[]).filter(x=>x.id!==state.user.id).map(x=>'<option value="'+esc(x.id)+'" '+(filter===x.id?"selected":"")+'>'+esc(empName(x.id))+'</option>').join("")+'</select>':"";
    if(!items.length)return '<div class="top"><div><h2>История тренировок</h2><div class="muted">'+(manager?"История всей команды":"Последние тренировки менеджера")+'</div></div>'+opts+'</div><div class="empty">'+(manager&&filter!=="all"?"У выбранного сотрудника пока нет тренировок.":"История пока пуста.")+'</div>';
    return '<div class="top"><div><h2>История тренировок</h2><div class="muted">'+(manager?(filter==="all"?"История всей команды":"История: "+esc(empName(filter))):"Последние тренировки менеджера")+'</div></div><div style="display:flex;gap:10px;align-items:center;flex-wrap:wrap">'+opts+'<span class="pill">'+items.length+' записей</span></div></div><div class="card" style="padding:0;overflow:hidden"><div style="display:grid">'+items.map((x,i)=>{const sc=state.scenarios.find(s=>String(s.id)===String(x.scenario_id));return '<button type="button" class="history-row" onclick="openHistorySession(this.dataset.id)" data-id="'+esc(x.id)+'" style="border:0;border-bottom:'+(i===items.length-1?'0':'1px')+' solid var(--line);background:#fff;text-align:left;padding:18px 20px;display:grid;grid-template-columns:minmax(0,1fr) auto;gap:12px;width:100%"><div><div style="font-weight:800;font-size:16px">'+esc(sc?.title||"Тренировка")+'</div><div class="muted" style="margin-top:5px">'+(manager?esc(empName(x.employee_id))+' · ':"")+date(x.created_at)+' · '+status(x.status)+'</div></div><div style="text-align:right"><div style="font-size:22px;font-weight:850">'+(x.total_score==null?'—':esc(x.total_score))+'</div><div class="muted">'+(x.total_score==null?"без оценки":"балл")+'</div></div></button>'}).join("")+'</div></div>';
  };
  window.openHistorySession=async function(id){
    const p=$("page");if(!p)return;p.innerHTML='<div class="empty">Загрузка отчёта…</div>';
    let rq=sb.from("saletrening_sessions").select("id,employee_id,company_id,scenario_id,status,total_score,ai_summary,transcript,created_at,completed_at,duration_seconds").eq("id",id);
    rq=isManager()?rq.eq("company_id",state.profile.company_id):rq.eq("employee_id",state.user.id);
    const r=await rq.maybeSingle();if(r.error||!r.data){p.innerHTML='<div class="empty">Не удалось открыть тренировку.</div>';return}
    const q=await sb.from("session_scores").select("overall_score,discovery_score,objection_score,value_score,closing_score,communication_score,next_step_score,strengths,weaknesses,recommendations").eq("session_id",id).maybeSingle();
    if(q.error){p.innerHTML='<div class="empty">Не удалось загрузить оценку тренировки.</div>';return}
    const x=r.data,s=q.data||{},sc=state.scenarios.find(v=>String(v.id)===String(x.scenario_id)),tr=Array.isArray(x.transcript)?x.transcript:[];
    const total=Number.isFinite(Number(s.overall_score))&&Number(s.overall_score)>0?Math.round(Number(s.overall_score)):null;
    const n=v=>{const z=Number(v);return Number.isFinite(z)?Math.max(0,Math.min(20,Math.round(z))):0};
    const date=v=>v?new Date(v).toLocaleString("ru-RU",{day:"2-digit",month:"2-digit",year:"numeric",hour:"2-digit",minute:"2-digit"}):"—";
    const status=({completed:"Завершена",started:"Не завершена",in_progress:"В процессе",limit_exceeded:"Лимит превышен",insufficient_data:"Недостаточно данных",cancelled:"Отменена"}[x.status]||x.status||"—");
    const arr=v=>Array.isArray(v)?v.filter(Boolean):[];
    const criteria=[["Выявление потребности",n(s.discovery_score)],["Презентация продукта",n(s.value_score)],["Работа с возражениями",n(s.objection_score)],["Дожим / закрытие сделки",n(s.closing_score)],["Коммуникация",n(s.communication_score)]];
    const dialog=tr.length?tr.map(m=>{const sp=String(m?.speaker||m?.role||"").toLowerCase(),man=["manager","user","employee"].includes(sp),txt=m?.content??m?.text??m?.message??"";return '<div class="msg '+(man?"manager":"client")+'"><b>'+(man?"Менеджер":"Клиент")+':</b> '+esc(txt)+'</div>'}).join(""):'<div class="empty">Полный диалог не сохранён.</div>';
    const list=(a,empty)=>a.length?'<ul class="report-list">'+a.map(v=>'<li>'+esc(v)+'</li>').join("")+'</ul>':'<div class="report-empty">'+empty+'</div>';
    p.innerHTML='<div class="report-page"><div class="report-top"><button class="secondary" onclick="state.view=\'history\';page()">← К истории</button><span class="pill">'+esc(status)+'</span></div><div class="report-title-row"><div><h2>'+esc(sc?.title||"Тренировка")+'</h2><div class="muted">'+(isManager()?esc(empName(x.employee_id))+' · ':"")+date(x.created_at)+'</div></div></div><div class="report-summary-grid"><div class="report-score-card"><div class="report-card-label">Итоговый балл</div><div class="report-score">'+(total===null?'—':total)+' <span>'+(total===null?"оценка не сформирована":"из 100")+'</span></div></div><div class="report-info-card"><div class="report-card-label">Сценарий</div><strong>'+esc(sc?.title||"Тренировка")+'</strong></div><div class="report-info-card"><div class="report-card-label">Завершена</div><strong>'+date(x.completed_at)+'</strong></div></div>'+(total===null?'':'<section class="report-section"><div class="report-section-title"><h3>Критерии оценки</h3><span>5 × 20 = 100</span></div><div class="criteria-grid">'+criteria.map(v=>'<div class="criterion"><div class="criterion-head"><span>'+esc(v[0])+'</span><b>'+v[1]+' / 20</b></div><div class="criterion-bar"><i style="width:'+(v[1]*5)+'%"></i></div></div>').join("")+'</div><div class="criteria-total"><span>Итог</span><b>'+total+' / 100</b></div></section>')+'<section class="report-section"><h3>Анализ AI</h3><div class="analysis-grid"><div class="analysis-card positive"><h3>Сильные стороны</h3>'+list(arr(s.strengths),"Нет сохранённых сильных сторон.")+'</div><div class="analysis-card negative"><h3>Что улучшить</h3>'+list(arr(s.weaknesses),"Недостаточно данных для оценки.")+'</div></div>'+(arr(s.recommendations).length?'<div class="recommendation-card"><strong>Рекомендации</strong>'+list(arr(s.recommendations),"")+'</div>':"")+(x.ai_summary?'<div class="ai-conclusion"><strong>Вывод AI</strong><p>'+esc(x.ai_summary)+'</p></div>':"")+'</section><section class="report-section"><h3>Полный диалог</h3><div class="messages report-dialog">'+dialog+'</div></section></div>';
  };
})();