# FN14 인계 준비기록 서버·화면 연결 작업지시서

2026-11-01 / Main 어울 / 기존 Primary 단일 writer / source·합성 검증

## 실행 단계·화면 결정 경계

Main5f9e7e의 실제 승인 binding은 **‘화면은 FN14 A안 범위에 포함하지 않는다’**고 명시한다. 이 제외를 전체 계획 승인으로 덮지 않는다. 아래 화면 설계는 후속 후보이며 현재 GO가 아니다. 화면 연결의 정확한 후속 결정은 PMO에 요청하고, 영향받지 않는 승인 source 연결을 먼저 진행한다.

- **지금 TEST_ONLY/PRODUCT_GO 가능한 서버6:** 아래 기존1~4(verifiers·wrapper·projects/routes·project-command)와 신규 source-adapter·connection 시험. 이미 채택된 operation/GET/policy/DTO 의미만 source로 연결하며 실제 DB/권한/서비스는 변경하지 않는다.
- **별도 결정 전 쓰기0인 Web6:** policy-editor-profile·App·TransferPreparationPage와 신규 preparation-record-api·TransferPreparationRecordPanel·UI09 시험. 화면 작업 절은 범위/검수 후보이며 결정 없이는 발행하지 않는다.
- 서버6 검수는 화면 연결 또는 전체 FN14 완료가 아니다. UI 후보를 삭제하거나 서버 검증으로 대체하지 않고 남은 작업·재개 조건을 보존한다. 후속 결정이 오면 같은 전체 작업 단위에서 정확 Web6을 이어간다.

## 기준과 범위 판단

기준 `codex/av3-stage-b` / `965a1d0700ac0ce9c6d13e18280789e01abbfd1f`. 기존 직접 채택 `FN02_FN14_SOURCE_APPROVAL_20261031.md` B7F928C104D3A4DB8ED86CA557D6CFBEC786E9060939EF0DA453CAFDCD01AA33, 준비기록 원후보 E096C897761A71D980F19B98E7BB47623DF8933C4F456BD1592621751DB1EB9D와 상한 A C842350B21242E6817FF1BA7BF709A286B8B33A936D368B212F98E63073DB0AD를 따른다. 원후보의 예전 DRAFT/NOT_ADOPTED 머리글을 새 미채택 결정으로 해석하지 않는다. 채택된 원계약·후속 승인 binding과 현재 source를 함께 대조한다.

Main·독립 읽기 판정: 기존 in-process 구현에서 제외했던 실제 source adapter·공유 등록·route·Web 소비를 이번 후속 WI로 연결한다. 기채택 POST operation `createTransferPreparationRecord`, read policy `readTransferPreparationRecord`, GET `/api/v1/projects/:projectId/transfer-preparations/:id/versions/1`, exact payload/응답/권한/상한은 동일하다. 새 공개 계약·migration·정책 부여가 아니다. 실제 DB·권한·키·파일 조사·서비스·Agent 실행 및 기존 프로젝트 차단 해제는 계속 제외한다. 준비기록은 실제 이전·재개·쓰기 회수나 자료 완비의 증거가 아니다.

## 정확 허용 12경로

| 기존 파일 | 시작 SHA256 |
|---|---|
| apps/server/modules/transfers/preparation-record-verifiers.ts | 7FBBA0DD9830965D0492F0A3ED7B5729BBFC35CE273F3A35ED217B82CD4A9A99 |
| apps/server/modules/transfers/preparation-records.ts | 2A22D4902C207F0FF6B0BB031532DFF45ACA98F2A48CF2AE4C97780F3E1D75B8 |
| apps/server/modules/projects/routes.ts | 0C2D7028DEA539D8D99C4D288B5FE0B737A8421C63E96E5C8D0EE161459F0726 |
| apps/server/modules/access/project-command.ts | 7603F52AC8A821B01ED1D7F3EF4F315281B5144EF8E810C044BADCF95B1F985C |
| apps/web/src/features/connections/policy-editor-profile.ts | 0EB31A569F7A72FE5AE10FE9D0792C670710D3A515E1811B4FB8CCA8EC01F8CA |
| apps/web/src/App.tsx | A671D1A20CF20BE1A484D00EC96D9AAC6A119C86FBF30E6D7B17A254288CBCA0 |
| apps/web/src/features/transfers/TransferPreparationPage.tsx | 02BCCFBA99AAC6CFBF5E073EC1D1FFEBB845691DAF066FFE6C05F3A4E3ADF31B |

신규5(작성 직전 부재 재확인):

1. apps/server/modules/transfers/preparation-record-source-adapter.ts
2. apps/web/src/features/transfers/preparation-record-api.ts
3. apps/web/src/features/transfers/TransferPreparationRecordPanel.tsx
4. tests/unit/FN14/preparation-record-connection.test.ts
5. tests/unit/UI09/preparation-record-ui.test.ts

기존 store SHA565257E429A019B0B8A38A6908BD9CA32BF0C21E949F6EFAB0BFC1D5B578DF27·input·0060 pending·기존 시험·server app.ts·다른 사용자 변경/보호3은 보존한다. 추가 경로가 필요하면 최소 사유/diff를 Main에게 먼저 제출한다. Main은 제품/시험을 직접 쓰지 않는다.

## TDD 시작과 서버 연결

처음 TEST_ONLY는 신규 connection 시험1만 작성한다. 기존 app/route·실제 클래스와 메모리 transaction 경계를 사용해 기채택 고정 GET 또는 명령의 미연결을 행동 RED로 보여준다. 새 파일 부재/import 오류·타입 오류·잘못된 fixture만으로 RED라고 하지 않는다. Main fresh RED 및 기존7 불변 뒤 PRODUCT_GO로 현재 서버6만 구현·검수한다. Web6은 별도 결정 후에만 이어간다. 완료된 전수 검사·새 실제 QA/환경 실행은 반복하지 않는다.

- 기존 POST 명령 route에서 해당 operation만 전용 wrapper.command로 분기한다. authenticated는 한 번, 공통 policies.command 안의 중첩 인증/새 transaction은 금지한다. host/origin·CSRF·현재 세션/회원/OWNER·단독 제어·명시 write/read AUTO 정책·기한을 그대로 집행한다. REQUIRE는 기존412, approvalRef null이다. 서버 공유 operation에는 기채택 write/read 이름만 추가하며 정책 UI는 후속 결정 뒤에만 연결한다. 실제 정책을 자동 부여하지 않는다.
- 고정 GET은 작성자/현재 OWNER·현재 read AUTO를 검사한다. 현재의 새 client는 허용되지만 control 보유를 강제하지 않는다. 새 목록·검색·다운로드 API는 없다. COMMIT 확인 전에 receipt/ref를 외부에 반환하지 않으며 COMMIT 결과 불명은 UNKNOWN, 자동 새 명령/재전송 금지다.
- 기본 verifier는 NOT_CONNECTED를 유지한다. 실제 어댑터는 route가 가진 실제 보호 클래스/메서드를 capture하는 제한 factory로 구성한다. SYNTHETIC_ONLY 이름만 실제 모드로 바꾸거나, 요청/임의 콜백의 성공 태그를 권위로 신뢰하지 않는다. 테스트도 실제 adapter 코드를 메모리 PoolClient/ArtifactStore와 연결하며 fake adapter 성공만 검증하지 않는다.

## 같은 Tx·선택별 보호

같은 PoolClient/actor에서 auth → project/member 부모 FOR UPDATE → POST control/policy → command 잠금 → 선택 상위행 kind/id 고정 순서 잠금·재읽기를 유지한다. 관련 source writer의 같은 프로젝트 충돌 잠금 소비를 source로 대조하고 합성 지연으로 순서를 검산한다. 파일시스템 전체의 원자 snapshot이나 실제 PG 병렬 성공을 주장하지 않는다.

현재 lock의 context 선행 읽기는 불변 manifest 발견과 잠금 후 실제 본문 보호 재읽기로 분리한다. 임의 문자열에서 출처 목록을 추정하지 않는다. 내부 port에 fresh/history 구분을 전달할 수 있으나 wire/DB DTO를 바꾸지 않는다. 서로 다른 요청의 선택값을 공유 mutable closure에 두지 않는다.

| 선택 | 필수 검산·미구현 경계 |
|---|---|
| assignment | 실제 ProjectAssignmentConfirmations.read의 root 확정 fullref/hash·근거. 새 저장에만 draft.current를 검사한다. 역사 GET/replay에 최신 draft/head CAS를 재적용하지 않는다. |
| context | 실제 ProjectContexts.read/ContextSources.resolve와 같은 actor/db를 사용하고 assignment·baseline/budget·manifest 관계를 exact 대조한다. 이 reader는 원문 보호 읽기를 포함하므로 metadata-only라고 부르지 않는다. CHANGED/UNAVAILABLE는 기존 gap 의미이며 접근권 확인을 대신하지 않는다. |
| sourceRefs | DOCUMENT_VERSION/KNOWLEDGE_VERSION/USER_INSTRUCTION 각각 기존 보호 reader·hash·격리·접근을 재검산한다. 본문은 기록/응답/로그에 새 복제하지 않는다. 원문회수/접근거절은 전체404로 숨기며 gap/null로 우회하지 않는다. 시험 bytes만 메모리로 둔다. |
| role | 실제 readRole의 project/stage/parent 보호와 보관된 임무↔역할 관계 증거를 검사한다. 선택 oldBinding이 있으면 해당 보호 readBinding을 우선 사용한다. 없으면 같은 project/role/assignment에 실제 존재하는 불변 binding 원행을 한정 선택해 readBinding으로 검산한다. 증거 없음은412. ownerRole 이름·caller assignmentRef를 복사해 관계를 발명하지 않는다. |
| oldBinding | 정확 assignmentRef/roleRef·원 session·receipt/audit를 보호 readBinding으로 검사한다. role null인 선택은 기존422. 역사 원형에 새 latest/replacement CAS를 적용하지 않는다. |
| targetConnection | REGISTERED_CONNECTION version-ref 보호 reader가 미구현이다. nonnull은412를 유지하고 입력 원형을 보존한다. HOST_TRUST/candidate/connector를 alias로 성공시키거나 자동 null로 바꾸지 않는다. |

null은 기존 미수집 gap으로 허용하되 null/root만 검증해 전체 선택 연결 완료로 표시하지 않는다. 나머지 합법 선택 조합 전부와 각 미구현을 구분한다. 기존7 slot·출처 union·고정 gap·canonical hash/길이·intent 최대30분·10,000건/1GiB 상한과 실패 전체 rollback을 유지한다. replay 신규량0·새 head/intent 만료와 역사 접근권을 구분한다. 실제 stop/writer/understanding/transfer confirmation gap을 해제하지 않는다.

## 화면 작업

- 기존 readTransferRecords가 검산한 detail.confirmed fullref를 사용한다. route ref를 확정본으로 추정하지 않는다. 기존 기록·맥락·후보 조회는 유지한다.
- App 소유 buffer를 project/user/client/고정 확정 임무에 결박해 이유·선택 refs·원command/body·UNKNOWN·저장 ref를 보존한다. 같은 객체로 돌아오는 ABA·무렌더 transport 교체·인증 회수·늦은 응답을 검산한다. 다른 주체의 입력/명령은 표시하거나 재사용하지 않는다.
- 명시 준비→사용자 입력/선택→명시 저장→고정 GET을 연결한다. 선택·승인·route 복귀만으로 POST하지 않는다. UNKNOWN은 입력 잠금과 같은 원명령 확인만, 명확 실패는 원형 보존 후 명시 조치다. 저장 영수증 뒤 GET 실패와 POST 결과 불명을 구분한다.
- 실제 검산한 역할/결박/맥락 참조를 소비하고 임의 UUID·caller 성공 flag 입력으로 관계를 대신하지 않는다. target 미연결은 명시 표시·원선택 보존한다. 기존 화면의 ‘새 쓰기 불가’ 설명은 준비 metadata 저장과 실행/인계 쓰기 금지를 정확히 구분한다. 확정·동결·교체·이해 합격·재개 버튼을 추가하지 않는다.
- 수정 전 기존 craft-floor를 읽고 기존 디자인을 유지한다. 새 브라우저/파일 QA 산출물은 생성 전 Main의 정확 자원 등록 없이는 만들지 않는다.

## 검수·반환

실제 어댑터+메모리 PoolClient/ArtifactStore·Fastify.inject·React host에서 null/각 선택·3 source 종류·역할 관계 유무/oldBinding·target412 조합, same db identity·잠금 후 회수/변경·현재 세션/기한/정책/작성자·새 client GET·역사 head 진행/intent 만료 replay·source 회수404·상한429/원자 rollback·COMMIT 불명·UI 원명령/늦은 응답/route 왕복을 검증한다. 실제 SQL·PG/FS·권한 부여·서비스·Agent/인계는 NOT_RUN이다. 기존 parser/store/상한 시험은 직접 영향 범위만 골라 실행한다.

실제 RED/GREEN·정확 명령/exit/지문/diff·준비 오류와 제품 오류·미실행·root/global/채널/비동기 회수를 제출하고 writer를 반환한다. Main fresh 확인·독립 C/I0 이후 소유 경로만 기존 branch로 통합한다. rollback은 소유 commit 정상 revert. 전체 FN14·UI09·Stage·작업계획 완료를 별도로 판정한다.
