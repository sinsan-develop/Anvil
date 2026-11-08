# FN03 관리 원문 생산자 기술 WI 준비 — 미채택/코드 GO0

기준 후보 cbefc3e3736301e9a49b8b26db41fcc3c0cedbb0a052c9e0cdaedde0b93c5230·결정 패킷239845d61699c4987aeb11a05046a115f323c1bee1949ca38837fcd6d48a6eaf는 그대로 보존한다. 새 권한/원문/비용의 의미를 바꾸는 문서가 아니라, 해당 후보가 이미 요구한 구현 전 정확 RPC/ACL/DAG/잠금·Mtemplate 검수의 준비 기록이다. 아직 함수 시그니처/열 ACL이 완결되지 않았고 제품/SQL 작성·실제 실행 GO가 아니다.

## 1. 인증과 잠금 조사
기존 AccessRepository 실제 인증은 token/CSRF소유 검증과user/session/client행잠금을 한다. 현재FN77 approval_context는 auth→project/member/control→현재permission_policy head FOR SHARE 후account FOR UPDATE다. 이 권한정책head와신규source_content_policy_events의최신head는다른행이다. candidate의account뒤정책head를권한정책head로오독해기존순서를뒤집지않는다. 새source event head만account뒤에고정할수있는지모든호출선과같은Tx로검토중이다. 현단계에서교착없음을확정하지않는다.

## 2. 구현 전 해결할 시각 모순
기존 projectMaterialReceipt는 commands.completed_at=now(),serverReceivedAt=transaction_timestamp()여서Tx시작시각이다. 새관리E/O.recordedAt를잠금뒤freshclock으로발급하고부모계약E.recordedAt≤O.recordedAt≤C.completedAt를적용하면기존genericreceipt와모순될수있다. Tx시작시각을E/O에대입해우회하면대기중저장된previous head보다과거시각이될수있다. 이문제는실SQL실패재현이아닌원소스대조에서확인한구현선행finding이다.

해결기술후보는이새목적의producer/RPC에서잠금후실DBclock을캡처해E/O를발급하고,목적한정C/A/U완료시각도freshDBclock으로기록하는것이다. 기존일반receipt의시각·정책·동작은변경하지않는다. 같은Tx/원command/receipt/audit·R정착을유지하고genericpersist를중첩호출해두번저장하지않는다. max(old,now)같은인위시각이나부적합Tx시작시각으로일치시키지않으며실clock역행/수명위반은명확거절/rollback한다. 정확한원authorization재사용·purpose완료함수/RPC시그니처와호출선은현재기존Primary읽기검토중이다.

후보의CM결과exact9/receipt·audit형상과E≤O≤C시각관계·목적/권한·원문/보존·기존10GiB계상은불변이다. 이는그관계를지키기위한내부구현선택이지만기술WI독립검토·시험전해소로판정하지않는다. 코드/DDL/DB/권한/키/서비스·Agent·SSH·실자료실행0이다.

## 3. 다음 기술 완료조건
정확쓰기목록·RPC인자/역할별열ACL·함수DAG·각잠금행/순서·같은XID/원callback기한·원계보완결·예약/실정산5행/M상계template·시각/동시성음성을고정하고독립C/I를닫는다. 후보직접채택과이기술동결이둘다있을때만기존Primary단일writer에코드·미적용SQL·합성검증을배정한다. nonce/native서명·실파일/LINK·실제DB/GRANT등은포함하지않는다.
