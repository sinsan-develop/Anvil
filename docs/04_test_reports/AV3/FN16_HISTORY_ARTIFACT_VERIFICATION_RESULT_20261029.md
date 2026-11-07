# FN16 대화·지식 목록 원문 검증 연결 결과

## 판정·기준
승인된 내부 source·합성 검증 범위 구현 완료. 전체 FN16/백업·복원/작업계획 완료는 아니다. 기준 부모2643674508cb1156ebdb9e3ba89f8d9a978205ed, branch codex/av3-stage-b. WI FN16_HISTORY_ARTIFACT_VERIFICATION_20261029.md SHA F15976A78FF119D29578138F513FF8FD4DE90EBE3DC44EB544561EE9431A0B7A. 기존 fn16_primary 단독 구현, Main 관리·검수·통합, fn16_review 독립 읽기 검수.

## 변경·검수 범위
- artifact-current-verification.ts +105/-2: 실제 대화/지식 collector를 같은 최초 신원·최소 세션기한으로 호출하고, 정확·중복 없는 원문을 기존 byte/current verifier에 연결한다. 기존 문서/단일 검증 동작은 보존했다.
- 대화 최초 메시지 격리는 같은 body를 참조하는 전체 집합의 IO를 차단한다. 원문이 READY여도 MESSAGE_QUARANTINED로 남긴다. 검증 대상의 모든 메시지 참조를 원문 IO 직전·최종 RC에서 exact project/ID·body_artifact_id·원6필드 snapshot hash·exact bodyRef로 재대조한다. 메시지당 원문을 반복 읽지 않는다.
- 처음 eligible인 자료의 후속 격리·소실·변조·읽기 실패를 skip으로 낮추지 않고 전체 실패시킨다. 지식 EXCLUDED는 역사 상태이므로 격리와 구분해 원문을 검증한다.
- 현재 메시지 조회는 명시8열/최대200 ID/SQL payload 제한·누적 metadata 한도·현재 OWNER/세션·statement timeout·auth COMMIT 후 검사를 거친다. 원문 IO 중 DB transaction/client 보유0. collector 회수불명503은 취소/기한보다 우선한다.
- 결과는 inventory 관측/hash/누락 수와 원문 검증 요약이다. 본문/신원/token/storage 경로는 반환하지 않는다. atomicSnapshotVerified/fullProjectCoverage/restorable=false. 고정 대상 양끝 관측이며 그 사이 모든 변경·새 참조·전체 DB/FS 원자성을 보장하지 않는다.

## 실제 실행 증거·오류 이력
- Main b17bdb: node --test tests/unit/FN16/history-inventory-artifact-verification.test.ts → exit1, 신규 함수 undefined/미구현 RED. 긴 출력이 잘려 정확 count/time은 이 기록에서 주장하지 않는다. TEST_ONLY F5EE57CA 동결·독립 C0/I0/M0 후 source GO.
- author ee77a5 신규14 PASS/546.2964ms. c6ee8d 타입검사 TS18048 initial optional 5곳, never 명시만으로 dd19c6 재발. 부재를 if(!initial)return invalid()로 분리해 ebd33b/f3219b 타입0. 동일 근본 원인 2회이며 세 번째 실패/인수 아님. 기능 기대값 완화0.
- author8546ec 신규14+기존17+문서15=46PASS/skip0/570.2769ms. Main2772d4: node --test --test-reporter=dot tests/unit/FN16/history-inventory-artifact-verification.test.ts tests/unit/FN16/artifact-current-verification.test.ts tests/unit/FN16/document-inventory-artifact-verification.test.ts → dot46, TEST_EXIT=0. npm run typecheck TYPE_EXIT=0, git diff --check DIFF_EXIT=0.
- Main df1d4b 전체 diff, b24d73 실제 대화 parser/collector 범위 대조. 독립 최종9EF2A9F0 기준 C0/I0/M0. 직전28722F1F에서 최종 변경은 위 부재 분기1개뿐임을 메모리 hash로 대조했다. 신규·기존 시험 지문 불변.
- source SHA9EF2A9F0E8961817F3F18EB484AF244CBF08156C8EFA76B507D8927FF6977FFE; 신규시험 SHA F5EE57CAB2E5210FB6CE7A5B729226AF6C62896ABCF36B29C27570D257815B43. 기존 단일7FFDFE3FE625A1DE6709816F337E909445C802295F2A752F3D525E3D3569D39A/문서A1AA333A15DA2D1E1C0EF4561FF31889CFD74FABE1D0B74444438C302C286F72 유지. 수집기 자체14/15는 source불변으로 반복0.

## 미검증·다음 조치·복구
실제 DB SQL/RLS/동시성·원문 파일·키·서비스·P03·archive/복원·화면/사용자 인수 NOT_RUN. 200개 초과 현재 메시지 조회는 코드 분할만 검수했으며 이번 작은 fixture가 실제 PG pagination을 증명하지 않는다. pool/auth lock의 전체 강제 시간 상한을 보장하지 않는다. 새 route/job/UI/SQL/권한은 만들지 않았다.
보호 미추적8·기존 자료는 별도 보존한다. 데이터 변경이 없어 이번 연결 rollback은 정상 revert이며 강제 history 변경은 필요없다. 다음 미완료 내부 자료군은 작업계획 버전·업무/선행·검토/확정 이력이며 기존 저장 계약을 읽기 대조한 뒤 진행한다.
