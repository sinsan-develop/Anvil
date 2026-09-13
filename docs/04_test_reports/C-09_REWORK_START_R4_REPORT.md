# C-09 R4 corrective control 보고서

R3 spec C1/I7/M1 및 quality round2 C3/I6/M0의 고유13축을 결박했다. valid failure2/rework2, 다음 유효 failure3은 MAIN_TAKEOVER_AT_3이며 같은 Developer R5 금지.
seq807~814 append, epoch2 write/worker revoke, epoch3 unchanged exact18 issue. 제품 frozen R3 bytes/index를 보존한다.
TDD RED: seq814 3 failed/429 deselected, C-09 R4 builder missing. control 검증은 제품 acceptance가 아니다.
제품 수정/stage/commit/push/외부 실행0. control commit 뒤 중단은 append-only epoch3 write→worker revoke로 기록한다.
