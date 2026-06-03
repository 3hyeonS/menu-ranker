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
