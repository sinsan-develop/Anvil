# FN01/FN11 VIEWER 참여자 관리 상세 후보 r1

- 상태: DRAFT / NOT_ADOPTED / 제품 코드·새 API·SQL·실권한 변경 0
- 기준: 승인 WORK_PLAN FN01·FN11, 설계 역할표의 조회 참여자, a8aa539da92cae71da0e98447cf8cbf4f3862ff4
- 목적: 기존 Anvil 사용자가 같은 프로젝트를 조회하게 명시 등록·회수한다. 소유권/담당자/단독 제어/Agent 도구 권한은 이전하지 않는다.
- 작성 권한: PMO 2026-10-21의 상세후보·정적검토 한정 지시. 이 문서는 채택·DB 적용·실사용자 권한 변경 승인이 아니다.

## 1. 실제 공백과 기존 계약 보존

현재 projects/repository.ts는 생성자의 OWNER membership 한 건을 삽입한다. project-command.ts의 허용 operation과 projects/routes.ts의 commands enum에는 참여자 등록/회수 연산이 없다. ProjectAccessSummary는 현재 요청자의 participation/제어 기록만 조회한다. 기존 project_members에는 OWNER/VIEWER/HANDOFF_ELIGIBLE·version·revoked_at이 있지만 그 존재만으로 관리 기능이 구현된 것은 아니다.

OWNER 변경/자기 회수/승격·HANDOFF_ELIGIBLE 관리·다른 사람에게 쓰기 허가·FN15 인계는 제외한다. 기존 단독 OWNER 현재 제어·정책·CSRF/로그인·비회원 404·파일 격리 규칙을 완화하지 않는다. 기존 SQL 파일은 수정하지 않는다.

## 2. 대안과 권장안

| 안 | 효과 | 비용·위험 |
|---|---|---|
| A 권장: 기존 사용자 식별코드로 VIEWER 등록/회수 | 기존 프로젝트 참여 개념을 최소 범위로 실현 | 새로운 읽기 권한/회원 관리 공개 계약·SQL guard 필요 |
| B 초대 링크/신규 계정 등록까지 연결 | 사용 편의·대상 동의 | 일회 Secret/회수·신규 계정·이메일/전달 경계가 늘어 이번 최소 범위 아님 |
| C 현 상태 유지 | 새 권한 위험 없음 | 참여자 관리 미구현 지속. 완료로 표시할 수 없음 |

## 3. 대상 식별·정보 노출·수명

- 대상은 본인이 제공한 Anvil user.id(UUID) 한 개로 식별한다. 이 값은 인증 비밀/세션 토큰이 아니며 타인의 로그인명·이메일·사용자 전체 검색/자동완성은 제공하지 않는다.
- 사용자 자신의 식별코드 조회/복사는 기존 본인 session 응답의 id만 사용한다. 세션/클라이언트 ID·토큰은 복사하지 않는다.
- OWNER 현재 제어와 유효 재인증을 통과한 경우에만 정확 UUID 한 개의 적격성 조회를 허용한다. 응답은 targetUserRef(id/version)·displayName·eligible·observedAt뿐이다. 비존재/중지/회수 대상은 같은 TARGET_NOT_ELIGIBLE 오류로 처리한다.
- 이 조회는 정확한 유효 UUID를 아는 OWNER에게 대상 존재/표시명을 노출한다. 존재 여부를 완전히 숨긴다고 주장하지 않는다. 일반 사용자/VIEWER/비회원 조회는 거절하며 알려진 UUID 외 계정 탐색은 지원하지 않는다.
- 적격성 응답은 권한 토큰이 아니다. UI는 선택 후 5분이 지나거나 대상·표시명·권한 화면을 바꾸면 선택을 무효화하고 재조회한다. 서버는 실제 명령에서 user 상태/version을 다시 잠금·검사한다. 등록은 ACTIVE만, 회수는 대상 계정이 중지/회수됐어도 정확한 기존 회원을 수용한다. 회수 대상 ref는 적격성 조회가 아니라 OWNER 회원 목록에서 받는다.
- 조회/등록/회수는 각각 단건이다. 대상 적격성 조회는 프로젝트+actor 단위 분당 10회(60초 고정 창), 초과는 429와 남은 대기 초만 반환한다. 배치/전체 열람 기능은 없다.
- 프로젝트 회원 목록은 OWNER 현재 제어+재인증에만 허용한다. limit 50, 최대 50, actor/project/필터에 묶인 cursor를 사용한다. ACTIVE/REVOKED를 명시 구분하고 다른 프로젝트 목록을 합치지 않는다.
- VIEWER에게는 기존 프로젝트 응답의 본인 participation만 제공하며, 다른 회원 목록·로그인 정보·정책/운영 비밀은 이 API로 제공하지 않는다.

## 4. 화면 단위 후보

### UI01/UI11 참여자 관리

1. OWNER가 기존 프로젝트 설정에서 참여자 관리를 명시 개방한다. 제어가 없거나 재인증이 만료되면 변경 버튼은 비활성, 서버 검사는 별도로 강제한다.
2. 대상 식별코드 입력 → 단건 적격성 확인 → 표시명/식별코드 확인 → 아래 읽기 범위 경고와 등록 이유 → 별도 확인 → VIEWER 등록.
3. 등록된 회원의 역할·현재 회원 version·회수 상태·기록 시각을 조회한다. OWNER/HANDOFF_ELIGIBLE은 이번 버튼에서 변경하지 못한다.
4. 회수 대상의 정확 membership ref와 이유를 확인한 뒤 별도 회수한다. 저장 중/미확인 원명령은 대상 교체나 닫기로 버리지 않고 같은 body/commandId만 재확인한다.
5. 회원 목록이나 등록 응답만으로 서비스 연결/사용자 인수/쓰기를 허가하지 않는다.

### 대상 사용자 본인 화면

- 본인 식별코드 복사와 현재 참여 프로젝트 조회만 제공한다. 대상의 로그인·동의·인수·쓰기 활성화를 대신 수행하지 않는다.

## 5. 공개 API·명령 후보

모든 경로는 same-origin /api/v1/projects/:projectId 아래다. 새 경로·operation은 이 문서 채택 전 등록하지 않는다.

- GET /members?status=ACTIVE|REVOKED&limit=50&cursor=... : OWNER용 단건 프로젝트 목록. member ref(id=userId/version/contentHash), targetUserRef(id/version), displayName, participation, joinedAt, revokedAt, observedAt만 반환. 기본 status=ACTIVE·limit=50, 허용 limit=1~50이며 추가 query는 거절한다.
- GET /members/eligibility?targetUserId=UUID : §3의 최소 단건 대상 정보. 추가 query·임의 검색·미확인 client는 거절한다.
- 기존 POST /commands에 grantProjectViewer / revokeProjectViewer 두 operation만 추가하는 후보다. schemaVersion/projectId/commandId/clientId/controlGeneration/targetId/expectedVersion/baselineRefs/approvalRef 구조는 유지한다.
- targetId는 대상 userId다. 최초 등록 expectedVersion=0, 재등록/회수는 직전 membership version이다. payload는 targetUserRef·memberRef(null 또는 정확 id/version/hash)·reason·acknowledgedScope로 고정한다. 회수도 현재 targetUserRef와 memberRef를 고정하며 알 수 없는/추가 필드는 거절한다.
- acknowledgedScope는 PROJECT_VIEWER_ALL_READABLE_MATERIALS_V1에 대한 명시 사용자 확인이다. 이유/확인 값만으로 허가되지는 않는다.
- grant는 새 대상 또는 REVOKED VIEWER만 수용하고 version을 1 또는 +1로 만든다. ACTIVE VIEWER에 다른 commandId로 중복 등록은 MEMBER_ALREADY_ACTIVE로 거절하며 OWNER/HANDOFF_ELIGIBLE/자기 actor 대상은 거절한다.
- revoke는 현재 ACTIVE VIEWER에만 적용해 version+1/revoked_at을 기록한다. 과거 버전·이미 회수·소유자/다른 역할 대상은 정확 conflict로 거절한다.
- 응답은 APPLIED receipt와 새 membership ref/상태다. 사용자 비밀번호/토큰·파일 본문·다른 프로젝트 참조를 포함하지 않는다.

## 6. 권한·재인증·승인·동시성

- 읽기와 변경 모두 현재 로그인 사용자/client, 프로젝트 OWNER, 현재 단독 제어 actor/client/generation을 기존 순서대로 재검사한다. 회수된 로그인·다른 client·옛 제어 세대는 거절한다. 등록/적격성은 archived 프로젝트에서 거절한다. 회원 목록과 revoke는 접근권한 축소를 위해 archived에서도 같은 OWNER·제어·재인증·정책으로만 허용하는 새 계약 후보이며, 기존 전역 currentProjectController의 archived 차단을 완화하지 않고 이 두 연산의 전용 guard로만 집행한다. 이 예외 역시 채택 전 구현하지 않는다.
- 재인증은 기존 서버 세션 reauth_until을 매 요청 확인한다. 최근 재인증 없으면 기존 REAUTHENTICATION_REQUIRED이며 비밀번호를 membership payload로 받거나 임시 우회하지 않는다. 기존 POST /api/v1/auth/reauthenticate의 세션/CSRF 회전과 5분 유효기간을 따르며 이 후보가 연장하지 않는다.
- 두 변경 operation은 기존 명시 PROJECT 정책에 actor 본인 대상으로 따로 등록돼야 한다. 없음/만료/DENY 우선은 거절, AUTO만 직접 처리, REQUIRE_APPROVAL은 기존 일회 승인 요청/결정/소비의 정확 명령/내용/버전/기한과 같은 transaction에 결박한다. 그 연결을 입증하지 못하면 fail-closed이며 REQUIRE_APPROVAL을 AUTO로 바꾸지 않는다.
- 순서는 현재 요청자 인증/OWNER/current control/재인증 → 현재 정책의 일치·만료·DENY 검사 → exact commandId/요청 hash replay 조회 → 신규 명령에만 일회 승인 검증/소비와 대상 user/membership 잠금·CAS다. 같은 프로젝트 변경은 control 잠금으로 직렬화하며 신규 명령은 회원 version/hash CAS와 대상 user.version을 COMMIT 직전 다시 검사한다. ACTIVE 검사는 grant에만 적용하고 revoke는 중지/회수 계정에도 현재 VIEWER 회원 상태와 ref가 정확하면 허용한다.
- commandId+요청 hash의 replay는 기존 규칙을 유지하며 다른 payload는 IDEMPOTENCY_CONFLICT다. 정확한 기존 성공 receipt는 대상 회원의 이미 증가한 version CAS나 소진된 approval 재소비보다 먼저 역사 결과로 반환한다. 현재 요청자 권한/정책 검사는 생략하지 않는다. 같은 요청 재확인은 효과 한 번뿐이며 receipt의 기록 상태를 현재 VIEWER 효력으로 인증하지 않는다. UI는 항상 '명령 당시 기록 · 현재 효력 별도 조회'로 구분하고 현재 회원 목록을 명시 재조회한다.
- 과거 성공 receipt 읽기도 현재 로그인/프로젝트 membership과 OWNER 제어·정책·재인증을 우회하지 않는다. 회수된 대상이 자기 옛 receipt로 파일·정책·회원 정보를 다시 얻을 수 없다.
- 조회자의 읽기와 회수 transaction 간 전순서 보장은 검증 전 주장하지 않는다. 최소 보장은 회수 COMMIT 후 시작한 매 서버 요청에서 현재 membership을 검사해 거절하는 것이다. 회수 전에 이미 승인되어 전송 중인 바이트는 완전히 회수할 수 없다.

## 7. 실제 조회 범위와 회수 한계

- VIEWER는 해당 프로젝트의 기존 읽기 API가 허용하는 현재/과거 문서·본문·첨부·지식·대화·계획·결과를 읽을 수 있게 될 수 있다. UI 화면에 보이는 카드만 공유하는 기능이 아니다.
- 기존 데이터별 OWNER-only 검사·격리/비밀 보호·도구/connector 권한은 유지한다. ARTIFACT_QUARANTINED·raw conversation DD166F 등 기존 거절을 해제하지 않는다. 읽기 허용 범위는 route별 검수 표로 입증한다.
- 일반 허용된 원문에는 업무 기밀/사람 발언/이미 보존된 개인정보가 있을 수 있다. 등록 전 이 범위를 경고하고 확인받는다. 대상별 자료 부분 공유/자동 마스킹은 이번 범위가 아니며 완전 비밀 탐지를 주장하지 않는다.
- 회수 COMMIT 뒤 서버 조회·다음 페이지·파일 GET·고정 version·옛 receipt·기존 로그인 재사용을 재검사한다. 서버 응답은 no-store이며 클라이언트는 401/403/404 때 과거 원문/목록을 숨기고 미저장 자기 입력과 구분한다.
- 이미 수신·복사·다운로드한 원문, 진행 중 전송, 외부 스크린샷·브라우저 메모리까지 사후 회수/삭제할 수 없다. 전 사용자 기기의 캐시/파일을 몰래 지우지 않는다.

## 8. DB·감사·집행·복구 후보

- 실제 DB 적용은 별도 승인이다. source 구현 채택 시에도 이 후보는 migration 실행·실사용자 등록/회수를 포함하지 않는다.
- 기존 project_members.version/revoked_at을 활용하고 새 forward migration으로 append-only membership event와 허용 operation/guard 집행만 추가하는 방향이다. 기존 SQL 수정·자동 seed/실사용자 정책 부여·DOWN/전체 role grant는 하지 않는다.
- 앱 역할의 임의 회원 DML을 허용하지 않는다. 기존 transaction identity/command/허가 컨텍스트와 정책/세대/잠금/CAS 검사를 DB guard가 결박해야 한다. app-role 직접 INSERT/UPDATE/DELETE 우회는 거절되며 migrator/운영 역할까지 방어한다고 과장하지 않는다.
- 감사 event에는 project/actor/client/제어세대·정확 command/hash·policy/approval ref·대상 id/직전·다음 회원 ref/행동/이유/서버시각을 기록한다. 비밀번호/토큰/원문은 넣지 않으며 event 수정·삭제를 허용하지 않는다.
- 회수는 회원 행 삭제가 아니라 버전/상태와 불변 이력이다. 사용자의 과거 작성물·문서·실행/결과·감사 원문은 지우지 않는다.
- 소스 rollback은 후속 revert/허용 operation 비활성화다. 이미 부여된 읽기 권한은 코드 되돌림만으로 회수되지 않는다. 기존 읽기 접근 종료에는 정확 회원의 별도 회수가 필요하다. 관리 operation의 정책 DENY는 신규 관리 명령을 막는 수단일 뿐 기존 ACTIVE membership의 읽기 권한을 회수하지 않으며, 회수 명령도 막을 수 있으므로 대체 수단으로 사용하지 않는다. 사고 시 정확 회수와 감사 증거 보존·미완료 사실을 별도 처리한다.
- 실수로 회수된 VIEWER의 복구는 이전 version 재사용/행 복원이 아니라 현재 version에서 새 grant 명령/새 event다. 노출된 자료의 기밀성은 되돌릴 수 없으므로 권한 부여는 완전 가역이라고 보고하지 않는다.

## 9. 기능 단위·검수 후보

| 단위 | 최소 검수 |
|---|---|
| 대상 단건 확인 | 다른 프로젝트/비OWNER/옛client·세대·만료재인증 거절, UUID 이외/전체검색/초과limit 거절, 대상비적격 동등오류 |
| VIEWER 등록·재등록 | 정책없음/만료/DENY 거절, REQUIRE_APPROVAL 정확소비, 중복명령1효과, 잘못된target user/member version·hash 거절 |
| VIEWER 회수 | OWNER/자기/HANDOFF_ELIGIBLE 거절, 중지/회수 계정·archived 프로젝트의 OWNER 한정 회수 허용과 grant 거절, 같은프로젝트 동시등록·회수 CAS, 과거이력 보존 |
| 읽기 격리 | 문서/첨부/파일/지식/대화/계획/결과/목록/cursor/옛receipt별 실제 route의 현재membership 검사, 교차project/격리원문 거절 |
| 회수·클라이언트 | COMMIT 후 새 요청 차단, 진행중/이미복사 자료 회수불가 표시, 거절 시 이전원문숨김, 미확인변경 명령 보존 |
| DB 집행 | app-role 직접DML·위조transaction/command/허가 컨텍스트 음성, 정확CAS/transaction rollback·감사 불변 |

합성/fixture 통과와 실제 PG/서비스/기존 세션 회수 시험을 별도로 기록한다. 실제 WSL 검증·운영 전환·사용자 인수를 문서/소스 존재로 대체하지 않는다.

## 10. 필요한 한 건 결정

A안 상세후보를 새 공개 API/권한/감사 집행 계약의 구현 기준으로 채택할지 결정이 필요하다. 채택 시 정본 INTERFACES/관련 정책·업무 카드에 이 범위를 결박하고 TDD source 구현·한정 독립검토를 진행한다. 실 DB migration·실사용자/계정·Secret·서비스·Oracle는 여전히 제외한다.

이 문서는 아직 구현·채택·범위 축소 합의가 아니다. 기존 계획의 참여자 관리 미완료 상태를 유지한다.
