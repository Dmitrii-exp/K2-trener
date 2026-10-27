/* Branch management UI: data comes from authenticated server-side RPC.
   The UI never grants permissions; all mutations must be authorized in PostgreSQL. */
(function(){
  const safe = v => String(v ?? '').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const client = () => window.supabase.createClient();
  window.companyBranchesPage = async function(canManage,companyId){
    const header='<div class="top"><div><h2>Филиалы</h2><div class="muted">Подразделения компании и ответственные руководители</div></div></div>';
    const {data,error}=await client().rpc('list_company_branches');
    if(error) return header+'<div class="empty">Управление филиалами пока не подключено к базе данных.</div>';
    const rows=Array.isArray(data)?data:[];
    const form=canManage?'<div class="card" style="padding:18px;margin:18px 0"><label for="branchName">Новый филиал</label><div style="display:flex;gap:8px;flex-wrap:wrap"><input id="branchName" maxlength="120" placeholder="Название филиала" style="flex:1;min-width:200px;padding:10px"><button class="primary" onclick="createCompanyBranch()">Создать филиал</button></div></div>':'';
    const table=rows.length?'<div style="overflow-x:auto"><table class="table"><thead><tr><th>Филиал</th><th>Руководитель</th><th>Сотрудников</th></tr></thead><tbody>'+rows.map(r=>'<tr><td>'+safe(r.branch_name)+'</td><td>'+safe(r.director_name||'Не назначен')+'</td><td>'+Number(r.employee_count||0)+'</td></tr>').join('')+'</tbody></table></div>':'<div class="empty">Филиалы ещё не созданы.</div>';
    let assignment='';
    if(canManage && companyId && rows.length){
      const result=await client().rpc('list_company_branch_candidates',{p_company_id:companyId});
      if(!result.error && Array.isArray(result.data) && result.data.length){
        const options=result.data.map(e=>'<option value="'+safe(e.employee_id)+'">'+safe(e.employee_name)+'</option>').join('');
        const branches=rows.map(b=>'<option value="'+safe(b.branch_id)+'">'+safe(b.branch_name)+'</option>').join('');
        assignment='<div class="card" style="padding:18px;margin-top:18px"><h3>Назначить сотрудника</h3><div class="bot-fields"><div class="field"><label>Сотрудник</label><select id="branchEmployee">'+options+'</select></div><div class="field"><label>Филиал</label><select id="branchTarget">'+branches+'</select></div><div class="field"><label>Роль</label><select id="branchRole"><option value="employee">Сотрудник</option><option value="branch_director">Руководитель филиала</option></select></div></div><button class="primary" onclick="assignCompanyBranch('+JSON.stringify(companyId)+')">Сохранить назначение</button></div>';
      }
    }
    return header+form+table+assignment;
  };
  window.assignCompanyBranch=async function(companyId){
    const employeeId=document.getElementById('branchEmployee')?.value;
    const branchId=document.getElementById('branchTarget')?.value;
    const branchRole=document.getElementById('branchRole')?.value;
    if(!companyId||!employeeId||!branchId)return;
    const {error}=await client().rpc('assign_company_branch',{p_company_id:companyId,p_branch_id:branchId,p_employee_id:employeeId,p_branch_role:branchRole});
    if(error){window.toast?.('Назначение не сохранено: '+error.message);return;}
    window.toast?.('Назначение сохранено');window.page?.();
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
