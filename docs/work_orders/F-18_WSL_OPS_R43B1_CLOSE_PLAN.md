# F-18 R43B1 QA issuer 정적 구현 checkpoint 종료

- 제품 exact5 SHA `160e98ee0ee2a71ec047215c58ad40c21eeedc36`. Developer 지정 회귀 132 PASS, Main diff/거부 경계 검토 Critical·Important 확정 결함 0, 제품 SHA 지정 원격 게시와 G-05 seq1651 PASS에 한정한다. Main 자체 focused 74 PASS 뒤 control test 1 FAIL은 제품 SHA가 아직 원격에 게시되지 않아 발생한 Git projection 오류였고, Main 임시 산출물을 정확히 정리·게시한 후 control 2 PASS/G-05 PASS로 해소했다.
- B1은 합성 QA issuer 코드·이미지 계약의 로컬 정적 범위까지만 통과했다. 실제 Docker build/image ID, WSL Compose/TLS/OIDC/PG18/브라우저는 B2 후속이며 F-18 accepted=false, F-19 blocked, Production NOT_EXECUTED다. 전체 bare pytest는 기존 13 collection ERROR로 non-green이다.
- epoch28 write lease를 먼저, worker lease를 다음으로 회수한다. 제품 write scope를 비우고 Main 소유로 되돌린다. 종료 이벤트 seq1652~1653, 기존 seq1~1651 원문 보존. R43B2 별도 검증 단계는 새 지시·자원 사전 기록·control gate 뒤에만 시작한다.
- Main은 종료 control exact 파일만 commit/push 후 clean 원격 HEAD에서 materialize하고 G-05 PASS를 확인한다. 이전 R43B1 start manifest/event는 소급 변경하지 않는다.
