# F-18 R33 OIDC session store writer 종료 계획

- 제품 commit `0b33263bdc01f5ca1422cec32936862967d94228`의 독립 검토에서 Important 2건을 보완해 모두 ADDRESSED, Critical/Important 0, Task quality Approved다. 로컬 focused 150 PASS/PG opt-in 13 SKIP이며 전체 pytest의 기존 collection 13 ERROR는 전체 PASS가 아니다.
- WSL-server의 동일 제품 SHA를 별도 checkout에 가져와 고정 PostgreSQL 18 이미지·tmpfs DB·비관리자 역할로 focused 155 PASS/8 SKIP, SELECT-only reader 조회 PASS·INSERT SQLSTATE 42501 거부, 최종 wrapper exit 0을 확인했다. 초기 2회는 각각 Windows 전송 CR 문자와 PostgreSQL 시작 준비 경합으로 실패했으며 각 시도에서 cleanup 잔여 0이다. 최종 독립 점검도 checkout/container/port 잔여 0, 기존 서비스 ID·상태 불변이다.
- 이는 영속 OIDC session 저장·철회·TTL·migration·downgrade lock과 읽기 권한의 제한된 검증이다. 실제 issuer/session coordinator/API/browser 및 F-18 전체는 미검증, Production `NOT_EXECUTED`, F-19 차단이다.
- 제품 보고서와 상태 근거를 반영한 control QA 후 canonical epoch17 write lease를 먼저, worker lease를 다음에 회수한다. 제품 추가 변경·새 branch·운영 작업 없이 revocation projection→G-05→상태 기록 순으로 수행한다.
