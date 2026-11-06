# FN07 고정 SDK 공개 생성 포트 원문 확인
- 일자: 2026-11-06
- 범위: 신산님이 직접 승인한 공개 원문 읽기 1회.
- 담당: 기존 읽기 담당자. Main 중복 조회0.
- 실행: a840aa, Node 내장 모듈/HTTPS/메모리 gzip·tar, exit0.
- 소진: metadata1회·tarball1회·자동 재시도0. 추가 조회 승인으로 재사용하지 않는다.

## 고정 원문 검산
공개 패키지 @anthropic-ai/claude-agent-sdk 버전0.3.224와 metadata의 고정 tarball URL을 대조했다.
- metadata3818B/SHA256 C7A65EBDCBB0058744F5245251E8CCD73CA6E492015BF7DF43245E3FCC234520
- tar1110841B, metadata sha512 integrity와 다운로드 계산값 동일
- 압축해제4056576B, 최대16MiB
- sdk.d.ts333809B/SHA256 556277033B15112811922D84EC8DC846D446CCE7BD9AA27765C52A9C09869575
- sdk.mjs1145192B/SHA256 70E00A3EE54A88382CA606893AC3C4ACDD9BB83A9E11A9D3E803FA0B63389ED5

원 SDK 파일은 저장하지 않았다. 이 파일은 확인 결과이며 SDK 소스 복제본이 아니다.

## 확인한 생성 포트
SpawnOptions의 필드는 command:string, args:string[], 선택 cwd:string, env의 문자열/undefined 값 맵, signal:AbortSignal이다.

SpawnedProcess는 stdin의 Writable과 stdout의 Readable, killed/exitCode 및 선택 signalCode를 제공한다. kill(signal)은 boolean을 반환하며 exit/error의 on/once/off listener 계약이 있다. 별도 stderr 필드는 선언돼 있지 않다.

두 타입의 전체 선언·주석을 확인했고 출력 잘림은 없다. signal은 caller의 즉시 취소 신호와 동일하다고 가정할 수 없다. ProcessTransport가 stdin EOF 및 약2초 정상 종료 유예 뒤 전달하는 의미가 주석에 있다. 이 시간은 확인 사실이며 Anvil의 기존 timeout을 연장하는 승인이 아니다.

## 아직 증명하지 않은 부분
- 실제 SDK import/query·process 생성·stdin 공급·exit/회수 동작
- callback의 command/args/env를 기존 profile 선언과 안전하게 결박하는 실제 producer
- 실제 실행파일·cwd/host/sourceRoot 현재성·Secret 제공/폐기
- 도구 요청/결정·SID 보호 claim·Agent 응답/사용자 인수
- 실제 DB/권한/키/서비스/Agent 실행

선언만으로 process 소유/종료·권한을 증명하지 않는다. SDK default spawn이나 합성 성공으로 위 미완료를 대신하지 않는다. 다음 단계는 기존 로컬 역사 근거와 실제 source를 대조하는 것이며 같은 npm 원문을 다시 조회하지 않는다.
