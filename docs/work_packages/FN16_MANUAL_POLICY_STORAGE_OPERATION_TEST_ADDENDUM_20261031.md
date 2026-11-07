# FN16 r2 A — 정책 operation 회귀 시험 한정 부록

상태 MAIN_RECONFIRMED_NON_SEMANTIC. 직접승인00B3FC72B8B85FD1EACEB143C8DC42B4686561768FD8D214413F5B82DB693902와 WI03094CEDBABAF1AD937CD0B42379F38117D5461729989EDE6C7A690BF8FF802F를 보존한다. 기능/승인/기준 확대 없이 승인된 saveBackupPolicy operation을 반영하는 기존 fixture 한정 적응이다.

추가23번째 경로는 tests/unit/UI14/backup-reference-api.test.ts, 시작 SHA256 FFA74700A3E23F3EC1887F2E2E1A47EDC2AB9476595C403DD995A5B84AB72871이다. 기존 Reviewer가22행의 PROJECT_MATERIAL 정확 목록 시험에서 승인된 새 operation 추가로 기대 집합이 달라짐을 읽기 확인했다. 현재 시험의 실행 실패나 제품 회귀를 주장하지 않는다.

그 단일 시험에서 기존 saveBackupReference/revokeBackupReference 제외 후 검사하던 기존30 operation의 순서/내용은 그대로 검산하고 새 saveBackupPolicy만 별도 정확 존재·중복 없음으로 단언한다. 새 operation을 단순히 필터링해 숨기지 않는다. 기본 DENY, pending=null, resultRef=null은 보존한다. 다른 scope/fullref/거절 시험의 수정·삭제/skip·기대 완화와 함수/파일 전체 재작성은 허용하지 않는다.

수정자는 동일 기존 Primary 한 명, Main 코드수정0. 기존4파일의 최소 회귀는 FN16/backup-reference-store.test.ts, FN16/export-approval-consumption.test.ts, UI08/approval-api.test.ts, UI14/backup-reference-api.test.ts이며 신규7시험과 구분해 검사한다. 실제 DB·SQL·권한·키·사용자파일/서비스·Agent·기존project차단해제0이다. 최종 test diff는 기존 Reviewer가 독립 검수한다.
