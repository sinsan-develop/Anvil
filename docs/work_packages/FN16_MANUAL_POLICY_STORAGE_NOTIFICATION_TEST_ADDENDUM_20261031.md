# FN16 r2 A — export 알림 fixture 후속 한정 부록

상태 MAIN_RECONFIRMED_NON_SEMANTIC. 직접승인00B3FC72/WI03094CED와 export fixture 부록07C16CB34A4E947D2E0A042C0110758150B6849AE8D65EAF19A24548F2FBA34B를 보존한다. 경로는 같은24번째 tests/unit/FN16/export-approval-consumption.test.ts 한 곳이다. 직전 승인된 정책 보강 후 현재 SHA256 E1766A3966B7620B919086A527F1CFBFFC65C4EC944F567B5E50AED557E9C2A7에서 이어간다.

기존 단일 'export 승인 요청...' 시험은 정책 검사를 통과한 뒤 실제 기존 승인 알림 생산자의 SELECT anvil.assert_approval_notification_capacity($1)을 대역이 모델하지 않아 NOTIFICATION_STORAGE_FAILED였다. Main a91fdb는 같은 생산자가 그 검사 후 notifications INSERT1과 notificationSessionDeadline을 수행하는 것을 확인했다. Main6cbb21는 기존 actor에 없는 authSession이 필요함을 확인했다. 이들은 새 제품 계약이 아닌 기존 정상 경로의 fixture 누락이다.

정확 그 단일 시험의 로컬 DB wrapper에서 위 cap SQL과 인자 projectId만 exact 검산해 정상 void 결과를 제공한다. 같은 시험에만 같은 actorId/clientId/credentialGeneration의 유효 합성 authSession과 유한 idle/absolute 기한을 공급한다. 글로벌 actor/다른 시험·실제 계정·세션·권한/정책은 변경하지 않는다. 제품 cap·인증 검사나 알림 생산자는 수정하지 않는다.

기존 원4종 INSERT(approval_requests, commands, authorization_receipts, audit_events)는 각각 정확1로 검사하고 notifications INSERT1을 별도 검산한다. 전체 INSERT는5로 exact 검사하며 다른 종류는 허용하지 않는다. 기존4를 삭제/숨기거나 모든 INSERT를 넓게 허용하지 않는다. 후보 원문·job·approval consumption의 생성0과 기존 반환/해시·다른 거절 시험은 보존한다. 실제 알림 필드의 원 command/request·대상 project/recipient와 일치도 관측한다.

이 단일 실패 조건부터 GREEN으로 확인하고 원 실패는 보존한다. 다른 미모델 SQL/guard가 나타나면 정확 원인과 최소 추가 범위를 Main에 보고하며 임의 확대하지 않는다. 동일 기존 Primary만 writer, Main 코드쓰기0. 실제 DB·권한·키·사용자 파일 조사·서비스·Agent·기존 프로젝트 차단해제0이다. 변경 diff는 독립 검수에 포함한다.
