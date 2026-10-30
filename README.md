<p align="center">
  <a href="http://nestjs.com/" target="blank"><img src="https://nestjs.com/img/logo-small.svg" width="120" alt="Nest Logo" /></a>
</p>

[circleci-image]: https://img.shields.io/circleci/build/github/nestjs/nest/master?token=abc123def456
[circleci-url]: https://circleci.com/gh/nestjs/nest

  <p align="center">A progressive <a href="http://nodejs.org" target="_blank">Node.js</a> framework for building efficient and scalable server-side applications.</p>
    <p align="center">
<a href="https://www.npmjs.com/~nestjscore" target="_blank"><img src="https://img.shields.io/npm/v/@nestjs/core.svg" alt="NPM Version" /></a>
<a href="https://www.npmjs.com/~nestjscore" target="_blank"><img src="https://img.shields.io/npm/l/@nestjs/core.svg" alt="Package License" /></a>
<a href="https://www.npmjs.com/~nestjscore" target="_blank"><img src="https://img.shields.io/npm/dm/@nestjs/common.svg" alt="NPM Downloads" /></a>
<a href="https://circleci.com/gh/nestjs/nest" target="_blank"><img src="https://img.shields.io/circleci/build/github/nestjs/nest/master" alt="CircleCI" /></a>
<a href="https://coveralls.io/github/nestjs/nest?branch=master" target="_blank"><img src="https://coveralls.io/repos/github/nestjs/nest/badge.svg?branch=master#9" alt="Coverage" /></a>
<a href="https://discord.gg/G7Qnnhy" target="_blank"><img src="https://img.shields.io/badge/discord-online-brightgreen.svg" alt="Discord"/></a>
<a href="https://opencollective.com/nest#backer" target="_blank"><img src="https://opencollective.com/nest/backers/badge.svg" alt="Backers on Open Collective" /></a>
<a href="https://opencollective.com/nest#sponsor" target="_blank"><img src="https://opencollective.com/nest/sponsors/badge.svg" alt="Sponsors on Open Collective" /></a>
  <a href="https://paypal.me/kamilmysliwiec" target="_blank"><img src="https://img.shields.io/badge/Donate-PayPal-ff3f59.svg" alt="Donate us"/></a>
    <a href="https://opencollective.com/nest#sponsor"  target="_blank"><img src="https://img.shields.io/badge/Support%20us-Open%20Collective-41B883.svg" alt="Support us"></a>
  <a href="https://twitter.com/nestframework" target="_blank"><img src="https://img.shields.io/twitter/follow/nestframework.svg?style=social&label=Follow" alt="Follow us on Twitter"></a>
</p>
  <!--[![Backers on Open Collective](https://opencollective.com/nest/backers/badge.svg)](https://opencollective.com/nest#backer)
  [![Sponsors on Open Collective](https://opencollective.com/nest/sponsors/badge.svg)](https://opencollective.com/nest#sponsor)-->

## Description

[Nest](https://github.com/nestjs/nest) framework TypeScript starter repository.

## Project setup

```bash
$ npm install
```

## Vector DB setup

Menu search and multimodal candidate retrieval can use a sidecar PostgreSQL
database with pgvector. The main application database remains MySQL.

Install PostgreSQL and pgvector locally, then create the vector database:

```bash
$ sudo apt update
$ sudo apt install postgresql postgresql-contrib
$ apt search pgvector
```

Install the pgvector package that matches your PostgreSQL version, for example:

```bash
$ sudo apt install postgresql-16-pgvector
```

Create the user and database:

```bash
$ sudo -u postgres psql
```

```sql
CREATE USER vector_user WITH PASSWORD 'vector_password';
CREATE DATABASE melo_vector OWNER vector_user;
```

Enable pgvector:

```bash
$ sudo -u postgres psql -d melo_vector
```

```sql
CREATE EXTENSION IF NOT EXISTS vector;
```

Create the vector search schema:

```bash
$ PGPASSWORD=vector_password psql \
  -h localhost \
  -p 5432 \
  -U vector_user \
  -d melo_vector \
  -f scripts/vector-db/001_create_menu_vector_index.sql
```

The first schema uses `vector(768)`, which matches the planned text embedding
dimension. If the embedding model changes, update the vector dimensions before
indexing menus.

Connection settings are read from `.env`. If PostgreSQL uses the default local
port, use `5432`:

```env
VECTOR_DB_HOST=localhost
VECTOR_DB_PORT=5432
VECTOR_DB_USERNAME=vector_user
VECTOR_DB_PASSWORD=vector_password
VECTOR_DB_NAME=melo_vector
```

Embedding settings:

```env
GEMINI_EMBEDDING_MODEL=gemini-embedding-001
VECTOR_EMBEDDING_DIMENSION=768
```

Install the PostgreSQL driver before importing `VectorModule` into runtime
modules:

```bash
$ npm install pg
```

Index MySQL menu rows into pgvector:

```bash
$ npm run vector:index-menus
```

Optional batch controls:

```env
VECTOR_INDEX_BATCH_SIZE=100
VECTOR_INDEX_START_AFTER_ID=0
VECTOR_INDEX_STOP_AFTER_ID=1000
VECTOR_INDEX_SKIP_EXISTING=true
VECTOR_INDEX_RETRY_COUNT=2
VECTOR_INDEX_RETRY_DELAY_MS=1000
VECTOR_INDEX_THROTTLE_MS=0
```

For the first full indexing run, increase the stop id gradually:

```bash
$ VECTOR_INDEX_BATCH_SIZE=50 \
  VECTOR_INDEX_START_AFTER_ID=0 \
  VECTOR_INDEX_STOP_AFTER_ID=1000 \
  VECTOR_INDEX_SKIP_EXISTING=true \
  npm run vector:index-menus
```

If the process stops midway, restart with the last printed `cursor` as
`VECTOR_INDEX_START_AFTER_ID`. With `VECTOR_INDEX_SKIP_EXISTING=true`, already
indexed menu ids are skipped before calling the embedding API.

Test vector candidate retrieval:

```bash
$ VECTOR_TEST_QUERY="버거킹 왔는데 가볍게 먹을만한 메뉴 추천해줘" \
  VECTOR_TEST_LIMIT=10 \
  npm run vector:test-search
```

You can use the same command with food-image description text:

```bash
$ VECTOR_TEST_QUERY="바삭한 튀김옷을 입은 닭고기 패티와 양상추, 소스가 들어간 햄버거" \
  VECTOR_TEST_LIMIT=10 \
  npm run vector:test-search
```

Optional filters:

```env
VECTOR_TEST_USER_ID=1
VECTOR_TEST_BRAND=버거킹
VECTOR_TEST_CATEGORY=버거
VECTOR_TEST_MAX_CALORIES=500
VECTOR_TEST_MIN_PROTEIN=20
```

검색 튜닝(런타임): 메뉴 벡터 인덱스는 HNSW이므로 탐색 폭은 `hnsw.ef_search`로
정한다. HNSW는 최대 `ef_search`개까지만 돌려주므로, 검색마다
`max(VECTOR_HNSW_EF_SEARCH, limit × VECTOR_SEARCH_OVERFETCH_MULTIPLIER)`를
1~1000으로 제한해 쓴다(`VECTOR_HNSW_EF_SEARCH` 기본 40 = pgvector 기본값).
`VECTOR_IVFFLAT_PROBES`는 더 이상 읽지 않는다.

```env
VECTOR_HNSW_EF_SEARCH=40
```

## Gemini endpoint override

`GEMINI_BASE_URL`(모든 Gemini 호출)과 `GEMINI_IMAGE_BASE_URL`(이미지 호출, 없으면
`GEMINI_BASE_URL` 사용)은 선택값이다. 모델 fallback이 동작하려면 URL에 모델이 들어가야 한다.

- `https://proxy.example.com/v1beta/models/{model}:generateContent`: 시도마다 `{model}`을 모델명으로 치환한다.
- `.../models/<모델>:generateContent`로 끝나는 전체 URL: 모델 부분만 시도하는 모델로 바꾼다.
- 그 밖의 값: 예전처럼 그대로 쓴다(모든 fallback 시도가 같은 URL을 부른다).

Gemini generateContent 호출(모델 fallback·요청 취소 포함)은 `src/gemini`의 `GeminiClient`
(구현 `HttpGeminiClient`)가 맡는다. 테스트에서는 `FakeGeminiClient`로 응답·오류를 주입한다.

## Food image menu cache

음식 사진 인식(`POST /home/recognizeFoodImage`, chat 음식 사진 피드백)과 벡터 검색이 꺼졌을 때의
chat 일반 메뉴 매칭은 후보 계산에 공용 메뉴 전체 목록을 쓴다(`src/food-image`의 `FoodImageMenuCatalog`).
공용 메뉴(`menu.user`가 null)는 프로세스 메모리에 하나만 캐시해 home·chat이 같이 쓰고, 개인 메뉴는 요청마다 DB에서 읽는다.

```env
FOOD_IMAGE_PUBLIC_MENU_CACHE_TTL_MS=300000  # 기본 5분, 0이면 캐시하지 않음
```

`/home/importMenusCsv`로 메뉴를 넣으면 캐시를 바로 비운다. 스크립트나 SQL로 DB를 직접 바꾸면
최대 TTL 동안 이전 목록이 쓰이므로, 즉시 반영해야 하면 서버(pm2)를 재시작한다.

## Brand menu nutrition data

브랜드 메뉴·영양정보 수집 데이터는 git에 커밋하지 않고 메인 체크아웃의
`brand-nutrition/`(`.gitignore` 대상)에 둔다. 폴더 구성·열 형식·수집 규칙은
`docs/brand-nutrition-collection-rules.md`를 따른다.

```bash
# CSV 형식만 검증 (DB 변경 없음)
$ npm run restaurant:import -- brand-nutrition/all-menus.csv --validate-only

# restaurant 테이블을 전부 지우고 다시 넣는다. 명시적으로 결정한 뒤에만 실행한다.
$ npm run restaurant:import -- brand-nutrition/all-menus.csv
```

import·벤치마크·부하 테스트 스크립트에는 기본 CSV 경로가 없다. import는 첫 번째
인자로, 나머지는 `--csv=<경로>`로 반드시 지정한다.

## Naver map menu crawl (internal analysis)

네이버 지도에서 송파구 식당 메뉴명·가격·사진 URL을 수집하는 내부 분석용 스크립트다.
네이버에 실제로 요청하므로 허락받은 뒤에만 실행하고, 결과는 메인 체크아웃의
`naver-map/`(`.gitignore` 대상)에 둔다. 옵션·재시작 방법은 `docs/naver-map-menu-crawler.md`.

```bash
$ npm run naver-map:crawl-songpa -- --out=naver-map/songpa-menus.csv
```

## Kakao map restaurant menu crawl

카카오 기준 송파구 식당 목록(공식 로컬 API)과 메뉴명·사진 URL(카카오맵 비공식 API)을
식당 CSV(`restaurants.csv`)·메뉴 CSV(`menus.csv`)로 수집한다. `KAKAO_CLIENT_ID`가 필요하고,
카카오에 실제로 요청하므로 허락받은 뒤에만 실행한다. 결과는 메인 체크아웃의
`kakao-map/`(`.gitignore` 대상)에 둔다. 옵션·재시작 방법은 `docs/kakao-map-menu-crawler.md`.

```bash
$ npm run kakao-map:crawl-songpa -- --out-dir=kakao-map/songpa
```

## Compile and run the project

```bash
# development
$ npm run start

# watch mode
$ npm run start:dev

# production mode
$ npm run start:prod
```

## Run tests

```bash
# unit tests
$ npm run test

# e2e tests
$ npm run test:e2e

# test coverage
$ npm run test:cov
```

## Deployment

When you're ready to deploy your NestJS application to production, there are some key steps you can take to ensure it runs as efficiently as possible. Check out the [deployment documentation](https://docs.nestjs.com/deployment) for more information.

If you are looking for a cloud-based platform to deploy your NestJS application, check out [Mau](https://mau.nestjs.com), our official platform for deploying NestJS applications on AWS. Mau makes deployment straightforward and fast, requiring just a few simple steps:

```bash
$ npm install -g mau
$ mau deploy
```

With Mau, you can deploy your application in just a few clicks, allowing you to focus on building features rather than managing infrastructure.

## Resources

Check out a few resources that may come in handy when working with NestJS:

- Visit the [NestJS Documentation](https://docs.nestjs.com) to learn more about the framework.
- For questions and support, please visit our [Discord channel](https://discord.gg/G7Qnnhy).
- To dive deeper and get more hands-on experience, check out our official video [courses](https://courses.nestjs.com/).
- Deploy your application to AWS with the help of [NestJS Mau](https://mau.nestjs.com) in just a few clicks.
- Visualize your application graph and interact with the NestJS application in real-time using [NestJS Devtools](https://devtools.nestjs.com).
- Need help with your project (part-time to full-time)? Check out our official [enterprise support](https://enterprise.nestjs.com).
- To stay in the loop and get updates, follow us on [X](https://x.com/nestframework) and [LinkedIn](https://linkedin.com/company/nestjs).
- Looking for a job, or have a job to offer? Check out our official [Jobs board](https://jobs.nestjs.com).

## Support

Nest is an MIT-licensed open source project. It can grow thanks to the sponsors and support by the amazing backers. If you'd like to join them, please [read more here](https://docs.nestjs.com/support).

## Stay in touch

- Author - [Kamil Myśliwiec](https://twitter.com/kammysliwiec)
- Website - [https://nestjs.com](https://nestjs.com/)
- Twitter - [@nestframework](https://twitter.com/nestframework)

## License

Nest is [MIT licensed](https://github.com/nestjs/nest/blob/master/LICENSE).
