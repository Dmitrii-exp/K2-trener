/* Company TOP: consumes a server-authorized aggregate RPC, never private sessions. */
async function companyTopPage(){
  const escTop = (value) => String(value ?? '').replace(/[&<>"']/g, ch => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));
  const shell = '<div class="top"><div><h2>ТОП сотрудников</h2><div class="muted">Рейтинг сотрудников вашей компании по среднему баллу</div></div></div>';
  try {
    const result = await window.supabase.createClient().rpc('company_top_public');
    if(result.error) throw result.error;
    const rows = result.data || [];
    if(!rows.length) return shell + '<div class="empty">Пока нет завершённых тренировок для рейтинга.</div>';
    const cells = rows.map((r,i)=>'<tr><td>'+(i+1)+'</td><td>'+escTop(r.employee_name)+'</td><td>'+escTop(r.branch_name||'Не назначен')+'</td><td>'+Number(r.text_count||0)+'</td><td>'+Number(r.voice_count||0)+'</td><td>'+escTop(r.best_score??'—')+'</td><td>'+escTop(r.average_score??'—')+'</td></tr>').join('');
    const cards = rows.map((r,i)=>'<li class="card company-top-card"><div class="company-top-person"><span class="pill">Место '+(i+1)+'</span><div><h3>'+escTop(r.employee_name)+'</h3><div class="muted">Филиал: '+escTop(r.branch_name||'Не назначен')+'</div></div></div><dl class="company-top-metrics">'+[['Текстовые',Number(r.text_count||0)],['Холодные звонки',Number(r.voice_count||0)],['Лучший балл',r.best_score??'—'],['Средний балл',r.average_score??'—']].map(([label,value])=>'<div><dt>'+label+'</dt><dd>'+escTop(value)+'</dd></div>').join('')+'</dl></li>').join('');
    return shell+`<style>
      .company-top-desktop{overflow-x:auto;margin-top:20px}
      .company-top-mobile{display:none;list-style:none;padding:0;margin:20px 0;gap:14px}
      .company-top-card{padding:18px;min-width:0}
      .company-top-person{display:flex;gap:12px;align-items:flex-start}
      .company-top-person>div{min-width:0;overflow-wrap:anywhere}
      .company-top-person .pill{flex-shrink:0}
      .company-top-person h3{margin:0 0 5px;font-size:18px}
      .company-top-metrics{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:14px 18px;margin:20px 0 0;padding-top:16px;border-top:1px solid var(--line)}
      .company-top-metrics dt{font-size:13px;color:var(--muted);overflow-wrap:anywhere}
      .company-top-metrics dd{margin:5px 0 0;font-size:22px;font-weight:800;overflow-wrap:anywhere}
      @media(max-width:700px){.company-top-desktop{display:none}.company-top-mobile{display:grid}}
    </style><div class="company-top-desktop"><table class="table"><thead><tr><th>Место</th><th>Сотрудник</th><th>Филиал</th><th>Текстовые</th><th>Холодные звонки</th><th>Лучший балл</th><th>Средний балл</th></tr></thead><tbody>${cells}</tbody></table></div><ol class="company-top-mobile" aria-label="Рейтинг сотрудников">${cards}</ol>`;
  } catch(error) {
    console.warn('[SaleTrener TOP] aggregate unavailable',error);
    return shell+'<div class="empty" role="alert">Не удалось загрузить рейтинг. <button class="secondary" onclick="page()">Повторить</button></div>';
  }
}
