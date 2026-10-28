# FN16 문서 이력 원문 목록 검증 연결

2026-10-29 · Main 어울 · codex/av3-stage-b · 기준6fce9c673b5818424b09d248d6a42210813481cd

## 목적·변경 이유
기존 문서 metadata inventory와 단일 원문 현재성 검증기를 연결하여 실제 수집 목록의 원문을 검사한다. 승인된 FN16 내부 source/합성 구현이다. 새 공개 route·archive·정책/job·SQL·runtime 활성화가 아니며 실제 파일/DB/키/서비스/P03 실행0을 유지한다. 08EA A8 전체coverage 선행 차단을 변경하지 않는다.

현재 단일함수는 호출마다 신원·기한 scope가 분리된다. 목록 전체의 최초 신원·기한과 마지막 전체 대상 상태를 연결하기 위해 같은 모듈 안의 private scope를 공유하도록 최소 변경한다. 변경 전 단일함수17개 기대는 유지하며 변경 후 직접 인접 회귀로 확인한다. 새 공통 framework나 다른 소비자 변경은 없다.

허용 코드2경로:
- apps/server/modules/backups/artifact-current-verification.ts (기존단일동작 유지·private scope와 새 내부 export 추가)
- tests/unit/FN16/document-inventory-artifact-verification.test.ts (신규)
기존 단일 시험은 변경0. 구현 fn16_primary만, Main 관리/검수/통합, fn16_review 독립검수. 문서/Git은Main, 보호미추적자료 제외.

## 입력·실제 소비
verifyDocumentInventoryArtifacts(access,token,value,reader,signal)는 기존 readDocumentInventoryInput의 exact projectId/limits 입력과 필수 trusted reader만 받는다. 외부 inventory/collector stub/권한boolean 입력은 없다. 실제 collectDocumentInventory와 verifyArtifactBytes/current 검증을 소비한다. input 최초 snapshot은 유지, 총 inputBytes/fileCount/metadataBytes/deadline을 늘리지 않는다.

1. sharedScope 시작 별도 RC에서 최초 actor/client/session/credentialGeneration·OWNER·기한 고정.
2. 남은 시간으로 live collectDocumentInventory 1회 호출. 이 수집기의 authenticated callback은 실제 access.authenticated를 감싸는 private guard를 통해 최초 신원·기한을 callback SQL 전에 대조한다. RR pool은 원 pool을 그대로 쓰며 인증이나 RLS를 대체하지 않는다. 외부 adapter 주입은 없고 현재 수집기가 소비하는 pool/authenticated 두 기능만 내부 위임한다. 종료후 같은 scope 현재 RC를 확인한다.
3. 수집된 artifactRefs의 정렬·중복0·exact 형식·합계 overflow·총건수/바이트 상한을 확인한다. READY+NO_KNOWN_MARKER만 각1회 순차 현재성+바이트 검증한다. 처음부터 격리/STAGING/FAILED/UNKNOWN/SUSPECTED는 IO0으로 고정 미검증 사유를 남긴다. 처음 eligible이었다가 바뀌거나 검사에 실패한 경우 skip으로 바꾸지 않고 호출 전체를 실패시킨다. 자동재시도0이다.
4. 마지막 별도 RC에서 동일 최초 신원·OWNER·최소기한과 검증한 모든 exact artifact의 현재 ref/state/inspection을 metadata-only로 재대조한다. 행마다 남은 statement_timeout, 최종 외부 COMMIT/반납 이후 취소/기한검사를 수행한다. 파일은 다시 읽지 않는다. 앞 항목의 뒤늦은 격리도 결과 반환을 막는다. skipped 항목은 수집 snapshot 당시 미검증 사실로만 표시한다.

파일 IO 동안 DB transaction/client를 보유하지 않는다. 동일 scope는 최초 세션기한을 연장하지 않는다. 취소/기한/auth/cleanup 불명·중간 IO 실패는 이후 IO와 성공 반환을 막고 진행중 IO/자기 handle은 기존 drain/close로 회수한다. cleanup503 우선은 그대로 유지한다.

## 결과 의미
결과는 내부 DOCUMENT_INVENTORY_ARTIFACT_VERIFICATION_V1이며 projectId·inventory 관측 식별과 canonical inventory hash·exact artifact별 검증 또는 고정 미검증 이유·검사 건수/사용한도만 포함한다. 문서/양식/공통본 본문·원문·storage경로·token/actor/client/session ID는 반환하지 않는다. ref는 원문 수집 snapshot의 멤버이며 현재 임의 사용자 제공 목록이 아니다.

기존 inventory의 blobVerification=NOT_PERFORMED를 덮어쓰지 않고 별도 바이트 관측으로 묶는다. metadataComplete/issue·externalDependency 수와 원문 미검증 수를 구분한다. 빈목록/격리만 있는 목록을 전체백업 PASS로 이름붙이지 않는다. atomicSnapshotVerified=false, fullProjectCoverage=false, restorable=false 및 기존 byte authority/sourceStability=false 유지. metadata snapshot·각 file검사·마지막 RC는 서로 원자적이지 않다. 종료 이후 지속 권한·전체 자료 포함·암호화/복원 성공을 증명하지 않는다. 반환 직렬화 UTF8도 원 metadataBytes 상한 안이어야 한다.

새고정 오류의 구체 이름은 기존 ARTIFACT_CURRENT_*와 의미를 유지하거나 이 내부 함수 전용 고정값으로 제한한다. 원 DB/FS 오류·경로·cause를 노출하지 않는다. 임의 pending IO 강제 종료·실제PG/RLS·OS안전성은 미검증이다.

## 수행·검수
TEST_ONLY 신규목록시험 → Main 미구현RED → 같은primary 제품GO. 실제collector를 먹이는 최소 문서/양식/원문 공개fixture를 새시험 안에 둔다(기존 fixture 전체 재작성/수정0). fake DB/access/메모리reader만 사용, actual FS/DB0.

정상2원문과 반복참조 중복읽기0, 0원문, 격리/UNKNOWN IO0, 데이터변조·누적한도/기한·최초신원변경(collector callback 전)/권한회수·앞원문 뒤늦은격리·최종COMMIT취소·실패후재시도0·close불명·원오류비노출·문서본문반환0을 확인한다. 기존단일17개는 shared scope변경 영향으로1회 재실행하며 불변 reader/inventory 전수반복0. typecheck/diff·Main source diff·독립C/I0 후 결과/현황/계획 기록·기존branch게시. rollback은 이번2경로의 검토 revert, 실제자료변경0이다.
