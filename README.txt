관리자 깜빡임 방지 핫픽스
- /admin/index.html: 로그인/로그아웃 시 전체 리로드 제거
- /admin/cms.html: 컬렉션 전환 시 location.reload() 제거, invite_token 1회 처리 가드
적용 방법: 이 ZIP을 사이트 루트에 풀어 /admin 폴더만 덮어쓰기 → 배포 후 강력 새로고침

(이 핫픽스에는 config.yml이 포함되지 않습니다. 기존 config.yml에 news/pubs 컬렉션이 있어야 합니다.)