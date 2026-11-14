# FN08 normal SEND 실행기 자료 소비 결과

## 판정
source-only 구현·독립 검수 완료. 실제 실행기 설치/내구 수신/Agent 실행 및 전체 계획은 미완료다.
기준 main914e5bb8, 작업branch codex/av3-fn08-send-material-consumer, WI 게시2fdf0e58. 기존 Primary 단일writer, Main 검수·통합, 독립 spec/quality 모두 C0/I0/M0.

## 변경과 사용자 기능 연결
기존 START 전용 판독을 채택 SEND 형상에 한해서 확장했다. 서버 혼합page를 보호GETclient가 검산하고, INSTRUCTION 단일그룹의 partsRef와 instructionRef를 따로 결박한다. 순차 보호GET으로 여러 부분의 한글/이모지 원문을 재조립한다. START의 JSON 두그룹과 문자중간 분할 호환은 유지한다. 제품2파일·시험3파일만 변경했다.

수신 반환은 RAM bytes/text와 실행권한false이며 cursor확정·내구저장·permit·SDK수락을 하지 않는다. 명시 재호출까지 영구 봉인하는 내구 수신기가 아니다. 오류/UNKNOWN/취소/기한/clock역행 뒤 자동후속GET이 없고 부분bytes를 정리한다.

## 검증
- 목적 RED: 실제 RAM 서버 혼합page를 기존codec이 COMMAND_PAGE_ITEM_INVALID로거절1F(118fac).
- 수행자 직접/인접6파일45P/0F/0SKIP exit0 24613.513ms(b668c3), typecheck0(c64755), diff0.
- Main fresh 직접2파일24P/0F/0SKIP exit0 17039.342ms(479a2f→13689f), 최종5지문동일·diff0(ea6989).
- 명령: node --experimental-strip-types --experimental-test-module-mocks --test --test-reporter=tap tests/unit/FN08/normal-start-material-consumer.test.ts tests/unit/FN08/normal-instruction-material-consumer-journey.test.ts
- 수행자 인접은 위2파일과 normal-start-materials-journey.test.ts, normal-start-execution-journey.test.ts, normal-start-polling-journey.test.ts, normal-protected-credential-journey.test.ts(모두tests/unit/FN08). root npm run typecheck 사용.
- 반례: 부분/전체hash·ref·offset·UTF8·크기/건수·정정/격리·회수·만료·취소·wall/monotonic역행·중간응답유실·await중caller변조. START거절/별도실행scope도확인.

## 오류와 한계
초기fixture challenge대상app오배선과UTF8미지정script오류를고친뒤목적RED를확인했다. 회수시험404를412로예상한1F는기존normal-request-challenge의NOT_FOUND와맞춰수정했다. 독립검수는다음challenge에서거절되므로material GET은첫1회뿐임을확인했다. root타입6진단은명시part필드와STARTassembler의INSTRUCTION거절로보정했다. 보호나기대결과를느슨하게바꾸지않았다.
실제TLS/DB/키/권한/서비스/SDK/Agent/실자료조사/설치0. RAM주입DB와HTTPS adapter시험은실환경성공아니다. 기존SDK READ3 DNS실패/승인소진과전체계획미완료는유지한다.

## 다음 및 복구
다음은기존승인안의SEND전용내구수신·attempt·permit연결이다. 기존START행을SEND로재해석하거나합성권위를NORMAL로바꾸지않는다. rollback은이한정source커밋revert이며실제DBrollback은없다. Main정확branch게시/PR/mergedsmoke후정리예정.

## 동결 working-byte SHA256
Git LF 정규화 blob과구분한다.

| 경로 | SHA256 |
|---|---|
| apps/connector/runtime/normal-start-material-consumer.ts | 93FD880A7DA46E59747A80CBF8FC633CA39ECC45D00286DC264A5233944406F6 |
| apps/connector/runtime/normal-protected-get-client.ts | E92F60244B4CBB7D0D715BEC292EE0D8A9F734A030C84FBB11AACE53415BE775 |
| tests/unit/FN08/normal-start-material-consumer.test.ts | 25B523C463822DFAE209C3FCB9EEC580CF00AB1AF1191FB2450BC9CFF3E86550 |
| tests/unit/FN08/normal-instruction-material-consumer-journey.test.ts | 17B82C110F108BAC20AC55A10FB47517083D448B7A8EC83E59A5741CA69F88F0 |
| tests/unit/FN08/normal-instruction-dispatch-fixture.ts | 0732FE185A89583F249E416389AB6B9139AA6E139FF73FD8BDD70EDDC152B57E |
