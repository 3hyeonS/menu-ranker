# 카카오 기준 송파구 식당·메뉴 수집

이슈 #28. 카카오 기준으로 서울 송파구 식당 목록과 메뉴명·메뉴 사진 URL을 모아 **식당 CSV**와 **메뉴 CSV** 두 개로 저장한다. 프론트 지도가 카카오 로컬 REST API를 쓰므로, 장소 ID(`장소id`·`식당id`)는 프론트가 받는 카카오 장소 `id`와 같은 값이다.

- 지금은 CSV만 만든다. 운영 DB 적재·API 연동은 아직 하지 않는다(이슈 #28 `## 결정` 댓글).
- 메뉴는 카카오맵 **비공식** 내부 API를 크롤링하므로 약관 위험이 네이버(#26)와 같다. 실제 카카오 호출은 사용자 허락을 받은 뒤에만 한다.
- 사진은 URL만 저장하고 이미지 파일은 내려받지 않는다. 사진은 카카오에 있는 것만 쓴다(네이버로 보충하지 않음).

## 동작

1. **식당 목록**: 공식 로컬 API `GET https://dapi.kakao.com/v2/local/search/category.json`(`category_group_code=FD6` 음식점)을 `rect` 사각형으로 검색한다. 검색 한 번에 최대 45곳(15곳 × 3쪽)만 받을 수 있어서, `total_count`가 45를 넘으면 사각형을 4등분해 재귀로 검색한다. 주소(도로명, 없으면 지번)에 `송파구`가 있는 식당만 남긴다. 이전 분석(2026-10-28)에서 송파구 전체가 약 2,100번 호출, 송파구 식당 약 6,100곳이었다.
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
| `--rect=` | `127.05,37.455,127.2,37.555` | 검색 사각형 `x1,y1,x2,y2`(경도·위도). 기본값은 송파구 전체를 덮는다 |
| `--district=` | `송파구` | 주소 필터. 빈 값이면 거르지 않음 |
| `--max-depth=` | 12 | 사각형 4등분 최대 깊이(0~14). 이 깊이에서도 45곳을 넘으면 45곳만 받고 `truncatedRects`로 센다(재시작해도 유지). 좌표를 소수 6자리로 보내므로 14보다 깊게 나누면 사각형이 겹친다 |
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

- 중단(Ctrl+C, 차단으로 멈춤 등)된 뒤 **같은 명령을 다시 실행**하면 이어서 한다. 끝난 사각형은 다시 검색하지 않고, `menu-done.txt`에 있거나 `menus.csv`에 행이 있는 식당은 건너뛴다. 재시도를 소진해 실패한 식당은 다음 실행에서 다시 시도한다.
- 식당 하나의 메뉴 행은 한 번의 쓰기로 덧붙인다. 중단으로 `menus.csv` 마지막 줄이 덜 쓰였으면 다음 실행 시작 때 그 줄을 지운다. `places.jsonl`의 깨진 줄은 무시한다.
- 처음부터 다시 하려면 출력 폴더를 지운다. 식당 목록만 새로 받으려면 `places.jsonl`과 `search-rects.txt`를 지운다.
- 값 안의 줄바꿈은 공백으로 바꾼다. 메뉴명이 빈 항목은 저장하지 않는다.

## 구현 구성

| 파일 | 역할 |
|---|---|
| `scripts/kakao-map/kakao-place-parser.ts` | 로컬 API 응답과 panel3 응답 파싱 |
| `scripts/kakao-map/kakao-place-crawler.ts` | 사각형 재귀 검색, 메뉴 수집, 결과·진행 상태 파일(`KakaoCrawlStore`) |
| `scripts/kakao-map/crawl-songpa-kakao.ts` | CLI(옵션 검증, 실제 `fetch`, git ignore 확인) |
| `scripts/crawl-common/` | 네이버·카카오 공용: 지연·재시도·백오프·연속 차단 중단(`PoliteRequester`), CSV·진행 파일 유틸, CLI 옵션·git ignore 확인, 카페·술집 제외 단어 |

## 테스트

```sh
npm test -- --runInBand scripts/kakao-map
```

`scripts/kakao-map/__fixtures__/`의 JSON 픽스처와 Fake fetcher로 파싱, CSV 출력, 지역·카테고리 필터, 사각형 분할, 쪽 넘김, 재시작, 백오프, 키 오류 시 중단, 연속 차단 시 중단을 검증한다. 네트워크를 쓰지 않는다. 픽스처는 실제 응답 구조(2026-10-28)를 축약하고 값만 가상으로 바꾼 것이다.
