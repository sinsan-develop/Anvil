# FN14 Web 준비기록 작성·저장·고정 조회 구현 지시서

2026-11-01 / Main 어울 / 관측 HTTPS 소스 검수 후 기존 Primary 순차 수행.

## 승인과 범위
신산님 최신 직접 지시로 FN14 Web의 코드·화면·합성 검증을 승인받았다. 기존 서버/화면 WI SHA256 5E6EC9566A44A2D485198172F26794B0EADB552D8A52EE92CC4EA3C0A0DB030D의 Web6 미승인 문구는 당시 이력이며 이번 직접 승인으로 해소됐다. 원 준비기록 계약 E096C897761A71D980F19B98E7BB47623DF8933C4F456BD1592621751DB1EB9D·기존 상한A·이미 검수한 서버 연결은 유지한다. 실제 DB·권한·키·서비스·Agent 실행/사용자·백업 자료 조사/차단 해제/실제 이전·재개·회수·이해합격은 제외한다.

목표는 현재 고정 인계 기록을 읽기만 하던 화면에서 검산된 확정 임무·선택 refs를 준비기록으로 명시 저장하고 다시 여는 실제 제품 소비 연결이다. 기존 서버6/SQL을 다시 구현하거나 원문을 복제하지 않는다. 준비 metadata 저장과 실제 인계·실행 쓰기를 구분한다.

## 정확 제품·시험 7경로
기존 Web6에 실제 React 합성 브라우저 검수용 harness1만 추가한다. 새 공개 API나 라이브 환경이 아니라 필요한 시험 코드 배치 결정이다.
1. apps/web/src/features/connections/policy-editor-profile.ts (기존)
2. apps/web/src/App.tsx (기존)
3. apps/web/src/features/transfers/TransferPreparationPage.tsx (기존)
4. apps/web/src/features/transfers/preparation-record-api.ts (신규)
5. apps/web/src/features/transfers/TransferPreparationRecordPanel.tsx (신규)
6. tests/unit/UI09/preparation-record-ui.test.ts (신규)
7. tests/browser/UI09/preparation-record-dom-harness.tsx (신규)

수행 전 실제 부재/현재 지문 확인. 기존 App은 다른 완료업무를 포함한 현재본에서 필요한 부분만 변경한다. 서버/SQL/등록/권한·package/lock/보호3·관측 HTTPS4는 불변. 추가 경로 필요시 Main에게 정확 사유를 먼저 보고한다. Main 동시 제품write0·subagent commit/push0이다.

## 기존 wire·현재 보호
- 기존 operation createTransferPreparationRecord와 GET /api/v1/projects/:projectId/transfer-preparations/:id/versions/1만 사용한다. read 정책은 readTransferPreparationRecord. policy profile에는 이 기존 연산을 소비하도록만 반영하며 실제 사용자 정책을 생성/부여하지 않는다. 새 목록/검색/다운로드/승인·정책 fallback0.
- payload exact7: assignmentRef,contextRef,roleRef,oldBindingRef,targetConnectionRef,intentExpiresAt,reason. 외피는 targetId:null/expectedVersion:0/baselineRefs:[]/approvalRef:null. actor는 현재 인증에서 얻으며 caller actor/source/current flags를 보내지 않는다. REQUIRE는 기존412로 보존한다.
- assignmentRef는 readTransferRecords가 검산한 detail.confirmed의 exact fullref다. route ref나 ownerRole 이름을 확정/관계 증빙으로 추정하지 않는다. context는 같은 확정 임무의 기존 고정 GET/hash를 검산한 선택만 사용한다. null은 사용자가 명시적으로 미수집 상태로 선택한 값이며 임의 실패를 null로 바꾸지 않는다.
- reason은 유효 Unicode·비어 있지 않음/UTF8 최대4096B, 전체JSON2MiB. intentExpiresAt은 UTC ISO/서버 계약 최대30분, UI에 기간 의미를 명시하고 준비 시 한 번 고정한다. UNKNOWN 재확인 때 시각/원입력/원명령을 새 값으로 갱신하지 않는다.

## 역할·결박 선택과 미지원
기존 detail.state.roles/bindings는 원 snapshot/hash를 검산한 입력 후보다. 서버 집계의 bindings는 assignment별 전체 이력이 아니라 역할별 최신 제한목록이다. 다른 임무의 최신 binding을 선택 임무 oldBinding으로 자동 채택하지 않는다. 선택 confirmed·role fullref와 exact 대조한다.

필요한 과거 참조는 기존 GET /projects/:pid/project-roles/:id/versions/:version 및 role-bindings/:id/versions/:version의 명시 보호 조회를 재사용한다. UI에서 알려진 ID/version을 입력받아도 보호 GET→형식/hash/project/assignment/role 검산 전에는 채택하지 않는다. 새 UUID/ref/hash·관계 증빙을 만들지 않는다. 과거 모든 기록의 탐색 기능을 구현했다고 주장하지 않는다. 가능한 현재 후보는 사용자 목록 선택으로 먼저 제공하며 직접 참조 확인은 보조 경로다.

role-only·role/binding·context/null의 합법 선택을 서로 구분한다. role은 같은 프로젝트 보호 원본, binding은 정확 임무/role을 대조하며 최종 현재 정책·관계 검증은 기존 서버에 맡긴다. 접근 실패는 전체 숨김/거절이며 성공 gap/null로 바꾸지 않는다. UI가 미확인 관계를 확인됨으로 표시하지 않는다.

targetConnectionRef의 REGISTERED_CONNECTION 보호 reader는 아직 미구현이며 nonnull은412 유지다. 후보/host trust/connector를 alias로 바꾸지 않는다. 기존 target 선택이 있다면 원형을 보존하고 명시 미지원·저장 거절을 보여 준다. 실패 뒤 자동 null/다른 대상을 선택하지 않는다. null/root만 구현하고 전체 선택 연결 완료라고 표시하지 않는다.

## 화면과 원명령 버퍼
- 기존 Page의 맥락/임무/체크포인트/후보/원문 조회를 유지하고 새 준비기록 패널을 실제 mount한다. App 소유 전용 buffer는 user/client/project/확정 임무 fullref별로 격리한다. 기존 다른 버퍼를 재사용·덮지 않는다.
- 명시 선택·이유/기간→원본 대조/준비→명시 저장→영수증 검산→고정 GET 원문 조회를 연결한다. 확인/선택/route 복귀/조회만으로 POST0. 저장 성공 뒤 GET 실패와 POST 불명을 구분한다. 유효 영수증과 ref는 GET 실패로 지우거나 다시 저장하지 않는다.
- 전송 전에 원command/body·client/controlGeneration과 불명 가능 상태를 부모에 보관한다. UNKNOWN은 입력 잠금·원ID/원body 동일 명령의 명시 확인만 허용하며 자동 retry/새UUID/기간 재설정0이다. 명확 거절은 원형 보존·명시 수정으로만 이어간다.
- user/client/CSRF·client 객체/transport·선택 확정 임무/고정 refs와 async 수명을 결박한다. ABA/무렌더 transport 변경·인증 회수·늦은JSON/digest/옛401은 현재 문맥을 오염하지 못한다. 세대별 busy/working/finally를 검산하고 old UNKNOWN은 보존한다. 다른 주체/프로젝트 원문·원명령은 노출/재사용하지 않는다.
- 준비기록의 gaps·미확인/선택·과거시각을 그대로 표시한다. 본문 새복제·완비/회수/권한·실제 인계/재개/이해검토 PASS 승격0, 관련 실행 버튼 추가0. 기존 화면 디자인·글꼴·상태 흐름을 유지한다.

## 검수 순서
1. TEST_ONLY: 기존 Page의 준비기록 저장 진입 미연결 또는 기존 소비 누락을 실제 component/source 반례로 보여 준다. 신규module loader부재는 기능오류와 구분한다. Main 검토 후 PRODUCT_GO.
2. 기존 실제 client/보호 reader·서버 wire와 메모리 transport/React host를 연결해 정상 준비→명시1POST→receipt/ref/hash→고정 GET을 검수한다. 서버 계약 또는 이전 서버52조건을 수정/전수 반복하지 않는다.
3. 중요 음성: 다른 주체·임무/hash/role/binding 관계(최신 binding이 타 임무), 알려진 과거 binding 보호조회, binding만선택/target412·원형보존, 정책/제어 실패, POST불명·원명령복귀, 저장성공후GET실패, CSRF/transport/ABA·옛응답 폐기. 기존 rawref 조합의 임의 성공 가짜 표시0이다.
4. 신규/직접 영향 unit·React 합성 DOM, root typecheck·Web/harness write:false 메모리 build·diff를 수행한다. 실제 소켓/API·DB·권한·키·서비스·Agent0. Main의 사전 이름/owner/수명/정리 등록 전 브라우저/임시파일 QA 생성0이다.
5. Main fresh/독립검토 Critical/Important0 후 정확 변경만 같은 branch에 통합한다. 실제 App route 종단·PG/권한 적용·운영/Agent·사용자 인수는 NOT_RUN이며 전체FN14/계획완료가 아니다.

## 반환
기준WI hash/HEAD·상태·변경diff/hash·정확명령/exit·원RED와보정후결과·오류횟수/중단·미실행·남은선행·live handle/PID/자원0를 보고한다. source 정상revert가 rollback이며 실제자료reset/기존프로젝트차단해제/force/새branch0이다.
