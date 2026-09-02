# C-21 공개 인증 프록시 보고서

## 판정

`anvil-web:3770`이 `/auth/*`를 `ANVIL_API_UPSTREAM`으로 전달하도록 구현 완료. 공개 Host 헤더는 upstream에 그대로 전달한다.

## 변경 및 근거

- 변경: `apps/web/server.mjs`의 canonical proxy prefix에 `/auth/` 추가.
- 수정: Node `IncomingMessage`를 직접 순회해 upstream 응답 본문을 전달하도록 수정. 기존 `upstream.body` 참조는 응답 본문을 누락시키는 결함이었다.
- 테스트: `apps/web/tests/public-auth-proxy.test.mjs`가 local upstream을 세우고 `/auth/session?scope=sse`의 경로·응답·공개 Host 보존을 검증한다.

## 검증

- RED: 구현 전 테스트 `404 !== 200` 재현.
- GREEN: `node --test --test-reporter=spec apps/web/tests/*.test.mjs` → 15 passed, 0 failed.
- 미검증: ysna 실제 Docker/NPM 공개 경로와 실제 authenticated SSE 호출은 이 작업 범위에서 실행하지 않음.

## 영향 및 롤백

- `/api/`, `/health/`, `/integrations/`, `/openapi.json` 기존 전달 규칙은 유지한다.
- `/auth`(슬래시 없는 정확한 경로)는 기존처럼 proxy하지 않는다. 계약은 `/auth/*`이다.
- 롤백: 이 커밋을 되돌리면 `/auth/*` 전달과 응답 스트림 수정이 제거된다.

## 작업환경

새 `D:\tmp` 폴더·프로세스·포트·컨테이너·볼륨·네트워크는 만들지 않았다. 기존 worktree만 사용했으며 생성 잔여물은 0건이다.
