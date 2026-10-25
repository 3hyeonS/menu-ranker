# AGENTS.md

이 저장소에서 작업하는 코딩 에이전트(Codex, Claude Code)용 안내. Claude Code는 `CLAUDE.md`의 `@AGENTS.md` import로 이 파일을 읽는다.

<!-- 공통 작업 방식(언어, 설명, 이슈→브랜치→PR, 세션 운영, 시크릿)은 ~/.codex/AGENTS.md에 있다. 여기는 이 프로젝트에만 해당하는 내용만 쓴다. 200줄을 넘기지 않는다. -->

## 프로젝트 상태

MELO 식단·영양 관리 앱의 NestJS 10 + TypeScript 백엔드. 모바일 앱(별도 저장소)이 클라이언트이고, 이 저장소 담당자는 백엔드만 맡는다.

- MySQL(TypeORM)이 주 저장소. PostgreSQL + pgvector는 메뉴 임베딩 검색용 선택적 사이드카다.
- LLM은 Gemini REST API를 axios로 직접 호출한다(SDK 미사용).
- 운영: GitHub Actions → EC2(pm2 `main`), DB는 RDS.

## 반드시 지켜야 할 규칙

- **프론트로 나가는 API 계약은 절대 바꾸지 않는다.** 경로, 요청 DTO 필드, 응답 키·형태·타입, 상태 코드, 에러 응답 형식, 오타가 있는 기존 경로·키(`/userAuth/defaltRatio`, `'recorded-dates'` 등)까지 그대로 둔다. 바꾸면 배포된 앱이 죽을 수 있다. 리팩토링은 내부 구조만 정리한다.
- **타임존 처리 코드는 수정하지 않는다.** 서버 로컬 시간과 KST(`Asia/Seoul`) 계산이 섞여 있지만 프론트가 현재 동작에 맞춰 보정하고 있다. 사용자가 별도로 요청할 때만 손댄다.
- 레거시 텍스트 추천 파이프라인(`ChatService.recommendWithLegacyPipeline`, `chat.service.ts`의 `recommend()` 첫 줄 주석으로 롤백)은 롤백용으로 보존한다. 그 경로에서 쓰는 헬퍼도 지우지 않는다.
- 브랜드 메뉴·영양정보 수집, 수정, 재출력 요청 전에는 매번 `docs/brand-nutrition-collection-rules.md`를 처음부터 끝까지 읽는다. 세션·터미널이 달라도 이 문서가 기준이며, 사용자가 수집 규칙을 바꾸면 이 문서를 갱신한다.
- 마이그레이션, 대량 import(`restaurant:import`는 restaurant 테이블을 전부 삭제 후 재삽입), 벡터 인덱싱, 벤치마크, 외부 API를 부르는 스크립트는 상태를 바꾸는 작업이다. 사용자의 명시적 허락 없이 실행하지 않는다.
- 엔티티·스키마를 바꾸면 TypeORM 마이그레이션 또는 pgvector 스키마 변경이 필요한지 알린다. 요청이 없으면 마이그레이션을 생성·실행하지 않는다.
- 운영 DB를 조회할 때는 읽기 전용 트랜잭션(`START TRANSACTION READ ONLY`)에서 SELECT만 실행한다.

## 명령

```sh
npm run start:dev                                   # 개발 서버 (watch)
npm run build                                       # 컴파일 검증
npm test -- --runInBand <경로-또는-패턴>             # 단위 테스트 하나 (예: src/chat/chat.service.spec.ts)
npm test -- --runInBand                             # 단위 테스트 전체 (CI와 동일)
npm run test:e2e                                    # e2e, 실제 MySQL 필요
npm run db:migration:show                           # 적용 상태 확인 (run/revert는 허락 후)
```

- `npm run lint`는 `--fix`로 파일을 수정한다. 포맷 변경이 괜찮을 때만 실행하고 diff를 확인한다.
- Prettier: 작은따옴표, trailing comma.
- 보고할 때는 실행한 검사와, 서비스·자격 증명이 없어 건너뛴 검사를 구분해 적는다.
- CI(`.github/workflows/deploy.yml`)는 `npm ci` → `npm test -- --runInBand` → `npm run build`만 돌린다. lint와 e2e는 CI에 없다.

## 코드 구조

`src/app.module.ts`가 feature 모듈을 묶는다. 각 모듈은 `controller` / `service` / `dto/{request-dto,response-dto}` / `entity` 구성을 따른다.

| 모듈 | 역할 |
|---|---|
| `src/chat` | Gemini 코칭: 일반 대화, 개인화 관리, 30일 패턴 분석, 식단 점수 피드백, 메뉴판·음식 사진·영양성분표 이미지 분석, 자연어 식사 기록, 대화 세션 요약·장기 기억. `chat.service.ts` 하나가 매우 크다(약 14,500줄) |
| `src/home` | 메뉴 검색, 식사 기록, 폴더·세트, 개인 메뉴, 사진·영양성분표 인식, 운동·체중·걸음·물 기록, 캘린더·30일 분석, CSV import |
| `src/auth` | Kakao·Apple·관리자 로그인, JWT access/refresh, 구독 코드, 온보딩, 기본 칼로리·탄단지 계산 |
| `src/restaurant` | 프랜차이즈 식당 검색, 필터별 메뉴 추천(`ChatService.recommendRestaurantMenuIds`, 실패 시 규칙 기반) |
| `src/profile`, `src/menstrual` | 프로필 수정(수정마다 `user_goal` 스냅샷 추가), 생리 기록 |
| `src/vector` | pgvector DataSource(지연 초기화), 임베딩, 메뉴 검색. `VectorModule`은 Home·Chat 모듈이 import한다 |
| `src/utils` | 메뉴명 정규화·별칭(`menu-name.util`), 음식 사진 후보 점수·우선순위, 자주 먹은 메뉴, 요청 취소 |
| `src/migrations` | MySQL 마이그레이션(`src/config/typeorm.datasource.ts`로 CLI 실행) |
| `scripts/` | import, 벤치마크, 부하 테스트, 운동 데이터 처리, `deploy-ec2.sh`, `vector-db/*.sql` |

### 여러 파일을 봐야 이해되는 흐름

- **응답 형식**: 컨트롤러마다 `@UseInterceptors(ResponseTransformInterceptor)`와 `@ResponseMsg('...')`로 `{message, statusCode, data}`를 만든다. 에러는 전역 `CustomHttpExceptionFilter`가 `{message, statusCode, error}`로 낸다. Swagger 문서는 `src/decorators/*-api-response-decorator.ts`로 붙인다.
- **인증**: `AuthGuard()`(passport 기본 전략 `jwt`)가 JWT의 `id`·`email`로 DB 사용자를 다시 읽는다. 그래서 role은 토큰이 아니라 DB 값이 적용된다. `RolesGuard`는 `USER` 요구 시 `TESTER`도 통과시킨다(`docs/tester-accounts.md`).
- **요청 취소 전파**: `LoggingInterceptor`가 `x-request-id`를 붙이고, 클라이언트 연결이 끊기면 `AsyncLocalStorage` 기반 `AbortSignal`(`utils/request-abort.util.ts`)을 abort한다. Gemini·S3 호출은 `getRequestAbortSignal()`을 넘기고 `throwIfRequestAborted()`로 확인한다. 취소 오류(`isRequestCancellationError`)는 fallback·로깅 없이 다시 던진다.
- **Gemini 호출**: `callGeminiText` / `callGeminiJson` / `callGeminiJsonWithImage`(chat), `callGeminiJsonWithImage`(home). 모델 목록은 `GEMINI_MODEL` → fallback env → `gemini-2.5-flash-lite` 순서이고, 404·429·5xx·타임아웃일 때만 다음 모델로 넘어간다. `responseSchema`는 쓰지 않고 호출부에서 결과를 직접 검증한다.
- **메뉴 데이터 모델**: `menu.user`가 null이면 공용 메뉴(`data_source=0`), 아니면 개인 메뉴(`data_source=1`). 삭제는 `is_deleted=1` soft delete. 공용 메뉴명에는 `(식약처_음식)`, `(식약처_가공)` 출처 접두어가 붙어 있고, 응답에서는 `stripPublicMenuSourcePrefix`로 지운다. 검색은 `search_name`·`canonical_name`(별칭 정규화) 컬럼을 함께 쓴다.
- **섭취 영양 계산**: 기록량은 `meal_menu.quantity`(g/ml)이고 영양값은 `menu.weight` 기준이다. 배수는 `getRecordedWeightMultiplier(quantity, weight)`이며 weight가 0이면 0이 된다.
- **음식 사진 인식**(home·chat에 비슷한 구현이 두 벌): Gemini 1차 인식 → 음식별 후보 수집(벡터, 로컬 점수, 브랜드, 제품명 정확 일치, 개인·자주 먹은 메뉴, 일반 선호 메뉴: 밥·달걀후라이·찐고구마·정제염 `PREFERRED_REFINED_SALT_MENU_ID=219056`) → 이미지와 후보로 Gemini rematch → 누락분 로컬 보충 → 개인 메뉴 우선 치환.
- **채팅 대화 기억**: `chat_history`가 원본이고, 3시간 공백으로 `chat_conversation_session`을 나눈다. 닫힌 세션은 백그라운드에서 Gemini로 요약하고, 7일 지난 요약은 `chat_user_memory.profileTraits`로 압축한다. "사용자 직접 진술:"로 시작하는 항목만 장기 기억에 남긴다.
- **벡터 검색**: `VECTOR_SEARCH_ENABLED`가 켜져 있고 `MenuVectorService`가 주입됐을 때만 사용한다(`@Optional()`). 꺼져 있으면 로컬 문자열 유사도로 대체한다. 검색 대상은 공용 메뉴만이다.

## 데이터·스키마 메모

- `authority`(USER/ADMIN/TESTER), `sign_with`(KAKAO/APPLE/LOCAL) 시드는 마이그레이션에 없다. 새 DB에는 수동으로 넣는다.
- 메뉴 import CSV는 23열 표준(`총중량` 포함, 수집 규칙 문서 2절)이다. 수집 데이터는 메인 체크아웃의 `brand-nutrition/`(git 미추적)에 있고, import·벤치마크 스크립트는 CSV 경로를 반드시 인자로 받는다.
- `docs/`의 영양 추정 프로토콜·벤치마크·프롬프트 데이터 경계 문서는 관련 스크립트(`scripts/*restaurant-nutrition*`)와 함께 갱신한다.
- `dist/`, 커버리지, `benchmark-results/`, 로컬 캐시는 사용자가 요청하고 이미 추적 중인 종류일 때만 커밋한다.

## 시크릿 파일

**이 프로젝트에서는 `~/.codex/AGENTS.md`의 env 파일 읽기 금지 규칙을 적용하지 않는다.** Codex와 Claude Code 모두 `.env` 계열 파일을 읽어도 된다(DB 접속 확인, 설정 점검 등). 단, 비밀번호·API 키·토큰 값을 대화·로그·커밋·PR에 그대로 출력하지 않고, 필요하면 앞 몇 글자만 마스킹해 보인다. 앱은 `src/main.ts`에서 `dotenv.config({ override: true })`로 `.env`를 읽으므로 `.env`가 프로세스 환경변수보다 우선한다. 환경변수를 추가하면 설정 로딩 코드와 함께 문서화한다.
