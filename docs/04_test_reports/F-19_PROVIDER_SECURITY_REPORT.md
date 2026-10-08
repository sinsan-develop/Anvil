# F-19 Provider·egress·Web·secret 보안 회귀 보고서

## 범위

Local 및 WSL-server Test/Staging/격리 QA만 대상이며 Production/ysna-server는 실행하지 않는다.

## 로컬

- 지정 Provider/catalog/settings/Web/secret 회귀: `525 passed, 1 warning`.

## WSL

- 동일 commit을 Git으로 수신한 뒤 동일 범위를 실행하고, 결과와 임시자원 정리를 아래에 누적한다.

## WSL-server 결과

- `development/codex/f18-wsl-ops@4d8e9529b78aea15698747e1500180c2d34ba86f`를 Git으로 수신한 전용 checkout에서 잠긴 Python 3.12/pytest 환경을 구성했다.
- 동일 범위가 `525 passed in 6.79s`, exit 0이다. checkout·venv를 제거해 `F19_WSL_CHECKOUT_RESIDUE_ZERO`를 확인했다.
- R45B 격리 target의 browser Network·payload·DB/log/artifact 비노출 evidence를 동일 WSL 운영 유사 범위의 보안 증거로 대조했다. 앱 요청은 same-origin이고 localhost·Docker 내부주소·secret 값 직접 노출은 0건이다.

## 판정 경계

Provider credential이 없는 환경에서 실제 외부 Provider 호출은 실행하지 않았다. 따라서 9개 catalog/routing/security 계약과 WSL 동일 SHA 회귀는 PASS지만, live Provider availability·비용·운영 도메인은 `UNVERIFIED/NOT_EXECUTED`다.

## 미검증 경계

실제 Provider credential 호출, 운영 도메인, Production, 사용자 운영 인수는 credential·범위상 `UNVERIFIED/NOT_EXECUTED`로 유지한다.
