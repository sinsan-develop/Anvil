import {DASHBOARD_OPERATION_DEFINITIONS, MENU_ITEMS, READY_PATH, createDashboardState, reduceDashboard} from '../features/app-shell/app-shell-model.js';

const byId = id => document.getElementById(id);
const statusClass = status => status === 'READY' ? 'status-ready' : 'status-unavailable';
let state = createDashboardState();

function statusText(section) { return `${section.status} · ${section.reason}`; }

function renderMenu() {
  const list = byId('app-menu');
  for (const item of MENU_ITEMS) {
    const entry = document.createElement('li');
    const link = document.createElement(item.state === 'ACTIVE' ? 'a' : 'span');
    link.textContent = item.label;
    if (item.state === 'ACTIVE') {
      link.href = item.href;
      if (item.id === 'dashboard') link.setAttribute('aria-current', 'page');
    } else {
      link.className = 'menu-unavailable';
      link.setAttribute('role', 'link');
      link.setAttribute('aria-disabled', 'true');
      link.tabIndex = -1;
      link.title = '이 메뉴는 아직 준비 중입니다.';
    }
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
  const status = document.createElement('p'); status.className = `status ${statusClass(section.status)}`;
  const icon = document.createElement('span'); icon.className = 'status-icon'; icon.setAttribute('aria-hidden', 'true'); icon.textContent = section.icon || '○';
  status.append(icon, ` ${section.status}`);
  const detail = document.createElement('p'); detail.className = 'status-detail'; detail.textContent = section.detail;
  const reason = document.createElement('p'); reason.className = 'status-reason'; reason.textContent = section.reason;
  const metadata = document.createElement('dl'); metadata.className = 'status-metadata';
  for (const [label, value] of [['Last checked', section.lastChecked || 'UNAVAILABLE'], ['Error count', section.errorCount || 'UNAVAILABLE']]) {
    const row = document.createElement('div'); const term = document.createElement('dt'); const definition = document.createElement('dd');
    term.textContent = label; definition.textContent = value; row.append(term, definition); metadata.append(row);
  }
  const detailLink = document.createElement('span'); detailLink.className = 'detail-link'; detailLink.setAttribute('aria-disabled', 'true'); detailLink.title = section.detailLink?.reason || '상세 source is not connected.'; detailLink.textContent = section.detailLink?.label || '상세 링크 UNAVAILABLE';
  card.append(heading, status, detail, reason, metadata, detailLink); container.append(card);
}

function render() {
  const health = byId('dashboard-health'); health.replaceChildren();
  for (const card of state.health) renderStatusCard(health, card.name, card);
  const operations = byId('dashboard-operations'); operations.replaceChildren();
  for (const {key, label} of DASHBOARD_OPERATION_DEFINITIONS) renderStatusCard(operations, label, state.operations[key]);
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

const sidebarToggle = byId('toggle-sidebar');
sidebarToggle.addEventListener('click', () => {
  const expanded = document.body.classList.toggle('sidebar-collapsed') === false;
  sidebarToggle.setAttribute('aria-expanded', String(expanded));
  sidebarToggle.textContent = expanded ? '메뉴 접기' : '메뉴 펼치기';
});
renderMenu(); render(); readReadiness();
