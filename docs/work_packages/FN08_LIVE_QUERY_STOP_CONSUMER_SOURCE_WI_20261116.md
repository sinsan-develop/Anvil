# FN08 원 Query의 협력 중지 소비 지시서

수정 r2: exported 목적 함수에서도 입력 접근자나 callback을 실행하기 전에 자기 호출의 선점을 확정한다. 입력은 접근자를 호출하지 않고 검산하며, 예외·finally는 아직 자기 토큰을 소유한 경우만 해제한다. 기존 단발·경합 조건의 보완이며 새 권한이나 CURRENT 생산자를 추가하지 않는다.

## 기준과 담당

WORK_PLAN FN08/FN13, 직접 채택된 FN07 계약86A461 §5, FN08_NORMAL_STOP_TARGET_PAGE_CANDIDATE_20261115 §2~5를 따른다. PMO도 기존 현재성·권한·OS 검사와 실제 공급자 부재 시412를 유지하는 소스·RAM 소비는 기존 승인 범위라고 확인했다. 후속 SEND의 새 긍정 종단과 cursor 의미는 이 단위에 포함하지 않는다.

시작 main은 PR144 병합본 a86705e5f5364416d25f23c479df3058aab70e22다. 작업 브랜치는 codex/av3-fn08-live-stop-consumer다. 기존 developer_primary만 제품을 수정하며 Main은 검수·통합과 작업현황을 맡는다. 다른 담당자의 변경은 되돌리지 않는다.

## 정확한 쓰기 범위

제품3개:

1. apps/connector/runtime/normal-first-send-owner.ts
2. apps/connector/runtime/normal-stop-coordinator.ts
3. apps/connector/runtime/normal-start-polling.ts

시험3개:

1. tests/unit/FN07/normal-first-send-owner.test.ts
2. tests/unit/FN08/normal-stop-coordinator.test.ts
3. tests/unit/FN08/normal-stop-polling-journey.test.ts

결과서는 docs/04_test_reports/AV3/FN08_LIVE_QUERY_STOP_CONSUMER_SOURCE_RESULT_20261116.md에 작성한다. 기존 STOP 자료 판독·strict stopAttempts·spool·SDK 출력·서버·SQL·빌드 목록은 읽고 재사용한다. 추가 경로가 꼭 필요하면 기술 이유와 영향을 Main에게 먼저 알린다. WORK_STATUS·WORK_CHECK·WORK_PLAN은 Main이 갱신한다.

## 구현 조건

1. 기존 REQUEST_STOP 봉투와 원 START command/ref/hash, grant·등록·논리 session·role/binding generation·stopScopeRef·현재 ownership을 전부 대조한다. UUIDv5/ref의 내용 일치와 현재 소유 권위는 다른 조건이다. 원 SEND의 osOwnershipRef나 Source.check의 profile digest, 과거 행·SDK SID·PID를 STOP CURRENT로 대용하지 않는다.
2. 실제 STOP CURRENT·서명/계보 reader가 없는 기본 제품 경로는 기존412 또는 로컬 OWNER_UNAVAILABLE와 append/interrupt0을 유지한다. 이 단위는 새 CURRENT/등록/OS 권위 생산자를 만들거나 raw callback·JSON을 권한 근거로 등록하지 않는다. 필요한 소비 의존성의 RAM 포트는 원 프로토콜의 순서와 값 대조만 검증하며 실제 CURRENT·SDK 권위가 아니다. 테스트 우회 모드나 기본 가짜 공급자를 제품에 넣지 않는다.
3. 원 첫 SEND를 정상 마친 LIVE lease의 같은 worker·Query·시도·scope와 별도 STOP 현재성 근거가 모두 맞아야 한다. 원 객체·원 interrupt 메서드와 기한을 고정하고, input/stop 및 서로 다른 STOP의 경합·동기 재진입을 직렬화한다. LIVE·원 store·기존 선점의 확인 직후 외부 접근 없이 자기 토큰을 선점한다. 그 안에서 입력을 접근자 호출 없이 검산하며, finally는 자기 토큰이 유지된 경우만 해제한다. 다른 owner의 Query/iterator를 정리하거나 새 Query를 생성하지 않는다.
4. 빈 원장에서만 새 요청을 선점한다. 기존2행의 정확한 형상은 유지한다. 첫 STOP_ATTEMPTED를 append·sync·재판독하고 거래가 정상 닫힌 뒤 현재성·기한·원 객체/메서드를 다시 검산한다. 그 뒤 원 Query에 명시한 협력 interrupt를 한 번만 전달하고 STOP_UNCONFIRMED를 보존한다. 첫 거래의 닫힘 불명, 취소·만료·소유 상실은 호출0이다. 호출 이후 결과 불명은 자동 재호출하지 않는다. source.close나 ownerSignal.abort를 interrupt 전달 또는 OS 종료로 바꾸어 말하지 않는다.
5. 기존 역사 판독을 보존한다. 1행만 있으면 UNKNOWN, 2행이면 STOP_UNCONFIRMED다. 두 행 모두 기존 STOP_UNCONFIRMED 관측과 원 ref·시각을 사용한다. STOP_ATTEMPTED만으로 STOP_REQUESTED를 소급 발행하지 않는다. 새 live 호출 경계가 직접 관측돼 spool에 정착한 경우에만 그 요청 관측을 보관할 수 있다. 두 행만으로 유실된 호출 사실을 반드시 재구성하는 기능은 제공하지 않는다.
6. 기존 spool 사건과 eventId를 보존하고 마지막 필수 관측까지 연속 ACK를 확인한다. 200+1 batch·응답 유실·재시작에서도 interrupt를 다시 호출하지 않는다. 관측 ACK 뒤에도 실제 종료·writer 해제는 미확인이다. STOPPED나 실행 완료로 승격하거나 새 긍정 cursor 의미를 추가하지 않는다. 행 정착·ACK·실제 중지의 증거를 각각 구분한다.
7. 실제 SDK module/hook·STOP CURRENT·등록/보호 배정 생산자는 미연결로 남긴다. 별도 미채택9E98 배정과 후속 SEND 종단 결정을 대신하지 않는다. 기존 START/첫 SEND/일반 응답·STOP 역사와 오류 코드를 유지한다.

## 검증·보고

RAM에서 정상 첫 SEND로 만든 원 Query와 독립된 시험 CURRENT 사실, 명시 interrupt 대역을 사용한다. 이는 실제 등록 owner나 OS 소유 증거가 아니다. 실패 반례를 먼저 재현하고 정상 닫힘 전 호출0, 이후 같은 Query에 호출1, 원 메서드/target/scope/owner/기한 변경, 동시·재진입 STOP, input/stop 경합, close·interrupt·취소·늦은 결과, 부분 행·관측 유실·ACK 두 batch와 재시작 추가 호출0을 검사한다. 거절된 getter 입력이 정상 STOP과 제3 STOP을 끼워 넣어도 타 호출의 선점을 해제하지 못하고 interrupt는 최대1이어야 한다. 실제 CURRENT 부재는 반드시 기본 거절 경로로 시험한다.

변경 범위의 직접·인접 회귀, root 타입, 기존46 source 메모리 빌드와 diff를 선택한다. 미추적 파일이 새로 생기면 staged/main 대비 전체 공백 검사에도 포함한다. 동일 로직의 검사를 불필요하게 반복하지 않는다. 결과서에는 정확한 명령·종료 코드·건수·지문·오류 횟수·미검증·남은 작업·rollback을 남긴다.

실제 DB·권한·키·사용자/백업 파일 조사·서비스·SDK/Agent/C# 실행·추가 SDK 조회·P03 실행은 금지한다. 정상 SDK에서 실제 중지가 가능해졌다고 보고하거나 전체 계획 완료 체크를 올리지 않는다.
