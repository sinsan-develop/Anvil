# FN16 본인 제어요청·인계 요약 역사 metadata 수집 WI — 2026-10-29

상태: 사전 검토 후보 / 제품 GO 전. 기준 codex/av3-stage-b ea98178dfea545dece075149976707522820f963. 기존 FN16 source-only 승인 안의 내부 수집 보완이며 새 공개 API·권한·실행 허가가 아니다. Main 관리·검수·통합, 기존 Primary 단독 writer, 기존 Reviewer 읽기 검수다.

## 1. 정확한 허용 파일과 불변 경계

예정 코드 5경로만 허용한다.
- apps/server/modules/control-handoff/control-handoff-pg.ts: 실제 factory의 한정 내부 메서드와 연결만 추가. 기존 forSession/run/PgContext 동작·원본문은 보존한다.
- apps/server/modules/control-handoff/control-handoff-summary-store.ts: 기존 비공개 검증을 호출하는 순수 wrapper만 추가. 기존 저장/읽기/권한 함수의 동작·본문 변경0.
- apps/server/modules/backups/control-handoff-history-inventory.ts: 신규 metadata 수집 구현.
- tests/unit/FN16/control-handoff-history-inventory.test.ts: 행동 반례.
- tests/unit/FN16/control-handoff-history-inventory-schema.test.ts: 실제 schema/producer 대조.

기존 access/auth·FN15 route·계약·SQL·GRANT·정책·권한·기존23조합·다른 수집기·보호8 변경0. 실제 DB·키·서비스·파일·Agent 실행0. 수동 정책158E10BC 미채택, 공유요청 RO 미구현, P03 소진 이력은 이 업무로 해제하지 않는다.

원source SHA256: control-handoff-pg.ts 4154FB7F778CE7403C001B9DAFE4A3B9CCEA57945897BE3B37807EEDE83391DD; control-request-read.ts F4FBFD88420B79238D43D3EED3BA2704CF2ACF99E0D5AD63E9A566C8588F1FEF; control-handoff-summary-store.ts B0666BE9F20647A47326CC0324F38E78569CF3422AA28162381D9898F0DD5101; access/repository.ts 3DC7A52FE977245BAEEBF2FAAAD3D328E54188984035D0CE0E443A1468103052. 0041 원checksum c6bd081fc7a70f8eaa68ac673cce6f8e41549d98f2c3e5bb3c22833874b0e522.

## 2. 실제 권위와 인증

실제 createControlHandoffPgSource가 캡처한 enabled/pool/access 및 원 schemaQuery·migrationId/checksum을 직접 재사용하는 readOwnHistoryInventory(token,csrf,value,signal) 내부 메서드다. 입력에 enabled/proof/provider를 받거나 sourceMode 표식을 실제 gate로 취급하지 않는다. 기본 OFF는 연결 전에 거절한다. 값은 기존 readDocumentInventoryInput의 projectId/유한 limits를 따른다. token/CSRF는 transport 입력만이며 결과·로그·저장·hash 반출0.

원 authenticated(token,csrf,callback)은 callback 이전 인증 잠금에 요청 timeout 주입이 불가능하므로 이 경로를 채택하지 않는다. caller-owned 최초/최종 READ COMMITTED 트랜잭션에서 같은 factory Pool의 db에 기존 authenticateInTransaction(db,token,csrf)를 호출한다. 이 인증 SELECT/FOR UPDATE·DBclock/xid까지 요청별 남은 기한/statement timeout과 취소 검사를 적용한다. CSRF43형식/저장digest 비교 및 세션·계정/client·credentialGeneration 검사를 생략하지 않는다. 다른 DB의 인증을 혼합하지 않는다.

현재 활성 OWNER+본인 requestedBy.actorId만 허용한다. same actor의 다른 유효 client는 읽기를 허용하며 과거 원 client 일치·현재 재인증·현재 정책·원요청 미만료를 새 조회 조건으로 요구하지 않는다. 타인/CONTROLLER 목록을 owner라는 이유로 합치지 않는다. 현재 회원 상실·행 소실·세션회수는 고정 오류로 전체 거절한다.

## 3. 수집 프로토콜

최초 RC에서 schema/정확checksum·인증·OWNER·DBclock 최소세션기한을 확인한다. 인증용 잠금은 RC만 사용한다. 이후 별도 단일 READ ONLY REPEATABLE READ에서 같은 schema/checksum·isolation/read_only/snapshot·OWNER를 재확인하고 project_id와 검증 actor의 본인 요청을 SQL로 선필터한다. 타인 원문/건수/시각을 읽은 후 JS 필터하지 않는다.

0041의 requests/summaries/commands/receipts/audits 5표43열과 연결된 본인 원장만 다룬다. 원 request verifiedBundle, 원 summary 검증 및 원 명령/receipt/audit 양방향 참조를 재사용한다. 원원장 hash와 derived metadata hash를 구분하고 receipt/audit에 없는 원 VersionRef를 발명하지 않는다. DB timestamp는 원 protocol timestamp와 구분하며 1micro 차이를 임의 반올림하지 않는다. 현재 미만료 여부는 역사 사실과 구분하며 만료된 정합 요청도 읽을 수 있어야 한다.

최종 RC에서 동일 인증/CSRF·actor/client/session/credentialGeneration·OWNER와 본인 자료의 참조/내용 지문을 재대조한다. 최초/최종 관측 일치가 ABA 불가능·원자 snapshot·실제 인계 안전을 증명하지 않는다. 실제 세대 전이 원장이 없으므로 snapshot.baseControl 관측을 전이 기록으로 승격하지 않는다.

원문은 검증 중 transient로만 사용한다. 결과에는 한정 opaque refs·고정 상태·파생 지문과 비밀 없는 원장 관계만 허용하고 이유/본문/actor/client/credential hash/인증값을 내보내지 않는다. summary SYNTHETIC_ONLY·realCollectorsConnected=false·acceptanceEnabled=false·controlTransferred=false와 실행/복원 false를 보존한다. 전체 PROJECT_DRAFT_ATTACHMENTS_CONTROL_HANDOFF_BASELINE_DRAFTS 미수집 표시는 유지하고 기존23조합에는 연결하지 않는다.

## 4. 유한 처리와 회수

keyset 한 페이지 최대200행, 동일 페이지/중복/역순·잘못된 형식은 거절한다. 원 row payload·검증 DTO·최종 결과의 누적 metadataBytes를 합산한다. 기존 inputBytes/fileCount/deadlineMs 의미를 보존한다. 쿼리마다 요청/세션 최소 기한을 확인하고 실제 인증 query와 최종 재검사도 제외하지 않는다. 임의 timeout 연장0.

Pool connect 대기와 기한 후 도착한 연결의 회수, 실행 중 query/RC/RR의 정상 종료·ROLLBACK·release를 다룬다. Promise.race만 끝내고 남은 query/transaction을 버리지 않는다. 종료·회수 불명/실패는 503이 우선하며 부분 결과/완료/정리 성공으로 보고하지 않는다. 실제 OS/PG timeout 보장은 합성시험으로 주장하지 않는다.

## 5. RED→GREEN·독립 검수·Main 확인

신규 모듈/메서드 부재의 실제 RED를 먼저 보존한다. 정상 빈목록/정합 request와 summary·sameactor 다른client·만료된 역사 요청·한 페이지200을 확인한다. OFF/표부재/checksum불일치·CSRF401/403·비OWNER/타인·다른project·원hash/명령/receipt/audit 불일치·synthetic/false 변조·중간/최종회수/내용변경·페이지중복/순서/201·한도/기한/취소·connect지연/쿼리/rollback/release 실패를 확인한다. 미존재 세대전이/타인자료/본문/인증값 유출0도 검사한다.

직접 영향 기존 FN15 control-handoff-pg-off.test.ts, control-handoff-pg-source.test.ts, control-request-read.test.ts, control-handoff-summary-store.test.ts만 회귀한다. 신규2+이4, typecheck·diff check, 독립 C0/I0 확인 뒤 Main이 source 범위만 판정한다. 기존23/다른FN16 전수검사 반복0. 기존 합격 기준을 느슨하게 바꾸지 않는다.

Primary 제출은 변경5파일/hash·정확 RED/GREEN 명령/exit·테스트/오류·미실행·차기 조치를 포함한다. Main이 실제 검증 후 결과와 WORK_STATUS/계획에 기록하고 정확 allowlist만 기존 branch에 commit/private push한다. main/PR/실환경 전환은 하지 않는다. 이 내부 source 단위의 합성 검수는 전체 FN16·WORK_PLAN 완료가 아니다.