# FN16 문서 목록 원문 검증 연결 결과

2026-10-29 · Main 어울 · 구현 fn16_primary · 독립 검수 fn16_review

## 판정·범위
문서 이력 수집기→중복 없는 원문 검사→마지막 전체 대상 현재성 대조의 내부 source 구현·핵심 합성 검수 완료. 전체 FN16/실제 백업·화면 사용자 인수는 미완료다. 실제 원문 파일·DB·키·서비스·P03 실행0, 새 공개 route/job/SQL 추가0이다.

시작 codex/av3-stage-b 6fce9c673b5818424b09d248d6a42210813481cd, local/private 동일·main f976ed5e 불변·보호 미추적8 보존. 기준 WI docs/work_packages/FN16_DOCUMENT_ARTIFACT_VERIFICATION_20261029.md SHA256 2C9F890B969EEA8579A7BBC60EB7F7A77F0ED303FBCE6EBBE36303F3ADE5F757.

## 변경 전후
- 변경 전: 단일 artifact마다 독립 신원/기한으로 검사하며 live inventory를 소비하는 호출선이 없었다.
- 변경 후: 기존 artifact-current-verification.ts에 private 공통 scope를 추출하고 verifyDocumentInventoryArtifacts를 추가했다. 첫 신원/OWNER/기한→실제 collector1회→중복 없는 eligible 원문 각1회→최종 전체 대상 metadata RC 대조를 연결한다. 최초 격리/UNKNOWN은 IO0 사유로 유지하고 중간 실패를 skip/재시도로 바꾸지 않는다. 파일 읽기 중 DB client/transaction 보유0.
- 신원 변경은 collector callback SQL 전에 거절한다. 수집기 기존 clock query의 직전 monotonic과 고정 actor expiry로 최소 세션기한을 누적하고, clock 미관측·최종 COMMIT 후 취소/만료도 실패한다. 원 DB client 수정/추가 clock query0.
- 결과는 inventory 관측/hash·원문별 검증/미검증 사유·유한 사용량이다. 문서/양식 본문·원문·경로·token/actor/client/session 원문을 반환하지 않는다. 기존 inventory NOT_PERFORMED는 변경하지 않는다. atomicSnapshotVerified/fullProjectCoverage/restorable=false, 기존 byte authority/sourceStability=false 유지.
- 제품 source SHA256 3566D1963893081FA3033170B45095CDAA4C17FE8F8B904C64792B16CF426547, diff +100/-14.
- 신규 tests/unit/FN16/document-inventory-artifact-verification.test.ts SHA256 A1AA333A15DA2D1E1C0EF4561FF31889CFD74FABE1D0B74444438C302C286F72.
- 기존 단일 시험 SHA256 7FFDFE3FE625A1DE6709816F337E909445C802295F2A752F3D525E3D3569D39A 불변. 나머지 기존 제품/시험·0054 pending 변경0.

## 검증·원 실패
- Main0b3701: node --test tests/unit/FN16/document-inventory-artifact-verification.test.ts → 함수 미구현0PASS/14FAIL/skip0/531.5867ms exit1. 090340에서 TEST_ONLY6DE550EA 본문 대조. WI/시험 독립 C0/I0/M0.
- author4d974b: 최초 신규14+기존17=31PASS/791.0015ms. type6ce714는 신규 fixture107행 TS18048 한 건. 고정 표의 non-null 타입단언1곳만 보완해 기대/실행 의미 불변, 40fe6e type/diff0.
- Main2f3bea diff 검수: collector의 단축 세션기한을 shared scope에 누적하지 않는 I1. author9608a8 정확 신규 반례 0PASS/1FAIL375.56ms. 최초1000→collector500→수집종료400→후속1000→첫 IO600에서도 성공한 원 실패다. 기존 clock 관측 누적으로 최소500을 유지하도록 보완했다. 별개 오류를 정식 동일근본 실패3회로 합산하지 않았고 Main 코드 인수0.
- authorf09b74 보완32PASS471.0535ms/skip0, 이후 clock 관측 latch 보강 영향 신규15PASS400.902ms(type/diff0).
- Main e886da 최종 직접: node --test tests/unit/FN16/document-inventory-artifact-verification.test.ts tests/unit/FN16/artifact-current-verification.test.ts → 32PASS/0FAIL/skip0/588.4984ms/exit0.
- Main84dec0: npm run typecheck 및 git diff --check 각각 exit0, 최종3지문 확인·guard 수정 구간 직접 읽기. 독립 scoped I1 ADDRESSED·최종 C0/I0/M0.
- 기존 단일17 재실행은 이번 공통 scope 변경 영향 검증이다. 불변 readonly reader/byte verifier/inventory 전수 시험은 반복하지 않았다. 실제 collector와 byte verifier를 소비하되 DB/access·원문 IO는 공개 메모리 fixture다. 실제PG/RLS/파일/동시성/전체backup 증거로 승격하지 않는다.

## 잔여·보존·복구
현재 결과는 문서 이력 범위의 관측이다. metadata snapshot·각 원문·끝 RC는 원자적이지 않다. 종료 뒤 지속 권한·동시 변경 완전 방지·전체 프로젝트 자료 포함·암호화 archive·복원 가능을 보장하지 않는다. 실제 설치/root/currentness/DB 적용·서비스·화면 사용 검증은 미실행이며 사용자 승인 제외 범위를 유지한다. 외부 QA 자원 생성0·정리대상0이다.

3aa534에서0054_backup_installation_resources.sql.pending 지문8CC95B9DAB5B900DC44EB3FE6819CDC8B5ACE3D8DAE18223B48F32AA2DD8C0A7 보존을 확인했다. 보호 미추적8은stage/변경0. rollback은 이번 source/test의 검토된 revert이며 실제 자료/키/서비스 rollback이나 삭제가 아니다. WORK_STATUS/WORK_PLAN에 실제 구현 범위만 기록하고 PMO에 결과를 전달한다.
