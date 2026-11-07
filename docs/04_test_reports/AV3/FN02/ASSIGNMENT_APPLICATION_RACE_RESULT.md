# FN02 유효 임무·방법론 적용 material 경합 결과

2026-10-20 / Main 어울 / Stage B FN02/FN09 소비 / 한정 격리 PASS. 정식 DB·서비스 기능 반영이나 전체 FN02 완료가 아니다.

## 후보·검수

- 실제 실행 SHA `15e436ad49ab64b6e73d4c3253dae96033739652`, 기존 private `codex/av3-stage-b` exact. remote main `f976ed5e29e14b13e12729d5b1ccf98f050f2210` 불변·제외6 보존.
- 시험 `214928F00608C6B284BD45660018F4A4B9D6E8FF8F32AC01E59BC7FBFC5B748E`, runner `C142E77B06E80C03F5F6EDC14B15EB52D07BC0DC60094B0B4DB5A1CF5965D399`.
- SQL `E9DEE26A03DDD643F06DDC9DFBFE39DCCFB91FC305FCC465E53A5D15FD2880C6`, 53 manifest `92C6489DEBEF44DC978AAA5654F161349D8349303D7D48B60B7FD6BBC80ED7AE`, 범위 문서 `docs/work_packages/FN02_ASSIGNMENT_APPLICATION_RACE_QA.md` / `0BF75E039672DB2601D50ED6697D868796AC1E558EA05C47B2055C82E4ED4BAA`.
- source 첫 type union 오류1은 시험 반환형만 정정해 type0. Windows 시험 `FN02_EXACT_ASSIGNMENT_RACE_QA_REQUIRED`, runner `FN02_QA_PATH_INVALID`의 exit1은 기대 환경 차단/자원0이지 제품 RED/GREEN이 아니다.
- 독립 C0/I0/M1(경합 거절 상태 assertion 누락)을 수용해 정확412/409도 검사했다. 이전 지적과 작성 지문84AB/9E389·checkpoint0b0ce73e를 이력으로 보존한다. PMO의 잠금 주장 보완에 따라 실제 대기 SQL을 원문 출력 없이 검사하고 개별 trigger 효과 주장은 하지 않는다.

## 실제 실행

등록 WSL 새 빈 Git의 exact SHA/clean·다섯 지문을 확인했다. Node24.21.0/npm11.19.0, `npm ci --ignore-scripts --no-audit --no-fund --cache /tmp/anvil-v3-fn02-empty-application-01/npm-cache`: exit0/102packages. npm 새 버전 알림은 업그레이드하지 않았다.

등록 SHA/SQL hash/20분 만료를 설정한 `node --experimental-strip-types scripts/qa-fn02-empty-application.ts --history`: **exit0, DONE**, failure/cleanupFailure/diagnostic null, 실제53 SQL ID/hash 동일·초기 guard 정의 보존.

- 공식8양식/3방법론·합성1사용자 실제 로그인·SYSTEM 초기 프로젝트2건 생성 후, 기존 API로 전용 방법론 검토/확정과 설계·계획 원문 업로드/검토/확정·설계 인덱스·업무계획 검토/별도 확정을 저장했다.
- `COMMITTED_VALID_ASSIGNMENT_BLOCKS_APPLICATION_NO_APPEND`: 기존 service/guard의 유효 임무 초안 identity/version·receipt/audit를 선행 COMMIT했다. 대기하던 적용은412/EXECUTION_STATE_UNVERIFIED로 거절되고 적용 성공 명령/새 적용 행0·기존 snapshot 불변. 이후 API도 같은412.
- `COMMITTED_APPLICATION_REJECTS_STALE_ASSIGNMENT_NO_ORPHAN`: 다른 프로젝트의 명시 적용을 선행 COMMIT했다. 대기하던 옛 적용 ref 임무는409/METHODOLOGY_APPLICATION_CHANGED로 거절되고 임무/성공 명령0·과거 적용 snapshot 불변.
- `EXPLICIT_FRESH_APPLICATION_REFERENCE_ASSIGNMENT_SAVES`: 최신 적용 ref로 명시적으로 준비한 새 command만 API200·불변 ref 재조회. 초안 `executionAuthorized=false` 유지.
- 두 경합 모두 실제 `pg_blocking_pids`와 같은 app-role `pg_stat_activity.query` 대조로 controller의 `projects/member ... FOR UPDATE OF p,m` 대기 SQL임을 확인했다. 결과 `blockingSite=CURRENT_PROJECT_CONTROLLER_PROJECT_MEMBER_QUERY`, `individualFn02TriggerProven=false`.
- 최종 임무 초안/불변 버전 각2개, 실행준비/session/execution/grant/writer/실행명령/outbox0. 실제 Agent0·정식DB 변경0.

## 운송 한계

실제 로그인·CSRF로 얻은 주체의 독립 app-role material transaction에서 기존 currentProjectController→authorizeMaterial→projectReplay→실제 service/guard를 사용했다. 같은 HTTP 세션의 인증 user/session/client 잠금에 가려진 대기를 project 잠금으로 오인하지 않기 위한 한정 시험이다. 동시 HTTP 인증·세션 회수 경합, p/m/control 개별 tuple 또는 fn02 trigger 하나의 독립 효과를 증명하지 않는다.

유효한 **초안 저장**의 증거이며 임무 내용 확정·실제 grant/Agent 실행·완료된 실행 이력·모든7원장의 의미 있는 INSERT·전체 deadlock/다른isolation·정식DB/served/사용자 인수가 아니다. 합성 ACCEPTED를 사용자 판단으로 승격하지 않는다.

## 자원·오류·복구

- 생성 직전 QA Git/tmp/PG/network 부재·UID1000/부모 realpath/nonlink/owner·daemon/image·정식PG/Windows3830/5546 사전 조건을 재확인했다.
- PG `fb495ec71e5f9aa83f04c44c54d9554864d95afe87ce94ef8a456567d4567b05`, network `079decb56b2e1c9ec85d19b8cea90b8ce981f907a8d020f3b6cab64eb625c12a`, instance `78cfd4a8213e6a851dd9b1a7274b1a2d`.
- owner AV3_FN02_EMPTY_APPLICATION_QA, 고정 PG15 image ID sha256:594290e91b09c09728ed945ff89db65cd0fafff251f7c03c3d99c00ae5d9442f/internal/tmpfs256MiB/publish0. runner finally exact 회수.
- 등록 Git `/home/daon/deploy/anvil-v3-fn02-empty-application-qa-01`, tmp `/tmp/anvil-v3-fn02-empty-application-01`의 cache·합성 assignment-artifacts 원문 포함 전체를 exact SHA/clean·소유/link/process0/hash/inode/dev 대조 후 개별 회수했다. 7380files/1065dirs/13links/360100289bytes, 목록 지문 `f430c0a6e724e3188e09e5414223e5ab45f054a83d9494c5d47a0d40eeacbe74`.
- 별도 SSH exit0로 등록2경로/PG/network 잔여0 확인. 정식PG e6f798c3a2a3bdb2be533dd4c024d76f34d19fcfbbe4bf2acbe0437fb0cf32ba의 exited/Runningfalse/Pid0/Exit0/OOMfalse·Started2026-10-18T15:25:12.085069883Z/Finished2026-10-19T12:56:52.490883698Z·image/127.0.0.1:5546 정의 불변. Windows3830/5546 listener0.
- 이번 실제 PG 실패0. 초기 source type 오류와 환경 guard의 기대 거절·조사 glob 읽기 오류는 분리한다. 제품 source·기존 SQL·정식 runner·정식 계정/Secret·서비스·실제 Agent/운영은 변경0.
- 복구 원본은 private exact commit에 보존했다. 등록 일회성 QA만 회수했으며 다운 migration/기존 이력 삭제를 하지 않는다.

다음 실제 사용 연결에는 아직 미등록인0031 forward의 정식 채택/runner 등록·정식 개발 DB 반영과 서비스 재개 범위를 정확히 구분해야 한다. 이번 격리 PASS가 그 실행 허가나 이미 반영된 상태를 의미하지 않는다. 영향받지 않는 승인 계획 작업은 계속한다.
