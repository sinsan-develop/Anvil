# FN06 OPEN 이후 HUMAN 보호 current A안 후보

상태: DRAFT / NOT_ADOPTED / SOURCE_GO0. 2026-11-05 Main 어울.
PMO turn 01a1aa04-5b31-7203-857f-5fd6701d9db6는 A 방향의 후보 준비에 이견이 없다고 했으며 공개 delta를 채택한 것은 아니다.

## 1. 이미 승인된 것과 이번 변경
- 부모 첫수신 패킷: 682A51DACA51FAD9525B4DB34AB62DCDD99B0D5DC63A2B1BCA1ACC211F2CA24E.
- 부모 wire: 6D1A727FB60298C4ADCC37CE5066B4032F144E6F42B8A0B74F023D8AF56E83F4. 기존 phase별 proof·target·null 표와 STREAM typed signer는 이미 승인된 미구현이다.
- wire의 signing-current 상세는 OPEN 전용이다. 기존 GET의 허용 상태를 조용히 넓히거나 OPEN current를 STREAM용으로 복제하지 않는다.
- 이번 후보는 원 HUMAN 인증의 별도 보호 읽기와 phase current 응답·typed frame의 새 current 분기만 제안한다. receive-only bearer의 읽기 권한은 추가하지 않는다.
- 기존 OPEN GET·서명과 기존 SIGN_PROOF/SIGN_NATIVE_PREPARATION_PROOF는 보존한다. ACK 입력 delta와 실제 실행 승인은 포함하지 않는다.

## 2. 새 보호 읽기
`POST /api/v1/projects/:projectId/native-receive-windows/:windowId/phase-signing-current`
- query0, 원 HUMAN cookie/session과 기존 CSRF를 사용한다. receive-only/native/status-only bearer나 혼합 인증으로 호출하지 않는다.
- exact body: `{schemaVersion:1,receiveSessionRef:Ref,challengeRef:Ref}`. 두 Ref는 version1이며 추가키·중복키·잘못된 타입/UTF8을 거절한다. phase·current·actor·SID·키·비밀을 입력하지 않는다.
- phase와 모든 원 tuple은 실제 Challenge·Session·Window에서 결정한다. 요청한 두 fullref/hash와 원 Window 결박이 모두 같아야 한다.
- 이 권한은 HUMAN의 한정 읽기다. 저장된 credential digest를 읽어 bearer 소지 증명으로 전용하거나 native actor/검증된 phase proof를 만들지 않는다. 실제 행의 current 조건만 별도 읽기 목적에서 검산한다.
- 현재 설치·로그인·원 auth SID/user/client/세대, OWNER/member·단독 controller와 명시 `readNativePreparationAuthority` AUTO·유효기한을 검사한다. DENY와 REQUIRE_APPROVAL은 거절한다. 실제 정책은 부여하지 않는다.
- 고정 역사 GET의 다른 SID 예외를 이 새 fresh 읽기로 가져오지 않는다. 원 SID가 바뀌면 current를 발행하지 않는다.

## 3. exact 응답
외피는 exact `{window:V<Window>,registration:PhaseRegistrationCurrent,profile:ProfileRead,observedAt:At,expiresAt:At}`다.
```text
PhaseRegistrationCurrent={
 schemaVersion:1,purpose:'NATIVE_FIRST_RECEIVE_PHASE_REGISTRATION_CURRENT',
 installationId:Uuid,projectId:Uuid,
 phase:'STREAM'|'ARM'|'STATE'|'CLOSE',
 headPhase:'OPENED'|'STREAMING'|'OFFERED'|'ARMED'|'BOUND'|'ATTEMPTED',
 windowRef:Ref,receiveSessionRef:Ref,challengeRef:Ref,
 registrationRef:Ref,connectorRef:Ref,
 registrationKind:'HOST_TRUST_REGISTRATION',
 credentialScope:'REGISTRATION_STATUS_ONLY',
 registrationState:'ISSUED',connectorState:'TRUSTED',
 hostPublicKeyFingerprint:Hash,human:Human,authBindingHash:Hash,policyRef:Ref,
 windowWriterHeadRef:Ref,activeWriterHeadRef:Ref,profileRef:Ref,
 bindingRef:Ref|null,authorityRef:Ref|null,deliveryRef:Ref|null,
 observedAt:At,expiresAt:At
}
```
- Window/Session/Challenge와 nullable Binding/Authority/Delivery Ref는 기존 version1 원형이다. 등록/connector/policy/writer/profile Ref는 각 기존 원형을 유지한다.
- `windowWriterHeadRef`는 준비 당시 EMPTY_AT/RECLAIMED_AT의 원 ref다. `activeWriterHeadRef`는 현재 검산한 물리 writer ref다. Window나 원 Native intent를 덮어쓰지 않는다.
- pre-Binding에서 두 writer ref는 같다. BOUND/ATTEMPTED의 STATE에서는 실제 NativeAuthority.scope.writerHeadRef의 RESERVED ref를 검산해 active 값으로 반환한다.
- binding/authority는 BOUND/ATTEMPTED에서 필수, 그 전은 null이다. delivery는 ATTEMPTED에서 필수이며 그 전은 null이다. ref는 실제 행/hash·양방향 closure와 같아야 한다.
- SID 원문·SPKI 원문·nonce·proof·credential·키·원 native command/authority snapshot은 새 응답에 넣지 않는다. 기존 ProfileRead와 CA는 보호된 main 소비에만 사용하고 signing frame/IPC/renderer에 복제하지 않는다.
- 응답은 일시 current 관측이며 저장 버전이나 실행 허가가 아니다. `observedAt`과 `expiresAt`은 외피와 registration에서 같다. 임의 성공 bool로 실제 관측을 대체하지 않는다.

## 4. 첫사용 허용과 실제 current
| phase | 허용 head | 추가 근거 |
|---|---|---|
| STREAM | OPENED | 실제 Session·미점유 stream·원 ISSUED STREAM Challenge |
| ARM | OFFERED | 실제 stream 점유·같은 Offer fullref/commandHash·원 승인/공급자 current |
| STATE | OPENED/STREAMING/OFFERED/ARMED/BOUND/ATTEMPTED | BOUND 이후 실제 Native current와 RESERVED writer, ATTEMPTED의 Delivery 최소기한 |
| CLOSE | OPENED/STREAMING/OFFERED/ARMED | 원 USER_CANCELLED Challenge, Binding/전송 시작 전 |
- 이 표는 기존 phase 첫사용 조건을 확장하지 않는다. native 결과 replay와 CLOSED terminal 예외를 새 signer current 발행으로 전용하지 않는다.
- Challenge는 실제 해당 phase의 아직 소비·거절되지 않은 ticket과 fullref/hash·target에 결박한다. 이 읽기가 challenge나 nonce를 만들거나 ticket을 바꾸지 않는다.
- pre-Binding 재료는 `fn76_receive_open_window`와 실제 session current에서 재사용할 수 있다. 그 helper의 물리 EMPTY/RECLAIMED 검사를 BOUND에 그대로 적용하지 않는다.
- BOUND/ATTEMPTED는 `native_receive_native_material`과 실제 `receiveBoundCurrent/#freshHost`의 근거를 사용한다. 구성 부재·관측 불명은 실패이며 raw SQL이나 선언값으로 current를 참으로 만들지 않는다.

## 5. 기한·크기·효과
- 기존 Window120000ms·Challenge30000ms·Node 처리10000ms를 늘리지 않는다.
- 만료는 원 Window·Session·Challenge·정책·등록·profile·현재 writer·auth idle/absolute·재인증과 원 처리기한의 최소값이다. BOUND 이후 실제 Native current, ATTEMPTED의 Delivery 기한도 최소값에 포함한다.
- 원 DB 시각을 밀리초로 관측하고 모든 await/COMMIT·반환 경계에서 원 actor/session·문맥과 wall/monotonic 최소기한을 재검산한다. 늦거나 역행한 결과를 채택하지 않는다.
- body cap은 기존 control8192B, 구조 깊이64다. HTTP 응답 cap2097152B, profile CA65536 UTF8 B, key-host 외피/payload/개행 전체65536B를 유지한다. CA/ProfileRead 전체를 signing frame에 넣지 않는다.
- 위 새 typed 원형의 최대 frame 계산은 독립 검토에서 확인한다. 상한을 조용히 높이지 않으며 검산 전 이 후보는 확정하지 않는다.
- N/R/L 행·nonce·credential·slot·Offer·ARM·Binding·terminal·승인·명령/receipt/audit를 새로 생산하거나 소비하지 않는다. 기존 인증 처리의 정상 bookkeeping 외 새 저장 효과0이다.
- 새 table·column·policy literal이나 실제 grant는 없다. 필요한 미적용 SQL은 목적 한정 read SD와 private helper뿐이며 raw 앱 권한을 추가하지 않는다.

## 6. typed signer·main 소비
- `SIGN_NATIVE_FIRST_RECEIVE_PROOF`와 기존 PreAuthoritySigningFrame의 외부 키는 유지하되 `current`에 위 새 purpose의 엄격 분기를 추가하는 공개 데이터 delta다.
- OPEN은 기존 current만 받는다. 이번 non-OPEN phase는 새 phase current를 요구한다. 등록된 원 keyId·owner/view/origin/generation/authEpoch/contextEpoch·원 tuple을 검산하고 renderer가 source/current/frame을 주입하지 못하게 한다.
- main이 원 Session receiver와 CSRF로 새 보호 읽기를 수행한다. 반환의 Window/Session/Challenge fullref와 현재 phase, 원 profile·등록·두 writer 근거를 기존 원문과 대조한 비공개 producer만 frame을 만든다.
- ReceiveProof의 phase별 null 표는 바꾸지 않는다. 특히 STATE/CLOSE의 optional ref는 기존대로 null이며 current의 Binding/Delivery 메타데이터를 proof에 채우지 않는다.
- unknown 서명·HTTP 결과에 재서명·자동 재시도·새 nonce/시도 발급0이다. 기존 고정 HUMAN 역사 GET을 통한 결과 확인과 fresh 서명을 구분한다.
- 같은 Challenge의 unknown 서명은 current 새 관측·frame 시각 변경·source/client 객체 교체로 다시 서명하지 않는다. 원 시도와 canonical proof를 보존한다.
- 기존 runtime export8·closure14·builtin3과 local IPC 원형을 보존한다. 새 일반 getter나 raw byte SIGN, 새 키/secret source는 없다.

## 7. 오류·검증
- 기존 INPUT_INVALID/AUTH_REQUIRED/권한·NOT_FOUND/CONTEXT_CHANGED/EXPIRED/SOURCE_UNAVAILABLE 오류 wire를 재사용한다. 내부 SQL·SID·CA·비밀·원문을 오류에 넣지 않는다. 오류나 cap 초과 시 metadata0·SIGN0이다.
- 정상4 phase와 원 SID/actor/client/control·등록/profile/정책·원 fullref·target 오염, 소진/거절 Challenge·CLOSED/terminal·같은 field 다른 hash·시각/기한·source 부재를 반증한다.
- BOUND 이전/이후의 다른 writer ref와 현재 Native 권위·Delivery 기한을 각각 시험한다. 관측으로 원 Window/ref나 command/hash가 바뀌지 않아야 한다.
- 실제 Store/Service/route와 private source·typed builder/C# source validator의 소비선을 합성으로 연결하고 조회의 생산/소비/정산 효과0을 확인한다. 형상/fixture를 실제 SQL·TLS·OS PASS로 승격하지 않는다.
- Source GO 전 독립 검토에서 공개 입력/응답·원 저장 의미·상한·실패/미검증 경계를 닫고 해시를 고정한다. 코드 구현용 정확 파일 allowlist와 TDD 카드는 채택 뒤 작성한다.

## 8. 승인 범위 제안과 제외
채택을 요청할 범위는 위 공개 read/데이터 delta와 기존 승인57 안의 코드·미적용 SQL·합성 검증이다. 새 외부 실행 권한은 요청하지 않는다.
실제 DB 접속/SQL 적용·권한/정책/회원 변경·키/credential 발급·서비스·네트워크·C# 컴파일·Agent/유료 호출·J3/P03 R3·Oracle/운영·Git 복구는 제외한다.
이 후보 준비나 PMO 방향 검토를 채택으로 취급하지 않는다. 기존 GET3·Web 연결과 다른 승인 구현은 별도로 계속한다.

## 9. 독립 검토와 유한 크기 계산
부모 원형과 후보 본문 SHA256 9E40BC11ADCB1A5FE33AFF60C84C6C510A2286420C4370B52131B7303C919B87을 대조한 독립 검토는 후보 한정 C0/I0이다. 이는 채택·구현·실환경 검증이 아니다.
UUID·hash·시각은 부모 고정폭, 일반 Ref는 최대153B, version1 Ref는 최대138B, safe integer는 최대16자리로 계산했다. Window V는 최대1722B, key-host 외피·개행은414B다.
| phase | current 최대 | signing payload 최대 | 외피·개행 포함 최대 |
|---|---:|---:|---:|
| STREAM | 2360B | 7379B | 7793B |
| ARM | 2358B | 8158B | 8572B |
| STATE/ATTEMPTED | 2764B | 7949B | 8363B |
| CLOSE | 2362B | 7573B | 7987B |
POST body의 typed 최대는332B이며 기존 control8192B와 key-host 전체65536B를 높이지 않는다. CA/ProfileRead는 signing frame 계산에서 제외한다.
ProfileRead의 origin/serverName에는 개별 길이 상한이 없으므로 위 frame 수치를 전체 HTTP 응답의 최대량으로 주장하지 않는다. 전체 응답에는 별도의2097152B 강제 cap을 적용하고 초과 시 metadata0·SIGN0으로 거절한다.
§4의 native_receive_native_material/receiveBoundCurrent는 검산 근거를 재사용한다는 뜻이다. HUMAN 읽기에 digest나 proof lease를 만들어 넣지 않는다. 정책과 물리 검산의 목적 한정 내부 접합만 허용한다.
상태는 계속 DRAFT/NOT_ADOPTED/SOURCE_GO0이다. 정확한 공개 입력·응답·typed current 분기는 직접 채택 전 구현하지 않는다.
