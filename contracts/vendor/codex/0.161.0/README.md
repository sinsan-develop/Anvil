# Codex 0.161.0 공개 프로토콜 스키마 고정본

- 출처·설치본 지문·파일별 SHA256은 `schema-manifest.json`에 기록했다. JSON은 설치된 정확 CLI의 기본 stable exporter가 생성한 바이트 그대로이며 변경하지 않았다.
- 공개 정의의 존재와 실제 Agent 연동은 다르다. handshake·세션/turn·파일 수정·승인·중지/회수·6능력은 미검증이다.
- 메타스키마 전체 검증·실제 네트워크 관측·설치 binary의 upstream commit 재현 빌드 일치는 수행하지 않았다.
- `$ref`는 포함한 JSON과 로컬 pointer만 대조했다. `$schema`/설명 URL을 네트워크로 가져오거나 코드를 실행하지 않았다.
- 지정 비밀·사적자료 표식 검사는 혼입 위험을 줄이는 검사이며 완전 탐지를 보장하지 않는다. 계정·auth/config·로그·isolated home·binary·프로젝트 원문은 포함하지 않는다.
- upstream LICENSE·NOTICE를 보존했다. 스키마가 언급하는 승인/안전 경계를 우회하거나 자동 승인하는 기능은 이 자료에 없다.
