export class ApiError extends Error {
  code: string;
  status: number;
  requestId: string | null;
  constructor(code: string, status = 0, requestId: string | null = null) {
    const messages: Record<string, string> = {
      AUTH_REQUIRED: '로그인이 필요하거나 만료되었습니다. 작성 중인 입력은 유지됩니다.',
      FORBIDDEN: '이 작업에 대한 권한이 없습니다.',
      VERSION_CONFLICT: '자료 버전이 변경되었습니다. 현재 입력을 유지하고 기준을 다시 확인하세요.',
      CONNECTION_LOST: '서버에 연결하지 못했습니다. 요청을 자동으로 다시 보내지 않았습니다.',
      RESPONSE_INVALID: '서버 응답 형식을 확인할 수 없습니다.',
      NOT_FOUND: '요청한 대상을 찾을 수 없습니다. 아직 연결되지 않은 기능일 수 있습니다.',
      STORAGE_FAILED: '자료를 처리하지 못했습니다. 성공으로 확인되지 않았습니다.',
    };
    super(messages[code] ?? '요청을 처리하지 못했습니다. 결과를 확인한 뒤 다시 시도하세요.');
    this.name = 'ApiError';
    this.code = code;
    this.status = status;
    this.requestId = requestId;
  }
}
