# U-01 Task4 두 조합 WSL-server R6 수직 QA 결과

## 판정

`FOUR_PHASE_DB_API_AUDIT_VERTICAL_QA_PASS; U-01_NOT_ACCEPTED`. 기존 단일 branch `codex/u01-dashboard-r2`의 로컬·사설 `development`·WSL-server Git clean exact SHA `da748f1021847700e295385233237c8e8bada192`에서 새 빈 전용 PostgreSQL 15, 합성 OIDC/HTTPS/API/Web/Chromium을 사용했다. 같은 DB 수명에서 `granted→revoked→restored→other` 네 phase를 순서대로 실행했고 각 phase `2 passed, 50 deselected`, exit 0이다. `granted` 14.43초, `revoked` 13.88초, `restored` 14.38초, `other` 8.70초. 브라우저 context는 `America/Los_Angeles`이며 실제 page timezone을 확인했다. 이는 해당 수직 절편의 PASS이지 전체 U-01 인수 또는 기존 R6 회귀·G-05 PASS가 아니다.

## 근거

- WSL 전용 checkout은 `da748f10` clean, 세 QA image revision label도 같은 SHA다. 합성 TLS CA 검증과 HTTPS ready 200, PG `server_version_num=150019`·Alembic `0020_f19a_pair_grants`, 등록 프로젝트/환경/grant/등록감사/운영감사 원장 `0|0|0|0|0`에서 시작했다. 전용 network Web IP `172.24.0.10`, loopback PG 5546·Web 8444만 공개했고 브라우저의 합성 도메인은 이 Web IP로 해석됐다.
- WSL 기본 Python에는 SQLAlchemy가 없어 첫 비 opt-in 수집이 1 ERROR였고, 전용 venv에서 다시 `51 passed, 1 skipped` exit0이었다. 첫 API image archive에 Dockerfile 선행 Web-stage 입력이 누락되어 빌드 1회 실패했으나, 같은 SHA의 제한 Git archive에 필요한 파일만 보충해 Web/API/issuer 세 image의 revision label을 확인했다. 브라우저 컨테이너의 증거 bind 경로도 실행 전에 전용 컨테이너만 재생성하여 계약과 일치시켰다. 이 세 건은 QA 환경 준비 오류이며 네 phase 제품 테스트 실패로 숨기지 않는다.
- 각 phase Network response/관측/API·감사 결박은 `granted 29/6/6`, `revoked 23/3/3`, `restored 29/6/6`, `other 15/0/0`이다. 네 결박 파일은 source SHA, Network SHA-256, 두 scoped 감사 원장 SHA-256, 정확 pair·서울 1/7/30 달력일 UTC 경계·`observedAt`와 API/원장 고유 Critical 수를 기록한다. 철회/타 사용자 403도 결박 검사 대상이다. 종료 DB는 등록 프로젝트/환경/grant/등록감사/운영감사 `2|2|2|8|5`, migration head0020이다.
- `docs/evidence/u01-task4-two-pair-r6/`에 PNG4·Network JSON4·DB/API/AUD JSON4, 총 12개를 WSL 원본 SHA-256과 전부 일치시켜 보존했다. 네 JSON은 정확 phase·source/timezone·Network digest·관측 개수/결박 개수와 민감 표식 부재를 검사했다. `granted` 화면은 두 조합 선택과 현재 Critical/Next Action 및 일부 카드의 `UNAVAILABLE`, `other` 화면은 선택 가능한 조합 없음과 차단 상태를 육안 확인했다. 이 화면은 나머지 카드의 실제 운영 수치 PASS가 아니다.

## 미충족·다음 조치

기존 R6 `STORED_ROW` 회귀는 이번 네 phase와 별개로 미실행이다. 현재 epoch106 G-05 successor route 부재로 최신 G-05는 RED이며, `AV-SAFE-034`·`AV-OPS-027`·`AV-UI-017` 및 공통 UI/OPS 전체 ID, 7상태, ACK/운영 복구, 서울 자정·월말·윤일·부분 Alert·원본 지연/결손은 아직 전체 검증되지 않았다. 독립 Tester 판정은 별도 수집한다. 따라서 U-01 `NOT_ACCEPTED`, Release `DEFER`, PR/main 병합·branch/worktree 삭제·신규 branch/U-02·ysna/Production은 미실행이다. 다음은 R6 증거 독립 검토, 기존 R6 원인 재현/정확 lease 재작업과 fail-closed G-05 successor, 남은 ID별 실측이다.

## 독립 검토·자원 정리

읽기 전용 독립 Tester는 증거 12파일의 exact source SHA, phase별 Network SHA-256, 두 원장 digest, `apiDetected == auditDetected`, 6/3/6/0 결박, 실제 브라우저 timezone 필드와 granted 화면을 대조했다. 새 Critical 결함은 0이다. Important 증거 경계는 두 가지다. 첫째, 증거 파일 자체에는 네 번의 pytest 종료 코드·WSL checkout clean·정리 결과가 내장되지 않아 위 Main 실행 로그/이 보고·현황과 함께 보존해야 한다. 둘째, Network JSON은 path/period/method/status만 보존하고 전체 URL/origin을 보존하지 않아 E-NET 전수 감사를 독립적으로 재수행할 수 없다. 브라우저의 same-origin 단언이 통과한 제한 절편을 E-NET 전체 PASS로 승격하지 않는다. 원시 HTTP body/감사 row 역시 보존하지 않아 E-API/E-AUD 전체 ID PASS가 아닌 count·digest 결박 절편이다. 자정/월말/윤일 경계도 별도다.

Main은 로컬 증거 12파일의 SHA-256이 WSL 원본과 전부 일치함을 확인한 뒤, WSL 전용 다섯 container의 정확 이름·`com.anvil.qa-run=anvil-u01-two-pair-qa-r6` label, image revision SHA, network label/접속 container 5개, 세 root의 owner `daon`·realpath·Git clean을 검사했다. 첫 정리 명령은 삭제 전에 venv의 외부 Python 실행 링크 세 개를 내부 링크로만 제한한 검사에서 exit1이었고 자원 변경0이었다. 세 링크가 정확 `/usr/bin/python3.12`를 가리키며 경로가 전용 `browser/venv/bin/python*`뿐임을 확인한 뒤 해당 링크의 삭제가 대상 파일을 따라가지 않는 조건으로 검사를 보정했다. 이후 browser→Web/API/issuer→PG 다섯 container, network, 이번 SHA의 image tag 세 개, browser/material/checkout 세 root만 순서대로 제거했다. 전용 label container/network·세 root·loopback 5546/8444 잔여0, 공유 `anvil-web` running true를 확인했다. cache PG/Playwright image와 공유 서비스는 보존했다. 정확 Docker ID는 이 보고서에 보존하지 못했으므로 이름·label·revision 기반 정리 증거로 한정한다. Rollback은 이번 R6 보고서·증거와 하네스 변경의 정확 commit만 정상 revert하며 공유 서비스·운영 데이터는 변경하지 않는다.
