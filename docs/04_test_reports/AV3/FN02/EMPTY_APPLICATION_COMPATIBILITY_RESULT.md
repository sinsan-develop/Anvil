# FN02 초기 생성·직접 INSERT 선행 잠금 결과

2026-10-20 / Main 어울 / Stage B FN02 / 한정 격리 QA PASS. 전체 FN02 완료·정식 DB 적용·사용자 인수가 아니다.

## 후보와 범위

- 실행 commit: `8d958a68d3e0dee442b540a1eecbe6598284b80a`, 기존 `codex/av3-stage-b` local/private exact. 원격 main `f976ed5e29e14b13e12729d5b1ccf98f050f2210` 불변, 제외6 보존.
- 시험 SHA256 `7B3C2AD9D5C4790BA41E4F8158619D18BE31ADAF3B2F34668614FAC00053705B`, 실행기 `76F307D07B9AB86D364E5764A5B4B77CE8606646ECFA747C4C83CC06895C6FDD`.
- SQL `E9DEE26A03DDD643F06DDC9DFBFE39DCCFB91FC305FCC465E53A5D15FD2880C6`, 53건 manifest 파일 `92C6489DEBEF44DC978AAA5654F161349D8349303D7D48B60B7FD6BBC80ED7AE`.
- 범위 문서 `docs/work_packages/FN02_EMPTY_APPLICATION_COMPATIBILITY_QA.md` / SHA256 `A8797234B01B7458A60324EC875FFB54FC1CDE7DA2AC536292EC4A30968773BF`.
- 독립 source 원 C0/I0/M1(보고 count 상수)은 실제 생성 ID 두 개와 전체 DB 프로젝트 ID 집합 일치·실측 count로 보완, 한정 재검토 C0/I0/M0. 원 지적은 지우지 않는다.

## 실제 명령·결과

WSL-server daon UID1000의 새 빈 등록 Git에서 private exact SHA checkout/clean과 네 지문을 확인했다. Node24.21.0, npm11.19.0. `npm ci --ignore-scripts --no-audit --no-fund --cache /tmp/anvil-v3-fn02-empty-application-01/npm-cache`: exit0, 102 packages. npm12 알림은 설치·업그레이드하지 않았다.

환경은 등록 QA SHA/SQL hash/20분 만료만 설정했다. `node --experimental-strip-types scripts/qa-fn02-empty-application.ts --compatibility`: **exit0, DONE**, failure/cleanupFailure/diagnostic 모두 null.

- 실제 53 SQL ID/checksum 일치, 초기 guard 함수 정의 전후 동일.
- `INITIAL_CREATE_REPLAY_SNAPSHOT_PRESERVED`: 공식 양식·기본 방법론 seed 후 합성 주체의 SYSTEM 확정 참조 초안으로 동일 생성 명령 두 번이 같은201 결과를 반환했다. 최초 적용의 owner/client/control·snapshot/graph/sourceRef·application_command_id NULL·재조회 확인.
- `SEVEN_DIRECT_INSERTS_WAIT_BEFORE_OLD_GUARDS`: 첫 project 행 잠금 중 별도 app connection의 7원장 불완전 INSERT 각각이 기존 guard/NOT NULL 거절 전에55P03로 대기 실패했다.
- `OTHER_PROJECT_INITIAL_CREATE_WHILE_FIRST_LOCKED`: 첫 project 잠금 중 다른 project 초기 생성201. 최종 DB 전체 ID 집합이 두 생성 응답 ID와 정확히 같고 실측 initialProjects2.
- `NON_READ_COMMITTED_EXPLICITLY_REJECTED`: RR/SERIALIZABLE의 새 fn02_lock_project40001 명시 거절.
- 첫 snapshot 불변, applyMethodology 명령0, 7원장/outbox0. 실제 Agent0, 정식 DB 변경0.

## 자원·정리

생성 전 등록 Git/tmp·PG/network 부재, 부모 실경로/nonlink/owner·UID1000·daemon/image·정식PG state/StartedAt/FinishedAt/image/5546 정의·Windows3830/5546 listener0 확인.

- PG full ID `b99a37dbeabc02cb22a46167cbab91a8d66e4a6e102acb040136e5a4f3ed0ff6`, network `9b3b0397e04ed6b20761ee27270377904871e63841580553eaf5ea4e523095cf`, instance `16a30c5c5e9e3782d43e03def99d9247`.
- 등록 owner `AV3_FN02_EMPTY_APPLICATION_QA`, PG15 image ID `sha256:594290e91b09c09728ed945ff89db65cd0fafff251f7c03c3d99c00ae5d9442f`, internal network/tmpfs256MiB/publish0. runner finally exact 회수.
- Git `/home/daon/deploy/anvil-v3-fn02-empty-application-qa-01`, cache `/tmp/anvil-v3-fn02-empty-application-01`는 exact SHA/clean·UID1000/실경로/nonlink·내부링크·process0/개별 파일hash 확인 후 파일별 unlink·빈 dir별 rmdir로 회수했다. 7373files/1058dirs/13links/360016521bytes, 목록 지문 `87e221c20fa43465c9bcd021a89a7c03cc02dae360e5fcc70cd7643273312db5`.
- 별도 SSH exit0: 등록2경로·PG/network 잔여0. 정식PG `e6f798c3a2a3bdb2be533dd4c024d76f34d19fcfbbe4bf2acbe0437fb0cf32ba`의 exited/Runningfalse/Pid0/Exit0/OOMfalse·Started `2026-10-18T15:25:12.085069883Z`/Finished `2026-10-19T12:56:52.490883698Z`·image/127.0.0.1:5546 정의 불변. Windows3830/5546 listener0.

## 미검증과 다음 핵심

불완전 INSERT 선행 대기는 유효한 임무/grant 저장과 apply의 양방향 경쟁·완료 이력 뒤 적용 거절·전체 deadlock·다른 project 전체 기능 무영향을 증명하지 않는다. NEW_PROJECT_DRAFT 초기 생성 전체·비기본 isolation 기존 정상 흐름 호환성·실제 HTTP/served UI·정식 DB/runner 등록·실제 Agent는 미검증이다.

다음은 기존 업무 이력의 적용 차단과 유효 업무 저장의 연결 경계를 기존 FN09 계약/fixture에서 대조해 실제 검수 단위를 구성한다. 초기 조사에서 추정한 FN02.md/fixture 경로 읽기 실패2 및 PowerShell rg glob 실패1은 자료·서비스 변경0이며 제품 실패가 아니다. 새 검사 기준 완화·앞선 함수/workflow/UI 반복은 하지 않는다.

복구: 제품/정식DB 변경0. 후보 소스는 위 private commit으로 보존하고 신규 QA만 회수했다. 정식 실행 재개/임의 migration 등록은 하지 않는다.
