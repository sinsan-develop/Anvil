# F-18 R36 developer-primary 실행 지시

`F-18_WSL_OPS_R36_OIDC_RUNTIME_BINDING_WORK_INSTRUCTION.md`와 계획서를 읽고, Main이 전달한 canonical worker/write lease의 유효한 두 fencing token을 확인하라. 제품 exact3만 TDD RED→GREEN으로 구현하고 검증·보고서·제품 commit SHA를 Main에게 반환하라. 실제 issuer/ASGI/Web/DB/deploy 및 기존 OIDC 코어는 변경하지 않고 push·PR·병합은 Main에게 맡겨라.
