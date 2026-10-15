import { ApiError } from './errors.ts';
export { ApiError } from './errors.ts';
export class ApiClient {
  transport: typeof fetch;
  constructor(transport: typeof fetch = fetch) { this.transport = transport; }
  async postAuth<T = unknown>(operation: 'login' | 'setup/claim' | 'logout' | 'reauthenticate' | 'password' | 'recovery' | 'recovery/rotate' | 'invitations' | 'invitations/accept', payload: unknown, csrfToken?: string): Promise<T> {
    const open = operation === 'login' || operation === 'setup/claim' || operation === 'recovery' || operation === 'invitations/accept';
    if (!['login', 'setup/claim', 'logout', 'reauthenticate', 'password', 'recovery', 'recovery/rotate', 'invitations', 'invitations/accept'].includes(operation)) throw new ApiError('CLIENT_PATH_INVALID');
    if (!open && !/^[A-Za-z0-9_-]{43}$/.test(csrfToken ?? '')) throw new ApiError('AUTH_REQUIRED', 401);
    const headers: Record<string, string> = { Accept: 'application/json', 'Content-Type': 'application/json' };
    if (csrfToken) headers['X-Anvil-CSRF'] = csrfToken;
    let response: Response;
    try { response = await this.transport.call(globalThis, '/api/v1/auth/' + operation, { method: 'POST', credentials: 'same-origin', redirect: 'error', cache: 'no-store', headers, body: JSON.stringify(payload) }); }
    catch { throw new ApiError('CONNECTION_LOST'); }
    if (response.ok && response.status === 204) return undefined as T;
    let value: unknown;
    try {
      if (!/^application\/json\b/i.test(response.headers.get('content-type') ?? '')) throw Error('format');
      value = await response.json();
    } catch { throw new ApiError('RESPONSE_INVALID', response.status); }
    if (!response.ok) {
      const record = typeof value === 'object' && value !== null ? value as Record<string, unknown> : {};
      throw new ApiError(typeof record.code === 'string' && /^[A-Z_]{1,64}$/.test(record.code) ? record.code : 'REQUEST_FAILED', response.status);
    }
    return value as T;
  }
  async get<T = unknown>(path: string): Promise<T> {
    if (!path.startsWith('/api/v1/') || /[\\#\r\n]/.test(path)) throw new ApiError('CLIENT_PATH_INVALID');
    const parsed = new URL(path, 'https://anvil.invalid');
    let decoded: string;
    try { decoded = decodeURIComponent(parsed.pathname); } catch { throw new ApiError('CLIENT_PATH_INVALID'); }
    if (parsed.origin !== 'https://anvil.invalid' || parsed.pathname !== path.split('?')[0] || /(?:^|\/)\.\.?($|\/)|[\\%]/.test(decoded)) throw new ApiError('CLIENT_PATH_INVALID');
    let response: Response;
    try {
      response = await this.transport.call(globalThis, path, { method: 'GET', credentials: 'same-origin', redirect: 'error', cache: 'no-store', headers: { Accept: 'application/json' } });
    } catch { throw new ApiError('CONNECTION_LOST'); }
    let body: unknown;
    try {
      if (!/^application\/json\b/i.test(response.headers.get('content-type') ?? '')) throw new Error('format');
      body = await response.json();
    } catch { throw new ApiError('RESPONSE_INVALID', response.status); }
    if (!response.ok) {
      const record = typeof body === 'object' && body !== null ? body as Record<string, unknown> : {};
      const code = typeof record.code === 'string' && /^[A-Z_]{1,64}$/.test(record.code) ? record.code : 'REQUEST_FAILED';
      const id = typeof record.requestId === 'string' && /^[\w-]{1,100}$/.test(record.requestId) ? record.requestId : null;
      throw new ApiError(code, response.status, id);
    }
    return body as T;
  }
}
