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
