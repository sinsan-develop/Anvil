# C-21 Provider WSL exact binding 보고서

- 범위: seq540~542, K exact14, source `71d6747c0b713bedf1a1bc6724a5771d6ae33c60`.
- private push 권위는 local remote `development`, WSL fresh-clone fetch 권위는 private URL을 가진 remote `origin`으로 분리했다.
- runtime application repository는 clean detached 상태를 허용한다.
- mutation 전 허용 상태는 initial, candidate deployed, candidate rollback 세 tuple뿐이다.
- rollback allowlist는 candidate `a6dca0d`, predeploy current `a342d623`, observed previous `324eb169`를 포함한다.
- commit, push, WSL, Docker, DB, Provider, Telegram, ysna, main merge는 실행하지 않았다.

