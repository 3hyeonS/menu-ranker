# 카카오 장소 → 지점·메뉴 적재 (`restaurant_branch`, `restaurant_branch_menu`)

프론트 지도(카카오 로컬 API)의 장소 `id`로 조회하는 두 API의 데이터다.

- `POST /restaurant/brands`: 요청한 장소 중 `restaurant_branch`에 있는 장소를 개인 식당까지 모두 요청 순서대로 돌려준다(#31, #39). 프랜차이즈 지점은 브랜드 `restaurant_id`·브랜드명, 개인 식당(브랜드 매칭 없음)은 카카오 장소명(`place_name`)이다. 개인 식당의 `restaurant_id`는 표시할 영양 추정 메뉴가 있으면 가상 ID(`100000000 + restaurant_branch.id`, #41), 없으면 `null`이다. 적재하지 않은 장소는 빠진다.
- `POST /restaurant/place`: 장소 하나의 카카오 메뉴(메뉴명·사진)와 브랜드 매핑을 돌려준다(#30). 영양정보는 없다. 프랜차이즈 지점이면 응답의 `restaurant_id`로 `/restaurant/detail`을 불러 영양정보 메뉴·추천을 받는다.

앱은 `/restaurant/brands` 항목의 `restaurant_id`가 있으면 `/restaurant/detail`(영양 기반 추천), null이면 `/restaurant/place`(카카오 메뉴판)를 부른다(#39 결정, 2026-11-24 "개인 식당도 하나의 브랜드"). 개인 식당 가상 ID의 `/restaurant/detail`은 지점 메뉴 중 영양 추정값이 있는 메뉴만 준다(`docs/kakao-menu-nutrition-estimate.md`).

결정 근거는 이슈 #31·#30의 `## 결정` 댓글과 #39 본문의 `## 결정`이다.

## 테이블

`restaurant_branch`: 카카오 장소(지점) 1행. 개인 식당은 `restaurant_id`가 NULL이다.

| 컬럼 | 설명 |
|---|---|
| `kakao_place_id` | 카카오 장소 `id`(문자열, unique). API 응답에서는 number로 변환 |
| `restaurant_id` | 브랜드 `restaurant.id`. 개인 식당이거나 매칭이 없으면 NULL. `restaurant` 행이 지워지면 SET NULL |
| `place_name`, `address`, `kakao_category` | 수집 당시 카카오 장소명·주소·카테고리 |
| `match_source` | 매칭 근거 `category` / `name`(개인 식당은 NULL) |

`restaurant_branch_menu`: 지점 메뉴. 지점이 지워지면 CASCADE로 같이 지워진다.

| 컬럼 | 설명 |
|---|---|
| `branch_id` | `restaurant_branch.id` |
| `sort_order` | 카카오 표시 순서(`menus.csv` 안의 순서, 0부터). `UNIQUE(branch_id, sort_order)`가 조회 인덱스를 겸한다 |
| `name` | 메뉴명. 같은 식당에 같은 이름이 있어도(카카오 원본 중복) 그대로 둔다 |
| `photo_url` | 카카오 CDN 사진 URL. 적재할 때 `http://`를 `https://`로 바꾼다(iOS ATS). 없으면 NULL |

가격·영양정보는 저장하지 않는다(#30 결정). 개인 식당 메뉴의 영양 추정값은 정규화 메뉴명 단위로 `restaurant_menu_nutrition_estimate`에 따로 두고 조회할 때 잇는다(#41, `docs/kakao-menu-nutrition-estimate.md`).

## 적재 대상

- `restaurants.csv`의 장소 전부(카페·디저트·술집·간식을 뺀 음식점, 개인 식당 포함). 메뉴는 `menus.csv`에서 가져온다. 메뉴가 없으면 빈 목록이다.
- `places.jsonl`(제외 카테고리 포함 원본)에서 브랜드에 매칭된 장소. `restaurants.csv`에 없으면(예: `간식` 카테고리의 파리바게뜨) 메뉴를 수집하지 않았으므로 지점 메뉴가 비어 있다. 이런 지점은 `restaurant_id`로 브랜드 메뉴를 본다.
- 카페 폴더(`kakao-map/cafe/<구>/places.jsonl`, #32)의 장소도 브랜드에 매칭된 것만 메뉴 없이 들어간다.
- 그 밖의 `places.jsonl` 장소(브랜드가 아닌 카페 등)는 넣지 않는다. 예전에 들어간 행이 있으면 `restaurant_id`만 NULL로 바꾸고, 행과 메뉴는 남긴다(#30 결정). 그래서 재수집 때 카테고리가 바뀌어 대상에서 빠진 장소도 `/restaurant/place`에는 지난 메뉴가 계속 나온다.
- 메뉴는 수집을 마친 장소(`menu-done.txt`에 있거나 `menus.csv`에 행이 있음, 크롤러와 같은 기준)만 교체한다. 수집에 실패했거나 아직 끝나지 않은 장소는 지난 적재의 메뉴를 그대로 둔다(`menu summary`의 `menuNotCollectedCount`).
- 장소 id가 20자, 이름이 255자를 넘으면 넣지 않는다(`oversizedPlaceCount`). 255자를 넘는 주소·카테고리는 NULL로 둔다.
- 같은 장소 id가 여러 구 폴더에 있으면 처음 것을 쓴다.

## 매칭 규칙 (`scripts/kakao-map/kakao-brand-matcher.ts`)

1. 정규화: 소문자로 바꾸고 문자·숫자 외(공백·기호)를 지운다.
2. 브랜드 키: DB `restaurant.name`과 `BRAND_ALIAS_GROUPS`의 별칭(`BHC치킨`, `지코바`, `던킨`, `한솥도시락`, `서브웨이`↔`써브웨이`, 카페 `메가MGC커피`·`할리스커피` 등).
3. 카카오 카테고리 3단계 이후 세그먼트(`음식점 > 패스트푸드 > 롯데리아`의 `롯데리아`)가 키와 같으면 `category` 매칭.
4. 아니면 장소명 **첫 단어**가 키와 같으면 `name` 매칭. 접두어 비교는 하지 않는다(`샐러디아`·`할리스코` 오탐 방지).
5. 장소명이 `EXCLUDED_DERIVED_BRANDS`(`맘스터치 피자앤치킨`, `굽네치킨 피자`)로 시작하면 메뉴가 달라 매칭하지 않는다.

새 별칭·제외 브랜드는 위 상수에 추가하고 `kakao-brand-matcher.spec.ts`에 사례를 넣는다. 적재 대상 선택과 CSV 파싱은 `scripts/kakao-map/kakao-branch-import-plan.ts`에 있다.

### 별칭 찾기 (`unmatched segment:` 출력)

import는 매칭되지 않은 장소의 3단계 이후 카테고리 세그먼트를 많은 순으로 30개 출력한다. 공백을 지운 장소명이 그 세그먼트로 시작하는 경우만(여럿이면 가장 깊은 것) 세므로(`메가MGC커피 문정점` / `... > 메가MGC커피`) `갈비`·`디저트카페` 같은 일반 분류는 거의 빠지고 프랜차이즈 표기가 남는다. 여기에 DB 브랜드의 다른 표기가 보이면 사용자에게 확인한 뒤 별칭으로 추가한다.

- 카페 별칭은 #32 결정(2026-11-24)으로 `메가MGC커피`·`할리스커피`만 넣었다. 나머지는 CE7 수집 후 이 출력을 보고 정한다.
- `매머드익스프레스`는 메뉴가 다를 수 있어 `매머드커피`에 매칭하지 않는다(#32 결정).

## 한계

- 수집 지역 밖이나 수집 후 새로 생긴 지점은 응답에 없다. 운영 적재는 서울 25개 구이고, 수도권(경기·인천)은 #47에서 로컬 수집 중이다(운영 적재는 별도 승인)(`/restaurant/brands`에서 빠지고 `/restaurant/place`는 404). 재수집 후 다시 적재한다.
- 카페 브랜드는 카카오 `CE7`(카페) 그룹에 있어 음식점(`FD6`) 수집에는 나오지 않는다. 카페 폴더(`kakao-map/cafe/<구>/`, `--category-group=CE7`, `docs/kakao-map-menu-crawler.md`)를 함께 넘겨야 매핑된다(#32). 카페 지점은 메뉴를 수집하지 않아 지점 메뉴가 비어 있다.
- `/restaurant/brands`는 `restaurant_id`가 NULL인 행을 개인 식당으로 내보낸다. 다만 `restaurant_id`만 NULL이고 `match_source`가 남은 행(`restaurant:import`로 브랜드가 지워져 FK SET NULL된 프랜차이즈 지점)은 개인 식당으로 오인하지 않도록 뺀다. 이 스크립트를 다시 실행하면 돌아온다.
- 적재 대상에서 빠져 브랜드 매핑을 해제한 행(`restaurant_id`·`match_source` 모두 NULL)은 진짜 개인 식당과 구분되지 않아 `/restaurant/brands`에 개인 식당으로 나온다(메뉴는 지난 적재분 또는 빈 목록). 구분하려면 적재 상태 컬럼이 필요하다(#39 리뷰, 스키마 변경이라 이번에는 하지 않음).
- 사진은 카카오 CDN에 직접 링크하므로 CDN 정책이 바뀌면 깨질 수 있다.
- 2026-10-31 데이터(11개 구) 기준: 49,639곳 중 2,336곳 매칭(카테고리 2,312, 이름 24).
- 2026-11-24 음식점 데이터(25개 구, 카페 수집 전) 기준 `--validate-only`(브랜드 목록은 `brand-nutrition/brand-info.csv` 59개) 결과: 장소 100,400곳 중 적재 78,804곳(개인 74,385, 브랜드 4,419 — 카테고리 4,380, 이름 39, 이 중 메뉴 미수집 1,069), 메뉴 1,134,585행(메뉴 있는 식당 66,814곳, 사진 134,460개). 0건 브랜드 18개는 카페 16개·공차·팔공티다.

## 적재

입력은 메인 체크아웃의 **구 폴더**(git 미추적)다.

- 음식점 폴더 `kakao-map/<구>/`: `places.jsonl`·`restaurants.csv`·`menus.csv`·`menu-done.txt`가 모두 있어야 하고, 하나라도 없으면 중단한다.
- 카페 폴더 `kakao-map/cafe/<구>/`: 수집기가 남긴 `category-group.txt`가 `CE7`인 폴더다. `places.jsonl`만 있으면 되고, 브랜드에 매칭된 장소만 메뉴 없이 들어간다(그 밖의 카페는 넣지 않는다).
- 카페를 아직 수집하지 않았으면 카페 경로는 뺀다(펼쳐지지 않은 glob은 없는 폴더로 오류가 난다).
- `kakao-map/trial/`·`kakao-map/trial-47/` 같은 시험 수집 폴더는 넘기지 않는다(`kakao-map/*구/`로 넘기면 빠진다).
- 수도권 폴더(#47, `docs/kakao-map-menu-crawler.md` 「수도권(경기·인천) 수집」)는 `kakao-map/경기/<시·군>/`, `kakao-map/인천/<군·구>/`(카페 `kakao-map/cafe/경기/*/`, `kakao-map/cafe/인천/*/`)다. 서울과 함께 넘기려면 `kakao-map/*구/ kakao-map/경기/*/ kakao-map/인천/*/`처럼 경로를 더한다. 시·군 경계 근처 장소는 이웃 지역 폴더에도 있을 수 있으나 주소 필터로 지역마다 한 곳에만 남고, 남더라도 처음 폴더의 것을 쓴다.

```bash
# DB 없이 적재 계획만 보기(브랜드명 목록 파일: 한 줄에 하나, id는 가짜)
$ npm run restaurant:branch-import -- kakao-map/*구/ kakao-map/cafe/*구/ --validate-only --brands-file=<브랜드목록.txt>

# DB의 restaurant로 계획만 확인(쓰기 없음)
$ npm run restaurant:branch-import -- kakao-map/*구/ kakao-map/cafe/*구/ --validate-only

# 적재(허락 후). 입력에 있는 장소만 upsert하고 그 지점 메뉴를 지운 뒤 다시 넣는다.
$ npm run restaurant:branch-import -- kakao-map/*구/ kakao-map/cafe/*구/
```

- 먼저 대상이 아닌 장소의 브랜드 매핑을 해제한 뒤, 장소 1,000곳씩 한 트랜잭션(장소 upsert → 지점 메뉴 삭제 → 메뉴 1,000행씩 INSERT)으로 쓴다. 중간에 끊겨도 같은 명령을 다시 실행하면 같은 결과가 된다.
- 입력에 없는 장소는 건드리지 않으므로 구 하나만 다시 적재해도 다른 구 데이터는 그대로다. 카페 폴더를 빼고 실행하면 기존 카페 매핑도 그대로 남는다.
- 출력의 `name match:` 줄(이름으로만 잡힌 장소)과 `unmatched segment:` 줄(놓친 별칭 후보)을 검수한다. `menu summary`의 `invalidMenuRowCount`·`orphanMenuPlaceCount`(restaurants.csv에 없는 식당의 메뉴)·`menuNotCollectedCount`가 0이 아니면 원인을 확인한다. `otherFolderMenuPlaceCount`는 다른 구 폴더에서 이미 적재한 경계 장소라 정상이다.
- `restaurant:import`는 restaurant를 전부 지우고 다시 넣어 id가 바뀌고 매핑이 NULL이 된다. **restaurant를 다시 import했으면 이 스크립트도 다시 실행한다.**
- 메모리: 기본 `ts-node`는 타입 검사 때문에 25개 구 전체에서 최대 약 880MB를 쓴다. 운영 EC2(약 911MB)처럼 작은 서버에서 돌릴 때는 `TS_NODE_TRANSPILE_ONLY=true NODE_OPTIONS=--max-old-space-size=256`을 붙인다(측정 약 270MB).
- 운영 적재는 메뉴 약 113만 행(추정 150~250MB)이라 새벽 시간대에 한다.

## 갱신

자동 갱신은 없다. 메인 체크아웃에서 재수집(`docs/kakao-map-menu-crawler.md`)한 뒤 허락받고 위 적재를 다시 실행한다. 권장 주기는 분기 1회다.
