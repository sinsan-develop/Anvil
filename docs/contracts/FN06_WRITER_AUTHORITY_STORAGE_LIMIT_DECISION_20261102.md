# FN06 실제 writer 권위 B안 — 누적 한도 결정 보완 후보

2026-11-02 / Main 어울 / NOT_ADOPTED / source-only 결정 후보
부모: FN06_ACTUAL_WRITER_AUTHORITY_DELTA_CANDIDATE.md v3 SHA256 BF19670DAF44B01D2EAA12CB4CB8661AB573A77CF6133A5B3EC4FBAD8885533D.
부모 원문은 수정하지 않는다. 기존 D1·환경507B 승인을 이 새 계약에 재사용하지 않는다.

## 결정 범위
기존 B는 새 current/history2표·내부 원형/현재조회·최초 boundary와 같은 유효 등록 아래 lease 생명주기의 기본 미등록 source·미적용 SQL·합성 모델 구현안이다. 실제 공급자·source 강제수단·키/credential·actual grant/실통신 소비·실DB/OS/Agent는 포함하지 않는다. B 구현을 실제 Agent 연결 완료로 보고할 수 없다.
독립 계약검토 C0/I1은 append 누적 한도·포화 의미 누락이다. 권장 A는 아래 유한 한도를 source 계약에 추가하는 안이다. 대안 B는 회수 기록의 별도 용량 예약을 먼저 상세화하는 안이며, 현행 유지 C는 원장을 미구현으로 남긴다.

## A의 정확 분모·한도
- 프로젝트의 전체 epoch/lease를 합쳐 보존 events 최대10000행. head는 프로젝트당 최대1행이며 세대·epoch를 바꿔 분모를 초기화하지 않는다.
- 모든 event와 현재 head의 canonical UTF-8 bytes 합계 최대64MiB(67108864바이트). UNKNOWN·만료·회수 사실도 포함한다. DB 물리 크기/파일 quota라고 주장하지 않는다.
- 기존 payload2MiB·SourceScope target200을 유지하고 전체 event wrapper는4MiB 이하로 제한한다. caller bytes나 성공 bool을 신뢰하지 않는다.
- 기존 프로젝트 전체10GiB의 used/held와 원장 bytes를 중복 없이 합산하는 모델을 검수한다. 실제 합산 함수/다른 적용 SQL·DB는 이번에 변경하지 않는다. 실제 적용 전에 PG의 전체 합산 검증이 필요하다.
- 모든 fresh mutation은 project lock→현재head→원명령/정책/기한 검산 아래 예상 증가를 계산한다. count/bytes 초과 시 event·head·receipt를 부분 성공시키지 않고 원자 거절한다. 합성 모델은 실제 PG 원자성의 증거가 아니다.

## 포화 의미와 사용자가 판단할 위험
현재 보호 뒤 같은 원명령 replay는 기존 결과만 검산·반환하고 추가 event/nonce0이다. 현재 권한 아래 역사/고정 조회는 상한 때문에 숨기거나 삭제하지 않는다. 자동삭제·압축·이력 초기화·옛epoch 배제·환급0이다.
새 중지/회수 요청과 회수 증거 저장도 fresh mutation이면 같은 상한을 적용한다. 포화로 새 사실을 저장할 수 없으면 성공·회수확정·EMPTY/RECLAIMED로 처리하지 않는다. 기존 event/head·원 증거를 보존하고 미수용/다음 writer 차단을 유지한다. 실제 종료나 권한 회수를 추정하지 않는다.
**A에는 회수 기록 전용 용량 예약이 없다. 포화 후에는 별도 정확한 한도·보존/복구 결정 전까지 새 회수 사실도 원장에 수용되지 못할 수 있다.** 이 운영상 막힘을 명시하고, 기존 증거 덮기나 무단 삭제로 해소하지 않는다. 수용하지 못한 새 보고를 저장했다고 주장하지 않는다.
실제 Agent/WRITE 활성화는 계속 거절한다. 후속 actual grant/소비 계약에서 회수 증거의 보관 예산·실제 자원·진위/현재성·강제 수단을 고정·검증해야 한다. B source ledger가 이 선행을 없애지 않는다.

## 채택 후 검수·정확 선택
행/bytes 정확상한·초과1, 전체epoch/lease·UNKNOWN/회수이력 산입, 원replay 추가0, 거짓bytes/hash·순환/외부project·복구로 위장한 초기화 거절, 포화 시 새 회수수용 실패의 원행/head/receipt 불변을 검수한다. 기존 합성·D1정확5표·권한false·manifest미등록을 유지한다.
정확 선택은 부모 B source 계약과 이 A한도/포화 의미를 함께 채택, 회수 예산 예약을 먼저 상세화, 또는 현행 유지다. 실제 DB·권한·키·서비스·Agent·실자료·OS/IPC/socket/compiler/프로세스·비용·P03 R3는 어느 선택에도 포함하지 않는다. 채택 전 원장 schema/API/SQL/코드 구현0이다.
