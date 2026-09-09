import {MENU_ITEMS, READY_PATH, createDashboardState, reduceDashboard} from '../features/app-shell/app-shell-model.js';

const byId = id => document.getElementById(id);
const statusClass = status => status === 'READY' ? 'status-ready' : 'status-unavailable';
let state = createDashboardState();

function statusText(section) { return `${section.status} · ${section.reason}`; }

function renderMenu() {
  const list = byId('app-menu');
  for (const item of MENU_ITEMS) {
    const entry = document.createElement('li');
    const link = document.createElement('a');
    link.href = item.href;
    link.textContent = item.label;
    if (item.id === 'dashboard') link.setAttribute('aria-current', 'page');
    entry.append(link);
    if (item.secondaryHref) {
      const secondary = document.createElement('a');
      secondary.href = item.secondaryHref;
      secondary.className = 'menu-secondary';
      secondary.textContent = 'Provider';
      entry.append(secondary);
    }
    if (item.state !== 'ACTIVE') {
      const stateLabel = document.createElement('span');
      stateLabel.className = 'menu-state';
      stateLabel.textContent = 'PREPARING';
      entry.append(stateLabel);
    }
    list.append(entry);
  }
}

function renderStatusCard(container, title, section) {
  const card = document.createElement('article'); card.className = 'status-card';
  const heading = document.createElement('h3'); heading.textContent = title;
  const status = document.createElement('p'); status.className = `status ${statusClass(section.status)}`; status.textContent = section.status;
  const detail = document.createElement('p'); detail.className = 'status-detail'; detail.textContent = section.detail;
  const reason = document.createElement('p'); reason.className = 'status-reason'; reason.textContent = section.reason;
  card.append(heading, status, detail, reason); container.append(card);
}

function render() {
  const health = byId('dashboard-health'); health.replaceChildren();
  for (const card of state.health) renderStatusCard(health, card.name, card);
  const operations = byId('dashboard-operations'); operations.replaceChildren();
  for (const [title, section] of Object.entries(state.operations)) renderStatusCard(operations, title.replaceAll(/([A-Z])/g, ' $1').trim(), section);
  byId('dashboard-next-actions').textContent = statusText(state.nextActions);
  byId('dashboard-critical-alerts').textContent = statusText(state.criticalAlerts);
  byId('dashboard-refreshed-at').textContent = state.refreshedAt;
}

async function readReadiness() {
  try {
    const response = await fetch(READY_PATH, {credentials:'same-origin'});
    if (!response.ok) throw new Error('readiness unavailable');
    state = reduceDashboard(state, {type:'READINESS_RECEIVED', payload:await response.json(), refreshedAt:'JUST NOW'});
  } catch {
    state = reduceDashboard(state, {type:'READINESS_FAILED', refreshedAt:'FAILED'});
  }
  render();
}

byId('toggle-sidebar').addEventListener('click', () => document.body.classList.toggle('sidebar-collapsed'));
renderMenu(); render(); readReadiness();
