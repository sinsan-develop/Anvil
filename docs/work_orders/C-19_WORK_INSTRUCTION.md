# C-19 WorkInstruction — Remote Control Plane·Web Console/PWA

## 범위

- Event Store, Command Queue, Artifact 참조, SSE/Last-Event-ID 재생 경계
- CommandEnvelope의 idempotency·fencing·offline `PENDING_REMOTE`
- 모바일/PC 운영 모니터링·Agent 대화·승인·지시를 위한 transport-agnostic domain 계약
- same-origin 전제와 고위험 명령 승인 차단

## 완료 조건

1. 모든 입력은 canonical identity·UTC timestamp·단조 sequence를 fail-closed 검증한다.
2. 이벤트 재생은 Last-Event-ID/cursor와 중복·unknown cursor를 안전하게 처리한다.
3. 명령은 인증 세션·만료·미래시각·idempotency·fencing을 검증하고, 고위험은 ApprovalRequest만 생성한다.
4. 오프라인 명령은 bounded queue와 `PENDING_REMOTE` 상태, stale/replay 방지를 제공한다.
5. artifact/diff reference와 Agent 대화·승인 대상 hash를 외부 I/O 없이 표현한다.
6. 신규/회귀 테스트, compileall, `git diff --check`를 실행하고 실제 WebSocket/SSE/DB/browser/deploy는 미검증으로 기록한다.

## 금지

- 실제 서버·DB·Telegram·Provider·브라우저·배포 호출
- 승인 없는 merge/deploy/delete/권한/credential 변경 실행
- same-origin 규칙을 우회하는 절대 URL/API 주소 추가
