# C-21 WSL QA 실제 실행 결과 (seq495)

## 판정

- WSL 승인 범위 ProductValidation: `SUITABLE`
- 검증 범위: `C-21/WSL-EARLY-VALIDATION_APPROVED_SCOPE_ONLY`
- 상태: `TEST_REVIEW_PENDING_INDEPENDENT_JUDGMENT`
- 전체 C-21 acceptance: 미결정, `accepted=false`
- C-01: `BLOCKED_PENDING_C21_INDEPENDENT_JUDGMENT`
- DIR-2: `NOT_TRIGGERED`

## 실제 결과

- private atomic push와 fresh remote recovery: PASS (`candidate=a342d62391a44b349733d1468ac3b180761155ab`, `control=772afbd5eb55791ca7b5002d58378437ea496750`).
- 명시적 `/home/daon/.ssh/config`를 사용한 3차 deploy: PG15/PG18RC 모두 exit 0.
- candidate 배포→verify 1→genuine `324eb169fedbce958d2e8cc29362deb7af433677` rollback→독립 관찰→candidate 복귀→verify 2→cleanup: 모두 PASS.
- 두 target: migration `0013_task_bootstrap_authority`, UI/health/OpenAPI 200, session 201, authenticated SSE 200, Last-Event-ID 200/body 0 bytes, DB counts `1|1|1` 불변.
- rollback은 application-only이며 DB downgrade 0. cleanup 뒤 exact project container/network/volume은 `0/0/0`.
- 최종 application current=`a342d62391a44b349733d1468ac3b180761155ab`, previous=`324eb169fedbce958d2e8cc29362deb7af433677`, checkout clean. `.env` mode=600/owner=root/content unchanged. Secret 원문 기록 0.

## 증거 계층

- Main 실행 관찰: deploy/verify/rollback/redeploy/verify/cleanup exit와 selected receipt fields.
- 독립 read-only 관찰: rollback runtime324, HTTP/API/SSE/DB 불변 및 SSH accepted key 일치. observer scratch SHA-256 `12A975...03B2`.
- private preflight scratch SHA-256 `F1847A...FB07`. server receipt raw bytes는 로컬로 복사하지 않았으므로 hash를 주장하지 않는다.

## 제품 실패와 분리한 환경·도구 오류

- root alias 부재 1회와 inner stage alias 부재 1회는 모두 product mutation 전 exit1이며 product valid failure=0. 2차 trap은 lock/stage residue 0, current runtime324를 보존했다.
- PowerShell/WSL quoting 확인 오류 1회는 결과에서 제외 후 base64 전달로 재관찰했다.
- 외부 invalid-user/failed-auth flood는 Main 인증 실패가 아니다. Main accepted publickey 3건은 등록 fingerprint와 일치하고 SSH 설정 변경은 0이다.

## 미실행과 경계

Telegram, Provider, ysna, 실제 browser Network, main merge는 `NOT_EXECUTED`다. 이 결과는 WSL 승인 범위의 기술 적합성만 기록하며 독립 Tester와 Main acceptance를 생성하지 않는다. 기존 seq1~494와 historical evidence/approval bytes는 수정하지 않는다.

## seq495 투영 검증 이력

- TDD RED: result manifest 부재 1 failure.
- focused GREEN: seq495 positive/증거 승격 변조/Git exact10·61 계약 3 tests PASS.
- 첫 전체 tooling: 142 tests, 467.659s, 13 failures. 신규 제품 계약 실패가 아니라 current seq495 bundle을 historical seq494 테스트가 직접 재사용한 혼합과 seq495 Git fast-path의 generic reason-code 누락이었다.
- 실패목록 focused: 12 tests 중 11 PASS/1 FAIL; 남은 base ancestry reason-code focused 보완 후 1 PASS.
- 최종 전체 tooling 재실행: `142 tests / 540.521s / OK / exit0`. Windows global ignore 접근 경고 외 failure/error 0.
- finalizer는 동일 manifest/digest/snapshot hash를 재생성했고 project checker는 sequence495 PASS다.

## 독립 리뷰 REWORK 검증

- C0/I2 리뷰에서 active/HANDOFF 실행 전 값 모순과 coherent evidence·repository 구조 변조 fail-open을 재현했다.
- active/HANDOFF는 `TEST_REVIEW`, `accepted=false`, C-01 blocked, DIR-2 `NOT_TRIGGERED`, `HOLD_WRITES_PENDING_INDEPENDENT_JUDGMENT`로 정합화했다.
- expected candidate/control/runtime/environment/targets/deploy attempts/verify/migration/rollback observation/final state/exclusions/evidence/history/path count·hash와 repository projection mode/base/head relation/remote/ref/path set을 fail-closed로 고정했다.
- reviewer mutation focused: `6 tests / 2.529s / OK / exit0`.
- 정식 project-progress 전체: `145 tests / 642.358s / OK / exit0`.
- 잘못 넓힌 discover 실행은 `510 tests / 897.234s / 16 failures + 1 error / exit1`이었으며 unrelated historical suite/current-tree mismatch와 npm-cache EPERM으로 분류하고 WORK_STATUS에 보존했다. 이를 PASS로 사용하지 않는다.
- real-Git 내부 fast-path를 공통 repository structural guard로 연결한 최종 보완 후 focused `6 tests / 3.822s / OK / exit0`, 정식 전체 `145 tests / 779.577s / OK / exit0`을 fresh 재확인했다.
