# C-10 Main takeover 작업지시서

- executor: `main-agent-eoul`
- predecessor: `e416898d231e0f6ef72d01c85378c0f3e48a0d11`
- package: `C-10`
- classification: `MAIN_TAKEOVER_AFTER_SAME_ROOT_CAUSE_3`
- user direction: `ALLOW_C10_MAIN_DIRECT_TAKEOVER`
- 기능 범위·요구사항·중요 위험: `UNCHANGED`

## 작업

- command admission은 executable/subcommand만 보지 않고 argv와 environment effect를 구조화한다.
- repository 범위 이탈, 외부 helper, 파일 출력, install/network, destructive temp/path mutation은 ordinary grant에서 fail-closed한다.
- 안전한 검증 명령 `python -B -m pytest ...`는 호환 유지한다.
- raw-secret key는 camelCase·delimiter·header·suffix 변형을 canonical token으로 판정한다.
- hostile Mapping의 비정형 예외는 raw 내용 없이 structured `INVALID_ACTION`으로 닫는다.
- 기존 R1/R2 회귀와 C-09 read gateway를 보존한다.

허용 제품 경로는 TakeoverPacket exact6뿐이다. control/progress는 Main이 별도 successor에서 관리한다. 실제 외부 I/O, stage·commit·push·PR·merge·배포는 완료 검증 전 수행하지 않는다.
