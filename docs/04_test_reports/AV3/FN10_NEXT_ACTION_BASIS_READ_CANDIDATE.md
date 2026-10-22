# FN10 선택 검수 근거 조회 — 격리 실제 저장 소비 후보

- 상태: 실행 전 후보. 실제 PG·served 화면·Agent 검증 결과 아님.
- 목적: 승인된 readonly next-action-basis GET가 정상 저장된 원 검수·결과·확정 임무·현재 방법론을 대조하고 기존 Web reader에서 소비되는지 한 번 확인한다.
- 제외: 신규 bound assignment 저장 계약/0038, 정식 DB/권한/서비스·Secret 변경, 실제 Agent/비용, 전체 scheduler·완료 승인, 완료된 FN06/검수 원자성·재실행 시험.

## 1. 코드와 선행

- 기존 branch codex/av3-stage-b의 clean/private 동일 exact SHA만 새 빈 Git checkout으로 가져온다. 원격은 git@github-sinsan-develop:sinsan-develop/Anvil.git이다.
- 실행기: scripts/next-action-basis-isolated-qa.ts, wrapper: scripts/next-action-basis-qa-launch.sh. 시작 절차 scripts/next-action-basis-qa-bootstrap.sh는 clone 전에 trap을 설치하고 exact SHA를 인자로 받는다. 부모는 parent cwd에 머물러 자식의 열린 process 검사를 방해하지 않는다.
- child: 기존 tests/integration/FN12/result-submission-isolated.test.ts의 정상 검수 저장 seed 후 신규 NEXT_ACTION_BASIS_READ만 수행하고 즉시 종료한다. FN12_RESULT_REVIEW_QA=1과 FN10_NEXT_ACTION_BASIS_QA=1의 조합만 허용한다.
- schema: 기존 59개 + 0026_result_review_criteria + 0027_result_reviews 정확61개, manifest SHA256 9fd3dab149805174bc81b0abab14272adcc235ecff0eb902f19043bc5b40eb73. 기존 SQL·정식 migration 등록은 변경하지 않는다. 0037/0038 제외.

## 2. 생성 전 등록 대상

- WSL-server 사용자 daon(UID1000), 최대10분. 생성 직전 부재·realpath·owner·link·관련 프로세스와 정식3개 컨테이너의 full ID/image/StartedAt/상태 불변을 확인한다.
- 새 빈 checkout: /home/daon/deploy/anvil-v3-fn12-result-reviews-qa-01. 기존 검수 seed의 고정 root를 그대로 사용하며, 존재하면 재사용·삭제하지 않고 중단한다.
- child 원문 root: 위 checkout/.av3-data/fn12-raw (0700), 정상 child finally에서 exact 파일 hash/owner/nonlink 확인 후 정리.
- PG: anvil-v3-fn10-next-basis-pg-01, network: anvil-v3-fn10-next-basis-net-01, owner label AV3_FN10_NEXT_BASIS_QA와 신규 32hex instance.
- DB: anvil_v3_fn12_result_reviews_qa_01. disposable PG 내부 전용 비관리자 app/migrator 역할·합성 QA만 사용한다.
- image postgres@sha256:6eb0add3b77c081df18aa518ce43df58fdcc40f2e6d868a6fd08038dc7acd425, image ID sha256:594290e91b09c09728ed945ff89db65cd0fafff251f7c03c3d99c00ae5d9442f, daemon e3349f1d-dbfc-478a-96d9-295bf6c6839e.
- PG data tmpfs 512MiB, 공개 port·host mount·영구 volume·정식 network 연결0. password는 신규 난수·메모리/child 환경만 사용하고 원문을 출력/보존하지 않는다.
- Node /opt/node-v24.21.0-linux-x64/bin/node SHA256 7fde7b8afa198da66257f42ee2001d874c7355631e6d1579a5fb5ef1f246df4c. node_modules는 /home/daon/deploy/anvil-v3/node_modules로 링크 하나만 허용하며 lock bytes 일치·실제 공유 대상은 수정/삭제하지 않는다.

## 3. 범위와 회수

- 정상 seed에 필요한 저장만 격리 DB에 수행한다. 검수/확정 임무 원문 GET 뒤 실제 Web reader로 새 근거 GET 소비, 타인404/NOT_FOUND·익명401/AUTH_REQUIRED·query400/INPUT_INVALID의 고정 비노출 DTO를 확인한다.
- 조회 전후 검수·제출·확정 임무·명령·허가·감사 6표의 **행수** 불변만 검사한다. 전체 내용/경합 불변을 주장하지 않는다. source/실행 보증과 완료·dispatch flags는 false를 유지한다.
- child timeout90초, 부모110초, wrapper150초+TERM30초, runner 회수25초·wrapper checkout회수45초. 기한 소진은 실패다. pool 예외가 PG/net 회수를 건너뛰지 않게 격리한다.
- clone 전 별도 bootstrap에 trap을 먼저 설치하고 실패·시간초과에도 exact ID/name/owner/instance/image/mount/network 확인 후 등록 자원만 회수한다. 이 bootstrap의 literal/exact SHA 대조와 실행 경계 지원 전에는 실행하지 않는다.
- runner PG/net 회수 성공 뒤 wrapper가 관련 열린 process/owner/link/clean Git을 확인하고 의존성 링크만 제거한 뒤 disposable checkout을 정리한다. 회수 실패 시 임의 sudo/광역 삭제 없이 보존·정확 실패를 보고한다.
- 별도 SSH 읽기로 등록 PG/network/root·child root/관련 process 잔여0과 정식3개 불변을 확인한다. 최종 출력은 고정 marker·허용 수치/SQLstate만 재구성하고 raw stdout/stderr·비밀은 출력하지 않는다.

## 4. 현재 증거와 남은 작업

- source helper·guard는 RED→GREEN, 거절 code M1과 runner I2는 별도 반례로 보완한다. 최종 검증·독립 리뷰·exact commit은 WORK_STATUS 및 PMO 전달 원출력으로 결박한다.
- 실제 run, schema COMMIT, 인증 API→실제 PG→Web 소비, 실제 timeout/회수·served DOM·정식 서비스는 아직 미검증이다.
