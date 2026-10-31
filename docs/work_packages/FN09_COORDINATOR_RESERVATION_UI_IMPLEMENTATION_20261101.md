# FN09 총괄 역할 책임 세션 예약 — 기존 Web 소비 연결

2026-11-01 / Main 어울 / TEST_ONLY → Main 행동 RED → PRODUCT_GO

## 기존 승인 범위 판단

기준 `codex/av3-stage-b` / `c08dd38cea825f73842f846db57a7b4d9761fe4b`. 승인 설계88·109의 지속 총괄/판단 도구 분리와 연결 계층, FUNCTION_WORK FN09, 기존 직접 승인 WI `FN09_RESPONSIBLE_SESSION_ONE_TIME_APPROVAL_IMPLEMENTATION.md` SHA256 `73DD668F29B3F20B3B52F6FC892F4AA84513029E803B800785FDC0764077B447`를 따른다.

기존 공개 계약은 역할 종류를 STAGE_OWNER로 한정하지 않는 roleRef 예약이다. COORDINATOR 저장/보호 조회·기존 bind·두 역할의 binding 집계가 이미 구현돼 있으나 Web의 BIND 선택·현재 binding·재확인이 단계 역할에 고정됐다. Main은 기존 계약의 UI 소비 누락으로 판단한다. 새 API·operation·역할·공개 필드·DB/SQL·권한 계약을 추가하지 않는다. `existingSessionBindingRef` 등 실제 wire는 기존 승인 WI/코드 그대로 사용하며 별칭을 새 필드로 보내지 않는다.

확정된 **root 임무** 안에서만 연결한다. 프로젝트 생성 입력 추가·임무 없는 새 집계·자동 후속 쓰기·실제 총괄 런타임/모델·Agent 세션 실행이나 제어권 위임은 범위 밖이다. 후보 능력은 기존 UNVERIFIED이며 결과는 RESERVED/CANDIDATE_ONLY, handle=null, executionAuthorized/dispatchPerformed=false를 유지한다.

## 정확 변경 경로

| 파일 | 시작 SHA256 |
|---|---|
| apps/web/src/features/workspace/WorkspaceResponsibleSessions.tsx | 0E175A7E97C01508F5D7C40FD3772FAFBED103EAB80A497405ADC37B9DFC978D |
| apps/web/src/features/workspace/responsible-session-api.ts | EF7A791F1D1F5B930FBE9A0481DB5E64C8DBEF4021B9C4C4EE44F9EF86B9076F |
| tests/unit/FN09/coordinator-responsible-session.test.ts | 신규·부재 확인 후 작성 |

기존 Primary 단일 writer. 처음에는 신규 시험 한 파일만 쓴다. Main이 실제 행동 RED와 제품2 불변을 확인한 뒤에만 제품 GO한다. 기존 시험·부모/App·승인 helper·서버·SQL·다른 dirty/보호3은 변경하지 않는다. 추가 경로가 필요하면 실제 직접 영향과 최소 diff를 먼저 제출한다.

## 연결할 행동과 보존 조건

1. 기존 BIND의 단계 예약 의미와 기본 선택을 보존한다. 총괄 예약은 내부 UI action으로 구분해 같은 `bindResponsibleSession`을 생성한다. 총괄만 정의되고 단계 역할이 없어도 명시적으로 총괄을 선택해 예약할 수 있어야 한다. 사용자에게 대상 역할의 종류·정확 ref와 현재 예약을 표시한다.
2. 선택 대상 역할의 기존 binding/connection만 사용한다. 두 역할이 서로 다른 연결을 가질 때 반대 역할의 connection·existing binding ref·CAS를 섞지 않는다. 기존 후속 결박은 같은 sessionRef/같은 도구로만 가능하며 임의 교체를 허용하지 않는다. 명시 대상 변경은 로컬이며 자동 POST를 만들지 않는다.
3. 대상 선택은 실제 owner/project/client/확정 임무 문맥과 결박한다. 필요하면 기존 Web 전용 buffer에 선택을 보존하되 공개 command/payload에는 새 필드를 보내지 않는다. 옛 buffer의 선택 필드 부재는 기존 단계 의미로 처리하고 잘못된 값은 다른 역할로 대체하지 않는다. 대상 변경 시 미저장 연결 선택을 명확히 초기화·재선택하며 다른 역할에 조용히 재사용하지 않는다.
4. pending/UNKNOWN 중에는 대상·입력 변경을 막는다. 복귀/재확인은 원 pending.payload.roleRef와 현재 보호 원본을 정확 대조해 총괄/단계를 구분한다. 모호하거나 대응 원본이 없으면 원명령을 보존하고 거절하며 새 역할로 재구성·자동 재송신하지 않는다. same command/body와 owner/client/control/기한 검사를 보존한다.
5. AUTO·DENY·REQUIRE_APPROVAL 기존 의미를 유지한다. 명확한 서버 APPROVAL_REQUIRED 뒤 기존 후보→UI08 별도 결정→동일 원명령 결박→명시 저장/고정 조회를 소비한다. 역할 정의 승인을 예약에 상속하지 않는다. UNKNOWN 후412 우회·로컬 오류의 서버 거절 위장·선택/승인만으로 자동 저장은 금지한다.
6. 성공 후 상태 GET 실패는 적용 영수증/원명령을 보존한다. child/DRAFT_ONLY·비소유자·확정 원문 미조회·정책 부재 거절, late owner/client/transport·이탈 guard를 유지한다. 후보 선택을 실제 총괄 수행능력이나 실행 허가로 표시하지 않는다.

## 검수·통합

- TEST_ONLY는 실제 UI 컴포넌트/기존 API·승인 helper·React host state/합성 transport로 총괄 예약의 현재 미연결을 행동 RED로 보여준다. 부재 export/import·타입오류만으로 제품 RED라고 하지 않는다.
- 정상 총괄 단독 예약·역할별 다른 binding/연결·같은 세션 후속 CAS, 정확 총괄 roleRef/target null0/false flags를 확인한다. 정의 승인 재사용 차단, REQUIRE 별도 후보·결정/원명령 소비, UNKNOWN 복귀/대상전환 차단, 승인/성공 뒤 GET 실패 보존, stage 기존 동작과 owner/current 문맥 음성을 포함한다. 실제 서버/DB 대역과 UI 동작 범위를 명확히 구분한다.
- 직접 인접은 기존 `tests/unit/FN09/responsible-session-web.test.ts`, `tests/unit/FN09/responsible-session-screen.test.ts`, `tests/unit/UI04/responsible-session-approval-api.test.ts`에서 영향 범위를 선택한다. 무관한 완료검사·전수 회귀는 반복하지 않는다.
- UI는 기존 예약 패널의 글꼴·색·정보구조를 유지하고 수정 직전 craft-floor를 읽는다. 실제 UI 변경 후 type·필요 메모리 build·diff·독립 검수를 수행한다. 새 QA/브라우저/파일 산출물은 별도 정확 등록 전 만들지 않는다.
- 최종 실제 명령·exit/RED/GREEN·지문/diff·오류/미실행·root/gate/native/global/채널 회수와 writer 반환을 제출한다. Main은 필요한 최종 독립 실행과 소유 경로 통합을 맡는다. 실제 DB·권한·키·서비스·Agent 실행·사용자/백업 대상 조사는 계속 제외한다. 전체 FN09/UI04·Stage·작업계획 완료로 승격하지 않는다. rollback은 소유 commit 정상 revert다.
