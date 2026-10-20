# FN02 유효 임무 초안·명시 적용 경합 — 한정 검수

2026-10-20 / Main 어울 / 승인 Stage B FN02 저장 보호의 직접 영향 검수. 현재 source 준비·실제 실행0이며 앞선 함수/workflow/UI/초기 생성·불완전 INSERT 시험은 반복하지 않는다.

## 결함을 잡는 기준

material 경로의 직렬화나 이력 거절이 상실되면 다음 두 실제 COMMIT 결과와 차단 관찰이 실패해야 한다. 단순히 실행 순서에 지연을 넣고 결과만 맞추지 않는다. 개별 fn02 trigger의 독립적인 잠금 효과나 p/m/control 중 정확한 tuple을 증명하지 않는다.

1. 실제 공식8양식/3방법론 seed·합성1사용자 로그인으로 SYSTEM 확정참조의 프로젝트2개를 생성한다. 각 프로젝트의 현재 소유자/client/control 아래 별도 명시 정책으로 새 전용 방법론의 검토·확정, 원본 파일 업로드·설계/계획 문서 검토/확정·설계 인덱스·업무 계획 검토/별도 확정을 실제 기존 API/DB에 저장한다.
2. 확정 계획/단계/현재 적용 ref를 가진 `prepareAssignment`를 기존 Web helper가 작성하고 기존 `ProjectAssignmentDrafts.save`가 검사·저장한다. 직접 불완전 INSERT나 guard 우회 seed를 유효 임무로 취급하지 않는다. 초안의 `ready/executionAuthorized/dispatchPerformed=false`는 유지하며 실제 실행 임무·grant는 만들지 않는다.
3. assignment-first: 실제 app-role transaction에 임무 identity/version·receipt/audit가 저장된 상태로 COMMIT 전 유지한다. 별도 app-role의 명시 적용이 선행 backend를 기다리는 것을 `pg_blocking_pids`와 같은 app-role의 `pg_stat_activity.query`로 대조해 대기 SQL이 currentProjectController의 projects/member SELECT FOR UPDATE OF p,m임을 확인한다. SQL 원문은 출력하지 않는다. 선행 COMMIT 후 적용412/EXECUTION_STATE_UNVERIFIED 및 적용 행/성공 명령0·기존 snapshot 불변을 확인한다. 후속 실제 API도412여야 한다.
4. application-first: 다른 프로젝트의 실제 적용 행/receipt/audit를 COMMIT 전 유지한다. 별도 임무 저장의 project 잠금을 직접 관찰하고 선행 COMMIT 후 METHODOLOGY_APPLICATION_CHANGED409·임무/성공 명령0·과거 적용본 불변을 확인한다.
5. 사용자가 명시적으로 최신 적용 ref로 다시 준비한 새 임무 명령은 실제 API200/정확 재조회여야 한다. 자동 업무 재개/구명령 내용 변경·자동 성공은 없다. 최종 임무 초안/불변 버전 각각2개·실행준비/session/execution/grant/writer/실행명령/outbox0.

## 인증과 운송의 정확한 한계

동일 HTTP 세션의 인증 트랜잭션은 user/session/client 행을 먼저 잠근다. 그 대기를 project 잠금의 증거로 오인하지 않기 위해 경합2건은 실제 로그인·CSRF로 `AccessRepository.authenticated`에서 얻은 주체를 독립 app-role material transaction에 전달한다. 각 transaction은 기존 currentProjectController→authorizeMaterial→projectReplay→실제 service와 DB guard를 그대로 사용한다. 실제 HTTP 인증 트랜잭션 두 개를 동시에 통과한 증거가 아니며 동시HTTP/세션 회수 경합 PASS로 표현하지 않는다.

기존 plan/design/초안의 기계 검수를 위한 합성 ACCEPTED는 사용자 인수가 아니다. 임무 내용 확정·Agent/grant·완료된 실행 이력·모든7원장 의미 있는 INSERT·전체deadlock/다른isolation·다른프로젝트 전체기능/정식DB·served/전체FN02의 증거로 승격하지 않는다.

## 실행 후보·자원

- `scripts/qa-fn02-empty-application.ts --history`는 신규 `tests/integration/FN02/application-assignment-race-isolated.test.ts`만 선택한다. SQL E9DEE26A03DDD643F06DDC9DFBFE39DCCFB91FC305FCC465E53A5D15FD2880C6/동일53 ID·checksum·초기 guard 함수 정의 보존. 기존 formal runner 등록0.
- source 초기 지문84AB2EA3는 작성 이력이다. rollback 양쪽 독립 회수와 대기 SQL 관찰/주장 범위 보완 후 시험9E389A95E69050EE0B7D6CD027C9A91F8F3E0F4669A0D67BCFEBFA42E65324F2, runnerC142E77B06E80C03F5F6EDC14B15EB52D07BC0DC60094B0B4DB5A1CF5965D399. 검수 보완 시 새 지문·정확 게시 SHA를 WORK_STATUS/commentary에 고정한 뒤 실행한다.
- WSL-server/daon UID1000/Main 어울, owner AV3_FN02_EMPTY_APPLICATION_QA+새 instance, daemon e3349f1d-dbfc-478a-96d9-295bf6c6839e(SINSAN).
- 새 빈 Git `/home/daon/deploy/anvil-v3-fn02-empty-application-qa-01`, tmp0700 `/tmp/anvil-v3-fn02-empty-application-01`/전용 npm-cache. **추가 저장 경로**는 그 tmp 하위 새0700 `assignment-artifacts`이며 합성 설계·계획 원문만 보관한다. 기존·외부 원본/Secret을 수집하지 않는다. child 전에는 npm-cache만 허용하는 기존 runner guard를 유지한다.
- PG `anvil-v3-fn02-empty-application-pg-01`, internal network `anvil-v3-fn02-empty-application-net-01`, DB `anvil_v3_fn02_empty_application_qa_01`.
- image postgres@sha256:6eb0add3b77c081df18aa518ce43df58fdcc40f2e6d868a6fd08038dc7acd425 / ID sha256:594290e91b09c09728ed945ff89db65cd0fafff251f7c03c3d99c00ae5d9442f / tmpfs256MiB/추가mount·volume0/publish0.
- 생성 직전 exact parent 실경로/nonlink/owner·새경로/PG/network 부재·process와 정식PG fullID e6f798c3a2a3bdb2be533dd4c024d76f34d19fcfbbe4bf2acbe0437fb0cf32ba state/Started/Finished/image/5546 정의·Windows3830/5546 listener를 대조한다.
- 수명20분/client10분/test90초/회수 별도2분. 성공/실패 모두 runner finally exactID/owner/instance/image/mount/port 검증 회수, Git/tmp/artifact/cache는 owner/link/process/전체 파일hash·inode/dev 확인 후 개별 파일/빈 dir 회수·별도 잔여0와 정식PG/포트 불변을 확인한다. 비밀 원문/DSN/raw child 오류 출력0.

정식DB/SQL runner·서비스/실제 사용자 정책·Secret/cert·OS helper/PATH_GUARD·Agent/비용/미채택 계약/Oracle/운영은 변경하지 않는다. 현재 문서는 범위고정이며 미실행을 PASS로 선취하지 않는다.
