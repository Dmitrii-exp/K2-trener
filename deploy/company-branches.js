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
  async function mutate(buttonId, action, success, options={}){
    if(saving)return;
    const button=document.getElementById(buttonId),errorBox=document.getElementById(options.errorId||'branchError');
    saving=true;if(button){button.disabled=true;button.setAttribute('aria-busy','true');}
    if(errorBox)errorBox.textContent='';
    try {
      const result=await action();if(result.error)throw result.error;
      window.toast?.(success);await (options.onSuccess||refresh)(result);
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

  function assignmentDialogStyles(){
    if(document.getElementById('employeeBranchStyles'))return;
    const style=document.createElement('style');style.id='employeeBranchStyles';
    style.textContent='.employee-branch-dialog{width:min(480px,calc(100vw - 32px));max-height:calc(100dvh - 32px);overflow:auto;padding:24px;border:1px solid var(--line);border-radius:20px;background:var(--card,#fff);color:var(--text);box-shadow:0 16px 64px #0003}.employee-branch-dialog::backdrop{background:#17152588}.employee-branch-dialog h2{font-size:22px;margin:0 0 10px;overflow-wrap:anywhere}.employee-branch-dialog .dialog-actions{display:flex;gap:10px;flex-wrap:wrap;margin-top:20px}.employee-branch-dialog .dialog-actions button{max-width:100%;white-space:normal}.employee-branch-dialog button:focus-visible{outline:3px solid var(--p);outline-offset:3px}.employee-branch-dialog button:disabled{cursor:wait;opacity:.65}';
    document.head.appendChild(style);
  }
  window.closeEmployeeBranchDialog=function(){
    if(!saving)document.getElementById('employeeBranchDialog')?.close();
  };
  async function loadAssignmentDialog(dialog,employeeId,preferredBranch){
    dialog.innerHTML='<h2 id="employeeBranchTitle">Должность и филиал</h2><div role="status">Загрузка…</div><div class="dialog-actions"><button class="secondary" onclick="closeEmployeeBranchDialog()">Отмена</button></div>';
    try{
      const companyId=state.profile?.company_id||state.company?.id;
      const [branches,candidates]=await Promise.all([
        client().rpc('list_company_branches'),
        client().rpc('list_company_branch_candidates',{p_company_id:companyId})
      ]);
      if(!dialog.isConnected||!dialog.open)return;
      if(branches.error||candidates.error)throw branches.error||candidates.error;
      const employee=(candidates.data||[]).find(e=>e.employee_id===employeeId);
      if(!employee){dialog.innerHTML='<h2 id="employeeBranchTitle">Должность и филиал</h2><p role="alert">Назначение недоступно: сотрудник не найден или является руководителем компании.</p><button class="secondary" onclick="closeEmployeeBranchDialog()">Закрыть</button>';return;}
      dialog.dataset.employee=employeeId;dialog.dataset.company=companyId;
      const rows=branches.data||[];
      const header='<h2 id="employeeBranchTitle">Должность и филиал</h2><p class="muted" style="overflow-wrap:anywhere">'+safe(employee.employee_name)+'</p>';
      const actions='<button class="secondary" onclick="closeEmployeeBranchDialog()">Отмена</button>';
      if(!rows.length){
        dialog.innerHTML=header+'<p>Сначала создайте филиал, чтобы назначить в него сотрудника.</p><div class="field"><label for="employeeNewBranchName">Название филиала</label><input id="employeeNewBranchName" maxlength="120" placeholder="Например, Ставрополь"></div><div id="employeeBranchError" role="alert"></div><div class="dialog-actions"><button id="employeeBranchCreate" class="primary" onclick="createEmployeeBranch()">Создать филиал</button>'+actions+'</div>';
        document.getElementById('employeeNewBranchName').focus();return;
      }
      const target=preferredBranch||employee.branch_id;
      const branchesOptions=rows.map(b=>'<option value="'+safe(b.branch_id)+'" '+(b.branch_id===target?'selected':'')+'>'+safe(b.branch_name)+'</option>').join('');
      dialog.innerHTML=header+'<div class="field"><label for="employeeBranchTarget">Филиал</label><select id="employeeBranchTarget">'+branchesOptions+'</select></div><div class="field"><label for="employeeBranchRole">Должность</label><select id="employeeBranchRole"><option value="employee">Сотрудник</option><option value="branch_director" '+(employee.branch_role==='branch_director'?'selected':'')+'>Руководитель филиала</option></select></div><p class="muted">Руководитель филиала сможет смотреть историю сотрудников выбранного филиала.</p><div id="employeeBranchError" role="alert"></div><div class="dialog-actions"><button id="employeeBranchSave" class="primary" onclick="saveEmployeeBranchAssignment()">Сохранить назначение</button>'+actions+'</div>';
      document.getElementById('employeeBranchTarget').focus();
    }catch(error){
      if(dialog.isConnected&&dialog.open)dialog.innerHTML='<h2 id="employeeBranchTitle">Должность и филиал</h2><p role="alert">Не удалось загрузить филиалы и должности. Проверьте соединение и повторите.</p><div class="dialog-actions"><button class="primary" onclick="retryEmployeeBranchDialog()">Повторить</button><button class="secondary" onclick="closeEmployeeBranchDialog()">Отмена</button></div>';
    }
  }
  window.openEmployeeBranchAssignment=function(employeeId){
    if(!state.branchContext?.can_manage)return;
    if(document.getElementById('employeeBranchDialog'))return;
    assignmentDialogStyles();
    const opener=document.activeElement,dialog=document.createElement('dialog');
    dialog.id='employeeBranchDialog';dialog.className='employee-branch-dialog';dialog.dataset.employee=employeeId;
    dialog.setAttribute('aria-labelledby','employeeBranchTitle');
    dialog.addEventListener('cancel',event=>{if(saving)event.preventDefault();});
    dialog.addEventListener('close',()=>{dialog.remove();if(opener?.isConnected)opener.focus();},{once:true});
    document.body.appendChild(dialog);dialog.showModal();
    return loadAssignmentDialog(dialog,employeeId);
  };
  window.retryEmployeeBranchDialog=function(){
    const dialog=document.getElementById('employeeBranchDialog');
    if(dialog)return loadAssignmentDialog(dialog,dialog.dataset.employee);
  };
  window.saveEmployeeBranchAssignment=function(){
    const dialog=document.getElementById('employeeBranchDialog');
    const branchId=document.getElementById('employeeBranchTarget')?.value;
    const role=document.getElementById('employeeBranchRole')?.value;
    if(!dialog||!branchId||!role)return;
    return mutate('employeeBranchSave',()=>client().rpc('assign_company_branch',{
      p_company_id:dialog.dataset.company,p_branch_id:branchId,p_employee_id:dialog.dataset.employee,p_branch_role:role
    }),'Назначение сохранено',{errorId:'employeeBranchError',onSuccess:()=>dialog.close()});
  };
  window.createEmployeeBranch=function(){
    const dialog=document.getElementById('employeeBranchDialog'),input=document.getElementById('employeeNewBranchName'),name=input?.value.trim();
    if(!dialog)return;
    if(!name){document.getElementById('employeeBranchError').textContent='Введите название филиала.';input?.focus();return;}
    return mutate('employeeBranchCreate',()=>client().rpc('create_company_branch',{p_name:name}),'Филиал создан',{
      errorId:'employeeBranchError',onSuccess:result=>loadAssignmentDialog(dialog,dialog.dataset.employee,result.data)
    });
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
