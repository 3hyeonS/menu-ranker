# 카카오 지점 메뉴 영양 추정 (`restaurant_menu_nutrition_estimate`)

카카오로 수집한 지점 메뉴(`restaurant_branch_menu`)에는 메뉴명·사진만 있다. 개인 식당 메뉴를
`/restaurant/detail`의 칼로리·추천 탭에 쓰려고 **정규화 메뉴명 단위**로 영양값을 한 번씩 추정해 저장한다(#41).
결정 근거는 이슈 #41의 `## 결정` 댓글 두 개다.

## 흐름

1. `restaurant:menu-nutrition:estimate`: 구 폴더에서 개인 식당 메뉴를 읽어 정규화 이름별로 묶고, 매장 수 순으로 `--limit`개를 고른다.
   - 식약처 음식명(`menu`의 `(식약처_음식)` 공용 메뉴)과 정규화 이름이 같으면 LLM 없이 식약처 값(`source: mfds`).
   - 나머지는 Gemini로 추정(`source: llm`). 결과를 JSONL로 쓴다. DB에는 쓰지 않는다.
2. `restaurant:menu-nutrition:evaluate`: 정답이 있는 표본으로 오차·보류 비율·토큰을 잰다(시범 평가).
3. `restaurant:menu-nutrition:import`: JSONL을 테이블에 upsert한다.
4. API: `/restaurant/brands`가 표시할 추정 메뉴가 있는 개인 식당에 가상 `restaurant_id`를 주고, `/restaurant/detail`이 그 ID로 지점 메뉴 + 추정값을 기존 응답 형식으로 돌려준다.

## 정규화 (`src/utils/branch-menu-name.util.ts`)

`normalizeBranchMenuName`: 출처 접두어·괄호 안 내용·수량 표기(`2인분`, `500ml`, `8개` 등)·단독 크기 표기(`소`·`중`·`대`·`특`·`S`·`M`·`L`·`R`·`HOT`·`ICE`)를
지우고 한글·영문·숫자만 남겨 소문자로 만든다. 한글도 단어 문자로 보므로 `소고기`·`중국냉면`·`2인세트`는 그대로다.
#41 분석(서울 25개 구 113만 행 → 182,224종)과 같은 결과가 나온다(원문 메뉴명 300,087종 전부 일치 확인).

- 지점 메뉴와 추정값은 FK 없이 **조회할 때 이 함수로 계산한 이름**으로 잇는다. `restaurant_branch_menu`에 컬럼을 두지 않아 113만 행 백필이 필요 없고, 재수집·재적재해도 이름이 같으면 그대로 이어진다.
- **규칙을 바꾸면 이미 적재한 추정값과 연결이 달라진다.** 바꿀 때는 추정·적재를 다시 한다.
- 크기 표기를 지우므로 `물냉면(대)`도 `물냉면` 값을 쓴다(#41 결정 6, 미결). 추정 CLI의 `sizeMarks`(크기·수량 표기가 있던 행 수·비율)로 영향을 잰다. 2026-11-24 상위 2만 종 기준 16.6%(122,307행, 8,073종).

## 테이블

| 컬럼 | 설명 |
|---|---|
| `normalized_name` | 정규화 메뉴명(UNIQUE) |
| `sample_name` | 그 이름으로 가장 많이 쓰인 원문 표기(프롬프트에 넣은 이름) |
| `source` | `mfds`(식약처 정확 일치) / `llm` |
| `calories`, `carbs`, `protein`, `fat`, `sugars`, `sat_fat` | `weight` 기준 영양값 |
| `unit`, `weight`, `unit_quantity` | 기준 중량. llm은 g·1인분 추정 총중량·`인분`, mfds는 식약처 값 |
| `confidence` | 0~1. mfds는 1. **0.6 미만은 저장하되 앱에 내보내지 않는다**(#41 결정 5) |
| `estimate_path`, `rag_confidence` | 채택 경로 `rag` / `llm_only`와 RAG 1차 confidence |
| `model`, `prompt_version` | 응답 모델, `kakao-menu-nutrition-v1` |
| `reference_menus` | 근거. llm: `[{name, brand, score}]`, mfds: `[{menu_id, name}]` |
| `input_tokens`, `output_tokens` | 묶음 호출 토큰을 메뉴 수로 나눈 값(재시도·재추정 포함) |
| `estimated_at` | 추정 시각(JSONL 값) |

마이그레이션: `src/migrations/1784000000000-AddRestaurantMenuNutritionEstimate.ts`(새 테이블만 만든다).

## 추정 방식 (`scripts/kakao-map/kakao-menu-nutrition*.ts`)

`docs/restaurant-nutrition-estimation-protocol.md`의 미관측 브랜드 규칙을 따른다(개인 식당은 모두 미관측 브랜드).

1. 근거: 브랜드 공식 영양정보 CSV(`brand-nutrition/all-menus.csv`, 23열 표준)에서 메뉴명 문자 bigram Jaccard + 식당 카테고리 보너스(+0.08)로 상위 8개(`--reference-limit`).
   - 프로토콜의 Gemini 임베딩(55%)은 쓰지 않는다. 미관측 브랜드에서는 임베딩이 문자 유사도보다 나빴고(`benchmark-results/restaurant-nutrition-embedding-summary.md`), 쿼리마다 임베딩 API를 더 불러야 한다.
   - 근거 메뉴의 영양값은 `중량`·`단위량` 기준(수집 규칙 5절)이라 둘 다 프롬프트에 넣는다.
2. 10개 묶음 RAG 호출(`gemini-2.5-flash-lite`, temperature 0.1, JSON). 근거가 하나도 없는 메뉴는 RAG를 건너뛴다.
3. RAG confidence가 0.7 미만이거나 근거가 없으면 근거 없이 순수 LLM으로 다시 추정한다(`--fallback-threshold`, 0이면 끔). 재추정이 실패하면 RAG 값을 둔다.
4. 숫자 형식이 틀린 항목만 모아 한 번 더 묻는다. 그래도 틀리면 `status: failed`로 남기고 적재하지 않는다(다음 실행에서 다시 시도).
5. 호출 실패(429·5xx·타임아웃)는 지수 백오프(2초 × 2^n, 지터 0.5~1.5배)로 `--max-retries`번 다시 보낸다. `--rpm`으로 요청 시작 간격을 둔다.

프롬프트에는 메뉴명·카카오 식당 카테고리·근거 메뉴(이름·브랜드·카테고리·기준 중량·단위량·공식 영양값)만 넣는다. 장소 id·주소·사용자 정보는 넣지 않는다(`docs/restaurant-nutrition-prompt-data-boundary.md`).
Gemini는 `GeminiClient`(`generateJsonWithUsage`) 뒤에 있고, 테스트는 `FakeGeminiClient`로 응답·오류를 넣는다.

## 실행

입력은 메인 체크아웃의 구 폴더(`kakao-map/*구/`, `restaurant:branch-import`와 같은 4개 파일)와 브랜드 공식 메뉴 CSV다.
적재 대상 장소 선택은 `restaurant:branch-import`와 같다(`planBranchImport`). 브랜드 매칭은 근거 CSV의 브랜드명으로 하고, 운영 `restaurant` 이름과 맞추려면 `--brands-file=`(한 줄에 하나)을 넘긴다.
식약처 메뉴는 DB(`menu`, 읽기 전용 트랜잭션)에서 읽거나 `--mfds-file=<JSON 배열>`(DB SELECT 결과 형식)로 넘긴다.

```bash
# 호출 없이 대상 수·예상 토큰·비용만 보기
$ npm run restaurant:menu-nutrition:estimate -- kakao-map/*구/ \
    --references=brand-nutrition/all-menus.csv --limit=20000 --dry-run

# 시범 평가(허락 후, Gemini 호출). 식약처 표본 200 + 브랜드 표본 200
$ npm run restaurant:menu-nutrition:evaluate -- kakao-map/*구/ \
    --references=brand-nutrition/all-menus.csv --sample=200

# 추정(허락 후, Gemini 호출). 결과: kakao-map/nutrition-estimate/estimates.jsonl
$ npm run restaurant:menu-nutrition:estimate -- kakao-map/*구/ \
    --references=brand-nutrition/all-menus.csv --limit=20000

# 적재 계획만(DB 쓰기 없음) → 적재(허락 후)
$ npm run restaurant:menu-nutrition:import -- kakao-map/nutrition-estimate/estimates.jsonl --validate-only
$ npm run restaurant:menu-nutrition:import -- kakao-map/nutrition-estimate/estimates.jsonl
```

| 옵션 | 기본값 | 설명 |
|---|---|---|
| `--limit` | 20000 | 매장 수 상위 이름 수(식약처 일치 포함) |
| `--batch-size` | 10 | 한 요청의 메뉴 수 |
| `--concurrency` | 5(평가 3) | 동시 요청 수 |
| `--rpm` | 300 | 분당 요청 시작 수 상한 |
| `--max-retries` | 3 | 호출 실패 재시도 |
| `--timeout-ms` | 30000 | 요청 타임아웃 |
| `--fallback-threshold` | 0.7 | 이 confidence 미만이면 순수 LLM 재추정. 0이면 끔 |
| `--reference-limit` | 8 | RAG 근거 메뉴 수 |
| `--model` | `gemini-2.5-flash-lite` | 이 모델 하나만 쓴다(실행 중 `GEMINI_MODEL`을 덮어쓰고 fallback 모델 env를 비운다) |
| `--input-price`, `--output-price` | 0.1, 0.4 | dry-run·로그 비용 계산용 1M 토큰당 USD(2026-10-18 Standard). 실행 전 현재 단가를 확인한다 |
| `--output` | `kakao-map/nutrition-estimate/*.jsonl` | git ignore 경로만 허용 |

- **재시작**: 결과 파일에 `status: ok`로 있는 이름은 건너뛴다. 중단되면 같은 명령을 다시 실행한다. 실패한 이름만 다시 시도한다.
- 같은 이름을 새 프롬프트·모델로 다시 추정하려면 새 `--output` 파일로 돌린 뒤 그 파일을 적재한다(적재는 나중 성공 레코드가 이긴다).
- 메모리: 25개 구 dry-run이 로컬에서 RSS 약 700MB, 약 7초. 추정·평가는 로컬에서 돌린다. 적재 스크립트는 JSONL만 읽어 가볍다(운영 EC2에서는 `TS_NODE_TRANSPILE_ONLY=true NODE_OPTIONS=--max-old-space-size=256`).

### dry-run 결과 (2026-11-24, 25개 구, 로컬 DB 식약처 17,260개, 근거 CSV 8,797개)

| 범위 | 이름 | 행 비율 | 식약처 일치 | LLM 대상 | 근거 없음 | 예상 비용(Standard) | 이론 시간 |
|---|---:|---:|---:|---:|---:|---:|---:|
| 상위 2만 종 | 20,000 | 77.4% | 427종(행 15.0%) | 19,573 | 3,267 | $1.74~2.15 | 약 28분(동시 5) |
| 전체 | 180,104 | 100% | 610종(행 15.0%) | 179,494 | — | $16.3~20.1 | 약 4.2시간 |
| 평가 표본 | 400 | — | — | 400 | 74 | 약 $0.04 | 약 1분 |

- 개인 식당 74,385곳·메뉴 952,177행 기준이다(브랜드 매칭은 근거 CSV 브랜드 59개라 운영과 약간 다르다).
- 비용 범위의 하한은 재추정 없음, 상한은 벤치마크 비율(RAG confidence 0.7 미만 56%)로 재추정한 경우다. 입력 토큰은 글자 수 × 0.39(벤치마크 보정), 출력은 메뉴당 100토큰으로 잡은 **추정치**라, 시범 평가의 실제 메뉴당 토큰으로 다시 계산한다.
- #41 본문 추정(10개 묶음 메뉴당 입력 332/출력 69토큰)보다 비싸다. 근거 메뉴에 당류·포화지방·단위량을, 출력에 당류·포화지방·중량을 더했기 때문이다. 줄이려면 `--reference-limit`을 낮추거나 `--fallback-threshold=0`으로 재추정을 끈다(정확도 영향은 평가로 확인).

## 평가 (`restaurant:menu-nutrition:evaluate`)

정답이 있는 메뉴를 같은 파이프라인(RAG → 재추정)에 넣어 비교한다. 결과는 `kakao-map/nutrition-estimate/evaluation.jsonl`과 `evaluation-summary.json`.

- `mfds`: 개인 식당 메뉴 중 식약처 음식명과 같은 이름(매장 수 상위). 정답은 식약처 값. 식약처 1인분 기준과 식당 1인분이 달라 오차에 양 차이도 섞인다.
- `brand`: 브랜드 연결 지점의 카카오 메뉴 중 같은 브랜드 공식 메뉴와 이름이 같은 것. 브랜드를 번갈아 뽑는다. 그 브랜드 공식 메뉴는 근거에서 빼서 미관측 브랜드처럼 평가한다.
- 요약: 표본별 `heldRate`(실패 + confidence 0.6 미만), `shown`(앱에 내보내는 값)·`allValid`(보류 전)의 칼로리·탄수화물·단백질·지방 MAE와 ±30% 비율, 경로별 수, 메뉴당 실제 토큰·비용.

## API 연동

| API | 동작 |
|---|---|
| `POST /restaurant/brands` | 개인 식당 중 표시할 추정 메뉴(칼로리 있음, confidence 0.6 이상)가 1개 이상인 곳은 `restaurant_id = 100000000 + restaurant_branch.id`, 나머지는 지금처럼 `null`. 추정값 조회가 실패하면(마이그레이션 전 등) 로그만 남기고 `null` |
| `POST /restaurant/detail` | `restaurant_id >= 100000000`이면 개인 식당 지점(`restaurant_id`·`match_source`가 모두 NULL)을 연다. 지점 메뉴를 카카오 순서로 읽어 표시할 추정값이 있는 메뉴만 기존 응답 형식으로 준다. `menu_id = 100000000 + restaurant_branch_menu.id`, `menu_category: null`, `menu_name`은 카카오 원문. 지점이 없으면 404 `Restaurant not found` |

- 추천(filter 있음)은 브랜드 식당과 같은 `rankRestaurantMenusByFilter` → 규칙 기반 대체 → 24시간 캐시를 쓴다. 식당 카테고리는 카카오 카테고리(`음식점 > ` 제외)다. 메뉴 카테고리가 없으므로 이름 끝이 음료·주류·공기밥·사리·추가 옵션 등인 메뉴는 후보에서 뺀다.
- 가상 `menu_id`는 표시·추천용이고 식사 기록(`meal_menu`)과 잇지 않는다(#41 결정 2, 기존 브랜드 메뉴 id와 같음).
- 앱이 "추정" 표시를 하려면 가상 ID 범위(100000000 이상)로 구분할 수 있다. 프론트에 공유가 필요하다(#41 결정 5는 "추정" 표시를 전제로 한다).

## 한계

- 메뉴명과 식당 카테고리만으로 추정한다. 미관측 브랜드 벤치마크 칼로리 MAE는 약 104~126kcal(프로토콜 문서)이고, 카카오 개인 식당 실제 오차는 평가 스크립트로 잰다.
- 크기 표기가 다른 메뉴가 같은 값을 쓴다(결정 6 미결).
- 정규화 이름이 같은데 식당마다 구성이 다른 메뉴(`정식`, `세트`, `오늘의 메뉴`)도 값을 공유한다. confidence가 낮으면 보류된다.
- 사진은 쓰지 않는다(#41 결정 3).
