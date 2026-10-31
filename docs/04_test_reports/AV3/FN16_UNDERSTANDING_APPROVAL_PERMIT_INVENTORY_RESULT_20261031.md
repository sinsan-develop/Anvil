# FN16 승인 이해검토·permit 이력 — 내부 통합 결과

2026-10-31 / 기존 Primary 구현, Main 검수·통합, 기존 Reviewer 독립 읽기.

## 판정·기준
승인된 내부 source 호환성 보완 검수 완료. 실제 DB·백업/복원·전체 FN16/계획 완료는 아니다.
부모 WI6D223643EFCD598E846D78AED023C22E0B4386E4E8502EB70F583ABB1F4FD873,
고아 소비 보완 부록DF9F65719666F5EF8AD5CB7DCED53C19CE07F344A00AC4FA3AE09FA80F2AEAA1.
시작 control8008e1f5637811705b5cfffd8ba67b287c12d739, 보완 control a4e443b5fcda539c4886a88261178a6c3dc10c2f, branch codex/av3-stage-b.

## 변경
- 기존 collector의 null 승인 원명령 재구성을 현재 승인된 이해검토 원형과 맞췄다.
- 같은 RR의 연결 승인3표·후보12열·관련 request/decision command와 receipt/audit를 유한 선택 검산한다.
- 기존 assertStoredUnderstandingApproval을 재사용하고 원 null승인 candidate 전체 command/payload hash·실제 승인 command·원요청/결정/소비 tuple·원시각/순번/cardinality/unused를 대조한다.
- 승인 scope는 null target/실행generation, 실제 command는 executionId target/같은 실행generation이다. 제어generation은 별도로 검산한다.
- AUTO는 전체 review command ID에 한정한 기본 소비 존재 검사를 거친다. 정상 AUTO에서 request/decision/candidate는 조회하지 않는다. 고아 소비를 승인/AUTO 성공으로 바꾸지 않는다.
- 기존 fixture에는 빈 approval_consumptions 표 1항목만 추가했다. 단언/행생산/한도와 unknown표 거절은 그대로다.
- 새 DTO필드/endpoint·권한·SQL·producer/helper·다른 collector·실행/전체 coverage412 변경0. 현재 OWNER와 과거 creator를 구분하며 위장·중첩 인증 transaction0.

## Main 최종 실행
973541: 아래 단일4파일35 PASS, FAIL0/cancelled0/SKIP0/TODO0, exit0, 4159.6406ms.

```powershell
& 'C:\Program Files\nodejs\node.exe' --test tests/unit/FN16/understanding-approval-permit-inventory.test.ts tests/unit/FN16/understanding-permit-inventory.test.ts tests/unit/FN16/understanding-permit-inventory-schema.test.ts tests/unit/FN09/understanding-review-approval.test.ts
```

ec263b:
```powershell
& 'C:\Program Files\nodejs\node.exe' node_modules/typescript/bin/tsc --noEmit -p tsconfig.base.json
git diff --check
```
각 exit0. 서버 이력 처리 변경으로 UI/Web build·브라우저를 추가하지 않았다. Stage 전체 gate 통과 의미는 아니다.

신규 시험은 실제 승인 요청/capture/별도결정/이해검토service·store/persist/consume를 소비한다.
auth/policy/응답·하위 읽기·DB는 메모리 포트다. START1/SEND2 원형을 함께 소비한다.
원후보·두hash·독립 tuple·원request/decision/proof·시각/순번·현재OWNER/기한/한도·다른현재OWNER/과거만료·AUTO 고아소비 반례를 확인했다.
실제 원문 재봉인·실행/전달·backup/restore 수행은 없다.

## 반증·독립 finding·보완
- dbd100 실제 최초 RED 및fd59be 진단: 정상 승인 이해검토가 저장된 뒤 collector133의 null 승인 재구성으로503. 61f4c1 GREEN. 준비 오류0.
- 신규 d2dc12 7PASS, 원시각 보강6494e2 RED→2474a1 GREEN1, 기존3회귀a0bd2e26PASS/type e50505는 별도 실행이다.
- Main 초기 bbd4ff34PASS/db3286 type·diff0 뒤에도 독립 C0/I1이 남았다. AUTO metadata가 정상 null인데 고아 소비행만 있는 단독 반례가 선택 조회에서 빠졌다. 이34를 최종 합격으로 승격하지 않았다.
- Primary91d7fc는 원 AUTO snapshot/command/ar/audit를 유지하고 고아AC1행만 추가해 성공/assert.rejects 실패 RED를 확인했다. cc7ed2는 이 반례와 정상 AUTO 선택범위2PASS.
- 부록으로 정확3경로를 고정하고 모든 review ID의 유한 AC 검사/중복·선택집합을 보완했다. 원fixture는 빈 소비표1항목뿐이며 830e96 및 독립 검토가 이전9941A499와 그 외 bytes 동일을 확인했다.
- 보완081bff4파일35PASS/type5bbc5d도 Main 최종35와 별도 증거다.
- 최종3지문 독립 scoped C0/I0, 원 I1 해소 확인. Main c2763c에서 동일 지문·원 schema/FN09/보호3 보존 및 START/SEND 정규화 block의 HEAD 동일을 직접 확인했다.
- START/SEND block은 독립/Primary 대조에서11592bytes·SHA88F53144E2AF1DEA648ED1C0C846BB3E9B712026A6C41413F4001BFE46FE6434로 동일하다.
- Main의 추측 파일경로 읽기 오류 반복은 WORK_STATUS/PMO에 별도 예외 보고하고 해당 방식을 중단했다. 확인된 실제 목록/정본 경로로만 접근한다. 제품·권한 변경0.

## 최종 원시 Windows 작업사본 지문
| 경로 | SHA256 |
|---|---|
| apps/server/modules/backups/understanding-permit-inventory.ts | DF84042B09956275D2D7D8A347410F583F97A083A611089855DE4C37CFDAE780 |
| tests/unit/FN16/understanding-approval-permit-inventory.test.ts | 857D795EBD5432D5F6F4B3D755E7D076FD7540B7386E4524A4226A99FB879C19 |
| tests/unit/FN16/understanding-permit-inventory.test.ts | 2FAE6763E99F9FFB2BBB6E914E1FAF213EA7C5CE5DBC750A40B368D22D38FC45 |

Git blob/다른 플랫폼 checkout 지문과 구분한다. schema162B6B1BE2B64A81AAB583E495637E7D667C425694DD90984F82DB6E0BB14127,
FN09 B050088081A64584F62BDD9CE256BA63F99EEF57759D826A715286C94FE1237D는 불변이다.
Primary writer 반환·handle/QA0·Main 코드 직접 쓰기0·보호3 원지문 불변.

## 실제 제외·다음·복구
실제 PG/SQL/RLS/경합·키/사용자 파일·서비스/Agent·실백업/복원·사용자 인수 NOT_RUN/명시 제외다.
원시각의 DB 기본값 source는 transaction 시각이며 snapshot.recordedAt의 clock 관측과 구분했다. 실제 PG 실행 증거는 아니다.
모든 PENDING 후보/원문을 반출하거나 전체복원 가능한 상태를 발급했다는 뜻이 아니다. fullProjectCoverage/restorable/실행 false 및 NOT_PERFORMED를 유지한다.
통합은 제품/시험3+본 결과/WORK_PLAN/WORK_STATUS3 정확6경로다. source commit 정상 revert가 rollback이며 실제 데이터 삭제/down migration0.
전체 FN16/계획은 미완료다. 다음은 미확정 A1~A6 전체 백업/복원 계약의 역사 주체·원hash/관계 보존 선행을 구체화한다.
main 병합·배포·프로젝트 일반 차단 해제는 하지 않는다.
