# 메뉴 이미지 벤치마크 입력

현재 메뉴 import CSV(`brand-nutrition/`, 수집 규칙 문서 참고)와 `restaurant_menu` 테이블에는 이미지 URL이 없다.
이미지 실험은 `benchmark-inputs/restaurant-menu-images.csv`를 별도로 받아 기존
영양 정답 CSV와 브랜드·메뉴명으로 조인한다.

필수 열은 `브랜드`, `메뉴`, `이미지 URL`, `출처 URL`이다. 이미지와 출처는 모두
HTTPS URL이어야 하며, 브랜드·메뉴 조합은 정답 CSV에 정확히 존재해야 한다.

검증 명령:

```bash
npm run restaurant:nutrition-images:validate
```

검증을 통과한 뒤 고정 분할별 최대 100개를 뽑아 텍스트 전용과 텍스트+이미지를
동일 모델·프롬프트·RAG 근거로 비교한다. URL 다운로드 실패와 이미지 판독 실패는
별도 실패율로 기록한다.
