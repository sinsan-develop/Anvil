# FN16 하위 HUMAN 내용 이력 수집 — 내부 통합 결과

2026-10-31 / Main 어울 / 담당: 기존 Primary, 검수: Main·기존 Reviewer.

## 판정
승인된 내부 source 통합 보완 검수 완료. 실제 DB 보관·사용자 백업·복원 완료는 아니다.
전체 FN16·Stage·작업계획은 미완료다. 현재 전체 coverage412·실행 차단을 유지한다.

## 기준과 변경
- 시작 branch codex/av3-stage-b, HEAD 11c4e95804b7f645e226d4620ec77c3d4a21f122.
- WI docs/work_packages/FN16_CHILD_HUMAN_CONTENT_INVENTORY_INTEGRATION_20261031.md SHA256 07E7A004E87E4128C49DBDE5B976EB59312D115C14F4B5BBB15710439507326B, 사전 경계 독립 C0/I0.
- 사용자 승인된 FN09 child HUMAN 내용검토·별도확정은 기존 표/DTO로 저장되는데, FN16 수집기는 예전 child draft-only 조건으로 이를 거절했다.
- 제품 diff는 assignment-inventory.ts의 검토/확정 두 parentAssignmentRef nonnull 일괄거절 제거다. 역삽입한 normalized text가 시작 HEAD와 정확히 같음을 Primary f9f98a가 확인했다.
- 후반 exact 부모 fullref·한 단계·범위 부분집합·감사 논리 순번·선택검토/최신ACCEPTED·원command/receipt/audit·원hash/익명투영·false flags는 유지한다.
- 기존 정상 childReview/childConfirm 두 사례만 성공 검산으로 분리했다. 기존6음성 및 다른 거절 조건은 보존한다.
- 새 endpoint/DTO필드·operation·schema·권한/승인·19 root 실행 소비선/shared validator·SQL·UI 변경0. 기존프로젝트 일반차단 해제0.

## 실제 검증
Main c778cb: 아래 단일 명령, 5파일35 PASS/FAIL0/SKIP0/TODO0/cancelled0, exit0, 2280.124ms.

```powershell
& 'C:\Program Files\nodejs\node.exe' --test tests/unit/FN16/assignment-child-content-inventory.test.ts tests/unit/FN16/assignment-inventory.test.ts tests/unit/FN16/assignment-inventory-schema.test.ts tests/unit/FN09/child-human-content.test.ts tests/unit/FN09/assignment-confirmation-store.test.ts
```

Main 9697e4:
```powershell
& 'C:\Program Files\nodejs\node.exe' node_modules/typescript/bin/tsc --noEmit -p tsconfig.base.json
git diff --check
```
각 exit0. 서버 이력 처리 변경으로 UI·Web build·브라우저 검사는 추가하지 않았다. 전체 Stage의 해당 필수 검증을 통과했다고 주장하지 않는다.

신규 시험은 실제 HUMAN producer/receipt와 collector를 연결한다. DB·현재 draft 보호·권한은 메모리 포트다.
정상 child/부모 후속개정 뒤 당시 원문, 손상 command/receipt/audit/선택검토, 손자/부모교체/hash·부분범위·OWNER/한도/취소를 검사했다.
Primary 848740 영향19와 cd05e1 직접인접16은 별도 실행이다. Main의35는 별도 단일 fresh 실행이며 중복 합산하지 않는다.
최종 독립 scoped C0/I0. 신규 시험 CCB83→6283 변경은 :any 두 타입표기뿐이며, Reviewer가 제거 후 이전 bytes와 정확 일치를 확인했다.

## 오류와 반증의 구분
- 준비 오류7932d2: 빈 allowedScopes로 producer422. 실제 수집기 실패 증거가 아니다.
- 2e1f5d/abe953의503에는 메모리 DB가 실제 SELECT에 없는 received_at을 반환한 오류가 선행했다. 초기 제품 guard 원인 확정을 철회했다.
- 정확 열 투영 후 ec3b89에서 원 두 guard를 메모리에 복원한 Node exit1, 수정본 exit0을 확인했다. 원 검산을 통과시키려고 producer 결과를 재봉인하지 않았다.
- 최종 TypeScript union의 receipt.data 접근 오류1은 시험의 두 지역변수 타입표기만 보완해 type exit0. 런타임/단언 변경 없음.
- Main 기본 sandbox Git diff는 not-work-tree였고 뒤 파일 읽기 때문에 wrapper exit0이었다. 이는 제품 diff PASS가 아니다. 실제 최종 diff/ddc285 및 diff check9697e4는 승인된 정확 source cwd에서 별도로 수행했다.
- 같은 원인 정식 Developer FAILURE_REPORT3회/코드 인수는 없었다.

## 최종3 원시 작업사본 SHA256
| 경로 | SHA256 |
|---|---|
| apps/server/modules/backups/assignment-inventory.ts | 57E660312DEA87295E4735604F48A6E5D5615CB56B25ED46C2F204E07E715BF0 |
| tests/unit/FN16/assignment-inventory.test.ts | 4532AEB88D3095B00D66A2B30BAF389CAEEA903B727836C8D3066BE4DCD14D08 |
| tests/unit/FN16/assignment-child-content-inventory.test.ts | 6283A383EE526D967A02B4D0807DD08C7D2AEEBEB51F192258CADF0F0847B512 |

Windows 원시 bytes 지문이며 Git blob/다른 플랫폼 checkout의 해시와 구분한다.
Main ddc285에서 보호 untracked3의 원 SHA256 불변, 원격 branch11c4e958/main f976ed5e 불변을 확인했다.
Primary writer 반환/실행handle·QA0. Main 코드 직접 수정0.

## 미검증·다음·복구
실제 PG/SQL/RLS/경합·파일/키/서비스·전체 backup/복원·사용자 인수는 NOT_RUN/명시 제외다.
A1 자료 mapping은 부분후보7152EEB8, A2/A3/A4도 미채택 후보이며 이 source 보완으로 전체 검사 가능 상태를 발급하지 않는다.
다음은 A1의 최근 표/row variant 누락과 A1~A6 전체 수동 백업 상세 계약을 이어서 구체화한다. 이미 구현된 충돌·artifact·선택파일 검사 재개발0.
통합 소유 경로는 제품/시험3 + 본 결과/WORK_PLAN/WORK_STATUS3의 정확6경로다. 보호3·기존 자료는 제외한다.
rollback은 해당 source commit 정상 revert이며 실제 DB 적용·원문 삭제/down migration0. main 병합·배포는 하지 않는다.
