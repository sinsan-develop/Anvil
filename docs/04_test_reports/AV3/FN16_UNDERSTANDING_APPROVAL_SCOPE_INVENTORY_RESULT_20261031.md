# FN16 이해검토 승인 scope 이력 — 내부 호환성 결과

2026-10-31 / Main 어울 / 기존 Primary 구현·Main 검수/통합·기존 Reviewer 독립 읽기.

## 판정과 정확 범위
내부 source 수집 호환성 보완 검수 완료. 실DB·백업/복원·전체 FN16/계획 완료가 아니다.
WI FN16_UNDERSTANDING_APPROVAL_SCOPE_INVENTORY_INTEGRATION_20261031.md SHA256 9FD623257554F378DDD7378FD6F62474D7FF4C75CC7B5541A8ED2C680C9E4CD1.
시작 codex/av3-stage-b HEAD ff3ca55baabef01fe675e2e311872134c0a84927.
현재 승인된 FN09 reviewUnderstanding만 targetRef=null/양수 실행 generation을 쓰는데, 수집기는 null이면0을 요구했다.
제품 변경은 details()의 한 분기를 기존 승인 의미와 일치시킨 것이다. 다른 operation의 null0/ref.version 규칙은 그대로다.
새 공개 endpoint/DTO필드·승인/정책/권한·producer·SQL·UI·다른 collector·전체 coverage412/기존 프로젝트 차단 변경0.

## 실제 검증
Main 763133 단일4파일38 PASS, FAIL0/cancelled0/SKIP0/TODO0, exit0, 957.1539ms.

```powershell
& 'C:\Program Files\nodejs\node.exe' --test tests/unit/FN16/approval-understanding-inventory.test.ts tests/unit/FN16/approval-history-inventory.test.ts tests/unit/FN16/approval-history-inventory-schema.test.ts tests/unit/FN09/understanding-review-approval.test.ts
```

Main a250bf:
```powershell
& 'C:\Program Files\nodejs\node.exe' node_modules/typescript/bin/tsc --noEmit -p tsconfig.base.json
git diff --check
```
각 exit0. UI/Web source 변경이 없어 Web build·브라우저를 추가하지 않았다. Stage 전체 필수 gate를 통과했다는 뜻은 아니다.

정상 시험은 실제 ProjectApprovals.request→UnderstandingReviewApprovalCandidates.capture→persistProjectReceipt→알림의6종 INSERT를 메모리 원장으로 생산하고 collector가 읽는다.
실행 generation3/제어 generation2를 구분하고 실행1/MAX 안전정수, 요청 만료 뒤 과거 조회를 확인했다.
잘못된 generation/nonnull 이해검토 target, 다른 operation의 null양수·ref 불일치, legacy fallback, 원문/scopehash/receipt/audit·OWNER/종료신원/유한metadata·취소를 확인했다.
NaN/Infinity/unsafe는 canonical hash 생성 단계부터 거절됨을 구분한다. 이를 모두 새 predicate까지 도달한 반례라고 주장하지 않는다.
실제 승인 소비는 기존 FN09 회귀의 메모리 원장 증거이며 새 시험의 PENDING 요청 생산과 구분한다.
새 후보 전체 원문/실행 대상 검증을 추가했다고 주장하지 않고 기존 requestReconstructionVerification/domainArtifactVerification NOT_PERFORMED를 유지한다.

## RED·준비 오류·독립 읽기
- bba48d: 정상 실제 request/candidate/receipt/알림 생산 뒤 details():50에서503, 1FAIL/skip0/Node exit1. 최초 실제 RED이며 준비 오류0.
- 2998cf: 같은 정상 조건 GREEN 1PASS. 36ea0a의 신규6PASS/준비1FAIL과 daa82d 영향2PASS는 별도 실행이다. 신규8 전체 단일PASS로 합산하지 않는다.
- 원3 회귀 3f1669 30PASS, Primary94b16e type/diff0도 Main 단일38과 별도 증거다.
- 준비 오류는 unsafe 값의 canonical hash 생성과 소수까지 canonical 단계에서 거절된다는 잘못된 가정2건이다. 실제 source 계약을 읽고 시험을 교정했다.
- 시험 TS2783 1회는 중복 spread를 동등 Object.assign으로 바꿔 type을 보완했다. 제품/단언 의미 변경0.
- Reviewer 읽기 C0/I0의 신규 시험 지문52F1626E는 최초 제출 CF49011B와 달랐지만, 현재 최종본과 일치한다. Main e3c8f6에서 source/test 동일 지문과 한 조건 diff를 대조했다.
- 기존 legacy·현재 OWNER/RR/한도·proof·NOT_PERFORMED 및 기존3 회귀 원문은 그대로다. 보호3 지문도 원값과 같다. 정식 동일근본 실패3회·Main 코드 인수0.

## 최종 원시 지문
| 경로 | SHA256 |
|---|---|
| apps/server/modules/backups/approval-history-inventory.ts | 6DC5C43D7BC75FC1735C9ED41899EC60D1F7ABFDFCA738E1903D67BCD70A9101 |
| tests/unit/FN16/approval-understanding-inventory.test.ts | 52F1626E18417C1D6F206DC442DCC050666943B2F603D384F001E9F654E41932 |

Windows 작업 사본 bytes이며 Git blob/다른 플랫폼 checkout 지문과 구분한다.
원 회귀 지문: history 0F5E86ED97307D580DAF65CE6939A4F918DD6CE69F835C559C04C33A750A502B,
schema 8281F2E447ABB50F7813EE4C9392A02C1F38F04C7DF7176C13C356809FB20DFD,
FN09 B050088081A64584F62BDD9CE256BA63F99EEF57759D826A715286C94FE1237D.
Primary writer 반환·QA/handle0·Main 코드 직접 쓰기0.

## 미검증·다음·복구
인증/현재 policy/DB는 메모리 포트다. 실제 PG SQL/RLS/COMMIT/경합·키/파일/서비스·Agent·실백업/복원·사용자 인수 NOT_RUN/제외.
전체 FN16/Stage/작업계획은 미완료이며 기존 보호3·복구자료·원문을 보존한다.
통합은 제품/시험2+본 결과/WORK_PLAN/WORK_STATUS3의 정확5경로. 일반 source commit revert가 rollback이며 실제 데이터 삭제/down migration0.
다음 미완료는 이미 채택된 prepareExecution/reviewUnderstanding 원형과 나머지 이력 collector 간 내부 정합을 각각 좁혀 대조한다. 새 전체 묶음/복원 형식은 미채택 후보 상태다.
main 병합·배포·기존 프로젝트 차단 해제는 하지 않는다.
