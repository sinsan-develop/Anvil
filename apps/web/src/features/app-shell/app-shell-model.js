export const MENU_ITEMS = Object.freeze([
  {id:'dashboard', label:'Dashboard', href:'/', state:'ACTIVE'},
  {id:'workbench', label:'Workbench', href:'#workbench', state:'PREPARING'},
  {id:'projects', label:'Projects', href:'#projects', state:'PREPARING'},
  {id:'runs', label:'Runs', href:'#runs', state:'PREPARING'},
  {id:'reviews', label:'Reviews', href:'#reviews', state:'PREPARING'},
  {id:'quality', label:'Quality', href:'#quality', state:'PREPARING'},
  {id:'knowledge', label:'Knowledge', href:'#knowledge', state:'PREPARING'},
  {id:'agents-automation', label:'Agents & Automation', href:'#agents-automation', state:'PREPARING'},
  {id:'environments', label:'Environments', href:'#environments', state:'PREPARING'},
  {id:'operations', label:'Operations', href:'#operations', state:'PREPARING'},
  {id:'settings', label:'Settings', href:'#settings', secondaryHref:'/provider-workbench.html', state:'PREPARING'},
]);

export const DASHBOARD_HEALTH = Object.freeze(['Database', 'Queue', 'Worker', 'LLM Providers', 'Execution Backends', 'Artifact Store']);
export const READY_PATH = '/health/ready';

const unavailable = reason => Object.freeze({status:'UNAVAILABLE', detail:'No source connected', reason});
const unavailableSection = reason => Object.freeze({status:'UNAVAILABLE', detail:'No source connected', reason});

export function createDashboardState() {
  return {
    health: DASHBOARD_HEALTH.map(name => ({name, ...unavailable('Dashboard read model is not connected.')})),
    operations: {
      activeRuns: unavailableSection('Run read model is not connected.'),
      approvalWaiting: unavailableSection('Approval read model is not connected.'),
      blockedRuns: unavailableSection('Run read model is not connected.'),
      failedRuns: unavailableSection('Run read model is not connected.'),
      requiredGates: unavailableSection('Quality read model is not connected.'),
      budgetThresholds: unavailableSection('Cost read model is not connected.'),
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
    const health = state.health.map((card, index) => index === 0 ? {...card, status:'READY', detail:`Migration ${payload.migration_head}`, reason:'Same-origin readiness endpoint responded.'} : card);
    return {...state, health, refreshedAt: action.refreshedAt || 'JUST NOW'};
  }
  if (action.type === 'READINESS_FAILED') {
    const health = state.health.map((card, index) => index === 0 ? {...card, status:'NOT_CONNECTED', detail:'Readiness unavailable', reason:'The same-origin readiness endpoint did not return ready.'} : card);
    return {...state, health, refreshedAt: action.refreshedAt || 'FAILED'};
  }
  return state;
}
