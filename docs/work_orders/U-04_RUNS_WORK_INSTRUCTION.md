# U-04 Runs WorkInstruction

## 범위

Run·Step·Delegation·attempt·queue·중단·재개·취소의 API/state 계약과 Workbench의 SSE `Last-Event-ID` read path를 검증한다. stale token·dirty baseline·fixture 결과를 실제 성공으로 표시하지 않는다.

## 환경

로컬에서 개발·계약 테스트를 실행하고, 동일 commit을 `ssh WSL-server` 전용 checkout에서 테스트한다. `ysna-server`·Production은 제외한다.

## 완료조건

run graph와 attempt integrity, durable queue fencing/quarantine, delegation cancel/resume, SSE resume가 API·state 계약으로 일치하고, 중단·재개·취소 상태가 UI에서 정직하게 표시된다.
