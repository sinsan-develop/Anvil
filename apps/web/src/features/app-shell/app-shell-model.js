export const MENU_ITEMS = Object.freeze([
  {id:'dashboard', label:'Dashboard', href:'/', state:'ACTIVE'},
  {id:'workbench', label:'Workbench', href:'/workbench', state:'ACTIVE'},
  {id:'projects', label:'Projects', href:'/projects', state:'ACTIVE'},
  {id:'runs', label:'Runs', href:'/runs', state:'ACTIVE'},
  {id:'reviews', label:'Reviews', href:'/reviews', state:'ACTIVE'},
  {id:'quality', label:'Quality', href:'/quality', state:'ACTIVE'},
  {id:'knowledge', label:'Knowledge', href:'/knowledge', state:'ACTIVE'},
  {id:'agents-automation', label:'Agents & Automation', href:'/agents-automation', state:'ACTIVE'},
  {id:'environments', label:'Environments', href:'/environments', state:'ACTIVE'},
  {id:'operations', label:'Operations', href:'/operations', state:'ACTIVE'},
  {id:'settings', label:'Settings', href:'/settings', secondaryHref:'/provider-workbench.html', state:'ACTIVE'},
]);

export const DASHBOARD_HEALTH = Object.freeze(['Database', 'Queue', 'Worker', 'LLM Providers', 'Execution Backends', 'Artifact Store']);
export const DASHBOARD_OPERATIONS = Object.freeze(['실행 중', '승인 대기', 'BLOCKED', '필수 Gate 미통과', '예상 비용 초과', 'baseline 충돌']);
export const DASHBOARD_OPERATION_DEFINITIONS = Object.freeze([
  {key:'running', label:'실행 중'}, {key:'approvalWaiting', label:'승인 대기'}, {key:'blocked', label:'BLOCKED'},
  {key:'requiredGateFailed', label:'필수 Gate 미통과'}, {key:'budgetExceeded', label:'예상 비용 초과'}, {key:'baselineConflict', label:'baseline 충돌'},
]);
export const READY_PATH = '/health/ready';

const unavailable = reason => Object.freeze({
  icon:'○', status:'UNAVAILABLE', detail:'No source connected', reason,
  lastChecked:'UNAVAILABLE', errorCount:'UNAVAILABLE',
  detailLink:Object.freeze({status:'UNAVAILABLE', label:'상세 링크 UNAVAILABLE', reason:'Health detail source is not connected.'}),
});
const unavailableSection = reason => Object.freeze({status:'UNAVAILABLE', detail:'No source connected', reason});

export function createDashboardState() {
  return {
    health: DASHBOARD_HEALTH.map(name => ({name, ...unavailable('Dashboard read model is not connected.')})),
    operations: {
      running: unavailableSection('Run read model is not connected.'),
      approvalWaiting: unavailableSection('Approval read model is not connected.'),
      blocked: unavailableSection('Run read model is not connected.'),
      requiredGateFailed: unavailableSection('Quality read model is not connected.'),
      budgetExceeded: unavailableSection('Cost read model is not connected.'),
      baselineConflict: unavailableSection('Baseline read model is not connected.'),
    },
    nextActions: unavailableSection('Next action read model is not connected.'),
    criticalAlerts: unavailableSection('Alert read model is not connected.'),
    refreshedAt: 'NOT REQUESTED',
  };
}

export function reduceDashboard(state, action) {
  if (action.type === 'READINESS_RECEIVED') {
    const payload = action.payload;
    if (!payload || payload.status !== 'ready' || typeof payload.migration_head !== 'string' || !payload.migration_head) return reduceDashboard(state, {type:'READINESS_FAILED'});
    const health = state.health.map((card, index) => index === 0 ? {...card, icon:'●', status:'READY', detail:`Migration ${payload.migration_head}`, reason:'Same-origin readiness endpoint responded.', lastChecked:action.refreshedAt || 'JUST NOW'} : card);
    return {...state, health, refreshedAt: action.refreshedAt || 'JUST NOW'};
  }
  if (action.type === 'READINESS_FAILED') {
    const health = state.health.map((card, index) => index === 0 ? {...card, icon:'○', status:'NOT_CONNECTED', detail:'Readiness unavailable', reason:'The same-origin readiness endpoint did not return ready.', lastChecked:action.refreshedAt || 'FAILED'} : card);
    return {...state, health, refreshedAt: action.refreshedAt || 'FAILED'};
  }
  return state;
}
