# F-18 R45C rollback rehearsal 보완 실행 지시

위 WorkInstruction의 순서대로 old 비-OIDC runtime과 별도 restore DB를 WSL-server에서 실행한다. 생성 전 자원 inventory와 owner·수명·정리 방법을 `WORK_STATUS`에 기록하고, 실행 중 오류는 해당 단계에서 멈춰 evidence에 남긴다. 종료 전 exact ID·realpath·연결자를 확인하고 전용 자원만 제거한다.
