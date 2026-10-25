# 식당 메뉴 영양성분 추정 벤치마크

공식 영양정보 CSV를 정답으로 사용해 데이터 규모, 입력 정보, 브랜드 일반화,
정확도와 요청 시간을 비교한다. 정답이 없는 영양소는 0으로 간주하지 않고 해당
영양소 평가에서 제외한다.

## 1차 기준선 실행

```bash
npm run restaurant:nutrition-benchmark -- \
  --csv=/home/sehyeon/menu-ranker/brand-nutrition/all-menus.csv
```

모든 벤치마크·부하 테스트 스크립트는 `--csv=<메뉴 CSV 경로>`가 필수다.

기본 설정은 기준 데이터 250, 500, 1,000, 2,000, 4,000개와 테스트 메뉴 최대
500개를 사용한다. 알려진 브랜드 내 메뉴 분할과 처음 보는 브랜드 분할을 각각
실행한다.

```bash
npm run restaurant:nutrition-benchmark -- \
  --csv=/home/sehyeon/menu-ranker/brand-nutrition/all-menus.csv \
  --sizes=250,500,1000,2000,4000 \
  --test-limit=500 \
  --top-k=5 \
  --min-similarity=0.2 \
  --output=benchmark-results/restaurant-nutrition-baseline.json
```

비교 입력은 메뉴명, 메뉴명+카테고리, 메뉴명+카테고리+중량이며 비교 방법은
카테고리 평균과 문자 기반 유사 메뉴 Top-K 가중 평균이다. 결과에는 영양소별
MAE, MAPE, ±20%·±30% 적중률, 추정 커버리지와 평균·p50·p95·p99 처리 시간이
포함된다.

## 다음 단계

동일한 분할과 지표를 유지한 채 텍스트 임베딩, 이미지 분석, LLM 추정 어댑터를
추가한다. 사진이 없는 현재 CSV만으로 사진 효과를 평가할 수 없으므로 메뉴 이미지
URL과 메뉴 ID를 연결한 별도 manifest가 필요하다. 외부 API 비용은 메뉴별 호출 수,
토큰 수와 실제 청구 단가를 결과에 함께 기록한다.
