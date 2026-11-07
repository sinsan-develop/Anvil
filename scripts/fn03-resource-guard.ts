/** FN03 일회 QA 전용. 제품 및 정식 자원에는 사용하지 않는다. */
export const fn03Resources = Object.freeze({
  root: '/home/daon/deploy/anvil-v3-fn03-document-qa-01',
  protected: '/home/daon/.local/share/anvil-v3-fn03-document-qa-01',
  dependencies: '/home/daon/deploy/anvil-v3/node_modules',
  pg: 'anvil-v3-fn03-document-qa-pg', node: 'anvil-v3-fn03-document-qa-node', net: 'anvil-v3-fn03-document-qa-net',
  database: 'anvil_v3_fn03_document_qa', owner: 'AV3_FN03_DOCUMENT_ISOLATED_QA',
  daemon: 'e3349f1d-dbfc-478a-96d9-295bf6c6839e',
  pgImage: 'postgres@sha256:6eb0add3b77c081df18aa518ce43df58fdcc40f2e6d868a6fd08038dc7acd425',
  pgId: 'sha256:594290e91b09c09728ed945ff89db65cd0fafff251f7c03c3d99c00ae5d9442f',
  nodeImage: 'node@sha256:0e0ff40c39bc087845bfb27465a0df4ea419520094bc35842ff83dd8cbe6f9b6',
  nodeId: 'sha256:e8c4de1e2519b4f34de27a595df6c2a32df28baa90db80bfaf2e038889d94390',
});

export function fn03CallBudget(deadline: number, now = Date.now(), maximum = 30000) {
  if (!Number.isFinite(deadline) || !Number.isFinite(now) || !Number.isFinite(maximum) || maximum <= 0 || deadline <= now)
    throw Error('FN03_RESOURCE_DEADLINE');
  return Math.min(deadline - now, maximum);
}

export function assertFn03FileIdentity(actual: { dev: number; ino: number; uid: number; nlink: number; hash: string }, expected: { dev: number; ino: number; hash: string }) {
  if (actual.uid !== 1000 || actual.nlink !== 1 || actual.dev !== expected.dev || actual.ino !== expected.ino || actual.hash !== expected.hash)
    throw Error('FN03_PROTECTED_FILE_CHANGED_PRESERVE');
}

export function assertFn03Owned(item: any, kind: 'pg' | 'node' | 'network', instance: string, networkId: string | null) {
  const r = fn03Resources, labels = kind === 'network' ? item?.Labels : item?.Config?.Labels;
  if (!/^[0-9a-f]{32}$/.test(instance) || !/^[0-9a-f]{64}$/.test(item?.Id ?? '')
    || labels?.['anvil.owner'] !== r.owner || labels?.['anvil.project'] !== 'v3'
    || labels?.['anvil.instance'] !== instance || item?.Name !== (kind === 'network' ? r.net : '/' + r[kind]))
    throw Error('FN03_RESOURCE_NOT_OWNED');
  if (kind === 'network') { if (item.Internal !== true) throw Error('FN03_NETWORK_NOT_INTERNAL'); return; }
  const h = item.HostConfig, networks = item.NetworkSettings?.Networks;
  if (!networkId || !networks || Object.keys(networks).length !== 1 || networks[r.net]?.NetworkID !== networkId
    || h?.PublishAllPorts !== false || Object.keys(h?.PortBindings ?? {}).length
    || item.Image !== (kind === 'pg' ? r.pgId : r.nodeId)) throw Error('FN03_RESOURCE_CONFIGURATION');
  if (kind === 'pg') {
    if (item.Mounts?.length !== 0 || JSON.stringify(h.Tmpfs) !== JSON.stringify({ '/var/lib/postgresql/data': 'rw,noexec,nosuid,size=268435456' })
      || JSON.stringify(item.NetworkSettings.Ports) !== JSON.stringify({ '5432/tcp': null })) throw Error('FN03_PG_MOUNT_PORT');
  } else {
    const expected = [
      [r.root, '/qa-source'], [r.dependencies, '/qa-source/node_modules'], [r.protected, '/qa-config'],
    ];
    if (h.ReadonlyRootfs !== true || item.Config.User !== '1000:1000' || item.Config.WorkingDir !== '/qa-source'
      || item.Mounts?.length !== expected.length || expected.some(([source, target]) => !item.Mounts.some((m: any) => m.Type === 'bind' && m.Source === source && m.Destination === target && m.RW === false))
      || JSON.stringify(h.Tmpfs) !== JSON.stringify({ '/qa-data': 'rw,noexec,nosuid,size=67108864,uid=1000,gid=1000,mode=0700', '/tmp': 'rw,noexec,nosuid,size=16777216' })
      || Object.keys(item.NetworkSettings.Ports ?? {}).length) throw Error('FN03_NODE_MOUNT_PORT');
  }
}
