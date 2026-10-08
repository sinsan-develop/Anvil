# F-20/U-01 R35 Health·Critical 읽기 화면 결과

## 판정

COMPLETED — Developer의 exact5 구현 및 로컬 기본 검증 완료. Main 독립 판정·동일 SHA WSL PG15/OIDC/Chromium 실행 전이다. C30 OPEN_BLOCKING, F20/U01 미수락, ReleaseDecision DEFER를 유지한다. formal FAILURE_REPORT 0. RED·중간 assertion 정합 보완은 정식 실패가 아니다.

## 기준과 권한

- cwd: `D:\Project\Anvil\.worktrees\anvil-f18-wsl-ops`, branch `codex/f18-wsl-ops`.
- 시작 HEAD `6e9200f320ad7155bfc7e4fc428ca452380bf2d1`, status clean. Main이 전달한 private 동기화 근거를 사용했으며 Developer의 원격 재조회는 하지 않았다.
- 시작 G-05: `C:/Users/cyhuh/anaconda3/python.exe -B -m scripts.check_project_progress`, exit0, seq2014/AUTO_CONTINUE.
- actor `developer-primary-f20-u01-r35`, epoch50; worker `worker-lease-f20-u01-r35-r35read04b`, write `write-lease-f20-u01-r35-r35read04b`.
- execution `f20-u01-r35-execution-fence-epoch-50-r35read04b`; write `f20-u01-r35-write-fence-epoch-50-r35read04b`.
- 발효 `2026-10-04T02:11:08+09:00`, 만료 `2026-10-04T14:11:08+09:00`. lease의 baseline/dispatch `7850b7fbbdef431ab7bedeee250ee6fef0579d04` 이후 Main control commit을 현재 HEAD로 사용한다.
- WI SHA256 `EF0D9A37BF7A53B28864C41F0948BFD778436BAC3F6973AFF143CBF47656EADD`.
- Invocation SHA256 `CBE94EB20BFE3CC30AA917FE4C819EA88DA6A3F3015748C2A86516F7E7102407`.
- Plan SHA256 `861CA69678283F9DCCB0DA512DA9A946913B256CEB378456C4433BE8E7C8E46C`.
- 실행계획/TDD/완료 전 검증 skill에 따라 실패를 먼저 관측한 뒤 최소 구현하고 fresh 결과를 확인했다. 별도 agent 생성0.

## 변경과 보존 계약

정확히 다음 5개만 변경했다. 공개 API·서버 owner·권한·CSRF·DB schema·Event·progress·Handoff·WORK_STATUS 변경0.

1. `apps/web/src/console/App.tsx`: 기존 Dashboard health 여섯 source를 공통 카드로 표시. readiness/Provider 등록 수를 건강 판정으로 승격하지 않는다. source gap/UNKNOWN에서 오류0·점검시각을 합성하지 않으며 malformed/future는 UNAVAILABLE. Critical impact/next_action은 bounded 원문을 React text로만 표시하고 내부 URL·credential-like 값은 거부한다. 신규 ACK/링크/쓰기 없음.
2. `apps/web/tests/f15-console.test.mjs`: 여섯 component 정상·오염·gap·범위·시각·credential/encoding·권한/재연결/취소와 기존 R34 회귀.
3. `tests/integration/test_f20_u01_oidc_browser_pg15.py`: R35 evidence exact fields/types/누락/extra/위조 거부 및 R28/R34와 증거 분리. 기존 격리 opt-in fixture에 명시적 QA HealthSignal 1개 추가.
4. `tests/browser/f20-u01-oidc-browser-pg15.mjs`: 실제 API↔DOM 여섯 Health·Critical 텍스트·권한 철회 assertion 및 로컬 audit self-test. 기존 브라우저 실측 경계 보존.
5. 이 결과보고서.

HealthState 정본은 `packages/observability/models.py`의 HEALTHY/LATE/EXPIRED/UNKNOWN 네 종류다. 기존 Console shape에서 과허용하던 DEGRADED/UNHEALTHY를 정상으로 추가하지 않고 해당 카드 UNAVAILABLE로 검증했다.

### 브라우저 assertion 변경 이유와 약화하지 않은 불변식

- R35부터 Provider Health는 Dashboard GET의 종속 값이다. 따라서 Provider 카드 전체가 Dashboard 재조회 중 불변이라는 과거 단언 대신, 여섯 카드 모두 LOADING/QUOTA/CANCELLED/RECONNECTING/BLOCKED로 전이하며 이전 관측값을 지우는 단언으로 바꿨다. 독립 보존은 별도 readiness와 Critical GET 자료에 적용한다.
- Critical에 같은 `next_action` 문구를 새로 표시하므로 body 전체에서 조치 문자열이 없어야 한다는 과거 단언은 올바르지 않다. Next Actions의 정확한 DOM에서 이전 row/문구 제거를 검사하고 Critical DOM은 독립 GET 자료의 동일성을 검사한다. 최종 권한 철회/reload 후에는 Critical li0 및 여섯 Health BLOCKED, 점검/오류/등록 문구0을 모두 요구한다.
- same-origin URL·GET·request count1·중복 방지·abort/late response·최신 관측시각 보존·secret/error body 미노출·accessible loading·mutation request0은 삭제하거나 완화하지 않았다.
- R28 evidence exact 키 검증은 유지하고 알려진 `healthAlertEvidence`만 별도 R35 validator로 분리했다. unknown extra는 계속 거부한다. R34의 3/1/1/1 비0 Run 수·분모·관측시각·나머지3 UNAVAILABLE·권한 철회 회귀도 유지한다.
- Health details와 Critical action은 링크/버튼/입력0이다. 안전 문구의 HTML은 escape되며 정규화/최대4회 decode는 검사에만 사용하고 정상 한국어·전각·퍼센트 원문은 보존한다.

### 격리 QA Health 관측값의 한계

기존 formal fixture에는 health_signals가 없어 모든 Health가 UNKNOWN이었다. 기존 `OperationsSources`에 Database HEALTHY, 오류0, 마지막점검 `2026-09-27T23:59:50+00:00`인 host 주입 HealthSignal 1개를 넣었다. 나머지5 UNKNOWN과 기존 단일 WORKER_LEASE_EXPIRED alert·R34 Run fixture는 유지한다. source는 `ISOLATED_QA_HEALTH_SIGNAL_NOT_LIVENESS`로 증거에 고정한다. 이것은 격리 QA 자료의 API↔DOM 렌더링 양성 증거이며 실제 DB liveness·운영 Health PASS가 아니다. 여섯 source의 비0 오류수1~6은 로컬 합성 단위검증이다.

## TDD 및 정확한 로컬 명령

모든 명령은 위 cwd 기준이다. Node Console 직접 명령만 `apps/web`에서 실행했다. Python executable은 `C:/Users/cyhuh/anaconda3/python.exe`.

|명령|exit|실측|
|---|---:|---|
|`node --import tsx --test --test-name-pattern=R35 tests/f15-console.test.mjs` 최초|1|0P/2F, 여섯 source 미연결 TypeError 및 Critical 새 문구 부재|
|위 R35 집중 보강 RED|1|4P/1F, UNKNOWN 오류0 노출|
|`node --import tsx --test --test-name-pattern='R35 alert text' tests/f15-console.test.mjs`|1|0P/1F, protocol-relative 내부 URL 미차단|
|`C:/Users/cyhuh/anaconda3/python.exe -B -m pytest -q -p no:cacheprovider --import-mode=importlib tests/integration/test_f20_u01_oidc_browser_pg15.py -k r35 --tb=short` 최초|1|1F/39 deselected, R35 evidence validator 부재|
|위 Python 명령의 `-k r35_qa_signal`|1|1F/41 deselected, QA source helper 부재|
|`node tests/browser/f20-u01-oidc-browser-pg15.mjs --audit-self-test` 최초 R35 보강|1|Health API↔DOM validator 부재 ReferenceError|
|`C:/Users/cyhuh/anaconda3/python.exe -B -m pytest -q -p no:cacheprovider --import-mode=importlib tests/integration/test_f20_u01_oidc_browser_pg15.py -k 'r35 or evidence_does_not_contaminate' --tb=short` 최종 집중|0|5P/37 deselected, 1.96s|
|`npm run web:test` 최종|0|68P/0F/0S, 631.0614ms|
|`npm run web:typecheck`|0|tsc PASS|
|`npm run web:lint` 최종|0|3 files, no fixes/정보 경고0|
|`npm run web:build` 최종|0|20 modules, 178ms|
|`node --check tests/browser/f20-u01-oidc-browser-pg15.mjs`|0|구문 PASS|
|`node tests/browser/f20-u01-oidc-browser-pg15.mjs --audit-self-test` 최종|0|R6_AUDIT_SELF_TEST_PASS. 출력 중 TIMEOUT/FAILED 문자열은 의도된 오류 분류 음성 probe이며 실제 브라우저 실행이 아님|
|`C:/Users/cyhuh/anaconda3/python.exe -B -c "from pathlib import Path; p=Path('tests/integration/test_f20_u01_oidc_browser_pg15.py'); compile(p.read_bytes(), str(p), 'exec'); print('COMPILE_PASS')"`|0|COMPILE_PASS, pyc 생성0|

최종 관련 Python 명령:

```text
C:/Users/cyhuh/anaconda3/python.exe -B -m pytest -q -p no:cacheprovider --import-mode=importlib tests/observability tests/api/test_f13_operations_api.py tests/api/test_f20_u01_r10_dashboard_api.py tests/api/test_f20_u01_r10_oidc_dashboard.py tests/api/test_f20_u01_r9_oidc_queue_host.py tests/api/test_f20_u01_r18_run_host_pg15.py tests/persistence/test_f20_u01_run_read.py tests/persistence/test_f20_u01_r8_queue_read.py tests/integration/test_f20_u01_oidc_browser_pg15.py --basetemp=.tmp_subagent_review/r35/final --tb=short -rs
```

exit0, **164 passed, 3 skipped, 1 warning in 10.72s**. SKIP2 = R18 isolated PostgreSQL15 opt-in 부재, SKIP1 = R6 PG15/browser opt-in 부재. warning1 = 기존 python_multipart deprecation. 이전 보강 전 같은 범위는 163P/3S였으며 최종 근거는 164P/3S다.

중간 Console61P/4F는 R35에서 명시적으로 변경되는 Critical 새 텍스트·Database readiness/Health source 분리·DOM 순서 기대를 확인한 결과였다. 정본 source별 assertion으로 교체 후 최종0F. 첫 lint info1은 단일-child fragment였고 제거 후 최종0. Git user-level ignore 접근 경고는 읽기 환경 경고이며 Git 설정 수정0.

## 임시물·실행 경계

- 생성 전 `apps/web/dist`와 `.tmp_subagent_review/r35` 부재 확인. 전용 pytest root는 `D:\Project\Anvil\.worktrees\anvil-f18-wsl-ops\.tmp_subagent_review\r35\related` 및 `...\r35\final`뿐이다.
- pytest/build 세션 64027/85941/86239 모두 exit0 종료 후 정리. root 실경로·ReparsePoint 없음 확인, pytest SymbolicLink12개 target이 전부 정확한 r35 내부임을 확인한 뒤 링크 자체만 unlink하고 root 삭제. dist3 files/링크0 확인 후 exact dist만 삭제. 최종 r35/dist 잔여0.
- 첫 inventory 출력은 PowerShell 혼합 table 포맷 때문에 잘렸고 Get-Process 이름 부재 처리로 exit1이었다. JSON 재조회 exit0으로 링크12개 경계 확인. 환경 진단1회, 제품 실패 아님. 기존 Python/Node 프로세스163개는 이 테스트 세션과 무관하므로 중지0; 임의 PID 종료0.
- 제거한 것은 재생성 가능한 해당 테스트/빌드 임시 출력뿐이다. 다른 root·사용자 파일·기존 서비스 변경0.
- Git stage/commit/push0, WSL/DB/Docker/Provider/외부 네트워크/ysna/Production 실행0. Main 소유 현황/통제 변경0.

## 파일 SHA256

- App.tsx: `8348610E23EFA748D2F96E508DE985B957D0AE9A8F130A12973929B9E67152D5`
- f15-console.test.mjs: `FC73ED9FE0A7F2BE3B39CC957613027F4C1C4AF758CA917B49308C778B646927`
- test_f20_u01_oidc_browser_pg15.py: `2640C18464D3B2AB87161BD48B5C90DFAB74CD94A6C68A1CC7F085C59CBB2808`
- f20-u01-oidc-browser-pg15.mjs: `897D7ACC196EC48E8F2199103A7BB5EA4861FD4AD44AF4B54F8A91367047024F`
- 보고서 자체 hash는 자기참조를 피하여 최종 인계 메시지에 별도 기록한다.

## 조치와 잔여 위험

실제 격리 PG15/OIDC/Chromium/Network는 **Main 미실행/Developer NOT_EXECUTED**이며 새 source별 assertion의 실제 실행 확인이 남아 있다. QA HealthSignal은 실제 운영 Health 측정이 아니다. PG18·Production auth/Provider·실제 서비스 상태·전체 U01/F20 인수는 미검증이다. 승인된 다음 행동은 Main 독립 diff 검토 후 동일 SHA QA이지 자동 acceptance가 아니다.

rollback은 Main이 이 exact5의 R35 diff만 검토하여 기준 HEAD 내용으로 복구하거나 향후 checkpoint를 정상 revert한다. 기존 R34/history·통제 원장·사용자 자료를 건드리지 않는다. Developer는 rollback·lease 회수·commit을 실행하지 않는다.

## 최종 인계 확인

- Main의 `%` 검토 시점은 초기 unconditional decode 버전이었다. 최종은 `%[0-9a-f]{2}` 패턴이 있는 경우만 decode하며 단독 `%`는 원문으로 보존한다. `CPU 95% 사용`과 `진행 50% · Ａ 작업`을 impact/next_action 각각에서 LOADED·동일 원문·DOM 포함으로 확인했다. 위험 인코딩 검사와 별개다.
- `node --import tsx --test --test-name-pattern='R35 alert text' tests/f15-console.test.mjs`: exit0, 1P/0F/0S, 236.3473ms. 이어서 `node --import tsx --test tests/f15-console.test.mjs`: exit0, 68P/0F/0S, 431.1536ms. App/browser/Python 파일은 앞선 fresh 회귀 이후 추가 변경0이다.
- 최종 `C:/Users/cyhuh/anaconda3/python.exe -B -m scripts.check_project_progress`: exit0, `PASS sequence=2014 reporting=AUTO_CONTINUE`.
- `git diff --check`: exit0. 추적 코드/테스트 diff는 4 files, 331 insertions(+), 84 deletions(-), 새 보고서1을 포함하여 exact5다. 보고서는 untracked 상태로 인계하며 stage하지 않았다.
- Main 독립 검토 및 실제 WSL QA가 남았다. lease ACTIVE 유지, 임의 회수/완료 Event 작성0.
