# F-20 WSL Final Validation Invocation

1. 동일 Git commit을 WSL-server 전용 checkout으로 수신한다.
2. 메뉴/API 계약·runtime smoke·monitoring·backup/restore/rollback을 실행한다.
3. Windows Chrome 임시 격리 프로필의 headless/CDP 검증은 승인된 범위에서만 수행하고 기존 프로필/계정/탭은 사용하지 않는다.
4. 전용 checkout·container·DB·backup·profile·process를 exact cleanup하고 residue를 확인한다.
