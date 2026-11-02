# FN06 설치형 복구 bootstrap 한정 계약 후보 r1

2026-11-03. **DRAFT / NOT_ADOPTED / SOURCE_GO_0 / EXECUTION_GO_0**. 기존 r5의 명시 복구를 실제 연결하는 데 발견한 입력·보호 조회 공백의 결정 후보다. 작성은 채택/코드 실행 승인이 아니다.

## 1. 정확한 기존·변경점과 권장안

기존 승인 r5 docs/contracts/FN06_DESKTOP_TRUST_ENROLLMENT_OWNER_CANDIDATE_20261102.md SHA F6C8CB668AC371993F0F623AC563583FFD757AFDAAE8D86573A4B71C9A4951E6 §9/10은 비활성 복원→명시 원키/HUMAN 관계 재확인, startup 키/네트워크0, trust-status IO0을 요구한다. 그러나 trust-act의 attemptId는 UUID 필수이고 재시작 빈 owner는 null이다. 기존 Host READ_STATE(null)은 record를 주지 않아 기존 시도에 도달하지 못한다.

**A 권장:** 네 IPC와 출력 state 모양은 유지하고 최초 명시 RESTORE_VERIFY의 attemptId만 null을 허용한다. 이 입력에서만 같은 사용자 보호 root의 현재 origin에 맞는 유일 binding을 읽기 발견한다. 후보0/여럿은 임의 최신 선택 없이 RESTORE_UNAVAILABLE이다. 새 목록·선택 UI/API·일반 root/파일 조회·자동 복원은 만들지 않는다.

기존 r5 exact 입력과 다른 부분은 아래 한 조건이다. 기능 이름이 이미 계획에 있더라도 이 nullable 입력/보호 발견 계약을 r5 승인에서 소급 채택하지 않는다.

- 기존: trust-act {requestId UUID,attemptId UUID,epoch 양의정수,action RESTORE_VERIFY 등}.
- 후보: action=RESTORE_VERIFY 이면서 owner가 비활성/빈 상태이고 원 epoch가 현재일 때에만 attemptId:null을 허용한다. 다른 action의 null은 INPUT_INVALID, 기존 시도와 다른 UUID/옛 epoch는 CONTEXT_CHANGED. 발견 뒤에는 보호 원행의 Main 발급 attemptId만 사용한다. renderer가 새 ID/root/키/원문을 지정하지 않는다.
- 동일 requestId는 정확 원 입력/진행/결과에 결박한다. 동시 요청 효과1, 다른 내용 재사용 거절·포화 BUSY. 거절/불명 뒤 자동 재발견/새 begin·키/발급 우회0.

## 2. 기존 코드 근거

- owner의 빈 state·bindingRecord 부재, trust-act의 현재 attempt 일치 검사가 bootstrap을 막는다. 기존 readonly 상태 조회는 그대로 유지한다.
- DesktopTrustKeyHostSource.cs READ_STATE(null)은 sequence/hash/highWater만 반환하고 record=null이다. 알려진 UUID만 마지막 revision을 얻는다.
- RootSource.Open은 root 부재 시 CreatePrivate를 호출한다. 복구 조회에 그대로 쓰면 원치 않은 root/ACL 생성이므로 existing-only 경로가 필수다.
- Host는 첫 검산된 frame 뒤 root를 여므로, 첫 보호 연산으로 읽기 복구 모드를 선택하고 기존 root만 여는 내부 조립이 가능하다. root·SID·KnownFolder·nonlink/보유handle/권한 검산은 기존 것을 유지한다.
- 현재 createTrustOperation은 온라인 catalogue 검산 뒤 helper를 열며, highWater 갱신/최초 pending 보관 경로가 있다. 이를 startup/복구 조회에 그대로 호출하지 않는다. raw 설치파일 hash/생성자 값만으로 신뢰를 대신하지 않는다.

## 3. 후보의 한정 동작

1. startup·settings 열기·trust-status는 새 보호 IO/키/네트워크0. 사용자가 명시 복구를 클릭한 뒤만 원 요청 총10초·현재 context/epoch/origin/인증/소유 view 아래 고정 catalogue/부모/helper를 검산한다. 기본 보호 공급자 미등록은 UNAVAILABLE이다.
2. 내부 보호 entry에 읽기 bootstrap 목적을 추가한다. 예: READ_RESTORE_CANDIDATE exact {origin}; origin은 main이 현재 연결에서 공급한 정규 HTTPS 값이며 renderer/root/path/사용자ID/임의filter를 받지 않는다. 기존 결과 shape {sequence,containerHash,catalogueHighWater,record}만 사용하고 container/원 rows/시도 목록은 반환하지 않는다. 구체 내부 함수명은 구현 기술 선택이며 계약상 읽기 한정은 바꿀 수 없다.
3. 첫 원 frame/부모/peer/helper/예산 검산 뒤 existing-only root를 연다. root 또는 부모가 없으면 생성·DACL 수리·임시 폴더·새 파일0. 손상·sidecar·불명·원행 소실은 기존 UNKNOWN/거절을 유지하며 previous 자동 채택0이다.
4. 전체 보호 chain/record를 검산한 뒤 각 binding의 마지막 revision을 구하고 현재 고정 origin과 맞는 서로 다른 binding 수를 판정한다.0/여럿·중복/모순·다른 사용자/root·링크/권한/기한 불명은 닫는다. 하나일 때만 그 원 binding/attempt를 private 비활성 후보로 잡는다. 최신 시각/행 순서로 다른 binding을 임의 선택0.
5. 원 metadata를 먼저 renderer로 공개하지 않는다. 원 project/등록 ID가 검산되는 경우 현재 remoteSession의 고정 HUMAN GET으로 같은 프로젝트/등록/installation/키지문·scope/ref/세대·현재 권한/기한을 확인하고 원 pendingKeyId의 PUBLIC을 대조한다. 다른 Anvil 로그인/권한 없음·epoch/계정 ABA는 후보를 활성화/공개하지 않는다. 새 키·SIGN/ISSUE/STORE·bearer status 호출0이다.
6. REGISTERED의 저장 metadata는 원 credentialId/digest와 기존 CREDENTIAL_MATCHES의 읽기 비교로만 대조할 수 있다. 기존 WRITE 이후 메모리 latch를 재시작 권위로 가정하지 않고, 보호 원행에 결박한 읽기 gate를 별도 좁혀 구현한다. token 평문 반환/사용/전송0, use-without-return 구현0이다. 비교 불가·불일치는 복구 성공으로 보고하지 않는다.
7. KEY_PENDING/UNKNOWN 등 미완료 발급은 원 상태/원ID/기한을 보존하며 원키의 명시 PUBLIC 확인 이상으로 새 작업을 재개하지 않는다. 등록 참조가 없거나 불명하면 관계 복구 완료/ISSUE_READY/REGISTERED 승격0. 보호 조회 불명이면 단순 부재로 바꾸거나 새 begin으로 우회0이다.
8. 성공해도 관계 이력의 재확인일 뿐 credential 사용/native 준비/Agent 실행 허가가 아니다. 새 보호 revision/credential/활성 pointer·highWater 파일 쓰기0의 조회 업무로 한정한다. 온라인 현재 head와 기존 highWater의 모순은 거절하고, 읽기 모드에서 새 sequence 관측을 영속 권위 갱신이라고 주장하지 않는다. 신규 privileged 행동은 여전히 별도 현재 검산을 요구한다.
9. 원 최소기한/timer 감소·await 뒤 문맥/원 포트/원 행 검산·자기 child CLOSED_CONFIRMED를 유지한다. 미정착/close 불명은 UNKNOWN·원시도 보존이다. 복구 과정의 CLOSE/epoch 폐기가 새로운 원행·현재 latch를 덮어쓰지 않는다. 부재/실패를 자동 재시도로 해결하지 않는다.

## 4. 예상 소스 범위와 검수

기존8개 후보: apps/desktop/src/trust-enrollment-owner.cjs, policy.cjs, settings.html, settings.js; apps/connector/native/DesktopTrustKeyHostSource.cs, DesktopTrustKeyRootSource.cs; tests/desktop/desktop-trust-registration.test.cjs; tests/native/FN06/DesktopTrustKeyHostSourceTests.cs. 코드 GO 뒤에도 Main이 정확 시작 hash·필수 파일을 고정한 별도 WI/독립검수로 한정한다. 기존 shell/preload/client/Store/ProtectedStore는 가능한 그대로 소비하며 실제 소유 자료는 조사하지 않는다.

핵심 메모리 검증: startup/status IO0·명시 null 예외/다른action null거절·existing root 부재 CreatePrivate0·후보 유일/다중/타origin·원chain/sidecar/불명·키/계정/등록/세대/기한 불일치·HUMAN 권한거절·ABA/늦은응답/최소예산/close불명·원 token 비노출·CREATE/SIGN/ISSUE/STORE0. 실제 C# compile/RunAll·OS/키/권한·DB·서비스·Agent·네트워크·사용자 파일·QA 실행은0이다. 합성 결과를 실제 복구 PASS로 승격하지 않는다.

## 5. 필요한 결정

A의 **초기 RESTORE_VERIFY attemptId:null + 유일 binding의 보호 읽기 발견**을 source-only 기준으로 채택할지 결정한다. 실제 root/키/권한/DB/서비스/Agent 실행 승인은 포함하지 않는다. 미채택 동안 해당 bootstrap 코드는 작성하지 않고, 독립적으로 진행 가능한 기존 승인 소스 업무를 계속한다.
