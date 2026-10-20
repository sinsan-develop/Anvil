# FN02 초기 생성·직접 INSERT 선행 잠금 — 다음 한정 QA

2026-10-20 / Main 어울 / 승인 Stage B FN02 후속. source 준비·미실행이다.

앞선 canonical/graph 함수 PASS 및 e196a057 적용 workflow PASS, UI03 fixture PASS는 반복하지 않는다. 같은 미적용 SQL E9DEE26A03DDD643F06DDC9DFBFE39DCCFB91FC305FCC465E53A5D15FD2880C6의 남은 초기 생성 호환과 선행 잠금을 확인한다. 정식 runner/개발 DB/서비스 적용이 아니다.

## 정확 시험 범위

- `scripts/qa-fn02-empty-application.ts --compatibility`가 새 `tests/integration/FN02/empty-application-compatibility-isolated.test.ts`만 선택한다. 같은53 SQL/ID·hash·초기guard 정의 전후 동일을 새 빈 DB 구성에 필요한 범위에서 확인한다.
- 공식8양식·기본3방법론의 기존 seed를 일회성 migrator TX에만 넣고 합성 사용자1명/로그인client1개를 새 QA DB에 생성한다. 실제 사용자·정책·키는 변경하지 않는다.
- 기존 SYSTEM 확정참조로 초안 저장→동일 최초 생성 명령2개의201 동일 결과→owner/client/control·최초 적용 snapshot/graph/sourceRef·application_command_id NULL·재조회를 확인한다. NEW_PROJECT_DRAFT 초기 생성 전체는 이번 범위가 아니다.
- 한 transaction에서 첫 project 행을 잠근 채, 별도 app connection에서 7원장 각각에 `project_id`만 있는 의도적으로 불완전한 INSERT를 시도한다. 150ms lock_timeout의55P03가 **기존 guard/NOT NULL 거절 전에** 발생해야 한다. 성공한 업무/실행 자료는 생성하지 않는다.
- 첫 project만 잠긴 상태에서 다른 초안→다른 project의 실제 초기 생성을 확인한다. 같은 project 잠금의 격리를 보는 한정 양성이며 모든 다른 project 기능 무영향의 증거가 아니다.
- REPEATABLE READ/SERIALIZABLE에서 새 fn02_lock_project의40001 거절을 확인한다. 비기본 isolation의 기존 정상 기능 호환 PASS라고 표현하지 않는다.
- 최종 초기 project2건·기존 첫 snapshot 불변/apply 명령0·7원장/outbox0. 실제 Agent0.

**한계:** 불완전 INSERT의 선행 대기 시험은 유효한 임무/grant INSERT와 적용의 양방향 경쟁·완료 후 이력에 따른 적용 거절·전체 deadlock 안전을 증명하지 않는다. 기존 row-only/receipt-only/정책·구조 시험 및 실제 초기 생성의 모든 방법도 완료로 올리지 않는다.

## 전용 자원과 회수

이전 QA가 회수된 다음 아래 literal 부재·owner/realpath/nonlink/process와 daemon/image·정식 PG/port 불변을 생성 직전에 재확인한다. 최종 source commit·runner/test/SQL·53 manifest hash와 source 검토를 고정한 뒤 PMO에 위임 실행 범위를 대조한다. 아직 자원 생성0이다.

- WSL-server / daon UID1000 / Main 어울 / label AV3_FN02_EMPTY_APPLICATION_QA + 새 instance.
- 새 빈 Git `/home/daon/deploy/anvil-v3-fn02-empty-application-qa-01`, 승인 private branch exact SHA만.
- 새0700 `/tmp/anvil-v3-fn02-empty-application-01`, npm cache는 그 하위 `npm-cache`만 명시 사용. 공유 cache0.
- PG `anvil-v3-fn02-empty-application-pg-01`, internal network `anvil-v3-fn02-empty-application-net-01`, DB `anvil_v3_fn02_empty_application_qa_01`.
- image postgres@sha256:6eb0add3b77c081df18aa518ce43df58fdcc40f2e6d868a6fd08038dc7acd425 / ID sha256:594290e91b09c09728ed945ff89db65cd0fafff251f7c03c3d99c00ae5d9442f / daemon e3349f1d-dbfc-478a-96d9-295bf6c6839e(SINSAN).
- PG data tmpfs256MiB·추가 mount/volume0·host publish0·20분/client10분·회수 별도2분. 성공/실패 모두 exact ID/instance/image/mount/port와 경로 owner/link/process/hash를 대조한 등록 자료만 회수·독립 잔여0.
- 정식PG e6f798c3a2a3bdb2be533dd4c024d76f34d19fcfbbe4bf2acbe0437fb0cf32ba의 state/StartedAt/image/5546정의 및 Windows3830/5546은 전후 읽기로만 비교한다.

정식DB/runner·서비스/Secret/cert·OS helper·Agent/비용·Oracle/운영·기존 특정 거절/0029/미채택계약 변경은 없다. 기존 계획의 필수 검수이며 사용자 재승인·PMO 다음 업무배정 대기를 새 종료조건으로 만들지 않는다.
