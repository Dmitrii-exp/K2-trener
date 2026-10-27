/* Branch management UI: data comes from authenticated server-side RPC.
   The UI never grants permissions; all mutations must be authorized in PostgreSQL. */
(function(){
  const safe = v => String(v ?? '').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const client = () => window.supabase.createClient();
  window.companyBranchesPage = async function(canManage){
    const header='<div class="top"><div><h2>Филиалы</h2><div class="muted">Подразделения компании и ответственные руководители</div></div></div>';
    const {data,error}=await client().rpc('list_company_branches');
    if(error) return header+'<div class="empty">Управление филиалами пока не подключено к базе данных.</div>';
    const rows=Array.isArray(data)?data:[];
    const form=canManage?'<div class="card" style="padding:18px;margin:18px 0"><label for="branchName">Новый филиал</label><div style="display:flex;gap:8px;flex-wrap:wrap"><input id="branchName" maxlength="120" placeholder="Название филиала" style="flex:1;min-width:200px;padding:10px"><button class="primary" onclick="createCompanyBranch()">Создать филиал</button></div></div>':'';
    const table=rows.length?'<div style="overflow-x:auto"><table class="table"><thead><tr><th>Филиал</th><th>Руководитель</th><th>Сотрудников</th></tr></thead><tbody>'+rows.map(r=>'<tr><td>'+safe(r.branch_name)+'</td><td>'+safe(r.director_name||'Не назначен')+'</td><td>'+Number(r.employee_count||0)+'</td></tr>').join('')+'</tbody></table></div>':'<div class="empty">Филиалы ещё не созданы.</div>';
    return header+form+table;
  };
  window.createCompanyBranch=async function(){
    const name=document.getElementById('branchName')?.value.trim();
    if(!name){window.toast?.('Укажите название филиала');return;}
    const {error}=await client().rpc('create_company_branch',{p_name:name});
    if(error){window.toast?.('Не удалось создать филиал: '+error.message);return;}
    window.toast?.('Филиал создан');
    window.page?.();
  };
})();
