const { createClient } = supabase;
const sb = createClient(APP_CONFIG.supabaseUrl, APP_CONFIG.supabaseAnonKey);
const $ = id => document.getElementById(id);
const state = { profile:null, triagem:[], info:[], users:[] };
const PERFIL_II_ITENS = ['EXAMINADORAS','INSTRUTORAS','ORGANISTAS','ORGANISTAS DE RJM','CANDIDATAS','IRMÃS'];
const isPerfilII = () => state.profile?.perfil === 'ii';
const perfilLabel = p => p === 'administrador' ? 'Administrador' : p === 'ii' ? 'Perfil II' : 'Usuário';

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
  if(isPerfilII() && !['triagem','dashboard','quantitativo','conta'].includes(name)) name='triagem';
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
  const visibleGroups = isPerfilII() ? [['ministerio','MINISTÉRIO'],['localidades','LOCALIDADES']] : GROUPS;
  for(const [g,title] of visibleGroups){
    let rows=state.triagem.filter(x=>x.grupo===g);
    if(isPerfilII() && g==='ministerio') rows=rows.filter(x=>PERFIL_II_ITENS.includes(x.nome));
    rows=rows.sort((a,b)=>(a.ordem||0)-(b.ordem||0));
    const isAdmin=state.profile?.perfil==='administrador';
    const canAddLocalidade = isAdmin || (isPerfilII() && g==='localidades');
    const adminControls = ((isAdmin && (g==='localidades' || g==='musicos')) || (isPerfilII() && g==='localidades'))
      ? `<button type="button" class="small successBtn" id="add${g==='musicos'?'Musico':'Localidade'}Btn">+ Adicionar ${g==='musicos'?'músico':'localidade'}</button>` : '';
    root.insertAdjacentHTML('beforeend',`
      <section class="sectionCard">
        <div class="sectionTitle"><h3>${title}</h3><div class="sectionActions"><span>${rows.length} itens</span>${adminControls}</div></div>
        ${rows.map(r=>`
          <div class="dataRow ${g==='localidades'?'localidadeRow':''}">
            <span>${esc(r.nome)}</span>
            <input type="number" min="0" step="1" data-id="${r.id}" value="${Number(r.quantidade)||0}">
            ${isAdmin && (g==='localidades' || g==='musicos') ? `<div class="manageBtns"><button type="button" class="small editManageBtn" data-group="${g}" data-id="${r.id}" data-name="${esc(r.nome)}">Editar</button><button type="button" class="small danger deleteManageBtn" data-group="${g}" data-id="${r.id}" data-name="${esc(r.nome)}">Excluir</button></div>` : ''}
          </div>`).join('')}
      </section>`);
  }
  const addLocal=$('addLocalidadeBtn');
  if(addLocal) addLocal.onclick=()=>addTriagemItem('localidades','localidade');
  const addMus=$('addMusicoBtn');
  if(addMus) addMus.onclick=()=>addTriagemItem('musicos','músico');
  document.querySelectorAll('.editManageBtn').forEach(btn=>btn.onclick=()=>editTriagemItem(btn.dataset.group,btn.dataset.id,btn.dataset.name));
  document.querySelectorAll('.deleteManageBtn').forEach(btn=>btn.onclick=()=>deleteTriagemItem(btn.dataset.group,btn.dataset.id,btn.dataset.name));
  bindAutoSave();
  setSaveStatus('saved');
}

async function addTriagemItem(grupo,label){
  const canAdd = state.profile?.perfil==='administrador' || (state.profile?.perfil==='ii' && grupo==='localidades');
  if(!canAdd) return;
  const nome=(prompt(`Digite o nome do novo ${label}:`)||'').trim();
  if(!nome) return;
  const exists=state.triagem.some(x=>x.grupo===grupo && String(x.nome).trim().toLowerCase()===nome.toLowerCase());
  if(exists){msg($('triagemMsg'),`Esse ${label} já existe.`);return;}
  const maxOrdem=state.triagem.filter(x=>x.grupo===grupo).reduce((m,x)=>Math.max(m,Number(x.ordem)||0),0);
  const {error}=await sb.from('triagem_irmaos').insert({grupo,nome,quantidade:0,ordem:maxOrdem+1});
  if(error){msg($('triagemMsg'),`Não foi possível adicionar o ${label}: `+error.message);return;}
  await logChange('Triagem',`${label} ${nome}`,'',`Adicionado`);
  msg($('triagemMsg'),`${label[0].toUpperCase()+label.slice(1)} adicionado com sucesso!`,true);
  await loadTriagem();
}

async function editTriagemItem(grupo,id,nome){
  if(state.profile?.perfil!=='administrador') return;
  const label=grupo==='musicos'?'músico':'localidade';
  const novo=(prompt(`Editar nome do ${label}:`,nome)||'').trim();
  if(!novo || novo===nome) return;
  const exists=state.triagem.some(x=>x.grupo===grupo && String(x.id)!==String(id) && String(x.nome).trim().toLowerCase()===novo.toLowerCase());
  if(exists){msg($('triagemMsg'),`Esse ${label} já existe.`);return;}
  const {error}=await sb.from('triagem_irmaos').update({nome:novo}).eq('id',id).eq('grupo',grupo);
  if(error){msg($('triagemMsg'),`Não foi possível editar o ${label}: `+error.message);return;}
  await logChange('Triagem',`${label} ${nome}`,nome,novo);
  msg($('triagemMsg'),`${label[0].toUpperCase()+label.slice(1)} atualizado com sucesso!`,true);
  await loadTriagem();
}

async function deleteTriagemItem(grupo,id,nome){
  if(state.profile?.perfil!=='administrador') return;
  const label=grupo==='musicos'?'músico':'localidade';
  if(!confirm(`Excluir o ${label} \"${nome}\"?`)) return;
  const row=state.triagem.find(x=>String(x.id)===String(id));
  const {error}=await sb.from('triagem_irmaos').delete().eq('id',id).eq('grupo',grupo);
  if(error){msg($('triagemMsg'),`Não foi possível excluir o ${label}: `+error.message);return;}
  await logChange('Triagem',`${label} ${nome}`,String(row?.quantidade||0),'Excluído');
  msg($('triagemMsg'),`${label[0].toUpperCase()+label.slice(1)} excluído com sucesso!`,true);
  await loadTriagem();
}

async function saveOneTriagem(input, silent=false){
  if(!input || input.dataset.saving==='true') return;
  const quantidade=Math.max(0,parseInt(input.value||0,10)||0);
  input.value=quantidade;
  const old=state.triagem.find(x=>String(x.id)===String(input.dataset.id));
  const anterior=Number(old?.quantidade||0);
  if(anterior===quantidade){
    if(!silent) msg($('triagemMsg'),'✓ Tudo já está salvo.',true);
    return;
  }
  input.dataset.saving='true';
  setSaveStatus('saving');
  const {error}=await sb.from('triagem_irmaos').update({quantidade}).eq('id',input.dataset.id);
  input.dataset.saving='false';
  if(error){ setSaveStatus('error'); msg($('triagemMsg'),'Erro ao salvar: '+error.message); return; }
  old.quantidade=quantidade;
  await logChange('Triagem', old?.nome||input.dataset.id, anterior, quantidade);
  setSaveStatus('saved');
  if(!silent) msg($('triagemMsg'),'✓ Salvo automaticamente.',true);
  renderDashboard(); renderQuantitativo(); renderFolder();
}

function setSaveStatus(status){
  const el=$('autoSaveStatus'); if(!el) return;
  if(status==='saving'){el.textContent='⏳ Salvando...';el.className='autoSaveStatus saving';}
  else if(status==='error'){el.textContent='⚠ Erro ao salvar';el.className='autoSaveStatus error';}
  else {el.textContent='✓ Salvo automaticamente';el.className='autoSaveStatus saved';}
}

function bindAutoSave(){
  document.querySelectorAll('#triagemGrid input[data-id]').forEach(input=>{
    let timer;
    input.addEventListener('input',()=>{
      clearTimeout(timer);
      setSaveStatus('saving');
      timer=setTimeout(()=>saveOneTriagem(input,true),700);
    });
    input.addEventListener('change',()=>{ clearTimeout(timer); saveOneTriagem(input,true); });
    input.addEventListener('blur',()=>{ clearTimeout(timer); saveOneTriagem(input,true); });
  });
}

function getTriagemDate(){
  const el=$('triagemDate');
  if(el && el.value) return el.value;
  return new Date().toISOString().slice(0,10);
}

function setTodayTriagemDate(){
  const el=$('triagemDate');
  if(el && !el.value) el.value=new Date().toISOString().slice(0,10);
}

function visibleTriagemRows(){
  if(!isPerfilII()) return state.triagem.slice();
  return state.triagem.filter(x =>
    (x.grupo==='ministerio' && PERFIL_II_ITENS.includes(x.nome)) ||
    x.grupo==='localidades'
  );
}

async function zeroTriagem(){
  if(!confirm('Tem certeza que deseja zerar todos os campos atuais? Os registros salvos por data não serão apagados.')) return;
  const rows=visibleTriagemRows().filter(x=>Number(x.quantidade||0)!==0);
  if(!rows.length){ msg($('triagemMsg'),'Todos os campos já estão zerados.',true); return; }
  setSaveStatus('saving');
  for(const row of rows){
    const {error}=await sb.from('triagem_irmaos').update({quantidade:0}).eq('id',row.id);
    if(error){ setSaveStatus('error'); msg($('triagemMsg'),'Erro ao zerar: '+error.message); return; }
    await logChange('Triagem',row.nome,row.quantidade,0);
    row.quantidade=0;
  }
  document.querySelectorAll('#triagemGrid input[data-id]').forEach(input=>input.value=0);
  setSaveStatus('saved');
  msg($('triagemMsg'),'✓ Todos os campos visíveis foram zerados.',true);
  renderDashboard(); renderQuantitativo(); renderFolder();
}

async function saveTriagemByDate(){
  const date=getTriagemDate();
  const rows=visibleTriagemRows();
  if(!date){msg($('dateSaveMsg'),'Informe a data.');return;}
  msg($('dateSaveMsg'),'Salvando registro da data...',true);
  try{
    const {data:userData}=await sb.auth.getUser();
    const authUser=userData?.user;
    const profileData=state.profile;
    const snapshot=rows.map(x=>({id:x.id,grupo:x.grupo,nome:x.nome,quantidade:Number(x.quantidade)||0,ordem:x.ordem||0}));
    const {error}=await sb.from('triagem_por_data').upsert({
      data_ref:date,
      dados:snapshot,
      usuario_id:profileData?.id||null,
      usuario_nome:profileData?.nome||authUser?.email||''
    },{onConflict:'data_ref'});
    if(error) throw error;
    msg($('dateSaveMsg'),`✓ Registro de ${new Date(date+'T12:00:00').toLocaleDateString('pt-BR')} salvo.`,true);
  }catch(e){
    msg($('dateSaveMsg'),'Erro ao salvar por data: '+e.message);
  }
}

async function loadTriagemByDate(){
  const date=getTriagemDate();
  if(!date){msg($('dateSaveMsg'),'Informe a data.');return;}
  msg($('dateSaveMsg'),'Carregando registro...',true);
  const {data,error}=await sb.from('triagem_por_data').select('data_ref,dados').eq('data_ref',date).maybeSingle();
  if(error){msg($('dateSaveMsg'),'Erro ao carregar: '+error.message);return;}
  if(!data){msg($('dateSaveMsg'),'Não existe registro salvo para essa data.');return;}
  const snapshot=Array.isArray(data.dados)?data.dados:[];
  let alterados=0;
  for(const item of snapshot){
    const row=state.triagem.find(x=>String(x.id)===String(item.id));
    if(!row) continue;
    const quantidade=Math.max(0,parseInt(item.quantidade||0,10)||0);
    if(Number(row.quantidade||0)===quantidade) continue;
    const {error:upErr}=await sb.from('triagem_irmaos').update({quantidade}).eq('id',row.id);
    if(upErr){msg($('dateSaveMsg'),'Erro ao aplicar o registro: '+upErr.message);return;}
    row.quantidade=quantidade;
    alterados++;
  }
  renderTriagem(); renderDashboard(); renderQuantitativo(); renderFolder();
  msg($('dateSaveMsg'),`✓ Registro de ${new Date(date+'T12:00:00').toLocaleDateString('pt-BR')} carregado (${alterados} campos atualizados).`,true);
}

async function saveTriagem(){
  const inputs=[...document.querySelectorAll('#triagemGrid input[data-id]')];
  for(const input of inputs) await saveOneTriagem(input,true);
  setSaveStatus('saved');
  msg($('triagemMsg'),'✓ Alterações salvas.',true);
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
  // O Total Geral permanece somando apenas o Ministério considerado no cálculo atual.
  const ministerio=totalMinisterioGeral();
  const irmaos=totalIrmasIrmaosLocalidades();
  return musicos+org+ministerio+irmaos;
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

function totalMinisterioGeral(){
  // Base usada exclusivamente no TOTAL GERAL: não inclui encarregados nem examinadoras.
  const incluir=['ANCIÕES','DIÁCONOS','COOPERADORES','COOP. JOVENS E MENORES'];
  return incluir.reduce((s,db)=>s+find(db,'ministerio'),0);
}

function totalMinisterioPrincipal(){
  // TOTAL MINISTÉRIO: soma somente as 7 categorias definidas pelo usuário.
  const incluir=['ANCIÕES','DIÁCONOS','COOPERADORES','COOP. JOVENS E MENORES','ENC. REGIONAIS','ENC. LOCAIS','EXAMINADORAS'];
  return incluir.reduce((s,nome)=>s+find(nome,'ministerio'),0);
}
function totalGeralPlanilha(){
  // TOTAL GERAL: não inclui Encarregados Regionais, Encarregados Locais nem Examinadoras.
  return totalMinisterioGeral()+sumGroup('musicos')+organistas()+totalIrmasIrmaosLocalidades();
}

function renderDashboard(){
  const musicos=sumGroup('musicos');
  const org=organistas();
  const musOrg=musicos+org;
  const ministerio=totalMinisterioPrincipal();
  const localidades=totalLocalidades();
  const irmaos=totalIrmasIrmaosLocalidades();
  const total=totalGeralQuantitativo();
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
  return state.triagem.filter(x=>x.grupo==='musicos').sort((a,b)=>(a.ordem||0)-(b.ordem||0)).map(x=>`<tr><td>${esc(x.nome)}</td><td>${Number(x.quantidade)||0}</td></tr>`).join('');
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
    <div class="quantHint">Total de Localidades conta apenas as localidades com quantidade maior que zero. O total de Irmãs e Irmãos soma os valores dessas localidades. O Total Geral soma somente Músicos + Organistas + Ministério + Irmãos e Irmãs.</div>`;
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
    <p class="folderNote">O total de localidades considera somente localidades com quantidade maior que zero. O Total Geral soma somente Músicos + Organistas + Ministério + Irmãos e Irmãs.</p>`;
}
async function loadUsers(){
  const {data,error}=await sb.from('usuarios').select('id,nome,usuario,perfil,ativo,auth_user_id').order('nome');
  if(error){$('usersBody').innerHTML=`<tr><td colspan="5">${esc(error.message)}</td></tr>`;return;}
  state.users=data||[];
  $('usersBody').innerHTML=(data||[]).map(u=>`<tr>
    <td>${esc(u.nome)}</td><td>${esc(u.usuario)}</td><td>${esc(perfilLabel(u.perfil))}</td>
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
  $('who').textContent=`${state.profile.nome} • ${perfilLabel(state.profile.perfil)}`;
  $('adminNav').hidden=state.profile.perfil!=='administrador';
  $('historyNav').hidden=state.profile.perfil!=='administrador';
  document.querySelectorAll('.nav button[data-page="folder"]').forEach(b=>b.hidden=isPerfilII());
  document.querySelectorAll('.nav button[data-page="dashboard"], .nav button[data-page="quantitativo"]').forEach(b=>b.hidden=false);
  page(isPerfilII() ? 'triagem' : 'dashboard');
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
$('zeroTriagem').onclick=zeroTriagem;
$('saveByDate').onclick=saveTriagemByDate;
$('loadByDate').onclick=loadTriagemByDate;
setTodayTriagemDate();
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
