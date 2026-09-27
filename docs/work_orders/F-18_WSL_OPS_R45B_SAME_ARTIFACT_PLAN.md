# F-18 R45B 동일 artifact Test/Staging 재결박→격리 target 계획

## 판정 경계

- R45A source tag `f18-wsl-r45a-qa`는 commit `d36de847842804ca93e405abe9bff687c1162a69`에 고정돼 있다. R45A는 PG15/PG18 RC·OIDC·합성 서명 preflight를 실측하고 전용 자원을 잔여0으로 정리했다. 당시 합성 ReleaseManifest·공개키 원본도 material과 함께 제거되어 해시만 남았으므로 그것을 R45B의 동일 envelope 증거로 재사용하지 않는다.
- 승인된 F-18의 내부 QA 보완으로 Test/Staging에서 새 QA-only signed ReleaseManifest를 재결박하고 공개 manifest·공개키·관측/증거 원본을 Git에 보존한 뒤, 동일한 commit·Web/API/Worker image ID·동일 envelope hash를 격리 target에 전달한다. QA 키는 Production trust/신산님 실제 DeployApproval이 아니다. 이 계획만으로 F-18 accepted 또는 F-19 착수를 선언하지 않는다.
- source 제품 변경0, 새 branch0. 로컬에서 계획·공개 증거·Git push를 하고 `ssh WSL-server`에서 지정 SSH Git remote의 exact commit/tag만 fetch한다. `ysna-server`·Production·공유 `anvil-web`/`local-postgres`·다른 프로젝트 자원은 대상이 아니다.

## 생성 전 자원·수명

- WSL 전용 clean detached source checkout `/home/daon/anvil-f18-r45b-staging`와 `/home/daon/anvil-f18-r45b-target`, 공개 증거 Git checkout `/home/daon/anvil-f18-r45b-evidence`, Git 밖 합성 material `/home/daon/anvil-f18-r45b-material`. 모두 OS owner `daon`, root symlink 불가. 기존 `/srv/anvil-wsl/f18-ops-rehearsal`은 root-owned 보호 경로라 건드리지 않는다. Git remote/tag/HEAD/clean/owner를 매 실행 전 확인하고 Windows source 복사·server 직접 patch 금지.
- 전용 Compose project `anvil-f18-r45b-staging`와 `anvil-f18-r45b-target`은 순차 실행한다. 고정 QA OIDC HTTPS 8444는 WSL loopback 하나만 사용한다. 각 환경은 별도 pgvector-PG18 DB/role/tmpfs, 내부 network, MinIO, issuer와 합성 entity/credential을 갖고 host publish는 Web loopback8444 하나뿐이다. image 4종은 source tag Git archive에서 한 번만 빌드하여 세 제품 image ID를 R45A 기록과 비교한다. 다르면 구 manifest와 R45A 동등성 재사용을 차단하고 새 baseline 절차를 기록한다. 두 환경 사이 image ID는 재빌드 없이 동일하게 유지한다.
- R45B 공개 증거는 `docs/evidence/f18_r45b/`의 `qa-release-manifest.json`, `qa-public-key.pem`, `qa-observations.json`, `qa-sbom.json`, `qa-config-revision.json`, `qa-evidence.json`, `qa-verification.json`, `qa-migration-plan.json`, `qa-rollback-plan.json` 원본에 보존한다. 현재 값은 모두 `PENDING_REATTESTATION` placeholder이며 검증 증거가 아니다. 임시 private QA key·credential은 Git·로그·보고서에 기록하지 않는다. 공개 fingerprint는 생성 후 보고서에 독립적으로 고정하고 F-16/F-18 preflight에 입력한다. 공개 증거를 Git에 게시하기 전 target 실행 금지.
- 생성 직전 위 네 경로와 두 project label/network/volume/image tag·8444 listener의 부재, 공유 서비스 ID/status를 확인한다. 사용 후 정확한 ID/label/owner/연결자와 backup 증거 보존을 확인한 뒤 project down→전용 image tag→경로/material 순으로 제거해 잔여0을 확인한다. cached pgvector/MinIO image, 공유 서비스·자료는 보존한다.

## 필수 순서·증거

1. Test/Staging 재결박: exact tag source의 Web/API/Worker 동일 image ID·revision/nonroot 확인, PG18 18.4/vector/migration0019/비관리자·핵심 HTTPS OIDC/API/Worker/object-store 실측. R45A의 PG15 일반 증거와 분리한다. 서명된 새 QA manifest와 실제 관측 JSON의 F-16 preflight를 통과시키고 공개 원본을 Git push한 뒤 WSL Git으로 다시 검증한다.
2. 격리 target: Test/Staging을 종료해 8444를 비운 후 동일 세 image ID와 같은 manifest envelope, 같은 source/tag를 `validate_existing_checkout`에서 확인한다. 다른 digest/commit/tag/dirty/environment/approval hash와 capability provenance 누락은 부작용 전에 거부한다. target의 PG18·OIDC issuer/nonce/CA negative·MinIO hash/immutable/collision/권한 거부·internal network/egress/host bind·same-origin 브라우저 요청을 각 독립 실측으로 기록한다. Chrome은 필요 시 기존 승인대로 임시 격리 프로필·터널만 사용하고 별도 사전 자원 기록 후 전량 정리한다.
3. target 전용 PG18에 합성 데이터를 저장하고 backup→별도 임시 복구 DB/role에서 restore/동일성 확인을 수행한다. code/container rollback은 이전 승인 artifact와 정확한 image ID를 확보한 경우에만 별도 격리 인스턴스에서 수행하고 migration downgrade는 실행하지 않는다. 이전 artifact 또는 복구 증거가 없으면 이 항목은 미검증으로 남겨 F-18 인수를 보류한다.
4. Test/Staging과 target의 target-bound EvidenceManifest를 Git commit·세 image ID·manifest envelope hash·DB/head·OIDC/object/network/브라우저/복구 결과별로 비교한다. 실제 PASS만 승격하고 부분 실패는 원인·정리·정확한 다음 조치를 기록한다.

## 현재 미검증

R45B runtime/backup/rollback/browser/negative 검증은 미시작이다. application-only QA SBOM은 OS/image 전 구성요소의 공급망 인수가 아니고 QA public fingerprint는 Production trust가 아니다. 전체 pytest의 기존 non-green도 남아 있다. F-18 accepted=false, F-19 blocked, Production NOT_EXECUTED를 유지한다.
