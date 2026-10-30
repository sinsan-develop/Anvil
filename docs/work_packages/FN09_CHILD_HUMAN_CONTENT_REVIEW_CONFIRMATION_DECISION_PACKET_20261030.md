# FN09 하위 임무의 HUMAN 내용검토·내용확정 한정 결정안 r1

상태: **DRAFT / NOT_ADOPTED**. 코드·SQL·권한·서비스를 변경하지 않았다. 이 문서는 신산님 또는 위임 범위의 PMO 채택 전 구현 승인이 아니다.

## 1. 필요한 결정·기존 승인과 달라지는 점
A 권장: 기존 한 단계 하위 임무 초안의 **HUMAN 내용검토·별도 내용확정·과거 확정 원문 조회**까지만 source/화면/새 미적용 forward SQL·합성 검수로 채택한다. B: 현재처럼 하위 초안 저장·개정·조회까지만 유지하고 다른 계획 업무를 계속한다. 실제 DB·정책/권한 부여·키·서비스·Agent 실행은 둘 다 제외한다.

새 범용 기능을 제안하는 것이 아니라 WORK_PLAN FN09의 부모 범위 안 하위 임무를 진행하는 다음 계약 결정이다. 다음의 명시 제한을 바꾸므로 일반 화면 연결로 몰래 구현할 수 없다.

- 기존 `docs/contracts/FN09_PARENT_DRAFT_LINK_PROPOSAL.md` SHA256 `283E8601C8951574740630D7EA4F6A1EE59260E925B20FC2C5B9579E9D326B87` §2는 초안 저장·개정/조회만 허용하고 내용검토/확정·배정·실행을 명시 제외한다. 당시 상태 표기는 이력이며, 현재 코드 차단 자체를 별도로 대조했다.
- `assignment-input.ts`의 `assertAssignmentRoot` 및 `project-assignment-confirmations.ts`는 nonnull parent의 검토/확정/확정조회에 `ASSIGNMENT_CHILD_DRAFT_ONLY/412`를 반환한다.
- `db/migrations/0034_assignment_parent_drafts.sql`은 child review/confirmation 및 이후 session/context/preparation/grant/writer 등에 직접 차단 guard를 정의한다. 실제 DB 적용 상태는 조회하지 않았다.
- 이번 A는 기존 operation의 **nonnull parent 입력 허용·저장 guard·확정 조회 의미**만 한정 변경한다. 새 operation/table/Agent 권한·기준 활성화를 추가하지 않는다.

## 2. A의 정확 기능 범위
1. 한 단계 child만 허용한다. 부모의 parent는 null이어야 하고 같은 project의 정확 내용확정 parent fullref여야 한다. 새 순환/자기참조/손자 임무·동적 reparent는 열지 않는다. 현재 부모 초안 저장에서 검사하는 계획/단계/환경/예산/기록정책 exact 동일·baseline/능력/파일범위 부분집합 기준을 그대로 소비하며 WRITE→READ나 경로 대소문자 동등성을 새로 추정하지 않는다.
2. **내용검토 저장**과 **별도 내용확정** 시점마다 현재 HUMAN/로그인/client·단독제어·기존 재인증/명시 정책·parent fullref/head/current 기준·최신 ACCEPTED parent 내용검토를 각각 다시 검산한다. 같은 transaction 안의 기존 parent 검산/잠금 규칙을 소비한다. 검토 때 맞았다는 이유로 확정 때 부모 상태를 생략하지 않는다.
3. child의 목적·산출물·완료조건 등 자유문장은 사람이 현재 child draft exact version/hash로 검토한다. 기존 검토 원형/판정/이유/근거·원 command/hash·receipt/audit를 보존하고, child 최신 적합 검토가 정확 일치할 때 사용자의 별도 내용확정만 허용한다. 자동 적합·자기 인수·모델 의미 합격 판정0.
4. parent가 바뀌었거나 현재성/범위·근거가 모순이면 새 검토/확정을 거절한다. 원 child/과거 검토/확정은 삭제·개서하지 않는다. 기존 root(null parent) 정상 흐름·과거 버전도 보존한다.
5. 내용확정 snapshot은 기존 형식의 정확 draft/definition/hash·HUMAN 주체·시각을 보관하고 **contentConfirmed만 내용 사실**로 해석한다. executionAuthorized/dispatchPerformed=false를 유지한다. 새 실행/승인/예산 권위를 만들지 않는다.
6. 과거 child 확정 원문 조회는 현재 회원/프로젝트 보호·원형/receipt/audit 무결성을 검사한다. parent 현재 적합성을 다시 보증하는 조회가 아니며 UI는 ‘부모 현재성 재검사 전·실행 권한 아님’으로 표시한다. stale parent 때문에 과거 내용 사실을 삭제/부정하지 않는다. 새 저장/검토/확정에는 항상 현재 검사를 다시 적용한다.
7. parent로 삼는 임무는 root만 가능하도록 기존 생성 consumer도 유지/보강한다. child 확정 원문 조회가 생겼다고 이를 손자 생성의 현재 부모·역할/세션/맥락/실행 권위로 소비하지 않는다.

## 3. 계속 차단할 경로·승인 의미
- 하위 `bindResponsibleSession`·role/session 예약, context 작성, 실행준비/START/SEND, grant/한도 예약·writer·경로 잠금·실제 Agent/작업 배정·자동 진행은 계속 `CHILD_DRAFT_ONLY` 계열 차단을 유지한다. 새 확정본을 실제 부모 권한 상속 근거로 만들지 않는다.
- 내용검토/확정의 기존 명시 AUTO/DENY 의미를 유지한다. 현재 연결되지 않은 REQUIRE_APPROVAL/approvalRef는 기존 `ASSIGNMENT_APPROVAL_NOT_CONNECTED/412`로 거절한다. **일회 승인 연결을 이 A에 추가하지 않는다.** 필요하면 기존과 달라지는 exact 계약을 별도 결정한다.
- DB 적용/GRANT·실 사용자 정책/계정 변경·Secret/키/인증서·서비스·Agent·비용·Oracle/운영·main 병합0. 실제 동시 writer 안전·예산 집행·OS 범위를 contentConfirmed로 보증하지 않는다.

## 4. 화면 단위 상세 시안
기존 UI04 하위 초안 상세에만 다음을 연결한다. 새 메뉴/대시보드나 임의 참조 입력은 없다.

```text
하위 임무 내용 검토·확정                   [원문 닫기]
부모  id / version / hash                 [고정 원문 보기]
하위  draft id / version / hash
관계  동일 계획·단계·환경·예산·기록정책 / 범위 부분집합
      현재 검사 필요·원형 불일치·권한/정책 부족은 각각 표시
[검토 판정] [이유·항목별 근거]             [내용검토 보관]
최신 child 검토 ref/hash·판정·검토자·시각  [검토 원문 보기]
[ ] 이 정확 버전의 내용만 별도로 확정합니다
                                         [내용확정 보관]
보관 사실: HUMAN 내용확정 / 실행 허가 없음
부모 현재성은 조회만으로 재보증하지 않음
배정·맥락·실행·writer·Agent: 계속 미지원/차단
```

빈상태/저장중/거절/결과불명·기한/부모변경·소유자/client/제어세대 전환을 구분한다. 불명 command/hash·원입력·다른 pending은 보존하고 자동 재전송/새 명령 생성0. 성공은 반환 ref의 보호 GET/hash를 재검산한 뒤 표시한다. root 화면은 변경하지 않는다.

## 5. 채택 후 구현·검수·rollback
- 현재 child 차단을 공유 parser 전체에서 제거하지 않는다. 기존 확인 class의 HUMAN review/confirmation/read 소비선만 좁히고 나머지 명시 child 차단을 보존한다. 기존0034 SQL은 수정하지 않고 새 미적용 forward SQL로 내용검토/확정의 parent 검사·원명령/receipt/audit·불완전 저장 차단을 한정 작성한다. 적용·PG 실행은 하지 않는다.
- 세부 code path·SQL 번호·기준hash·QA literal 자원은 실제 source 목록 대조 뒤 별도 WI로 고정하고 단일 기존 Primary에 전달한다. Main은 관리·검수·통합하며 동시 code write0.
- 정상 한 단계 child HUMAN review→별도확정→고정조회, review/confirm 각 parent 변경·기준/범위 확대·타project·손자/self·변조/권한/기한·REQUIRE_APPROVAL 차단·root/null 회귀·차단 후 child 역할/context/prepare/grant/writer 저장0을 검증한다. 실제 DOM/메모리 source와 PG/HTTP/실Agent·OS/경합 NOT_RUN을 분리한다.
- rollback은 한정 source checkpoint 정상 revert다. 기존 원문/SQL/실제 DB 자료 삭제·자동 down migration0. source 검수만으로 전체 FN09 또는 계획 완료로 승격하지 않는다.

## 6. 정확 결정 요청
**A: 위 HUMAN 내용검토·별도 내용확정·과거조회의 source/화면/미적용 SQL·합성 검수만 채택** 또는 **B: 현재 초안 전용 유지**를 선택한다. A는 실제 DB 적용·정책/권한·키·서비스·Agent 실행이나 하위 실제 위임 승인이 아니다. 결정 전 코드/SQL guard·버튼은 변경하지 않는다.