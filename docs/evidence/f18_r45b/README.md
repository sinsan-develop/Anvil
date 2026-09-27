# R45B QA 공개 검증 산출물

Test/Staging 재결박 전에는 signed manifest·공개키·관측 JSON이 없다. 이 폴더에는 QA-only 비밀 아닌 원본만 정확한 hash와 함께 게시한다. private key, credential, TLS key, 운영 trust 자료는 절대 저장하지 않는다. 공개 원본이 Git에 게시되고 같은 SHA를 WSL-server가 Git으로 받은 뒤에만 격리 target 검증을 시작한다.
