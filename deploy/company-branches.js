/* Branch management UI: data comes from authenticated server-side RPC.
   The UI never grants permissions; all mutations must be authorized in PostgreSQL. */
(function(){
  const safe = v => String(v ?? '').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const client = () => window.supabase.createClient();
  const refresh = () => { if (typeof page === 'function') page(); };
  window.companyBranchesPage = async function(canManage,companyId){
    companyId = companyId || (typeof state !== 'undefined' ? state.company?.id : null);
    const header='<div class="top"><div><h2>Филиалы</h2><div class="muted">Подразделения компании и ответственные руководители</div></div></div>';
    let data,error;
    try { ({data,error}=await client().rpc('list_company_branches')); }
    catch (err) { error=err; }
    if(error) return header+'<div class="empty" role="alert">Не удалось загрузить филиалы. <button class="secondary" onclick="page()">Повторить</button></div>';
    const rows=Array.isArray(data)?data:[];
    const form=canManage?'<div class="card" style="padding:18px;margin:18px 0"><label for="branchName">Новый филиал</label><div style="display:flex;gap:8px;flex-wrap:wrap"><input id="branchName" maxlength="120" placeholder="Название филиала" style="flex:1;min-width:200px;padding:10px"><button class="primary" id="createBranchButton" onclick="createCompanyBranch()">Создать филиал</button></div></div>':'';
    const table=rows.length?'<div style="overflow-x:auto"><table class="table"><thead><tr><th>Филиал</th><th>Руководитель</th><th>Сотрудников</th></tr></thead><tbody>'+rows.map(r=>'<tr><td>'+safe(r.branch_name)+'</td><td>'+safe(r.director_name||'Не назначен')+'</td><td>'+Number(r.employee_count||0)+'</td></tr>').join('')+'</tbody></table></div>':'<div class="empty">Филиалы ещё не созданы.</div>';
    let assignment='';
    if(canManage && companyId && rows.length){
      let result;
      try { result=await client().rpc('list_company_branch_candidates',{p_company_id:companyId}); }
      catch(err) { result={error:err,data:[]}; }
      if(!result.error && Array.isArray(result.data) && result.data.length){
        const options=result.data.map(e=>'<option value="'+safe(e.employee_id)+'">'+safe(e.employee_name)+'</option>').join('');
        const branches=rows.map(b=>'<option value="'+safe(b.branch_id)+'">'+safe(b.branch_name)+'</option>').join('');
        assignment='<div class="card" style="padding:18px;margin-top:18px"><h3>Назначить сотрудника</h3><div class="bot-fields"><div class="field"><label for="branchEmployee">Сотрудник</label><select id="branchEmployee">'+options+'</select></div><div class="field"><label for="branchTarget">Филиал</label><select id="branchTarget">'+branches+'</select></div><div class="field"><label for="branchRole">Роль</label><select id="branchRole"><option value="employee">Сотрудник</option><option value="branch_director">Руководитель филиала</option></select></div></div><button class="primary" id="assignBranchButton" data-company="'+safe(companyId)+'" onclick="assignCompanyBranch(this.dataset.company)">Сохранить назначение</button></div>';
      }
    }
    return header+form+table+assignment+'<div id="branchError" role="alert" style="margin-top:12px"></div>';
  };
  let saving=false;
  async function mutate(buttonId, action, success){
    if(saving)return;
    const button=document.getElementById(buttonId),errorBox=document.getElementById('branchError');
    saving=true;if(button){button.disabled=true;button.setAttribute('aria-busy','true');}
    if(errorBox)errorBox.textContent='';
    try {
      const {error}=await action();if(error)throw error;
      window.toast?.(success);refresh();
    } catch(error) {
      if(errorBox)errorBox.textContent='Изменения не сохранены. Проверьте соединение и права доступа, затем повторите.';
    } finally {
      saving=false;if(button){button.disabled=false;button.removeAttribute('aria-busy');}
    }
  }
  window.assignCompanyBranch=async function(companyId){
    const employeeId=document.getElementById('branchEmployee')?.value;
    const branchId=document.getElementById('branchTarget')?.value;
    const branchRole=document.getElementById('branchRole')?.value;
    if(!companyId||!employeeId||!branchId)return;
    return mutate('assignBranchButton',()=>client().rpc('assign_company_branch',{p_company_id:companyId,p_branch_id:branchId,p_employee_id:employeeId,p_branch_role:branchRole}),'Назначение сохранено');
  };
  window.createCompanyBranch=async function(){
    const input=document.getElementById('branchName'),name=input?.value.trim();
    if(!name){window.toast?.('Укажите название филиала');input?.focus();return;}
    return mutate('createBranchButton',()=>client().rpc('create_company_branch',{p_name:name}),'Филиал создан');
  };
  window.companyDirectoryPage=async function(){
    const header='<div class="top"><div><h2>Команда</h2><div class="muted">Сотрудники и филиалы вашей компании</div></div></div>';
    try {
      const {data,error}=await client().rpc('company_team_directory');if(error)throw error;
      if(!data?.length)return header+'<div class="empty">В команде пока нет сотрудников.</div>';
      return header+'<div style="overflow-x:auto"><table class="table"><thead><tr><th>Сотрудник</th><th>Филиал</th></tr></thead><tbody>'+data.map(r=>'<tr><td>'+safe(r.employee_name)+'</td><td>'+safe(r.branch_name||'Не назначен')+'</td></tr>').join('')+'</tbody></table></div>';
    }catch(error){return header+'<div class="empty" role="alert">Не удалось загрузить команду. <button class="secondary" onclick="page()">Повторить</button></div>';}
  };
})();
