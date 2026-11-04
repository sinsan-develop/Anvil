# FN06 같은-client 최초 수신 source 구현 후보

**IMPLEMENTATION_CANDIDATE / NOT_ADOPTED / SOURCE_GO0 / EXECUTION_GO0**

이 문서는 새 wire·인증·저장 계약이 source-only로 채택될 경우 기존 Primary 한 명에게 전달할 구현 후보이며, 지금 코드/시험/SQL을 쓰도록 허가하지 않는다. Main은 설계·검수·통합·Git·현황을 소유하고 담당자는 승인된 source 범위만 쓴다. 다른 담당자의 변경·보호 자료를 되돌리지 않는다. 새 branch/worktree/agent·runtime 의존성·실제 실행을 시작하지 않는다.

## 1. 기준·완료 범위

- wire: `docs/contracts/FN06_NATIVE_FIRST_RECEIVE_WIRE_PROPOSAL_20261104.md`, 부모 bfb77f2ff11211428f863836f04aa265efe07ff79a0c0b8da26e11ca1cd23762 → I3 보완 fec6d8917af33125ccec1170766695b832dd90af26a905074790e03b376416c7. 기존 authority.subject.humanSessionId는 동일 원 main의 보호 Delivery 안에서만 명시 예외이며 새 일반 Web/IPC/OPEN metadata에는 추가하지 않는다.
- 계상: `docs/contracts/FN06_NATIVE_FIRST_RECEIVE_ACCOUNTING_PROPOSAL_20261104.md`의 2A6A325BF749231CF66917C04CA56E933EF2F9A33E0870EF6C70D25C689E3C5E 부모 제출본 → profile 두 표/공유 FK·Q_revoke 보완 103E6A173AFD121280CB5BE4D245452196CEBB54D691E8D0D39D028EAD80F4BA(68810B)는 별도 작성자 소유다. ACK 원문=wire SlotReceipt/candidateRef=slotReceipt.ref, 공개 ACK_RECORD wrapper0으로 양쪽 작성자가 정합했다. 위 후속 hash는 문서 간 재귀 hash로 다시 계산하지 않고 Main이 단일 채택 binding에 함께 고정한다. 이 후보가 미제출 hash를 추정하지 않는다.
- 작성 중 읽은 HEAD는 2540f6b201dcb9c4f07427e86bcca6c5634b22a1이다. 구현 착수의 실제 exact HEAD·기존파일 raw hash·신규부재·0076 충돌은 Main의 최종 WI/승인 binding에서 다시 고정한다. 작성 시점 HEAD를 후행 실행 승인으로 쓰지 않는다.
- 대상은 같은 main 소유 `persist:anvil-web` remoteSession의 WebContentsView에서 원 HUMAN 명령을 작성·승인·POST하고, local trust UI가 한 번 수신 준비·ARM하는 흐름이다. localSession은 HUMAN fetch의 receiver가 아니다. 별도 Chrome/다른 기기·mobile·교차-client·지속 prelisten은 후속 미완료다.
- source 완료 후보는 보호 profile/원 등록 current → OPEN → STREAM → hosted Web의 원 명령/승인과 offer → ARM → 원 native Tx binding → ATTEMPTED 확정 → 단발 frame → 실제 slot 검산 → ACK 후보/원 후행 Tx → 보호 역사조회까지 연결된 상태다. callback 등록·타입/파일 존재·전부 mock 성공으로 대체하지 않는다. 실 PG/RLS/TLS/native host/브라우저·제품 실행 인수는 별도 NOT_RUN이다.

## 2. 정확 파일 허용목록 후보

아래 목록만 source-only 채택 대상으로 제안한다. 기존 파일은 필요한 접합만 수정하며 통째 재작성하지 않는다. 새 파일은 제안 이름으로서 아직 생성하지 않는다. 최종 source GO에는 이 목록·계약 hash·기준 HEAD를 함께 고정해야 한다.

### 2.1 신규 제품/source 파일

1. `contracts/runtime/native-first-receive-v1.ts` — wire exact 원형/null표/phase·canonical 외피·typed 최대폭.
2. `apps/server/modules/executions/native-first-receive-input.ts` — HTTP/offer 전용 strict parser·typed proof/고정오류.
3. `apps/server/modules/executions/native-first-receive-store.ts` — 실제 R/head/ticket/registry/reservation·FK/CAS/양방향 완결·계상 SQL 소비.
4. `apps/server/modules/executions/native-first-receive-profile.ts` — project별 보호 profile 원장 reader/publisher 검산·원 등록 pre-authority current 관측.
5. `apps/server/modules/executions/native-first-receive-service.ts` — HUMAN 세 연산/OPEN·phase·단일 broker/실제 supplier·원 native Tx 접합·비공개 ACK waiter·조립.
6. `apps/server/modules/executions/native-first-receive-routes.ts` — HUMAN/native 경로별 exact 인증/취소/응답·Offer route-local bodyLimit.
7. `apps/connector/runtime/native-first-receive-client.ts` — 고정 HTTPS bootstrap/stream frame·새 receive credential 메모리·기존 slot 수용/current 검산·typed ACK 조립.
8. `apps/desktop/src/native-first-receive-client.cjs` — 원 remoteSession의 HUMAN profile/CSRF/current·단일 로컬 시도/controller·원문/시도 보존.
9. `scripts/publish-native-channel-profile.ts` — 보호 publisher의 plan/검산/실제 DB adapter source. default/import/plan 효과0, 실제 publish/revoke는 이번 권한0.
10. `db/migrations/0076_native_first_receive.sql.pending` — receive/계상/profile 신규 표와 필요한 최종 collector forward. 과거 SQL 원문 변경0. 번호 충돌이 있으면 쓰기 전에 Main에 반환한다.

### 2.2 기존 제품/source 최소 접합

- `apps/server/app.ts` — 신규 route와 typed 준비 service를 실제 등록. 기존 optional/native route 동작 보존.
- `apps/server/main.ts` — 기존 AccessRepository/Pool 수명 안에 새 store/profile/broker/current·supplier를 명시 조립. 기존 TLS/host/port/service 동작 유지.
- `apps/server/modules/access/project-command.ts` — 신규 세 HUMAN operation·세 read 정책 literal/영수증 접점. 기존 다른 연산의 권한/상한·거절 경로 불변.
- `apps/server/modules/connections/project-registration-reads.ts` — 원 잠금 row에서 정확 HOST_TRUST_REGISTRATION·REGISTRATION_STATUS_ONLY/원 session·설치 결박을 읽는 목적 한정 내부 관측. 기존 공개 등록 reader 완화0.
- `apps/server/modules/executions/project-native-preparations.ts` — ARM 전검산·원 native 동일 Tx Binding/선예약·ATTEMPTED/후행 ACK 원 operation 소유. legacy header 생략 경로 보존.
- `apps/server/modules/executions/native-preparation-routes.ts` — 새 ARM header를 exact 검산해 별도 포트로 전달. 원 command body/hash 변경0.
- `apps/server/modules/executions/native-preparation-current-source.ts` — 기존 실제 current/mapping 공급과 새 profile/receive의 같은 DB·actor/client/session·원 lease 결박. 기존 SUPPORT/current=false 거절을 우회하지 않는다.
- `apps/server/modules/executions/native-preparation-store.ts` — 현재 native capacity와 신규 native 미래예약/receive 공유계상 소비. actual만 더해 예약을 누락하지 않는다.
- `apps/connector/runtime/native-preparation-https.ts` — 기존 고정 HTTPS driver/TLS 검산 내부의 최소 재사용 접점만 노출. authority 선행 constructor와 원 current/challenge/consume를 bootstrap으로 바꾸지 않는다.
- `apps/desktop/src/trust-enrollment-owner.cjs` — REGISTERED 설치 binding에 대한 새 pre-authority source/typed signing method. 원 authority-dependent createNativeProofSource와 SIGN 목적은 보존.
- `apps/desktop/src/trust-key-host-client.cjs` — 신규 typed operation의 제한된 frame builder/응답 검산. 범용 SIGN/raw bytes 포트0.
- `apps/connector/native/DesktopTrustKeyHostSource.cs` — 새 SIGN_NATIVE_FIRST_RECEIVE_PROOF의 목적·phase·target·current·owner 검산. 원 SIGN_PROOF/SIGN_NATIVE_PREPARATION_PROOF 변경0.
- `apps/desktop/src/shell.cjs` — 원 main Session/view/origin/generation/authEpoch/current와 신규 IPC/controller를 연결. remote/local Session 혼동0.
- `apps/desktop/src/preload.cjs` — local trust UI의 신규 exact IPC만 노출. remoteWeb에 cookie/키/credential/frame getter0.
- `apps/desktop/src/policy.cjs` — sender·epoch·exact IPC 키/enum 검산.
- `apps/desktop/src/settings.html` — 명시 시작/고정 offer 확인·ARM/상태/종료 UI, 원 등록 화면 보존.
- `apps/desktop/src/settings.js` — 실제 새 IPC 호출/늦은 결과·UNKNOWN 시도 보존. UI 버튼만 추가하고 callback을 비워두지 않는다.
- `apps/desktop/scripts/native-proof-runtime-entry.mts` — 새 receive runtime export의 실제 조립.
- `apps/desktop/scripts/native-proof-runtime-build.cjs` — 신규 source closure/출력 manifest 검산·별도 native anchor package 자료의 hash 결박. catalogue를 native 권위로 전용하지 않는다.
- `apps/web/src/features/connections/native-boundary-preparation-api.ts` — 보호 window/offer/ARM ref·새 header·기존 최종 command/승인 hash 및 UNKNOWN buffer 보존.
- `apps/web/src/features/connections/NativeBoundaryPreparationPanel.tsx` — 기존 작성·승인·POST 흐름에서 명시 원 window 선택/offer/ARM 확인 연결. local main 대신 command 발행0.
- `apps/web/src/features/connections/policy-editor-profile.ts` — 신규 정확 operation/read literal의 기존 OWNER 명시 AUTO/DENY 생산. 실제 정책 부여0.
- `.gitattributes` — 기존 bytes/규칙을 보존하고 `db/migrations/0076_native_first_receive.sql.pending text eol=lf` 한 줄만 추가. glob/renormalize/Git 설정 변경0.

AccessRepository의 인증/session/Tx 전반, 공용 canonical, 기존 일곱 USER_COMMON, UI02 codec·저장·사본, 기존 SQL·index·실 QA driver는 허용 대상이 아니다. 부득이한 추가 파일은 정확 호출선과 최소 delta를 쓰기 전에 Main에 반환한다.

### 2.3 신규 시험 파일

- `tests/unit/FN06/native-first-receive-contract.test.ts`
- `tests/unit/FN06/native-first-receive-profile.test.ts`
- `tests/unit/FN06/native-first-receive-store.test.ts`
- `tests/unit/FN06/native-first-receive-routes.test.ts`
- `tests/unit/FN06/native-first-receive-client.test.ts`
- `tests/unit/FN06/native-first-receive-schema.test.ts`
- `tests/desktop/native-first-receive-owner.test.cjs`
- `tests/unit/UI11/native-first-receive-flow.test.ts`
- `tests/native/FN06/NativeFirstReceiveHostSourceTests.cs` — native 실행/compile은 NOT_RUN이며 기존 source 검사 방식만 허용.

직접 영향 기존 시험의 최소 추가는 다음 exact 경로에 한정한다.

- `tests/unit/FN06/native-preparation-authority-contract.test.ts`
- `tests/unit/FN06/native-preparation-store.test.ts`
- `tests/unit/FN06/native-preparation-routes.test.ts`
- `tests/unit/FN06/native-preparation-current-source.test.ts`
- `tests/unit/FN06/native-preparation-https.test.ts`
- `tests/unit/FN06/native-preparation-credential-slot.test.ts`
- `tests/unit/FN06/native-preparation-owner-host.test.ts`
- `tests/unit/UI11/native-boundary-preparation.test.ts`
- `tests/unit/UI11/native-boundary-preparation-app.test.ts`
- `tests/desktop/desktop-trust-owner.test.cjs`
- `tests/desktop/desktop-trust-registration.test.cjs`
- `tests/desktop/shell-policy.test.cjs`
- `tests/desktop/native-proof-runtime-build.test.cjs`
- `tests/native/FN06/DesktopTrustKeyHostSourceTests.cs`
기존 보안/기대값 삭제·일반 성공 대역·skip로 통과시키지 않는다.

## 3. profile의 실제 보호 DB원장·publisher 보완 후보

이 절은 새 저장·발급/회수 권위의 명시 후보다. 파일/메모리 provider를 SQL FK 대상이라고 가정하지 않는다. 공개 NativeChannelProfile/ProfileHead 원형과 hash는 wire대로 유지하며 project_id는 아래 private 저장 소유열이다. 같은 설치의 project별 head를 보호 publisher가 명시 관리한다. HUMAN/Agent가 project를 만들었다는 이유로 profile을 자동 발급/활성화하지 않는다.

### 3.1 정확 두 표와 불변 이력

`anvil.native_channel_profile_versions`:

```text
project_id uuid NOT NULL, installation_id uuid NOT NULL,
record_kind text NOT NULL, id uuid NOT NULL, version bigint NOT NULL,
content_hash text NOT NULL, profile_id uuid NOT NULL,
profile_version bigint NOT NULL, profile_content_hash text NOT NULL,
state text NULL, generation bigint NULL,
previous_head_id uuid NULL, previous_head_version bigint NULL,
previous_head_hash text NULL, anchor_canonical text NOT NULL,
anchor_hash text NOT NULL, package_manifest_hash text NOT NULL,
snapshot_canonical text NOT NULL, snapshot_json jsonb NOT NULL,
created_at timestamptz NOT NULL
```

PK(project_id,id,version), UNIQUE(project_id,id,version,content_hash). record_kind는 PROFILE|HEAD뿐이다. 모든 version/generation은 기존 positive safeinteger 범위·hash는 exact64hex다. 원 snapshot canonical text와 hash/JSONB 실제값을 함께 검산하고 JSONB의 다른 숫자/Unicode 재직렬화를 원 hash로 치환하지 않는다.

- PROFILE: id=profile_id/version=profile_version/content_hash=profile_content_hash; snapshot은 exact NativeChannelProfile. state/generation/previous_head 세 값은 모두 NULL이다. 동일 fullref의 다른 bytes는 거절한다.
- HEAD: 새 id/version1; snapshot은 exact ProfileHead이고 profileRef는 같은 project/installation의 PROFILE fullref다. state=ACTIVE|REVOKED·generation≥1. generation1에서만 previous_head 세 값이 NULL이고, 이후에는 셋 모두 존재하며 직전 HEAD fullref/generation+1을 검산한다. (project_id,installation_id,profile_id,generation)의 HEAD partial UNIQUE로 fork를 막는다.
- PROFILE 자기 fullref FK와 HEAD의 profile fullref/previous HEAD fullref는 위 실제 UNIQUE를 참조한다. kind·목적·설치/project/hash·canonical과 typed열의 일치·선후관계는 양방향 deferred proof로 닫는다. HEAD는 PROFILE보다 뒤에 생겨야 한다.
- versions의 UPDATE/DELETE/TRUNCATE는 앱/일반 producer에 허용하지 않는다. 회수는 기존 HEAD를 덮지 않고 새 REVOKED HEAD 불변행을 추가한다. 이전 원문·회수/대체·anchor 이력은 남는다.

`anvil.native_channel_profile_heads`:

```text
project_id uuid NOT NULL, installation_id uuid NOT NULL,
profile_id uuid NOT NULL, generation bigint NOT NULL,
current_profile_version bigint NOT NULL, current_profile_hash text NOT NULL,
current_head_id uuid NOT NULL, current_head_version bigint NOT NULL,
current_head_hash text NOT NULL, minimum_profile_version bigint NOT NULL,
anchor_hash text NOT NULL, package_manifest_hash text NOT NULL,
created_at timestamptz NOT NULL, updated_at timestamptz NOT NULL
```

PK(project_id,installation_id), UNIQUE(project_id,profile_id). 현재 profile/head의 fullref FK는 위 versions의 실제 UNIQUE를 참조한다. heads의 모든 반복 scalar와 현재 PROFILE/HEAD/anchor/package 실물은 같아야 한다. head는 expectedHeadRef를 잠금·비교한 CAS와 generation+1로만 바뀐다. 원 installation/profileId를 다른 것으로 교체하는 일반 UPDATE0이다. 최초만 expectedHeadRef:null, 이후에는 원 fullref 필수다.

### 3.2 publisher 입력과 보호 권위

publisher의 exact 비공개 입력을 `{schemaVersion:1,purpose:'PUBLISH_NATIVE_CHANNEL_PROFILE',publicationId,projectId,installationId,action,expectedHeadRef,profile,anchor,packageManifestHash}`로 제안한다. action은 PUBLISH|REVOKE, profile은 wire V<NativeChannelProfile>, anchor는 wire NativeProfileAnchor다. publicationId는 새 HEAD id이며 같은 id+같은 전체 원문은 역사 결과만, 다른 원문은 충돌이다. HUMAN ProjectCommand나 새 일반 API가 아니다.

- PUBLISH는 profile 원문·원 ref/hash·설치/고정 origin/prefix/CA hash/hostname·package anchor와 실제 공개 CA bytes를 검산한다. 새로운 PROFILE와 ACTIVE HEAD를 만들고 head CAS를 갱신한다. 기존 current보다 높은 profile.version만 허용한다.
- REVOKE는 현재 profile 원형/fullref를 그대로 사용하고 REVOKED HEAD만 새로 만든다. profile 자체를 삭제/변조하지 않는다. 이미 만료된 현재 profile도 원문은 그대로 보존하고 보호 계획/current fullref가 맞으면 회수할 수 있다. 같은 version을 다시 ACTIVE로 돌리지 않는다. 다시 게시하려면 더 높은 version과 명시된 새 package 입력이 필요하다.
- minimum_profile_version은 anchor의 하한 및 이미 보존한 하한보다 낮아질 수 없다. successor generation을 safeinteger로 만들 수 없으면 새 ACTIVE 게시를 거절한다. 보호 current head의 generation/전 HEAD chain도 함께 비교해 restart/재연결로 하한을 낮추지 않는다. origin/CA 변경은 새 검수 package/명시 변경 결정이 필요하고 단순 head UPDATE로 처리하지 않는다.
- 실제 producer는 검수 package/보호 실행계획의 exact source SHA·package manifest hash·anchor bytes/hash·profile fullref를 검산하는 publisher다. 원 설치ID는 AccessRepository의 보호 auth 설정에서 얻고 HTTP/renderer 임의 installationId를 쓰지 않는다. manifest/anchor의 자기 선언 hash만으로 무결성이 증명된다고 하지 않는다.
- 기본/import/plan은 IO mutation0. 실제 publish/revoke adapter는 별도 직접 승인된 보호 실행계획·원 권한/소유·기한·단발 intent 뒤에만 동작하도록 source를 작성한다. 이번에 실행하거나 실제 보호 파일/CA/키를 읽지 않는다. 실행 계획의 실제 값/경로/인증자료·현재 package 설치 검증은 후속 concrete 실행안의 선행이다.

SQL 목적 entrypoint 후보는 `anvil.publish_native_channel_profile(project_id uuid,input jsonb)` 하나다. 기존 migrator 소유 SECURITY DEFINER·fixed search_path=pg_catalog와 schema 한정 참조를 사용하며 PUBLIC/app EXECUTE를 회수한다. 기존 migrator만 EXECUTE하고 app/HUMAN/Agent 직접 profile INSERT/UPDATE/DELETE/TRUNCATE0이다. 이 ACL source를 쓰는 것과 실제 GRANT/role/DB 실행은 구분한다. 범용 role·raw SQL·관리flag setter를 만들지 않는다.

앱 reader는 `anvil.native_receive_profile_current(project_id uuid,original_auth_session_id uuid)` 목적함수로 project/원 auth session·현재 OWNER/control·정확 readNativeChannelProfile AUTO·원 등록·원 profile head/floor를 검산한다. 원 실제 auth session을 결박하는 context와 original_auth_session_id 인자는 기존 authenticated callback의 원 AuthenticatedIdentity.authSession.id에서만 생산한다. HTTP/IPC의 actor/session 값이나 공개 native subject 값을 이 인자로 받지 않는다. SQL도 원 fn01_active와 같은 session/user/client/세대·기한 검산 및 현재 OWNER/control·정책을 실제행으로 확인한다. 결과 반환 직전 session/policy/profile/current 기한을 다시 검사한다. publisher권한이 HUMAN 명령 허가로 상속되지 않는다.

### 3.2.1 publisher 기대값의 exact typed 입력·constructor

실제 발행 입력과 신뢰된 기대값은 별개다. 기대값을 HTTP/renderer/Agent 요청, profile/anchor 자체의 주장, 검산하려는 package의 자기 선언에서 생산하지 않는다. 별도 승인된 보호 실행계획을 유지관리자가 검토한 경로로 공급하는 다음 descriptor 하나를 권장한다.

```text
ProfilePublisherExpected={
 schemaVersion:1,purpose:'NATIVE_CHANNEL_PROFILE_PUBLISHER_EXPECTED',
 planId:Uuid,expectedSourceSha:GitCommit40,
 expectedManifestHash:Hash,expectedAnchorHash:Hash,
 expectedPublisherArtifactHash:Hash,
 expectedInstallationId:Uuid,expectedProjectId:Uuid,
 expectedPublicationId:Uuid,expectedAction:'PUBLISH'|'REVOKE',
 expectedProfileRef:Ref,expectedHeadRef:Ref|null,
 issuedAt:At,expiresAt:At
}
ProfilePublisherArtifact={sourceSha:GitCommit40,manifestBytes:Uint8Array,
 anchorBytes:Uint8Array,publisherArtifactBytes:Uint8Array}
```

GitCommit40은 소문자 Git commit 40hex, Hash는 기존64hex이며 추가/중복키0이다. issuedAt/expiresAt은 미래의 별도 실행계획에서 고정하는 실제 값이며 이 문서에서 발급하지 않는다. 계획 descriptor의 원 bytes/hash와 공급 경로는 해당 실행 패킷에서 외부 기대값으로 고정한다.

source의 실제 생성 접점은 기존 허용 `scripts/publish-native-channel-profile.ts` 안의 `createNativeProfilePublisher({expected,readArtifact,openMigrator,now,claimIntent})`다. expected는 위 exact descriptor의 불변 복사 또는 null이며 나머지는 source 전용 포트다. 일반 server app/route의 조립에서는 이 factory를 만들거나 expected를 공급하지 않는다. script의 유지관리자 전용 진입만 별도 보호 실행계획에서 descriptor를 읽고 공급한다. 권장 실행 입력은 `--expected-plan <보호계획경로> --expected-plan-sha256 <외부고정hash>`이며 실제 경로·기대hash·원 소유·단발·기한은 후속 실행안의 보호 입력이다. 이 argv/계획을 Web/IPC/Agent가 수정하거나 발행하는 endpoint는 없다.

factory는 expected가 null이면 `NATIVE_PROFILE_PUBLICATION_UNCONFIGURED`로 거절하고 readArtifact/openMigrator/claimIntent를 호출하지 않는다. exact shape·기한·실제 발행 input과 expected project/installation/action/publication/profile/head의 일치가 먼저다. readArtifact는 허가된 artifact의 실제 원 bytes를 읽는 생산자이며 HTTP 객체/자기선언 JSON을 그대로 반환하는 성공 대역이 아니다. actual manifest/anchor/publisher bytes의 SHA256은 각각 descriptor의 expectedManifestHash/expectedAnchorHash/expectedPublisherArtifactHash와 같아야 한다. sourceSha도 expectedSourceSha와 일치해야 한다.

sourceSha 문자열 비교 하나가 실제 실행코드를 증명한다고 표현하지 않는다. 실제 publisher entry bytes와 package file 목록/각 raw hash가 외부에 고정된 manifest bytes에 결박돼야 한다. manifest 안 source commit과 실제 file 지문을 함께 대조한다. manifest 자체의 hash를 manifest 안 expected 값으로 비교하는 자기검증은 거절한다. anchor의 actual bytes/hash와 wire anchor/profile 필드가 같아야 하고, 기존 catalogue 권위로 대신하지 않는다.

이 검산과 원 단발 intent의 명확한 소유·기한을 확인한 뒤에만 openMigrator를 호출한다. 결과불명에는 후속 DB 생성/발행/회수/재시도0이다. SQL의 기존 migrator EXECUTE 경계도 유지해 일반 앱 DB role로는 발행할 수 없다. descriptor/원문 hash 검산은 데이터 결박이지 **외부 사람 승인을 암호학적으로 검증하는 기능이 아니다**. 신뢰의 시작은 별도 승인 실행계획을 공급하는 기존 유지관리자 권한 경로이며 새 서명키·승인 서비스·인증 우회를 만들지 않는다. 승인된 실행계획 공급자가 없으면 미구성 거절로 끝낸다.

합성 반례는 미구성·shape 불량·다른 sourceSHA/manifestHash/anchorHash/entry hash·변조 input·만료·intent 불명에서 실제 artifact/DB/추가효과0 또는 해당 정착 단계 이후 효과0을 검산한다. actual builder/parser와 같은 함수로 fixture bytes를 비교하며 실제 설치자료/키/DB 조회를 unit/import/type/build에서 실행하지 않는다.

### 3.3 실제 FK·공유 actual/held·회수 예약

receive head의 (project_id,profile_id,profile_version,profile_hash)는 위 PROFILE fullref UNIQUE를 참조한다. receive_records에도 서버 소유 profile_id/profile_version/profile_hash 세 열을 두고 기존 project_id와 함께 같은 PROFILE fullref를 실제FK로 참조한다. R54 행수는 바뀌지 않지만 추가 물리열 bytes는 P(row)에 포함한다. 이 세 열 증가는 profile.version1 기준154B/record, 기존 최대16자리 version 기준169B/record이며 receive_records 최대45행에만 적용해 최대7605B다. R54 전체에 곱하지 않는다. 각 Window/Session/Offer/Binding/Delivery의 profile·설치·head 관측 관계도 deferred proof가 원 profile/historical ref와 정확히 같게 묶는다. 역사 FK 유효성과 현재 ACTIVE/floor/회수 검산은 별개다. 공개 profile 원형에 projectId나 원 auth sessionId를 추가하지 않는다.

profile versions/heads 실제량은 window R54와 분리된 project 공유 R 분모다. 같은 물리행을 다중 window별로 다시 더하지 않는다. 기존 R10,000행/64MiB·project10GiB 안에 profile 실제량/미래량을 합산하고, 별도 임의 숫자나 새 무한 저장을 만들지 않는다. 모든 physical scalar·NULL·실제 시각·canonical text/JSONB·anchor/package 반복열을 projection에 포함한다.

- immutable PROFILE/HEAD의 이미 저장된 actual은 원행에서 계산한다. 미래 publish 이력을 무한 예약한다고 주장하지 않는다.
- mutable heads의 lifetime growth는 typed M_head−실제 P_head로 계산해 공통 held에 연결한다. 자기 actual/hash/임의 padding 열을 새로 넣지 않는다.
- ACTIVE current head는 **다음 REVOKED HEAD 한 행**의 typed 최대 bytes/한 slot을 Q_revoke로 사전예약한다. collector가 현재 fullrefs와 immutable ACTIVE snapshot에서 직접 재계산한다. profile를 게시해 공간을 모두 쓴 뒤 회수를 못하는 경로를 허용하지 않는다.
- PUBLISH는 PROFILE+ACTIVE HEAD actual·head growth·새 Q_revoke를 같은 project/account 잠금/Tx에서 검산한다. 명확히 기존 head를 대체할 때만 옛 Q를 같은 history closure와 함께 반환하고 새 Q를 보유한다.
- REVOKE는 원 Q_revoke를 실제 REVOKED HEAD로 전환하고 head CAS/계상 정산을 같은 Tx에서 수행한다. 다른 자료로 quota가 포화돼도 선확보한 이 예약만 소비하며 새 자유공간/예약을 요구하지 않는다. 원 이력·used/held 역완결이 깨진 경우까지 우회하는 것은 아니다. COMMIT/저장 결과가 불명이면 추가 mutation/새 게시/hold 반환0이다.

정확 대응은 다음과 같다. 설치 package anchor의 허용 bytes/hash·원 installation은 보호 publisher가 검산하고, publisher가 versions의 PROFILE와 HEAD 불변행·heads의 current fullrefs/floor를 원 account Tx에 저장한다. ProfileRead는 current heads→HEAD/PROFILE 실제행과 anchor/package hash를 private reader로 복원한다. Window.profileRef 및 receive_heads의 profile_id/profile_version/profile_hash, receive_records의 같은 세 열은 모두 (project_id,versions.id,versions.version,versions.content_hash)의 실제 PROFILE 목적에 대응한다. HEAD currentness/회수/floor는 private reader와 OPEN/native issuer에서 별도로 검사한다. SQL FK가 있다는 사실만으로 현재 발급권위를 주장하지 않는다.

공유 계상은 R_shared.actual=versions의 모든 실제행+heads의 모든 실제행이며 heldSlots=ACTIVE current head 수, heldBytes=sum(M_head−A_head)+sum_ACTIVE M_revoke다. Q_revoke는 current generation+1·current immutable HEAD의 previous fullref·원 anchor의 typed 최대값에서 산출한다. 과거 ACTIVE 이력마다 예약을 남기지 않고 최신 current에만 한 건이다. 추가 제3profile 표·self actual/hash 열0이다. 이 물리 projection/입장/회수 구현은 계상 §14와 같은 함수가 양쪽 collector에 소비되도록 하며 원 실제값/공개 Profile·Head canonical hash는 바꾸지 않는다.

비용 담당의 exact projection/collector와 이 두 표·불변 row_kind·Q_revoke가 같아야 한다. profile publisher 입력/역사 저장·회수·비용은 새 계약 선택임을 최종 채택 패킷에 드러낸다. 파일 provider를 가짜 FK로 치환하거나 issuer의 실제 권위를 만드는 일을 DI callback 성공으로 대체하지 않는다.

## 4. 업무 의존순서와 단일 writer TDD

### S0 — 착수 검산

Main이 wire I3 재검수·계상/profile 후속 schema·이 허용목록·exact HEAD/hash를 단일 source-only 채택 binding으로 고정한 뒤 시작한다. 보호 자료/다른 dirty 소유를 대조하고 신규파일/0076 충돌을 확인한다. 현재 native current source의 실제 mapping/catalogue/crypto·등록·물리 writer supplier를 어느 실제 module이 생산하는지 constructor 호출선으로 고정한다. provider가 없는 기존503/412를 false current로 우회하거나 빈 callback을 공급하지 않는다. 기존 물리 mapping의 별도 보호 producer가 실제로 없다면 그 정확 의존을 Main에 반환하고, 진행 가능한 wire/store/receiver 구현만 계속하되 정상 전체 수직경로 완료로 세지 않는다.

### S1 — exact codec·전용 Offer parser RED→GREEN

새 contract/input 시험을 먼저 써 실제 잘못된 phase/null/목적/target·중복키·version/hash·기한/상한 반례를 RED로 관측한다. 단순 모듈 부재와 행동 RED를 구분한다. OPEN pre-authority 타입에 authorityRef/material.authority/current가 필요하지 않음을 검산하고 기존 authority-dependent constructor 호출0을 spy가 아니라 실제 공유 factory 접점으로 검증한다.

원 native command 자체의 유효 최대2MiB·깊이64를 새 Offer body→실제 HUMAN handler→불변 저장→persistProjectReceipt의 L.result_ref 복제→고정 GET/재조회까지 왕복하는 반례를 추가한다. 새 Offer 경로만 bodyLimit2293760·전용 strict 파서/서버 외피 조합으로 원 command를 별도 검산한다. 원 범위초과·추가키는 거절하고 정상 깊이에서 기존 canonical과 byte가 같아야 한다. 기존 global canonical·전체 ProjectCommand/모든 연산 한도·UI02 해소 코드를 고치지 않는다. profile/receive server-owned receipt 외피도 같은 실패군을 직접 검증한다.

### S2 — profile 실제 저장·새0076·계상 접합

profile PUBLISH/REVOKE·불변 HEAD chain·fullref FK·CAS·rollback 하한·원문/hash/actual+future·회수 예약 누락의 실제 adapter 반례를 RED로 쓴 뒤 위 두 표/producer/reader를 구현한다. 신규 R/ticket/reservation/security aggregate는 비용 담당의 최종 exact schema/PK/FK/null표를 그대로 연결한다. SQL에서는 필요한 함수 선행/CREATE시점 의존·괄호/달러 delimiter·함수 owner/권한·fixed search_path·PUBLIC 회수·RLS/FORCE·반대 방향 trigger·단일COMMIT을 대조한다. 문자열 존재를 PG 문법/RLS PASS라고 부르지 않는다.

최종 collector forward는 새0076 안에서만 수행한다. 기존0071 native/connection capacity,0073 및0075까지의 최종 environment_configuration_account/quota_complete/adopt 계열을 실제 최신 함수명·원문으로 대조해 최소 덧셈/역완결만 연결한다. 출처없는 used/held 가산0, 같은 원행 N/R/L 양쪽 중복0, 어느 기존 소비자가 새 공유 profile/receive held를 모르는 상태면 미완료다. app raw rows SELECT/쓰기나 범용 SD 함수로 guard를 우회하지 않는다.

### S3 — 원 HUMAN current·OPEN·phase·broker

같은 실제 auth session/client/control·HOST_TRUST_REGISTRATION·REGISTRATION_STATUS_ONLY·ISSUED/TRUSTED/SPKI·writer/profile를 읽는 server current producer와 실제 route/service/store를 연결한다. read-only source도 반환 직전 session/정책/원 최소기한을 검사한다. OPEN은 원 key proof/current/nonce CAS COMMIT 확인 후에만 receive-only secret을 binary frame 한 번 내보낸다. secret 반환/COMMIT 유실이면 재구성·재발급0이다. 원 NativeOnly/StatusOnly bearer를 새 receive credential로 채택하지 않는다.

phase ticket7과 STATE 내부 occurrence1/2, 같은ID/hash 역사조회·충돌·회수/기한·typed error/고정 감사 집계를 실제 동일 store/query builder로 검산한다. UNKNOWN 후 native STATE/challenge mutation0이며 원 HUMAN 고정 GET만 사용한다. audit 저장불가의 내부 SECURITY_AUDIT_UNAVAILABLE는 공개503/NATIVE_RECEIVE_SOURCE_UNAVAILABLE/UNKNOWN으로만 대응하는 권장안을 Main이 비용/wire 오류표와 고정한다. 임의 DB/서명/SQL/secret 오류원문0이다.

### S4 — 실제 desktop/Node·slot 공급

main 원 Session.fetch의 receiver·view/origin/generation/authEpoch/원 등록 binding을 모든 await 뒤 검사하는 client를 구현한다. local IPC의 실제 sender/epoch·등록시도ID/새수신시도ID를 분리한다. hosted Web과 다른 Chrome은 거절하며 cookie 이전0이다. 실제 typed key-host builder/validator가 원 설치 current·Window/challenge/body/target·원기한을 소비하도록 한다. 기존 SIGN이나 authority 기반 refresh를 OPEN에서 부르지 않는다.

새 Node 고정 HTTPS bootstrap/stream parser는 실제 driver/builder와 같은 제한을 unit fake socket에서 소비한다. metadata와 secret을 분리하고 receive-only secret·native opaque43은 main 메모리에만 보관한다. 원 authority snapshot2MiB를 보존해 Delivery typed cap2,098,694B/frame2,098,899B를 적용하며 기존 runtime snapshot 상한은 바꾸지 않는다. 기존 slot.accept(void)만 ACK 증거로 사용하지 않는다. 실제 slot instance·exact authority/metadata·보호 current source·단발 정상 수용과 남은 기한을 검산한 adapter만 SlotReceipt를 만든다. source가 부재/만료면 ACK0이다.

### S5 — hosted Web offer/ARM·원 native Tx

기존 NativeBoundaryPreparationPanel의 명령/필요 승인/같은 명령 재확인 흐름에 원 window 명시조회/선택·offer 저장·ARM 확인을 연결한다. 최종 commandHash는 approvalRef까지 포함한 기존 원문 그대로다. ARM은 approval를 소비하지 않는다. 기존 native POST에 검산된 Ref header만 추가하고 body는 원 bytes다. legacy header 생략 경로와 기존 거절을 보존한다.

원 native producer가 실제 기존 authority/command/receipt/audit를 만든 같은 Tx에서 ARM 소비/Binding/원 future예약·반대 closure를 묶는다. ATTEMPTED 확정 COMMIT 뒤에만 실제 supplier를 한 번 호출하고, ACK 후보는 원 operation waiter만 소비한다. handler가 DB lock을 쥐고 operation을 기다리는 순환·supplier가 ACK HTTP 완료를 기다리는 순환0이다. broker owner가 다르거나 process를 잃으면 CAS/ledger의 단발성을 지키며 UNKNOWN/UNAVAILABLE로 남긴다. availability를 가짜 forward/재연결로 채우지 않는다.

### S6 — ACK·닫기·역사조회·핵심 실패

ACK snapshot은 wire SlotReceipt 그대로, candidateRef=slotReceipt.ref다. 별도 ACK_RECORD/ackId/proofRef 공개 wrapper0이다. nonce/proof/Binding/Nterminal은 서버 소유 scalar FK와 deferred proof로 같은 후행 Tx에서 검산한다.202 후보 인수·slot 휘발 수용·원 후행 COMMIT·Agent 실행 성공을 구분한다. ATTEMPTED/ACK/후행 COMMIT 불명에 재전달·새 terminal·자동예약 회수0이다.

CLOSE는 명확한 전송 전 phase의 CAS만 성공하며 BOUND 이후·UNKNOWN을 성공 회수로 바꾸지 않는다. 늦은401/403/성공·사용자/client/project/등록/profile ABA·닫은 원문을 다시 여는 응답·원 command 자동변경을 실제 컴포넌트/IPC/controller 반례로 검산한다. 역사 GET은 실제 원행/fullref/hash/receipt/ACK closure를 검산하되 현재 usable/새 권위와 분리한다. 원 token·비밀·profile CA를 IPC/로그/일반 결과에 출력하지 않는다.

### S7 — source 검수·동결 반환

각 S구간은 변경 파일/raw지문·행동 RED/GREEN·명령/exit·오류 횟수·미완료·원 handle을 Main에 짧게 제출하고 다음 독립 구현을 이어간다. 공유 source를 Main이 검수할 때는 지문 범위를 먼저 동결하고 다른 source만 순차 진행한다. 동일 근본 원인 유효 실패3회는 중단·Main 인수 근거를 반환한다. 환경/도구 준비 오류·출력 소실은 제품 실패/PASS로 바꾸지 않는다. 원 handle의 정착만 수거하며 모르는 실행을 자동재시작/kill하지 않는다.

## 5. 합성 검수 명령 후보와 관측 범위

아래는 **source-only 채택 뒤** 수행할 명령이며 지금 실행하지 않았다. 각 신규 시험은 실제 공유 parser/query builder/ports/handler/slot/broker를 소비해야 한다. SQL 자체를 흉내 내는 새 범용 interpreter·항상true current·fixturecount만으로 물리 완결을 증명하지 않는다.

```text
node --test tests/unit/FN06/native-first-receive-contract.test.ts tests/unit/FN06/native-first-receive-profile.test.ts
node --test tests/unit/FN06/native-first-receive-store.test.ts tests/unit/FN06/native-first-receive-schema.test.ts tests/unit/FN06/native-first-receive-routes.test.ts
node --test tests/unit/FN06/native-first-receive-client.test.ts tests/desktop/native-first-receive-owner.test.cjs tests/unit/UI11/native-first-receive-flow.test.ts
node node_modules/typescript/bin/tsc --noEmit -p tsconfig.base.json
```

직접 영향 기존 FN06 authority/current/store/routes/https/slot/owner-host, UI11 native 준비/승인, desktop owner/등록/IPC/build source 검사 중 실제 변경 분기만 `--test-name-pattern`으로 선택한다. 기존56·환경50·native44·UI02 완료 검사를 불변인데 반복하지 않는다. 전체 기존 시험/실 opt-in harness는 자동 실행하지 않는다.

모든 신규 모듈 import/default/단위시험/타입/메모리 빌드에서는 실제 설치 anchor·키·CA 파일·사용자 자료·DB/서비스를 자동 조회/초기화하지 않는다. 순수/injected source 포트·고정 공개 fixture만 사용하고 미구성 실제 provider는 명시 거절로 유지한다. 환경변수에 값이 있다는 이유로 Pool·Session·key-host/driver를 자동 열지 않는다. 실제 adapter의 command/query builder와 parser·owner/current 검산은 같은 함수로 시험하되 fake transport/DB의 PASS를 실제 profile issuer/RLS/TLS/Agent 성공으로 승격하지 않는다.

Web은 envDir:false/publicDir:false/write:false의 기존 메모리 Vite 경로를 사용하고 실제 served/listener/브라우저를 띄우지 않는다. desktop/native key-host는 기존 fake 포트·source 형상/typed builder까지만 검사하며 C# 실제 compile/run·OS peer/keyhost/helper 실행0이다. 기존 하네스가 실제 경로/CA/보호 자료를 읽게 되면 실행 전 정확한 가지를 Main에 반환한다.

최종 `git diff --check`·실변경 허용목록/원 SQL·보호 자료 불변·0076 raw/checksum·Git blob 줄바꿈 대조는 Main 인계 증거다. 함수 호출순서/DDL/ACL/trigger의 정적 검수와 실제 PG 설치/RLS/잠금 경합은 분리한다. SQL checksum은 작성 중 placeholder를 PASS로 세지 않고 최종 bytes에서만 계산한다.

## 6. 실제 실행 제외와 최종 채택 전 접점

실제 SSH/WSL/Docker·DB/SQL 적용·role/GRANT·회원/정책 부여·키/CA·credential 발급·보호 설정/실자료 조사·서비스/listener·Electron/native helper/Agent·npm 설치·J3/P03R3/새 QA·승인시각 발급·Git mutation은 모두0이다. source writer는 commit/push·WORK_STATUS/계약 문서를 쓰지 않는다. 실제 설치/실행/사용자 인수는 source checkpoint 뒤 정확 별도 결정안이 필요하다.

Main이 source-only 채택 전에 닫을 접점은 다음이다.

1. wire I3 보완본과 비용/profile 후속 exact schema/hash의 독립 재검수·단일 binding. ACK wrapper 충돌은 SlotReceipt 유지로 정합됐으며 이 결정을 재개방하지 않는다.
2. 이 절의 새 profile 보호 DB원장/권위·publisher/rollback 하한·공유 actual/held/Q_revoke와 유한 audit/admission의 새 저장·권한 의미를 최종 패킷에 명시한다. 실제 GRANT/DB 실행 승인은 포함하지 않는다.
3. 실제 native mapping/catalogue/crypto와 보호 profile package 공급자의 정확 생성 접점을 착수 패킷에 고정한다. 현재 source/설치가 없으면 정상 구현이나 실측 current로 위장하지 않고 해당 의존을 명시한다.
4. 새 Offer 경로2293760B/전용 parser와 원 native2MiB/깊이64, Delivery 별도 typed cap·보호 authority sessionId 예외, 같은 hosted Web 시작자·단일 broker 가용성 제한을 한 권장안으로 채택한다. 내부 파일배치/함수 선후순서 결정 자체를 신산님에게 다시 떠넘기지 않는다.

이 후보 작성은 구현/시험 실행이나 FN06 완료가 아니다. 읽기에서 확인한 실제 접점 위에 새로운 미채택 기능의 구현 순서와 검수 책임을 구체화한 문서다.

## 7. 독립 검토 후 한정 보완

부모 구현 후보 SHA256 87fb8590975b7f684ae1a6b99945fc531d9f2466758214a27f9f5315876ef470에서 receive head FK의 실제 열명만 profile_hash로 정정했다. versions의 자기 profile_content_hash/참조 target content_hash는 그대로다. 기대 sourceSHA/manifestHash/anchorHash의 신뢰 시작을 별도 유지관리자 실행계획 descriptor와 실제 publisher constructor로 구체화했으며, package 자기선언/HTTP/Agent 기대값 생산과 사람 승인 암호학적 검증 주장은 금지했다. source/실제 실행 권한은 여전히0이다.
