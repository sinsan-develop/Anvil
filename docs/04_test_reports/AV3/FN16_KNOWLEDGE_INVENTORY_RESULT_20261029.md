# FN16 지식·헌법 이력 metadata 수집 결과

## 판정·기준
지식·헌법 자료군 내부 수집 source·합성검증 완료. 전체 FN16/백업/복원/작업계획 완료는 아니다. 실제 키·DB·서비스 변경과 원문 파일 읽기는 없다.
부모 0a25d6f41726c50faeaa0d4751fcf74b40c0e5b1, codex/av3-stage-b. WI FN16_KNOWLEDGE_INVENTORY_SOURCE_IMPLEMENTATION_20261029.md r1 SHA256 45EE71D5C68B0A7A1DF989FFDFD5AD4C6D0D9468E62C0B5441CD893A1DAA6399. 초기 B71DBE46의 audit_events.id 오기는 실제 event_id/server_sequence로 정정했고 독립 I1 해결 C0/I0/M0였다. 실제 schema는 변경하지 않았다.
기존 fn16_primary 단독 제품1·시험2 신규 작성, Main source수정0·검수/통합, 기존 fn16_review 독립 읽기 검수.

## 변경과 동작
- knowledge_entries/versions/events, 전체 content_reviews, constitution_applications/current pointer를 같은 프로젝트의 RO RR snapshot에서 수집한다. 200건 keyset·SQL payload 제한·유한 누적량을 적용한다.
- 불변 버전과 원 hash, 1..head·정정 v-1, PROPOSED/CORRECTED/CONFIRMED/EXCLUDED 사건, 실제 command 결과·작성자/시각 내부 결박, 전체 review·audit 순번, confirmation의 ACCEPTED exact ref, 헌법 적용 receipt/전체 이전 체인·최신 pointer를 대조한다. 현재 helper가 지원하지 않는 SHARED는 무시하지 않고 실패한다.
- title/reason·출처·범위와 원문 exact ref를 보존하고 사용자/client/session 식별자는 결과에서 제외한다. source 원hash와 익명 projectionHash를 구분한다. 전체 hash 범위는 projectId/entries/versions/events/reviews/constitutionApplications/currentConstitution/artifacts/issues/externalDependencies 11필드이며 관측·usage·자기 hash는 제외한다.
- 문서/대화·방법론 단계·작업계획 참조는 exact 외부 미검증 의존이다. 해당 자료를 따라 읽지 않는다. 격리·UNKNOWN은 상태와 사유를 남긴다. EXCLUDED/SUPERSEDED 또는 예전 헌법 적용을 현재 실행 허가·Agent 준수 판정으로 만들지 않는다.
- 시작/종료 현재 OWNER·동일 세션/credential·누적 최소 기한을 확인하고 자료 ROLLBACK·반납 후 최종auth COMMIT까지 기한·취소를 검사한다. BEGIN/회수 불명은 정상 client 재사용을 막는다. 기존 pool/auth 잠금·통신 전체의 강제 시간 상한을 보장한다고 주장하지 않는다.
- blobVerification NOT_PERFORMED, agentDelivery NOT_CONNECTED, fullProjectCoverage=false, restorable=false. 실제 route/job/UI 연결은 아직 없다.

## 실행 증거와 보완
- Main 5a8661: node --test tests/unit/FN16/knowledge-inventory.test.ts tests/unit/FN16/knowledge-inventory-schema.test.ts → 제품부재 exit1, schema1PASS/13FAIL, skip0,372.9483ms.
- TEST_ONLY 행동22E4834C…/schemaD820700E…, 독립 C0/I0/M0. author594a44 최초14PASS/670.0706ms 후 8e4434 type 오류4개(제품추론3/fake cursor1). 제품명시타입과 시험 cursor의 string|number 단언1곳 보완. 98af39 14PASS/658.883ms·2376c6 type/diff0. 중간 newline는 원 LF로 복구했고 단언 제거 rawhash가 초기시험과 같음을 확인했다.
- Main 및 독립 제품검수 C0/I1/M0: ARTIFACT 출처 전용 media_type의 known-marker 검사 누락. 정상 upload는 MIME enum/text 제약이 있으므로 정상 API 공격·실제 유출을 확인한 것은 아니다. 손상 자료 투영의 WI7 누락으로 한정했다.
- author00ba58 새 반례1 RED(0PASS/1FAIL,308.3455ms,Missing expected rejection). 제품 출력 전에 safe(ref) 10bytes 추가. 8abc1e 신규15PASS/628.9207ms·c384de type/diff0. 기존 제품 대비 추가문자 제거 hash CE1B5D18… 및 시험 원prefix46C0E78B… 일치로 변경범위를 확인했다.
- Main 533e2c 최종 위 신규 명령 exit0, **15PASS/0FAIL/skip0,645.7015ms**. npm run typecheck·git diff --check exit0. 정상 다중버전/정정/제외·헌법체인, 203개 review pagination, hash/관계/receipt 변조·누락, 한도·격리·권한/기한/회수 및 민감metadata 차단을 확인했다.
- 최종 독립 scoped I1 ADDRESSED **C0/I0/M0**. Main9d76e3/caa5b5/abe713 전체 제품 직접읽기, 기존14/32는 source불변으로 반복하지 않았다.

## 최종 지문
- apps/server/modules/backups/knowledge-inventory.ts: 6554BBE0EA77A250AE3FDD6B96243CD1583CF780B426C8AACFE4DD06CCF71973
- tests/unit/FN16/knowledge-inventory.test.ts: 2EEFFF47625A56B9B42B9D5D496E1665F1005555A2761BABDC81D54DD5544C3F
- tests/unit/FN16/knowledge-inventory-schema.test.ts: D820700EF189CD5FDFA0D119243EE5CB188BA34407AA7E01D5BE069720B999BD

## 미검증·다음 조치
실제 PG SQL/RLS/동시성·원문 FS·키·서비스·전체 백업/복원·화면/사용자 인수 NOT_RUN. schema 시험은 SQL 원문 대조다. 기존 적용 SQL·권한·지속 자료는 변경하지 않았다. 알려진 표식 검사는 완전 비밀탐지가 아니다. 정책·승인·감사의 모든 증빙이나 전체 프로젝트 관계를 수집한 것이 아니다.
다음은 대화/지식 live 목록의 원문 검증 연결이다. 대화 자체 격리를 원문 READY와 별도로 현재 대조하고 초기 미검증과 이후 실패를 구분한다. 본 신규 수집기에는 외부 호출선이 없어 코드 rollback은 해당 commit의 정상 revert로 가능하며 데이터 복구 작업은 없다. 보호 미추적8은 별도 보존했다.
