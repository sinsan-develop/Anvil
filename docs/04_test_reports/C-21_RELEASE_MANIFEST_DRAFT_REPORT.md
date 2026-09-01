# C-21 ReleaseManifest 초안 보고서

## 판정

`PENDING_APPROVAL` — 배포에 사용하지 않는 초안이다.

## 판단 이유

기존 `deploy/ysna/ReleaseManifest.json`은 C-32 커밋을 고정하고 있어 C-21 커밋 배포를 거부한다. 새 초안은 현재 main의 정확한 커밋과 C-21 증거 hash를 결박하지만, 사람 승인 없이 `APPROVED_FOR_DEPLOYMENT`로 승격하지 않는다.

## 검증

- 대상 커밋: `fda94392b03f69d1a21b1030b5425f14ee8a4d95`
- API 테스트: `.venv\\Scripts\\python.exe -m pytest tests/api -q` → 35 passed
- Host 진단 보고서 hash: `7BEEDD8A10E57F3DAB14D1A5591FF78FE8AB2730E28DFC0C7671A12119FECC0A`
- 운영 실행 보고서 hash: `BF8817F74F62CF2C223613DC0007D907836E9BE1CA816281275CC7062FC01C4E`
- 기존 승인 ReleaseManifest는 변경하지 않았다.

## 미충족 조건

- C-21 exact commit에 대한 human DeployApproval binding 없음
- 표준 `deploy.sh` 실행 전 상태
- authenticated SSE/Last-Event-ID 운영 검증 미실행
- Telegram signed POST는 승인된 2회 모두 `400 invalid host`; 추가 POST 금지
