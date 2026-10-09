# U-01 Task4 두 조합 WSL-server R5 수직 QA 결과

## 판정

`FOUR_PHASE_VERTICAL_QA_PASS; U-01_NOT_ACCEPTED`. 기존 단일 branch `codex/u01-dashboard-r2`의 로컬·사설 `development`·WSL-server Git clean exact SHA `208c8fbbe0fa93f216772379e14b679cfa2436f9`를 기준으로, 새 빈 전용 PG15와 합성 OIDC/HTTPS/API/Web/Chromium에서 같은 DB 수명의 `granted→revoked→restored→other` 네 단계를 순차 실행했다. 각 단계 `2 passed, 30 deselected`, exit 0이며 시간은 각각 14.77초, 12.65초, 13.46초, 5.03초다. 이전 R4의 `other` 선택자 실패는 새 SHA의 실제 브라우저에서 재발하지 않았다. 이는 네 단계 수직 검증의 PASS이지 기존 R6 회귀·최신 G-05·전체 U-01 인수 PASS가 아니다.

## 기준·실행 증거

- WSL-server 전용 checkout의 HEAD·Git clean·image revision은 위 SHA였다. run label `anvil-u01-two-pair-qa-r5`, 전용 network `anvil-u01-two-pair-qa-r5-net` ID `f6cdc4a854f23bd50a0c22c8bfe5bc07baa46ee676f5ff26d160aa3f32a27aa7`, tmpfs PG15 ID `894626c8f4fcb860ddf0ec4cfc1e5a9555505d5bd6dad06710dbd3cdab851e9e`, 비관리자 DB/user `anvil_u01_qa_208c8fbbe0fa`, migration `0020_f19a_pair_grants`와 빈 등록·감사 원장으로 시작했다. Web은 loopback `127.0.0.1:8444`, PG는 `127.0.0.1:5546`; 브라우저 합성 도메인은 전용 network Web IP로만 해석됐다. 공유 Web/PG와 ysna/Production은 검증 경로가 아니다.
- 네 번 모두 전용 checkout에서 `python -B -m pytest -q -p no:cacheprovider -k opt_in tests/integration/test_u01_scoped_dashboard_browser_pg15.py --basetemp=<전용 phase 경로> --tb=short`를 실행했다. phase는 `ANVIL_U01_QA_PHASE`로 정확히 한 단계씩 지정했다. `other` 전에는 issuer 컨테이너의 label·ID를 검사하고 같은 합성 키/URL의 다른 subject `f19a-qa-other`로만 교체했다. 실패 DB를 초기 빈 DB처럼 재사용하지 않았다.
- 종료 DB 조회에서 `registered_projects|registered_environments|pair_grants|registration_audit_events = 2|2|2|8`, migration `0020_f19a_pair_grants`였다. 다섯 번째 운영 감사 원장 및 단계별 상세 행의 합격 근거는 opt-in 테스트의 내부 단언에 한정하며 종료 SQL 직접 조회로 승격하지 않는다. 브라우저 Network JSON은 `granted` response 29/관측6/합성 fault true, `revoked` 23/3/true, `restored` 29/6/true, `other` 15/0/false다. 1920×1080 PNG 네 장을 육안 확인했으며 `other`는 빈 선택 목록 문구와 비활성 선택기를 표시했다.
- `docs/evidence/u01-task4-two-pair-r5/`에 phase별 PNG·Network JSON 총 8파일을 보존하고 WSL 원본과 SHA-256 전부 일치시켰다. Network JSON의 authorization/bearer/client-secret/signing-key/password/DSN/cookie/token 표식 검색 0건이다. Network JSON SHA-256: granted `49743e83e245c47fb563aa5f0bb3837518b9ffdb03df17577caa36250394c723`, revoked `a7544c04ff6786038e0e014310dff59d2b188ae30502ac2b1d246b652c4172a4`, restored `3730a29d19739d0e565d256661cd3839269732be7b6ef3b059ae67da2da2b3fe`, other `bafacb9f38004461fd9bac76ba350b5906470082913ca0c72927a9603ef9c32d`.

## 정리·미충족 조건

전용 browser/Web/API/issuer/PG 다섯 컨테이너의 정확 ID·label, network ID, 세 image tag revision, 세 root의 owner·realpath·Git clean을 검사한 뒤 이 자원만 순서대로 제거했다. R5 label container/network·checkout/material/browser root·loopback 5546/8444 잔여 0, 공유 `anvil-web` ID `f0107aada3b26ea84950d5561fdd1d13759090096601854720acae5448684738` running true를 확인했다. 캐시 PG/Playwright 원본 image는 유지했다. Docker 정리 전용 Secret/DB는 함께 폐기되어 재실행하려면 새 격리 DB와 새 SHA 기준으로 준비한다.

기존 R6 `STORED_ROW` 회귀는 이번 테스트의 대상이 아니며 PASS로 처리하지 않는다. 최신 G-05 successor는 route 부재로 RED, E-SHOT/E-NET/E-API/E-AUD의 전체 ID 매트릭스와 독립 Tester 수락은 미완료다. 따라서 U-01 `NOT_ACCEPTED`, Release `DEFER`, PR/main 병합·기존 branch/worktree 삭제·새 branch/U-02·ysna/Production은 미실행이다. 다음은 같은 branch에서 R6 원인 분리와 fail-closed G-05 successor를 정확 lease로 재작업하고 필수 증거·독립 판정을 완료하는 것이다. Rollback은 R5 결과 문서·증거만 정상 revert하며 제품 코드는 이번 R5 실행에서 수정하지 않았다.
