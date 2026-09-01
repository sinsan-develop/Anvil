# anvil-web unified API 진행현황

- 단계: Main takeover 후 최소 통합 구현
- 담당: Main Agent 어울
- 상태: IMPLEMENTED_LOCAL_NOT_DEPLOYED
- 기준: d8c989a / codex/anvil-web-unified-api-main
- 변경 파일: apps/web/server.mjs
- 변경 내용: ANVIL_API_UPSTREAM 설정 시 /api/*, /health/*, /integrations/*, /openapi.json 요청을 upstream으로 전달하고 SSE 응답 스트림을 유지
- 테스트: `node --check apps/web/server.mjs` PASS; `git diff --check` PASS; `node --test apps/web/tests/*.mjs` 14 passed
- 오류 횟수: apply_patch ACL 3회 후 Main takeover; npm test 스크립트 없음 1회
- 미검증: 실제 컨테이너 빌드/배포, ysna-server 3770 upstream 연결, 실 Telegram/Provider/DB 호출
- 다음 조치: diff 검토 후 승인된 배포 절차로 이미지 빌드·배포하고 3770 경로별 실제 응답 검증
- 추가 검증: 로컬 mock upstream으로 /api/health, /health/live, /integrations/telegram/webhook, /openapi.json 200 전달 확인; SSE 스트림 전달 구조 확인
- 리뷰: Main 독립 diff 검토 완료; 별도 reviewer 무응답으로 미실행

## 운영 배포 검증 2026-09-01
- tag: anvil-ui-preview-20260901.2 / commit ed82e93
- ysna-server: anvil-web 이미지 빌드·재기동 완료, health=healthy
- 컨테이너 3770: /health/live=200, /openapi.json=200, API upstream 전달 확인
- 미검증: 공개 HTTPS 도메인 라우팅/Telegram signed POST/Provider 호출/SSE 인증 포함 실운영 시나리오

## 예외 보고 2026-09-01
- 판정: PUBLIC_TLS_NOT_VERIFIED
- 이유: ysna-server에서 https://anvil.sinsan.kr/* 요청이 TLS unrecognized name으로 실패
- 영향: 외부 공개 API/UI 검증 불가; 컨테이너 내부 기능은 정상
- 조치: anvil-web 이미지 ed82e93 배포 및 health/openapi 내부 검증 완료
- 미충족: NPM Proxy Host와 Let's Encrypt 인증서가 실제 ysna-server 설정에 일치하지 않음
- 다음 조치: NPM에서 anvil.sinsan.kr 인증서·Proxy Host를 저장/재발급 후 공개 경로 재검증


## 공개 Host 보존 수정 2026-09-01
- 원인: `proxyApiRequest`가 upstream 전달 직전 `Host` 헤더를 삭제하여 API가 내부 컨테이너 호스트를 수신했고 `HOST_VALIDATION_FAILED`(403)를 반환함.
- 조치: 원 요청의 공개 `Host` 헤더를 upstream 요청에 보존하도록 수정.
- 담당: preserve-host-fix subagent
- 검증: `node --check apps/web/server.mjs` PASS; `node --test apps/web/tests/*.mjs` PASS (14/14); `git diff --check` PASS.
- 오류 횟수: apply_patch ACL 차단 1회; 제한된 정확 치환으로 해결.\n- 미검증: 실제 ysna-server 재배포 후 공개 HTTPS API/SSE 인증 흐름.

- 추가 원인 확인: Node etch도 Host를 대상 URL 기준으로 재작성하여 1차 보존 수정만으로 공개 요청이 계속 403이었음.
- 추가 조치: http.request 기반 upstream 전달로 전환하고 원 요청 Host를 명시적으로 전달.
- 추가 검증: 구문검사 PASS; 웹 테스트 14/14 PASS; diff check PASS. 재배포 후 공개 /health/live, /openapi.json, /api/runs/run-1/events 응답을 재확인할 예정.
