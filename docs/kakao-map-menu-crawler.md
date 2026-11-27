# 카카오 기준 송파구 식당·메뉴 수집

이슈 #28. 카카오 기준으로 서울 송파구 식당 목록과 메뉴명·메뉴 사진 URL을 모아 **식당 CSV**와 **메뉴 CSV** 두 개로 저장한다. 프론트 지도가 카카오 로컬 REST API를 쓰므로, 장소 ID(`장소id`·`식당id`)는 프론트가 받는 카카오 장소 `id`와 같은 값이다.

- 지금은 CSV만 만든다. 운영 DB 적재·API 연동은 아직 하지 않는다(이슈 #28 `## 결정` 댓글).
- 메뉴는 카카오맵 **비공식** 내부 API를 크롤링하므로 약관 위험이 네이버(#26)와 같다. 실제 카카오 호출은 사용자 허락을 받은 뒤에만 한다.
- 사진은 URL만 저장하고 이미지 파일은 내려받지 않는다. 사진은 카카오에 있는 것만 쓴다(네이버로 보충하지 않음).

- `--category-group=CE7`이면 **카페 장소 목록만** 모은다(#32). 아래 「카페(CE7) 장소 목록」 절을 본다.
- 서울 25개 구는 수집이 끝났다. 수도권(경기 31개 시·군, 인천 11개 군·구)은 지역 목록 파일과 실행 스크립트로 모은다(#47). 아래 「수도권(경기·인천) 수집」 절을 본다.

## 동작

1. **식당 목록**: 공식 로컬 API `GET https://dapi.kakao.com/v2/local/search/category.json`(`category_group_code=FD6` 음식점)을 `rect` 사각형으로 검색한다. 검색 한 번에 최대 45곳(15곳 × 3쪽)만 받을 수 있어서, `total_count`가 45를 넘으면 사각형을 4등분해 재귀로 검색한다. 가로세로 비가 2를 넘는 사각형(수도권 지역 목록의 가는 띠)은 긴 축으로만 2등분해 정사각형에 가깝게 만든 뒤 4등분한다(서울 사각형은 비가 2 미만이라 4등분만 쓴다). 주소(도로명, 없으면 지번)에 `송파구`가 있는 식당만 남긴다. 요청할 때는 사각형을 긴 변의 1%(최소 1e-5도)만큼 사방으로 넓혀 보낸다. 카카오 rect 판정은 사각형이 클수록 경계 오차가 커서(2026-11-27 측정: 폭 0.035도 리프에서 경계 4m 안쪽 장소가 빠지고 1e-4도 넓히면 나옴) 넓히지 않으면 리프 경계 근처 장소가 양쪽에서 모두 빠진다(#47 시험 수집에서 약 1%). `search-rects.txt`에는 넓히기 전 사각형을 기록하므로 #47 이전 폴더도 그대로 이어서 실행된다. **2026-10~11 서울 수집은 넓히기 전 방식이라 경계 근처 장소가 일부 빠져 있을 수 있다**(재수집 때 보완). 이전 분석(2026-10-28)에서 송파구 전체가 약 2,100번 호출, 송파구 식당 약 6,100곳이었다.
2. **카테고리 제외**: 카테고리(`음식점 > 술집 > 호프,요리주점` 형태)에 카페·디저트·술집 단어가 있으면 식당 CSV와 메뉴 수집에서 뺀다. 제외 단어는 네이버 수집기(`DEFAULT_EXCLUDED_CATEGORIES`)와 같다.
3. **메뉴**: 식당마다 비공식 API `GET https://place-api.map.kakao.com/places/panel3/<id>`(헤더 `pf: web`, `appVersion`, `Referer: https://place.map.kakao.com/`)를 불러 `menu.menus.items[]`의 `name`, `photo_url`을 저장한다. `menu.menus.photos`는 블로그 후기 사진이라 쓰지 않는다. 메뉴가 없으면 `menu` 키가 없거나 `items`가 비어 있고, 메뉴 CSV에 행을 쓰지 않는다.

panel3 구조는 2026-10-28 실제 응답으로 확인했다(메뉴 중 사진이 있는 비율은 표본에서 약 10%). 카카오가 구조를 바꾸면 메뉴가 0건으로 나온다. 그러면 응답 JSON에 `menu.menus.items`가 있는지 확인하고 파서와 픽스처를 함께 고친다.

## 실행

`KAKAO_CLIENT_ID`(카카오 REST API 키, 로그인에 쓰는 것과 같은 값)가 필요하다. 스크립트는 현재 폴더의 `.env`를 읽으므로(앱과 같이 `.env`가 우선) 메인 체크아웃에서 실행하면 된다.

```sh
# 시험 실행: 작은 사각형 하나, 식당 5곳만
npm run kakao-map:crawl-songpa -- --out-dir=kakao-map/trial --rect=127.10,37.50,127.11,37.51 --max-places=5

# 식당 목록만 먼저 (메인 체크아웃에서)
npm run kakao-map:crawl-songpa -- --out-dir=kakao-map/songpa --discover-only

# 전체 실행 (같은 폴더로 다시 실행하면 이어서 한다)
npm run kakao-map:crawl-songpa -- --out-dir=kakao-map/songpa
```

- 출력 폴더는 반드시 인자로 받는다. git 저장소 안이면 결과·진행 상태 파일이 모두 `.gitignore` 대상이어야 하고, 아니면 실행을 거부한다. 저장소 루트의 `/kakao-map/`이 ignore 대상이다.
- worktree 안에 두면 정리할 때 함께 지워지므로, 전체 실행 결과는 메인 체크아웃(`/home/sehyeon/menu-ranker/kakao-map/`)에 둔다.

| 옵션 | 기본값 | 설명 |
|---|---|---|
| `--out-dir=` | (필수) | 결과·진행 상태 파일을 둘 폴더 |
| `--category-group=` | `FD6` | 카카오 카테고리 그룹. `FD6` 음식점, `CE7` 카페(장소 목록만, 제외 필터 없음) |
| `--rect=` | `127.05,37.455,127.2,37.555` | 검색 사각형 `x1,y1,x2,y2`(경도·위도). `;`로 이으면 여러 사각형을 차례로 검색한다(#47). 기본값은 송파구 전체를 덮는다 |
| `--district=` | `송파구` | 주소 필터. 빈 값이면 거르지 않음 |
| `--max-depth=` | 12 | 사각형 4등분 최대 깊이(0~14). 이 깊이에서도 45곳을 넘으면 45곳만 받고 `truncatedRects`로 센다(재시작해도 유지). 좌표를 소수 6자리로 보내므로 나눈 사각형의 폭이 `MIN_SPLIT_DEG`(1e-5도, 약 1m)보다 작아지면 깊이와 관계없이 더 나누지 않는다. 루트가 작은 수도권 지역 목록(0.01도)은 깊이 9 근처에서 이 조건에 걸린다. 깊이는 4등분만 센다(긴 축 2등분은 세지 않음). 더 나눌 수 없어 45곳만 받는 사각형은 넓히지 않은 원래 사각형으로 다시 받는다 |
| `--exclude-categories=` | 카페, 디저트, 베이커리, 제과, 케이크, 아이스크림, 도넛, 와플, 커피, 주점, 술집, 호프, 이자카야, 바(BAR), 포장마차, 와인, 칵테일, 전통주 | 카테고리에 이 단어가 있으면 제외. 빈 값이면 제외하지 않음. `places.jsonl`에는 남기므로 바꿔도 검색을 다시 하지 않는다 |
| `--search-min-delay-ms=` / `--search-max-delay-ms=` | 100 / 300 | 공식 로컬 API 요청마다 쉬는 시간 |
| `--min-delay-ms=` / `--max-delay-ms=` | 1000 / 3000 | panel3 요청마다 쉬는 시간 |
| `--concurrency=` | 1 | panel3 동시 요청 수(최대 2) |
| `--max-retries=` | 3 | 재시도 횟수. 로컬 API는 429·5xx·네트워크 오류·형식이 맞지 않는 200 응답, panel3는 404·410을 뺀 모든 오류 상태(403·429·5xx, 헤더 거절로 보이는 400·401 등)·네트워크 오류·JSON이 아닌 200 응답을 재시도한다 |
| `--backoff-ms=` | 10000 | 재시도 대기 시작값. 시도마다 2배 + 지터 |
| `--max-consecutive-blocks=` | 3 | 재시도를 소진한 요청이 연속 이만큼이면 실행을 멈춘다 |
| `--max-places=` | 0(무제한) | 이번 실행에서 메뉴를 수집할 식당 수 |
| `--discover-only` | - | 식당 목록(식당 CSV)만 만들고 메뉴는 수집하지 않음 |
| `--app-version=` | `6.6.0` | panel3 `appVersion` 헤더 |
| `--timeout-ms=` | 15000 | 요청 하나의 타임아웃 |

로컬 API가 400·401·403(키 오류, 앱에 카카오맵 API 권한 없음 등)을 주면 재시도해도 같으므로 바로 멈춘다. 검색 사각형이 재시도를 소진해 실패하면 건너뛰고 `failedRects`로 세며 경고를 남긴다. 그 사각형은 완료로 기록하지 않으므로 같은 명령을 다시 실행하면 그 부분만 검색한다. 실행 결과 요약의 `failedRects`가 0이 될 때까지 다시 실행한다.

`KAKAO_CLIENT_ID`는 앱(`src/main.ts`)과 같이 `.env` 값이 셸 환경변수보다 우선한다.

## 카페(CE7) 장소 목록

이슈 #32. 카페 브랜드(스타벅스·메가커피 등)의 카카오 장소 ID를 `restaurant_branch`에 매핑하려고 카페 장소 목록만 모은다(`docs/kakao-restaurant-branch-import.md`).

- `--category-group=CE7`이면 검색 API에 `category_group_code=CE7`을 보낸다. 사각형 분할·주소 필터·재시작은 음식점과 같다.
- 카페가 대상이므로 **카테고리 제외 필터를 쓰지 않는다.** 기본 제외 목록이 비고, `--exclude-categories`에 값을 주면 실행을 거부한다.
- **메뉴는 수집하지 않는다.** `--discover-only`가 자동으로 켜지고 panel3를 부르지 않는다. 결과는 `places.jsonl`·`restaurants.csv`(이름은 같지만 카페 목록)·`search-rects.txt`다.
- 출력 폴더마다 카테고리 그룹을 `category-group.txt`에 남긴다. 그룹이 다른 폴더(또는 기록이 없는데 진행 파일이 있는 #32 이전 음식점 폴더)에서 실행하면 거부한다. 끝난 사각형 기록이 그룹을 구분하지 않아, 같은 폴더를 쓰면 모든 사각형을 건너뛰고 음식점 목록에 카페가 섞이기 때문이다.
- 출력 폴더는 `kakao-map/cafe/<구>/`로 둔다. 음식점 import 경로 `kakao-map/*구/`와 겹치지 않는다. import는 `category-group.txt`가 `CE7`인 폴더를 카페 폴더로 보고 `places.jsonl`만 읽는다(`restaurants.csv`는 쓰지 않는다).

```sh
# 구 하나 (사각형·주소 필터는 음식점 수집에 쓴 districts.tsv와 같은 값)
npm run kakao-map:crawl-songpa -- --category-group=CE7 --out-dir=kakao-map/cafe/송파구 --district=송파구 --rect=127.05,37.455,127.2,37.555
```

## 수도권(경기·인천) 수집

이슈 #47. 범위는 경기도 전 시·군(31개)과 인천광역시 전 군·구(11개)다. 수집 방식·요청 간격은 서울과 같고, 지역 목록 파일과 실행 스크립트만 새로 만들었다.

### 지역 목록 `scripts/kakao-map/regions/capital-area.tsv`

한 줄이 지역 하나다: `폴더<TAB>검색 사각형;사각형…<TAB>주소 필터`. `#`으로 시작하는 줄은 설명이다.

| 칸 | 예 | 설명 |
|---|---|---|
| 폴더 | `경기/수원시`, `인천/제물포구` | `kakao-map/` 아래 출력 폴더. 서울 `kakao-map/<구>/`와 겹치지 않는다(인천 중구·동구 같은 이름 충돌도 없음) |
| 검색 사각형 | `127.01,37.27,127.03,37.29;…` | 지역 경계를 덮는 0.01도 단위 사각형들. 지역마다 3~104개, 모두 863개 |
| 주소 필터 | `경기 수원시`, `인천 제물포구` | 카카오 주소 앞부분. 카카오는 시·도를 `경기`·`인천`으로 줄여 쓴다 |

- **경기는 시·군 단위**다. 일반구가 있는 시(수원·성남·안양·안산·고양·용인·부천·화성)는 시 하나로 묶는다. 필터가 `경기 수원시`라 다른 시·도의 같은 이름 구와 섞이지 않는다.
- **인천은 2026-07-01 행정체제 개편 후 이름**(제물포구·영종구·서해구·검단구 + 미추홀·연수·남동·부평·계양구, 강화·옹진군)이다. 2026-11-27 시험 수집에서 옛 중구·동구·서구 지역 1,251곳의 주소가 모두 새 이름이었다.
- **사각형을 지역마다 여러 개로 나눈 이유**: 시·군은 모양이 불규칙해 bbox 하나로 검색하면 이웃 지역, 특히 서울을 다시 훑는다. 2026-10 경계로 계산하면 bbox 방식은 서울 면적 전체(약 4.5만 회 분량)와 수도권 면적만큼을 한 번 더 검색한다. 경계를 0.005도 격자로 래스터화하고 1칸(약 500m) 넓힌 뒤 0.01도 칸으로 맞춰 합치면 서울 겹침은 61%, 지역 간 겹침은 71% 줄어든다. 루트 사각형마다 첫 요청이 하나씩 늘지만(빈 바다·산은 1회) 전체로는 훨씬 적다.
- 검증(2026-11-27 시험 수집, `kakao-map/trial-47/`): 경기 과천시·인천 제물포구를 bbox 하나, 덮개 사각형(경계 확장 전), 최종 방식으로 각각 수집했다. 최종 방식이 앞의 방식들이 찾은 장소를 모두 찾았고(과천 541곳, 제물포구 1,535곳, 빠진 곳 0), 검색 기록 줄 수(실제 호출의 약 1/1.46)는 bbox의 45%·42%였다. 주소가 필터로 시작하지 않는 장소는 0곳이었다.
- 다시 만들려면 [vuski/admdongkor](https://github.com/vuski/admdongkor)의 `HangJeongDong_ver<날짜>.geojson`(통계청 행정동 경계)을 내려받아 실행한다. 파일 첫 줄에 쓴 경계 파일·격자 설정이 남는다. 행정구역이 바뀌면 다시 만들고, 이미 수집한 폴더의 지역 이름이 바뀌면 그 폴더는 새로 수집한다.

```sh
npm run --silent kakao-map:build-regions -- --geojson=<내려받은 경로>/HangJeongDong_ver20261001.geojson > scripts/kakao-map/regions/capital-area.tsv
```

### 실행 `scripts/kakao-map/run-regions.sh`

메인 체크아웃 루트에서 실행한다. 서울 때의 `kakao-map/run-discover.sh`·`run-menus.sh`(메인 체크아웃에만 있음)와 같은 방식이다.

```sh
# 1) 음식점 장소 목록(공식 로컬 API). 기본 10개 지역 동시
scripts/kakao-map/run-regions.sh discover scripts/kakao-map/regions/capital-area.tsv
# 2) 메뉴(panel3, 지역마다 동시 1·1~3초 간격). 기본 3개 지역 동시
scripts/kakao-map/run-regions.sh menus scripts/kakao-map/regions/capital-area.tsv

# 일부 지역만(폴더 정규식), 동시 실행 수 지정
ONLY='^인천/' scripts/kakao-map/run-regions.sh discover scripts/kakao-map/regions/capital-area.tsv 5
```

- 카페(CE7)는 #47 결정(2026-11-27)으로 수도권·서울 모두 보류해 실행 모드를 두지 않았다.
- 결과는 `kakao-map/<폴더>/`(예: `kakao-map/경기/수원시/`), 로그는 결과 폴더 옆 `<폴더>-<모드>.log`(예: `kakao-map/경기/수원시-discover.log`)다.
- 음식점 제외 단어는 서울과 같게 `kakao-map/exclude-categories.txt`(기본값 + `간식`)를 읽는다. 없으면 실행하지 않는다.
- worktree에서 실행하면 결과가 정리 때 지워지므로 거부한다. 시험할 때는 `KAKAO_MAP_DIR=<메인 체크아웃>/kakao-map/<시험 폴더>`를 주고, 그 폴더에 `exclude-categories.txt`를 복사한다.
- 지역마다 `npm run kakao-map:crawl-songpa`를 한 번씩 부르므로 재시작·실패 처리는 위와 같다. 끝에 지역별 `exit` 줄이 나온다. 크롤러가 0으로 끝나도 요약의 `failedRects`·`failedPlaces`가 0보다 크면 `exit 3`으로 표시한다. 0이 아닌 지역은 로그를 보고 같은 명령으로 다시 실행한다(끝난 지역은 요청 없이 바로 끝난다). 없는 장소(404·410)도 `failedPlaces`로 세지만 완료로 남으므로 다시 실행하면 0이 된다.
- `restaurant:branch-import` 입력 경로는 서울 `kakao-map/*구/`에 `kakao-map/경기/*/ kakao-map/인천/*/`를 더한다(`docs/kakao-restaurant-branch-import.md`).

## 결과 파일과 재시작

모두 `--out-dir` 안에 생긴다. CSV는 Excel에서 바로 열리도록 UTF-8(BOM) + CRLF다.

| 파일 | 내용 |
|---|---|
| `restaurants.csv` | `장소id, 식당명, 주소`. 제외 카테고리를 뺀 송파구 식당 전체(메뉴가 없는 식당 포함). 실행할 때마다 `places.jsonl`에서 새로 만든다 |
| `menus.csv` | `메뉴명, 사진URL, 식당id`. 메뉴 1개당 1행. 사진이 없으면 사진URL 칸이 비어 있다. `식당id`가 `restaurants.csv`의 `장소id`다 |
| `places.jsonl` | 발견한 송파구 식당(장소 ID·이름·주소·카테고리) |
| `search-rects.txt` | 끝난 검색 사각형(`leaf`: 결과를 받음, `split`: 4등분함, `truncated`: 최대 깊이에서 45곳만 받음) |
| `menu-done.txt` | 메뉴 수집이 끝난 장소 ID(메뉴 없음, 없는 장소 404·410 포함) |
| `failed.jsonl` | 메뉴 수집에 실패한 장소와 이유(기록용) |
| `category-group.txt` | 이 폴더의 카테고리 그룹(`FD6`/`CE7`). 다른 그룹으로 실행하면 거부한다 |

- 중단(Ctrl+C, 차단으로 멈춤 등)된 뒤 **같은 명령을 다시 실행**하면 이어서 한다. 끝난 사각형은 다시 검색하지 않고, `menu-done.txt`에 있거나 `menus.csv`에 행이 있는 식당은 건너뛴다. 재시도를 소진해 실패한 식당은 다음 실행에서 다시 시도한다.
- 식당 하나의 메뉴 행은 한 번의 쓰기로 덧붙인다. 중단으로 `menus.csv` 마지막 줄이 덜 쓰였으면 다음 실행 시작 때 그 줄을 지운다. `places.jsonl`의 깨진 줄은 무시한다.
- 처음부터 다시 하려면 출력 폴더를 지운다. 식당 목록만 새로 받으려면 `places.jsonl`과 `search-rects.txt`를 지운다.
- 값 안의 줄바꿈은 공백으로 바꾼다. 메뉴명이 빈 항목은 저장하지 않는다.

## 구현 구성

| 파일 | 역할 |
|---|---|
| `scripts/kakao-map/kakao-place-parser.ts` | 로컬 API 응답과 panel3 응답 파싱 |
| `scripts/kakao-map/kakao-place-crawler.ts` | 사각형 재귀 검색, 메뉴 수집, 결과·진행 상태 파일(`KakaoCrawlStore`) |
| `scripts/kakao-map/crawl-songpa-kakao.ts` | CLI(옵션 검증, 실제 `fetch`, git ignore 확인). 이름은 #28 때 그대로지만 `--rect`·`--district`·`--category-group`으로 다른 구·카페도 수집한다 |
| `scripts/kakao-map/region-cover.ts`, `build-region-list.ts` | 행정동 경계 → 지역 목록(래스터화, 덮개 사각형 합치기, 경기 시·군 / 인천 군·구 이름 규칙)과 그 CLI(#47) |
| `scripts/kakao-map/regions/capital-area.tsv` | 수도권 42개 지역 목록(생성물, 커밋함) |
| `scripts/kakao-map/run-regions.sh` | 지역 목록대로 지역별 병렬 실행(discover/menus) |
| `scripts/crawl-common/` | 네이버·카카오 공용: 지연·재시도·백오프·연속 차단 중단(`PoliteRequester`), CSV·진행 파일 유틸, CLI 옵션·git ignore 확인, 카페·술집 제외 단어 |

## 테스트

```sh
npm test -- --runInBand scripts/kakao-map
```

`scripts/kakao-map/__fixtures__/`의 JSON 픽스처와 Fake fetcher로 파싱, CSV 출력, 지역·카테고리 필터, 사각형 분할, 쪽 넘김, 재시작, 백오프, 키 오류 시 중단, 연속 차단 시 중단을 검증한다. 카페(CE7)는 `cafe-category-search.json`으로 그룹 코드·제외 필터 미적용·메뉴 미수집·폴더 그룹 충돌 거부를 검증한다. 여러 사각형 검색(`--rect` `;`)과 지역 목록 생성(`region-cover.spec.ts`: 경기 시 묶기·인천 이름·래스터화·사각형 합치기)도 검증한다. 네트워크를 쓰지 않는다. 픽스처는 실제 응답 구조(2026-10-28)를 축약하고 값만 가상으로 바꾼 것이다.
