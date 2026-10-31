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
2. 브랜드 키: DB `restaurant.name`과 `BRAND_ALIAS_GROUPS`의 별칭(`BHC치킨`, `지코바`, `던킨`, `한솥도시락`, `서브웨이`↔`써브웨이` 등).
3. 카카오 카테고리 3단계 이후 세그먼트(`음식점 > 패스트푸드 > 롯데리아`의 `롯데리아`)가 키와 같으면 `category` 매칭.
4. 아니면 장소명 **첫 단어**가 키와 같으면 `name` 매칭. 접두어 비교는 하지 않는다(`샐러디아`·`할리스코` 오탐 방지).
5. 장소명이 `EXCLUDED_DERIVED_BRANDS`(`맘스터치 피자앤치킨`, `굽네치킨 피자`)로 시작하면 메뉴가 달라 매칭하지 않는다.

새 별칭·제외 브랜드는 위 상수에 추가하고 `kakao-brand-matcher.spec.ts`에 사례를 넣는다.

## 한계

- 수집한 한강 이남 11개 구 밖, 수집 이후 새로 생긴 지점은 응답에 없다. 재수집 후 다시 import한다.
- `places.jsonl`은 카카오 `FD6`(음식점) 그룹만 수집해 **카페 브랜드는 매핑이 0건**이다(#32에서 `CE7` 수집으로 보강).
- 2026-10-31 데이터 기준: 49,639곳 중 2,336곳 매칭(카테고리 2,312, 이름 24). 0건 브랜드는 카페 20개·공차·피자나라치킨공주·달콤왕가탕후루.

## import

입력은 메인 체크아웃의 `kakao-map/<구>/places.jsonl`(git 미추적)이다. 여러 파일을 한 번에 넘기고, 같은 장소 id는 처음 것만 쓴다.

```bash
# DB 없이 매칭 결과만 미리 보기(브랜드명 목록 파일: 한 줄에 하나, id는 가짜)
$ npm run restaurant:branch-import -- kakao-map/*/places.jsonl --validate-only --brands-file=<브랜드목록.txt>

# DB의 restaurant로 매칭만 확인(쓰기 없음)
$ npm run restaurant:branch-import -- kakao-map/*/places.jsonl --validate-only

# 적재(허락 후). 입력에 있는 장소만 upsert하고, 매칭이 풀린 장소는 restaurant_id를 NULL로 바꾼다.
$ npm run restaurant:branch-import -- kakao-map/*/places.jsonl
```

- 출력의 `name match:` 줄(이름으로만 잡힌 장소)을 검수한다.
- `restaurant:import`는 restaurant를 전부 지우고 다시 넣어 id가 바뀌고 매핑이 NULL이 된다. **restaurant를 다시 import했으면 이 스크립트도 다시 실행한다.**
- `kakao-map/trial/` 같은 시험 수집 폴더는 넘기지 않는다.
