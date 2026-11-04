# FN06 동결 checkpoint I2 보완 지시

2026-11-04 · 기존 Primary 단독 구현 · Main 제품 수정0
부모: FN06_FROZEN_CODEC_PROFILE_REVIEW_20261104.md 및 직접 source 채택.
Main 독립 실행 e46eec: contract/profile 18PASS, fail0/skip0/628.8509ms/exit0, 동결 6경로 전후 지문 일치. 이 시험만으로 아래 미검사 기한 반례를 통과한 것으로 보지 않는다.

## 열린 finding 두 건

### I1-A: artifact reader 내부 IO 기한
품질 검토 반환: scripts/publish-native-channel-profile.ts:32–44의 reader는 expected를 복사하지만 기한을 검사하는 clock/check를 받거나 호출하지 않는다. :38–39에서 lstat/realpath/readFile을 연속 await하고 :44에서 다음 파일도 계속 읽는다.
첫 lstat 또는 manifest 읽기 중 실행계획이 만료되면 이후 보호 package 파일 IO를 계속 수행한다. publisher의 사후 fresh가 intent/DB 진입은 막지만 이미 수행한 파일 IO를 막지 못한다.
같은 보호 실행계획의 기한 검사를 각 IO 전·await 후에 연결한다. fake IO가 시계를 만료로 진행시키면 후속 IO0·intent0·DB0임을 실제 RED→GREEN으로 확인한다. 실제 FS나 보호 파일은 읽지 않는다.

### I1-B: profile 반환 직전 만료
계약 검토 반환: native-first-receive-profile.ts:26에서 profile 기한을 검사한 뒤 :27은 원문을 복사하고 fresh를 호출한다. fresh :21은 session·lease만 검사한다.
원 session이 profile보다 오래 유효하고 복사·마지막 check 중 profile 기한이 지나면 만료된 ACTIVE profile 본문을 반환할 수 있다. 정상 fixture에서 마지막 check가 clock을 profile.expiresAt로 진행시키는 반례를 실제 RED→GREEN으로 확인한다.
최종 반환 직전 같은 시간 관측으로 profile issuedAt/expiresAt와 session·lease를 모두 검산한다. 기한을 연장하거나 반환 전에 이미 읽은 자료를 숨겨 PASS로 만들지 않는다.

## 수행·검수
기존 6경로 동결은 이 지시 수신 뒤 해제한다. 기존 Primary가 허용 목록 안의 profile source/publisher/profile 시험을 우선 최소 보완한다. 필요한 타입 접점 외 다른 파일을 넓히지 않는다. 기존 wrapper/parser/원 native 의미는 유지한다.
두 실제 RED 재현·각 보완 diff·정확 명령/종료·실제 출력·새 지문을 반환한다. 기본 profile 시험과 실제 변경 분기만 검증하며 31개 이전 합산이나 전체 테스트를 반복하지 않는다. Main은 covering test가 확인된 뒤 같은 두 검토자에게 해당 fix diff만 재검수시킨다. 수정 후 다시 동결 범위를 명시한다.
이는 기존 구현 기준 누락의 보완이며 새 사용자 승인을 요청하지 않는다. 정식 FAILURE_REPORT0, 같은 근본 원인의 정식 실패3회 인수 조건은 발생하지 않았다. 실제 DB·권한·키·서비스·Agent·컴파일·J3/P03 R3·실자료 조사는 계속0이다.
## 재검수 1회차

수행자 제출: 실제 RED2에서 첫 lstat 만료 뒤 IO39회 지속과 마지막 check의 profile 만료 반환을 재현했다. 보완 후 해당2PASS/158.3907ms/exit0, 정확 node --test tests/unit/FN06/native-first-receive-profile.test.ts는12PASS/skip0/420.6911ms/exit0, root noEmit exit0를 보고했다. 이는 수행자 증거이며 원18/31과 합산하지 않는다.

다음 3경로를 다시 동결했다.
- apps/server/modules/executions/native-first-receive-profile.ts: 0d570d22cb92f710862ac526a7c4a189ef45fe733dd52fb9b26f398019dbadc4
- scripts/publish-native-channel-profile.ts: 3ec05abe451fdde132baa00a2a6dbcbc1002b65be1d823338609a236602b5018
- tests/unit/FN06/native-first-receive-profile.test.ts: d68fc1f072baa6b84de6cf72906757cd6846b61c966093fb8f7ead7a5bb8067b

기존 계약 검토자는 I1-B, 기존 품질 검토자는 I1-A와 수정으로 새로 생긴 경계 문제만 읽기 재검수한다. 이전 전체 검토를 반복하지 않는다. source와 covering tests의 실제 수정 범위·전후 지문·ADDRESS 여부를 반환한다. writer는 Store/0076을 계속하므로 해당 작성 중 파일의 변경이나 부재를 이번 finding으로 세지 않는다. 읽기만 하고 시험/실환경 실행·파일 수정은0이다.

## 재검수 1회차 결과·동결 해제

Main 163ddc: 정확 profile 시험12PASS/fail0/skip0/209.1937ms/exit0. 새 source/시험3개와 codec 의존성의 전후4지문 일치.
기존 두 독립 검토자는 I1-A·I1-B를 각각 ADDRESSED, 해당 수정분 C0/I0로 반환했다. artifact 각 IO 직전/직후 같은 기한 검산, 최종 profile/session 같은 시간 검산과 새 반례 시험을 확인했다. 기존 원문/경로/TLS/UNKNOWN 기준 변경0이다.

해당3경로 동결을 해제한다. Primary는 같은 source-only 범위의 Store/0076 및 후속 S3~S7 구현을 계속한다. 이 결과는 codec/profile의 현재 검수 범위만 증명한다. 전체 S2·실제 PG/RLS/TLS·브라우저/native/Agent·계획 인수는 미완료다. 후속 코드가 바뀌면 그 영향만 검증한다.
