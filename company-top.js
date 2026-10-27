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
    return shell+'<div style="overflow-x:auto"><table class="table"><thead><tr><th>Место</th><th>Сотрудник</th><th>Филиал</th><th>Текстовые</th><th>Холодные звонки</th><th>Лучший балл</th><th>Средний балл</th></tr></thead><tbody>'+cells+'</tbody></table></div>';
  } catch(error) {
    console.warn('[SaleTrener TOP] aggregate unavailable',error);
    return shell+'<div class="empty">Не удалось загрузить рейтинг. <button class="secondary" onclick="page()">Повторить</button></div>';
  }
}
