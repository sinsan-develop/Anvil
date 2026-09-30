# Invocation — F-20/U-01 R21

`developer-primary-f20-u01-r21`은 승인된 U-01, R21 계획·WorkInstruction, canonical progress/HANDOFF 및 게시된 동일 SHA와 유효한 dual lease의 두 fencing token을 확인한 뒤 allowed_paths exact3만 단일 writer로 수정한다. Operations snapshot의 요청 전 다섯 카드가 실패가 아닌 `LOADING`으로 보이도록 먼저 실동작 테스트 RED를 확인하고 최소 구현·GREEN/회귀를 수행한다. 기존 공개 API/DB/권한·Provider/Alerts/Database readiness·다른 메뉴는 바꾸지 않는다. Main 소유 Git·WSL·현황은 건드리지 말고 명령·exit·증거·미검증·rollback·잔여 자원을 구조화해 반환한다.
