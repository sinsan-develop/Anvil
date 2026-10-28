# FN16 원문 바이트 검증 — 내부 source 작업지시

2026-10-29 · Main 어울 · 기준 codex/av3-stage-b / 2a7cfa4e1a7f68df4db76744ccedc195760497d9

## 목적·범위
설계 §10.4 / FUNCTION_WORK FN16의 원문 크기·hash·누락 검사의 최소 구현이다. 기존 사용자 FN16 source/합성 승인과 내부 상세화 위임으로 진행한다. 문서 inventory가 보관한 exact artifact 참조의 바이트를 검사하되, 이 함수는 인증·현재 DB 상태·파일 경로 안전을 증명하지 않는다. 실제 OS reader와 현재 권한/격리 재검사 orchestration, 전체 backup/job/bundle/복원은 여전히 미구현이다. 기존 inventory의 blobVerification=NOT_PERFORMED를 변경하지 않는다.

허용 새 파일은 두 개뿐이다.
- apps/server/modules/backups/artifact-byte-verification.ts
- tests/unit/FN16/artifact-byte-verification.test.ts

단독 기존 fn16_primary가 구현하고 Main은 문서·검수·통합, fn16_review는 읽기 독립 검수한다. 기존 ArtifactStore/설치 catalog/native·공개 route·SQL·UI·권한을 변경하지 않는다. 실제 파일/키/DB/서비스/P03/Agent 실행은 제외한다. 시험은 공개 메모리 바이트와 fake port만 사용하며 디렉터리·listener·컨테이너를 만들지 않는다.

## 내부 입력·포트·결과
- verifyArtifactBytes(input, reader, signal?) 형태. input은 닫힌 own-data 필드 projectId/artifactId/bytes/contentHash/maxBytes/deadlineMs. descriptor 값을 1회 snapshot해 검증하고 이후 caller 객체를 재사용하지 않는다. 기존 원문 저장 규칙과 동일한 소문자 UUID v1~8, SHA256 64hex, bytes 0~20MiB 안전정수, maxBytes/deadlineMs 양의 안전정수, bytes<=maxBytes를 검사한다. maxBytes는 파일별 호출 한도이며 백업 전체 정책의 기본값이 아니다.
- reader는 신뢰한 내부 port이다. open({projectId,artifactId,bytes,contentHash},signal?)은 단독 handle을 반환한다. handle.read(maxBytes,signal?)는 Uint8Array를 반환하고 길이0은 EOF, handle.close()는 정확 handle을 회수한다. optional fallback/기존 ArtifactStore.read 자동 연결은 없다.
- 각 read의 요청 크기는 min(65536, 남은 선언bytes+1). 요청보다 큰 응답/누적 선언bytes 초과는 고정 오류로 거절한다. exact bytes에 도달해도 1byte EOF 읽기를 거쳐 뒤의 추가 바이트를 탐지한다. 조기 EOF·hash 불일치는 실패다. 전체 원문을 무제한 readFile로 받지 않는다.
- 선언 크기 이하의 자체 버퍼에 동기 복사하고 SHA256과 기존 inspectArtifact를 적용한다. 기존 알려진 표식 검사 정책을 새 완전한 비밀 탐지로 표현하지 않는다. 공개 marker fixture를 사용하며 실제 비밀 입력0. 원문이 SUSPECTED면 실패한다. 내부 버퍼는 finally에 best-effort zero하고 port 소유 chunk는 임의 수정하지 않는다.
- 반환은 exact ref/검사 byte 수/hash, kind=ARTIFACT_BYTE_VERIFICATION_V1, coverage=SUPPLIED_ARTIFACT_BYTES_ONLY, byteIntegrity=MATCH, markerCheck(기존 inspectArtifact 결과), authorityVerified=false, sourceStabilityVerified=false, restorable=false뿐이다. 원문·서버경로·파일명·cause/stack·raw 오류·token은 결과에 넣지 않는다. 이 metadata는 승인/보호참조/전체 백업 manifest가 아니다.

## 시간·취소·회수
- 단조 clock(performance.now)으로 호출 시작부터 deadlineMs를 측정한다. open/read 전후 및 close 후 반환 직전에 취소·기한을 확인한다. 기한 만료/취소 후 새 read를 시작하지 않고 얻은 handle은 close를 정확1회 시도한다. timeout/abort를 성공으로 반환하지 않는다.
- 임의 port의 open/read/close promise 자체가 영원히 settle하지 않을 때 강제 종료하는 보장은 없다. Promise.race로 미회수 IO를 버린 뒤 정상 회수라고 주장하지 않는다. 실제 adapter의 bounded OS IO·cancel/close·경로/현재성 보장은 후속 구현·실제 검증 대상이다.
- open 실패 시 얻지 못한 handle을 회수했다고 하지 않는다. read/검사 실패 뒤에도 close하며 close 실패는 고정 CLEANUP_FAILED로 우선 보고한다. raw error를 그대로 재전달하지 않는다. 성공은 close 성공과 최종 취소/기한 검사 이후에만 반환한다.
- 오류 code/status: 입력 INPUT_INVALID/400, 취소 ARTIFACT_BYTES_CANCELLED/409, 시간 ARTIFACT_BYTES_TIMEOUT/408, IO ARTIFACT_BYTES_IO_FAILED/503, 크기/hash/형식 ARTIFACT_BYTES_INTEGRITY_FAILED/503, 표식 ARTIFACT_BYTES_SENSITIVE/412, 회수 ARTIFACT_BYTES_CLEANUP_FAILED/503. 기존 AuthFailure를 사용할 수 있지만 외부 port가 같은 Error를 던졌다는 이유로 그대로 신뢰하지 않는다.

## 작업·검수
1. TEST_ONLY: 공개 다중 chunk 정상·빈 원문·크기 경계, 닫힌 입력/Proxy getter/비정수/20MiB 초과, overread·추가byte·short EOF·hash변조, chunk 경계로 나뉜 marker, open/read/close 실패와 원오류 비노출, 취소/지연/기한/회수1회·close후취소, caller input 변경 반례를 작성한다. 제품 파일은 아직 만들지 않는다.
2. Main이 node --test tests/unit/FN16/artifact-byte-verification.test.ts 의 미구현 RED를 확인한 뒤 같은 담당자에게 제품 GO한다. 실행 불가와 의도된 RED를 구분한다.
3. 구현 후 같은 신규 시험·npm run typecheck·git diff --check로 확인한다. 기존 불변 전체 시험 반복0. 독립 C/I finding은 신규 반례와 최소 보정 후 재검수한다.
4. Main이 정확 파일 diff/hash·실패와 최종 증거·미검증·rollback을 WORK_STATUS에 기록한다. Primary Git/관리 문서 변경0. rollback은 신규 두 파일의 검토된 revert이며 원문/키/DB/서비스 삭제0.

현재 상태: 독립 WI 검수 전, 제품/시험 작성0. 실제 사용자 화면에서 원문 백업이 가능한 상태로 보고하지 않는다.
