# F-20 R4 개발 실행 지시

유효한 R4 worker/write lease의 정확한 6개 경로만 단일 writer로 수정하라. WorkInstruction의 7건을 실제 실패로 재현하고 역사 hash·scope·권한 검사를 약화하지 않는 최소 변경으로 RED→GREEN을 증명하라. 로컬 결과와 잔여 실패를 Main에 보고하고 commit/push는 하지 말라. Main이 WSL-server 동일 SHA와 전체 suite를 검증한다.
