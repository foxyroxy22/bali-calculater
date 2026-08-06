# 발리 경비 계산기

발리 여행 중 식당/쇼핑 계산서를 세금·서비스차지 구조로 계산하고, 가계부로 저장하는 정적 웹앱.
로그인/서버 없음 — 모든 데이터는 브라우저 `localStorage`에만 저장됨.

## 로컬 실행

그냥 `index.html`을 브라우저로 열면 됨. 빌드 과정 없음.

## 테스트

```bash
npm test
```

## 배포 (GitHub Pages)

1. GitHub 저장소 Settings → Pages → Source를 `main` 브랜치 `/ (root)`로 설정.
2. 몇 분 후 `https://foxyroxy22.github.io/bali-calculater/` 에서 접속 가능.
3. 아이폰: Safari로 위 주소 접속 → 공유 버튼 → "홈 화면에 추가" 하면 앱처럼 아이콘 생김.

## 데이터 내보내기

가계부 화면 하단 "내보내기 (JSON)" 버튼 → `bali-expenses-YYYY-MM-DD.json` 다운로드.
파일 구조: `{"entries": [{id, tab_type, date, items, tax_mode, tax_rate, service_rate, subtotal_idr, extra_idr, total_idr, fx_rate_snapshot, total_krw, memo}, ...]}`
