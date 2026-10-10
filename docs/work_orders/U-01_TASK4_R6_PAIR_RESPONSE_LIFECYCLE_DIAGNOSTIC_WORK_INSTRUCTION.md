# WI-U01-TASK4-R6-PAIR-RESPONSE-LIFECYCLE-DIAGNOSTIC-20261011-001

## 판정·승인 경계

기존 승인 `APPROVAL-20261009-U01-SCOPED-DASHBOARD-CONTRACT-001`, 설계 §29.2, 작업계획 U-01, `U-01_TASK4_POST_H4_RECOVERY_PLAN.md` Task 2와 DC-U01-019의 실제 R6 실패를 좁히는 **비제품 진단**이다. 기능·요구·중요 위험·제품 코드·공개 API·DB schema/migration·인증·권한·Secret/certificate·비용·운영 계약을 변경하지 않는다. Main은 원 승인을 부모로 `MAIN_RECONFIRMED_NON_SEMANTIC` 파생 baseline을 결박한다. 기존 단일 `codex/u01-dashboard-r2`의 결과보고 tail `5e79fbd4cbfbf52b12e6814ebbe7381f4cd21a23`가 local/private 동일·tracked clean·실제 G-05 seq2369 PASS·epoch116 dual lease REVOKED임을 착수 직전 재확인한다. 새 branch/PR/main·history rewrite/force push·ysna/Production은 제외한다.

## 분리할 정확한 두 경계

C5 `f7e6aa4e`의 WSL-server Git exact-SHA 격리 R6 opt-in은 `NETWORK_RESPONSE_FACTS/PAIR_LIST_API status404 reason=TIMEOUT capture_stage=BODY requestfinished=PENDING response_finished=PENDING`, `observed_round=1` 뒤 `settled_round=3`으로 exit1이었다. 전체 R6 FAIL·U-01 NOT_ACCEPTED를 보존한다. 읽기 전용 코드 확인에서 R6 ASGI host는 `f19a_enabled=false`로 조합 목록 route를 registry에서 제거하므로 404 발생 경로와 일치한다. 브라우저 검증은 응답 event 뒤 `allHeaders()`와 `text()`를 기다리는 동안 여러 번 reload한다. 그러나 **서버가 404 본문을 완료하지 못했는지, 페이지 재이동/AbortController로 요청이 취소됐는지, Playwright 캡처가 응답 완료를 놓쳤는지 아직 확정하지 않는다.** 정적 경로 후보를 BODY 대기 원인으로 승격하지 않는다.

Developer는 아래 네 관측을 각각 비밀 없는 상태 enum으로 분리해 실제 WSL 재현에서 원인 후보를 좁힌다. 서로 다른 요청을 같은 요청으로 단정하지 않도록 pair-list 호출의 로컬 순서와 페이지 round를 함께 기록한다. 이것만으로 인과관계가 증명되지 않으면 미확정으로 보고한다.

1. R6 ASGI fixture listener의 정확한 pair-list path에 한정한 비변경 send 관측: registry 등록 boolean, `http.response.start` status class, 최종 `http.response.body`의 `more_body=false` 송신 여부 및 disconnect 여부만 기록한다. 요청/응답 내용·원 path 문자열·인증값을 출력하지 않는다. 서버 wrapper가 응답을 소비·변조·연기하지 않아야 한다.
2. 같은 격리 HTTPS ASGI listener의 조합 목록에 대한 별도 비인증 Playwright request context: status class·헤더 수신·본문 완료·request API 완료만 기록한다. 정확 same-origin target만 허용하고 cookie/storageState/client credential은 상속하지 않으며 context를 종료한다. page Network에 자동 포함되지 않으므로 probe 요청/응답의 header·body도 메모리에서 기존 secret·off-origin 감사한 뒤 고정 enum만 출력한다. 원 URL/query/host/headers/body/cookie/token/DB 값은 출력하지 않는다. 이 probe는 제품·E-NET 증거가 아니며, 404를 성공으로 취급하지 않는다.
3. 초기 페이지가 안정된 동안 same-origin 브라우저 fetch: 응답 status class·본문 완료와 route class만 기록한다. 새 진단 요청도 기존 전체 Network·secret 감사에 포함한다. 정상 404 본문을 읽었어도 Foundation R6 전체 PASS나 U-01 기능 PASS로 승격하지 않는다.
4. 최초 `PAIR_LIST_API` response event의 header/body/finished 및 `requestfinished`/`requestfailed`와 다음 navigation 시작 시각 순서를 안전한 round·enum으로 기록한다. `observed_round=1`, `settled_round=3` 재현에서 navigation 이전 완료와 navigation 뒤 실패 여부를 구분하되, 순서만으로 navigation이 실패 원인이라 단정하지 않는다. 전체 응답 body/secret 감사 요구를 보존한 후 후속 보정안을 제시하며, 이번 진단에서 응답 무시·allowlist·timeout 연장으로 GREEN을 만들지 않는다.

진단 marker는 단일 고정 class/enum·content-length ZERO/POSITIVE/MISSING·transfer enum만 출력하며 원문 응답·비밀·임의 path/query를 출력하지 않는다. `response.text()` 또는 `response.finished()` 미완료·requestfailed는 그대로 fail-closed다. 현재 R6의 same-origin, off-origin credential, request/response body·DOM secret 감사와 200 비스트리밍 완료 단언을 약화하지 않는다. F-19A route 임의 활성화, migration 0020로 임의 전환, 임의 pair seed, 404 무조건 허용, timeout 연장, audit 생략은 금지한다. 실제 원인에 제품 계약 변경이 필요하면 이 WI에서 수정하지 않고 별도 설계변경으로 분리한다.

## 소유권·순차 checkpoint

- Main의 **W8**은 위 기준 tail의 직접 자식이며 본 WI·대응 Invocation·`docs/WORK_STATUS.md` 정확3문서 한 commit이다. WI/Invocation SHA256·부모 approval·실제 branch/private/Event prefix·active lease null을 기록한다. 새 route 구현 전 W8 G-05 RED는 예상 상태이며 PASS가 아니다.
- **A7**은 W8 직접 자식 Event/progress/HANDOFF/detached digest/WORK_STATUS 정확5문서다. seq1~2369 원문 보존 뒤 seq2370 WI→2371 epoch117 worker→2372 write를 append한다. worker/write의 서로 다른 24시간 fencing token, 단일 `developer-primary`, 정확 허용 코드4경로·제품0을 결박한다. A7 독립 검토·private 게시 뒤에만 Developer에 dispatch한다.
- Developer는 `scripts/check_project_progress.py`, `tests/tooling/test_u01_postmerge_control_projection.py`, `tests/browser/f20-u01-oidc-browser-pg15.mjs`, `tests/integration/test_f20_u01_oidc_browser_pg15.py` 정확 최대4코드 경로에서 marker 정상·위조·비밀 포함·미완료·reload 경쟁을 RED→GREEN TDD로 구현한다. Main은 활성 write lease 동안 이 파일에 쓰지 않는다. 역사 R6/G-05 경로·append-only Event·Git/private/dirty 위조 음성은 불변이다. **C7**은 A7 직접 자식 코드 정확 최대4경로 한 commit이며 Node self-test/구문, Python 집중·인접 회귀, 독립 Critical/Important0, diff check0, local/private 동일·tracked clean의 실제 G-05 PASS 전 WSL QA 금지다.
- C7 뒤 Main이 새 사전등록 단일 `ssh WSL-server` Git exact-SHA QA checkout과 새 빈 격리 PG15/OIDC/HTTPS/Chromium에서 R6 opt-in을 한 번 수행한다. 실행 전 literal 경로·컨테이너명·image·port·owner·수명·정리 방법을 commentary/WORK_STATUS에 기록하고 부재·realpath·symlink를 확인한다. 성공·실패 모두 exact ID/label/image/mount/port와 경로 owner/realpath/link/process 확인 뒤 **전용 자원만** 제거·잔여0을 검증한다. 임시 격리 PASS를 정식 WSL 통합·인수 PASS로 승격하지 않는다.
- 실측 후 **B7**은 C7 직접 자식 progress/HANDOFF/digest/WORK_STATUS 정확4문서로 성공·실패를 사실대로 결박한다. **H7**은 B7 직접 자식 Event/progress/HANDOFF/digest/WORK_STATUS 정확5문서로 seq2373 write→2374 worker를 회수한다. 첫 보고 tail은 H7 직접 자식의 신규 `docs/04_test_reports/U-01_TASK4_R6_PAIR_RESPONSE_LIFECYCLE_DIAGNOSTIC_RESULT.md` 추가(A)와 `docs/WORK_STATUS.md` 수정(M) 필수, 새 미진일 때만 `design_change.md` 수정(M)을 선택하는 정확2~3경로 한 commit이다. design_change 수정은 역사 바이트 prefix를 보존한 append만 허용한다. 첫 보고 포함 최대256 직접 자손 tail, 뒤에는 `docs/WORK_STATUS.md` 수정(M) 한 경로만 허용하고 보고/DC blob 불변·rename/삭제 거부다. 각 SHA의 실제 G-05와 독립 Critical/Important0을 확인하고 과거 PASS를 상속하지 않는다.

## 종료 기준·미진

이번 WI는 ASGI body-final-send/직접 request/안정 페이지 fetch/초기 응답과 navigation 경계의 완료·실패 상태를 실제 WSL에서 재현하고, BODY PENDING 원인 후보를 증거로 분리해 보고하며, QA 잔여0·epoch117 임대 회수·최신 G-05를 확인하면 닫는다. 직접 인과관계가 남으면 미확정으로 보고하고 서버/제품 원인으로 단정하지 않는다. 추가 실패는 WORK_STATUS와 필요 시 `design_change.md`에 미진으로 남긴다. E-NET/E-API/E-AUD·U-01 필수 ID와 전체 R6/인수는 별도 실제 증거 전까지 FAIL 또는 NOT_EXECUTED다. Rollback은 이번 신규 commit만 정상 revert하고 역사 Event·승인·private 복구 ref를 보존한다.
