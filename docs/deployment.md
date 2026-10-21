# EC2 자동 배포

`main`에 push하면 GitHub Actions가 테스트와 빌드를 수행하고 EC2에 배포합니다.
GitHub의 Actions → Deploy to EC2 → Run workflow에서도 main을 수동 배포할 수 있습니다.

- 서버: Ubuntu, `/home/ubuntu/menu-ranker`
- 실행 환경: Node 20.20.1, 전역 PM2 앱 `main`
- 배포: Git fast-forward → 운영 의존성 설치 → 빌드 파일 적용 → PM2 재시작
- 확인: 서버 로컬 `/health`를 최대 30회 조회
- `.env`, 인증서 등 서버 전용 파일은 유지합니다.
- DB 마이그레이션·데이터 변경은 배포 시 실행하지 않습니다.
- 배포가 겹치면 Actions는 순서대로 처리하고 서버에서도 잠금으로 중복 실행을 막습니다.
- 서버의 추적 파일에 로컬 변경이 있으면 덮어쓰지 않고 배포를 중단합니다.

GitHub Actions Secrets:

| 이름              | 용도                         |
| ----------------- | ---------------------------- |
| `EC2_HOST`        | EC2 접속 호스트              |
| `EC2_SSH_KEY`     | 자동 배포 전용 SSH 개인키    |
| `EC2_KNOWN_HOSTS` | 확인된 EC2 SSH 호스트 공개키 |

서버에는 배포 전용 공개키를 `~/.ssh/authorized_keys`에 등록합니다.
EC2 SSH 보안 그룹에서 Actions 실행 환경의 접속이 가능해야 합니다.
개인키와 운영 `.env`를 저장소에 커밋하지 않습니다.

배포 중 PM2 재시작에 따른 짧은 중단이 발생할 수 있습니다.
실패는 GitHub Actions에서 확인하고 서버 상태는 `pm2 status`, `pm2 logs main`으로 확인합니다.
자동 롤백은 구성하지 않았습니다. 의존성 변경 후 실패했다면 서버에서 원인 확인이 필요합니다.
