# FN16 문서·기준선 원문 선택 예산 전달 WI — 2026-10-29

상태: 사전검수 후보/코드GO전. 기준 codex/av3-stage-b 7ed7a72323d12a74049ecb61efa6a1d428591f7c. 기존 FN16 source-only 승인 안의 내부 전달 보완이며 공개 API/권한·SQL·실행 승인 변경이 아니다. Main 관리/검수/통합, 기존 Primary 단독 writer, 기존 Reviewer 읽기 검수다.

## 1. 이유·허용5코드

기준선 원GET는 현재 source/설계/증거 원문을 검사하며503 무결성/일반 reader 오류는 전체 거절한다. 이를 미확인 metadata로 낮추지 않는다. 앞선 선택 budget reader를 같은 실제 읽기에 전달하는 선행이다. ProjectDocuments.version도 원문을 읽으므로 originalText만 제한하지 않는다. 기존 두 읽기를 제거/중복제거하지 않고 같은 budget에 누적한다.

- apps/server/storage/artifact-backup-budget-read.ts: 기존 private known WeakSet을 사용하는 정확 isArtifactBackupReadFailure predicate export만 추가. 원 알고리즘/입력/카운터·회수 동작 변경0.
- apps/server/modules/documents/project-documents.ts: version/#artifact/originalText의 backupBudget? 전달·선택 경로 검사만.
- apps/server/modules/projects/baseline-sources.ts: resolve의 backupBudget? 전달·선택 경로 검사만.
- apps/server/modules/projects/project-baselines.ts: readDraft/#currentCheck/#basis의 backupBudget? 전달과 정확 자체오류 재throw만.
- 신규 tests/unit/FN16/baseline-backup-budget-forwarding.test.ts: 실제 메서드 호출선/원 검증을 거치는 합성 반례와 기본 경로 보존 대조.

원문 SHA256: helper C2B25D482981813C2B04BCC949D107FED04CC10BD3C06C5D36CCD69AA93FAD10; documents D7ADBFFF8FB9587DA9CBEBC7E4062D606719004337FC6EE53B1D29BDC3D1FFD7; baseline-sources 489EB550E7EC9B9CF965CE3C064C388BE85F66E5C04A48153496B093CAB2DFD0; project-baselines 321025A52A9A090AF0CFBCECBC8EC97C45423EAB4AA384F4B07D6F85850F1F0B.

원 ArtifactStore/helper 읽기 알고리즘·기존 read/put/DRAFT·기존17시험·다른 파일·보호8·SQL/정책/권한·새 route/operation·설치/등록·기존23조합·inventory 수집 변경0. 실제 FS/DB/키/서비스·Agent 실행0이다. 새 공급자/권위 proof/도구/의존성을 도입하지 않는다.

## 2. 정확 전달·기본 의미 보존

선택 budget이 제공된 경로만 진입·await 뒤·decode/해시/반환 전 기존 assertArtifactBackupReadBudget으로 검사한다. 누락은 기존 기본 동작이며 null/잘못된 값을 누락으로 취급해 우회하지 않는다. 입력/반환/기존 catch 의미는 기본 호출에서 그대로 유지한다.

readDraft → #currentCheck → #basis → sources.resolve → artifacts.read에 동일 객체를 전달한다. #basis의 설계 문서 조회는 documents.version과 documents.originalText 둘 모두 같은 객체를 전달하고 #artifact의 실제 ArtifactStore.read까지 이어진다. 여러 실제 원문 읽기를 하나로 줄이거나 검증한 DTO를 원 Buffer로 가장하지 않는다. 완료 코드 수정 사유는 이 전달과 오류 보존뿐이며 최종 diff로 확인한다.

## 3. 오류 전달과 원 보호

현재 #currentCheck는 AuthFailure<500의 409를CHANGED/기타를UNAVAILABLE로 반환한다. 이 의미는 일반 오류에 그대로 유지한다. 단 실제 helper가 발생시킨 budget 입력400·취소/busy409·기한/누적413·회수503은 기존 catch의 맨 앞에서 원 객체 그대로 throw한다. instanceof AuthFailure && known.has(error)의 정확 predicate만 사용하며 메시지prefix/동일code/status로 외부 오류를 예산 오류라고 인정하지 않는다. 이 predicate는 오류 출처 구분일 뿐 인증/권한 proof가 아니다.

UTF-8 decode의 기존 catch 안에 budget 검사/읽기를 넣어 DOCUMENT_UTF8_INVALID422로 바꾸지 않는다. 원 source/evidence missing404·격리/미설정412의 UNAVAILABLE, binding변경409의CHANGED, 실제 bytes/hash불일치503·일반 reader예외의 전체 거절은 보존한다. 원문 검사와 승인/원장 검산을 생략하는 새 metadata 경로를 만들지 않는다. #draft/#receipt/#loadDraft의 기존 검증을 바꾸지 않는다.

## 4. RED→GREEN·검수

신규 전달/정확 오류 predicate 부재의 실제 RED를 먼저 남긴다. 실제 source/documents/baseline 메서드를 호출하는 합성 메모리 DB/owned handle로 같은 budget 객체가 모든 읽기에 도달하는지, version의 첫 읽기와 originalText의 다음 읽기를 모두 누적하는지 확인한다. 단순 성공 boolean/provider만 시험하지 않는다.

정상 budget·기본 budget 미제공, 누적 한도·전중후 취소/기한·poison 회수 오류·UTF8와 독립된 예산 거절, 동일 메시지를 가진 외부 AuthFailure가 기존 의미로 처리되는 경우, 원 missing/변경/실bytes무결성의각catch를 확인한다. 반례를 여러 선행 실패에 가리지 않게 정합 ref/hash·승인/receipt fixture를 사용하고 정확 실패 이유/원객체를 확인한다. 잘못된 optional 값은 읽기 전에 거절한다.

신규 시험·앞선 artifact-backup-budget-read.test.ts17 반례만 직접 영향 회귀, typecheck/diff·기본 경로 의미 보존 및 독립C0/I0 뒤 Main 집중 확인이다. 실제 FS·Unix/Windows권한·DB·원문 파일·서비스·Agent를 실행하지 않고 전체 회귀/build 반복0이다. 실제 OS 기한/강제 회수는 보장하지 않는다.

## 5. 제출·미완료

Primary는 정확5파일/hash·RED/GREEN 명령/exit·오류횟수/미실행과남은작업을제출하고writer해제한다. Main이결과/현황/계획에기록하고같은branch정확allowlist만게시한다. main/PR/실환경전환0이다.

이번 단위는 선택 경로의 소스 전달뿐이며 실제 호출 등록·baseline inventory·기존23조합은 아직 연결하지 않는다. 약9PB 포화 한계/OS pending 절대시간 회수는 이전 기록대로 유지하며 실제 실행 연결 전 필요 보완을 다시 대조한다. 전체 FN16/WORK_PLAN 완료 또는 실사용가능 판정으로 바꾸지 않는다.