import {MENU_ITEMS, WORKBENCH_TABS, getMenuById, normalizeMenuId} from '../features/ui-preview/ui-preview-model.js';

const byId = id => document.getElementById(id);
const sidebar = byId('sidebar-nav');
const summaryCards = byId('summary-cards');
const workbenchSurface = byId('workbench-surface');
const menuDetail = byId('menu-detail');
const drawer = byId('eoul-drawer');
const backdrop = byId('drawer-backdrop');
const popover = byId('preview-popover');
let activeWorkbenchTab = 'conversation';
let popoverTimer;
let previousFocus;

function renderSidebar(activeId) {
  sidebar.replaceChildren();
  for (const item of MENU_ITEMS) {
    const row = document.createElement('li');
    const link = document.createElement('a');
    link.href = `#${item.id}`;
    link.dataset.menuId = item.id;
    if (item.id === activeId) link.setAttribute('aria-current', 'page');
    const icon = document.createElement('span');
    icon.className = 'nav-icon';
    icon.textContent = item.icon;
    const copy = document.createElement('span');
    const title = document.createElement('strong');
    const label = document.createElement('small');
    title.textContent = item.title;
    label.textContent = item.label;
    copy.append(title, label);
    link.append(icon, copy);
    link.addEventListener('click', event => {
      event.preventDefault();
      selectMenu(item.id);
    });
    row.append(link);
    sidebar.append(row);
  }
}

function renderCards(menu) {
  summaryCards.replaceChildren();
  for (const card of menu.cards) {
    const article = document.createElement('article');
    article.className = 'summary-card';
    const heading = document.createElement('h2');
    const value = document.createElement('strong');
    const detail = document.createElement('p');
    heading.textContent = card.title;
    value.textContent = card.value;
    detail.textContent = card.detail;
    article.append(heading, value, detail);
    summaryCards.append(article);
  }
}

function renderWorkbenchTab(tabId) {
  const selected = WORKBENCH_TABS.find(item => item.id === tabId) ?? WORKBENCH_TABS[0];
  activeWorkbenchTab = selected.id;
  const tabs = byId('workbench-tabs');
  tabs.replaceChildren();
  for (const tab of WORKBENCH_TABS) {
    const button = document.createElement('button');
    button.type = 'button';
    button.role = 'tab';
    button.textContent = tab.label;
    button.setAttribute('aria-selected', String(tab.id === selected.id));
    button.addEventListener('click', () => renderWorkbenchTab(tab.id));
    tabs.append(button);
  }
  byId('workbench-tab-title').textContent = selected.title;
  const content = byId('workbench-tab-content');
  content.replaceChildren();
  const notice = document.createElement('div');
  notice.className = 'preview-notice';
  const badge = document.createElement('span');
  badge.textContent = 'UI PREVIEW';
  const copy = document.createElement('div');
  const title = document.createElement('strong');
  const description = document.createElement('p');
  title.textContent = selected.title;
  description.textContent = selected.description;
  copy.append(title, description);
  notice.append(badge, copy);
  content.append(notice);
}

function renderMenu(menu) {
  byId('page-label').textContent = menu.label;
  byId('page-title').textContent = menu.title;
  byId('page-description').textContent = menu.description;
  byId('next-action').textContent = menu.nextAction;
  document.title = `Anvil · ${menu.title}`;
  renderCards(menu);
  const isWorkbench = menu.id === 'workbench';
  workbenchSurface.hidden = !isWorkbench;
  menuDetail.hidden = isWorkbench;
  if (isWorkbench) renderWorkbenchTab(activeWorkbenchTab);
}

function selectMenu(menuId) {
  const id = normalizeMenuId(menuId);
  history.replaceState(null, '', `#${id}`);
  renderSidebar(id);
  renderMenu(getMenuById(id));
  byId('main-content').focus({preventScroll: true});
}

function openWorkbench(tabId = 'conversation') {
  closeDrawer();
  selectMenu('workbench');
  renderWorkbenchTab(tabId);
}

function openDrawer() {
  previousFocus = document.activeElement instanceof HTMLElement ? document.activeElement : undefined;
  drawer.classList.add('open');
  drawer.setAttribute('aria-hidden', 'false');
  backdrop.hidden = false;
  byId('close-eoul').focus();
}

function closeDrawer() {
  const wasOpen = drawer.classList.contains('open');
  drawer.classList.remove('open');
  drawer.setAttribute('aria-hidden', 'true');
  backdrop.hidden = true;
  if (wasOpen) previousFocus?.focus();
}

function showUnavailable(label) {
  clearTimeout(popoverTimer);
  popover.textContent = `${label}: UI 위치만 제공됩니다. 실제 기능은 NOT CONNECTED입니다.`;
  popover.hidden = false;
  popoverTimer = setTimeout(() => { popover.hidden = true; }, 3600);
}

byId('open-eoul').addEventListener('click', openDrawer);
byId('close-eoul').addEventListener('click', closeDrawer);
backdrop.addEventListener('click', closeDrawer);
byId('open-full-workbench').addEventListener('click', () => openWorkbench('conversation'));
document.addEventListener('keydown', event => { if (event.key === 'Escape') closeDrawer(); });
document.addEventListener('click', event => {
  const target = event.target.closest('[data-unavailable]');
  if (target) showUnavailable(target.dataset.unavailable);
});
window.addEventListener('hashchange', () => selectMenu(location.hash));

selectMenu(location.hash);
