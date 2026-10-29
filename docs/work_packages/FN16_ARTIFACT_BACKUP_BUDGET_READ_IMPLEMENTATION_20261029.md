# FN16 원문 읽기 전용 협력 예산 전달 선행 WI — 2026-10-29

상태: 사전 검수 후보 / 제품 GO 전. 기준 codex/av3-stage-b 94737bf64cd7e4274a1733dbd0dc41db935c9423. 기존 FN16 source-only 승인 안에서 기준선 원문 보호 조회 연결에 필요한 최소 저장 계층 보완이다. 실제 파일/DB/키/서비스 실행 승인이 아니다. Main 관리·검수·통합, 기존 Primary 단독 writer, 기존 Reviewer 읽기 검수다.

## 1. 수정 이유와 허용3경로

기준선 원 GET는 실제 원문 bytes/hash 오류503을 전체 거절한다. 이 검사를 metadata 미확인으로 대체하지 않는다. 기존 FN16 verifier는 DTO 반환/자체 Buffer 폐기라 원 Buffer를 소비하는 기존 경로를 직접 대체할 수 없고, 선검증 후 원 reader 재호출은 같은 바이트 검증이 아니다. 먼저 기존 실제 읽기에 backup 전용 선택 제한을 추가한다.

- apps/server/storage/artifact-store.ts: read(projectId,artifactId,expected,backupBudget?)의 새 선택 분기와 실제 open한 handle의 내부 알고리즘 연결만. 원 SHA256 37695BBC4AA691CD2011DC2346F78EBA9181D1EA2BB64EF40D1DEC66274AD01D.
- 신규 apps/server/storage/artifact-backup-budget-read.ts: 제한 객체 생성과 owned-handle chunk 알고리즘만.
- 신규 tests/unit/FN16/artifact-backup-budget-read.test.ts: 같은 실제 알고리즘의 합성 반례와 source 접점 검사.

원 인자 없는 read의 #directory/lstat/#bytes 경로·put·모든 DRAFT·#bytes 원본문은 유지한다. 같은 file에 있는 완료 코드를 바꾸는 이유는 위 선택 경로 추가뿐이며 Main이 전후 diff를 대조한다. documents/baseline 전달·inventory·기존23조합·SQL/권한·공개 API/route·기존 ByteVerifier/readonly reader·보호8 변경0. 새로운 provider/권위 proof/OS 도구/의존성 도입0이다.

## 2. 제한의 의미와 실재 접점

예정 내부 접점은 createArtifactBackupReadBudget({maxBytes,deadlineMs},signal) 및 readOwnedArtifactBackupBytes(handle,expected,budget):Promise<Buffer>다. 이름/내부 타입의 경미한 보완은 Main에 근거를 전달한다. budget은 공유 읽기 제한이며 인증/원문 권한·검증 proof가 아니다. 잘못된 budget을 기존 무제한 경로로 fallback하지 않는다. 유한 양의 안전정수·유효 signal/고정 시작시각을 검사하고 caller가 상태를 초기화해 누적량을 되돌리지 못하게 한다. 정수 누적 overflow는 성공으로 바꾸지 않는다.

실제 ArtifactStore는 기존 UUID·size/hash 검사를 그대로 적용하고 #directory의 canonical path·symlink·owner/mode 검사, 최종 lstat symlink 확인·O_RDONLY/O_NOFOLLOW open을 보존한다. open 후에는 즉시 helper에 소유권을 넘겨 처음 기한 검사에서 실패해도 정확 close가 실행되게 한다. open 전 경로 작업 전후에도 협력 검사를 한다. 검증했다고 주장하는 caller boolean이나 임의 root/provider를 새 접점으로 받지 않는다.

helper의 handle은 stat/read/close만 요구한다. 직접 경로를 열거나 권한을 부여하지 않는다. 기존 regular-file·nlink1·20MiB 상한·owner/mode/expected bytes/hash 가드를 유지한다. 실제 FileHandle과 합성 owned handle이 동일 알고리즘을 사용한다.

## 3. 읽기·예산·회수

한 번 읽기는 최대64KiB, 부분 read를 합쳐 정확 선언 길이를 처리한다. 선언 길이 뒤 최대1byte EOF probe 또는 동등한 정확 전체 길이 검사를 한다. 0byte 정상·짧은 EOF·초과·비정상 bytesRead·hash 불일치는 구분해 닫는다. 성공 반환은 실제 검산에 사용한 동일 Buffer이며 verifier DTO로 바꾸지 않는다.

하나의 budget을 여러 순차 read에 공유한다. 실제 읽은 바이트는 실패/취소/hash 오류에도 되돌리지 않는다. EOF 초과 탐지 바이트도 누적한다. budget을 공유한 동시 read는 명시 거절해 한도를 우회하지 않으며, 다른 read의 소유 상태를 잘못 해제하지 않는다. 파일별 상한과 누적 제한을 모두 유지한다.

IO 전후·hash 계산 후·close 후·성공 반환 직전에 취소/요청 기한을 확인한다. 이는 협력적 검사다. 진행 중 read/close를 기다리며 Promise.race로 버리거나 먼저 zero/close 성공 처리하지 않는다. OS IO가 계속 pending이면 절대시간 강제 중단/회수·기한 내 반환은 보장하지 않는다. 이 보장은 미구현/미검증으로 남기며 실행 ready를 주장하지 않는다.

handle은 정확1회 close한다. close 실패/불명은 abort/deadline/read 오류보다 우선하는 고정503이며 원 예외/경로/bytes를 메시지로 노출하지 않는다. 실패 시 자체 누적 Buffer·chunk·probe를 zero화한다. close 실패 또는 close 후 기한 초과면 성공 예정 Buffer도 지우고 성공0이다. 성공 Buffer를 먼저 반환한 뒤 close하지 않는다.

## 4. RED→GREEN와 검수

신규 모듈/선택 경로 부재의 실제 RED를 먼저 남긴다. 실제 filesystem IO 없이 메모리 owned handle로 동일 helper를 실행한다. 정상 Buffer/hash·0byte·64KiB 경계·부분 read, 짧은 EOF/초과/비정상 read/hash, 두 파일 공유누적/실패 소비 유지/동시 read 거절, 전중후 취소/기한, 진행 read가 끝난 뒤 실패·정확 close1, stat/read/close 복합 실패·503 우선·모든 자체 Buffer0/성공 Buffer 보존을 확인한다. 실제 가드 호출선과 기본 read/put/DRAFT 원본문 불변을 source 대조한다.

path/NOFOLLOW/owner/link는 이번 source 접점 대조이며 실제 FS/OS 방어 검증 PASS가 아니다. 실제 root/사용자 파일·Secret·DB·서비스·Agent에 접근하지 않는다. fake 알고리즘이나 성공 provider를 별도로 만들지 않는다. 기존 모든 storage/문서/백업 전수시험·build 반복0. 신규 합성 시험, typecheck, diff check와 독립 C0/I0 후 Main이 동일 범위를 직접 검증한다.

Primary는 정확3파일/hash, RED/GREEN 명령/exit, 실제 오류 횟수·미실행·남은 작업을 제출하고 writer를 해제한다. Main은 결과/현황/계획을 기록하고 해당 allowlist만 같은 branch에 게시한다. main/PR/실환경 전환0이다. 후속 문서·기준선 전달과 실제 백업 수집은 별도 미완료로 유지한다.
## 5. 사전 I1 보완 — 회수 불명 이후 재사용 차단

최초 WI27971107 사전 검수의 C0/I1을 반영한다. close 실패/불명은 budget의 sticky cleanupUnknown/poison으로 보존하며 busy 해제만으로 정상화하지 않는다. 이후 동일 budget은 stat/read와 새 파일 open 전에 고정503으로 거절한다. 원 handle close를 재시도하거나 이미 회수했다고 주장하지 않는다. ArtifactStore는 경로/open IO 전 budget 상태를 검사한다. 내부 helper에 이미 새 handle 소유권이 넘어온 경우는 stat/read0이더라도 그 새 handle의 정확1회 close 의무를 유지하며, 기존 실패 handle은 다시 닫지 않는다. 동시 호출 거절은 진행 중 다른 read의 점유를 해제하지 않는다.

close 실패 후 같은 budget 재사용의 stat/read0·기존 handle close 재시도0·새로 양도된 handle close1·새 실패 Buffer0 반례를 추가한다. 후속 문서/기준선 전달·권한·실제 OS 영향은 추가하지 않는다.
## 6. signal 의미 확정과 극단 누적 경계

Main 내부 상세화: 이 backup 전용 budget의 signal은 필수 AbortSignal이다. 생략/null/잘못된 signal은 입력400이며 deadline-only로 fallback하지 않는다. 기존 인자 없는 ArtifactStore.read와는 별개이며 기본 제품 호출의 계약은 바꾸지 않는다. 동일 함수의 생략 거절 반례를 추가하고 합성 fixture는 정상 signal을 명시한다. 이는 앞선 §2의 유효 signal 검사를 명확히 한 것으로 새 공개 API/권한/실행 허가가 아니다.

검수에서 발견한 누적 Number.MAX_SAFE_INTEGER 포화 뒤 동일 budget의 빈 읽기 가능성은 약9PB 누적이 필요한 극단 한계다. 이번 Important로 승격하거나 장시간 시험/실사용 범위를 확대하지 않는다. 원 누적 overflow 자체는413으로 거절하며 한계를 결과에 명시한다. 향후 실제 연결 전에 sticky exhausted 보완 여부를 대조한다.