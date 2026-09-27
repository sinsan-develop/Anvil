# F-18 R45C 격리 rollback rehearsal 준비 계획

## 결정과 상한

- R45B 감사 결과에 따라 R21 `4eadfcd...`는 보존된 QA-only 이전 버전으로만 쓴다. 승인 릴리스·인간 DeployApproval·Production rollback으로 표시하지 않는다. 현재 R45B signed manifest가 결박한 세 image ID는 제거됐으므로 R45B image를 동일 ID라고 재생성하지 않는다.
- 목표는 승인 F-18 범위 안에서 가역 code/container rollback과 합성 PG18 backup/restore의 실제 동작을 분리 검증하는 것이다. 임시 QA 외 persistent DB, migration downgrade, 실제 Secret, 공유 `local-postgres`/`anvil-web`, `ysna-server`는 대상이 아니다.
- R21 대비 현행 코드의 OIDC/head0019 차이는 기능 회귀로 명시한다. R21 전환 뒤 OIDC 기능이 지속된다고 주장하지 않는다. 이전 승인 artifact 부재 자체는 이 시험으로 해소되지 않으므로 F-18 accepted=false/F-19 blocked를 유지하고 인수 기준을 낮추지 않는다.

## 실행 전 통제

1. 이 계획과 감사 보고서를 같은 `codex/f18-wsl-ops` branch에 안전한 commit으로 게시한다. canonical Main worker-only lease/G-05를 별도 event로 발급하기 전에는 WSL 자원을 만들지 않는다. 공개 원본의 내용·hash가 바뀌면 manifest를 재결박한다.
2. 전용 경로 이름은 `/home/daon/anvil-f18-r45c-old`(R21 exact tag source), `/home/daon/anvil-f18-r45c-new`(현행 exact Git source), `/home/daon/anvil-f18-r45c-material`(합성 인증·backup), 전용 Compose project 이름은 `anvil-f18-r45c-old`와 `anvil-f18-r45c-new`로 제한한다. OS owner `daon`, Git checkout clean/detached, source는 지정 SSH Git alias에서 수신한다. 기존 보존 R21 checkout/image 자체를 수정하거나 삭제하지 않는다.
3. 생성 전 위 세 경로·두 project container/network/volume·전용 image tag·loopback 8444 점유 부재와 공유 Web/PG ID를 다시 확인해 `WORK_STATUS`에 남긴다. 불일치하면 side effect 전에 중단한다. 전용 이미지 tag는 `anvil-f18-r45c-{old,new}-{web,api,worker}:<exact-source-short>`로 별도 생성하고 image ID를 서명 공개 원본에 결박한다. 기존 image ID를 tag alias로 사용할 때도 R21 기존 tag/ID는 건드리지 않는다.
4. 합성 QA 키·credential은 Git 밖 material 안에서만 만들고 원문 출력·commit을 금지한다. 공개 서명 manifest와 관측/evidence 원본은 Git에 게시해 WSL Git 재수신으로 검증한다. 개인키는 시험 종료 시 제거한다. 전용 PG18/MinIO tmpfs, 별도 DB/role과 Web-only loopback ingress를 사용한다. 컨테이너/DB/role/port/backup의 정확한 이름·수명은 생성 직전 `WORK_STATUS`에 추가 고정한다.

## 순차 검증

1. QA-old source/tag/image ID/서명·clean checkout을 검사하고, 격리 `0016_operations_recovery` DB에 합성 데이터로 Web/API/Worker readiness와 backup/복원 기준점을 만든다. old 환경을 종료하되 이미지·서명 원본·backup은 rollback까지 보존한다.
2. 새 Git artifact를 별도 전용 checkout에서 빌드해 세 ID를 결박·서명하고, 별도 격리 target의 합성 DB에 `0019_oidc_sessions` migration과 현재 OIDC/object/network readiness를 확인한다. 이전 DB를 무단 제자리 migration하지 않는다.
3. 새 환경 중단→old 세 이미지 ID를 **재빌드 없이** 재기동해 code/container rollback을 관측한다. DB가 head0019인 상태에서 old app이 동작한다고 추정하지 않는다. 사전 backup을 새 별도 격리 DB/role에 복원한 뒤 head0016·합성 데이터 건수와 old app readiness를 확인한다. 이 복원은 별도 QA DB의 데이터 복사이지 현행 데이터의 in-place downgrade가 아니다. code rollback과 DB restore 각각의 결과를 따로 기록한다.
4. wrong commit/image/envelope/head 및 dirty checkout을 mutation 전 거부하는 negative gate를 실행한다. 성공·실패 모두 exact label/ID/owner/realpath/연결자를 검사한 뒤 두 project·전용 image tag·세 경로/material/backup·포트를 정리하고 잔여0 및 공유 Web/PG ID 불변을 확인한다.

## 완료 판정 경계

- 이 계획의 PASS는 `QA_ONLY_REVERSIBLE_REHEARSAL`; 승인 릴리스에 대한 실제 rollback, R45B 이미지 ID 복구, 브라우저 UI 로그인, 전체 suite, 공급망 완전성을 증명하지 않는다. 위 단계 중 실행하지 못한 것은 `NOT_EXECUTED`로 남긴다.
- canonical F-18 gate 및 F-19 착수는 별도 확인한다. 이 계획과 F-18 상위 기준이 충돌하면 상위 기준을 유지하고 기능 범위·요구사항·중요 위험 변경을 임의로 확정하지 않는다.
