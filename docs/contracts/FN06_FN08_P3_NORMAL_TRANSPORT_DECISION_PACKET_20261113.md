# FN06·FN08 실제 전송 활성화(P3)와 맥락 묶음 공급자 권한 결정안

상태: 결정 요청(미채택). 이 문서는 결정 자료이며 구현·적용·실행 승인이 아니다.
작성: 2026-11-13, Claude 세션(Main 겸임). 기준: main 0c344f2d.
요청 대상: 신산님(최종 승인), PMO(검토·지원).

## 1. 요약

normal(비합성) 실행 경로는 서버와 실행기 양쪽 source가 **수신 기록(RECEIVED)** 까지 연결됐다. 명령 페이지, 자료 발견, 자료 GET, 실행기 codec·보호 GET 클라이언트·normal 전용 수신기가 여기에 해당한다(PR85~PR91). 그 다음 단계, 즉 실제 Agent에 START를 전달하는 일은 두 결정이 없으면 진행할 수 없다.

| 결정 | 질문 | 권장 |
|---|---|---|
| D1 | 실제 전송 활성화(P3)를 어떤 순서·범위로 열 것인가 | **A안: 단계 분할**(P2 스키마 적용 → normal 실행 허가 등 source → 실행기 보호 저장·서명 → 1건 실측) |
| D2 | 맥락 묶음 공급자가 어떤 권한 주체로 원문을 읽는가 | **A안: 실행 grant에 결박된 서버 내부 전용 읽기** |

D1 A안의 1단계(P2)와 4단계(1건 실측)는 각각 별도 실행 승인이 필요하다. 이 문서의 채택은 그 단계들을 자동으로 열지 않는다.

## 2. 현재 상태(사실)

### 2.1 연결된 것

- **서버**: HUMAN START가 grant·명령·자료 등록을 만든다(`normal-initial-execution.ts`). 이후 교환 challenge, 실행 credential 발급(`av3ex1_`), 요청 challenge, 명령 페이지(waitMs long-poll), 자료 GET이 이어진다.
- **실행기**: 명령 페이지·자료 응답 codec, 보호 GET 클라이언트, normal 전용 수신기가 RECEIVED에서 멈춘다.
- **검증**: 전부 source와 합성(RAM·가짜 DB) 시험까지다. 0083~0088 SQL은 실제 PostgreSQL에서 한 번도 실행되지 않았다.

### 2.2 비어 있는 것

**서버**
- normal 경로의 실행 허가(permit), 수신 결과(receipts), 관측(observations), heartbeat가 없다.
- 실행 Bearer가 허용되는 경로는 challenges·commands·materials뿐이다(`apps/server/http/connector-auth.ts:10-17`).
- 운영 진입점 `apps/server/main.ts:23`은 normal 경로를 등록하지 않는다.

**서버 주입 공급자(구현 없음)**
- 맥락 묶음 원문 공급자: `NormalStartContextSource`. 이것이 D2다.
- START 현재성 관측: `NormalExecutionCurrentSource`.
- 실행기 보호 저장 관측: `NormalCredentialExchangeOptions.storage.observe`.

**실행기**
- `ProtectedStore.cs`는 `av3ct1_`만 저장하고, 등록 payload만 서명한다. `av3ex1_` 저장과 실행 요청 서명(EXECUTION_CHALLENGE_REQUEST·EXECUTION_REQUEST_PROOF·EXECUTION_CREDENTIAL_EXCHANGE)이 없다.
- credential 교환 클라이언트, 명령 polling 루프, normal 수신 내구 저장소 파일 구현이 없다.
- Codex·Claude adapter는 모두 SYNTHETIC_ONLY다.

### 2.3 근거가 되는 승인 경계

- 실행 제안서 `FN06_FN08_EXECUTION_DISPATCH_PROPOSAL.md`(P1 직접 승인 2026-10-19)가 단계를 이렇게 나눈다.
  - P1: 계약·코드·합성 검증. 키·credential 생성·실제 Agent는 제외한다(l.29-31).
  - P2: 정확한 SQL·hash에 결박한 스키마 적용(l.32).
  - P3: 소유·회수·능력 실측과 현재 환경을 충족한 정확한 Agent·임무·파일·비용·시간·호출 한도의 **1건 시험**(l.33).
- 같은 제안서는 "P1 승인으로 P2/P3가 열린 것으로 해석하지 않는다"(l.35)고 하고, 실행 제공자를 SYNTHETIC_ONLY로 고정한다(l.174).
- `TECH_DECISIONS.md`의 관련 경계:
  - 실제 Agent·API 호출은 비용·호출 한도를 별도로 확정하기 전에는 0이다(l.161).
  - 실제 Secret·계정·DB·Agent 비용·배포는 각각 정확한 실행 범위가 따로 필요하다(l.167).
- WORK_PLAN RK04: "인증/키·등록 설정은 별도 결정"(l.1365).

## 3. D1 — 실제 전송 활성화(P3)

### 3.1 선택지

**A안(권장): 단계 분할**

| 단계 | 내용 | 승인 필요 | 산출 |
|---|---|---|---|
| 1. P2 | 0083~0088 normal SQL을 WSL 개발 DB에 적용·검증한다. 정확한 hash, rollback, 정리 계획을 갖춘다. | **별도 실행 승인** | 실제 PG에서 함수·trigger·제약이 동작한다는 증거 |
| 2. 서버 source | normal permit·receipts·observations·heartbeat. 합성 permit(`execution-permits.ts`, 0018 `execution_start_permits`)을 정본으로 삼아 NORMAL_PROTECTED 판을 만든다. 실행 Bearer 허용 경로도 확장한다. | 이 문서 채택(계약·코드·합성 시험·미적용 SQL 범위) | source, 미적용 forward SQL, 합성 여정 |
| 3. 실행기 source | `av3ex1_` 보호 저장과 실행 요청 서명(native), credential 교환 클라이언트, polling 루프, normal 수신 파일 저장소, adapter normal 경로(RECEIVED → permit → wire) | 이 문서 채택(source). 실제 키 생성·보호 파일 생성은 4단계 | source, 합성 여정 |
| 4. P3 1건 실측 | 정확한 Agent·임무·파일·비용·시간·호출 한도를 명시한 1건 실행 | **별도 실행 승인**(P3 명령을 정확한 SHA에 결박, 제안서 l.176) | 실제 경로 증거(task → session → 권한 → 실제 작업 → 변경·시험 → ACK → 중지) |

- 장점: 각 단계에서 위험이 드러나면 멈출 수 있다. 2·3단계는 지금까지와 같은 source·합성 범위라 실제 환경을 바꾸지 않는다.
- 단점: 실제 Agent 실행까지 승인이 두 번 더 필요하다.

**B안: P2~P3 일괄 승인**
1~4단계를 한 번에 승인하고 연속으로 진행한다. 빠르지만 실제 DB 적용·키 생성·Agent 실행이 한 승인에 묶인다. 이는 제안서의 단계 분리(l.35)와 TECH_DECISIONS l.167을 넘어서므로 **권장하지 않는다**.

**C안: 보류**
현재 RECEIVED에서 멈추고 다른 기능(FN03 등)을 먼저 한다. 핵심 실행 경로가 완성되지 않은 상태로 남는다.

### 3.2 A안과 함께 정해야 할 부속 결정

1. **credential 갱신**: 실행 credential은 최대 15분이고 자동 연장하지 않는다(제안서 l.81). 실제 Agent 작업이 15분을 넘을 때의 처리를 정해야 한다.
   - 선택지: (a) 같은 grant 안에서 재교환(새 HUMAN 승인 없음, 실행기 서명 필수), (b) 15분마다 HUMAN 재승인.
   - 권장: (a). 재교환마다 현재 grant·실행기 등록·보호 저장 관측을 다시 확인한다.
2. **grant 수명**: normal grant는 START 시점 HUMAN 세션의 유휴 만료(TD-03 30분)를 넘지 못한다(`normal-initial-execution.ts:203-206`). 그래서 실제 실행은 사실상 30분 안팎으로 제한된다.
   - 선택지: (a) 현행 유지(30분 단위 재START), (b) grant 수명을 HUMAN 절대 만료(12시간)와 제안서 상한 2시간 중 짧은 쪽으로 바꾸기.
   - 권장: 1건 실측 동안은 (a), 실측 뒤 다시 판단.
3. **명령 경로 표기 정리**: `INTERFACES.md` l.885는 `/connectors/:connectorId/commands`이고, 제안서와 코드는 `/connectors/:cid/executions/:eid/commands`다. 코드 기준으로 문서를 맞출 것을 권장한다.
4. **서버 내부 공급자 주체**: START 현재성 관측과 실행기 보호 저장 관측도 D2와 같은 "누가 어떤 권한으로 확인하는가" 문제가 있다. D2 결정과 같은 원칙을 적용할 것을 권장한다.

## 4. D2 — 맥락 묶음 공급자의 권한 주체

### 4.1 문제

자료 GET은 실행기 credential로 들어오므로 HUMAN 세션이 없다. 그런데 기존 맥락 원문 reader(`ProjectContexts.readStartSource`, `ProjectContextSources.resolve`)는 `AuthenticatedIdentity`(사용자 actor)를 요구하고, 현재 프로젝트 회원 여부를 검사한다.

2026-11-11 결정(WORK_STATUS l.18746)의 내용:
- 채택: 서버 주입 공급자
- 미채택: START한 사람 권한으로 재조립, START 시점 원문 저장
- 남긴 것: "실제 공급자의 권한·구현 주체는 후속 결정"

참고 사항 세 가지:
- START 자료 등록 계약은 HUMAN 고정 조회를 실행기 원문 접근 허가로 전용하지 않는다고 정해 두었다(`FN08_START_MATERIAL_REGISTRATION_CANDIDATE_20261106.md` l.16).
- 합성 경로 계약(`FN08_START_CONTEXT_SOURCE_CANDIDATE_20261106.md` r2)은 원 START actor로 재조립한다. 이 actor 모델은 **합성 경로에 한정**되며 normal에는 이미 미채택됐다.
- 기존 resolve는 프로젝트·회원 행을 `FOR UPDATE`로 잠근다(`context-sources.ts:30`). 그대로 재사용하면 프로젝트 쓰기와 경합한다.

### 4.2 선택지

**A안(권장): 실행 grant에 결박된 서버 내부 전용 읽기**

- **허용 범위**: START가 등록한 정확한 `contextBundleRef` 하나만 읽는다. 등록된 길이·hash와 같을 때만 쓰고, 일반 문서 조회 권한은 열지 않는다.
- **허용 조건**: 읽기 직전에 다음을 확인한다.
  - grant가 현재 유효하고 회수되지 않았다.
  - 실행 세대와 credential 세대가 일치한다.
  - 원 START 명령·자료 등록 행이 그대로다.
  - 프로젝트가 보관(archive) 상태가 아니다.
  - 해당 맥락이 격리·정정되지 않았다.
- **구현**: 사용자 actor를 흉내 내지 않는다. 등록 행을 기준으로 원문을 다시 조립하는 내부 전용 함수를 새로 둔다. 회원 행 잠금 없이 읽기 전용으로 동작한다.
- **감사**: 읽을 때마다 기존 자료 영수증에 결박한다(bytes 미저장).
- **장점**: 이미 정한 원칙(서버 주입, START 시점 원문 미저장, START 사람 권한 미사용)과 맞는다. 범위가 등록된 맥락 하나로 좁다.
- **단점**: 같은 원문을 만드는 조립 경로가 하나 더 생긴다. START 조립 결과와 바이트가 같다는 것을 시험으로 고정해야 한다(현재 `startContextBody` 공유로 일부 보장).

**B안: 시스템 서비스 주체 신설**
DB 역할 또는 `user_roles`에 Anvil 내부 서비스 주체를 두고 일반 reader를 그 주체로 호출한다. 범용이지만 권한 모델에 새 주체가 생긴다. 이는 TD-02(사람 로그인만 정의)를 넘어서는 권한 변경이고, 범위를 좁히는 장치를 따로 만들어야 하므로 **권장하지 않는다**.

**C안: 이미 미채택된 방식 재검토**
START 사람 권한 재조립이나 START 시점 원문 저장을 다시 검토한다. 2026-11-11 결정을 뒤집는 것이므로 신산님의 명시 재결정이 필요하다.

### 4.3 A안 채택 시 반영 범위

- 계약 문서: 내부 전용 읽기 함수의 입력·검산·실패 코드·감사.
- source: 서버 공급자 구현과 조립 경로, 합성 시험(START 조립과 바이트 동일, 회수·격리·보관·세대 불일치 거절, 잠금 경합 없음).
- 미적용 SQL: 필요하면 읽기 전용 함수와 권한. 실제 적용은 D1의 P2 단계에 포함한다.
- 제외: 실제 DB 적용, 실제 Agent, 실제 키.

## 5. 결정 요청

1. **D1**: A(단계 분할, 권장) / B(일괄) / C(보류)
2. **D1 부속**: credential 갱신 (a) 재교환(권장) / (b) HUMAN 재승인. grant 수명 (a) 현행(권장) / (b) 확장.
3. **D2**: A(grant 결박 내부 전용 읽기, 권장) / B(서비스 주체) / C(재검토)

D1 A와 D2 A를 채택하면, 다음 작업은 2단계 서버 source(normal permit 등)와 D2 공급자 계약·source다. 실제 DB 적용(1단계)과 실제 실행(4단계)은 그때 정확한 실행 범위를 따로 올린다.

## 6. 범위 밖과 미결

- 이 문서와 관계없는 기존 PMO 결정 대기 두 건(e59592e3, 239845d6)은 FN03 관련이며 그대로 유지한다.
- Oracle 운영 환경 배포는 별도 승인 대상이다(설계서 l.847, WORK_PLAN IX08).
- 개발 DB 복구 상태가 확인되지 않았다(WORK_CHECK). P2 단계 전에 확인해야 한다.
