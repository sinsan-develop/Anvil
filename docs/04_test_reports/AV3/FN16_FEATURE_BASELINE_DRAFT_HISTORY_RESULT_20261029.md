# FN16 기능분류 기준선 초안 역사 수집 결과 — 2026-10-29

## 판정

내부 source·합성 검수 단위다. 실제 PG/파일·백업·복원·전체 FN16/WORK_PLAN 완료가 아니다. 기준 codex/av3-stage-b 0f03fd9e933e31d4fea137426b65f917d88f86a7, Main 관리/검수/통합·기존 Primary 단독 구현·기존 Reviewer 읽기다. WI FN16_FEATURE_BASELINE_DRAFT_HISTORY_IMPLEMENTATION_20261029.md SHA256 3D0FCEBFB94CDD4213458563EDC91C5F81D8A4884BF693BB37DFBCBA821C24B6.

## 구현과 보존 경계

같은 ProjectBaselines 인스턴스의 원 readDraft/receipt·선택 승인·source·문서 보호를 재사용한다. 실제 authenticateInTransaction의 token/CSRF·현재 OWNER/세션을 caller-owned RC에서 확인하고, RO RR heads/versions와 전후 보호 조회 RC를 구분한다. 과거 actor/client·옛 버전·만료된 소비 승인을 현재 허가로 복원하거나 현재 actor와 같게 강제하지 않는다.

기존 data24+RR2의 고정26 query만 명시 projection으로 처리한다. SQL bigint는 JSON 전에 문자열화하고 필요한 Date만 복원한다. protocol JSON을 변환하지 않으며 raw DB microsecond는 변환 전 지문에 반영한다. SQL 누적 SUM/첫 초과 행으로 반환 상한을 검사하고 부분 행을 원 reader의 성공으로 넘기지 않는다. 인증/트랜잭션 제어 SQL은 원형 경로다. q 자체 제한·취소가 원 catch의503/UNAVAILABLE로 포장돼도 sticky 원오류 재검사로 성공을 막고 회수불명503이 우선한다.

사전 고유 artifact tuple/fileCount와 선언 bytes를 확인한 뒤 실제 source/문서 원문을 같은 budget으로 재검사한다. 반복 실제 읽기는 제거하지 않으며 getter로 실제 누적 inputBytes를 얻는다. 두 추가 budget 접점은 조회/기한 단축뿐이며 counter reset/기한 연장·원 읽기 알고리즘 변경은 없다.

저장 지문은 heads/versions/선택 저장 증빙이다. 별도 metadataObservationHash는 data 관측의 변환 전 지문일 뿐 원 시각을 복원할 수 있게 보관했다는 뜻이 아니다. clock·observedAt·현재 policy/control은 저장 동일성에서 제외하며 인증·과거 session/credential 식별자 원문을 관측 지문에 넣지 않는다. 자유문장·원문/경로·사용자/client·인증값을 응답에 노출하지 않는다.

출력은 heads/versions와 선택 증빙·관측 hash의 한정 범위다. 전체 묶음·초안 검토/채택·전체 프로젝트/source bytes 미수집과 atomic/full coverage/restorable/authorization restoration/execution/dispatch false를 유지한다. 기존23조합·공개 호출은 연결하지 않았다. 원 클래스 메서드·기존 helper 본문은 수행자 역대조706fd1/ebf910과 Main diff c4549e/332c0a·독립 검수에서 보존을 확인했다.

## 실패·정정과 검증

- 최초0c3f41은 메서드/helper2접점 부재 RED0P3F다. 첫 정상503은 복원 Date를 canonical 지문에 넣은 제품 오류1과 fake envelope의 임의 별표 열 반환 오류1이었다. raw 지문/명시 projection으로 교정했다.
- fixture IO/수집상태 동명 충돌·빈 Q04 overflow hook·stack 깊이·schema 정규식·타입 narrowing/import 진단을 각각 보완했다. 이들 전체 반복 횟수는 수행자 보고에 정확 총수가 없어 임의 합산하지 않는다. 경로 FN08/FN06 오타1은 WORK_STATUS의 실제 조회 실패 누적6에 포함돼 있다.
- rich nonnull 승인+ATTRIBUTE_REPORT+방법론은 실제 ProjectApprovals/SourceReadRecords/documentStageBinding을 거쳤다. 200+1, 원형을 재봉인한 tuple 충돌, q413/409의 원 catch 마스킹, 회수불명503, raw micro/clock 분리 등을 합성 검증했다.
- 후반 세션 기한의 예상413은 실제 budget DEADLINE 뒤 rollback 기한0으로 unknown503이 우선하는 경우로 구분했다. 동일 budget의 직접 DEADLINE·첫 phase9bytes를 따로 확인했다. 539fdd 단축 호출만 누락한 mutation은 Root가 계속503으로 끝나도 직접 DEADLINE이 사라져 독립 RED였고 즉시 원복했다. 예상 status만 느슨하게 바꾼 검사가 아니다.
- 첫 Main d37273은56 PASS/1883.6063ms·895c62 type/diff0였으나 독립 C0/I1을 발견했다. Q18 proposal 원 created_at,id 정렬을 ID 순으로 바꾼 결함이다. d0fb00은 반대 UUID/생성순2행의 실제 ProjectDocuments.version.proposalRefs에서 RED0P1F를 재현했다. Q18만 비반출 내부 timestamp 정렬열로 원 순서를 보존하고 JSON/legacy 반환 전에 제거했다.
- 최종 Main cd5b82는 아래 지정 명령 exit0,58 PASS/0 FAIL/0 SKIP/2006.8638ms,332c0a type/diff exit0·4지문 일치다. 독립 재검수 C0/I0·Q18 I1 해소. 독립 담당은 읽기만 했으며 실제 SQL/DB/FS나 제출된 PASS를 자신의 실행으로 표시하지 않았다.

```powershell
node --test tests/unit/FN16/feature-baseline-draft-history.test.ts tests/unit/FN16/feature-baseline-draft-history-schema.test.ts tests/unit/FN16/baseline-backup-budget-forwarding.test.ts tests/unit/FN16/artifact-backup-budget-read.test.ts
npm run typecheck
git diff --check
```

## 최종 코드 SHA256

- apps/server/modules/projects/project-baselines.ts: EBE734B1550602E471923C11EED999CAF1003592783E59E5491DF51B9393083C
- apps/server/storage/artifact-backup-budget-read.ts: F4C25D6BC15B78975D3007C6D778AAC527615039B0AA28A3229AB1ACC0D81FB2
- tests/unit/FN16/feature-baseline-draft-history.test.ts: EEFB3CD98911C35107DC56487DE11137E36603F2F688BBF6C0D52B482376FFE7
- tests/unit/FN16/feature-baseline-draft-history-schema.test.ts: C3EDB4D189013C869B55F1DADB144D695B3FF146B2E232810E5E48B7EC4F7B27

## 미검증·다음·복구

실제 PG SQL 문법/실행·schema 적용·DB/FS/OS권한·키·서비스·Agent·실제 IO 회수·브라우저·백업/복원·사용자 인수는 미검증이다. 원문 저장 포트와 DB는 합성 메모리 객체이며 실제 사용자 자료를 읽지 않았다. OS pending IO 절대기한/강제 회수와 약9PB 포화 한계는 이전 기록대로 남긴다. 실제 QA 자원0·보호8 보존·main/PR/실환경 반영0이다.

다음은 새 한정 수집들과 기존 조합의 실제 입력·인증/CSRF·보호 원문 경계를 대조해 다음 승인 범위 내 연결을 선정한다. 미수집 항목을 조용히 삭제하거나 full coverage/실행 ready를 올리지 않는다. 복구는 부모0f03fd9e와 정확 변경의 영향 검토 후 정상 revert이며 자동 reset/force·DB/서비스 복구0이다.