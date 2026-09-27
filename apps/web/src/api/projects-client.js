import {projectsApiPath} from '../features/projects/projects-state.js';

export async function scanProjects(fetchImpl = fetch) {
  const response = await fetchImpl(projectsApiPath(), {method: 'GET', credentials: 'same-origin', headers: {Accept: 'application/json'}});
  let payload = null;
  try { payload = await response.json(); } catch { payload = null; }
  if (!response.ok) throw new Error(payload?.message || 'Repository scan unavailable.');
  return payload;
}
