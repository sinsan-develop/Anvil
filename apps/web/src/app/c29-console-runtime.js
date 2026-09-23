import {createAgentConsoleClient,checkMenu,checkedProjection} from '../api/c29-agent-console-client.js';
export function createConsoleRuntime({client=createAgentConsoleClient(),onChange=()=>{}}={}){
  let generation=0,current={menu:'team',condition:'idle',projection:null,modal:null,notice:null};
  const state=()=>structuredClone(current);
  const publish=patch=>{current={...current,...patch};onChange(state());};
  async function control(action){
    const target=current.projection?.target_hash,version=generation;
    if(!target)return;
    publish({modal:null,notice:'REQUESTING'});
    try{const result=await client.control(action,target);if(version===generation)publish({notice:['REQUESTED_NOT_APPLIED','HUMAN_APPROVAL_REQUIRED'].includes(result.state)?result.state:'NOT_APPLIED'});}
    catch{if(version===generation)publish({notice:'REQUEST_FAILED_NOT_APPLIED'});}
  }
  return Object.freeze({state,
    async select(menu){checkMenu(menu);const version=++generation;publish({menu,condition:'loading',projection:null,modal:null,notice:null});
      try{const projection=checkedProjection(await client.read(menu),menu);if(version===generation)publish({projection,condition:projection.state==='EMPTY'?'empty':'normal'});}
      catch(error){if(version===generation)publish({projection:null,condition:error.status===403?'permission':error.status===503?'offline':'error'});}
    },
    request(action){if(!['pause','resume','deploy','delete','approve','merge','apply','provider','permission'].includes(action))throw Error('ACTION_INVALID');if(!current.projection)return;if(['pause','resume'].includes(action))return control(action);publish({modal:action});},
    confirm(){const action=current.modal;if(action)return control(action);},
    cancel(){publish({modal:null});}
  });
}
export function mountConsole(root,client=createAgentConsoleClient()){
  const labels={team:'Team',moa:'MoA',sns:'SNS / Daon User',adapters:'Adapters'};
  const runtime=createConsoleRuntime({client,onChange:render});
  function el(tag,text='',className=''){const item=document.createElement(tag);item.textContent=text;if(className)item.className=className;return item;}
  function button(text,fn){const item=document.createElement('button');item.textContent=text;item.addEventListener('click',fn);return item;}
  function table(columns,rows){const wrap=el('div','','table-scroll'),tab=el('table'),head=el('thead'),tr=el('tr');for(const [label]of columns)tr.append(el('th',label));head.append(tr);tab.append(head);const body=el('tbody');for(const row of rows){const r=el('tr');for(const [,key]of columns)r.append(el('td',row[key]??'—'));body.append(r);}tab.append(body);wrap.append(tab);return wrap;}
  function panel(title){const item=el('section','','panel');item.append(el('h2',title));return item;}
  function render(state){
    root.replaceChildren();const shell=el('div','','console-shell'),sidebar=el('aside','','sidebar'),main=el('main');root.append(shell);shell.append(sidebar,main);
    sidebar.append(el('h2','ANVIL'),el('small','Agent Console · C-29'));const nav=el('nav');
    for(const [menu,label]of Object.entries(labels)){const b=button(label,()=>runtime.select(menu));if(menu===state.menu)b.setAttribute('aria-current','page');nav.append(b);}sidebar.append(nav);
    const header=el('header');header.append(el('h1',labels[state.menu]),el('span','READ-ONLY PROJECTION','badge'));main.append(header);
    const status=el('p',`${labels[state.menu]} · ${state.condition}`,'notice-strip');status.setAttribute('role','status');main.append(status);
    main.append(el('p','외부 실행 미수행 · 배포 준비 미평가 · 자동 승인 없음','muted'));
    if(state.projection){
      const p=state.projection,d=p.data;main.append(el('div',`session: ${p.session_id} → target: ${p.target_hash}`,'trace'));
      if(state.menu==='team'){
        const section=panel('역할 및 작업 계보');section.append(table([['작업','task_id'],['역할','role'],['상위 작업','parent_task_id'],['상태','status'],['결과 hash','result_hash']],d.tasks||[]));main.append(section);
      }else if(state.menu==='moa'){
        for(const [key,title]of [['proposals','독립 제안'],['critiques','반론 · 증거 검토']]){const section=panel(title);section.append(table([['ID','id'],['작업','task_id'],['담당','actor_id'],['결과 hash','result_hash']],d[key]||[]));main.append(section);}
        main.append(el('p',`Main owner: ${d.final_owner??'미연결'} · synthesis: ${d.synthesis??'NOT_EXPOSED_BY_OWNER'}`));
      }else if(state.menu==='sns'){
        const section=panel('SNS / Daon User');section.append(table([['receipt','receipt_ref'],['channel','channel'],['상태','status'],['delivery','delivery']],d.receipts||[]));main.append(section);
      }else{const section=panel('보조 채널');section.append(el('p',`Telegram: ${d.telegram?.status??'NOT_INTEGRATED'}`),el('p',`Kakao: ${d.kakao?.status??'OPEN_DECISION'}`));main.append(section);}
      const evidence=el('details','','panel');evidence.append(el('summary','검증된 projection · evidence/trace'),el('pre',JSON.stringify(p,null,2)));main.append(evidence);
      const actions=el('section','','panel actions');for(const action of ['pause','resume','approve','apply','deploy','delete','provider','permission'])actions.append(button(action,()=>runtime.request(action)));main.append(actions);
    }else{const empty=panel('현재 결과');empty.append(el('p',state.condition==='loading'?'현재 권한으로 조회 중입니다.':'결과가 없거나 현재 권한/연결을 확인할 수 없습니다.','empty-message'),button('다시 조회',()=>runtime.select(state.menu)));main.append(empty);}
    if(state.notice)main.append(el('p',state.notice,'result-notice'));
    if(state.modal){const backdrop=el('div','','backdrop'),dialog=el('section','','dialog');dialog.setAttribute('role','dialog');dialog.setAttribute('aria-modal','true');dialog.setAttribute('aria-label','위험 작업 재확인');const cancel=button('취소',()=>runtime.cancel()),confirm=button('재확인',()=>runtime.confirm());dialog.append(el('h2',`${state.modal} 재확인`),el('p','요청 확인만 수행하며 승인 또는 실제 적용하지 않습니다.'),confirm,cancel);backdrop.append(dialog);root.append(backdrop);dialog.addEventListener('keydown',e=>{if(e.key==='Escape'){e.preventDefault();runtime.cancel();}if(e.key==='Tab'){e.preventDefault();(document.activeElement===cancel?confirm:cancel).focus();}});cancel.focus();}
  }
  render(runtime.state());void runtime.select('team');return runtime;
}
if(typeof document!=='undefined'){const root=document.querySelector('[data-c29-console]');if(root)mountConsole(root);}
