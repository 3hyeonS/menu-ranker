# 카카오 장소 ID → 브랜드 매핑 (`restaurant_branch`)

프론트 지도(카카오 로컬 API)의 장소 `id`로 "등록된 브랜드인지"를 조회하는 `POST /restaurant/brands`의 데이터다.
결정 근거는 이슈 #31의 `## 결정` 댓글이다. 지점 메뉴·개인 식당은 #30에서 이 테이블을 확장한다.

## 테이블

| 컬럼 | 설명 |
|---|---|
| `kakao_place_id` | 카카오 장소 `id`(문자열, unique). API 응답에서는 number로 변환 |
| `restaurant_id` | 브랜드 `restaurant.id`. 매칭이 없으면 NULL. `restaurant` 행이 지워지면 SET NULL |
| `place_name`, `address`, `kakao_category` | 수집 당시 카카오 장소명·주소·카테고리 |
| `match_source` | 매칭 근거 `category` / `name` |

API는 `restaurant_id`가 있는 행만 응답한다.

## 매칭 규칙 (`scripts/kakao-map/kakao-brand-matcher.ts`)

1. 정규화: 소문자로 바꾸고 문자·숫자 외(공백·기호)를 지운다.
2. 브랜드 키: DB `restaurant.name`과 `BRAND_ALIAS_GROUPS`의 별칭(`BHC치킨`, `지코바`, `던킨`, `한솥도시락`, `서브웨이`↔`써브웨이`, 카페 `메가MGC커피`·`할리스커피` 등).
3. 카카오 카테고리 3단계 이후 세그먼트(`음식점 > 패스트푸드 > 롯데리아`의 `롯데리아`)가 키와 같으면 `category` 매칭.
4. 아니면 장소명 **첫 단어**가 키와 같으면 `name` 매칭. 접두어 비교는 하지 않는다(`샐러디아`·`할리스코` 오탐 방지).
5. 장소명이 `EXCLUDED_DERIVED_BRANDS`(`맘스터치 피자앤치킨`, `굽네치킨 피자`)로 시작하면 메뉴가 달라 매칭하지 않는다.

새 별칭·제외 브랜드는 위 상수에 추가하고 `kakao-brand-matcher.spec.ts`에 사례를 넣는다.

### 별칭 찾기 (`unmatched segment:` 출력)

import는 매칭되지 않은 장소의 3단계 이후 카테고리 세그먼트를 많은 순으로 30개 출력한다. 공백을 지운 장소명이 그 세그먼트로 시작하는 경우만(여럿이면 가장 깊은 것) 세므로(`메가MGC커피 문정점` / `... > 메가MGC커피`) `갈비`·`디저트카페` 같은 일반 분류는 거의 빠지고 프랜차이즈 표기가 남는다. 여기에 DB 브랜드의 다른 표기가 보이면 사용자에게 확인한 뒤 별칭으로 추가한다.

- 카페 별칭은 #32 결정(2026-11-24)으로 `메가MGC커피`·`할리스커피`만 넣었다. 나머지는 CE7 수집 후 이 출력을 보고 정한다.
- `매머드익스프레스`는 메뉴가 다를 수 있어 `매머드커피`에 매칭하지 않는다(#32 결정).

## 한계

- 수집한 한강 이남 11개 구 밖, 수집 이후 새로 생긴 지점은 응답에 없다. 재수집 후 다시 import한다.
- 카페 브랜드는 카카오 `CE7`(카페) 그룹에 있어 음식점(`FD6`) 수집에는 나오지 않는다. `kakao-map/cafe/<구>/places.jsonl`(`--category-group=CE7`, `docs/kakao-map-menu-crawler.md`)을 함께 넘겨야 매핑된다(#32).
- 2026-10-31 데이터(11개 구) 기준: 49,639곳 중 2,336곳 매칭(카테고리 2,312, 이름 24).
- 2026-11-24 음식점 데이터(25개 구, DB 대신 brand-nutrition 브랜드명으로 미리보기) 기준: 100,400곳 중 4,419곳 매칭(카테고리 4,380, 이름 39). 0건은 카페 브랜드 17개·공차(CE7 수집 전)다.

## import

입력은 메인 체크아웃의 `kakao-map/<구>/places.jsonl`(음식점)과 `kakao-map/cafe/<구>/places.jsonl`(카페, git 미추적)이다. 여러 파일을 한 번에 넘기고, 같은 장소 id는 처음 것만 쓴다. 카페를 아직 수집하지 않았으면 카페 경로는 뺀다(펼쳐지지 않은 glob은 없는 파일로 오류가 난다).

```bash
# DB 없이 매칭 결과만 미리 보기(브랜드명 목록 파일: 한 줄에 하나, id는 가짜)
$ npm run restaurant:branch-import -- kakao-map/*/places.jsonl kakao-map/cafe/*/places.jsonl --validate-only --brands-file=<브랜드목록.txt>

# DB의 restaurant로 매칭만 확인(쓰기 없음)
$ npm run restaurant:branch-import -- kakao-map/*/places.jsonl kakao-map/cafe/*/places.jsonl --validate-only

# 적재(허락 후). 입력에 있는 장소만 upsert하고, 매칭이 풀린 장소는 restaurant_id를 NULL로 바꾼다.
$ npm run restaurant:branch-import -- kakao-map/*/places.jsonl kakao-map/cafe/*/places.jsonl
```

- 출력의 `name match:` 줄(이름으로만 잡힌 장소)과 `unmatched segment:` 줄(놓친 별칭 후보)을 검수한다.
- 카페 파일을 빼고 음식점 파일만 넘기면 카페 장소는 입력에 없으므로 기존 카페 매핑은 그대로 남는다(입력에 있는 장소만 갱신).
- `restaurant:import`는 restaurant를 전부 지우고 다시 넣어 id가 바뀌고 매핑이 NULL이 된다. **restaurant를 다시 import했으면 이 스크립트도 다시 실행한다.**
- `kakao-map/trial/` 같은 시험 수집 폴더는 넘기지 않는다.
