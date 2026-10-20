# FN02 미적용 저장 후보 — 첫 격리 실행 범위

상태: 준비/미실행. Main 어울, 2026-10-20. 기존 Stage B/FN02이며 실제 기능 완료가 아니다.

## 후보·실행 목적

- source 기준 fb2ce94a 이후 현재 후보. 최종 게시 commit을 실행 직전 exact 고정한다.
- SQL: `db/migrations/0031_empty_project_methodology_application.sql.pending`, SHA256 `F70F838E11293C5BA71255F762DCA7C42BB81DD00D9ED5D65CEE66C2BB399B89`.
- 51개 기존 C1 QA migration + `0017_execution_authority.sql` + 해당 미적용 후보, 총53개를 **새 빈 DB에만** 적용한다. 정식 runner/기존 DB의 migration 등록은 하지 않는다.
- 첫 실행은 SQL 컴파일/새 함수 호출·원 초기 생성 함수 정의 전후 동일, app 비관리자·exact53 manifest, PG/JS 공식 graph/form 및 경계 수치/세션별 출력·구조/검토 변조 음성만 확인한다.
- 이 시험은 양성 적용 workflow/직접 DML 위조·양방향 COMMIT·실경합/다른 프로젝트·초기 createProject 실행 회귀를 아직 검증하지 않는다. 후속 검수는 이 범위를 명시해 이어가며 현재 PASS로 선취하지 않는다.

## literal 전용 자원 계약

| 대상 | 고정 값 |
|---|---|
| 환경·소유 | WSL-server / daon UID1000 / Main 어울 / owner label `AV3_FN02_EMPTY_APPLICATION_QA` |
| Git 경로 | `/home/daon/deploy/anvil-v3-fn02-empty-application-qa-01` 새 빈 디렉터리, 기존 private branch exact SHA |
| 임시 산출 경로 | `/tmp/anvil-v3-fn02-empty-application-01`, 필요한 경우에만 신규0700, 원문/Secret 로그 금지 |
| PG 이름 | `anvil-v3-fn02-empty-application-pg-01` |
| 내부 network | `anvil-v3-fn02-empty-application-net-01`, internal=true·다른 서비스 연결0 |
| DB | `anvil_v3_fn02_empty_application_qa_01`, 신규 역할 bootstrap/migrator/app는 이 일회성 PG 안에만 생성 |
| PG image | `postgres@sha256:6eb0add3b77c081df18aa518ce43df58fdcc40f2e6d868a6fd08038dc7acd425` |
| 실 image ID | `sha256:594290e91b09c09728ed945ff89db65cd0fafff251f7c03c3d99c00ae5d9442f` |
| daemon | `e3349f1d-dbfc-478a-96d9-295bf6c6839e`, 실제 Name/ID/이미지 일치 검사 |
| 디스크·port | PG data tmpfs 268435456 bytes·추가 mount/volume0, host publish/port binding0·기존5546/3830 변경0 |
| 수명 | 실행20분 이내·client 시험10분 이내, 종료/실패 즉시 정확 회수·회수 단계 자체 최대2분 |
| 보호 | 기존 정식 PG fullID `e6f798c3a2a3bdb2be533dd4c024d76f34d19fcfbbe4bf2acbe0437fb0cf32ba`의 상태/StartedAt/image/정의 변경0 |

생성 전 이름/경로 부재·부모 realpath/nonlink/owner·socket/daemon·이미지·기존 서비스 영향을 재확인한다. 기존 자원이 있으면 재사용/삭제하지 않는다. 인증/접속값은 일회성 메모리에서만 전달하고 Git/대화/로그에 남기지 않는다. 새 Git checkout의 의존성 준비는 lockfile의 npm ci만 사용하며 다른 서비스/공유 설정은 변경하지 않는다.

정리는 instance/run/owner label과 생성 때 받은 exact container/network ID·image/mount/port를 대조한 대상에만 수행한다. network는 연결0 확인 후 제거한다. 두 경로는 UID/비링크/범위·파일 목록/hash와 열린 process0을 확인한 등록 전용 자료만 비재귀 회수하고 별도 읽기로 잔여0을 확인한다. cleanup 실패는 원 시험 실패와 함께 보존·즉시 PMO 보고하며 정식 자원을 만지지 않는다.

## 미포함

정식 DB/서비스 재기동·배포·실계정/사용자정책·Secret/certificate/credential/OS helper·Agent 호출/비용·r2/Caps/FN15 채택·0029/기존 특정 거절 해제는 포함하지 않는다. SQL 파일 작성/정적 판정은 이 실행의 성공 또는 실행 허가를 대신하지 않는다.
