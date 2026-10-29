# FN16 소스 위치 선언 역사 명시 profile 결과

- 시작/최종: 2026-10-30 KST / 담당 Main 어울·단일 Primary·독립 Reviewer
- 기준 HEAD c1ca0e6fb3f32959414aab32db54fe4144b342d0, branch codex/av3-stage-b
- WI docs/work_packages/FN16_SOURCE_ROOT_HISTORY_PROFILE_IMPLEMENTATION_20261030.md
- 최종 WI SHA256 B7666F2FB314DAAB245623BEC61FB8F4E6A667000D09DC8D8E38EBC0606921B0 (r3; r1 4475728E→r2 40A5B7D0)
- 판정: 한정 내부 source·메모리 합성 검수 완료. 전체 FN16/WORK_PLAN·실제 백업/복원·사용자 인수는 미완료다.

## 변경과 판단 이유

기본24·기존 baseline context26은 유지한다. server-only sourceRootHistory:true를 명시했을 때만 기존 Root·원문 consumer가27을 실제 소비한다. 이 값은 수집 profile이며 권한 proof나 실환경 활성화가 아니다. 닫힌 descriptor 복사·실제 repo/class/CSRF/OWNER·최소기한을 유지하고 잘못된 값/getter는 DB 전에 거절한다.

새 수집기는 원 ProjectSourceRoots.read를 제한 RR query port로 호출하며 5표66열의 원 선언·명령·영수증·감사를 검산한다. 원 snapshot hash와 익명 투영 hash를 분리한다. host/path/displayName/reason/connectorId·actor/client 원형은 반출하지 않는다. 과거 작성자가 현재 OWNER와 달라도 원 저장 무결성이 맞으면 보존한다. 실제 경로 존재·connector trust·현재 실행권한은 판정하지 않는다.

r2에서 같은 SourceScope ref 형태만으로 generic SOURCE_ROOT/SOURCE_ROOT_REFERENCE를 선언 저장소에 연결하던 추론을 제외했다. 두 kind는 우연히 동일 ref여도 기존 EXTERNAL_UNSUPPORTED를 유지하며, 자체 SOURCE_ROOT_DECLARATION provider만 공급한다. 기존 글로벌 미수집 umbrella/false는 그대로다.

r3은 Root-owned 내부 인증 guard 전용이다. standalone raw repo의 callback 이전 인증 대기 보장을 지원했다고 주장하지 않는다. inherited RC는 Root의 검증된 설정·timer·pending 소유를 끝까지 소비하고 child 전후 검사를 수행한다. 자체 RR만 설정/readback·tracked·단발 rollback을 소유한다. 새 권한 브랜드/boolean·공통 인증 controller는 만들지 않았다.

원본 metadata 반복 읽기·추가 원 read·최종 DTO 비용을 누적하고 원 D/B/V 및 파일 보수상한 의미를 유지한다. 파일 원문을 수집하는 새 권한이나 공개 반출 API는 추가하지 않았다.

## 정확5코드와 최종 지문

| 파일 | SHA256 |
|---|---|
| apps/server/modules/backups/source-root-history-inventory.ts | C5538A46F6ED08A842009202C824923AF946B9C270A6F9F02A5C2AB4873BF26F |
| apps/server/modules/backups/project-inventory-composition.ts | 2521C6D670E5B904E6FE68F8A7008DC964415BE5D63480FF1479B3D67E3E54AA |
| apps/server/modules/backups/artifact-current-verification.ts | 6F4E9EB89EF359996FA6DDC4AA4D61F3D8613E9E3FD91B4E7C040CF21A45E422 |
| tests/unit/FN16/source-root-history-profile.test.ts | B546AD21E506B48593565537C956ADD345267405A81631CCAC0DD394AC4BD90E |
| tests/unit/FN16/source-root-history-profile-schema.test.ts | E695DB6A1887B7A3D1F5087F137935E656EC4DA57FCFD3833B161CB0C5E5F279 |

Primary writer 해제·Main 코드쓰기0. 원 SourceRoots0686DCA0/inputAFEE4BA2/class2792F681/helper96497534/generic parser87628355 불변 근거는 수행자3c0ed4와 정확 tracked diff 범위로 구분한다. 기존 시험 파일은 수정하지 않았다. 소유 WI/본 결과/계획/현황4문서만 함께 게시하며 보호8은 제외한다.

## 실제 검증

최초 b2d157은 부재 RED0P2F다. 정상503 57eae7은 별도 줄관측8b8f9b에서 통과해 원인 미확정으로 보존한다. 이를 후속 보완으로 소급 PASS 처리하지 않는다.

중복 RC 설정·중첩 timer·자체 RR rollback 재시도는 별도 안전선으로 분리했다. 수행자724282 변이2종은 각2≠1 RED→정확 복원 GREEN, b29419 고정clock 중복설정 변이는 readback8≠0 RED→복원0 GREEN이다. 자체 RR 설정 음성은 Root 초기 인증이 아닌 해당 RR 진입 뒤 주입했다(2f204c).

generic fixture3시도 cae032/bd8ba8/4e0a35는 ResultReview 최소 자료를 전체 Root와 합치면서 ResultSubmission 원형/증빙·receipt 선택키를 빠뜨린 검증자료 공백이다. Main9bc190/e48751/9ec4a5가 기존 receipt id 선택과 새 command_id 선택을 대조하고 한정 재개했다. 9dd9d8 1P는 receipt.id≠command_id/FK·조회 목록과 generic 미해결 의미를 함께 확인했다. 제품 실패보고3회나 권한 완화로 표시하지 않는다.

Main 첫 c57649: 당시 collector7043A2AA/행동125DBB3F에서 신규22+직접기존9=31시험 PASS/0FAIL/0SKIP, 5539.0704ms, exit0. 7cb74e type/diff0·5지문 일치. 아래 지정 범위였다.

```text
node --test --test-name-pattern="source root history profile |sourceRootHistoryProfileSchema |feature composition actual context|feature composition default context|featureArtifactConsumerSchema |feature artifact consumer actual26|feature artifact consumer postRoot OWNER|projectArtifacts 실제24|projectArtifacts 빈 실제조합|projectArtifactsSchema" tests/unit/FN16/source-root-history-profile.test.ts tests/unit/FN16/source-root-history-profile-schema.test.ts tests/unit/FN16/feature-baseline-composition.test.ts tests/unit/FN16/feature-baseline-artifact-consumer.test.ts tests/unit/FN16/feature-baseline-artifact-consumer-schema.test.ts tests/unit/FN16/project-inventory-artifact-verification.test.ts tests/unit/FN16/project-inventory-artifact-verification-schema.test.ts
```

이후 독립 C0/I1: 저장자료/감사 파생 hash가 DB timestamp raw 표현을 그대로 사용해 동일 시각의 Z/offset을 변경으로 오인했다. Mainb0d26e도 확인했다. 새 collector에서 DB 최상위 시각의 hash용 복사본만 정규 UTC micro로 처리했다. 원 snapshot/result JSON·strict ISO protocol·원 ref hash는 그대로다. legacy 비교에서도 실제1micro 차이를 Date의 ms 손실로 숨기지 않는다.

수행자99e621 정상3 RED·실제1micro 음성1 PASS→de40c2 추가5 PASS. 마지막 묶음 출력 유실은 결과 미확인으로 남겼고 프로세스/terminal 부재 후 같은 신규 범위만 한 번 재확인한 d960aa 27P/type0/diff0를 별도 보존한다.

Main898335: 최종 지문에서 아래 신규2파일27 PASS/0FAIL/0SKIP, 5590.4977ms, exit0. 1b66a7 type/diff0·5지문 일치. 기존9는 Root/consumer/기존시험 불변과 앞 실행 범위로 분리 보존하며, 앞31+뒤27을 단일 최종58 또는36 전수 실행으로 표기하지 않는다.

```text
node --test tests/unit/FN16/source-root-history-profile.test.ts tests/unit/FN16/source-root-history-profile-schema.test.ts
npm run typecheck
git diff --check
```

독립 scoped 재검수는 시각I1 해소·최종 C0/I0다. 정상 저장→개정→회수/과거 주체, 원형·재봉인/회수뒤 개정, literal flag, metadata 누적, 현재성, Root RC pending/자체 RR 회수, 최종 직렬화 기한과 동일시각/실제1micro를 구분했다. paging은 추가201저장(save1+revise200), 기존3 포함204버전의200+다음page이며 201회 revise가 아니다. Main 원형 대조 b0d26e와 시험 제목 정정은 본문·기준 불변이다.

## 미검증·예외·다음

실제 PG/schema/RLS/trigger·제품 원문 FS·키·서비스·Agent·공개 호출·archive/restore·브라우저·사용자인수 NOT_RUN. 실제 메서드와 메모리 SQL 상태 검증은 실제 DB 증명이 아니다. 원형은 검산 중만 사용하고 본 단위는 경로 원문/등록·trust·전체 소스/미커밋·전체 coverage 보존을 증명하지 않는다. 미채택158E 정책·공유B issuer/ABA 미충족·보호참조A 미연결·FN15 factory 미활성·P03 R2 재실행 금지는 유지한다.

Main7905c3의 미확인 경로 검색 오류 누적7과72d5c6의 괄호 파싱 오류(동유형2)는 WORK_STATUS에 원문 근거/중단 조치로 기록했다. 제품/개발자 오류로 전가하거나 ACL/권한을 변경하지 않았다.

rollback은 정확 내부 profile delta의 정상 Git revert이며 기본24/26·원 자료/계정/키·DB/서비스를 변경하지 않는다. 실제 Stage gate 미충족이므로 PR/main 병합·사용자 인수 주장은 하지 않는다. 다음 기존 승인 미완료 단위의 실소유 소비선/선행을 대조해 이어간다.
