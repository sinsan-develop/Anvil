# FN08 normal SEND 실행기 자료 소비 source 작업지시

상태: 기존 승인 범위 실행. Main 어울 관리·검수, developer_primary 단일 writer.
기준: PR116 main 914e5bb8529393b705f53757cd1688ceef5ca6ac, branch codex/av3-fn08-send-material-consumer.
승인: P3 D1 A안 실행기 source, normal SEND 계약 DEA72C3FB14A955E02956C50898A50ED6BE9705E911A17CB651DAFE2847FFB7C 및 부분계획 추가 F3243D1411C4FF434F4548904B99A9B0BBA353EA171FAC0314F7D99353DD91DF. 새 공개 계약·권한·지속 저장을 추가하지 않는다.

## 목적
서버의 혼합 START/SEND 명령 페이지를 기존 보호 GET client가 받아 SEND의 정확 지시 부분을 조회·검산·재조립하도록 연결한다. 현재 START 전용 codec 거절을 해당 채택 형상에 한해서 확장한다. 수신 원문 검산은 cursor 확정·내구 저장·permit·SDK 수락·Agent 실행 완료가 아니다.

## Primary 허용 경로 5
- apps/connector/runtime/normal-start-material-consumer.ts
- apps/connector/runtime/normal-protected-get-client.ts
- tests/unit/FN08/normal-start-material-consumer.test.ts
- tests/unit/FN08/normal-instruction-material-consumer-journey.test.ts (신규)
- tests/unit/FN08/normal-instruction-dispatch-fixture.ts (기본값 유지, 합성 본문 선택 입력만)

다른 writer와 같은 파일을 수정하지 않고 기존 변경을 되돌리지 않는다. Main 소유는 이 작업지시·WORK_STATUS·WORK_CHECK·결과 기록이며 제품 코드를 수정하지 않는다. Git commit/push/merge는 Main만 한다.

## 구현·보존 조건
1. START 기존 두 그룹/JSON/분할 의미 유지. SEND는 INSTRUCTION 단일 그룹이며 payloadRef=partsRef와 sourceRef=instructionRef를 각각 검산한다. 두 ref를 혼동하지 않는다.
2. 원 text/plain;charset=utf-8 또는 text/markdown;charset=utf-8을 보존한다. 연속 부분·offset·각64KiB·총2MiB·전체200부분·페이지50건/2MiB, canonical base64url·부분/전체 hash·엄격UTF8을 검산한다. START의 문자 중간 분할 허용은 바꾸지 않고 SEND만 원 codepoint 경계를 검사한다.
3. 기존 challenge·정확 요청/credential·서명·기한·no-store·취소·UNKNOWN 경계를 보존한다. 부분 성공이나 UNKNOWN 뒤 자동 재요청 없이 실패한다. 다른 command/material·정정/격리·회수·만료를 거절한다.
4. polling/intake/coordinator는 변경하지 않는다. 기존 SEND 거절·cursor 미전진은 보존한다. 합성 권위를 NORMAL로 전환하지 않는다.
5. 실제 DB·권한·키·서비스·네트워크·사용자 원문/파일 조사·설치·SDK/Agent/C# 실행 금지. 시험은 기존 RAM 주입을 사용하며 FS mock 설치 전에 제품 의존성을 static import하지 않는다.

## 검증 및 제출
첫 RED: 실제 서버 합성 START/SEND 혼합 페이지를 기존 GET client가 거절하는 것을 재현한다. GREEN은 다중 부분 한글/이모지의 원문 일치까지 연결한다. ref/hash/offset/UTF8/부분누락·중복·중간응답유실 후 추가GET0 반례와 기존 START 직접 인접 회귀를 실행한다. 필요한 root typecheck와 diff check를 수행한다. 같은 오류3회면 정식 실패 원인·증거를 Main에게 반환한다.
제출: 변경5경로 이내 diff·SHA256, 정확 명령/종료코드/테스트수, RED→GREEN·미검증·live handle0, 독립 검수 후 Main 한정 재검증. 실제 TLS/DB/Agent 증거로 승격하지 않는다.
