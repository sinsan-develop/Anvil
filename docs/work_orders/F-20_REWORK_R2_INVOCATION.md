# F-20 R2 개발 실행 지시

유효한 R2 worker/write lease의 정확한 8개 경로만 단일 writer로 재작업하라. WorkInstruction의 각 WSL 실패를 RED→GREEN으로 확인하고 로컬 테스트 후 지정 원격에 push하여 WSL-server의 동일 SHA로 재검증하라. 제품 기능·계약을 임의 변경하지 말고, F-20 전체 수락이나 main 병합을 선언하지 말라.
