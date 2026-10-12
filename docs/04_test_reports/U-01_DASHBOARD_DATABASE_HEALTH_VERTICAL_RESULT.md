# U-01 Dashboard DB 건강 카드 구현 결과

## 판정

DB 건강 카드의 화면·API·DB 판정 경로는 구현했다. 그러나 실제 인증 브라우저에서 화면과 갱신 타이머, 전체 API 요청의 연속 동작은 확인하지 못했다. 따라서 기능 상태는 **구현했지만 동작 미확인**, U-01 전체는 `NOT_ACCEPTED`, Release는 `DEFER`다. 다른 건강 카드 5개와 운영 카드는 미구현이고, W12 반복 진단은 미실행이다.

## 기준·변경·임대

- 승인: `APPROVAL-20261009-U01-SCOPED-DASHBOARD-CONTRACT-001`; WI `docs/work_orders/U-01_DASHBOARD_DATABASE_HEALTH_VERTICAL_WORK_INSTRUCTION.md` SHA-256 `E2E1AF34654E5E0AC7D7031ACC697D4EB192B9316BBCE7E137A6378FBBE363E3`; Invocation SHA-256 `16A43D631FBCF3311BD8BAC5E459A6188B199E69689DDD36EE9033148900FB73`.
- 기존 `codex/u01-dashboard-r2`: A12 `0a17a1f4` → C12 `eb1ab978`(허용 코드 8경로) → QA 사실 `4115ca21`(WORK_STATUS 1경로) → D `c1a558a2`(검사기·통제시험 2경로) → B12 `ef3a3285`(통제 4경로) → H12 `bc1470dfb634faf3422af85b4a8f10083050c6fc`(통제 5경로). 각 자식은 직계이며 제품 변경은 C12에만 있다.
- H12 Event는 seq1~2392 원문을 보존하고 seq2393 `WRITE_LEASE_REVOKED` → seq2394 `WORKER_LEASE_REVOKED`를 추가했다. epoch121 두 lease는 `REVOKED`, active worker/write/agent는 null이다. 정상 `git revert`와 사설 Git 체크포인트로 코드 rollback이 가능하며 Event 원장은 삭제하지 않는다.

## 실제 검증

- 로컬: DB reader·API 권한 등 집중 Python 23 PASS, Web 전체 104 PASS(갱신 타이머 보정 전), 보정 후 대상 Web 1 PASS와 typecheck/lint/build exit0. D 통제 집중 9 PASS/177 deselected, 독립 리뷰 C0/I0; `git diff --check` exit0. Windows TestClient 두 차례 정체는 PASS가 아니다. 인접 epoch120 시험 2 FAIL은 만료된 옛 lease fixture와 현재 벽시계의 충돌로 분리했고 전체 회귀 PASS로 소급하지 않는다.
- WSL-server: 사설 Git exact C12 SHA와 격리 PG15 비관리자 DB에 migration `0020_f19a_pair_grants`를 적용해 실제 `SELECT 1`·정확 Alembic head에서 pair reader `HEALTHY`를 확인했다. 다른 head는 `UNAVAILABLE`; 권한·reader 집중 4 PASS/1 deprecation warning. 이는 DB→reader 국소 증거일 뿐 실제 인증 브라우저·전체 API E2E가 아니다. 등록 QA 경로·컨테이너·loopback port 잔여0을 독립 확인했다.
- B12·H12 독립 문서 검토 Critical0/Important0/Minor0. 각각 기존 사설 브랜치의 local/private exact SHA·tracked clean에서 `python -B scripts/check_project_progress.py` exit0: B12 `G-05 ... PASS sequence=2392`, H12 `G-05 ... PASS sequence=2394`. 기존 `.pytest_cache` ACL 경고는 별개다.

실행 기록의 명령·종료 코드 경계: D 통제 집중은 `C:\Users\cyhuh\anaconda3\python.exe -B -m pytest -q -s -p no:cacheprovider tests/tooling/test_u01_postmerge_control_projection.py -k U01DatabaseHealthVerticalEpoch121Tests` → exit0, `9 passed, 177 deselected`였다. B12와 H12의 통제 확인 명령은 위 `python -B scripts/check_project_progress.py`이고 각각 exit0이다. `git diff --check`도 각 후보에서 exit0이었다. 앞선 Python23·Web104/대상1·typecheck/lint/build 및 WSL4의 **정확한 실행 명령 문자열은 보존된 작업현황에서 확인할 수 없다**. 해당 수치·종료 상태의 기존 기록은 `docs/WORK_STATUS.md`의 “로컬 코드 checkpoint”와 “WSL-server 실제 DB 절편·정리” 항목이다. 명령 미확인을 새 실행이나 전체 suite PASS로 대체하지 않는다.

## 미충족·다음 행동

인증 브라우저의 실제 카드 표시·갱신 타이머·전체 API, 다른 건강 카드 5개·운영 카드, E-NET/E-API/E-AUD/E-SHOT와 필수 인수 ID는 미충족이다. 기존 정상 기능의 합격 기준을 낮추지 않았다. 다음은 원본·권한 계약이 확인된 U-01 미완성 카드 중 하나를 골라 UI→API→DB로 완성하고, 변경 영향에 필요한 핵심 정상·중요 실패·보안/데이터 위험만 확인한다. Oracle Cloud 정밀 검증·공개/운영 투입·PR/main 병합은 수행하지 않았다.
