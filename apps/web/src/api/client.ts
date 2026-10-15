import { ApiError } from './errors.ts';
export { ApiError } from './errors.ts';
export class ApiClient {
  transport: typeof fetch;
  constructor(transport: typeof fetch = fetch) { this.transport = transport; }
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
