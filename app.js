const { createClient } = supabase;
const sb = createClient(APP_CONFIG.supabaseUrl, APP_CONFIG.supabaseAnonKey);
const $ = id => document.getElementById(id);
const state = { profile:null, triagem:[], info:[], users:[] };

function msg(el,text,ok=false){ if(!el) return; el.textContent=text; el.className='msg '+(ok?'ok':'err'); }
function esc(v){return String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));}

async function profile(user){
  const {data,error}=await sb.from('usuarios')
    .select('id,nome,usuario,perfil,ativo,auth_user_id')
    .eq('auth_user_id',user.id).maybeSingle();
  if(error) throw error;
  if(!data) throw new Error('Perfil do usuário não encontrado.');
  if(!data.ativo) throw new Error('Usuário bloqueado.');
  return data;
}

async function logChange(modulo,item,anterior,novo){
  try{
    if(String(anterior)===String(novo)) return;
    const {data:u}=await sb.auth.getUser();
    const authUser=u?.user;
    if(!authUser) return;
    const {data:p}=await sb.from('usuarios').select('id,nome').eq('auth_user_id',authUser.id).maybeSingle();
    if(!p) return;
    const {error}=await sb.from('historico_alteracoes').insert({
      usuario_id:p.id, usuario_nome:p.nome, modulo, item,
      valor_anterior:String(anterior??''), valor_novo:String(novo??'')
    });
    if(error) console.warn('Histórico:',error.message);
  }catch(e){ console.warn('Histórico:',e); }
}

function page(name){
  document.querySelectorAll('.page').forEach(x=>x.hidden=x.id!==`page-${name}`);
  document.querySelectorAll('.nav button').forEach(x=>x.classList.toggle('active',x.dataset.page===name));
  if(name==='dashboard') renderDashboard();
  if(name==='quantitativo') renderQuantitativo();
  if(name==='folder') renderFolder();
  if(name==='admin' && state.profile?.perfil==='administrador') loadUsers(); if(name==='historico' && state.profile?.perfil==='administrador') loadHistory();
}

async function loadTriagem(){
  const {data,error}=await sb.from('triagem_irmaos')
    .select('id,grupo,ordem,nome,quantidade,observacao')
    .order('grupo').order('ordem');
  if(error) throw error;
  state.triagem=data||[];
  renderTriagem(); renderDashboard(); renderQuantitativo(); renderFolder();
}

const GROUPS=[
  ['ministerio','MINISTÉRIO'],
  ['musicos','MÚSICOS'],
  ['localidades','LOCALIDADES']
];

function renderTriagem(){
  const root=$('triagemGrid'); root.innerHTML='';
  for(const [g,title] of GROUPS){
    const rows=state.triagem.filter(x=>x.grupo===g).sort((a,b)=>(a.ordem||0)-(b.ordem||0));
    root.insertAdjacentHTML('beforeend',`
      <section class="sectionCard">
        <div class="sectionTitle"><h3>${title}</h3><span>${rows.length} itens</span></div>
        ${rows.map(r=>`
          <div class="dataRow">
            <span>${esc(r.nome)}</span>
            <input type="number" min="0" step="1" data-id="${r.id}" value="${Number(r.quantidade)||0}">
          </div>`).join('')}
      </section>`);
  }
}

async function saveTriagem(){
  const inputs=[...document.querySelectorAll('#triagemGrid input[data-id]')];
  msg($('triagemMsg'),'Salvando...',true);
  for(const input of inputs){
    const quantidade=Math.max(0,parseInt(input.value||0,10)||0);
    const old=state.triagem.find(x=>String(x.id)===String(input.dataset.id));
    const anterior=Number(old?.quantidade||0);
    const {error}=await sb.from('triagem_irmaos').update({quantidade}).eq('id',input.dataset.id);
    if(error){msg($('triagemMsg'),error.message);return;}
    await logChange('Triagem Irmãos', old?.nome||input.dataset.id, anterior, quantidade);
  }
  msg($('triagemMsg'),'Alterações salvas com sucesso!',true);
  await loadTriagem();
}

async function loadHistory(){
  const {data,error}=await sb.from('historico_alteracoes')
    .select('id,usuario_nome,modulo,item,valor_anterior,valor_novo,criado_em')
    .order('criado_em',{ascending:false}).limit(300);
  if(error){ $('historyBody').innerHTML=`<tr><td colspan="6">${esc(error.message)}</td></tr>`; return; }
  $('historyBody').innerHTML=(data||[]).map(h=>`<tr>
    <td>${new Date(h.criado_em).toLocaleString('pt-BR')}</td>
    <td>${esc(h.usuario_nome)}</td><td>${esc(h.modulo)}</td><td>${esc(h.item)}</td>
    <td>${esc(h.valor_anterior)}</td><td>${esc(h.valor_novo)}</td>
  </tr>`).join('') || '<tr><td colspan="6">Nenhuma alteração registrada.</td></tr>';
}
function find(name,g){return Number(state.triagem.find(x=>x.nome===name&&x.grupo===g)?.quantidade||0);}
function sumGroup(g){return state.triagem.filter(x=>x.grupo===g).reduce((s,x)=>s+(Number(x.quantidade)||0),0);}
function organistas(){return find('ORGANISTAS','ministerio')+find('ORGANISTAS DE RJM','ministerio');}

function totalLocalidades(){return state.triagem.filter(x=>x.grupo==='localidades'&&(Number(x.quantidade)||0)>0).length;}
function totalIrmasIrmaosLocalidades(){return state.triagem.filter(x=>x.grupo==='localidades'&&(Number(x.quantidade)||0)>0).reduce((s,x)=>s+(Number(x.quantidade)||0),0);}
function totalGeralQuantitativo(){
  const musicos=sumGroup('musicos');
  const org=organistas();
  const musOrg=musicos+org;
  const ministerio=totalMinisterioPrincipal();
  const localidades=totalLocalidades();
  const irmaos=totalIrmasIrmaosLocalidades();
  return musicos+org+musOrg+ministerio+localidades+irmaos;
}

const MINISTRY_PRIMARY=[
  ['ANCIÕES','ANCIÕES'],['DIÁCONOS','DIÁCONOS'],['COOPERADORES','COOPERADORES OFÍCIO MINISTERIAL'],
  ['COOP. JOVENS E MENORES','COOPERADORES DE JOVENS MENORES'],['ENC. REGIONAIS','ENCARREGADOS REGIONAIS'],
  ['ENC. LOCAIS','ENCARREGADOS LOCAIS'],['EXAMINADORAS','EXAMINADORAS']
];
const MINISTRY_EXTRA=[
  ['INSTRUTORES','INSTRUTORES'],['INSTRUTORAS','INSTRUTORAS'],['CANDIDATOS','CANDIDATOS'],
  ['CANDIDATAS','CANDIDATAS'],['IRMÃOS','IRMÃOS'],['IRMÃS','IRMÃS']
];
const INSTRUMENTS_TRIAGEM=[
  ['VIOLINO','VIOLINO'],['VIOLAS','VIOLA'],['VIOLONCELOS','VIOLONCELO'],['FLAUTAS','FLAUTA'],
  ['CLARINETES','CLARINETE'],['CLARONES','CLARONE'],['OBOÉ/CORNE INGLÊS','OBOÉ'],
  ['FAGOTES','FAGOTE'],['SAX SOPRANINO','SAX SOPRANO CURVO'],['SAX SOPRANO','SAX SOPRANO'],
  ['SAX ALTO','SAX ALTO'],['SAX TENOR','SAX TENOR'],['SAX BARÍTONO','SAX BARÍTONO'],
  ['TROMPETES','TROMPETE'],['POCKET','POCKET'],['FLUGELHORN','FLUGELHORN'],['TROMPA','TROMPA'],
  ['TROMBONES','TROMBONE'],['TROMBONITOS','TROMBONITO'],['BOMBARDINO','BOMBARDINO'],
  ['TUBAS','TUBA'],['HARMÔNICAS','ACORDEON']
];

function totalMinisterioPrincipal(){
  return MINISTRY_PRIMARY.reduce((s,[db])=>s+find(db,'ministerio'),0);
}
function totalGeralPlanilha(){
  return totalMinisterioPrincipal()+sumGroup('musicos')+organistas()
    +find('INSTRUTORES','ministerio')+find('INSTRUTORAS','ministerio')
    +find('CANDIDATOS','ministerio')+find('CANDIDATAS','ministerio')
    +find('IRMÃOS','ministerio')+find('IRMÃS','ministerio');
}

function renderDashboard(){
  const musicos=sumGroup('musicos');
  const org=organistas();
  const musOrg=musicos+org;
  const ministerio=totalMinisterioPrincipal();
  const localidades=totalLocalidades();
  const irmaos=totalIrmasIrmaosLocalidades();
  const total=musicos+org+musOrg+ministerio+localidades+irmaos;
  $('mMinisterio').textContent=ministerio;
  $('mMusicos').textContent=musicos;
  $('mOrganistas').textContent=org;
  $('mMusOrg').textContent=musOrg;
  $('mMinisterio').textContent=ministerio;
  $('mLocalidades').textContent=localidades;
  $('mIrmaos').textContent=irmaos;
  $('mGeral').textContent=total;
  $('quick').innerHTML=`
    <div><b>Total Músicos</b><br>${musicos}</div>
    <div><b>Total Organistas</b><br>${org}</div>
    <div><b>Total Músicos e Organistas</b><br>${musOrg}</div>
    <div><b>Total Ministério</b><br>${ministerio}</div>
    <div><b>Total Localidades</b><br>${localidades}</div>
    <div><b>Total Localidades — Irmãs e Irmãos</b><br>${irmaos}</div>
    <div><b>Total Geral</b><br>${total}</div>`;
}

async function loadInfo(){
  const {data,error}=await sb.from('quantitativo_geral')
    .select('id,chave,descricao,valor_texto,ordem').order('ordem');
  if(error) throw error;
  state.info=data||[];
  const get=k=>state.info.find(x=>x.chave===k)?.valor_texto||'';
  $('q_titulo').value=get('ensaio_titulo');
  $('q_data').value=get('ensaio_data');
  $('q_anciao').value=get('anciao');
  $('q_palavra').value=get('palavra');
  $('q_encarregados').value=get('encarregados');
  $('q_regencia').value=get('regencia');
}

async function saveInfo(){
  const vals={
    ensaio_titulo:$('iTitulo').value.trim(),
    ensaio_data:$('iData').value,
    anciao:$('iAnciao').value.trim(),
    palavra:$('iPalavra').value.trim(),
    encarregados:$('iEncarregados').value.trim(),
    regencia:$('iRegencia').value.trim()
  };
  msg($('qMsg'),'Salvando...',true);
  for(const [chave,valor_texto] of Object.entries(vals)){
    const anterior=state.info.find(x=>x.chave===chave)?.valor_texto||'';
    const {error}=await sb.from('quantitativo_geral').update({valor_texto}).eq('chave',chave);
    if(error){msg($('qMsg'),error.message);return;}
    await logChange('Quantitativo Geral',chave,anterior,valor_texto);
  }
  msg($('qMsg'),'Informações salvas!',true);
  await loadInfo(); renderFolder();
}

function tableRows(map){
  return map.map(([db,label])=>`<tr><td>${esc(label)}</td><td>${find(db,'ministerio')}</td></tr>`).join('');
}
function instrumentRows(){
  return INSTRUMENTS_TRIAGEM.map(([db,label])=>`<tr><td>${esc(label)}</td><td>${find(db,'musicos')}</td></tr>`).join('');
}

function renderQuantitativo(){
  const musicos=sumGroup('musicos');
  const org=organistas();
  const musOrg=musicos+org;
  const ministerio=totalMinisterioPrincipal();
  const localidades=totalLocalidades();
  const irmaos=totalIrmasIrmaosLocalidades();
  const total=totalGeralQuantitativo();
  $('minTable').innerHTML=`
    <table class="summaryTable">
      <thead><tr><th>Descrição</th><th>Quantidade</th></tr></thead>
      <tbody>
        ${tableRows(MINISTRY_PRIMARY)}
        <tr class="totalLine"><td>TOTAL MINISTÉRIO</td><td>${ministerio}</td></tr>
        ${tableRows(MINISTRY_EXTRA)}
      </tbody>
    </table>`;
  $('musTable').innerHTML=`
    <div class="quantCards">
      <div class="quantCard"><span>TOTAL DE MÚSICOS</span><strong>${musicos}</strong></div>
      <div class="quantCard"><span>TOTAL DE ORGANISTAS</span><strong>${org}</strong></div>
      <div class="quantCard"><span>TOTAL MÚSICOS E ORGANISTAS</span><strong>${musOrg}</strong></div>
      <div class="quantCard"><span>TOTAL DE MINISTÉRIO</span><strong>${ministerio}</strong></div>
      <div class="quantCard"><span>TOTAL DE LOCALIDADES</span><strong>${localidades}</strong></div>
      <div class="quantCard"><span>TOTAL DE LOCALIDADES — IRMÃS E IRMÃOS</span><strong>${irmaos}</strong></div>
      <div class="quantCard quantCardTotal"><span>TOTAL GERAL</span><strong>${total}</strong></div>
    </div>
    <table class="summaryTable">
      <thead><tr><th>Resumo</th><th>Quantidade</th></tr></thead>
      <tbody>
        <tr><td>TOTAL DE MÚSICOS</td><td>${musicos}</td></tr>
        <tr><td>TOTAL DE ORGANISTAS</td><td>${org}</td></tr>
        <tr><td>TOTAL MÚSICOS E ORGANISTAS</td><td>${musOrg}</td></tr>
        <tr><td>TOTAL DE MINISTÉRIO</td><td>${ministerio}</td></tr>
        <tr><td>TOTAL DE LOCALIDADES</td><td>${localidades}</td></tr>
        <tr><td>TOTAL DE LOCALIDADES — IRMÃS E IRMÃOS</td><td>${irmaos}</td></tr>
        <tr class="totalLine"><td>TOTAL GERAL</td><td>${total}</td></tr>
      </tbody>
    </table>
    <div class="quantHint">Total de Localidades conta apenas as localidades com quantidade maior que zero. O total de Irmãs e Irmãos soma os valores dessas localidades. O Total Geral soma os seis totais anteriores.</div>`;
}

function renderFolder(){
  const get=k=>state.info.find(x=>x.chave===k)?.valor_texto||'';
  const musicos=sumGroup('musicos');
  const org=organistas();
  const musOrg=musicos+org;
  const ministerio=totalMinisterioPrincipal();
  const localidades=totalLocalidades();
  const irmaos=totalIrmasIrmaosLocalidades();
  const total=totalGeralQuantitativo();
  const locs=state.triagem
    .filter(x=>x.grupo==='localidades'&&(Number(x.quantidade)||0)>0)
    .sort((a,b)=>(a.ordem||0)-(b.ordem||0));

  $('folderContent').innerHTML=`
    <div class="folderHeader">
      <img class="folderLogo" src="congregacao.png" alt="Congregação Cristã no Brasil">
      <h2>${esc(get('ensaio_titulo')||'ENSAIO GERAL')}</h2>
      ${get('ensaio_data')?`<p class="folderDate">${esc(get('ensaio_data'))}</p>`:''}
      <p><b>Ancião:</b> ${esc(get('anciao'))} &nbsp;&nbsp; <b>Palavra:</b> ${esc(get('palavra'))}</p>
      <p><b>Encarregados:</b> ${esc(get('encarregados'))} &nbsp;&nbsp; <b>Regência:</b> ${esc(get('regencia'))}</p>
    </div>

    <div class="folderCols">
      <div class="folderBox">
        <h3>MINISTÉRIO PRESENTE</h3>
        <table class="summaryTable">
          ${tableRows(MINISTRY_PRIMARY)}
          <tr class="totalLine"><td>TOTAL MINISTÉRIO</td><td>${ministerio}</td></tr>
        </table>

        <h3>CONTAGEM GERAL</h3>
        <table class="summaryTable">
          <tr><td>TOTAL DE MÚSICOS</td><td>${musicos}</td></tr>
          <tr><td>TOTAL DE ORGANISTAS</td><td>${org}</td></tr>
          <tr><td>TOTAL MÚSICOS E ORGANISTAS</td><td>${musOrg}</td></tr>
          <tr><td>TOTAL DE MINISTÉRIO</td><td>${ministerio}</td></tr>
          <tr><td>TOTAL DE LOCALIDADES</td><td>${localidades}</td></tr>
          <tr><td>TOTAL DE LOCALIDADES — IRMÃS E IRMÃOS</td><td>${irmaos}</td></tr>
          <tr class="totalLine grandTotal"><td>TOTAL GERAL</td><td>${total}</td></tr>
        </table>
      </div>

      <div class="folderBox">
        <h3>MÚSICOS</h3>
        <table class="summaryTable">
          ${instrumentRows()}
          <tr class="totalLine"><td>TOTAL DE MÚSICOS</td><td>${musicos}</td></tr>
          <tr class="totalLine"><td>TOTAL DE ORGANISTAS</td><td>${org}</td></tr>
          <tr class="totalLine"><td>TOTAL MÚSICOS E ORGANISTAS</td><td>${musOrg}</td></tr>
        </table>
      </div>

      <div class="folderBox folderLocalidades">
        <div class="folderSectionHeader">
          <h3>LOCALIDADES PRESENTES</h3>
          <span>${localidades} localidades • ${irmaos} irmãos e irmãs</span>
        </div>
        <table class="summaryTable">
          <thead><tr><th>Localidade</th><th>Quantidade</th></tr></thead>
          <tbody>
            ${locs.map(x=>`<tr><td>${esc(x.nome)}</td><td>${Number(x.quantidade)||0}</td></tr>`).join('')
              ||'<tr><td colspan="2">Nenhuma localidade com quantidade maior que zero.</td></tr>'}
          </tbody>
          <tfoot>
            <tr class="totalLine"><td>TOTAL DE LOCALIDADES</td><td>${localidades}</td></tr>
            <tr class="totalLine"><td>TOTAL DE LOCALIDADES — IRMÃS E IRMÃOS</td><td>${irmaos}</td></tr>
          </tfoot>
        </table>
      </div>
    </div>

    <div class="folderFinalTotal">
      <span>TOTAL GERAL</span><strong>${total}</strong>
    </div>
    <p class="folderNote">O total de localidades considera somente localidades com quantidade maior que zero. O Total Geral soma os seis totais apresentados acima.</p>`;
}
async function loadUsers(){
  const {data,error}=await sb.from('usuarios').select('id,nome,usuario,perfil,ativo,auth_user_id').order('nome');
  if(error){$('usersBody').innerHTML=`<tr><td colspan="5">${esc(error.message)}</td></tr>`;return;}
  state.users=data||[];
  $('usersBody').innerHTML=(data||[]).map(u=>`<tr>
    <td>${esc(u.nome)}</td><td>${esc(u.usuario)}</td><td>${esc(u.perfil)}</td>
    <td><span class="status ${u.ativo?'on':'off'}">${u.ativo?'Ativo':'Bloqueado'}</span></td>
    <td class="userActions">
      <button type="button" class="small secondary edit-user-btn" data-id="${esc(u.id)}">Editar</button>
      ${u.auth_user_id && u.auth_user_id!==state.user?.id?`<button type="button" class="small ${u.ativo?'danger':'successBtn'} toggle-user-btn" data-id="${esc(u.id)}" data-active="${u.ativo}">${u.ativo?'Bloquear':'Desbloquear'}</button>`:'<span class="muted">Conta atual</span>'}
    </td>
  </tr>`).join('');
}
window.toggleUser=async(id,active)=>{ const row=state.users?.find(u=>u.id===id); const {error}=await sb.from('usuarios').update({ativo:!active}).eq('id',id); if(error) alert('Erro: '+error.message); else { await logChange('Usuários', row?.usuario||id, active?'Ativo':'Inativo', active?'Inativo':'Ativo'); await loadUsers(); } };
window.editUser=async(id)=>{
  const row=state.users?.find(u=>u.id===id);
  if(!row){alert('Usuário não encontrado.');return;}
  $('editUserId').value=row.id;
  $('editUserName').value=row.nome||'';
  $('editUserEmail').value=row.usuario||'';
  $('editUserProfile').value=row.perfil||'usuario';
  msg($('editMsg'),'');
  $('editUserBox').hidden=false;
  $('editUserBox').scrollIntoView({behavior:'smooth',block:'center'});
  setTimeout(()=>$('editUserName').focus(),50);
};

async function changePassword(e){
  e.preventDefault();
  const msgEl=$('passwordMsg');
  const current=$('currentPassword').value;
  const next=$('newPasswordAccount').value;
  const confirm=$('confirmPasswordAccount').value;
  if(next.length<6){msg(msgEl,'A nova senha deve ter pelo menos 6 caracteres.');return;}
  if(next!==confirm){msg(msgEl,'A confirmação da nova senha não confere.');return;}
  if(!state.user?.email){msg(msgEl,'Usuário atual não identificado.');return;}
  msg(msgEl,'Validando senha atual...',true);
  const {error:reauthError}=await sb.auth.signInWithPassword({email:state.user.email,password:current});
  if(reauthError){msg(msgEl,'A senha atual está incorreta.');return;}
  msg(msgEl,'Alterando senha...',true);
  const {error:updateError}=await sb.auth.updateUser({password:next});
  if(updateError){msg(msgEl,'Não foi possível alterar a senha: '+updateError.message);return;}
  await logChange('Minha conta','Senha','Alterada','Alterada');
  $('changePasswordForm').reset();
  msg(msgEl,'Senha alterada com sucesso!',true);
}

async function enter(user){
  state.user=user;
  state.profile=await profile(user);
  $('loginCard').hidden=true; $('app').hidden=false;
  $('who').textContent=`${state.profile.nome} • ${state.profile.perfil}`;
  $('adminNav').hidden=state.profile.perfil!=='administrador'; $('historyNav').hidden=state.profile.perfil!=='administrador';
  page('dashboard');
  await loadTriagem(); await loadInfo();
  if(state.profile.perfil==='administrador') await loadUsers();
}

async function sendPasswordReset(email){
  // Quando o sistema é aberto como arquivo local (file://), não existe uma
  // URL de retorno válida para o Supabase. Nesse caso deixamos o Supabase
  // usar a Site URL configurada no projeto. Em uma publicação http/https,
  // usamos a própria página como retorno.
  const options = {};
  if (window.location.protocol === 'http:' || window.location.protocol === 'https:') {
    options.redirectTo = window.location.href.split('#')[0];
  }
  const {error}=await sb.auth.resetPasswordForEmail(email, options);
  if(error) throw error;
}

function showRecoveryMode(){
  $('loginCard').hidden=true;
  $('app').hidden=false;
  document.querySelectorAll('.page').forEach(x=>x.hidden=true);
  $('page-conta').hidden=false;
  document.querySelectorAll('.nav button').forEach(x=>x.classList.remove('active'));
  $('accountNav').classList.add('active');
  $('recoveryCard').hidden=false;
  const normal=$('changePasswordForm'); if(normal) normal.hidden=true;
}

async function finishRecovery(){
  const p=$('recoveryPassword').value;
  const c=$('recoveryConfirm').value;
  if(p.length<6){msg($('recoveryMsg'),'A nova senha deve ter pelo menos 6 caracteres.');return;}
  if(p!==c){msg($('recoveryMsg'),'A confirmação da nova senha não confere.');return;}
  msg($('recoveryMsg'),'Salvando nova senha...',true);
  const {error}=await sb.auth.updateUser({password:p});
  if(error){msg($('recoveryMsg'),'Não foi possível alterar a senha: '+error.message);return;}
  msg($('recoveryMsg'),'Senha alterada com sucesso. Você já pode entrar com a nova senha.',true);
  await sb.auth.signOut();
  setTimeout(()=>location.reload(),900);
}

$('forgotPasswordBtn').onclick=()=>{
  $('forgotBox').hidden=false;
  $('forgotEmail').value=$('email').value.trim();
  $('forgotEmail').focus();
};
$('cancelForgot').onclick=()=>{$('forgotBox').hidden=true;};
$('forgotForm').addEventListener('submit',async e=>{
  e.preventDefault();
  const email=$('forgotEmail').value.trim();
  msg($('forgotMsg'),'Enviando link...',true);
  try{
    await sendPasswordReset(email);
    msg($('forgotMsg'),'Se o e-mail estiver cadastrado, o link de recuperação foi enviado. Verifique também o spam.',true);
  }catch(err){msg($('forgotMsg'),'Não foi possível enviar o link: '+err.message);}
});
$('recoveryForm').addEventListener('submit',async e=>{e.preventDefault(); await finishRecovery();});

$('loginForm').addEventListener('submit',async e=>{
  e.preventDefault(); msg($('loginMsg'),'Entrando...',true);
  const {data,error}=await sb.auth.signInWithPassword({email:$('email').value.trim(),password:$('password').value});
  if(error){msg($('loginMsg'),'E-mail ou senha incorretos.');return;}
  try{await enter(data.user);}catch(err){await sb.auth.signOut();msg($('loginMsg'),err.message);}
});
$('logout').onclick=async()=>{await sb.auth.signOut();location.reload();};
document.querySelectorAll('.nav button').forEach(b=>b.onclick=()=>page(b.dataset.page));
$('historyNav').addEventListener('click', async (e)=>{
  e.preventDefault();
  document.querySelectorAll('.page').forEach(x=>x.hidden=true);
  const target=$('page-history');
  if(target){ target.hidden=false; target.removeAttribute('hidden'); }
  document.querySelectorAll('.nav button').forEach(x=>x.classList.toggle('active',x===e.currentTarget));
  if(state.profile?.perfil==='administrador') await loadHistory();
});
$('saveTriagem').onclick=saveTriagem;
$('dashRefresh').onclick=async()=>{await loadTriagem();await loadInfo();};
$('saveInfo').onclick=saveInfo;
$('printFolder').onclick=()=>{page('folder');setTimeout(()=>window.print(),100);};
$('refresh').onclick=loadUsers; $('historyRefresh').onclick=loadHistory;
$('cancelEdit').onclick=()=>{ $('editUserBox').hidden=true; $('editUserForm').reset(); msg($('editMsg'),''); };
$('usersBody').addEventListener('click',e=>{
  const edit=e.target.closest('.edit-user-btn');
  if(edit){ e.preventDefault(); editUser(edit.dataset.id); return; }
  const toggle=e.target.closest('.toggle-user-btn');
  if(toggle){ e.preventDefault(); toggleUser(toggle.dataset.id,toggle.dataset.active==='true'); }
});
$('editUserForm').addEventListener('submit',async e=>{
  e.preventDefault(); const id=$('editUserId').value; const nome=$('editUserName').value.trim(); const perfil=$('editUserProfile').value;
  if(!nome){msg($('editMsg'),'Informe o nome.');return;} msg($('editMsg'),'Salvando...',true);
  const {error}=await sb.from('usuarios').update({nome,perfil}).eq('id',id);
  if(error){msg($('editMsg'),'Erro ao salvar: '+error.message);return;}
  msg($('editMsg'),'Usuário atualizado com sucesso!',true); await loadUsers(); setTimeout(()=>{ $('editUserBox').hidden=true; },500);
});
$('changePasswordForm').addEventListener('submit',changePassword);
$('newUserBtn').onclick=()=>{$('newUserBox').hidden=false;};
$('cancelNew').onclick=()=>{$('newUserBox').hidden=true;$('newUserForm').reset();msg($('newMsg'),'');};
$('newUserForm').addEventListener('submit',async e=>{
  e.preventDefault(); const nm=$('newMsg');
  const {data:sessionData,error:sessionError}=await sb.auth.getSession();
  if(sessionError||!sessionData.session){msg(nm,'Sessão expirada. Saia e entre novamente como administrador.');return;}
  msg(nm,'Criando usuário...',true);
  const {data,error}=await sb.functions.invoke('quick-action',{body:{
    nome:$('newName').value.trim(),email:$('newEmail').value.trim().toLowerCase(),
    senha:$('newPassword').value,perfil:$('newProfile').value
  }});
  if(error){let detail=error.message||'Não foi possível criar o usuário.';try{if(error.context){const body=await error.context.json();if(body?.error)detail=body.error;}}catch(_){}msg(nm,detail);return;}
  if(data?.error){msg(nm,data.error);return;}
  msg(nm,'Usuário criado com sucesso!',true);$('newUserForm').reset();await loadUsers();
});

sb.auth.onAuthStateChange(async (event, session)=>{
  if(event==='PASSWORD_RECOVERY' && session){ showRecoveryMode(); }
});

(async()=>{
  const {data}=await sb.auth.getSession();
  const isRecovery = window.location.hash.includes('type=recovery');
  if(isRecovery && data.session?.user){ showRecoveryMode(); return; }
  if(data.session?.user){try{await enter(data.session.user);}catch(e){await sb.auth.signOut();}}
})();
