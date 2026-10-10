# DaMoA Web Dashboard · Team Light

다양한 플랫폼의 방송·콘텐츠 알림을 한곳에서 모아 관리하는 다모아(DaMoA) 웹 대시보드입니다.

## 🚀 배포 환경 (Vercel)

- **정적 파일 & 프론트엔드**: Vanilla HTML, CSS, JavaScript (Pretendard & FontAwesome)
- **백엔드 API**: Vercel Python Serverless Function (`api/index.py`)
- **데이터베이스**: Neon PostgreSQL (`NEON_DB_URL`)
- **URL 구조**: `cleanUrls: true` (`/pp`, `/tos`, `/privacy`, `/terms`)

## ⚙️ Vercel 배포 설정

1. **Root Directory**: `./`
2. **Framework Preset**: `Other` (또는 빈칸)
3. **Build & Output Settings**: 기본값 그대로 (Override 필요 없음)
4. **Environment Variables**:
   - `NEON_DB_URL`: Neon PostgreSQL 연결 문자열
   - `DISCORD_CLIENT_ID`: Discord 앱 클라이언트 ID
   - `DISCORD_CLIENT_SECRET`: Discord 앱 클라이언트 시크릿
   - `DISCORD_REDIRECT_URI`: `https://<vercel-domain>/auth/callback`
   - `DISCORD_TOKEN`: Discord 봇 토큰 (서버 채널/역할 조회용)
   - `FLASK_SECRET_KEY`: 무작위 문자열

## 📄 법적 문서

- 개인정보 처리방침: `/pp` (`pp.html`)
- 서비스 이용약관: `/tos` (`tos.html`)
- 공식 서포트 서버: [https://discord.gg/ZnWmyyXF5s](https://discord.gg/ZnWmyyXF5s)
