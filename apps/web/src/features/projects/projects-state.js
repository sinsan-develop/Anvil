export const projectsApiPath = () => '/api/projects/scan';

export function createProjectsState() {
  return {
    status: 'NOT_CONNECTED',
    reason: 'Repository source is not connected.',
    repository: null,
    baseline: {status: 'UNAVAILABLE', reason: 'Baseline is not derived until a read-only scan completes.'},
    mutationAllowed: false,
  };
}

export function reduceProjects(state, action) {
  if (action.type === 'SCAN_FAILED') {
    return {...createProjectsState(), status: 'ERROR', reason: action.message || 'Repository scan failed.'};
  }
  if (action.type !== 'SCAN_RECEIVED') return state;
  const payload = action.payload;
  // The public FastAPI route returns the canonical projection directly;
  // retain compatibility with the legacy local Node BFF projection.
  const scan = payload?.scan ?? (payload?.status ? {
    status: payload.status === 'READY' ? 'SCANNED_READ_ONLY' : payload.status,
    repository: payload.repository,
    noWriteIdentical: payload.noWriteProof?.identical === true,
  } : null);
  const repository = scan?.repository;
  if (!payload?.ok || scan?.status !== 'SCANNED_READ_ONLY' || !repository || scan.noWriteIdentical !== true) {
    return {...createProjectsState(), status: 'BLOCKED', reason: 'Read-only scan did not produce a trustworthy result.'};
  }
  const dirtyPaths = Number(repository.trackedDirtyPaths) || 0;
  const untrackedPaths = Number(repository.untrackedPaths) || 0;
  const clean = dirtyPaths === 0 && untrackedPaths === 0;
  return {
    status: clean ? 'READY' : 'BLOCKED',
    reason: clean ? 'Read-only scan completed; baseline review is still required.' : 'Dirty or untracked paths block baseline review.',
    repository: {branch: repository.branch || 'UNKNOWN', head: repository.head || 'UNKNOWN', dirtyPaths, untrackedPaths},
    baseline: {status: clean ? 'READY_TO_REVIEW' : 'BLOCKED', reason: clean ? 'No repository delta was detected.' : 'Preserve the current repository state before review.'},
    mutationAllowed: false,
  };
}
