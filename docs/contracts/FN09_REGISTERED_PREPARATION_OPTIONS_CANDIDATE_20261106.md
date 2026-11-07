# FN09 등록 정의 실행 준비·옵션 원문 보관 계약 후보

상태: DRAFT r2 / NOT_ADOPTED / SOURCE_GO0.
2026-11-06 Main 어울. 기준 codex/av3-stage-b / a7a5bfd480dd182a9c83636f8efc05ed26e7c4f8.
이 문서는 source-only 보완의 검토안이며 구현·실제 실행 승인이 아니다.

## 1. 기존 승인과 필요한 차이

등록 정의 예약 A 후보 SHA256 81E87C515C35D3689859C15259B464238F4B0BDBE10DDC6AAB21D848A11DD759 §4와 구현 WI SHA256 4DA9F311ABCCE98FB1E9D052D3A39B8B453753FBFE691DE5D433A8B8474131C1은 prepareExecution 후속 확장을 명시 제외했다. 현재 등록 정의 거절은 버그가 아니다. 기존 예약·후보 준비·일회 승인·native 준비를 다시 승인 대기로 바꾸지 않는다.

이번 차이는 이미 선택·등록한 도구와 환경을 준비 근거로 사용하고, 정의의 닫힌 모델 데이터를 불변 준비 원문에 저장하는 지원이다. 새 입력 분기·준비 snapshot·목적 조회·저장량 계상의 의미가 추가된다. 새 표·범용 파일 업로드·새 일반 원문 API·Agent 호출 권위는 추가하지 않는다.

A 권장: 아래 한정 분기를 코드·화면·미적용 forward SQL·합성 검증으로 구현한다.
B: 기존 후보 전용 준비만 유지하고 등록 도구의 준비·Options 원문 공급은 미구현으로 남긴다.

## 2. 입력과 기존 동작

기존 prepareExecution intent exact11은 그대로 후보 전용이다. 등록 분기만 기존11필드에 다음2를 더한 exact13으로 구분한다.

- connectionKind: REGISTERED_DEFINITION
- optionsFormat: CLAUDE_QUERY_DATA_V1

connectionRef/environmentRef는 원 등록 정의·환경의 fullref다. UUID가 같은 후보를 대신 읽지 않는다. 명시 null·미지원 format·추가키·누락·혼합 분기는 거절한다. 바깥 원 commandId/operationId/project/client/controlGeneration·targetId:null·expectedVersion:0·baselineRefs:[]는 기존 계약을 유지한다.

등록 분기에서 원 binding의 connectionKind·동일 connectionRef·RESERVED·외부 handle null·실행 false, 현재 role binding head와 원 assignment/context 관계를 검산한다. 같은 PoolClient와 현재 HUMAN actor로 원 ConnectionDefinition/EnvironmentVersion의 보호 reader·원 command/receipt/audit/hash와 현재 head·환경 configurationCurrentness를 검사한다. definition.environmentRef는 입력 환경 fullref와 정확히 같아야 한다. 다른 프로젝트·회원·client·세대·정책·기한·원 scope는 기존 guard로 거절한다.

## 3. Options 원문

원 불변 definition.modelOptions가 아래 닫힌 데이터인 경우에만 선택한다.

{claudeQueryParams:{model:string,maxTurns?:number,maxBudgetUsd?:number}}

model은 필수·정상 UTF-16·공백만 아님·1~200문자·제어문자 없음이다. auto 등 alias를 임의 블랙리스트하지 않는다. maxTurns는 지정 시 양의 safe integer, maxBudgetUsd는 0 이상 MAX_SAFE_INTEGER 이하 finite number다. 누락은 기본값을 채우지 않고 null·추가키·중복키·오염 원형·불량 UTF-8은 거절한다. 기존 parser의 닫힌 데이터 의미를 유지한다.

고정 대응 후보는 optionsFormat:CLAUDE_QUERY_DATA_V1, adapterKind:CLAUDE_AGENT_SDK, toolProduct:Claude Code의 exact 조합이다. 이 대응값은 새 채택 후보이며 기존 enum이라고 주장하지 않는다. 다른 조합·alias·대소문자/공백 정규화·기존 정의 자동 변환은 거절한다. toolVersion은 원값을 보존하고 실제 SDK 지원 증거로 쓰지 않는다.

이 format 선택은 Claude 실행 도구의 실제 지원·등록·모델 유효성·비용 허가를 증명하지 않는다. SDK maxTurns는 Anvil 호출 횟수와 다르고 maxBudgetUsd는 비용 예약이나 청구 상한 보장이 아니다. 환경 program/argsTemplate/secretSlots·계정·경로를 SDK 인자로 추정하지 않는다. sessionId/resume/fork·permission/tools·실행파일/cwd/env·hooks·일반 SDK Options는 넣지 못한다.

body는 위 데이터의 canonical JSON 문자열이다. utf8Bytes와 contentHash는 그 문자열의 실제 UTF-8 bytes 길이/SHA256이며 전체 snapshot hash와 구분한다. 새 Options UUID나 artifact ref를 만들어 내지 않는다.

## 4. 불변 snapshot과 실제 참조

기존 후보 snapshot exact9는 보존한다. 등록 분기만 options 한 필드를 더한 exact10이다.

options는 exact {format,mediaType,body,utf8Bytes,contentHash}다.
format은 CLAUDE_QUERY_DATA_V1, mediaType은 application/json이다. 원 definition/environment refs는 snapshot.intent에서 읽고 중복 선언하지 않는다.

전체 snapshot의 기존 canonical 2MiB 상한을 늘리지 않는다. body의 JSON escaping·나머지 metadata를 포함해 계산한다. preparationId를 생성한 뒤 snapshot에는 자기 preparationRef/optionsRef를 넣지 않고 전체 snapshot hash로 기존 실제 preparationRef를 만든다.

후행 optionsRef는 이 실제 preparationRef를 가리키는 목적 참조다. 목적 reader는 등록 준비 exact10·원 closure를 검산한 뒤 options.body만 추출한다. 기존 준비 ref를 bytes SHA로 바꾸거나 id/version을 추정하지 않는다. 이 목적 해석은 이번 새 계약이며 기존 START resolver가 이미 지원한다고 주장하지 않는다.

같은 원 Tx에서 command 결과 snapshot·준비1행·receipt·APPLIED audit·필요한 일회 승인 소비·저장량 정산을 원자 결박한다. 기존 version1·명령당 준비1행·UPDATE/DELETE 금지·assignment/binding/context FK를 보존한다. 기존 migration을 고치지 않고 새 forward guard만 작성한다. candidate와 registered 분기의 exact 형상·canonical body/bytes/hash·원 definition 도출·원 receipt 동일성을 양방향 검산한다.

## 5. 준비와 실행 권위 구분

capabilityRef/budgetPolicyRef는 기존 intent의 입력 참조로 보존한다. 이번 보완은 실제 능력 보고 지원·예산 정책 공급자·비용 예약을 완성하지 않는다. 다음 공통 미검증 사유를 유지한다.

- RESPONSIBLE_SESSION_RESERVED
- CAPABILITY_UNVERIFIED
- BUDGET_POLICY_UNVERIFIED
- SOURCE_AUTHORIZATION_UNVERIFIED
- HOST_OS_FENCE_UNVERIFIED

기존 후보 분기의 CONNECTION_CANDIDATE_ONLY/ENVIRONMENT_CANDIDATE_ONLY는 그대로다. 등록 분기에는 별도 고정 준비 사유 CONNECTION_DEFINITION_ONLY/ENVIRONMENT_DEFINITION_ONLY를 사용한다. 이것은 등록 설정·현재성만 읽었다는 뜻이며 실행 적격성이나 연결 성공이 아니다. 기존 context/latest instruction/WORK·이해검토 조건도 계속 검산한다.

authorizationState:NOT_AUTHORIZED, executionAuthorized:false, dispatchPerformed:false를 유지한다. HUMAN 능력 보고의 CONFIRMED를 effectiveForExecution으로 바꾸지 않는다. source 준비 성공만으로 실제 permit·보호 process·SDK permission·writer·START·Agent 실행을 허용하지 않는다.

## 6. 일회 승인과 replay

원 intent exact13 전체를 기존 승인 후보의 payloadHash와 원 candidateCommandId에 결박한다. actor/client/원 SID·제어세대·정책·기한·원 command/대상/정확 버전과 한 번 소비를 유지한다. 기존 actionScope의 operation/targetRef:null/expectedVersion:0/baselineRefs:[]/environmentRef:null/sourceScopes:[]/limitsRef:null을 유지한다. actionScope.environmentRef:null은 payload의 실제 environmentRef를 삭제한다는 뜻이 아니다.

고정 definition fullref와 optionsFormat에서 원 body가 정확 도출돼야 한다. 승인 후보에 body를 별도 복제하지 않는다. format 변경은 다른 원 payload이며 기존 승인을 재사용하지 않는다.

동일 원 command replay는 저장 결과·원 body·원 ref·영수증만 재구성한다. 최신 modelOptions로 다시 compile하거나 source·승인 소비·저장량을 추가하지 않는다. COMMIT/응답 불명은 UNKNOWN으로 원 command/body·예약을 보존하고 새 ID·자동 재시도·자동 해제하지 않는다.

## 7. 저장량과 동일 Tx

A 권장 계상은 기존 FN75형 canonical-pair 방식이다. 여기서 C75는 해당 방식과 같은 canonical JSON·고정 타입 변환·UTF-8 길이 규칙으로 실제 저장 열을 계상하는 논리 비용 함수다. 물리 디스크 bytes라고 주장하지 않는다. TS와 SQL의 동일 원형/비용을 검수하며 미정 driver 문자열화나 임의 배수를 사용하지 않는다. 대체 B는 FN15형 tagged fixed-width 방식으로 자기 금액 계산은 단순하지만 비용 단위를 새로 혼합하는 위험이 있다. A를 권장한다.

새 임의 상한이나 무료 저장 예외를 만들지 않는다. 기존 프로젝트 10GiB·bigint 범위와 원 VERIFIED coverage를 유지한다. 기존 prepareExecution bytes를 이미 계상한다고 가정하지 않는다.

기존 예약표의 고정 part.kind:PREPARATION_OPTIONS, key:registered_options, id:실제 preparationId를 제안한다. kind 자체가 PREPARE_EXECUTION_REGISTERED_OPTIONS_V1 목적을 나타내므로 별도 caller 선택 purpose 필드는 추가하지 않는다. 원 commandHash와 기존 plan 외피·parts1·coverageGeneration·reservation id/start_fence/receipt facts를 결박한다. 기존 exact plan 외피의 등록 분기에만 canonicalPairs:{preparationSnapshot,resultRef} 두 원 canonical 문자열을 추가한다. JSONB와 parse 동일성·원 hash를 검산한다.

실제 계상 집합은 아래 P/C/A/U/K/R로 고정한다. 각 행의 실제 저장 열 전체를 C75로 산입하며 allowlist 밖 행을 임의 더하거나 누락하지 않는다.

- P: 원 execution_preparations 1행.
- C: 같은 원 commands 1행의 전체 저장 결과.
- A: C.authorization_receipt_id의 authorization receipt 1행.
- U: 같은 command/project의 APPLIED·correction_of null audit 1행.
- K: 원 approval_consumption_id의 소비 1행 또는 0행.
- R: 같은 actor/client/external command·고정 part/plan에 결박된 예약 자기 1행.

정의/환경/context 원행·다른 command·START·가짜 Options 행은 제외한다. P와 C에 실제 중복 저장된 body는 각 한 번 산입한다. virtual canonical pair를 P/C의 실제 text 열로 더하지 않는다. 다만 R.plan_json에 실제 복사된 두 문자열은 R 비용에 포함한다.

commandHash=H(원 command), planHash=H(plan에서 planHash만 제외), part.contentHash=H(전체 준비 snapshot)이다. id/ref·원문·UUID/hash/시각 등은 봉인 전에 고정하며 원문을 최신값으로 재구성하지 않는다. DB가 최종 생성하는 값도 기존 고정 타입 폭의 상계로 예약하고 최종 실제값으로 검산한다.

같은 원 PoolClient에서 원 SID/actor/client·제어·정책·정의/환경 보호조회·coverage와 project/account 잠금을 확인한 뒤 reserve→원 command/receipt/audit/승인소비·준비 저장→실제 비용 재검산→settle 순서다. 기존 reserve(token,csrf)의 별도 authenticated Tx를 중첩하지 않는다. 새 내부 db/actor 예약·정산 접점으로만 수행한다.

Bmax는 P/C/A/U/K의 고정 형상 최대 비용과 승인 공유행의 검산된 변화량 상계의 합이다. 상계는 기존 검증된 입력과 타입의 유한 폭에서 산출하고 모르는 값은 무료나 무한대신 임의 숫자로 대체하지 않는다. RESERVED/IO_STARTED/SETTLED 각 phase의 예약 자기 projection을 Rphase로 두면 예약액 r은 다음 최소 고정점이다.

x0=Bmax
xn+1=max(xn, Bmax+maxphase C75(Rphase(xn)))
r=최소 고정점

금액 위치에 x를 대입하며 증가 가능한 가변 길이는 기존 유한 decimal 자릿수뿐이다. 같은 자릿수에서 길이가 고정되므로 유한하게 정착한다. 기존 bigint/10GiB를 넘거나 원형 상계를 입증할 수 없으면 저장을 거절한다. 새 반복 허용 횟수·금액 상한을 만들지 않는다. 봉인한 plan과 r은 정산액으로 다시 쓰지 않는다.

Bactual은 실제 P/C/A/U/K 비용과 승인 공유행의 검산된 전후 비용 차분을 한 번 포함한 값이다. 최종 정산액 y도 다음 최소 고정점으로 검산한다.

y0=Bactual
yn+1=max(yn, Bactual+C75(Rsettled(r,yn)))
y=최소 고정점, 0<=y<=r

승인 공유행 차분을 used에 별도로 다시 더하지 않는다. 기존 part.settledBytes 확정액 요구는 이 목적에서만 원 상계와 최종 R.settled_bytes 검산으로 구분한다. 원 plan을 y로 재봉인하지 않아 hash 순환이 없다.

승인 요청·결정·후보·그 생성 command/receipt/audit 최초 비용은 해당 생성 command에 귀속한다. 준비는 새 K와 소비로 바뀐 공유행의 비용 차분만 소유한다. 최초 비용의 실제 예약/collector 귀속 proof가 없으면 무료로 간주하지 않고 거절한다. 그 기존 승인 producer의 proof 연결은 REQUIRE_APPROVAL 완료의 필수 선행이며 없는 상태를 완료로 보고하지 않는다. 기존 미계상 원장을 준비 비용으로 덮거나 coverage를 올리지 않는다.

beforeUsed는 기존 SETTLED 합+FN15.actual+FN75.actual+FN76.actual, beforeHeld는 기존 미정착 예약 합+대응 future와 원 계정을 대조한다. 새 목적은 기존 reservation SETTLED/held 합에 한 번만 포함하고 별도 Options subtotal을 더하지 않는다. reserve는 held+=r, settle은 held-=r 및 used+=y다. deferred complete는 P/C/A/U/K/R·승인·계정을 양방향 검산한다.

명확한 실패는 같은 Tx 전체 rollback이며 예약만 따로 COMMIT하지 않는다. COMMIT/응답 불명은 원 command·결과·예약의 실제 정착을 추측하지 않고 UNKNOWN으로 보존한다. 자동 새 ID·재승인·재전송·hold 삭제는 없다. 과거 후보 준비는 새 의미로 소급 변환하지 않는다.

## 8. 화면·조회·후행 의존

기존 업무 실행 준비 화면에서 등록 도구·환경의 기존 보호 조회로 검산된 선택을 사용한다. 임의 UUID 입력이나 수동 Options 파일 업로드를 요구하지 않는다. 준비 저장→정확 원명령 승인 요청·결정→명시 재개→receipt→고정 준비 재조회로 연결한다. 늦은 응답·선택 변경·주체/프로젝트/제어세대 변경 시 이전 승인 설명과 전송을 차단한다.

화면에는 등록 설정을 읽은 준비, 미확인 능력/예산/권한/OS, 실제 실행되지 않음을 구분한다. 저장 후 GET 실패는 receipt를 보존하고 새 POST를 하지 않는다. 새 등록 분기의 Options body는 기존 회원 조회만으로 공개하지 않는다. 저장 반환·동일 command replay·단일 GET·state/page 집계의 전체 snapshot 반환 전에 원 definition/environment 보호 읽기를 같은 db/actor로 검산한다. definition 기본 authorize=true의 readConnectionDefinition 정책과 환경 OWNER/readEnvironmentVersion 정책·승인미연결 거절을 그대로 유지한다. 실패 시 해당 응답 전체를 거절하고 body·부분 결과·이전 원문을 반환하지 않는다. 기존 후보 exact9 조회의 권한·응답은 바꾸지 않는다.

단일 GET을 소비하는 state/page는 preparations.read에서 이 검사를 공유한다. 기존 ProjectPolicyRepository.command의 projectReplay는 material callback보다 먼저 반환하므로 같은 Tx의 목적 한정 replay 검산 hook을 추가하고 route가 실제 준비 verifier를 연결한다. 새 Pool·중첩 authenticated·UI 숨김으로 대체하지 않는다. verifier는 저장 준비/replay 원형·원 closure/hash를 먼저 검산한다. 역사 조회의 접근 검사와 최초 저장의 current head 검사를 구분하고 역사 body를 최신 옵션으로 재컴파일하지 않는다. 원 NOT_FOUND·정책·승인미연결·무결성 오류를 보존한다.

executor 원문 접근은 이 HUMAN 권한으로 허용하지 않는다. 기존 material 내부 목적 reader를 연결하더라도 별도 실행 grant·현재 세대·원 START/envelope/등록된 payload refs·자료 권한을 검산해야 한다. 실제 executor 권위 공급과 활성화는 이번 구현에서 제외한다.

FN08 START 등록 후보 8AE16D6CAB5334FAC4548688777AE44560997BB0D0C78816CB340A114A7E4384는 별도 미채택 의존이다. 이번 준비 source를 저장해도 START descriptor/원문 부분 조회·SDK 최초 Query·Agent 실행은 완료되지 않는다.

## 9. 검수와 제외

합성 검수는 실제 기존 클래스·입력/승인·화면 소비를 연결한다. 정상 후보 회귀와 등록 definition/environment→닫힌 body→원자 저장→보호 재조회/replay를 확인한다. 교차 프로젝트/회원/client·옛 세대·잘못된 종류/head/정책·환경 불일치·원문/bytes/hash 변조·추가 옵션·다른 명령/format 승인 재사용·만료·quota 부족/불명·부분 저장·receipt/audit/승인 소비 누락은 거절해야 한다.

기존 기대값·한도·권한 검사 완화와 SDK 성공 대역 주입으로 미검증을 지우는 것은 금지한다. 시작/완료 hash·정확 허용 파일·TDD RED→GREEN·독립 검수·Main fresh 검증은 채택 후 WI에서 고정한다.

코드·화면·미적용 SQL·합성 검증만 후보 범위다. 실제 DB/SQL 적용·권한/정책 부여·키·서비스·SDK/Agent 실행·원자료/백업 조사·P03 R3/J3·기존 프로젝트 차단 해제는 제외한다. 전체 FN07/FN09 또는 계획 완료가 아니다.
