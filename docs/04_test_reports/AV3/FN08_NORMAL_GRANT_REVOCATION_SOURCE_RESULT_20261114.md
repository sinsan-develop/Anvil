# FN08 normal 허가 회수 source 검수 결과

판정: 승인한 source 단위 수용. 전체 계획·실환경 인수는 미완료.

## 기준과 변경

2026-11-14 직접 채택 후보 SHA256 462D92B2429701077E9B9A8BDE26DCC68ACE8F31323A87ABF685FBC8A4EFC542. WI FN08_NORMAL_GRANT_REVOCATION_SOURCE_IMPLEMENTATION_20261114.md. 기준 main97a2a734, 구현 시작8e9a7006/기록ab628683, branch codex/av3-fn08-revocation-contract. 기존 Primary 단일writer, Main검수·통합. 정확 제품/시험7경로, 쓰기반환·live0.

기존 회수는 synthetic 전용이었다. 이제 명시 normalGrantRevocation 설정에서 현재 OWNER가 원 normal EXECUTION grant를 회수 기록으로 저장하고 원 영수증을 재조회한다. 원 발급자와 현재 회수자를 분리하고 ACTIVE/EXPIRED, 현재 정책/budget, 중복, 원자 저장을 검사한다. grant/credential/writer나 프로세스를 종료·수정하지 않는다. APPLIED는 기록 저장이며 검증플래그5개false 유지. 기존 synthetic 영수증/0022는 그대로다. normal영수증 세 표식은 채택값을 사용한다.

## 검증

- Primary 최초RED: 생산자부재4F, forward부재2F, HTTP미연결400. fixture잠금/GUC/transaction ID/import순서 오류는 실패로 보존하고 수정했다. 세션17750은 fixture대기로 중단exit1/live0.
- Main node --experimental-strip-types --test --test-reporter=dot tests/unit/FN08/normal-grant-revocation.test.ts: 6P exit0(08d5cb).
- Main node --experimental-strip-types --test --test-reporter=dot tests/unit/FN08/normal-grant-revocation-sql.test.ts: 2P exit0(7c5eec). 이후 as const 타입표기만 추가됐고 역치환 지문으로 실행문 불변 확인.
- Main node --experimental-strip-types --experimental-test-module-mocks --test --test-reporter=dot tests/unit/FN08/normal-grant-revocation-journey.test.ts tests/unit/FN08/execution-grant-revocation.test.ts tests/unit/FN08/execution-grant-revocation-store.test.ts tests/unit/FN08/execution-human-routes.test.ts: 23P exit0(e9ae13).
- Main node C:/Users/cyhuh/.codex/worktrees/av3-stage-b/Anvil/node_modules/typescript/bin/tsc --noEmit -p tsconfig.base.json --pretty false: exit0(ee16bc).
- Primary 기존synthetic 회수/저장/SQL3파일13P exit0. Main23과 중복되므로 합산진척으로 사용하지 않는다.
- Main git diff --check exit0(da0f77), 최종7지문 대조 일치. 신규파일의 공백/EOF 검사는 구현자 제출로 별도 확인했다.
- 독립SQL·모듈/unit C0/I0/M0. app/routes 잠정I1(직접 route 조립의 구성검사 우회)은 exact mode/Proxy/accessor/혼합검사로 보완, RED Missing expected exception→GREEN3P. 독립 재검수 C0/I0/M0.
- 여정은 실제 normal START/credential 제품함수→다른OWNER HTTP회수→동일영수증→기존challenge412를 사용한다. challenge SQL 현재성은 회수행을 읽는 RAM 대역이다. COMMIT불명은 기존503 STORAGE_FAILED/reconcile-first, 자동retry0. 설정미제공/잘못된직접설정/legacy원형 보존 확인.

## 한계와 복구

실제 PostgreSQL 문법·권한·잠금경합·COMMIT·Windows·키·서비스·C#·Agent 실행은 NOT_RUN. 0096은 미적용이다. RAM 키/DB·합성 현재성을 실환경 증거로 승격하지 않는다. 최초 fixture import 중 미존재 시험표식 lstat ENOENT 후 MemoryFS 순서 보완; 실제자료 읽기/생성은 없다. 전체계획 완료 체크는 올리지 않는다.

통합 전 rollback은 이7경로의 작업 diff만 대상으로 한다. 통합 후에는 정상 revert PR로 이 단위를 되돌리고, 다른기능·문서·기존SQL은 보존한다. 실제DB를 변경하지 않았으므로 DB rollback 실행은 없다.

## 검수 시 raw SHA256

| 경로 | SHA256 |
|---|---|
| apps/server/modules/executions/normal-grant-revocation.ts | 3DCDD878A5057EB9F60E16D57B9CB85E5D50FF173C66EA6EA97A40E26C2D5F03 |
| db/migrations/0096_normal_grant_revocation.sql.pending | 2C217BB9FC5F7415DBBDD02C9DBA17A2FBC02ECCCC5A5ECE089D49D7C5D5AC9C |
| apps/server/modules/projects/routes.ts | 44E68255634F9CFCA26D3CFEF1410E74BC434724C1BE61F7090951A6913AB9CF |
| apps/server/app.ts | 2A647AC616494923F3D7DDE36C0809E8BE2926FC18FC6437A37F690B8BCB7E68 |
| tests/unit/FN08/normal-grant-revocation.test.ts | 5AD9DEA48EDE3DE57C6BFC2F0482C4537C53EF2DB75D18D658393802694E6511 |
| tests/unit/FN08/normal-grant-revocation-sql.test.ts | 6BCF16827534DD1B2B2A7BAE688D27EC85C4C8211D292690314A2BBA938727E0 |
| tests/unit/FN08/normal-grant-revocation-journey.test.ts | AE4F62CB6EA56731970152AC6C5641491A1302011DD2FBB0B6FCD6705C0045E2 |
