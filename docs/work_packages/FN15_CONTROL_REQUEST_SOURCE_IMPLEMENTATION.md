# FN15 인수 요청·조회·미확인 요약 내부 구현 지시

- 상태: SOURCE_ONLY_IMPLEMENTATION_ALLOWED / 실제 연결 NOT_CONNECTED.
- 근거: 승인 WORK_PLAN FN15·FUNCTION_WORK FN15·INTERFACES §13.6, 제안 `FN15_CONTROL_HANDOFF_CONTRACT_PROPOSAL.md` SHA256 `8EA266474A50F64B6618AD1318CAD5290C5F7EF096C71B340CABD254D2030F4D`.
- 2026-10-25 PMO 위임 판단: 기존 적격 참여자의 요청 의미를 유지하는 SELF 요청 보관·유한 조회·불변 WAITING/UNVERIFIED 요약의 내부 parser/validator/store/verifier port·미적용 SQL·합성 검증은 진행 가능. 제안 A 전체의 공개 API·실행 채택이 아니다.
- 담당: Main 어울 관리·검수·통합, 각 단위 한 명의 구현 subagent. 기준 branch `codex/av3-stage-b`, 시작 checkpoint `56615128a7c1349bffd1867f6e95e08de69f0c73`.

## 1. 경계와 연결 순서

기존 일반 명령의 OWNER/current-client/generation 집행은 수정하지 않는다. app/route/공유 ProjectCommand operation·실정책 목록·인증 기간은 수정하지 않는다. 실제 DB/격리 PG·정책 부여·멤버 변경·자동 OWNER 승격·제어 행/grant/generation 전환·accept·OS/서비스/Agent/Secret/비용은 실행하지 않는다. 실제 adapter 기본은 NOT_CONNECTED다.

FN15 전체를 SELF 요청으로 축소하지 않는다. 다른 사람 인계·실제 수락·제어 전환과 UI12/실제 검증은 미완료로 남긴다. Stage B의 실제 연결 선행은 WORK_STATUS에 분리하며 이 source-only 작업으로 완료하지 않는다.

## 2. 단위 1 — 요청 입력·불변 원문과 현재 사실 대조

허용 제품은 신규 `apps/server/modules/control-handoff/control-request-input.ts`, `control-request-snapshot.ts`; 시험은 신규 `tests/unit/FN15/control-request-input.test.ts`, `control-request-snapshot.test.ts`다.

- 입력 payload는 제안의 `targetActorRef:{userId}`, `targetClientRef:{userId,clientId}`, `baseControl:{actorId,clientId,generation,version}`, `reason`, `expiresAt`만 허용한다. actor/project/현재 시각은 내부 호출 문맥에서 받으며 payload의 주장으로 인증하지 않는다.
- plain JSON·정확 키·raw 문자열/정수/UUID/유효 시각·잘못된 prototype/accessor/cycle·2MiB·잘못된 Unicode를 기존 canonical helper로 검사한다. 이유는 원문을 보존하며 비밀 표식 검사를 재사용한다.
- 이 내부 후보 시험의 요청 수명은 최대 30분, 이유 1~20000 UTF16이다. 이를 기존 로그인 재인증 기간이나 최종 공개 API 정책으로 채택하지 않는다. 재인증은 현재 `reauthUntil > now`만 소비한다.
- 인증/회원/client/제어 관측은 별도 내부 port에서 얻을 사실이다. 순수 대조는 현재 활성 세션/자격·허용된 OWNER 또는 HANDOFF_ELIGIBLE·현재 actor/client와 SELF 대상 일치·현재 제어자/세대/version을 검사한다. VIEWER·타 프로젝트·회수/만료·옛 기준·이미 본인 현 client 제어·미확인 제어는 거절한다. 이 대조 자체가 실제 인증/실제 허가의 증거는 아니다.
- 요청 snapshot은 정확 id/version1/project/requestedBy/target/baseControl/reason/createdAt/expiresAt와 storedState=PENDING, executionAuthorized=false, controlTransferred=false를 불변 복제·canonical hash로 결박한다. verifier는 hash·중복 metadata·원입력 관계를 대조하며 원본 mutation을 하지 않는다.
- RED→GREEN은 정상 다른 client/적격 참여자와 모든 위 음성, 정확 만료 경계·재인증 경계, 잘못된 참조/형·비밀·변조·원배열 불변을 직접 확인한다. 실제 제어 변경은 0이다.

## 3. 단위 2 — transaction port·원자 저장·보호 조회

후속 신규 제품은 `control-request-store.ts`, `control-request-summary.ts`; 시험은 각각 FN15 전용 단위로 둔다. 단위 1 검수 후 상세 인터페이스와 정확 파일을 고정한다.

- 같은 transaction에서 현재 인증/회원/client/제어를 재관측한 다음 요청 전용 명령·snapshot·receipt·audit를 모두 저장한다. 동일 commandId·payload만 replay하고, replay 전에도 현재 접근을 검사한다.
- 기본 실제 adapter는 거절하며 fake transaction만으로 원자성·rollback·COMMIT 양방향 완전성·현재 권한 회수·기준 변경을 시험한다. 기존 일반 OWNER 검사에 예외를 덧붙이지 않는다.
- 조회는 본인 요청 또는 현재 controller만 최소 원문을 얻는다. actor/project/filter/limit/기한 결박 cursor, 정확 version/hash, 누락/변조·다른 주체의 원문/민감 상태 일부 노출 0을 검사한다. 목록의 최대 200 등 수치는 내부 후보 조건이며 공개 조회권을 새로 확정하지 않는다.
- 요약 생성은 현재 제어자의 정확 actor/client/generation 및 유효 reauthUntil을 같은 transaction에서 확인한 경우만 허용한다. SELF 요청자라는 이유로 생성 권한을 얻지 않는다. 수집 전후 현재 세션/회원/client/control과 요청의 baseControl을 다시 대조하고 변경·불명은 거절하거나 미확인으로 보존한다. 조회 권한과 생성 권한을 혼동하지 않는다.
- 안전 요약의 실수집 미연결을 빈 안전 배열로 숨기지 않는다. 불변 WAITING/UNVERIFIED와 gap·acceptanceEnabled=false를 보존한다. 요약 수명 30초는 내부 후보 시험값이다. 과거 요약을 현재 안전·실수락 허가로 승격하지 않는다.

## 4. 단위 3 — 미적용 SQL 후보와 합성 통합

정확 번호의 충돌·기존 migration 집합·loader를 확인한 뒤 새 `*.sql.pending` 파일만 추가한다. 기존 SQL·적용 manifest·실 DB는 수정하지 않는다. 요청·원문/버전·요약·명령/receipt/audit의 FK·불변 guard·중복 방지·완전성 요구를 소스 검수하고 fake/in-process로 검증한다. SQL/실 DB 동시성은 실행하지 않았으면 미검증이다.

## 5. 검수·증거·복구

각 단위는 writer의 RED→GREEN, Main 집중/직접 영향 타입 검사, 독립 spec·quality 검수 후 소유 경로만 같은 branch에 checkpoint한다. 서버-only이면 Web 전체 빌드는 반복하지 않는다. 완료 시험은 코드가 바뀌지 않으면 다시 하지 않는다. 기록은 기존 WORK_STATUS·WORK_PLAN의 한정 상태로 유지한다. 제품 사용 가능·FN15 전체 완료·Stage 완료로 보고하지 않는다. rollback은 소유 commit의 일반 revert이며 실제 저장 원문/제어를 삭제하거나 되돌리는 명령이 아니다.
