# WI-U01-TASK4-R6-PAIR-PRENAV-CAUSAL-PROBE-20261011-001

## 판정·승인 경계

부모 승인 `APPROVAL-20261009-U01-SCOPED-DASHBOARD-CONTRACT-001`, 설계 §29.2, 계획 U-01, `U-01_TASK4_POST_H4_RECOVERY_PLAN.md` Task 2 및 DC-U01-019의 미완료 실측을 좁히는 비제품 진단이다. Main의 `MAIN_RECONFIRMED_NON_SEMANTIC` 파생 작업이며 기능·요구사항·중요 위험·제품 코드·공개 API·DB schema/migration·인가·Secret/certificate·비용·운영 계약을 바꾸지 않는다. 단일 기존 `codex/u01-dashboard-r2`의 기준 `9fbf9341d70274b1e44fc38e4092583cf9d453e0`과 사설 원격이 같고 tracked clean, G-05 seq2374 PASS, epoch117 worker/write REVOKED·활성 writer0인지 착수 직전에 다시 확인한다. 새 branch/PR/main, force push/history rewrite, ysna/Production 제외.

## 질문·대조 실험

C7 `edbd8e5d`의 WSL-server 격리 실제 R6는 최초 `PAIR_LIST_API` 응답 `404`, header 수신 뒤 body·requestfinished·response.finished `PENDING`인 채 round1→round3에서 TIMEOUT했다. 동일 listener의 ASGI 4XX 최종 body send 9건, 무자격 독립 request 및 안정 페이지 fetch의 body DONE은 **그 원 요청의 완료 증거가 아니다**. 정적 경로에서는 `readyDashboard`가 네 범주 응답만 기다리고 pair capture는 비동기로 남으며, 앱 조합 목록 fetch는 `AbortController`를 사용한다. 다음 화면 이동이 첫 pair capture를 중단시키는지는 미확정이다.

한 가지 변수만 바꾼다. 동일 C8 exact SHA의 새 빈 격리 QA 실행 두 번에서 (A) 기존 R6 순서와 (B) 진단 전용 모드를 순차 수행한다. 두 실행의 이미지 digest·migration 0019·seed/권한·harness 설정·Chromium 버전·기존 timeout을 일치시키고 비밀 없는 설정 hash와 opt-in boolean을 기록한다. B는 최초 pair 응답 객체·요청 식별자에 결박된 기존 `captureResponseFact`의 **기존 제한시간** 안의 완료 또는 실패를 첫 후속 reload 직전에 기다린다. barrier 진입 시 capture가 이미 TIMEOUT/실패했거나 제한시간이 끝났다면 개입 성립 여부를 `INVALID_PRENAV_INTERVENTION`으로 기록하고 navigation 가설을 판정하지 않는다. 유효한 barrier에서 완료 전 TIMEOUT이면 reload 없이 그 실패를 `PRENAV_BODY_PENDING`으로 기록하고 중단한다. B에서 완료해도 404를 허용/무시하지 않고 전체 response/body/Secret/Network 감사와 R6의 기존 실패 판정을 유지한다. 두 실행의 첫 pair 식별자, 관측 round, header/body/finished/requestfinished/requestfailed, reload 진입 전후 순서, 서버 final-send를 비밀 없는 고정 enum·정수로 비교한다. B 완료·A 미완료라도 navigation 인과는 후보이며 반복성·추가 반증 전 제품 결함 또는 R6 PASS로 단정하지 않는다. A/B 결과가 같거나 재현되지 않으면 가설은 미확정으로 기록하고, 유효한 개입·반복성·반증 조건이 충족된 때만 기각을 판단한다.

기존 timeout 연장, sleep 추가, 404 allowlist/성공 처리, 본문 또는 Secret 감사 생략, F-19A 임의 활성화, 임의 pair seed, 서버 응답 변경, 앱 fetch 변경, 제품 file write를 금지한다. 진단 모드는 명시적 opt-in이며 일반 R6 경로의 실행·판정은 바꾸지 않는다. 원문 URL·query·host·header·body·cookie·token·DSN은 출력하지 않는다. 별도 QA 결과를 정식 WSL 통합·U-01 인수로 승격하지 않는다.

## 소유권·순차 checkpoint

- Main의 **W9**는 기준 `9fbf9341` 직접 자식, 본 WI·대응 Invocation·`docs/WORK_STATUS.md` 정확3문서 한 commit이다. 기준 설계·계획·WI·Invocation·부모 approval hash, branch/private/Event raw prefix·active lease null을 기록한다. 새 G-05 route 전 W9 RED는 예상이며 PASS가 아니다.
- **A8**은 W9 직접 자식 Event/progress/HANDOFF/detached digest/WORK_STATUS 정확5문서다. seq1~2374 원문 보존 후 seq2375 WI→2376 epoch118 worker→2377 write를 append한다. 서로 다른 24시간 fencing token, 단일 기존 `developer-primary`, 아래 정확 최대4 코드 경로·제품0을 결박한다. 독립 Critical/Important0·사설 원격 게시 후에만 Developer를 dispatch한다.
- Developer 허용 code path는 `scripts/check_project_progress.py`, `tests/tooling/test_u01_postmerge_control_projection.py`, `tests/browser/f20-u01-oidc-browser-pg15.mjs`, `tests/integration/test_f20_u01_oidc_browser_pg15.py` 최대4다. 원 요청 결박·opt-in 기본 OFF·첫 후속 reload 전 기존 bounded capture·TIMEOUT/failed fail-closed·비밀/오프오리진 감사·위조 모드 거부를 RED→GREEN TDD로 검증한다. 역사 R6와 G-05의 Event/Git/private/dirty 위조 음성을 약화하지 않는다. Main은 유효 write lease 동안 동일 파일을 수정하지 않는다. **C8**은 A8 직접 자식 정확 허용 코드 최대4 한 commit이며 Node self-test/구문, Python 집중·인접, 독립 Critical/Important0, diff check0, local/private 동일·tracked clean의 실제 G-05 PASS 전 WSL QA 금지다.
- Main은 C8 게시 후 A/B 각각에 대해 사전 등록한 **서로 분리된 새 빈** `ssh WSL-server` Git exact-SHA checkout·PG15/OIDC/HTTPS/Chromium QA 자원을 순차 사용한다. 매 실행 전에 literal 경로·container명·image·port·owner·수명·정리 방법을 commentary/WORK_STATUS에 적고 부재·realpath·link를 확인한다. 로컬 개발→private push→WSL Git 수신 exact SHA 외 소스 전달은 금지한다. 각 A/B 종료·실패 때 exact ID/label/image/mount/port와 경로 owner/realpath/link/process를 확인해 해당 전용 자원만 정리·잔여0 후 다음 실행한다. Secret/DSN 원문은 출력하지 않는다.
- **B8**은 C8 직접 자식 progress/HANDOFF/digest/WORK_STATUS 정확4문서로 A/B 실제 결과·오류·미검증·QA 정리를 결박한다. **H8**은 B8 직접 자식 Event/progress/HANDOFF/digest/WORK_STATUS 정확5문서로 seq2378 write→2379 worker를 회수한다. H8 직접 자식 첫 보고 tail은 신규 `docs/04_test_reports/U-01_TASK4_R6_PAIR_PRENAV_CAUSAL_PROBE_RESULT.md` 추가와 `docs/WORK_STATUS.md` 수정 필수2경로, 새 미진에 한해 `design_change.md`의 역사 prefix 보존 append만 선택 허용한다. 첫 보고 commit 포함 전체 tail 최대256 commit만 허용하고, 이후 추가 commit은 그 잔여 한도 안의 WORK_STATUS-only 직접 자손으로 제한한다. 보고/DC blob 불변·rename/삭제 거부다. 각 게시 SHA의 실제 G-05를 다시 확인하고 과거 PASS를 상속하지 않는다.

## 종료·rollback

이 WI의 종료는 A/B 같은 C8 SHA의 실제 실패 경계, 원 요청과 reload 순서, QA 잔여0, epoch118 임대 회수 및 최신 G-05를 **사실대로 보고**하는 것이다. A/B가 원인을 입증하지 못하면 DC-U01-019 미확정 유지; 제품 원인이나 계약 변경 필요성이 발견되면 이 WI에서 제품 수정하지 않고 별도 변경 판단으로 넘긴다. E-NET/E-API/E-AUD/E-SHOT·필수 AV ID 및 전체 R6/U-01은 별도 실제 증거 전까지 FAIL/NOT_EXECUTED·NOT_ACCEPTED다. Rollback은 이번 신규 commit만 정상 `git revert`하고 역사 Event·승인·사설 원격 복구 ref를 보존한다.
