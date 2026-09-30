# F-20/U-01 R19 Next Actions UI QA 완료 lease 종료 계획

## 기준·판정

기준 branch `codex/f18-wsl-ops`의 QA/status checkpoint `b6a39d97af673ef89d07d72a336b4064764208b0`는 사설 원격과 WSL-server 격리 checkout 동일 SHA·clean/G-05 seq1912이다. R19 결과보고서 SHA-256 `AA1AF087C1A70832B3233D179060C4A4B834F208FAAA43459CF4C6ED30C52600`과 WORK_STATUS의 로컬/WSL Node24 frontend 44 PASS, typecheck/lint/build PASS, 일회성 container·node_modules·dist 잔여0을 분리해 확인했다. 이 내부 UI slice 검증은 formal 브라우저 E-SHOT/E-NET/E-API나 전체 U-01/F-20 수락이 아니다.

## 단일 통제 전이

- 기존 epoch33 `write-lease-f20-u01-r19-r19ui3009a`를 seq1913 `WRITE_LEASE_REVOKED`, 종속 `worker-lease-f20-u01-r19-r19ui3009a`를 seq1914 `WORKER_LEASE_REVOKED`로 순차 append한다. 과거 Event 원문 prefix·hash chain을 변경하지 않고 두 fencing token을 회수한다.
- canonical progress/HANDOFF와 detached digest/manifest는 seq1914, worker/write null, 제품 write scope 빈 배열, `COMPLETED_R19_NEXT_ACTIONS_UI_LOCAL_WSL_QA_ONLY`, `next_safe_action=F20_U01_NEXT_INTERNAL_QA_REVIEW_C30_BLOCKED`로 정확히 투영한다. G-05는 같은 투영과 Git allowlist를 검증해야 한다.
- Main control write만 수행한다. 제품 `App.tsx`/console test/결과보고서와 공개 API/DB/schema/인증/Secret은 변경하지 않는다. `C30 OPEN_BLOCKING`, ReleaseDecision `DEFER`, F-20/U-01 미수락, main 미병합·새 branch0, ysna/Production NOT_EXECUTED를 유지한다.

## 검증·rollback

새 close projection 테스트 RED→GREEN, 인접 start/close 테스트, G-05 seq1914, diff check를 확인한 뒤 통제/상태 exact 경로만 기존 branch commit/private push→WSL-server 같은 SHA·clean/G-05로 닫는다. 중간 실패 시 제품 변경을 되돌리지 않고 Event·lease 상태를 읽어 원인부터 분류한다. 이미 append된 Event를 삭제·재작성하거나 이전 fencing token을 재사용하지 않는다.
