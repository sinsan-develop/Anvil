# F-18 R45C rollback rehearsal 보완 보고서

## 판정

`IN_PROGRESS` — 기존 R45C의 code/container rollback 503 원인을 old 비-OIDC 실행환경과 restore DB의 결합 누락으로 분리해 재검증한다.

## 범위

이 보고서는 F-18 승인 범위의 WSL-server 격리 QA만 다룬다. Production·ysna-server·shared DB·사용자 운영 인수는 실행하지 않는다.

## 실행 결과

- 아직 실행 전: old 비-OIDC API/Worker readiness, restore DB 결합, negative gate, cleanup.
- 기존 R45C 데이터 restore PASS와 OIDC target 결과는 재사용하지 않고 별도 evidence로 유지한다.

## 실행 결과 / 2026-09-27

- WSL-server old exact checkout `4eadfcd441b55445237545146ae5ba4051739904`와 기존 R21 image tag를 사용했다. 전용 Compose project `anvil-f18-r45c-rework-old`의 PG18 container `5f90d56f0554`, API `00a7a07a75d2`, Worker `22402ef7627d`, rollback API `a5dba145c117`, networks `7fc725ba10b0`/`54b51112f460`를 사용했다.
- old runtime은 `WSL_ACCEPTANCE`, migration `0016_operations_recovery`로 기동했고 API `/health/ready`는 HTTP `200`, Worker 로그는 `migration_head=0016_operations_recovery,status=ready`였다.
- old DB custom backup `190559` bytes를 별도 `anvil_f18_r45c_restore` DB/`anvil_restore` role에 복원하고 head0016을 확인했다. restore role에 복원 객체 권한을 부여한 뒤 old image rollback API의 `/health/ready`가 HTTP `200`/`0016_operations_recovery`로 통과했다. 이는 old 비-OIDC 실행환경과 restore DB를 함께 결박한 code/container rollback PASS다.
- 초기 시도 오류는 (1) old image entrypoint/Compose command 중복, (2) 합성 identity 형식 오류, (3) restore role의 복원 객체 권한 누락이었다. 각각 override·`chat:qa-user`·restore role grant로 보정했으며 제품 파일은 변경하지 않았다.
- 기존 공유 `anvil-web=f0107aada3b26ea84950d5561fdd1d13759090096601854720acae5448684738` 및 `local-postgres=99f3bf939d40c265f44bc330fb143675ecad96c9ab27bd517500ef04eaa2506c`는 running 불변이다.

## 종료·잔여

- 전용 old/rollback container·PG18·network·restore DB/role·backup·checkout/material·8446/8447 port를 exact 대상만 제거했고 `R45C_REWORK_CLEANUP_RESIDUE_ZERO_SHARED_UNCHANGED`를 확인했다. 합성 credential·backup은 삭제되어 복구되지 않는다.
- R45C에서 이미 같은 공개 manifest/image에 대해 wrong image, wrong source commit, signature mismatch 거부가 PASS였고, 이번 보완은 그 artifact를 변경하지 않았다. dirty checkout 차단은 control/G-05의 clean projection으로 확인했다.
- code/container rollback과 data restore는 PASS이나, 브라우저 사용자 로그인·전체 suite·Production은 미검증/미실행이다. F-18 전체 `accepted` 판정은 독립 review 전까지 `false`로 유지한다.
