import {
  ForbiddenException,
  INestApplication,
  ValidationPipe,
} from '@nestjs/common';
import { JwtModule, JwtService } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { Test } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import * as request from 'supertest';
import { CustomHttpExceptionFilter } from '../interceptors/custom-httpException-filter';
import { LoggingInterceptor } from '../interceptors/logging-interceptor';
import { JwtStrategy } from '../auth/jwt.startegy';
import { AuthService } from '../auth/auth.service';
import { SubscriptionService } from '../auth/subscription.service';
import { CommonAuthController } from '../auth/controllers/commonAuth.controller';
import { UserAuthController } from '../auth/controllers/userAuth.controller';
import { UserEntity } from '../auth/entity/user/user.entity';
import { UserInfoEntity } from '../auth/entity/user/userInfo.entity';
import { HomeController } from '../home/home.controller';
import { HomeService } from '../home/home.service';
import { MenuEntity } from '../home/entity/menu.entity';
import { SearchResponseDto } from '../home/dto/response-dto/search-response-dto';
import { MenuResponseDto } from '../home/dto/response-dto/menu-response-dto';
import { MenuSimpleResponseDto } from '../home/dto/response-dto/menu-simple-response-dto';
import { MealRecordResponseDto } from '../home/dto/response-dto/meal-record-response-dto';
import {
  MealResponseDto,
  MealSetResponseDto,
} from '../home/dto/response-dto/meal-response-dto';
import { MealRecordedDatesResponseDto } from '../home/dto/response-dto/meal-recorded-dates-response-dto';
import { WeightStepsResponseDto } from '../home/dto/response-dto/weight-steps-response-dto';
import { WaterIntakeResponseDto } from '../home/dto/response-dto/water-intake-response-dto';
import { ProfileController } from '../profile/profile.controller';
import { ProfileService } from '../profile/profile.service';
import { ProfileResponseDto } from '../profile/dto/response-dto/profile-response-dto';
import { ChatController } from '../chat/chat.controller';
import { ChatService } from '../chat/chat.service';
import { ChatHistoryEntity } from '../chat/entity/chat-history.entity';
import { ChatHistoryResponseDto } from '../chat/dto/response-dto/chat-history-response-dto';
import { ChatHistoryItemResponseDto } from '../chat/dto/response-dto/chat-history-item-response-dto';
import { MenstrualController } from '../menstrual/menstrual.controller';
import { MenstrualService } from '../menstrual/menstrual.service';
import { MenstrualRecordsResponseDto } from '../menstrual/dto/response-dto/menstrual-records-response.dto';
import { RestaurantController } from '../restaurant/restaurant.controller';
import { RestaurantService } from '../restaurant/restaurant.service';
import { RestaurantDetailResponseDto } from '../restaurant/dto/response-dto/restaurant-detail-response-dto';
import { RestaurantBrandsResponseDto } from '../restaurant/dto/response-dto/restaurant-brands-response-dto';

// 주요 엔드포인트의 HTTP 응답 형태 스냅샷. 서비스는 mock이고, mock은 실제 응답 DTO 생성자로
// 만든 값을 돌려준다. 그래서 컨트롤러·DTO 매핑·ResponseTransformInterceptor 래퍼·상태 코드·
// 전역 예외 필터 형식이 바뀌면 스냅샷이 깨진다. 값이 아니라 키와 타입(shape)만 비교한다.

/** 값 대신 타입 구조만 남긴다. 배열은 첫 원소의 구조로 대표한다. */
function shapeOf(value: unknown): unknown {
  if (value === null) return 'null';
  if (Array.isArray(value)) return value.length ? [shapeOf(value[0])] : [];
  if (typeof value === 'object') {
    return Object.fromEntries(
      Object.keys(value as object)
        .sort()
        .map((key) => [key, shapeOf((value as any)[key])]),
    );
  }
  return typeof value;
}

/** 성공 응답: 래퍼는 값까지, data는 shape만. */
function describeSuccess(res: request.Response) {
  const { message, statusCode, data, ...rest } = res.body;
  return {
    httpStatus: res.status,
    message,
    statusCode,
    extraKeys: Object.keys(rest),
    data: shapeOf(data),
  };
}

/** 에러 응답은 메시지가 계약의 일부라 body 전체를 그대로 비교한다. */
function describeError(res: request.Response) {
  return { httpStatus: res.status, body: res.body };
}

const user = Object.assign(new UserEntity(), {
  id: 1,
  email: 'user@example.com',
  nickname: '닉네임',
  name: '이름',
  authority: { role: 'USER' },
  signWith: { platform: 'KAKAO' },
}) as UserEntity;

const userInfo = Object.assign(new UserInfoEntity(), {
  id: 1,
  gender: 0,
  birthYear: 1995,
  height: 170.5,
  weight: 65.2,
  activity: 1,
  goal: 0,
  target_weight: 60,
  target_calories: 1800,
  target_ratio: [50, 30, 20],
  diet_management_status: [0, 1],
  persona_type: 1,
  eating_out_freq_weekly: 3,
  job_type: 2,
  lunch_location: 1,
}) as UserInfoEntity;

// 모든 영양 필드를 채워 두면 MenuSimpleResponseDto의 대체 필드(carbs·fat이 0일 때만 노출)는 빠진다.
const menu = Object.assign(new MenuEntity(), {
  id: 10,
  data_source: 0,
  is_deleted: 0,
  name: '(식약처_음식)김치찌개',
  brand: '브랜드',
  category: '찌개류',
  unit: 0,
  weight: 300,
  unit_quantity: '인분',
  calories: 250,
  carbs: 12,
  sugars: 3,
  sugar_alchol: 0,
  dietary_fiber: 2,
  protein: 15,
  fat: 10,
  sat_fat: 3,
  trans_fat: 0,
  un_sat_fat: 5,
  sodium: 1200,
  caffeine: 0,
  potassium: 400,
  cholesterol: 30,
  alcohol: 0,
}) as MenuEntity;

const createdAt = new Date('2026-05-27T12:34:56.789Z');

const authService = {
  signInWithKakao: jest.fn(),
  signInWithApple: jest.fn(),
  refreshAccessToken: jest.fn(),
  revokeRefreshToken: jest.fn(),
  deleteUser: jest.fn(),
  hasUserInfo: jest.fn(),
};
const homeService = {
  search: jest.fn(),
  menuDetail: jest.fn(),
  getMealRecord: jest.fn(),
  getMealRecordedDates: jest.fn(),
  registerMeal: jest.fn(),
  weightSteps: jest.fn(),
  getWaterIntake: jest.fn(),
};
const profileService = { getProfile: jest.fn() };
const chatService = { getChatHistory: jest.fn() };
const menstrualService = { getRecords: jest.fn() };
const restaurantService = {
  getRestaurantDetail: jest.fn(),
  findRegisteredBrands: jest.fn(),
};
// jest.resetAllMocks()의 영향을 받지 않도록 jest.fn이 아닌 일반 함수로 둔다.
const usersRepository = {
  findOne: async ({ where }) =>
    where.id === user.id && where.email === user.email ? user : null,
};

describe('API response contract', () => {
  let app: INestApplication;
  let jwtService: JwtService;
  let accessToken: string;
  let consoleLogSpy: jest.SpyInstance;

  beforeAll(async () => {
    // LoggingInterceptor의 요청 로그를 숨긴다.
    consoleLogSpy = jest.spyOn(console, 'log').mockImplementation();

    const moduleRef = await Test.createTestingModule({
      imports: [PassportModule.register({ defaultStrategy: 'jwt' }), JwtModule],
      controllers: [
        CommonAuthController,
        UserAuthController,
        HomeController,
        ProfileController,
        ChatController,
        MenstrualController,
        RestaurantController,
      ],
      providers: [
        JwtStrategy,
        { provide: getRepositoryToken(UserEntity), useValue: usersRepository },
        { provide: AuthService, useValue: authService },
        { provide: SubscriptionService, useValue: {} },
        { provide: HomeService, useValue: homeService },
        { provide: ProfileService, useValue: profileService },
        { provide: ChatService, useValue: chatService },
        { provide: MenstrualService, useValue: menstrualService },
        { provide: RestaurantService, useValue: restaurantService },
      ],
    }).compile();

    app = moduleRef.createNestApplication();
    // src/main.ts bootstrap()의 전역 설정과 같아야 한다. main.ts를 바꾸면 여기도 맞춘다.
    app.useGlobalInterceptors(new LoggingInterceptor());
    app.useGlobalFilters(new CustomHttpExceptionFilter());
    app.useGlobalPipes(
      new ValidationPipe({
        transform: true,
        whitelist: true,
        forbidNonWhitelisted: true,
      }),
    );
    app.enableCors({ exposedHeaders: ['x-request-id'] });
    await app.init();

    jwtService = moduleRef.get(JwtService);
    // JwtStrategy와 같은 비밀키로 서명한다(.env의 ACCESS_SECRET 또는 기본값).
    accessToken = jwtService.sign(
      { id: user.id, email: user.email, role: 'USER' },
      { secret: process.env.ACCESS_SECRET || 'default-secret' },
    );
  });

  afterAll(async () => {
    await app.close();
    consoleLogSpy.mockRestore();
  });

  beforeEach(() => {
    jest.resetAllMocks();
  });

  const post = (path: string) =>
    request(app.getHttpServer())
      .post(path)
      .set('Authorization', `Bearer ${accessToken}`);
  const get = (path: string) =>
    request(app.getHttpServer())
      .get(path)
      .set('Authorization', `Bearer ${accessToken}`);

  describe('success responses', () => {
    it('POST /userAuth/kakao/callback', async () => {
      authService.signInWithKakao.mockResolvedValue({
        accessToken: 'access',
        refreshToken: 'refresh',
        user,
        isSubscribed: true,
      });
      const res = await request(app.getHttpServer()).post(
        '/userAuth/kakao/callback?code=abc',
      );
      expect(describeSuccess(res)).toMatchSnapshot();
    });

    it('POST /userAuth/apple/callback', async () => {
      authService.signInWithApple.mockResolvedValue({
        accessToken: 'access',
        refreshToken: 'refresh',
        user: { ...user, signWith: { platform: 'APPLE' } },
        isSubscribed: false,
      });
      const res = await request(app.getHttpServer())
        .post('/userAuth/apple/callback')
        .send({ id_token: 'token' });
      expect(describeSuccess(res)).toMatchSnapshot();
    });

    it('POST /userAuth/hasUserInfo', async () => {
      authService.hasUserInfo.mockResolvedValue(true);
      const res = await post('/userAuth/hasUserInfo');
      expect(describeSuccess(res)).toMatchSnapshot();
    });

    it('POST /commonAuth/refresh', async () => {
      authService.refreshAccessToken.mockResolvedValue({
        accessToken: 'access',
        refreshToken: 'refresh',
        member: user,
      });
      const res = await request(app.getHttpServer())
        .post('/commonAuth/refresh')
        .send({
          refreshToken: jwtService.sign({ email: user.email }, { secret: 'x' }),
        });
      expect(describeSuccess(res)).toMatchSnapshot();
    });

    it('POST /commonAuth/signout returns data null', async () => {
      authService.revokeRefreshToken.mockResolvedValue(undefined);
      const res = await post('/commonAuth/signout').send({
        refreshToken: jwtService.sign({ email: user.email }, { secret: 'x' }),
      });
      expect(describeSuccess(res)).toMatchSnapshot();
    });

    it('POST /commonAuth/delete returns data null', async () => {
      authService.deleteUser.mockResolvedValue(undefined);
      const res = await post('/commonAuth/delete');
      expect(describeSuccess(res)).toMatchSnapshot();
    });

    it('POST /home/search', async () => {
      homeService.search.mockResolvedValue(
        new SearchResponseDto(true, [new MenuSimpleResponseDto(menu)], 2),
      );
      const res = await post('/home/search').send({ input: '김치', limit: 20 });
      expect(describeSuccess(res)).toMatchSnapshot();
    });

    it('POST /home/menuDetail', async () => {
      homeService.menuDetail.mockResolvedValue(new MenuResponseDto(menu));
      const res = await post('/home/menuDetail').send({ id: 10 });
      expect(describeSuccess(res)).toMatchSnapshot();
    });

    it('POST /home/getMealRecord', async () => {
      homeService.getMealRecord.mockResolvedValue(
        new MealRecordResponseDto([
          new MealResponseDto(
            1,
            '12:30',
            'https://example.com/meal.jpg',
            createdAt,
            createdAt,
            [new MenuSimpleResponseDto(menu)],
            [1],
            [0],
            [
              new MealSetResponseDto(
                3,
                '세트',
                [new MenuSimpleResponseDto(menu)],
                250,
              ),
            ],
          ),
        ]),
      );
      const res = await post('/home/getMealRecord').send({
        date: '2026-05-27',
      });
      expect(describeSuccess(res)).toMatchSnapshot();
    });

    it('POST /home/getMealRecordedDates', async () => {
      homeService.getMealRecordedDates.mockResolvedValue(
        new MealRecordedDatesResponseDto(['2026-05-27']),
      );
      const res = await post('/home/getMealRecordedDates').send({
        startDate: '2026-05-01',
        endDate: '2026-05-31',
      });
      expect(describeSuccess(res)).toMatchSnapshot();
    });

    it('POST /home/weightSteps', async () => {
      homeService.weightSteps.mockResolvedValue(
        new WeightStepsResponseDto(65.2, 8000),
      );
      const res = await post('/home/weightSteps').send({ date: '2026-05-27' });
      expect(describeSuccess(res)).toMatchSnapshot();
    });

    it('POST /home/water', async () => {
      homeService.getWaterIntake.mockResolvedValue(
        new WaterIntakeResponseDto(250, 1000),
      );
      const res = await post('/home/water').send({ date: '2026-05-27' });
      expect(describeSuccess(res)).toMatchSnapshot();
    });

    it('GET /profile/getProfile', async () => {
      profileService.getProfile.mockResolvedValue(
        new ProfileResponseDto(user, userInfo, false),
      );
      const res = await get('/profile/getProfile');
      expect(describeSuccess(res)).toMatchSnapshot();
    });

    it('GET /chat/history', async () => {
      const history = Object.assign(new ChatHistoryEntity(), {
        id: 5,
        input_text: '점심 추천해줘',
        createdAt,
        response_payload: {
          image_url: 'https://example.com/board.jpg',
          menus: [{ id: 10, name: '(식약처_음식)김치찌개' }],
        },
        meal_record: {
          time: 1,
          menu_ids: [10],
          menu_quantities: [1],
          menu_input_modes: [0],
        },
      }) as ChatHistoryEntity;
      chatService.getChatHistory.mockResolvedValue(
        new ChatHistoryResponseDto([new ChatHistoryItemResponseDto(history)]),
      );
      const res = await get('/chat/history');
      expect(describeSuccess(res)).toMatchSnapshot();
    });

    it('POST /menstrual/records', async () => {
      menstrualService.getRecords.mockResolvedValue(
        new MenstrualRecordsResponseDto(
          [{ start_date: '2026-05-01', end_date: '2026-05-05' }],
          true,
        ),
      );
      const res = await post('/menstrual/records').send({
        from_date: '2026-05-01',
        to_date: '2026-05-31',
      });
      expect(describeSuccess(res)).toMatchSnapshot();
    });

    it('POST /restaurant/detail', async () => {
      const detail: RestaurantDetailResponseDto = {
        restaurant_name: '피자스쿨',
        menu_list: [
          {
            menu_id: 20123,
            menu_name: '고구마 피자',
            menu_category: '피자',
            calories: 258,
            sugars: 6.2,
            protein: 12.3,
            sat_fat: 3.1,
            unit: 0,
            weight: 100,
            unit_quantity: '조각',
          },
        ],
      };
      restaurantService.getRestaurantDetail.mockResolvedValue(detail);
      const res = await post('/restaurant/detail').send({
        restaurant_id: 1204,
        filter: '균형',
      });
      expect(describeSuccess(res)).toMatchSnapshot();
    });

    it('POST /restaurant/brands', async () => {
      const brands: RestaurantBrandsResponseDto = {
        restaurants: [
          { place_id: 27531028, restaurant_id: 1, restaurant_name: '롯데리아' },
        ],
      };
      restaurantService.findRegisteredBrands.mockResolvedValue(brands);
      const res = await post('/restaurant/brands').send({
        place_ids: [27531028, '1765423970'],
      });
      expect(describeSuccess(res)).toMatchSnapshot();
      // number와 숫자 문자열을 모두 문자열로 바꿔 서비스에 넘긴다.
      expect(restaurantService.findRegisteredBrands).toHaveBeenCalledWith(
        expect.objectContaining({ place_ids: ['27531028', '1765423970'] }),
      );
    });

    it('exposes x-request-id header', async () => {
      authService.hasUserInfo.mockResolvedValue(true);
      const res = await post('/userAuth/hasUserInfo');
      expect(res.headers['x-request-id']).toEqual(expect.any(String));
    });
  });

  describe('error responses', () => {
    it('400 when a required field is missing', async () => {
      const res = await post('/home/menuDetail').send({});
      expect(describeError(res)).toMatchSnapshot();
      expect(homeService.menuDetail).not.toHaveBeenCalled();
    });

    it.each([
      ['empty', []],
      ['non-numeric string', ['abc']],
      ['decimal number', [1.5]],
      ['over 100 ids', Array.from({ length: 101 }, (_, i) => i + 1)],
    ])('400 when /restaurant/brands place_ids is %s', async (_name, ids) => {
      const res = await post('/restaurant/brands').send({ place_ids: ids });
      expect(describeError(res)).toMatchSnapshot();
      expect(restaurantService.findRegisteredBrands).not.toHaveBeenCalled();
    });

    it('400 when a non-whitelisted field is sent', async () => {
      const res = await post('/home/menuDetail').send({ id: 10, extra: 1 });
      expect(describeError(res)).toMatchSnapshot();
    });

    it('400 when the JSON body is malformed', async () => {
      const res = await post('/home/menuDetail')
        .set('Content-Type', 'application/json')
        .send('{"id":');
      expect(res.status).toBe(400);
      // body-parser 메시지는 Node 버전마다 달라 형식만 비교한다.
      expect(shapeOf(res.body)).toMatchSnapshot();
      expect(res.body.error).toBe('BadRequestException');
    });

    // /home/menuDetail은 guard가 없으므로(#7 결정) guard가 있는 /home/weightSteps로 확인한다.
    it('401 when the access token is missing', async () => {
      const res = await request(app.getHttpServer())
        .post('/home/weightSteps')
        .send({ date: '2026-05-27' });
      expect(describeError(res)).toMatchSnapshot();
    });

    it('401 when the access token is invalid', async () => {
      const res = await request(app.getHttpServer())
        .post('/home/weightSteps')
        .set('Authorization', 'Bearer invalid')
        .send({ date: '2026-05-27' });
      expect(describeError(res)).toMatchSnapshot();
    });

    it('401 when the token user no longer exists', async () => {
      const token = jwtService.sign(
        { id: 999, email: 'gone@example.com', role: 'USER' },
        { secret: process.env.ACCESS_SECRET || 'default-secret' },
      );
      const res = await request(app.getHttpServer())
        .post('/home/weightSteps')
        .set('Authorization', `Bearer ${token}`)
        .send({ date: '2026-05-27' });
      expect(describeError(res)).toMatchSnapshot();
    });

    it('401 through CustomUnauthorizedExceptionFilter on /commonAuth/delete', async () => {
      const res = await request(app.getHttpServer()).post('/commonAuth/delete');
      expect(describeError(res)).toMatchSnapshot();
    });

    it('401 when the refresh token has no email', async () => {
      const res = await request(app.getHttpServer())
        .post('/commonAuth/refresh')
        .send({ refreshToken: jwtService.sign({ id: 1 }, { secret: 'x' }) });
      expect(describeError(res)).toMatchSnapshot();
    });

    it('403 HttpException from a service keeps its message', async () => {
      homeService.menuDetail.mockRejectedValue(
        new ForbiddenException('Not allowed'),
      );
      const res = await post('/home/menuDetail').send({ id: 10 });
      expect(describeError(res)).toMatchSnapshot();
    });

    it('404 for an unknown route', async () => {
      const res = await post('/home/unknown-route');
      expect(describeError(res)).toMatchSnapshot();
    });

    it('500 for a non-HTTP error', async () => {
      homeService.menuDetail.mockRejectedValue(new Error('boom'));
      const res = await post('/home/menuDetail').send({ id: 10 });
      expect(describeError(res)).toMatchSnapshot();
    });
  });
});
