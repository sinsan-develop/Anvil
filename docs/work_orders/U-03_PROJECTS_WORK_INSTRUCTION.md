# U-03 Projects WorkInstruction

## 범위

Projects 메뉴에서 repository onboarding, read-only scan, baseline·policy·protected-path 상태를 실제 read model/API/UI로 표시한다. dirty/untracked와 금지 경로는 보존하고 승인 없는 mutation을 수행하지 않는다.

## 경계

개발은 로컬에서 수행하고 테스트는 `ssh WSL-server`로만 한다. `ysna-server`와 Production preview는 사용하지 않는다.

## 완료조건

repository intelligence의 zero-delta scan, dirty/untracked·baseline conflict 계약과 same-origin BFF/UI가 연결되고, 실제 브라우저 클릭·Network 및 회귀 evidence를 기록한다.
