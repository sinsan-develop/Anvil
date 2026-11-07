# FN10 사람 판단 저장·보호 조회·Workbench 연결 소스 검증 결과

## 판정

**소스 구현·합성 핵심 동작 검증 인수. 실제 환경 동작은 미확인.** 전체 FN10·Stage·작업계획 완료가 아니다.

- 기준 WI: docs/work_packages/FN10_NODE_DECISION_STORAGE_WEB_SOURCE_IMPLEMENTATION_20261106.md, SHA256 387DA079C1C0CD393C6DBBFEE8A9A837F076442E74B532686DB7DB5461F9F0D9.
- 내부 저장량 접합: E4016AE354EF146B5F49A685C8DA28ADDF463573C5F35B95469810B645E13951.
- 시작/검증 HEAD: 0231ddbfe7bfbe894ce60d28d0a708d99bf9d5b1, branch codex/av3-stage-b.
- 기존 Primary가 제품12·시험/fixture7을 작성했고 Main 어울이 검수·직접 검증·통합했다. 제품 작성자는 한 명이며 writer를 반환했다.
- 신산님 승인대로 실제 DB·권한·키·서비스·SDK/Agent 실행은 하지 않았다.

## 구현한 흐름

Workbench의 같은 적용본·사용자 판단 단계에서 실제 보호 조회된 확정 설계·작업계획·근거 문서를 별도로 선택한다. 제한된 ENUM 선언과 원 hash를 검산하고, 사람 판단 기록→정정→철회→별도 새 기록·목록/고정 이력 조회로 이어진다.

원 보호 reader→동일 인증 Tx의 private ID/원 명령·receipt·감사·quota→확정 반환 뒤 새 인증 보호 조회→명령2/GET2→실제 React Panel/App을 연결했다. 원문 선택과 head CAS를 분리하고, 재진입의 보호 조회 전/거절에는 본문을 숨긴다. UNKNOWN 원 명령과 receipt는 보존하며 자동 재POST·추가 basis 발급·보상 삭제를 하지 않는다.

판단 저장은 작업 완료·실제 상태 확인·자동 분기·실행 허가가 아니다. 관련 false 표식을 유지한다. 정책 편집에는 연산3의 선택지만 추가했으며 사용자 권한/정책을 자동 부여하지 않았다. 0080은 미적용 SQL이다.

## 검증 근거

| 수행자·도구 | 범위 | 실제 결과 |
|---|---|---|
| Main e22ce2 | 신규6 시험파일, 아래 첫 명령 | 36 PASS, fail/cancel/skip/todo0, 3792.425ms, exit0 |
| Main 38b5a4 | 추가 COMMIT 응답 유실1, 아래 두 번째 명령 | 1 PASS, fail/cancel/skip/todo0, 524.1981ms, exit0 |
| Main 9d06ff | npm run build, 포함 typecheck | exit0, Vite515modules/429ms |
| Main 3d8969 | 추가 시험 뒤 npm run typecheck | exit0 |
| Main dbf5e6/f270ad | git diff --check | exit0 |
| Main 16cf6e/442ad0/f50e6a | 전후19 지문·HEAD/index·보호3·원 시험 prefix | 일치, indexempty, 보호3 불변 |
| 기존 Primary 8c2373 | 직접 인접7 파일, 아래 세 번째 명령 | 69 PASS, fail/skip0, 835.2337ms, exit0 |
| 독립 읽기 검수 | 제품12와 시험/fixture7·마지막 추가1 | 최종 C0/I0/M0, 실행/수정0 |

Main의 서로 다른 신규37과 Primary의 불변 인접69는 중복 없는106개다. Primary 신규36과 Main36은 중복 합산하지 않는다. 추가1은 기존 quota 시험 앞12139B/FD22667F가 byte 동일한 채 끝에 추가됐다. 불변 인접69·기본 import·제품 build는 추가 시험만으로 반복하지 않았다.

정확한 명령:

```powershell
node --experimental-test-module-mocks --test tests/unit/FN10/node-decision-sources.test.ts tests/unit/FN10/node-decision-store.test.ts tests/unit/FN10/node-decision-routes.test.ts tests/unit/FN10/node-decision-schema.test.ts tests/unit/FN10/node-decision-quota.test.ts tests/unit/UI04/node-decision-flow.test.ts
node --experimental-test-module-mocks --test --test-name-pattern "COMMIT 응답 유실" tests/unit/FN10/node-decision-quota.test.ts
npm run build
npm run typecheck
git diff --check
node --test tests/unit/FN01/baseline-command-policy.test.ts tests/unit/FN13/project-storage-quota.test.ts tests/unit/UI11/material-policy.test.ts tests/unit/UI04/methodology-application.test.ts tests/unit/UI04/workspace-stage-document.test.ts tests/unit/FN04/work-plan-version-read.test.ts tests/unit/FN09/execution-preparation-approval.test.ts
```

모듈 mock의 실험 경고, 큰 Web chunk 경고, 기존 CRLF 정규화 안내는 유지했으며 경고를 숨기거나 설정/기준을 낮추지 않았다.

## 보완과 실패 이력

- 출처 선택 alias/getter: 실제 RED56b431/f4ebf5→044b06 GREEN. 원 사본/함수 descriptor·prototype 보호.
- 정책 잠금 순서/list alias: 8857f2→564ee9. project→policy 순서와 고정 query, 역사 replay에 새 controller CAS 비소급.
- 목록 전체 바이트: 06cac0→ba67fb. 정상35정정의 items합2MiB−10에서도 외피/cursor 포함 전체 한도·누락/중복0.
- SQL 감사 역완결: source/model349fb2→b79d71. 원 actor/client/operation/policy·고정 의미와 NULL 조건 결박. 실제PG 증거가 아니다.
- 화면 원문/receipt 결박: 선택 refs 변경097d9e→cc93c9, 다른 판단값 재봉인315b5f→e607d6.
- 기존v1 새진입의 정정/철회 head: 876bf3→8e3372.
- 재진입 보호 조회 HOLD/403 본문: 6453d1→d7deda. 같은 ref GET·POST1 불변.
- 필수 COMMIT 불명 공백은 기존 fixture LOST 모드로 보강했다. 원 COMMIT_LOST·성공 반환0·후행 새 인증0·자동 재명령0·자원 회수를 검사하며 실제DB 미저장을 단언하지 않는다.
- import/가상 entry/합성 FS 설치순서/클릭·act 준비 오류와 진단 지연 handle의 본인 종료는 제품 RED와 구분했다. 상세 도구·오류는 WORK_STATUS346~362에 보존했다.

## 미검증과 남은 작업

SQL 예약/정산은 메모리 응답 모델이고 SQL 검사는 형상·산식이다. 실제 PostgreSQL 설치·RLS/ACL·계상/역완결·잠금/trigger/경합·실제 COMMIT/Pool 반환은 미검증이다. 실제 HTTP 소켓·브라우저·WSL/사용자 인수도 하지 않았다. route는 별도 HTTP 단절 신호를 공급하지 않으므로 즉시 내부 취소를 주장하지 않는다.

실제 사용자에게 확인할 배포 URL은 이번 범위에 없다. source-only 화면 동작은 위 App/Panel 합성 시험으로 확인한다. 실제 DB 적용·배포·권한과 서비스를 변경한 것으로 해석하지 않는다.

새 판단 producer로 이어갈 FN10 단계 평가 소비와 FN07 실제 생성 producer의 선행을 재대조한다. 다른 미구현/실환경 검증을 추후 테스트라는 이름으로 완료 처리하지 않는다. private 동일성·push/PR/main 병합은 미확인이고 재시도하지 않았다.

## 파일 지문과 복구

아래는 검증한 Windows-local 원문 바이트의 SHA256이다. Git의 줄바꿈 정규화 안내와 별도로 기록한다. 동일 feature checkpoint의 정상 git revert가 복구 방법이며, 보호 비추적3·다른 문서/실환경 자원은 복구 대상이 아니다.

| 경로 | bytes | SHA256 |
|---|---:|---|
| apps/server/modules/scheduling/node-decision-sources.ts | 8265 | C585B5EDD85F8A57B09073525B1530A8E132E0C2A2B2C23698D4F9EB927F50DB |
| apps/server/modules/scheduling/node-decision-store.ts | 6967 | 89EFA865D26DFF44AC4B02D55571C602E25E7C573BDA7612B461506410970442 |
| apps/server/modules/scheduling/project-node-decisions.ts | 16261 | 8A9358C80F80776C6F30DC311C98793C5A6AAE6562A5E897B2FBDB18D669F682 |
| db/migrations/0080_node_decisions.sql.pending | 50319 | 4CF6922374CB640CC01FC6E56858EB6B17247ACAB720CFDADD76B70BC6D1AD74 |
| apps/web/src/features/workspace/node-decision-api.ts | 18555 | 15A773DCC4E2C28BD722E3FEE318C50A50BEC9CBA587D6D2F1359AF3BE93CF2D |
| apps/web/src/features/workspace/NodeDecisionPanel.tsx | 16229 | FECA3ABBCEE0AEFDD7A9AE7AB5F91E61045FD3539CF5C764F3F083550588E159 |
| apps/server/modules/access/project-command.ts | 43495 | E068F9B08AA84626A451E3E6FE1491A07CD58BFC01C47E2F9633EB4B282B2B70 |
| apps/server/modules/projects/project-storage-quota.ts | 49894 | F2768AFAB5661877F4BD2E4838E6657583F56CF5BBA871B0DCFCD0404E543DD9 |
| apps/server/modules/projects/routes.ts | 88868 | C58EFD4F2FE5ADFE9F7BA6599B7E285130CC0B58B1A308BB55FC46EA8B475918 |
| apps/web/src/App.tsx | 70252 | F3E5114FC82641FAC153BB77AF1E35388B52771D72A35C45EF2617074DDB104C |
| apps/web/src/features/workspace/WorkspacePage.tsx | 12279 | 95BFA43DC55472F8003A8CE92BE294F86E09B3EFAB87E0D7D35AEAC022768B43 |
| apps/web/src/features/connections/policy-editor-profile.ts | 5380 | 1B0862158E2FABBB31D2992FDC5C645A2D0B0B6C55C51DBE2DDBF1E3F96CF891 |
| tests/unit/FN10/node-decision-sources.test.ts | 3642 | DA689A938C787AB7C6D30CCCD405CA77CA54C7073AE26372CEE2F6C29923EAAC |
| tests/unit/FN10/node-decision-store.test.ts | 2519 | A998E3119A216AA2B7184A92C02CD9AE65E80CD08CBDC4FD813DB5A2B658C8F9 |
| tests/unit/FN10/node-decision-routes.test.ts | 3197 | 9B1A8D4EEEFDFD939B1BE6B06B34B2C160798453EE18EC74F87FEFC57F47F0A7 |
| tests/unit/FN10/node-decision-schema.test.ts | 3115 | 188C82C9F84DC00ECDB4A24426AC3A7FC83491A72131250BCB4BCC680CF74C81 |
| tests/unit/FN10/node-decision-quota.test.ts | 14134 | E8A32083EB59C7B3CA78538744B72D45A0BC339C33E3725DC523FDCB6110E991 |
| tests/unit/UI04/node-decision-flow.test.ts | 19589 | C6775DA6D34BFE6D6A54C9855DE1CE6D25150C790589FFB1D4391774A494FC64 |
| tests/unit/FN10/node-decision-fixture.ts | 25335 | EEFC0A6FB4AC449A6C1033B849D8BA3723CC7D443CD18C48CFAF65D77EE21C8D |
