# FN16 선택 원본 반출 — 새 격리 PG 자원 사전 등록

2026-10-27 / 소유 작업 `AV3_FN16_SELECTED_ARTIFACT_EXPORT_QA`, 담당 Main 어울. **준비 상태이며 아직 생성·실행하지 않았다.** 제품 소스92cef047 뒤 실행 helper를 검수·게시한 exact SHA를 실행 전에 추가로 고정한다. 과거 FN03 실행기·소진된 1회 승인·정식 development config는 사용하지 않는다.

| 자원 | 정확 대상과 범위 |
|---|---|
| 새 Git checkout | `/home/daon/deploy/anvil-v3-fn16-artifact-export-qa-01`, 승인 private Git의 기존 `codex/av3-stage-b` 게시 exact commit, detached/clean. 서버 patch·소스 복사 없음 |
| 새 보호 root | `/home/daon/.local/share/anvil-v3-fn16-artifact-export-qa-01`, daon uid1000/0700. `run.json`·`source-manifest.json`만 신규0600, 합성 ephemeral credential/metadata. 값은 출력하지 않음 |
| PG | `anvil-v3-fn16-artifact-export-qa-pg`, DB `anvil_fn16_qa_selected_artifact_01`, bootstrap `anvil_v3_bootstrap`, 새 일회 `anvil_v3_migrator`/`anvil_v3_app`. PG data tmpfs256MiB, host publish·volume 없음 |
| Node | `anvil-v3-fn16-artifact-export-qa-node`, uid/gid1000, `/qa-source`·`/qa-config` read-only, `/qa-data` tmpfs64MiB uid1000/mode0700, `/tmp` tmpfs16MiB. 원문·사본은 이 새 tmpfs에만 생성 |
| network | `anvil-v3-fn16-artifact-export-qa-net`, internal, 위 신규 PG/Node만 연결. HTTP/TLS listen·host port 없음 |
| 기존 의존성 | `/home/daon/deploy/anvil-v3/node_modules`를 링크 이탈 검사·lock 일치 후 read-only로만 공급. 기존 폴더 설치/수정 없음. source와 lock SHA256 `CA586E2DD02C11C41DA55A64AA4F07D3848936FE44DCA1897F8586AC4FB0F1D6` |
| PG image | digest `postgres@sha256:6eb0add3b77c081df18aa518ce43df58fdcc40f2e6d868a6fd08038dc7acd425`, ID `sha256:594290e91b09c09728ed945ff89db65cd0fafff251f7c03c3d99c00ae5d9442f` |
| Node image | digest `node@sha256:0e0ff40c39bc087845bfb27465a0df4ea419520094bc35842ff83dd8cbe6f9b6`, ID `sha256:e8c4de1e2519b4f34de27a595df6c2a32df28baa90db80bfaf2e038889d94390` |
| daemon | `e3349f1d-dbfc-478a-96d9-295bf6c6839e`、실행 전 다시 일치 확인 |
| 수명 | 첫 생성부터 최대30분, 자동 연장 없음. workflow120초, query/연결 유한 기한과 정리60초. 외부 timeout TERM/KILL 경계 포함 |

## 생성·실행·정리 원칙

생성 직전에 두 경로·컨테이너·network 부재와 부모 owner/realpath/nonlink·image ID를 다시 확인한다. 각 신규 자원에 owner/runId/instance label과 실제 ID를 결박하고 image·mount·tmpfs·network·port 설정이 등록과 다른 경우 PG/시험 진행 전에 중단한다. 기존 서비스·정식 DB·인증·Secret·CA·권한·다른 프로젝트에는 쓰지 않는다.

고정51 baseline·후보0043과 별도 manifest/hash를 대조한다. 새 일회 cluster에서만 역할·schema 및 app TEMPORARY를 준비한다. 공식 양식과 합성 계정/login·새 프로젝트/controller를 준비하고, 정책·원문·문서는 기존 표준 명령과 route로 생성한다. 반출도 실제 POST route로 호출한 뒤 다른 연결의 확정 job·사본 bytes·RLS/거절을 확인한다. `/qa-data`의 합성 원본 부재 시험 후 원본을 복원한다. 실제 TLS/browser 다운로드·사용자 인수·정식 WSL 통합·전체 백업/복원으로 승격하지 않는다.

성공·실패·중단 모두 새 ID/label/image/mount/network를 재검사한 컨테이너만 종료·삭제하고 새 internal network도 소속이 비었는지 확인해 회수한다. 새 config 파일은 identity/hash/owner·정확 허용 목록을 확인해 삭제한다. 새 Git checkout은 게시 ref로 복구 가능·tracked clean·소유/nonlink·관련 프로세스 부재를 확인해 제거한다. 불명 항목이나 identity 변경은 보존하고 미정리 사실을 기록한다. 이후 별도 읽기 조회로 정확 경로·등록 이름/label 잔여0을 확인한다.

현재 읽기 관측: exec8a0028/68b673에서 모든 새 대상 부재·부모 uid1000/775·700·실제 image ID를 확인했다. exec8be043에서 lock 일치와 daemon ID를 확인했다. 이 관측은 실제 생성·SQL/API PASS가 아니며 생성 시점의 재확인을 대신하지 않는다.
