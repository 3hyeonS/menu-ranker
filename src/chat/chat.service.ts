import {
  BadRequestException,
  Injectable,
  ServiceUnavailableException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { HttpService } from '@nestjs/axios';
import { firstValueFrom } from 'rxjs';
import { Brackets, Between, Repository } from 'typeorm';
import { UserEntity } from '../auth/entity/user/user.entity';
import { UserInfoEntity } from '../auth/entity/user/userInfo.entity';
import { MenuEntity } from '../home/entity/menu.entity';
import { MealEntity } from '../home/entity/meal.entity';
import { MealMenuEntity } from '../home/entity/meal-menu.entity';
import {
  roundNullableToOneDecimal,
  roundToOneDecimal,
} from '../utils/number.util';
import { ChatRecommendRequestDto } from './dto/request-dto/chat-recommend-request-dto';
import { ChatRecommendResponseDto } from './dto/response-dto/chat-recommend-response-dto';
import { ChatParsedRequestResponseDto } from './dto/response-dto/chat-parsed-request-response-dto';
import { ChatRecommendationBasisResponseDto } from './dto/response-dto/chat-recommendation-basis-response-dto';
import { ChatRecommendItemResponseDto } from './dto/response-dto/chat-recommend-item-response-dto';
import { ChatRecognizedCandidateResponseDto } from './dto/response-dto/chat-recognized-candidate-response-dto';
import { ChatHistoryEntity } from './entity/chat-history.entity';
import { ChatHistoryResponseDto } from './dto/response-dto/chat-history-response-dto';
import { ChatHistoryItemResponseDto } from './dto/response-dto/chat-history-item-response-dto';
import { ChatFeedbackResponseDto } from './dto/response-dto/chat-feedback-response-dto';
import { ChatFeedbackMenuResponseDto } from './dto/response-dto/chat-feedback-menu-response-dto';
import { ChatMenuBoardRecommendResponseDto } from './dto/response-dto/chat-menu-board-recommend-response-dto';

type ChatCategory = 'feedback' | 'recommendation';

type ChatClassification = {
  chat_category: ChatCategory;
  menu_names: string[];
};

type ParsedChatIntent = {
  normalized_request: string;
  meal_time: number | null;
  desired_brand: string | null;
  desired_category: string | null;
  nutrition_focus: string[];
  amount_preference: 'light' | 'regular' | 'hearty' | null;
  keywords: string[];
  include: IntentConditionGroup;
  exclude: IntentConditionGroup;
  nutrition_constraints: NutritionConstraints;
};

type IntentConditionGroup = {
  brands: string[];
  categories: string[];
  menu_names: string[];
  keywords: string[];
};

type NutritionConstraints = {
  max_calories: number | null;
  min_calories: number | null;
  min_protein: number | null;
  max_carbs: number | null;
  max_sugars: number | null;
  max_fat: number | null;
  max_sodium: number | null;
  caffeine_allowed: boolean | null;
};

type DailyNutrition = {
  calories: number;
  carbs: number;
  protein: number;
  fat: number;
};

type FeedbackNutrition = DailyNutrition & {
  sugars: number;
  sodium: number;
  caffeine: number;
  weight: number;
};

type ScoreBreakdown = {
  finalScore: number;
  calorieScore: number;
  macroScore: number;
  goalScore: number;
  satietyScore: number;
  sugarScore: number;
  intentScore: number;
  localReason: string;
};

type RankedMenu = {
  menu: MenuEntity;
  score: ScoreBreakdown;
};

type MenuRecognitionCandidate = {
  id: number;
  name: string;
  brand: string | null;
  category: string | null;
};

type GeminiDescription = {
  menu_id: number;
  one_line_summary: string;
  recommendation_reason: string;
};

@Injectable()
export class ChatService {
  private readonly mealTimeLabelMap = ['아침', '점심', '저녁', '간식', '야식'];
  private readonly mealTimeShareMap = [0.24, 0.34, 0.28, 0.08, 0.06];

  constructor(
    @InjectRepository(UserEntity)
    private readonly userRepository: Repository<UserEntity>,
    @InjectRepository(UserInfoEntity)
    private readonly userInfoRepository: Repository<UserInfoEntity>,
    @InjectRepository(MenuEntity)
    private readonly menuRepository: Repository<MenuEntity>,
    @InjectRepository(MealEntity)
    private readonly mealRepository: Repository<MealEntity>,
    @InjectRepository(MealMenuEntity)
    private readonly mealMenuRepository: Repository<MealMenuEntity>,
    @InjectRepository(ChatHistoryEntity)
    private readonly chatHistoryRepository: Repository<ChatHistoryEntity>,
    private readonly httpService: HttpService,
  ) {}

  private maskSecret(value?: string): string {
    return value ? `${value.slice(0, 8)}...(${value.length})` : 'NOT_SET';
  }

  async recommend(
    user: UserEntity,
    chatRecommendRequestDto: ChatRecommendRequestDto,
  ): Promise<ChatRecommendResponseDto> {
    const input = chatRecommendRequestDto.input?.trim();

    if (!input) {
      throw new BadRequestException('input must not be empty');
    }

    const userInfo = await this.getRequiredUserInfo(user.id);
    const classification = await this.classifyChatWithGemini(input);

    if (classification.chat_category === 'feedback') {
      return await this.feedback(user, userInfo, input, classification);
    }

    const parsedIntent = await this.parseIntentWithGemini(input, userInfo);
    const mealTime =
      parsedIntent.meal_time ?? this.inferMealTimeFromClock(new Date());
    const finalizedIntent: ParsedChatIntent = {
      ...parsedIntent,
      meal_time: mealTime,
    };

    const candidateMenus = await this.getCandidateMenus(
      user.id,
      finalizedIntent,
    );

    return await this.recommendWithPreparedContext({
      user,
      userInfo,
      input,
      intent: finalizedIntent,
      candidateMenus,
    });
  }

  async recommendFromMenuBoard(
    user: UserEntity,
    file: Express.Multer.File,
  ): Promise<ChatMenuBoardRecommendResponseDto> {
    if (!file) {
      throw new BadRequestException('image file is required');
    }

    if (!file.mimetype?.startsWith('image/')) {
      throw new BadRequestException('image file must be an image');
    }

    const userInfo = await this.getRequiredUserInfo(user.id);
    const availableMenus = await this.getAvailableMenuRecognitionCandidates(
      user.id,
    );

    if (availableMenus.length === 0) {
      throw new BadRequestException('No menus available for recommendation');
    }

    const recognizedCandidates =
      await this.recognizeMenuBoardCandidatesWithGemini(file, availableMenus);
    const candidateIds = recognizedCandidates.map((candidate) => candidate.id);

    if (candidateIds.length === 0) {
      throw new BadRequestException(
        'No recognized menus matched the available menu list',
      );
    }

    const candidateMenus = await this.menuRepository.find({
      where: candidateIds.map((id) => ({ id, is_deleted: 0 })),
      relations: { user: true },
    });
    const menuMap = new Map(candidateMenus.map((menu) => [menu.id, menu]));
    const orderedCandidateMenus = candidateIds
      .map((id) => menuMap.get(id))
      .filter((menu): menu is MenuEntity => !!menu);

    const inferredBrand = this.inferDominantValue(
      recognizedCandidates.map((candidate) => candidate.brand),
    );
    const inferredCategory = this.inferDominantValue(
      recognizedCandidates.map((candidate) => candidate.category),
    );

    const now = new Date();
    const mealTime = this.inferMealTimeFromClock(now);
    const intent: ParsedChatIntent = {
      normalized_request: '메뉴판 사진에 있는 메뉴 후보 기반 추천',
      meal_time: mealTime,
      desired_brand: inferredBrand,
      desired_category: inferredCategory,
      nutrition_focus: [],
      amount_preference: 'regular',
      keywords: this.buildKeywordsFromCandidates(recognizedCandidates),
      include: this.emptyIntentConditionGroup(),
      exclude: this.emptyIntentConditionGroup(),
      nutrition_constraints: this.emptyNutritionConstraints(),
    };

    const response = (await this.recommendWithPreparedContext({
      user,
      userInfo,
      input: '메뉴판 사진 기반 추천',
      intent,
      candidateMenus: orderedCandidateMenus,
      recognizedCandidates,
    })) as ChatMenuBoardRecommendResponseDto;

    response.intro_message = `메뉴판에서 인식된 후보 메뉴를 기준으로 ${this.mealTimeLabelMap[mealTime]} 추천을 정리해드렸어요!`;

    return response;
  }

  private async recommendWithPreparedContext(params: {
    user: UserEntity;
    userInfo: UserInfoEntity;
    input: string;
    intent: ParsedChatIntent;
    candidateMenus: MenuEntity[];
    recognizedCandidates?: MenuRecognitionCandidate[];
  }): Promise<ChatRecommendResponseDto> {
    const {
      user,
      userInfo,
      input,
      intent,
      candidateMenus,
      recognizedCandidates,
    } = params;

    const targetDate = this.resolveTargetDate();
    const dailyNutrition = await this.getDailyNutrition(user.id, targetDate);
    const mealTime =
      intent.meal_time ?? this.inferMealTimeFromClock(new Date());
    const rankingBasis = this.buildRecommendationBasis(
      userInfo,
      dailyNutrition,
      mealTime,
      intent.amount_preference,
    );

    const filteredCandidateMenus = this.applyIntentFilters(
      candidateMenus,
      intent,
    );

    if (filteredCandidateMenus.length === 0) {
      throw new BadRequestException('No menus available for recommendation');
    }

    const rankedMenus = filteredCandidateMenus
      .map((menu) => ({
        menu,
        score: this.scoreMenu(menu, intent, userInfo, rankingBasis),
      }))
      .sort((a, b) => b.score.finalScore - a.score.finalScore)
      .slice(0, 10);

    const generatedDescriptions = await this.generateDescriptionsWithGemini(
      input,
      intent,
      rankingBasis,
      rankedMenus,
    );

    const descriptionMap = new Map(
      generatedDescriptions.map((description) => [
        description.menu_id,
        description,
      ]),
    );

    const response = new ChatRecommendResponseDto();
    response.chat_category = 'recommendation';
    response.intro_message = this.buildIntroMessage(intent, userInfo);
    response.recommendations = rankedMenus.map(({ menu, score }, index) => {
      const item = new ChatRecommendItemResponseDto();
      const generated = descriptionMap.get(menu.id);

      item.menu_id = menu.id;
      item.menu_name = menu.name;
      item.brand = menu.brand ?? null;
      item.unit = menu.unit;
      item.weight = roundNullableToOneDecimal(menu.weight) ?? 0;
      item.unit_quantity = menu.unit_quantity;
      item.calories = roundNullableToOneDecimal(menu.calories) ?? 0;
      item.data_source = menu.data_source;
      item.score = roundToOneDecimal(score.finalScore);
      item.rank = index + 1;
      item.one_line_summary =
        generated?.one_line_summary ?? this.buildFallbackSummary(menu, score);
      item.recommendation_reason =
        generated?.recommendation_reason ?? score.localReason;

      return item;
    });
    if (recognizedCandidates) {
      (response as ChatMenuBoardRecommendResponseDto).recognized_candidates =
        recognizedCandidates.map((candidate) =>
          this.toRecognizedCandidateResponse(candidate),
        );
    }

    await this.chatHistoryRepository.save(
      this.chatHistoryRepository.create({
        input_text: input,
        response_payload: response as unknown as Record<string, any>,
        user,
      }),
    );

    return response;
  }

  private async feedback(
    user: UserEntity,
    userInfo: UserInfoEntity,
    input: string,
    classification: ChatClassification,
  ): Promise<ChatRecommendResponseDto> {
    if (classification.menu_names.length === 0) {
      throw new BadRequestException('No menus found in feedback request');
    }

    const candidateMenus = await this.getAllCandidateMenus(user.id);

    if (candidateMenus.length === 0) {
      throw new BadRequestException('No menus available for feedback');
    }

    const targetDate = this.resolveTargetDate();
    const dailyNutrition = await this.getDailyNutrition(user.id, targetDate);
    const mealTime = this.inferMealTimeFromClock(new Date());
    const rankingBasis = this.buildRecommendationBasis(
      userInfo,
      dailyNutrition,
      mealTime,
      'regular',
    );
    const matchedMenus = classification.menu_names.map((menuName) => ({
      inputMenuName: menuName,
      menu: this.findMostSimilarMenu(menuName, candidateMenus),
    }));
    const combinationNutrition = this.sumFeedbackNutrition(
      matchedMenus.map(({ menu }) => menu),
    );
    const combinationScore = this.scoreFeedbackCombination(
      combinationNutrition,
      userInfo,
      rankingBasis,
    );
    const feedback = new ChatFeedbackResponseDto();

    feedback.menus = matchedMenus.map(({ inputMenuName, menu }) =>
      this.toFeedbackMenuResponse(inputMenuName, menu),
    );
    feedback.total_calories = roundToOneDecimal(combinationNutrition.calories);
    feedback.score = roundToOneDecimal(combinationScore.finalScore);
    feedback.is_appropriate = combinationScore.finalScore >= 65;
    feedback.feedback_summary = this.buildFeedbackSummary(combinationScore);
    feedback.feedback_reason = this.buildFeedbackReason(
      matchedMenus.map(({ menu }) => menu),
      combinationNutrition,
      combinationScore,
      userInfo,
    );

    const response = new ChatRecommendResponseDto();
    response.chat_category = 'feedback';
    response.intro_message = `${this.goalToLabel(userInfo.goal)} 목표와 오늘 식사 기록을 기준으로 입력한 메뉴를 확인했어요.`;
    response.feedback = feedback;

    await this.chatHistoryRepository.save(
      this.chatHistoryRepository.create({
        input_text: input,
        response_payload: response as unknown as Record<string, any>,
        user,
      }),
    );

    return response;
  }

  private async getRequiredUserInfo(userId: number): Promise<UserInfoEntity> {
    const userInfo = await this.userInfoRepository.findOne({
      where: { user: { id: userId } },
      relations: { user: true },
    });

    if (!userInfo) {
      throw new BadRequestException(
        'User profile is required for recommendation',
      );
    }

    return userInfo;
  }

  async getChatHistory(user: UserEntity): Promise<ChatHistoryResponseDto> {
    // 채팅 기록은 최신 대화가 먼저 보이도록 createdAt 내림차순으로 반환합니다.
    const chatHistoryList = await this.chatHistoryRepository.find({
      where: {
        user: { id: user.id },
      },
      order: {
        createdAt: 'DESC',
        id: 'DESC',
      },
      take: 50,
    });

    return new ChatHistoryResponseDto(
      chatHistoryList.map(
        (chatHistory) => new ChatHistoryItemResponseDto(chatHistory),
      ),
    );
  }

  private buildIntroMessage(
    intent: ParsedChatIntent,
    userInfo: UserInfoEntity,
  ): string {
    const goalTone =
      userInfo.goal === 0
        ? '다이어트식으로'
        : userInfo.goal === 2
          ? '벌크업 식단 관점에서'
          : '균형 잡힌 식단 기준으로';
    const brandPart = intent.desired_brand
      ? `${intent.desired_brand}에서 `
      : '';
    const categoryPart = intent.desired_category
      ? `${intent.desired_category} 중심으로 `
      : '';
    const focusPart = this.buildFocusPhrase(intent);

    return `${focusPart}${goalTone} ${brandPart}${categoryPart}추천하는 메뉴를 정리해드렸어요!`;
  }

  private buildFocusPhrase(intent: ParsedChatIntent): string {
    if (intent.nutrition_focus.includes('high_protein')) {
      return '단백질을 채우기 좋게 ';
    }
    if (intent.nutrition_focus.includes('high_fat')) {
      return '고지방 식단에 맞게 ';
    }
    if (intent.nutrition_focus.includes('low_carb')) {
      return '저탄수 식단에 맞게 ';
    }
    if (intent.nutrition_focus.includes('light_meal')) {
      return '가볍게 먹기 좋게 ';
    }
    if (intent.nutrition_focus.includes('hearty_meal')) {
      return '든든하게 먹기 좋게 ';
    }
    return '요청하신 조건에 맞춰 ';
  }

  private resolveTargetDate(): Date {
    const baseDate = new Date();
    const startOfDay = new Date(baseDate);
    startOfDay.setHours(0, 0, 0, 0);
    return startOfDay;
  }

  private async getDailyNutrition(
    userId: number,
    date: Date,
  ): Promise<DailyNutrition> {
    // 오늘 먹은 식사 기록을 전부 가져와 누적 칼로리/탄단지를 계산합니다.
    const startOfDay = new Date(date);
    const endOfDay = new Date(date);

    startOfDay.setHours(0, 0, 0, 0);
    endOfDay.setHours(23, 59, 59, 999);

    const meals = await this.mealRepository.find({
      where: {
        date: Between(startOfDay, endOfDay),
        user: { id: userId },
      },
      relations: {
        mealMenus: {
          menu: true,
        },
      },
    });

    return meals.reduce(
      (acc, meal) => {
        meal.mealMenus.forEach((mealMenu) => {
          const quantity = mealMenu.quantity ?? 0;
          acc.calories += (mealMenu.menu.calories ?? 0) * quantity;
          acc.carbs += (mealMenu.menu.carbs ?? 0) * quantity;
          acc.protein += (mealMenu.menu.protein ?? 0) * quantity;
          acc.fat += (mealMenu.menu.fat ?? 0) * quantity;
        });
        return acc;
      },
      { calories: 0, carbs: 0, protein: 0, fat: 0 },
    );
  }

  private async getAvailableMenuRecognitionCandidates(
    userId: number,
  ): Promise<MenuRecognitionCandidate[]> {
    return await this.menuRepository
      .createQueryBuilder('menu')
      .leftJoin('menu.user', 'user')
      .select([
        'menu.id AS id',
        'menu.name AS name',
        'menu.brand AS brand',
        'menu.category AS category',
      ])
      .where(
        new Brackets((qb) => {
          qb.where('user.id IS NULL').orWhere('user.id = :userId', { userId });
        }),
      )
      .andWhere('menu.is_deleted = :isDeleted', { isDeleted: 0 })
      .orderBy('menu.id', 'ASC')
      .getRawMany<MenuRecognitionCandidate>();
  }

  private async recognizeMenuBoardCandidatesWithGemini(
    file: Express.Multer.File,
    menus: MenuRecognitionCandidate[],
  ): Promise<MenuRecognitionCandidate[]> {
    const prompt = `
메뉴판 사진을 보고, 아래 메뉴 entity 후보 중 사진 속 메뉴와 가장 일치하는 값들만 골라 JSON object만 반환해.

규칙:
- 반드시 JSON object만 반환하고 마크다운, 설명, 코드펜스는 금지
- 사진 속 실제 메뉴명과 매칭되는 후보만 선택해
- 후보 목록에 없는 메뉴는 절대 추가하지 마
- OCR로 읽힌 문구와 후보 매칭에 자신 있는 항목만 남겨
- 최대 30개까지만 반환해
- candidate_menu_ids에는 중복을 넣지 마
- 메뉴판의 브랜드나 카테고리가 보이면 inferred_brand, inferred_category에 넣고 불명확하면 null

후보 메뉴:
${JSON.stringify(menus)}

반환 shape:
{
  "recognized_texts": ["싸이버거", "치즈버거"],
  "inferred_brand": "맘스터치",
  "inferred_category": "버거",
  "candidate_menu_ids": [1, 2, 3]
}
`.trim();

    const data = await this.callGeminiJsonWithImage(prompt, file);
    const candidateIds: unknown[] = Array.isArray(data?.candidate_menu_ids)
      ? data.candidate_menu_ids
      : [];
    const menuMap = new Map(menus.map((menu) => [Number(menu.id), menu]));
    const uniqueIds = Array.from(
      new Set<number>(
        candidateIds
          .map((value) => Number(value))
          .filter(
            (id): id is number => Number.isInteger(id) && menuMap.has(id),
          ),
      ),
    ).slice(0, 30);

    const inferredBrand = this.asNonEmptyString(data?.inferred_brand);
    const inferredCategory = this.asNonEmptyString(data?.inferred_category);

    return uniqueIds.map((id) => {
      const matched = menuMap.get(id)!;
      return {
        ...matched,
        brand: matched.brand ?? inferredBrand ?? null,
        category: matched.category ?? inferredCategory ?? null,
      };
    });
  }

  private async getCandidateMenus(
    userId: number,
    intent: ParsedChatIntent,
  ): Promise<MenuEntity[]> {
    // 공용 메뉴 + 사용자가 직접 등록한 메뉴를 함께 추천 후보로 사용합니다.
    const builder = this.menuRepository
      .createQueryBuilder('menu')
      .leftJoinAndSelect('menu.user', 'user')
      .where(
        new Brackets((qb) => {
          qb.where('user.id IS NULL').orWhere('user.id = :userId', { userId });
        }),
      );
    builder.andWhere('menu.is_deleted = :isDeleted', { isDeleted: 0 });

    const brandFilters = Array.from(
      new Set(
        [intent.desired_brand, ...intent.include.brands].filter(
          (brand): brand is string => !!brand,
        ),
      ),
    );
    const categoryFilters = Array.from(
      new Set(
        [intent.desired_category, ...intent.include.categories].filter(
          (category): category is string => !!category,
        ),
      ),
    );

    // 브랜드가 지정된 경우 우선 브랜드 필터를 걸어 관련 메뉴만 남깁니다.
    if (brandFilters.length > 0) {
      builder.andWhere(
        new Brackets((qb) => {
          brandFilters.forEach((brand, index) => {
            const parameterName = `brand${index}`;
            const condition = `menu.brand LIKE :${parameterName}`;

            if (index === 0) {
              qb.where(condition, { [parameterName]: `%${brand}%` });
              return;
            }

            qb.orWhere(condition, { [parameterName]: `%${brand}%` });
          });
        }),
      );
    }

    // 카테고리가 지정된 경우도 우선 필터링합니다.
    if (categoryFilters.length > 0) {
      builder.andWhere(
        new Brackets((qb) => {
          categoryFilters.forEach((category, index) => {
            const parameterName = `category${index}`;
            const condition = `menu.category LIKE :${parameterName}`;

            if (index === 0) {
              qb.where(condition, { [parameterName]: `%${category}%` });
              return;
            }

            qb.orWhere(condition, { [parameterName]: `%${category}%` });
          });
        }),
      );
    }

    // 브랜드/카테고리 필터 결과가 0건이면 추천이 사라지지 않도록 전체 후보로 한 번 더 fallback 합니다.
    const menus = await builder.getMany();
    if (
      menus.length > 0 ||
      (brandFilters.length === 0 && categoryFilters.length === 0)
    ) {
      return menus;
    }

    return await this.menuRepository
      .createQueryBuilder('menu')
      .leftJoinAndSelect('menu.user', 'user')
      .where(
        new Brackets((qb) => {
          qb.where('user.id IS NULL').orWhere('user.id = :userId', { userId });
        }),
      )
      .andWhere('menu.is_deleted = :isDeleted', { isDeleted: 0 })
      .getMany();
  }

  private async getAllCandidateMenus(userId: number): Promise<MenuEntity[]> {
    return await this.menuRepository
      .createQueryBuilder('menu')
      .leftJoinAndSelect('menu.user', 'user')
      .where(
        new Brackets((qb) => {
          qb.where('user.id IS NULL').orWhere('user.id = :userId', { userId });
        }),
      )
      .andWhere('menu.is_deleted = :isDeleted', { isDeleted: 0 })
      .getMany();
  }

  private applyIntentFilters(
    menus: MenuEntity[],
    intent: ParsedChatIntent,
  ): MenuEntity[] {
    return menus.filter((menu) => {
      if (!this.matchesIncludeConditions(menu, intent.include)) {
        return false;
      }

      if (this.matchesExcludeConditions(menu, intent.exclude)) {
        return false;
      }

      return this.matchesNutritionConstraints(
        menu,
        intent.nutrition_constraints,
      );
    });
  }

  private matchesIncludeConditions(
    menu: MenuEntity,
    include: IntentConditionGroup,
  ): boolean {
    return (
      (include.brands.length === 0 ||
        this.matchesAnyTerm(menu.brand, include.brands)) &&
      (include.categories.length === 0 ||
        this.matchesAnyTerm(menu.category, include.categories)) &&
      (include.menu_names.length === 0 ||
        this.matchesAnyMenuText(menu, include.menu_names, 'name')) &&
      this.matchesAllMenuText(menu, include.keywords)
    );
  }

  private matchesExcludeConditions(
    menu: MenuEntity,
    exclude: IntentConditionGroup,
  ): boolean {
    return (
      this.matchesAnyTerm(menu.brand, exclude.brands) ||
      this.matchesAnyTerm(menu.category, exclude.categories) ||
      this.matchesAnyMenuText(menu, exclude.menu_names, 'name') ||
      this.matchesAnyMenuText(menu, exclude.keywords)
    );
  }

  private matchesNutritionConstraints(
    menu: MenuEntity,
    constraints: NutritionConstraints,
  ): boolean {
    if (
      constraints.max_calories !== null &&
      (menu.calories ?? 0) > constraints.max_calories
    ) {
      return false;
    }

    if (
      constraints.min_calories !== null &&
      (menu.calories ?? 0) < constraints.min_calories
    ) {
      return false;
    }

    if (
      constraints.min_protein !== null &&
      (menu.protein ?? 0) < constraints.min_protein
    ) {
      return false;
    }

    if (
      constraints.max_carbs !== null &&
      (menu.carbs ?? 0) > constraints.max_carbs
    ) {
      return false;
    }

    if (
      constraints.max_sugars !== null &&
      (menu.sugars ?? 0) > constraints.max_sugars
    ) {
      return false;
    }

    if (constraints.max_fat !== null && (menu.fat ?? 0) > constraints.max_fat) {
      return false;
    }

    if (
      constraints.max_sodium !== null &&
      (menu.sodium ?? 0) > constraints.max_sodium
    ) {
      return false;
    }

    if (constraints.caffeine_allowed === false && (menu.caffeine ?? 0) > 0) {
      return false;
    }

    return true;
  }

  private matchesAnyTerm(value: string | null | undefined, terms: string[]) {
    return terms.some((term) => this.matchesTerm(value, term));
  }

  private matchesTerm(value: string | null | undefined, term: string) {
    return (value ?? '').toLowerCase().includes(term.toLowerCase());
  }

  private matchesAllMenuText(menu: MenuEntity, terms: string[]) {
    return terms.every((term) => this.matchesMenuText(menu, term));
  }

  private matchesAnyMenuText(
    menu: MenuEntity,
    terms: string[],
    scope: 'all' | 'name' = 'all',
  ) {
    return terms.some((term) => this.matchesMenuText(menu, term, scope));
  }

  private matchesMenuText(
    menu: MenuEntity,
    term: string,
    scope: 'all' | 'name' = 'all',
  ) {
    const text =
      scope === 'name'
        ? menu.name
        : `${menu.name} ${menu.brand ?? ''} ${menu.category ?? ''}`;

    return text.toLowerCase().includes(term.toLowerCase());
  }

  private buildRecommendationBasis(
    userInfo: UserInfoEntity,
    dailyNutrition: DailyNutrition,
    mealTime: number,
    amountPreference: ParsedChatIntent['amount_preference'],
  ) {
    // 사용자 목표 비율을 100% 기준으로 정규화하고, 하루 목표를 gram 단위로 환산합니다.
    const targetRatio = this.normalizeTargetRatio(userInfo.target_ratio);
    const targetMacroGrams = {
      carbs: (userInfo.target_calories * targetRatio[0]) / 100 / 4,
      protein: (userInfo.target_calories * targetRatio[1]) / 100 / 4,
      fat: (userInfo.target_calories * targetRatio[2]) / 100 / 9,
    };

    // 남은 예산을 기준으로 현재 끼니에서 어느 정도 칼로리를 쓰는 게 적절한지 계산합니다.
    const remainingCalories = Math.max(
      userInfo.target_calories - dailyNutrition.calories,
      0,
    );
    const remainingMacros = {
      carbs: Math.max(targetMacroGrams.carbs - dailyNutrition.carbs, 0),
      protein: Math.max(targetMacroGrams.protein - dailyNutrition.protein, 0),
      fat: Math.max(targetMacroGrams.fat - dailyNutrition.fat, 0),
    };

    const remainingMealCount = Math.max(5 - mealTime, 1);
    const slotCalories =
      userInfo.target_calories * this.mealTimeShareMap[mealTime];
    const dynamicCalories =
      remainingCalories > 0
        ? remainingCalories / remainingMealCount
        : slotCalories * 0.6;
    let targetMealCalories = slotCalories * 0.45 + dynamicCalories * 0.55;

    // 가볍게/든든하게 같은 채팅 의도를 끼니 목표 칼로리에 반영합니다.
    if (amountPreference === 'light') {
      targetMealCalories *= 0.82;
    }
    if (amountPreference === 'hearty') {
      targetMealCalories *= 1.18;
    }

    targetMealCalories = Math.max(
      120,
      Math.min(targetMealCalories, userInfo.target_calories),
    );

    return {
      targetRatio,
      dailyNutrition,
      remainingCalories,
      remainingMacros,
      targetMealCalories,
    };
  }

  private normalizeTargetRatio(targetRatio: number[]): number[] {
    // DB 값이 비정상이더라도 기본 비율로 안전하게 fallback 합니다.
    if (!Array.isArray(targetRatio) || targetRatio.length !== 3) {
      return [50, 25, 25];
    }

    const safeRatio = targetRatio.map((value) =>
      Math.max(Number(value) || 0, 0),
    );
    const sum = safeRatio.reduce((acc, value) => acc + value, 0);

    if (sum <= 0) {
      return [50, 25, 25];
    }

    return safeRatio.map((value) => roundToOneDecimal((value / sum) * 100));
  }

  private scoreMenu(
    menu: MenuEntity,
    intent: ParsedChatIntent,
    userInfo: UserInfoEntity,
    basis: ReturnType<ChatService['buildRecommendationBasis']>,
  ): ScoreBreakdown {
    // 메뉴별 점수는 칼로리 적합도, 탄단지 적합도, 목표 적합도, 포만감, 당 밀도, 의도 매칭으로 구성합니다.
    const calories = menu.calories ?? 0;
    const carbs = menu.carbs ?? 0;
    const protein = menu.protein ?? 0;
    const fat = menu.fat ?? 0;
    const sugars = menu.sugars ?? 0;
    const weight = menu.weight ?? 0;

    // 남은 탄단지 비율과 메뉴의 실제 탄단지 비율이 가까울수록 높은 점수를 줍니다.
    const menuMacroRatio = this.getMacroRatioFromMenu(menu, basis.targetRatio);
    const remainingRatio = this.getRemainingMacroRatio(
      basis.remainingMacros,
      basis.targetRatio,
    );
    const macroDistance =
      Math.abs(menuMacroRatio[0] - remainingRatio[0]) +
      Math.abs(menuMacroRatio[1] - remainingRatio[1]) +
      Math.abs(menuMacroRatio[2] - remainingRatio[2]);

    const calorieGap = Math.abs(calories - basis.targetMealCalories);
    const calorieScore = this.clampScore(
      100 - (calorieGap / Math.max(basis.targetMealCalories, 1)) * 100,
    );
    const macroScore = this.clampScore(100 - macroDistance / 1.8);

    // 포만감 효율은 "단백질 칼로리 비율"과 "중량 대비 칼로리"를 함께 반영합니다.
    const proteinCalorieRatio = calories > 0 ? (protein * 4) / calories : 0;
    const calorieDensity =
      weight > 0 ? calories / weight : calories > 0 ? calories / 100 : 0;
    const sugarDensity = calories > 0 ? sugars / calories : 0;

    // 사용자 목표(감량/유지/증량)에 따라 서로 다른 가중치로 보정합니다.
    let goalScore = 55;
    switch (userInfo.goal) {
      case 0:
        goalScore += proteinCalorieRatio * 120;
        goalScore -= calorieDensity * 18;
        goalScore -= sugarDensity * 900;
        break;
      case 1:
        goalScore += proteinCalorieRatio * 70;
        goalScore -= Math.abs(calories - basis.targetMealCalories) / 12;
        goalScore -= sugarDensity * 450;
        break;
      case 2:
        goalScore +=
          Math.min(calories / Math.max(basis.targetMealCalories, 1), 1.4) * 28;
        goalScore += proteinCalorieRatio * 80;
        goalScore -= sugarDensity * 280;
        break;
    }
    goalScore = this.clampScore(goalScore);

    const satietyScore = this.clampScore(
      proteinCalorieRatio * 220 +
        (weight > 0 ? (weight / Math.max(calories, 1)) * 160 : 0),
    );
    const sugarScore = this.clampScore(100 - sugarDensity * 1200);
    const intentScore = this.calculateIntentScore(menu, intent);

    // 최종 점수는 각 세부 점수를 가중합으로 합칩니다.
    const finalScore =
      calorieScore * 0.24 +
      macroScore * 0.24 +
      goalScore * 0.16 +
      satietyScore * 0.16 +
      sugarScore * 0.1 +
      intentScore * 0.1;

    return {
      finalScore: roundToOneDecimal(finalScore),
      calorieScore: roundToOneDecimal(calorieScore),
      macroScore: roundToOneDecimal(macroScore),
      goalScore: roundToOneDecimal(goalScore),
      satietyScore: roundToOneDecimal(satietyScore),
      sugarScore: roundToOneDecimal(sugarScore),
      intentScore: roundToOneDecimal(intentScore),
      localReason: this.buildLocalReason(menu, {
        calorieScore,
        macroScore,
        goalScore,
        satietyScore,
        sugarScore,
        intentScore,
      }),
    };
  }

  private clampScore(value: number): number {
    return Math.max(0, Math.min(value, 100));
  }

  private getMacroRatioFromMenu(
    menu: MenuEntity,
    fallbackRatio: number[],
  ): number[] {
    // 메뉴 영양성분을 kcal 기준 탄단지 비율로 환산합니다.
    const carbsCalories = (menu.carbs ?? 0) * 4;
    const proteinCalories = (menu.protein ?? 0) * 4;
    const fatCalories = (menu.fat ?? 0) * 9;
    const totalMacroCalories = carbsCalories + proteinCalories + fatCalories;

    if (totalMacroCalories <= 0) {
      return fallbackRatio;
    }

    return [
      (carbsCalories / totalMacroCalories) * 100,
      (proteinCalories / totalMacroCalories) * 100,
      (fatCalories / totalMacroCalories) * 100,
    ];
  }

  private getRemainingMacroRatio(
    remainingMacros: { carbs: number; protein: number; fat: number },
    fallbackRatio: number[],
  ): number[] {
    // 오늘 남은 탄단지 목표도 같은 기준으로 kcal 비율화해서 비교에 사용합니다.
    const carbsCalories = remainingMacros.carbs * 4;
    const proteinCalories = remainingMacros.protein * 4;
    const fatCalories = remainingMacros.fat * 9;
    const total = carbsCalories + proteinCalories + fatCalories;

    if (total <= 0) {
      return fallbackRatio;
    }

    return [
      (carbsCalories / total) * 100,
      (proteinCalories / total) * 100,
      (fatCalories / total) * 100,
    ];
  }

  private calculateIntentScore(
    menu: MenuEntity,
    intent: ParsedChatIntent,
  ): number {
    // 사용자가 말한 브랜드/카테고리/영양 키워드를 얼마나 잘 만족하는지 별도로 점수화합니다.
    let score = 50;
    const searchable =
      `${menu.name} ${menu.brand ?? ''} ${menu.category ?? ''}`.toLowerCase();

    if (intent.desired_brand) {
      score += (menu.brand ?? '')
        .toLowerCase()
        .includes(intent.desired_brand.toLowerCase())
        ? 30
        : -35;
    }

    if (intent.desired_category) {
      score += searchable.includes(intent.desired_category.toLowerCase())
        ? 16
        : -10;
    }

    intent.keywords.forEach((keyword) => {
      if (searchable.includes(keyword.toLowerCase())) {
        score += 6;
      }
    });

    intent.nutrition_focus.forEach((focus) => {
      switch (focus) {
        case 'high_protein':
          score += (menu.protein ?? 0) >= 20 ? 14 : 0;
          break;
        case 'high_fat':
          score += (menu.fat ?? 0) >= 18 ? 12 : 0;
          break;
        case 'low_carb':
          score += (menu.carbs ?? 0) <= 20 ? 12 : 0;
          break;
        case 'low_sugar':
          score += (menu.sugars ?? 0) <= 8 ? 10 : 0;
          break;
        case 'light_meal':
          score += (menu.calories ?? 0) <= 450 ? 10 : -8;
          break;
        case 'hearty_meal':
          score += (menu.calories ?? 0) >= 500 ? 10 : -6;
          break;
      }
    });

    return this.clampScore(score);
  }

  private buildLocalReason(
    menu: MenuEntity,
    scores: Omit<ScoreBreakdown, 'finalScore' | 'localReason'>,
  ): string {
    // Gemini 설명 생성이 실패할 때를 대비해 내부용 추천 사유도 함께 만들어 둡니다.
    const reasons: string[] = [];

    if (scores.calorieScore >= 75) {
      reasons.push('현재 끼니 목표 칼로리에 잘 맞습니다');
    }
    if (scores.macroScore >= 75) {
      reasons.push('남은 탄단지 목표와의 정렬도가 좋습니다');
    }
    if (scores.satietyScore >= 75) {
      reasons.push(
        '단백질 비율과 중량 대비 칼로리 측면에서 포만감 효율이 좋습니다',
      );
    }
    if (scores.sugarScore >= 75) {
      reasons.push('당 밀도가 낮아 부담이 덜합니다');
    }
    if (scores.intentScore >= 75) {
      reasons.push('브랜드/카테고리/영양 의도와 잘 맞습니다');
    }

    if (reasons.length === 0) {
      reasons.push('여러 기준에서 평균 이상 점수를 받은 균형형 추천입니다');
    }

    return `${menu.name}은(는) ${reasons.join(', ')}.`;
  }

  private formatAmount(menu: MenuEntity): string {
    // 응답에서 바로 보여주기 좋은 "1인분 (230g)" 형태로 양을 정리합니다.
    const unitLabel = menu.unit === 1 ? 'ml' : 'g';
    return `${menu.unit_quantity ?? '인분'} (${roundNullableToOneDecimal(menu.weight) ?? 0}${unitLabel})`;
  }

  private buildFallbackSummary(
    menu: MenuEntity,
    score: ScoreBreakdown,
  ): string {
    if (score.satietyScore >= 75) {
      return '포만감 효율이 좋아 한 끼 메뉴로 안정적인 선택입니다.';
    }
    if (score.macroScore >= 75) {
      return '남은 탄단지 목표와 잘 맞는 구성이 강점입니다.';
    }
    if (score.calorieScore >= 75) {
      return '현재 식사 슬롯 칼로리 예산에 잘 맞는 메뉴입니다.';
    }
    return `${menu.name}은(는) 전체 균형 점수가 높아 상위권에 선정되었습니다.`;
  }

  private buildFeedbackSummary(score: ScoreBreakdown): string {
    if (score.finalScore >= 80) {
      return '현재 목표와 남은 섭취량 기준에서 꽤 잘 맞는 조합입니다.';
    }

    if (score.finalScore >= 65) {
      return '현재 상황에서 무난하지만 다른 끼니 조절이 있으면 더 좋습니다.';
    }

    if (score.finalScore >= 45) {
      return '먹을 수는 있지만 현재 목표 기준으로는 조금 아쉬운 조합입니다.';
    }

    return '현재 목표와 오늘 섭취 흐름을 보면 신중하게 조절하는 편이 좋습니다.';
  }

  private buildFeedbackReason(
    menus: MenuEntity[],
    nutrition: FeedbackNutrition,
    score: ScoreBreakdown,
    userInfo: UserInfoEntity,
  ): string {
    const goalLabel = this.goalToLabel(userInfo.goal);
    const menuNames = menus.map((menu) => menu.name).join(', ');
    const reasons = [
      `총 ${roundToOneDecimal(nutrition.calories)}kcal, 탄수화물 ${roundToOneDecimal(nutrition.carbs)}g, 단백질 ${roundToOneDecimal(nutrition.protein)}g, 지방 ${roundToOneDecimal(nutrition.fat)}g 조합입니다.`,
    ];

    if (score.calorieScore < 55) {
      reasons.push('현재 끼니 목표 칼로리와는 차이가 있는 편입니다.');
    }

    if (score.macroScore < 55) {
      reasons.push('남은 탄단지 목표와의 정렬도는 높지 않습니다.');
    }

    if (score.sugarScore < 55) {
      reasons.push('당 밀도도 함께 확인하는 것이 좋습니다.');
    }

    return `${menuNames} 조합은 ${goalLabel} 목표 기준 점수 ${roundToOneDecimal(score.finalScore)}점입니다. ${reasons.join(' ')}`;
  }

  private buildFeedbackIntent(input: string): ParsedChatIntent {
    return {
      normalized_request: input,
      meal_time: this.inferMealTimeFromClock(new Date()),
      desired_brand: this.extractBrandKeyword(input),
      desired_category: this.extractCategoryKeyword(input),
      nutrition_focus: [],
      amount_preference: 'regular',
      keywords: input
        .split(/\s+/)
        .map((token) => token.replace(/[^\w가-힣]/g, ''))
        .filter((token) => token.length >= 2)
        .slice(0, 6),
      include: this.emptyIntentConditionGroup(),
      exclude: this.emptyIntentConditionGroup(),
      nutrition_constraints: this.emptyNutritionConstraints(),
    };
  }

  private toFeedbackMenuResponse(
    inputMenuName: string,
    menu: MenuEntity,
  ): ChatFeedbackMenuResponseDto {
    const response = new ChatFeedbackMenuResponseDto();

    response.input_menu_name = inputMenuName;
    response.menu_id = menu.id;
    response.menu_name = menu.name;
    response.brand = menu.brand ?? null;
    response.unit = menu.unit;
    response.weight = roundNullableToOneDecimal(menu.weight) ?? 0;
    response.unit_quantity = menu.unit_quantity;
    response.calories = roundNullableToOneDecimal(menu.calories) ?? 0;
    response.data_source = menu.data_source;

    return response;
  }

  private sumFeedbackNutrition(menus: MenuEntity[]): FeedbackNutrition {
    return menus.reduce(
      (acc, menu) => {
        acc.calories += menu.calories ?? 0;
        acc.carbs += menu.carbs ?? 0;
        acc.protein += menu.protein ?? 0;
        acc.fat += menu.fat ?? 0;
        acc.sugars += menu.sugars ?? 0;
        acc.sodium += menu.sodium ?? 0;
        acc.caffeine += menu.caffeine ?? 0;
        acc.weight += menu.weight ?? 0;
        return acc;
      },
      {
        calories: 0,
        carbs: 0,
        protein: 0,
        fat: 0,
        sugars: 0,
        sodium: 0,
        caffeine: 0,
        weight: 0,
      },
    );
  }

  private scoreFeedbackCombination(
    nutrition: FeedbackNutrition,
    userInfo: UserInfoEntity,
    basis: ReturnType<ChatService['buildRecommendationBasis']>,
  ): ScoreBreakdown {
    const syntheticMenu = {
      calories: nutrition.calories,
      carbs: nutrition.carbs,
      protein: nutrition.protein,
      fat: nutrition.fat,
      sugars: nutrition.sugars,
      sodium: nutrition.sodium,
      caffeine: nutrition.caffeine,
      weight: nutrition.weight,
    } as MenuEntity;
    const intent = this.buildFeedbackIntent('조합 피드백');

    return this.scoreMenu(syntheticMenu, intent, userInfo, basis);
  }

  private findMostSimilarMenu(
    inputMenuName: string,
    menus: MenuEntity[],
  ): MenuEntity {
    return menus
      .map((menu) => ({
        menu,
        similarity: this.calculateMenuSimilarity(inputMenuName, menu),
      }))
      .sort((a, b) => b.similarity - a.similarity)[0].menu;
  }

  private calculateMenuSimilarity(
    inputMenuName: string,
    menu: MenuEntity,
  ): number {
    const input = this.normalizeComparableText(inputMenuName);
    const menuName = this.normalizeComparableText(menu.name);
    const searchable = this.normalizeComparableText(
      `${menu.name} ${menu.brand ?? ''} ${menu.category ?? ''}`,
    );

    if (!input) {
      return 0;
    }

    if (menuName === input) {
      return 100;
    }

    if (menuName.includes(input) || input.includes(menuName)) {
      return 82;
    }

    if (searchable.includes(input)) {
      return 72;
    }

    const inputTokens = new Set(input.split(/\s+/).filter(Boolean));
    const menuTokens = new Set(searchable.split(/\s+/).filter(Boolean));
    const overlapCount = Array.from(inputTokens).filter((token) =>
      menuTokens.has(token),
    ).length;

    return inputTokens.size > 0 ? (overlapCount / inputTokens.size) * 60 : 0;
  }

  private normalizeComparableText(value: string): string {
    return value
      .toLowerCase()
      .replace(/[^\w가-힣\s]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  }

  private buildKeywordsFromCandidates(
    candidates: MenuRecognitionCandidate[],
  ): string[] {
    return Array.from(
      new Set(
        candidates
          .flatMap((candidate) => [
            candidate.name,
            candidate.brand ?? '',
            candidate.category ?? '',
          ])
          .map((value) => value.trim())
          .filter((value) => value.length >= 2),
      ),
    ).slice(0, 8);
  }

  private inferDominantValue(
    values: Array<string | null | undefined>,
  ): string | null {
    const counts = new Map<string, number>();

    values
      .filter(
        (value): value is string =>
          typeof value === 'string' && value.trim().length > 0,
      )
      .forEach((value) => {
        const normalized = value.trim();
        counts.set(normalized, (counts.get(normalized) ?? 0) + 1);
      });

    const [bestMatch] = Array.from(counts.entries()).sort(
      (a, b) => b[1] - a[1],
    );
    return bestMatch?.[0] ?? null;
  }

  private toRecognizedCandidateResponse(
    candidate: MenuRecognitionCandidate,
  ): ChatRecognizedCandidateResponseDto {
    const response = new ChatRecognizedCandidateResponseDto();
    response.menu_id = candidate.id;
    response.menu = candidate.name;
    response.brand = candidate.brand;
    response.category = candidate.category;
    return response;
  }

  private async classifyChatWithGemini(
    input: string,
  ): Promise<ChatClassification> {
    const prompt = `
사용자 입력을 채팅 카테고리로 분류하고 JSON object만 반환해.

분류 규칙:
- recommendation: 사용자가 메뉴를 추천해 달라고 요청하는 경우
- feedback: 사용자가 이미 먹었거나 먹으려는 메뉴/식단/음식 선택이 괜찮은지 평가, 판단, 피드백, 리뷰를 요청하는 경우
- feedback일 때는 입력에 언급된 메뉴명/음식명을 menu_names에 넣어
- recommendation일 때도 명확한 메뉴명이 있으면 menu_names에 넣을 수 있지만 보통 빈 배열
- 반드시 JSON object만 반환하고 마크다운, 설명, 코드펜스는 금지

예시:
"맘스터치에서 싸이버거 제외하고 메뉴 추천해줘" -> recommendation
"오늘 점심 싸이버거 먹어도 돼?" -> feedback
"싸이버거랑 콜라 먹었는데 괜찮아?" -> feedback

입력:
${input}

반환 shape:
{
  "chat_category": "recommendation",
  "menu_names": []
}
`.trim();

    const data = await this.callGeminiJson(prompt);
    const chatCategory =
      data?.chat_category === 'feedback' ? 'feedback' : 'recommendation';

    return {
      chat_category: chatCategory,
      menu_names:
        chatCategory === 'feedback'
          ? this.normalizeFreeTextArray(
              data?.menu_names,
              this.extractFeedbackMenuNamesFallback(input),
            )
          : this.normalizeFreeTextArray(data?.menu_names, []),
    };
  }

  private extractFeedbackMenuNamesFallback(input: string): string[] {
    const normalized = input
      .replace(/먹어도\s*돼|괜찮아|어때|피드백|평가|판단|먹었는데/g, ' ')
      .replace(/[^\w가-힣\s]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();

    if (!normalized) {
      return [];
    }

    return normalized
      .split(/\s*(?:랑|하고|과|와|,)\s*/)
      .map((value) => value.trim())
      .filter((value) => value.length >= 2)
      .slice(0, 5);
  }

  private async parseIntentWithGemini(
    input: string,
    userInfo: UserInfoEntity,
  ): Promise<ParsedChatIntent> {
    // Gemini 호출이 실패해도 서비스가 동작하도록 규칙 기반 fallback 스키마를 먼저 준비합니다.
    const fallback = this.buildFallbackIntent(input);
    const apiKey = process.env.GEMINI_API_KEY;

    if (!apiKey) {
      console.log('[CHAT] GEMINI ENV CHECK', {
        GEMINI_API_KEY: this.maskSecret(process.env.GEMINI_API_KEY),
      });
      throw new ServiceUnavailableException('GEMINI_API_KEY is not configured');
    }

    const prompt = `
사용자 요청을 메뉴 추천 알고리즘용 JSON 스키마로 정규화해줘.
반드시 JSON만 반환하고 코드펜스는 쓰지 마.

허용 규칙:
- meal_time: 0(아침), 1(점심), 2(저녁), 3(간식), 4(야식), 불명확하면 null
- desired_brand, desired_category: 문자열 또는 null
- nutrition_focus: 다음 값만 사용 ["high_protein","high_fat","low_carb","low_sugar","light_meal","hearty_meal"]
- amount_preference: "light" | "regular" | "hearty" | null
- keywords: 추천 검색에 도움이 되는 핵심 키워드 배열
- normalized_request: 사용자의 의도를 한 문장으로 정리
- include: 반드시 포함해야 하는 조건. "샐러드만", "버거 중에서", "싸이버거로" 같은 조건
- exclude: 반드시 제외해야 하는 조건. "싸이버거 제외", "음료 빼고", "치킨 말고" 같은 조건
- nutrition_constraints: 명확한 수치 조건만 넣고, "낮은/많은"처럼 수치가 없으면 null
- caffeine_allowed: "카페인 없는", "디카페인", "카페인 빼고"는 false, 명확하지 않으면 null

사용자 프로필:
goal=${this.goalToLabel(userInfo.goal)}
target_calories=${userInfo.target_calories}
target_ratio=${JSON.stringify(this.normalizeTargetRatio(userInfo.target_ratio))}

입력 문장:
${input}

JSON shape:
{
  "normalized_request": "string",
  "meal_time": 0,
  "desired_brand": null,
  "desired_category": null,
  "nutrition_focus": [],
  "amount_preference": "regular",
  "keywords": [],
  "include": {
    "brands": [],
    "categories": [],
    "menu_names": [],
    "keywords": []
  },
  "exclude": {
    "brands": [],
    "categories": [],
    "menu_names": [],
    "keywords": []
  },
  "nutrition_constraints": {
    "max_calories": null,
    "min_calories": null,
    "min_protein": null,
    "max_carbs": null,
    "max_sugars": null,
    "max_fat": null,
    "max_sodium": null,
    "caffeine_allowed": null
  }
}
`;

    try {
      const data = await this.callGeminiJson(prompt);
      return {
        normalized_request:
          this.asNonEmptyString(data.normalized_request) ??
          fallback.normalized_request,
        meal_time:
          typeof data.meal_time === 'number' &&
          data.meal_time >= 0 &&
          data.meal_time <= 4
            ? data.meal_time
            : fallback.meal_time,
        desired_brand:
          this.asNonEmptyString(data.desired_brand) ?? fallback.desired_brand,
        desired_category:
          this.asNonEmptyString(data.desired_category) ??
          fallback.desired_category,
        nutrition_focus: this.normalizeStringArray(
          data.nutrition_focus,
          [
            'high_protein',
            'high_fat',
            'low_carb',
            'low_sugar',
            'light_meal',
            'hearty_meal',
          ],
          fallback.nutrition_focus,
        ),
        amount_preference:
          this.normalizeAmountPreference(data.amount_preference) ??
          fallback.amount_preference,
        keywords: this.normalizeKeywordArray(data.keywords, fallback.keywords),
        include: this.normalizeIntentConditionGroup(
          data.include,
          fallback.include,
        ),
        exclude: this.normalizeIntentConditionGroup(
          data.exclude,
          fallback.exclude,
        ),
        nutrition_constraints: this.normalizeNutritionConstraints(
          data.nutrition_constraints,
          fallback.nutrition_constraints,
        ),
      };
    } catch (error) {
      if (error instanceof ServiceUnavailableException) {
        throw error;
      }

      return fallback;
    }
  }

  private buildFallbackIntent(input: string): ParsedChatIntent {
    const normalizedInput = input.trim();
    const lowerInput = normalizedInput.toLowerCase();
    const meal_time = normalizedInput.includes('아침')
      ? 0
      : normalizedInput.includes('점심')
        ? 1
        : normalizedInput.includes('저녁')
          ? 2
          : normalizedInput.includes('간식')
            ? 3
            : normalizedInput.includes('야식')
              ? 4
              : null;

    const nutrition_focus: string[] = [];
    if (normalizedInput.includes('단백질')) {
      nutrition_focus.push('high_protein');
    }
    if (normalizedInput.includes('고지방')) {
      nutrition_focus.push('high_fat');
    }
    if (
      normalizedInput.includes('저탄수') ||
      normalizedInput.includes('로우카브')
    ) {
      nutrition_focus.push('low_carb');
    }
    if (normalizedInput.includes('저당') || normalizedInput.includes('당')) {
      nutrition_focus.push('low_sugar');
    }
    if (normalizedInput.includes('간단') || normalizedInput.includes('가볍')) {
      nutrition_focus.push('light_meal');
    }
    if (normalizedInput.includes('든든') || normalizedInput.includes('포만')) {
      nutrition_focus.push('hearty_meal');
    }

    const include = this.extractFallbackIncludeConditions(normalizedInput);
    const exclude = this.extractFallbackExcludeConditions(normalizedInput);
    const nutritionConstraints =
      this.extractFallbackNutritionConstraints(normalizedInput);

    return {
      normalized_request: normalizedInput,
      meal_time,
      desired_brand: this.extractBrandKeyword(normalizedInput),
      desired_category: this.extractCategoryKeyword(normalizedInput),
      nutrition_focus,
      amount_preference:
        lowerInput.includes('간단') || lowerInput.includes('가볍')
          ? 'light'
          : lowerInput.includes('든든') || lowerInput.includes('포만')
            ? 'hearty'
            : 'regular',
      keywords: normalizedInput
        .split(/\s+/)
        .map((token) => token.replace(/[^\w가-힣]/g, ''))
        .filter((token) => token.length >= 2)
        .slice(0, 6),
      include,
      exclude,
      nutrition_constraints: nutritionConstraints,
    };
  }

  private extractFallbackIncludeConditions(
    input: string,
  ): IntentConditionGroup {
    const include = this.emptyIntentConditionGroup();
    const includedTerms = Array.from(
      input.matchAll(/([가-힣A-Za-z0-9]+)\s*(?:만|중에서|위주|로)/g),
    )
      .map((match) => match[1]?.trim())
      .filter((term): term is string => !!term && term.length >= 2);

    includedTerms.forEach((term) => {
      const brand = this.extractBrandKeyword(term);
      const category = this.extractCategoryKeyword(term);

      if (brand) {
        include.brands.push(brand);
        return;
      }

      if (category) {
        include.categories.push(category);
        return;
      }

      include.keywords.push(term);
    });

    return include;
  }

  private extractFallbackExcludeConditions(
    input: string,
  ): IntentConditionGroup {
    const exclude = this.emptyIntentConditionGroup();
    const excludedTerms = Array.from(
      input.matchAll(/([가-힣A-Za-z0-9]+)\s*(?:제외|빼고|말고)/g),
    )
      .map((match) => match[1]?.trim())
      .filter((term): term is string => !!term && term.length >= 2);

    excludedTerms.forEach((term) => {
      const brand = this.extractBrandKeyword(term);
      const category = this.extractCategoryKeyword(term);

      if (brand) {
        exclude.brands.push(brand);
        return;
      }

      if (category) {
        exclude.categories.push(category);
        return;
      }

      exclude.menu_names.push(term);
    });

    if (
      input.includes('카페인') &&
      (input.includes('제외') ||
        input.includes('빼고') ||
        input.includes('없는') ||
        input.includes('디카페인'))
    ) {
      exclude.keywords.push('카페인');
    }

    return exclude;
  }

  private extractFallbackNutritionConstraints(
    input: string,
  ): NutritionConstraints {
    const constraints = this.emptyNutritionConstraints();
    const caloriesMatch = input.match(/(\d+(?:\.\d+)?)\s*(?:kcal|칼로리)/i);
    const proteinMatch = input.match(/단백질\s*(\d+(?:\.\d+)?)\s*g?\s*이상/);
    const carbsMatch = input.match(/탄수화물\s*(\d+(?:\.\d+)?)\s*g?\s*이하/);
    const sugarsMatch = input.match(/당류?\s*(\d+(?:\.\d+)?)\s*g?\s*이하/);
    const fatMatch = input.match(/지방\s*(\d+(?:\.\d+)?)\s*g?\s*이하/);
    const sodiumMatch = input.match(/나트륨\s*(\d+(?:\.\d+)?)\s*mg?\s*이하/);

    if (caloriesMatch) {
      const calories = Number(caloriesMatch[1]);

      if (Number.isFinite(calories)) {
        if (input.includes('이상')) {
          constraints.min_calories = calories;
        } else {
          constraints.max_calories = calories;
        }
      }
    }

    if (proteinMatch) {
      constraints.min_protein = Number(proteinMatch[1]);
    }

    if (carbsMatch) {
      constraints.max_carbs = Number(carbsMatch[1]);
    }

    if (sugarsMatch) {
      constraints.max_sugars = Number(sugarsMatch[1]);
    }

    if (fatMatch) {
      constraints.max_fat = Number(fatMatch[1]);
    }

    if (sodiumMatch) {
      constraints.max_sodium = Number(sodiumMatch[1]);
    }

    if (
      input.includes('카페인') &&
      (input.includes('없는') ||
        input.includes('빼고') ||
        input.includes('제외') ||
        input.includes('디카페인'))
    ) {
      constraints.caffeine_allowed = false;
    }

    return constraints;
  }

  private extractBrandKeyword(input: string): string | null {
    const knownBrands = [
      '맘스터치',
      '서브웨이',
      '맥도날드',
      '버거킹',
      '롯데리아',
    ];
    return knownBrands.find((brand) => input.includes(brand)) ?? null;
  }

  private extractCategoryKeyword(input: string): string | null {
    const knownCategories = [
      '샌드위치',
      '버거',
      '도시락',
      '샐러드',
      '치킨',
      '라면',
    ];
    return knownCategories.find((category) => input.includes(category)) ?? null;
  }

  private inferMealTimeFromClock(now: Date): number {
    // 자연어에 시간대가 없으면 현재 시각으로 끼니를 추정합니다.
    const hour = now.getHours();
    if (hour < 10) {
      return 0;
    }
    if (hour < 15) {
      return 1;
    }
    if (hour < 20) {
      return 2;
    }
    if (hour < 23) {
      return 3;
    }
    return 4;
  }

  private toParsedRequestResponse(
    originalInput: string,
    intent: ParsedChatIntent,
  ): ChatParsedRequestResponseDto {
    const response = new ChatParsedRequestResponseDto();
    response.original_input = originalInput;
    response.normalized_request = intent.normalized_request;
    response.meal_time = intent.meal_time ?? 1;
    response.meal_time_label = this.mealTimeLabelMap[response.meal_time];
    response.desired_brand = intent.desired_brand ?? null;
    response.desired_category = intent.desired_category ?? null;
    response.nutrition_focus = intent.nutrition_focus;
    response.amount_preference = intent.amount_preference ?? null;
    response.keywords = intent.keywords;
    return response;
  }

  private toRecommendationBasisResponse(
    userInfo: UserInfoEntity,
    dailyNutrition: DailyNutrition,
    basis: ReturnType<ChatService['buildRecommendationBasis']>,
  ): ChatRecommendationBasisResponseDto {
    const response = new ChatRecommendationBasisResponseDto();
    response.goal = this.goalToLabel(userInfo.goal);
    response.target_calories = userInfo.target_calories;
    response.target_ratio = basis.targetRatio;
    response.consumed_calories = roundToOneDecimal(dailyNutrition.calories);
    response.consumed_macros = [
      roundToOneDecimal(dailyNutrition.carbs),
      roundToOneDecimal(dailyNutrition.protein),
      roundToOneDecimal(dailyNutrition.fat),
    ];
    response.remaining_calories = roundToOneDecimal(basis.remainingCalories);
    response.remaining_macros = [
      roundToOneDecimal(basis.remainingMacros.carbs),
      roundToOneDecimal(basis.remainingMacros.protein),
      roundToOneDecimal(basis.remainingMacros.fat),
    ];
    response.target_meal_calories = roundToOneDecimal(basis.targetMealCalories);
    return response;
  }

  private goalToLabel(goal: number): string {
    switch (goal) {
      case 0:
        return '감량';
      case 2:
        return '증량';
      default:
        return '유지';
    }
  }

  private async generateDescriptionsWithGemini(
    originalInput: string,
    intent: ParsedChatIntent,
    basis: ReturnType<ChatService['buildRecommendationBasis']>,
    rankedMenus: RankedMenu[],
  ): Promise<GeminiDescription[]> {
    // 상위 랭킹 결과를 사용자에게 바로 보여줄 문장으로 다듬는 단계입니다.
    const apiKey = process.env.GEMINI_API_KEY;

    if (!apiKey) {
      console.log('[CHAT] GEMINI ENV CHECK', {
        GEMINI_API_KEY: this.maskSecret(process.env.GEMINI_API_KEY),
      });
      throw new ServiceUnavailableException('GEMINI_API_KEY is not configured');
    }

    const menusPayload = rankedMenus.map(({ menu, score }, index) => ({
      rank: index + 1,
      menu_id: menu.id,
      menu: menu.name,
      brand: menu.brand,
      category: menu.category,
      amount: this.formatAmount(menu),
      calories: roundNullableToOneDecimal(menu.calories) ?? 0,
      carbs: roundNullableToOneDecimal(menu.carbs) ?? 0,
      protein: roundNullableToOneDecimal(menu.protein) ?? 0,
      fat: roundNullableToOneDecimal(menu.fat) ?? 0,
      sugars: roundNullableToOneDecimal(menu.sugars) ?? 0,
      local_reason: score.localReason,
    }));

    const prompt = `
아래 추천 후보 10개에 대해 사용자에게 보여줄 한국어 설명을 JSON 배열로 만들어줘.
반드시 JSON만 반환하고 코드펜스는 쓰지 마.

작성 규칙:
- one_line_summary: 메뉴당 1문장, 35자 내외
- recommendation_reason: 메뉴당 1~2문장, 과장 없이 영양/상황 적합성을 설명
- 입력된 local_reason을 참고하되 더 자연스럽게 다듬어
- rank 순서를 유지해

사용자 입력:
${originalInput}

정규화 의도:
${JSON.stringify(intent)}

추천 기준:
${JSON.stringify({
  target_ratio: basis.targetRatio,
  remaining_calories: roundToOneDecimal(basis.remainingCalories),
  remaining_macros: {
    carbs: roundToOneDecimal(basis.remainingMacros.carbs),
    protein: roundToOneDecimal(basis.remainingMacros.protein),
    fat: roundToOneDecimal(basis.remainingMacros.fat),
  },
  target_meal_calories: roundToOneDecimal(basis.targetMealCalories),
})}

후보 메뉴:
${JSON.stringify(menusPayload)}

출력 shape:
[
  {
    "menu_id": 1,
    "one_line_summary": "string",
    "recommendation_reason": "string"
  }
]
`;

    try {
      const data = await this.callGeminiJson(prompt);
      if (!Array.isArray(data)) {
        return [];
      }

      return data
        .map((item) => ({
          menu_id: Number(item.menu_id),
          one_line_summary: this.asNonEmptyString(item.one_line_summary) ?? '',
          recommendation_reason:
            this.asNonEmptyString(item.recommendation_reason) ?? '',
        }))
        .filter(
          (item) =>
            Number.isFinite(item.menu_id) &&
            item.one_line_summary.length > 0 &&
            item.recommendation_reason.length > 0,
        );
    } catch (error) {
      if (error instanceof ServiceUnavailableException) {
        throw error;
      }
      return [];
    }
  }

  private async callGeminiJson(prompt: string): Promise<any> {
    // Gemini 공통 호출부: JSON 응답 강제와 에러 변환을 한곳에서 처리합니다.
    const apiKey = process.env.GEMINI_API_KEY;
    const model = process.env.GEMINI_MODEL ?? 'gemini-2.5-flash';
    const baseUrl =
      process.env.GEMINI_BASE_URL ??
      `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`;

    if (!apiKey) {
      console.log('[CHAT] GEMINI ENV CHECK', {
        GEMINI_API_KEY: this.maskSecret(process.env.GEMINI_API_KEY),
        GEMINI_MODEL: model,
      });
      throw new ServiceUnavailableException('GEMINI_API_KEY is not configured');
    }

    console.log('[CHAT] GEMINI REQUEST', {
      GEMINI_API_KEY: this.maskSecret(apiKey),
      GEMINI_MODEL: model,
      GEMINI_BASE_URL: baseUrl,
    });

    try {
      const response = await firstValueFrom(
        this.httpService.post(
          `${baseUrl}?key=${apiKey}`,
          {
            contents: [
              {
                role: 'user',
                parts: [{ text: prompt }],
              },
            ],
            generationConfig: {
              temperature: 0.2,
              responseMimeType: 'application/json',
            },
          },
          {
            headers: {
              'Content-Type': 'application/json',
            },
            timeout: 20000,
          },
        ),
      );

      const text = response.data?.candidates?.[0]?.content?.parts
        ?.map((part) => part.text ?? '')
        .join('')
        ?.trim();

      if (!text) {
        throw new Error('Gemini returned empty content');
      }

      return JSON.parse(this.stripCodeFence(text));
    } catch (error) {
      throw new ServiceUnavailableException(
        'Gemini recommendation pipeline is unavailable',
      );
    }
  }

  private async callGeminiJsonWithImage(
    prompt: string,
    file: Express.Multer.File,
  ): Promise<any> {
    const apiKey = process.env.GEMINI_API_KEY;
    const model = process.env.GEMINI_MODEL ?? 'gemini-2.5-flash';
    const baseUrl =
      process.env.GEMINI_BASE_URL ??
      `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`;

    if (!apiKey) {
      console.log('[CHAT] GEMINI ENV CHECK', {
        GEMINI_API_KEY: this.maskSecret(process.env.GEMINI_API_KEY),
        GEMINI_MODEL: model,
      });
      throw new ServiceUnavailableException('GEMINI_API_KEY is not configured');
    }

    try {
      const response = await firstValueFrom(
        this.httpService.post(
          `${baseUrl}?key=${apiKey}`,
          {
            contents: [
              {
                role: 'user',
                parts: [
                  { text: prompt },
                  {
                    inline_data: {
                      mime_type: file.mimetype,
                      data: file.buffer.toString('base64'),
                    },
                  },
                ],
              },
            ],
            generationConfig: {
              temperature: 0.1,
              responseMimeType: 'application/json',
            },
          },
          {
            headers: {
              'Content-Type': 'application/json',
            },
            timeout: 30000,
          },
        ),
      );

      const text = response.data?.candidates?.[0]?.content?.parts
        ?.map((part) => part.text ?? '')
        .join('')
        ?.trim();

      if (!text) {
        throw new Error('Gemini returned empty content');
      }

      return JSON.parse(this.stripCodeFence(text));
    } catch (error) {
      throw new ServiceUnavailableException(
        'Gemini recommendation pipeline is unavailable',
      );
    }
  }

  private stripCodeFence(value: string): string {
    return value
      .replace(/^```json\s*/i, '')
      .replace(/^```\s*/i, '')
      .replace(/\s*```$/i, '')
      .trim();
  }

  private asNonEmptyString(value: unknown): string | null {
    return typeof value === 'string' && value.trim().length > 0
      ? value.trim()
      : null;
  }

  private asNullableNumber(value: unknown): number | null {
    if (value === null || value === undefined || value === '') {
      return null;
    }

    const parsed =
      typeof value === 'number'
        ? value
        : typeof value === 'string'
          ? Number(value.replace(/,/g, '').match(/-?\d+(?:\.\d+)?/)?.[0])
          : NaN;

    return Number.isFinite(parsed) ? parsed : null;
  }

  private emptyIntentConditionGroup(): IntentConditionGroup {
    return {
      brands: [],
      categories: [],
      menu_names: [],
      keywords: [],
    };
  }

  private emptyNutritionConstraints(): NutritionConstraints {
    return {
      max_calories: null,
      min_calories: null,
      min_protein: null,
      max_carbs: null,
      max_sugars: null,
      max_fat: null,
      max_sodium: null,
      caffeine_allowed: null,
    };
  }

  private normalizeIntentConditionGroup(
    value: unknown,
    fallback: IntentConditionGroup,
  ): IntentConditionGroup {
    if (!value || typeof value !== 'object') {
      return fallback;
    }

    const source = value as Partial<
      Record<keyof IntentConditionGroup, unknown>
    >;

    return {
      brands: this.normalizeFreeTextArray(source.brands, fallback.brands),
      categories: this.normalizeFreeTextArray(
        source.categories,
        fallback.categories,
      ),
      menu_names: this.normalizeFreeTextArray(
        source.menu_names,
        fallback.menu_names,
      ),
      keywords: this.normalizeFreeTextArray(source.keywords, fallback.keywords),
    };
  }

  private normalizeNutritionConstraints(
    value: unknown,
    fallback: NutritionConstraints,
  ): NutritionConstraints {
    if (!value || typeof value !== 'object') {
      return fallback;
    }

    const source = value as Partial<
      Record<keyof NutritionConstraints, unknown>
    >;
    const caffeineAllowed =
      typeof source.caffeine_allowed === 'boolean'
        ? source.caffeine_allowed
        : fallback.caffeine_allowed;

    return {
      max_calories:
        this.asNullableNumber(source.max_calories) ?? fallback.max_calories,
      min_calories:
        this.asNullableNumber(source.min_calories) ?? fallback.min_calories,
      min_protein:
        this.asNullableNumber(source.min_protein) ?? fallback.min_protein,
      max_carbs: this.asNullableNumber(source.max_carbs) ?? fallback.max_carbs,
      max_sugars:
        this.asNullableNumber(source.max_sugars) ?? fallback.max_sugars,
      max_fat: this.asNullableNumber(source.max_fat) ?? fallback.max_fat,
      max_sodium:
        this.asNullableNumber(source.max_sodium) ?? fallback.max_sodium,
      caffeine_allowed: caffeineAllowed,
    };
  }

  private normalizeFreeTextArray(value: unknown, fallback: string[]): string[] {
    if (!Array.isArray(value)) {
      return fallback;
    }

    const normalized = value
      .map((item) => this.asNonEmptyString(item))
      .filter((item): item is string => !!item && item.length >= 2)
      .slice(0, 10);

    return normalized.length > 0 ? Array.from(new Set(normalized)) : fallback;
  }

  private normalizeStringArray(
    value: unknown,
    allowed: string[],
    fallback: string[],
  ): string[] {
    if (!Array.isArray(value)) {
      return fallback;
    }

    const normalized = value
      .map((item) => (typeof item === 'string' ? item.trim() : ''))
      .filter((item) => allowed.includes(item));

    return normalized.length > 0 ? Array.from(new Set(normalized)) : fallback;
  }

  private normalizeKeywordArray(value: unknown, fallback: string[]): string[] {
    if (!Array.isArray(value)) {
      return fallback;
    }

    const keywords = value
      .map((item) => (typeof item === 'string' ? item.trim() : ''))
      .filter((item) => item.length >= 2)
      .slice(0, 8);

    return keywords.length > 0 ? Array.from(new Set(keywords)) : fallback;
  }

  private normalizeAmountPreference(
    value: unknown,
  ): 'light' | 'regular' | 'hearty' | null {
    if (value === 'light' || value === 'regular' || value === 'hearty') {
      return value;
    }
    return null;
  }
}
