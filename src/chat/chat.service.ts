import {
  BadRequestException,
  Injectable,
  NotFoundException,
  Optional,
  ServiceUnavailableException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { HttpService } from '@nestjs/axios';
import { firstValueFrom } from 'rxjs';
import { Brackets, Between, Repository } from 'typeorm';
import { PutObjectCommand, S3Client } from '@aws-sdk/client-s3';
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
import { ChatFoodImageFeedbackResponseDto } from './dto/response-dto/chat-food-image-feedback-response-dto';
import { ChatFoodImageRecognizedMenuResponseDto } from './dto/response-dto/chat-food-image-recognized-menu-response-dto';
import { ChatFoodImagePositionResponseDto } from './dto/response-dto/chat-food-image-position-response-dto';
import { ChatMealRecordRequestDto } from './dto/request-dto/chat-meal-record-request-dto';
import { ChatMealRecordDeleteRequestDto } from './dto/request-dto/chat-meal-record-delete-request-dto';
import { MenuVectorService } from '../vector/menu-vector.service';

const FOOD_IMAGE_RECOGNITION_FAILURE_MESSAGES = {
  LOW_IMAGE_QUALITY: 'food image quality is too low',
  FOOD_TOO_SMALL: 'food in image is too small',
  TOO_BLURRY: 'food image is too blurry',
  POOR_LIGHTING: 'food image lighting is too poor',
  FOOD_OCCLUDED: 'food is occluded or cut off',
  NO_FOOD_DETECTED: 'no food detected in image',
  NO_MATCHING_MENU: 'no recognizable menu matched candidates',
} as const;
const DEFAULT_RECOMMENDATION_MENU_NAME_PREFIX = '(식약처_음식)';
const DEFAULT_GEMINI_MODEL = 'gemini-3.1-flash-lite';
const DEFAULT_GEMINI_FALLBACK_MODELS = ['gemini-2.5-flash-lite'];
const DEFAULT_GEMINI_IMAGE_FALLBACK_MODELS = ['gemini-2.5-flash-lite'];
const GEMINI_HIGH_DEMAND_FALLBACK_MODEL = 'gemini-2.5-flash-lite';
const CHAT_RESPONSE_SYSTEM_INSTRUCTION = `
당신은 스마트하고 냉철한 식단 및 운동 코치입니다. 다음 규칙을 엄격히 준수하세요.

[역할]
- 사용자의 데이터를 기반으로 개인화된 답변을 제공하세요.
- 식단이나 운동에 관한 질문이 들어오면 전문적인 지식을 바탕으로 분석하여 명확한 가이드를 제시하세요.
- 식단/운동과 무관한 일반적인 질문이 들어오면 친절하고 센스 있게 질문 자체에 답하세요.
- 일반 질문을 억지로 건강/식단/운동 주제로 돌리지 마세요.
- 실시간 날씨, 최신 뉴스, 주가처럼 현재 조회가 필요한 정보는 실시간 조회가 어렵다고 짧게 말하고, 확인 방법이나 판단 기준만 안내하세요.
- 친구처럼 편안하지만, 신뢰가 가는 전문가의 톤을 유지하세요.

[핵심 행동 강령]
1. 극도의 간결함:
- 불필요한 인사/수식어는 생략하고 핵심 결론부터 답변하세요.
- 핵심부터 바로 말하고, 왜 그런지 이유를 덧붙이세요. 단, 근거는 길게 늘어놓지 않습니다.
- 문장은 짧게 끊어 쓰고, 문장마다 줄바꿈 처리해 가독성을 최우선으로 합니다.
2. 어투:
- 모든 답변은 친근한 반말 해체를 사용하세요. 예: "이게 더 나아.", "삶은 달걀로 가.", "조절해서 먹어.", "충분히 괜찮아."
- 범용 질문, 메뉴 추천, 메뉴 피드백 모두 같은 말투를 유지하세요.
- 존댓말, 해요체, 하십시오체를 쓰지 마세요. 예: "좋아요", "가능합니다", "추천해요" 금지.
- 딱딱한 해라체/문어체도 쓰지 마세요. 예: "~다.", "~이다.", "~한다.", "~하라." 금지.
- 문장 끝은 "~야.", "~있어.", "~해.", "~먹어.", "~가.", "~나아.", "~괜찮아."처럼 편한 반말로 마무리하세요.
3. 답변 길이 및 구조:
- 핵심 결론을 먼저 말하고, 이어서 짧은 이유나 실행 팁을 자연문으로 덧붙이세요.
- "[결론]", "[이유]", "[Action]" 같은 라벨 텍스트는 답변에 쓰지 마세요.
- 정보가 길어질 경우 무조건 불렛포인트를 사용하여 텍스트 덩어리를 분리하세요.
- 사용자가 구체적으로 길게 설명해달라고 요청하지 않는 한, 모든 답변은 3~4문장 이내로 압축하세요.
- 볼드는 핵심 결정어, 수치 데이터, 실행 Action 키워드에만 단어/구 단위로 사용하세요.
- 문장 전체를 볼드 처리하지 마세요.
`.trim();

type ChatCategory = 'feedback' | 'recommendation' | 'general';
type ChatIntroMessageSource =
  | 'text_recommendation'
  | 'text_feedback'
  | 'menu_board_recommendation'
  | 'food_image_feedback';
type FoodImageRecognitionFailureReason =
  keyof typeof FOOD_IMAGE_RECOGNITION_FAILURE_MESSAGES;

type ChatClassification = {
  chat_category: ChatCategory;
  menu_names: string[];
  context_dependent: boolean;
  context_action:
    | 'exclude_previous_recommendations'
    | 'reuse_previous_conditions'
    | 'evaluate_previous_menus'
    | null;
};

type ChatAnalysis = {
  classification: ChatClassification;
  intent: ParsedChatIntent;
};

type ChatContextSummaryItem = {
  user_input: string;
  chat_category: ChatCategory;
  intro_message: string | null;
  recommended_menu_names: string[];
  feedback_menu_names: string[];
  desired_brand: string | null;
  desired_category: string | null;
  meal_time: number | null;
};

type ChatContextSummary = {
  messages: ChatContextSummaryItem[];
  previous_user_input: string | null;
  previous_category: ChatCategory | null;
  previous_recommended_menu_names: string[];
  previous_feedback_menu_names: string[];
  previous_brand: string | null;
  previous_category_name: string | null;
  previous_meal_time: number | null;
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

type DailyMealSnapshot = {
  nutrition: DailyNutrition;
  recentMenuNames: string[];
};

type MacroAmounts = {
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

type RecognitionTextMenuMatch = {
  inputText: string;
  menu: MenuRecognitionCandidate;
};

type ComparisonMenuMatch = {
  inputMenuName: string;
  menu: MenuEntity;
};

type FoodImageCandidateGroup = {
  foodIndex: number;
  foodName: string;
  candidates: MenuRecognitionCandidate[];
};

type MenuBoardRecognitionResult = {
  recognizedTexts: string[];
  inferredBrand: string | null;
  inferredCategory: string | null;
};

type RecognitionCandidateScore = {
  menu: MenuRecognitionCandidate;
  score: number;
};

type FoodImagePosition = {
  x: number;
  y: number;
};

type FoodImageDimensions = {
  width: number;
  height: number;
};

type FoodImagePrediction = {
  foodName: string;
  confidence: number | null;
  position: FoodImagePosition;
};

type RecognizedFoodImageMenu = MenuRecognitionCandidate & {
  confidence: number | null;
  position: FoodImagePosition;
};

type GenericMenuCandidate = {
  name: string;
  rank: number;
  brand: string | null;
  category: string | null;
  reason: string | null;
};

type GenericMenuCandidatePlan = {
  candidates: GenericMenuCandidate[];
};

type GenericMenuCandidateUserContext = {
  goal: string;
  remainingCalories: number;
  remainingMacros: MacroAmounts;
  recentMenuSummary: string;
};

type ChatTimingLogger = {
  mark: (stage: string, extra?: Record<string, unknown>) => void;
  end: (extra?: Record<string, unknown>) => void;
};

@Injectable()
export class ChatService {
  private readonly mealTimeLabelMap = ['아침', '점심', '저녁', '간식', '야식'];
  private readonly mealTimeShareMap = [0.24, 0.34, 0.28, 0.08, 0.06];
  private readonly s3: S3Client;
  private readonly bucketName: string;

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
    @Optional()
    private readonly menuVectorService?: MenuVectorService,
  ) {
    this.s3 = new S3Client({
      region: process.env.AWS_REGION,
      credentials: {
        accessKeyId: process.env.AWS_ACCESS_KEY_ID,
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
      },
    });

    this.bucketName = process.env.AWS_S3_BUCKET_NAME;
  }

  private maskSecret(value?: string): string {
    return value ? `${value.slice(0, 8)}...(${value.length})` : 'NOT_SET';
  }

  private createChatTimingLogger(
    flow: string,
    base: Record<string, unknown> = {},
  ): ChatTimingLogger {
    const enabled = ['1', 'true', 'yes', 'y'].includes(
      (process.env.CHAT_TIMING_LOG_ENABLED ?? '').toLowerCase(),
    );
    const startedAt = Date.now();
    let previousAt = startedAt;

    if (!enabled) {
      return {
        mark: () => undefined,
        end: () => undefined,
      };
    }

    return {
      mark: (stage, extra = {}) => {
        const now = Date.now();
        console.log('[CHAT_TIMING]', {
          flow,
          stage,
          elapsedMs: now - startedAt,
          deltaMs: now - previousAt,
          ...base,
          ...extra,
        });
        previousAt = now;
      },
      end: (extra = {}) => {
        const now = Date.now();
        console.log('[CHAT_TIMING]', {
          flow,
          stage: 'completed',
          elapsedMs: now - startedAt,
          deltaMs: now - previousAt,
          ...base,
          ...extra,
        });
      },
    };
  }

  private logGeminiError(context: string, error: unknown): void {
    const geminiError = error as {
      message?: string;
      code?: string;
      response?: {
        status?: number;
        data?: {
          error?: {
            code?: number;
            status?: string;
            message?: string;
          };
        };
      };
    };

    console.error('[CHAT] GEMINI ERROR', {
      context,
      httpStatus: geminiError.response?.status ?? null,
      errorCode: geminiError.response?.data?.error?.code ?? null,
      errorStatus: geminiError.response?.data?.error?.status ?? null,
      errorMessage:
        geminiError.response?.data?.error?.message ??
        geminiError.message ??
        null,
      networkCode: geminiError.code ?? null,
    });
  }

  private shouldRetryGeminiWithFallback(error: unknown): boolean {
    const geminiError = error as {
      code?: string;
      response?: {
        status?: number;
        data?: {
          error?: {
            status?: string;
          };
        };
      };
    };
    const httpStatus = geminiError.response?.status;
    const errorStatus = geminiError.response?.data?.error?.status;

    return (
      httpStatus === 404 ||
      httpStatus === 429 ||
      httpStatus === 500 ||
      httpStatus === 503 ||
      httpStatus === 504 ||
      errorStatus === 'NOT_FOUND' ||
      errorStatus === 'RESOURCE_EXHAUSTED' ||
      geminiError.code === 'ECONNABORTED'
    );
  }

  private buildGeminiBaseUrl(model: string, baseUrlOverride?: string): string {
    return (
      baseUrlOverride ??
      `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`
    );
  }

  async recommend(
    user: UserEntity,
    chatRecommendRequestDto: ChatRecommendRequestDto,
  ): Promise<ChatRecommendResponseDto> {
    const input = chatRecommendRequestDto.input?.trim();

    if (!input) {
      throw new BadRequestException('input must not be empty');
    }

    const timing = this.createChatTimingLogger('recommend', {
      userId: user.id,
      inputLength: input.length,
    });
    const userInfo = await this.getRequiredUserInfo(user.id);
    timing.mark('user_info_loaded');
    const chatContext = await this.getRecentChatContext(user.id);
    timing.mark('chat_context_loaded');
    const analysis = await this.analyzeChatWithGemini(
      input,
      userInfo,
      chatContext,
    );
    timing.mark('gemini_analyze_completed', {
      chatCategory: analysis.classification.chat_category,
    });
    const classification = analysis.classification;
    if (classification.chat_category === 'feedback') {
      return await this.feedback(
        user,
        userInfo,
        input,
        this.applyChatContextToClassification(classification, chatContext),
      );
    }

    if (classification.chat_category === 'general') {
      return await this.answerGeneralQuestion(user, userInfo, input);
    }

    const parsedIntent = analysis.intent;
    const mealTime =
      parsedIntent.meal_time ?? this.inferMealTimeFromClock(new Date());
    const finalizedIntent = this.applyChatContextToIntent(
      {
        ...parsedIntent,
        meal_time: mealTime,
      },
      chatContext,
      classification,
    );
    const candidateResult = await this.getCandidateMenus(
      user.id,
      userInfo,
      finalizedIntent,
      input,
      timing,
    );
    const candidateMenus = candidateResult.menus;
    timing.mark('candidate_menus_loaded', {
      candidateCount: candidateMenus.length,
    });

    const response = await this.recommendWithPreparedContext({
      user,
      userInfo,
      input,
      intent: candidateResult.intent,
      candidateMenus,
      chatContext,
      timing,
      preparedIntroMessage: candidateResult.introMessage,
    });
    timing.end({
      recommendationCount: response.recommendations?.length ?? 0,
    });

    return response;
  }

  async recommendFromMenuBoard(
    user: UserEntity,
    file: Express.Multer.File,
  ): Promise<ChatMenuBoardRecommendResponseDto> {
    const timing = this.createChatTimingLogger('menu_board', {
      userId: user.id,
      fileSize: file?.size ?? 0,
      mimeType: file?.mimetype ?? null,
    });

    if (!file) {
      throw new BadRequestException('image file is required');
    }

    if (!file.mimetype?.startsWith('image/')) {
      throw new BadRequestException('image file must be an image');
    }

    const userInfo = await this.getRequiredUserInfo(user.id);
    timing.mark('user_info_loaded');
    const availableMenus = await this.getAvailableMenuRecognitionCandidates(
      user.id,
    );
    timing.mark('recognition_candidates_loaded', {
      availableMenuCount: availableMenus.length,
    });

    if (availableMenus.length === 0) {
      throw new BadRequestException('No menus available for recommendation');
    }

    const recognizedCandidates =
      await this.recognizeMenuBoardCandidatesWithGemini(
        user.id,
        file,
        availableMenus,
        timing,
      );
    const candidateIds = recognizedCandidates.map((candidate) => candidate.id);
    timing.mark('menu_board_recognition_completed', {
      recognizedCandidateCount: recognizedCandidates.length,
    });

    if (candidateIds.length === 0) {
      throw new BadRequestException(
        'No recognized menus matched the available menu list',
      );
    }

    const candidateMenus = await this.menuRepository.find({
      where: candidateIds.map((id) => ({ id, is_deleted: 0 })),
      relations: { user: true },
    });
    timing.mark('recognized_menu_details_loaded', {
      menuCount: candidateMenus.length,
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
    const imageUrl = await this.uploadChatImage(user, file, 'menu-board');
    timing.mark('image_uploaded');

    const response = (await this.recommendWithPreparedContext({
      user,
      userInfo,
      input: '메뉴판 사진 기반 추천',
      intent,
      candidateMenus: orderedCandidateMenus,
      recognizedCandidates,
      imageUrl,
      introSource: 'menu_board_recommendation',
      timing,
    })) as ChatMenuBoardRecommendResponseDto;
    timing.end({
      recommendationCount: response.recommendations?.length ?? 0,
    });

    return response;
  }

  async feedbackFromFoodImage(
    user: UserEntity,
    file: Express.Multer.File,
  ): Promise<ChatFoodImageFeedbackResponseDto> {
    const timing = this.createChatTimingLogger('food_image_feedback', {
      userId: user.id,
      fileSize: file?.size ?? 0,
      mimeType: file?.mimetype ?? null,
    });

    if (!file) {
      throw new BadRequestException('image file is required');
    }

    if (!file.mimetype?.startsWith('image/')) {
      throw new BadRequestException('image file must be an image');
    }

    const userInfo = await this.getRequiredUserInfo(user.id);
    timing.mark('user_info_loaded');
    const availableMenus = await this.getAvailableMenuRecognitionCandidates(
      user.id,
    );
    timing.mark('recognition_candidates_loaded', {
      availableMenuCount: availableMenus.length,
    });

    if (availableMenus.length === 0) {
      throw new BadRequestException('No menus available for feedback');
    }

    const recognizedFoods = await this.recognizeFoodImageMenusWithGemini(
      user.id,
      file,
      availableMenus,
      timing,
    );
    timing.mark('food_image_recognition_completed', {
      recognizedFoodCount: recognizedFoods.length,
    });
    const recognizedIds = Array.from(
      new Set(recognizedFoods.map((food) => food.id)),
    );
    const candidateMenus = await this.menuRepository.find({
      where: recognizedIds.map((id) => ({ id, is_deleted: 0 })),
      relations: { user: true },
    });
    timing.mark('recognized_menu_details_loaded', {
      menuCount: candidateMenus.length,
    });
    const menuMap = new Map(candidateMenus.map((menu) => [menu.id, menu]));
    const matchedMenus = recognizedFoods
      .map((food) => {
        const menu = menuMap.get(food.id);

        return menu
          ? {
              inputMenuName: food.name,
              menu,
            }
          : null;
      })
      .filter(
        (
          item,
        ): item is {
          inputMenuName: string;
          menu: MenuEntity;
        } => !!item,
      );

    if (matchedMenus.length === 0) {
      throw new BadRequestException(
        FOOD_IMAGE_RECOGNITION_FAILURE_MESSAGES.NO_MATCHING_MENU,
      );
    }

    const response = (await this.buildFeedbackChatResponse({
      user,
      userInfo,
      input: '음식 사진 기반 피드백',
      matchedMenus,
      introMessage:
        '사진에서 인식한 메뉴 기준으로 봤어.',
      introSource: 'food_image_feedback',
      extractedItems: recognizedFoods.map((food, index) => ({
        rank: index + 1,
        menu: food.name,
        brand: food.brand,
        category: food.category,
        confidence: food.confidence,
        position: food.position,
      })),
      skipHistorySave: true,
      timing,
    })) as ChatFoodImageFeedbackResponseDto;

    response.recognized_foods = recognizedFoods.map((food) =>
      this.toFoodImageRecognizedMenuResponse(food),
    );
    response.image_url = await this.uploadChatImage(
      user,
      file,
      'food-image-feedback',
    );
    timing.mark('image_uploaded');

    await this.chatHistoryRepository.save(
      this.chatHistoryRepository.create({
        input_text: '음식 사진 기반 피드백',
        response_payload: response as unknown as Record<string, any>,
        user,
      }),
    );
    timing.mark('history_saved');
    timing.end({
      recognizedFoodCount: response.recognized_foods?.length ?? 0,
    });

    return response;
  }

  private async recommendWithPreparedContext(params: {
    user: UserEntity;
    userInfo: UserInfoEntity;
    input: string;
    intent: ParsedChatIntent;
    candidateMenus: MenuEntity[];
    recognizedCandidates?: MenuRecognitionCandidate[];
    skipGeneratedDescriptions?: boolean;
    imageUrl?: string;
    introSource?: ChatIntroMessageSource;
    chatContext?: ChatContextSummary;
    timing?: ChatTimingLogger;
    skipIntentFiltering?: boolean;
    preparedIntroMessage?: string | null;
  }): Promise<ChatRecommendResponseDto> {
    const {
      user,
      userInfo,
      input,
      intent,
      candidateMenus,
      recognizedCandidates,
      skipGeneratedDescriptions = false,
      imageUrl,
      introSource = 'text_recommendation',
      chatContext,
      timing,
      skipIntentFiltering = false,
      preparedIntroMessage = null,
    } = params;

    const targetDate = this.resolveTargetDate();
    const dailyNutrition = await this.getDailyNutrition(user.id, targetDate);
    timing?.mark('daily_nutrition_loaded');
    const mealTime =
      intent.meal_time ?? this.inferMealTimeFromClock(new Date());
    const rankingBasis = this.buildRecommendationBasis(
      userInfo,
      dailyNutrition,
      mealTime,
      intent.amount_preference,
    );

    const shouldSkipIntentFilters =
      skipIntentFiltering || this.shouldSkipIntentFilters();
    let filteredCandidateMenus = shouldSkipIntentFilters
      ? candidateMenus
      : this.applyIntentFilters(candidateMenus, intent);
    timing?.mark('intent_filter_completed', {
      filteredCount: filteredCandidateMenus.length,
      skipped: shouldSkipIntentFilters,
    });

    if (!shouldSkipIntentFilters && filteredCandidateMenus.length === 0) {
      filteredCandidateMenus = this.applyIntentFilters(
        candidateMenus,
        this.relaxSoftIncludeConditions(intent),
      );
    }

    if (shouldSkipIntentFilters && this.hasHardNutritionConstraints(intent)) {
      filteredCandidateMenus = filteredCandidateMenus.filter((menu) =>
        this.matchesNutritionConstraints(menu, intent.nutrition_constraints),
      );
      timing?.mark('hard_nutrition_constraints_applied', {
        filteredCount: filteredCandidateMenus.length,
      });
    }

    filteredCandidateMenus = this.filterRecommendationMainMenuCandidates(
      filteredCandidateMenus,
      intent,
    );
    timing?.mark('main_menu_filter_completed', {
      filteredCount: filteredCandidateMenus.length,
      applied: this.shouldPreferMainMenuForRecommendation(intent),
    });

    if (filteredCandidateMenus.length === 0) {
      throw new BadRequestException('No menus available for recommendation');
    }

    const localRankedMenus = filteredCandidateMenus
      .map((menu) => ({
        menu,
        score: this.scoreMenu(menu, intent, userInfo, rankingBasis),
      }))
      .sort((a, b) => b.score.finalScore - a.score.finalScore)
      .slice(0, this.getGeminiRerankCandidateLimit());
    timing?.mark('score_menu_completed', {
      scoredCount: localRankedMenus.length,
    });
    let rankedMenus = await this.selectFinalRankedMenus({
      input,
      intent,
      userInfo,
      basis: rankingBasis,
      localRankedMenus,
      introSource,
      timing,
    });
    timing?.mark('final_ranked_menus_selected', {
      rankedCount: rankedMenus.length,
    });

    const fallbackIntro = this.buildRecommendationIntroFallback({
      source: introSource,
      input,
      intent,
      userInfo,
      rankedMenus,
    });
    const shouldUsePreparedIntro = !!preparedIntroMessage;
    let introMessage = shouldUsePreparedIntro
      ? preparedIntroMessage
      : (
          await this.generateRecommendationPresentationWithGemini({
            source: introSource,
            input,
            userInfo,
            intent,
            dailyNutrition,
            basis: rankingBasis,
            rankedMenus,
            recognizedCandidates,
            fallbackIntro,
            chatContext,
          })
        ).intro_message;
    const introAlignment = this.alignRankedMenusWithIntro(
      rankedMenus,
      intent,
      introMessage,
    );

    if (introAlignment.rankedMenus[0]?.menu.id !== rankedMenus[0]?.menu.id) {
      timing?.mark('ranked_menus_aligned_with_intro', {
        beforeTopMenuId: rankedMenus[0]?.menu.id ?? null,
        afterTopMenuId: introAlignment.rankedMenus[0]?.menu.id ?? null,
        isComparison: this.isComparisonIntent(intent),
      });
    }

    rankedMenus = introAlignment.rankedMenus;

    if (!shouldUsePreparedIntro && !introAlignment.hasMenuMention) {
      introMessage = this.buildRecommendationIntroFallback({
        source: introSource,
        input,
        intent,
        userInfo,
        rankedMenus,
      });
      timing?.mark('intro_replaced_with_top_menu_fallback', {
        topMenuId: rankedMenus[0]?.menu.id ?? null,
      });
    }
    timing?.mark(
      shouldUsePreparedIntro
        ? 'gemini_presentation_skipped_prepared_intro'
        : 'gemini_presentation_completed',
    );

    const response = new ChatRecommendResponseDto();
    response.chat_category = 'recommendation';
    response.intro_message = introMessage;
    if (imageUrl) {
      (response as ChatMenuBoardRecommendResponseDto).image_url = imageUrl;
    }
    response.recommendations = rankedMenus.map(({ menu, score }, index) => {
      const item = new ChatRecommendItemResponseDto();

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

    const matchedMenus = classification.menu_names.map((menuName) => ({
      inputMenuName: menuName,
      menu: this.findMostSimilarMenu(menuName, candidateMenus),
    }));

    return await this.buildFeedbackChatResponse({
      user,
      userInfo,
      input,
      matchedMenus,
      introMessage: `${this.goalToLabel(userInfo.goal)} 목표와 오늘 식사 기록 기준으로 봤어.`,
      introSource: 'text_feedback',
    });
  }

  private async buildFeedbackChatResponse(params: {
    user: UserEntity;
    userInfo: UserInfoEntity;
    input: string;
    matchedMenus: Array<{ inputMenuName: string; menu: MenuEntity }>;
    introMessage: string;
    introSource?: ChatIntroMessageSource;
    extractedItems?: unknown[];
    skipHistorySave?: boolean;
    timing?: ChatTimingLogger;
  }): Promise<ChatRecommendResponseDto> {
    const {
      user,
      userInfo,
      input,
      matchedMenus,
      introMessage,
      introSource = 'text_feedback',
      extractedItems,
      timing,
    } = params;
    const targetDate = this.resolveTargetDate();
    const dailyNutrition = await this.getDailyNutrition(user.id, targetDate);
    timing?.mark('feedback_daily_nutrition_loaded');
    const mealTime = this.inferMealTimeFromClock(new Date());
    const rankingBasis = this.buildRecommendationBasis(
      userInfo,
      dailyNutrition,
      mealTime,
      'regular',
    );
    const combinationNutrition = this.sumFeedbackNutrition(
      matchedMenus.map(({ menu }) => menu),
    );
    const combinationScore = this.scoreFeedbackCombination(
      combinationNutrition,
      userInfo,
      rankingBasis,
    );
    const feedback = new ChatFeedbackResponseDto();
    const feedbackIntent = this.buildFeedbackIntent('개별 메뉴 피드백');

    feedback.menus = matchedMenus.map(({ inputMenuName, menu }) =>
      this.toFeedbackMenuResponse(
        inputMenuName,
        menu,
        this.scoreMenu(menu, feedbackIntent, userInfo, rankingBasis),
      ),
    );
    feedback.total_calories = roundToOneDecimal(combinationNutrition.calories);
    feedback.score = roundToOneDecimal(combinationScore.finalScore);
    feedback.is_appropriate = combinationScore.finalScore >= 65;
    timing?.mark('feedback_score_completed', {
      matchedMenuCount: matchedMenus.length,
    });

    const response = new ChatRecommendResponseDto();
    response.chat_category = 'feedback';
    response.feedback = feedback;
    response.intro_message = await this.generateIntroMessageWithGemini({
      source: introSource,
      input,
      userInfo,
      dailyNutrition,
      basis: rankingBasis,
      feedback,
      matchedMenus,
      extractedItems,
      fallback: introMessage,
    });
    timing?.mark('feedback_gemini_intro_completed');

    if (!params.skipHistorySave) {
      await this.chatHistoryRepository.save(
        this.chatHistoryRepository.create({
          input_text: input,
          response_payload: response as unknown as Record<string, any>,
          user,
        }),
      );
      timing?.mark('feedback_history_saved');
    }

    return response;
  }

  private async answerGeneralQuestion(
    user: UserEntity,
    userInfo: UserInfoEntity,
    input: string,
  ): Promise<ChatRecommendResponseDto> {
    const targetDate = this.resolveTargetDate();
    const dailyNutrition = await this.getDailyNutrition(user.id, targetDate);
    const mealTime = this.inferMealTimeFromClock(new Date());
    const basis = this.buildRecommendationBasis(
      userInfo,
      dailyNutrition,
      mealTime,
      'regular',
    );
    const answer = await this.generateGeneralAnswerWithGemini({
      input,
      userInfo,
      dailyNutrition,
      basis,
    });

    const response = new ChatRecommendResponseDto();
    response.chat_category = 'general';
    response.intro_message = answer.intro_message;
    response.general_answer = answer.general_answer;

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

  private async getRecentChatContext(
    userId: number,
    limit = 5,
  ): Promise<ChatContextSummary> {
    const chatHistoryList = await this.chatHistoryRepository.find({
      where: {
        user: { id: userId },
      },
      order: {
        createdAt: 'DESC',
        id: 'DESC',
      },
      take: limit,
    });
    const messages = chatHistoryList
      .reverse()
      .map((chatHistory) => this.toChatContextSummaryItem(chatHistory))
      .filter((item): item is ChatContextSummaryItem => !!item);
    const previousMessage = messages[messages.length - 1] ?? null;

    return {
      messages,
      previous_user_input: previousMessage?.user_input ?? null,
      previous_category: previousMessage?.chat_category ?? null,
      previous_recommended_menu_names:
        previousMessage?.recommended_menu_names ?? [],
      previous_feedback_menu_names: previousMessage?.feedback_menu_names ?? [],
      previous_brand: previousMessage?.desired_brand ?? null,
      previous_category_name: previousMessage?.desired_category ?? null,
      previous_meal_time: previousMessage?.meal_time ?? null,
    };
  }

  private toChatContextSummaryItem(
    chatHistory: ChatHistoryEntity,
  ): ChatContextSummaryItem | null {
    const payload = chatHistory.response_payload as
      | ChatRecommendResponseDto
      | undefined;
    const chatCategory = payload?.chat_category;

    if (
      chatCategory !== 'recommendation' &&
      chatCategory !== 'feedback' &&
      chatCategory !== 'general'
    ) {
      return null;
    }

    const recommendedMenus =
      payload.recommendations
        ?.map((item) => item.menu_name)
        .filter((menuName): menuName is string => !!menuName)
        .slice(0, 10) ?? [];
    const feedbackMenus =
      payload.feedback?.menus
        ?.map((item) => item.menu_name)
        .filter((menuName): menuName is string => !!menuName)
        .slice(0, 10) ?? [];
    const recommendationBrands =
      payload.recommendations
        ?.map((item) => item.brand)
        .filter((brand): brand is string => !!brand) ?? [];
    const feedbackBrands =
      payload.feedback?.menus
        ?.map((item) => item.brand)
        .filter((brand): brand is string => !!brand) ?? [];

    return {
      user_input: chatHistory.input_text,
      chat_category: chatCategory,
      intro_message: payload.intro_message ?? null,
      recommended_menu_names: recommendedMenus,
      feedback_menu_names: feedbackMenus,
      desired_brand: this.inferDominantValue([
        ...recommendationBrands,
        ...feedbackBrands,
      ]),
      desired_category: null,
      meal_time: null,
    };
  }

  async recordMealFromChat(
    user: UserEntity,
    chatMealRecordRequestDto: ChatMealRecordRequestDto,
  ): Promise<void> {
    const { chat_id, time, menu_ids, menu_quantities, menu_input_modes } =
      chatMealRecordRequestDto;

    if (
      menu_ids.length !== menu_quantities.length ||
      menu_ids.length !== menu_input_modes.length
    ) {
      throw new BadRequestException(
        'menu_ids, menu_quantities and menu_input_modes must have the same length',
      );
    }

    const chatHistory = await this.chatHistoryRepository.findOne({
      where: {
        id: chat_id,
        user: { id: user.id },
      },
    });

    if (!chatHistory) {
      throw new NotFoundException('Chat history not found');
    }

    chatHistory.meal_record = {
      time,
      menu_ids,
      menu_quantities,
      menu_input_modes,
    };

    await this.chatHistoryRepository.save(chatHistory);
  }

  async deleteMealRecordFromChat(
    user: UserEntity,
    chatMealRecordDeleteRequestDto: ChatMealRecordDeleteRequestDto,
  ): Promise<void> {
    const chatHistory = await this.chatHistoryRepository.findOne({
      where: {
        id: chatMealRecordDeleteRequestDto.chat_id,
        user: { id: user.id },
      },
    });

    if (!chatHistory) {
      throw new NotFoundException('Chat history not found');
    }

    chatHistory.meal_record = null;

    await this.chatHistoryRepository.save(chatHistory);
  }

  private buildRecommendationIntroFallback(params: {
    source: ChatIntroMessageSource;
    input: string;
    intent: ParsedChatIntent;
    userInfo: UserInfoEntity;
    rankedMenus: RankedMenu[];
  }): string {
    const topMenu = params.rankedMenus[0]?.menu;
    const topMenuName = topMenu
      ? this.toIntroDisplayMenuName(topMenu.name)
      : '첫 번째 메뉴';
    const topMenuWithObjectParticle =
      this.withKoreanObjectParticle(topMenuName);
    const isImageSource =
      params.source === 'menu_board_recommendation' ||
      params.source === 'food_image_feedback';

    if (isImageSource) {
      return `**${topMenuName}** 먼저 봐.\n\n사진 후보 중 현재 목표와 오늘 섭취 흐름에 제일 무난해.`;
    }

    if (params.intent.include.menu_names.length >= 2) {
      return `비교하면 **${topMenuName}** 쪽이 더 나아.\n\n입력한 선택지 중 현재 목표와 오늘 식사 흐름에 더 맞아.`;
    }

    if (params.intent.nutrition_focus.includes('high_protein')) {
      return `**${topMenuWithObjectParticle}** 먼저 가.\n\n단백질을 챙기면서 오늘 흐름에도 부담이 덜해.`;
    }

    if (params.intent.nutrition_focus.includes('light_meal')) {
      return `**${topMenuName}** 괜찮아.\n\n가볍게 먹기 좋고 남은 섭취량을 크게 흔들지 않아.`;
    }

    if (params.intent.nutrition_focus.includes('hearty_meal')) {
      return `**${topMenuName}**으로 가.\n\n한 끼로 든든하고 포만감 균형이 좋아.`;
    }

    if (params.intent.desired_category) {
      return `${params.intent.desired_category} 중에서는 **${topMenuWithObjectParticle}** 먼저 봐.\n\n현재 목표 기준으로 제일 무난해.`;
    }

    return `지금은 **${topMenuWithObjectParticle}** 먼저 추천해.\n\n오늘 섭취 흐름과 목표 기준으로 무난해.`;
  }

  private isComparisonIntent(intent: ParsedChatIntent): boolean {
    return intent.include.menu_names.length >= 2;
  }

  private toIntroDisplayMenuName(menuName: string): string {
    let normalized = menuName
      .replace(/^\s*\((?:식약처|식약청|공공데이터)[^)]*\)\s*/g, '')
      .replace(/^\s*\[[^\]]+\]\s*/g, '')
      .replace(/\s+/g, ' ')
      .trim();

    const parentheticalMatches = Array.from(normalized.matchAll(/\(([^)]{2,20})\)/g))
      .map((match) => match[1].trim())
      .filter((value) => value.length >= 2);

    normalized = normalized
      .replace(/\([^)]*\)/g, ' ')
      .replace(/\[[^\]]*\]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();

    if (parentheticalMatches.length > 0) {
      const bestParenthetical = parentheticalMatches
        .sort((a, b) => a.length - b.length)[0];
      const compactBase = this.normalizeCompactText(normalized);
      const compactParenthetical = this.normalizeCompactText(bestParenthetical);

      if (
        compactParenthetical &&
        !compactBase.includes(compactParenthetical) &&
        compactParenthetical.length <= 8
      ) {
        normalized = bestParenthetical;
      }
    }

    const cleanupPatterns: Array<[RegExp, string]> = [
      [/^(?:바로먹는|즉석|간편|간편식|냉동|냉장|가정간편식|HMR)\s+/i, ''],
      [/^(?:대왕|옛날|전통|정통|프리미엄|오리지널|리얼)\s+/i, ''],
      [/^(?:매운양념|매콤한|매운|순한|담백한|고소한)\s+/i, ''],
      [/^(?:온면)\s+/i, ''],
      [/\s+(?:라면|면)\s+라면$/i, ' 라면'],
    ];

    cleanupPatterns.forEach(([pattern, replacement]) => {
      normalized = normalized.replace(pattern, replacement).trim();
    });

    return normalized || menuName;
  }

  private alignRankedMenusWithIntro(
    rankedMenus: RankedMenu[],
    intent: ParsedChatIntent,
    introMessage: string,
  ): { rankedMenus: RankedMenu[]; hasMenuMention: boolean } {
    if (rankedMenus.length <= 1 || !introMessage.trim()) {
      return { rankedMenus, hasMenuMention: false };
    }

    const normalizedIntro = this.normalizeCompactText(
      introMessage.replace(/[*_\[\]\n\r]/g, ' '),
    );
    const comparisonNames = intent.include.menu_names
      .map((name) => this.normalizeCompactText(name))
      .filter((name) => name.length >= 2);
    const scoredIndexes = rankedMenus
      .map((rankedMenu, index) => ({
        index,
        score: this.calculateIntroMenuMentionScore(
          normalizedIntro,
          rankedMenu.menu.name,
          comparisonNames,
        ),
      }))
      .filter((item) => item.score > 0)
      .sort((a, b) => b.score - a.score || a.index - b.index);
    const hasMenuMention = scoredIndexes.length > 0;
    const bestIndex = scoredIndexes[0]?.index ?? 0;

    if (bestIndex <= 0) {
      return { rankedMenus, hasMenuMention };
    }

    return {
      rankedMenus: [
        rankedMenus[bestIndex],
        ...rankedMenus.filter((_, index) => index !== bestIndex),
      ],
      hasMenuMention,
    };
  }

  private calculateIntroMenuMentionScore(
    normalizedIntro: string,
    menuName: string,
    comparisonNames: string[],
  ): number {
    const normalizedMenuName = this.normalizeCompactText(menuName);
    const normalizedDisplayName = this.normalizeCompactText(
      menuName.replace(/^\([^)]*\)\s*/g, ''),
    );
    const normalizedIntroDisplayName = this.normalizeCompactText(
      this.toIntroDisplayMenuName(menuName),
    );
    const aliases = Array.from(
      new Set(
        [
          normalizedIntroDisplayName,
          normalizedDisplayName,
          normalizedMenuName,
          ...comparisonNames,
        ]
          .filter((alias) => alias.length >= 2)
          .filter(
            (alias) =>
              normalizedMenuName.includes(alias) ||
              normalizedDisplayName.includes(alias) ||
              normalizedIntroDisplayName.includes(alias),
          ),
      ),
    );

    return aliases.reduce((bestScore, alias) => {
      if (!normalizedIntro.includes(alias)) {
        return bestScore;
      }

      const decisionPattern = new RegExp(
        `${this.escapeRegExp(alias)}.{0,18}(더나아|나아|추천|먼저|쪽|으로가|괜찮아)`,
      );
      const strongDecisionPattern = new RegExp(
        `${this.escapeRegExp(alias)}.{0,8}(더나아|나아|추천|먼저|쪽|으로가)`,
      );
      let score = alias.length;

      if (decisionPattern.test(normalizedIntro)) {
        score += 50;
      }
      if (strongDecisionPattern.test(normalizedIntro)) {
        score += 30;
      }

      return Math.max(bestScore, score);
    }, 0);
  }

  private escapeRegExp(value: string): string {
    return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }

  private withKoreanObjectParticle(value: string): string {
    return `${value}${this.hasKoreanFinalConsonant(value) ? '을' : '를'}`;
  }

  private hasKoreanFinalConsonant(value: string): boolean {
    const chars = Array.from(value.trim()).reverse();
    const lastMeaningfulChar = chars.find((char) => /[가-힣A-Za-z0-9]/.test(char));

    if (!lastMeaningfulChar) {
      return false;
    }

    const code = lastMeaningfulChar.charCodeAt(0);
    const hangulStart = '가'.charCodeAt(0);
    const hangulEnd = '힣'.charCodeAt(0);

    if (code < hangulStart || code > hangulEnd) {
      return false;
    }

    return (code - hangulStart) % 28 !== 0;
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
    return (await this.getDailyMealSnapshot(userId, date)).nutrition;
  }

  private async getDailyMealSnapshot(
    userId: number,
    date: Date,
  ): Promise<DailyMealSnapshot> {
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
      order: {
        date: 'DESC',
        id: 'DESC',
      },
    });

    const nutrition = meals.reduce(
      (acc, meal) => {
        meal.mealMenus.forEach((mealMenu) => {
          const quantity = mealMenu.quantity ?? 0;
          acc.calories += (mealMenu.menu.calories ?? 0) * quantity;
          acc.carbs += this.getEffectiveCarbs(mealMenu.menu) * quantity;
          acc.protein += (mealMenu.menu.protein ?? 0) * quantity;
          acc.fat += this.getEffectiveFat(mealMenu.menu) * quantity;
        });
        return acc;
      },
      { calories: 0, carbs: 0, protein: 0, fat: 0 },
    );
    const recentMenuNames = Array.from(
      new Set(
        meals
          .flatMap((meal) =>
            meal.mealMenus.map((mealMenu) => mealMenu.menu?.name?.trim()),
          )
          .filter((name): name is string => !!name),
      ),
    ).slice(0, 5);

    return {
      nutrition,
      recentMenuNames,
    };
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
    userId: number,
    file: Express.Multer.File,
    menus: MenuRecognitionCandidate[],
    timing?: ChatTimingLogger,
  ): Promise<MenuRecognitionCandidate[]> {
    const prompt = `
메뉴판 사진을 OCR로 읽고, 사진에 보이는 메뉴명 후보만 JSON object로 반환해.

규칙:
- 반드시 JSON object만 반환하고 마크다운, 설명, 코드펜스는 금지
- 메뉴판에 실제로 적힌 메뉴명만 recognized_texts에 넣어
- 가격, 원산지, 알레르기 안내, 옵션 설명, 광고 문구는 제외해
- OCR이 불확실한 문구는 제외해
- 최대 50개까지만 반환해
- 메뉴판의 브랜드나 카테고리가 보이면 inferred_brand, inferred_category에 넣고 불명확하면 null

반환 shape:
{
  "recognized_texts": ["싸이버거", "치즈버거"],
  "inferred_brand": "맘스터치",
  "inferred_category": "버거"
}
`.trim();

    const data = await this.callGeminiJsonWithImage(prompt, file);
    timing?.mark('menu_board_gemini_ocr_completed');
    const recognition = this.normalizeMenuBoardRecognition(data);
    console.log('[CHAT_MENU_BOARD_OCR]', {
      userId,
      recognizedTexts: recognition.recognizedTexts,
      recognizedTextCount: recognition.recognizedTexts.length,
      inferredBrand: recognition.inferredBrand,
      inferredCategory: recognition.inferredCategory,
    });
    timing?.mark('menu_board_ocr_normalized', {
      recognizedTextCount: recognition.recognizedTexts.length,
      inferredBrand: recognition.inferredBrand,
      inferredCategory: recognition.inferredCategory,
    });
    const matchedCandidates = await this.matchMenuBoardRecognizedTextsToDbMenus(
      userId,
      recognition,
      menus,
      timing,
    );
    timing?.mark('menu_board_one_to_one_match_completed', {
      matchedCount: matchedCandidates.length,
    });

    return matchedCandidates;
  }

  private async recognizeFoodImageMenusWithGemini(
    userId: number,
    file: Express.Multer.File,
    menus: MenuRecognitionCandidate[],
    timing?: ChatTimingLogger,
  ): Promise<RecognizedFoodImageMenu[]> {
    const prompt = `
음식 사진을 보고, 사진에 실제로 포함된 음식명을 JSON object로 반환해.

규칙:
- 반드시 JSON object만 반환하고 마크다운, 설명, 코드펜스는 금지
- 사진 속에서 같은 메뉴로 보이는 음식이 여러 개 있어도 detected_foods에는 1개만 반환해
- 같은 메뉴가 여러 개 보이면 가장 선명하거나 대표적인 1개의 위치만 반환해
- food_name에는 사진 속 음식의 가장 구체적인 이름을 넣어
- 각 음식의 position은 이미지 전체 기준 0~1 정규화 중심 좌표로 반환해
- position.x는 음식 중심의 가로 좌표야. 왼쪽 끝이 0, 오른쪽 끝이 1이야
- position.y는 음식 중심의 세로 좌표야. 위쪽 끝이 0, 아래쪽 끝이 1이야
- position은 순위나 줄 번호가 아니라 실제 음식 중심 좌표야
- 음식 중심이 이미지 아래쪽 끝에 붙어있지 않다면 position.y에 1을 쓰지 마
- 확실하지 않은 음식은 제외해
- 사진 문제로 인식이 어렵다면 아래 failure_reason 중 가장 가까운 값을 하나 선택해
- 사진 문제로 실패한 경우 recognition_status는 "failed", detected_foods는 빈 배열로 반환해
- 음식은 보이지만 이름을 특정하기 어렵다면 failure_reason은 "NO_MATCHING_MENU"로 반환해

반환 shape:
{
  "recognition_status": "recognized",
  "failure_reason": null,
  "detected_foods": [
    {
      "food_name": "싸이버거",
      "confidence": 0.86,
      "position": {
        "x": 0.29,
        "y": 0.45
      }
    }
  ]
}

failure_reason enum:
- LOW_IMAGE_QUALITY: 사진의 해상도/화질이 너무 낮음
- FOOD_TOO_SMALL: 사진에서 음식이 너무 작게 보임
- TOO_BLURRY: 사진이 흔들렸거나 초점이 맞지 않음
- POOR_LIGHTING: 사진이 너무 어둡거나 밝아 음식 구분이 어려움
- FOOD_OCCLUDED: 음식이 가려졌거나 잘려서 판단이 어려움
- NO_FOOD_DETECTED: 사진에서 음식을 찾을 수 없음
- NO_MATCHING_MENU: 음식은 보이지만 후보 메뉴와 매칭할 수 없음
`.trim();

    const data = await this.callGeminiJsonWithImage(prompt, file);
    timing?.mark('food_image_gemini_primary_completed');
    this.assertFoodImageRecognizable(data);
    const imageDimensions = this.getImageDimensions(file.buffer);
    if (imageDimensions) {
      timing?.mark('food_image_dimensions_detected', imageDimensions);
    }

    const detectedFoods: unknown[] = Array.isArray(data?.detected_foods)
      ? data.detected_foods
      : [];
    const rawFoodImagePositionLogItems = detectedFoods
      .map((value) => {
        if (!value || typeof value !== 'object') {
          return null;
        }

        const item = value as Record<string, unknown>;

        return {
          food_name: this.asNonEmptyString(item.food_name),
          confidence: this.asNullableNumber(item.confidence),
          position: item.position ?? null,
        };
      })
      .filter((item): item is {
        food_name: string | null;
        confidence: number | null;
        position: unknown;
      } => item !== null);
    console.log(
      '[CHAT] food image Gemini raw positions',
      JSON.stringify(
        {
          detectedFoods: rawFoodImagePositionLogItems,
        },
        null,
        2,
      ),
    );
    timing?.mark('food_image_gemini_raw_positions_logged', {
      detectedFoods: rawFoodImagePositionLogItems,
    });

    let predictions = detectedFoods
      .map((value) => this.normalizeFoodImagePrediction(value, imageDimensions))
      .filter((food): food is FoodImagePrediction => food !== null);
    console.log(
      '[CHAT] food image normalized positions',
      JSON.stringify(
        {
          predictions: predictions.map((prediction) => ({
            foodName: prediction.foodName,
            confidence: prediction.confidence,
            position: prediction.position,
          })),
        },
        null,
        2,
      ),
    );
    timing?.mark('food_image_normalized_positions_logged', {
      predictions: predictions.map((prediction) => ({
        foodName: prediction.foodName,
        confidence: prediction.confidence,
        position: prediction.position,
      })),
    });

    if (this.hasSuspiciousFoodImagePositions(predictions)) {
      predictions = await this.repairFoodImagePredictionPositionsWithGemini(
        file,
        predictions,
        imageDimensions,
        timing,
      );
      console.log(
        '[CHAT] food image repaired positions',
        JSON.stringify(
          {
            predictions: predictions.map((prediction) => ({
              foodName: prediction.foodName,
              confidence: prediction.confidence,
              position: prediction.position,
            })),
          },
          null,
          2,
        ),
      );
    }

    timing?.mark('food_image_predictions_normalized', {
      predictionCount: predictions.length,
    });
    const foodImageContext = {
      inferredBrand: null,
      inferredCategory: null,
    };
    const candidateGroups =
      await this.buildFoodImageCandidateGroupsByPrediction(
        userId,
        predictions,
        menus,
        foodImageContext,
        timing,
      );
    const rematchCandidatePool = this.mergeRecognitionCandidatesById(
      candidateGroups.flatMap((group) => group.candidates),
    );
    timing?.mark('food_image_candidate_groups_selected', {
      groupCount: candidateGroups.length,
      candidateCount: rematchCandidatePool.length,
      perFoodLimit: this.getFoodImagePerFoodVectorCandidateLimit(),
    });
    const rematchedFoods = await this.rematchFoodImageMenusWithGemini(
      file,
      predictions,
      candidateGroups,
      timing,
    );
    timing?.mark('food_image_gemini_rematch_completed', {
      rematchedCount: rematchedFoods.length,
    });
    const recognizedFoods =
      rematchedFoods.length > 0
        ? rematchedFoods
        : predictions
            .map((prediction) =>
              this.matchFoodImagePredictionLocally(prediction, menus),
            )
            .filter((food): food is RecognizedFoodImageMenu => food !== null);
    timing?.mark('food_image_final_match_selected', {
      recognizedFoodCount: recognizedFoods.length,
      source: rematchedFoods.length > 0 ? 'gemini_rematch' : 'local',
    });
    const uniqueRecognizedFoods =
      this.deduplicateRecognizedFoodImageMenus(recognizedFoods);

    if (uniqueRecognizedFoods.length === 0) {
      throw new BadRequestException(
        FOOD_IMAGE_RECOGNITION_FAILURE_MESSAGES.NO_MATCHING_MENU,
      );
    }

    return uniqueRecognizedFoods;
  }

  private normalizeFoodImagePrediction(
    value: unknown,
    imageDimensions: FoodImageDimensions | null = null,
  ): FoodImagePrediction | null {
    if (!value || typeof value !== 'object') {
      return null;
    }

    const item = value as Record<string, unknown>;
    const foodName = this.asNonEmptyString(item.food_name);
    const position =
      this.normalizeFoodImagePosition(item.position, imageDimensions) ??
      this.normalizeFoodImagePosition(item.bounding_box, imageDimensions) ??
      this.normalizeFoodImagePosition(item.bbox, imageDimensions);

    if (!foodName || !position) {
      return null;
    }

    const confidence = this.asNullableNumber(item.confidence);

    return {
      foodName,
      confidence:
        confidence === null ? null : this.roundNormalizedCoordinate(confidence),
      position,
    };
  }

  private hasSuspiciousFoodImagePositions(
    predictions: FoodImagePrediction[],
  ): boolean {
    if (predictions.length < 2) {
      return false;
    }

    const yValues = predictions.map((prediction) => prediction.position.y);
    const uniqueYValues = new Set(yValues);

    return (
      uniqueYValues.size === 1 &&
      (uniqueYValues.has(0) || uniqueYValues.has(1))
    );
  }

  private async repairFoodImagePredictionPositionsWithGemini(
    file: Express.Multer.File,
    predictions: FoodImagePrediction[],
    imageDimensions: FoodImageDimensions | null = null,
    timing?: ChatTimingLogger,
  ): Promise<FoodImagePrediction[]> {
    const prompt = `
음식 사진과 1차 인식 음식 목록을 보고, 각 음식의 실제 중심 좌표만 다시 계산해서 JSON object로 반환해.

규칙:
- 반드시 JSON object만 반환하고 마크다운, 설명, 코드펜스는 금지
- food_index는 입력 음식 목록의 index 값을 그대로 사용해
- position.x는 왼쪽 0, 오른쪽 1 기준의 음식 중심 좌표야
- position.y는 위쪽 0, 아래쪽 1 기준의 음식 중심 좌표야
- position은 순위, 행 번호, 라벨 위치가 아니라 사진 속 음식 자체의 중심 좌표야
- 음식 중심이 이미지 아래쪽 끝에 붙어있지 않다면 y에 1을 쓰지 마
- 확실하지 않더라도 보이는 음식의 중심을 최대한 추정해

입력 음식 목록:
${JSON.stringify(
  predictions.map((prediction, index) => ({
    index,
    food_name: prediction.foodName,
  })),
)}

반환 shape:
{
  "positions": [
    {
      "food_index": 0,
      "position": {
        "x": 0.29,
        "y": 0.45
      }
    }
  ]
}
`.trim();

    try {
      const data = await this.callGeminiJsonWithImage(prompt, file);
      const positions: unknown[] = Array.isArray(data?.positions)
        ? data.positions
        : [];
      const positionMap = new Map<number, FoodImagePosition>();

      positions.forEach((value) => {
        if (!value || typeof value !== 'object') {
          return;
        }

        const item = value as Record<string, unknown>;
        const foodIndex = this.asNullableNumber(item.food_index);
        const position = this.normalizeFoodImagePosition(
          item.position,
          imageDimensions,
        );

        if (
          foodIndex === null ||
          !Number.isInteger(foodIndex) ||
          foodIndex < 0 ||
          foodIndex >= predictions.length ||
          !position
        ) {
          return;
        }

        positionMap.set(foodIndex, position);
      });

      const repairedPredictions = predictions.map((prediction, index) => ({
        ...prediction,
        position: positionMap.get(index) ?? prediction.position,
      }));

      timing?.mark('food_image_position_repair_completed', {
        repairedCount: positionMap.size,
      });

      return repairedPredictions;
    } catch (error) {
      console.warn('[CHAT] food image position repair failed', {
        message: error instanceof Error ? error.message : String(error),
      });
      timing?.mark('food_image_position_repair_failed');

      return predictions;
    }
  }

  private matchFoodImagePredictionLocally(
    prediction: FoodImagePrediction,
    menus: MenuRecognitionCandidate[],
  ): RecognizedFoodImageMenu | null {
    const matchedMenu = this.findBestRecognitionCandidate(
      prediction.foodName,
      menus,
      null,
      null,
      55,
    );

    return matchedMenu
      ? {
          ...matchedMenu,
          confidence: prediction.confidence,
          position: prediction.position,
        }
      : null;
  }

  private normalizeMenuBoardRecognition(
    value: any,
  ): MenuBoardRecognitionResult {
    return {
      recognizedTexts: this.normalizeFreeTextArray(value?.recognized_texts, [])
        .filter((text) => text.length >= 2)
        .slice(0, 50),
      inferredBrand: this.asNonEmptyString(value?.inferred_brand),
      inferredCategory: this.asNonEmptyString(value?.inferred_category),
    };
  }

  private matchRecognitionCandidates(
    texts: string[],
    menus: MenuRecognitionCandidate[],
    context: Pick<
      MenuBoardRecognitionResult,
      'inferredBrand' | 'inferredCategory'
    >,
    limit: number,
  ): MenuRecognitionCandidate[] {
    const matchedById = new Map<number, MenuRecognitionCandidate>();

    texts.forEach((text) => {
      const matched = this.findBestRecognitionCandidate(
        text,
        menus,
        context.inferredBrand,
        context.inferredCategory,
        58,
      );

      if (matched) {
        matchedById.set(matched.id, {
          ...matched,
          brand: matched.brand ?? context.inferredBrand ?? null,
          category: matched.category ?? context.inferredCategory ?? null,
        });
      }
    });

    return Array.from(matchedById.values()).slice(0, limit);
  }

  private async getVectorRecognitionCandidates(params: {
    userId: number;
    texts: string[];
    context: Pick<MenuBoardRecognitionResult, 'inferredBrand' | 'inferredCategory'>;
    limit: number;
    timing?: ChatTimingLogger;
    timingPrefix?: string;
    disableContextFilters?: boolean;
  }): Promise<MenuRecognitionCandidate[]> {
    const timingPrefix = params.timingPrefix ?? 'recognition';
    const texts = params.texts
      .map((text) => text.trim())
      .filter((text) => text.length >= 2);

    if (
      !this.isVectorSearchEnabled() ||
      !this.menuVectorService ||
      texts.length === 0
    ) {
      params.timing?.mark(`${timingPrefix}_vector_search_skipped`, {
        textCount: texts.length,
      });
      return [];
    }

    try {
      const vectorResults = await this.menuVectorService.searchMenusByText(
        this.buildVectorRecognitionQuery(texts, params.context),
        {
          userId: params.userId,
          limit: params.limit,
          brand: params.disableContextFilters
            ? null
            : params.context.inferredBrand,
          category: params.disableContextFilters
            ? null
            : params.context.inferredCategory,
        },
      );
      params.timing?.mark(`${timingPrefix}_vector_search_completed`, {
        resultCount: vectorResults.length,
        textCount: texts.length,
      });
      const menuIds = vectorResults.map((result) => result.menuId);

      const candidates = await this.getRecognitionCandidatesByIds(
        params.userId,
        menuIds,
      );
      params.timing?.mark(`${timingPrefix}_vector_mysql_detail_loaded`, {
        candidateCount: candidates.length,
      });

      return candidates;
    } catch (error) {
      console.warn('[CHAT] vector recognition search failed, fallback to local', {
        message: error instanceof Error ? error.message : String(error),
      });
      params.timing?.mark(`${timingPrefix}_vector_search_failed`);

      return [];
    }
  }

  private async buildFoodImageCandidateGroupsByPrediction(
    userId: number,
    predictions: FoodImagePrediction[],
    menus: MenuRecognitionCandidate[],
    context: Pick<MenuBoardRecognitionResult, 'inferredBrand' | 'inferredCategory'>,
    timing?: ChatTimingLogger,
  ): Promise<FoodImageCandidateGroup[]> {
    const groups = await this.getFoodImageVectorCandidateGroupsByPrediction(
      userId,
      predictions,
      context,
      timing,
    );
    const groupMap = new Map(groups.map((group) => [group.foodIndex, group]));
    const missingPredictions = predictions
      .map((prediction, index) => ({ prediction, index }))
      .filter(({ index }) => !groupMap.has(index));

    if (missingPredictions.length > 0) {
      const localGroups = this.getFoodImageLocalCandidateGroupsByPrediction(
        missingPredictions,
        menus,
        context,
      );
      localGroups.forEach((group) => groupMap.set(group.foodIndex, group));
      timing?.mark('food_image_local_candidate_groups_completed', {
        groupCount: localGroups.length,
      });
    }

    return predictions
      .map((prediction, index) => groupMap.get(index) ?? {
        foodIndex: index,
        foodName: prediction.foodName,
        candidates: [],
      })
      .filter((group) => group.candidates.length > 0);
  }

  private async getFoodImageVectorCandidateGroupsByPrediction(
    userId: number,
    predictions: FoodImagePrediction[],
    context: Pick<MenuBoardRecognitionResult, 'inferredBrand' | 'inferredCategory'>,
    timing?: ChatTimingLogger,
  ): Promise<FoodImageCandidateGroup[]> {
    if (!this.isVectorSearchEnabled() || !this.menuVectorService) {
      timing?.mark('food_image_one_to_one_vector_groups_skipped', {
        predictionCount: predictions.length,
      });
      return [];
    }

    const menuVectorService = this.menuVectorService;
    const perFoodLimit = this.getFoodImagePerFoodVectorCandidateLimit();

    try {
      const groups = await this.mapWithConcurrency(
        predictions.map((prediction, index) => ({ prediction, index })),
        this.getFoodImageVectorMatchConcurrency(),
        async ({ prediction, index }) => {
          const vectorResults = await menuVectorService.searchMenusByText(
            this.buildSingleFoodImageMatchVectorQuery(prediction.foodName),
            {
              userId,
              limit: perFoodLimit,
            },
          );
          const menuIds = vectorResults.map((result) => result.menuId);
          const candidates = await this.getRecognitionCandidatesByIds(
            userId,
            menuIds,
          );

          return {
            foodIndex: index,
            foodName: prediction.foodName,
            candidates: this.mergeRecognitionCandidatesById(candidates).slice(
              0,
              perFoodLimit,
            ),
          };
        },
      );
      const nonEmptyGroups = groups.filter((group) => group.candidates.length > 0);
      timing?.mark('food_image_one_to_one_vector_groups_completed', {
        predictionCount: predictions.length,
        groupCount: nonEmptyGroups.length,
        perFoodLimit,
      });

      return nonEmptyGroups;
    } catch (error) {
      console.warn('[CHAT] food image one-to-one vector groups failed', {
        message: error instanceof Error ? error.message : String(error),
      });
      timing?.mark('food_image_one_to_one_vector_groups_failed', {
        predictionCount: predictions.length,
      });

      return [];
    }
  }

  private getFoodImageLocalCandidateGroupsByPrediction(
    predictionEntries: Array<{ prediction: FoodImagePrediction; index: number }>,
    menus: MenuRecognitionCandidate[],
    context: Pick<MenuBoardRecognitionResult, 'inferredBrand' | 'inferredCategory'>,
  ): FoodImageCandidateGroup[] {
    const perFoodLimit = this.getFoodImagePerFoodVectorCandidateLimit();

    return predictionEntries
      .map(({ prediction, index }) => ({
        foodIndex: index,
        foodName: prediction.foodName,
        candidates: this.findTopRecognitionCandidates(
          prediction.foodName,
          menus,
          context.inferredBrand,
          context.inferredCategory,
          perFoodLimit,
          32,
        ).map((candidate) => candidate.menu),
      }))
      .filter((group) => group.candidates.length > 0);
  }

  private buildSingleFoodImageMatchVectorQuery(foodName: string): string {
    return [
      `음식 사진에서 인식된 음식명: ${foodName}`,
      '이 음식명과 이름/의미가 가장 가까운 DB 메뉴를 찾는다.',
      '가공식품명보다 실제 음식명과 같은 메뉴를 우선한다.',
    ].join('\n');
  }

  private mergeRecognitionCandidatesById(
    menus: MenuRecognitionCandidate[],
  ): MenuRecognitionCandidate[] {
    const menuMap = new Map<number, MenuRecognitionCandidate>();

    menus.forEach((menu) => {
      if (!menuMap.has(menu.id)) {
        menuMap.set(menu.id, menu);
      }
    });

    return Array.from(menuMap.values());
  }

  private async matchMenuBoardRecognizedTextsToDbMenus(
    userId: number,
    recognition: MenuBoardRecognitionResult,
    menus: MenuRecognitionCandidate[],
    timing?: ChatTimingLogger,
  ): Promise<MenuRecognitionCandidate[]> {
    const texts = recognition.recognizedTexts
      .map((text) => text.trim())
      .filter((text) => text.length >= 2);

    if (texts.length === 0) {
      timing?.mark('menu_board_one_to_one_match_skipped', {
        textCount: texts.length,
      });
      return [];
    }

    const vectorMatches =
      await this.matchMenuBoardRecognizedTextsToDbMenusByVector(
        userId,
        texts,
        recognition,
        timing,
      );
    const vectorMatchMap = new Map(
      vectorMatches.map((match) => [
        this.normalizeCompactText(match.inputText),
        match.menu,
      ]),
    );
    const localMatches = texts
      .filter((text) => !vectorMatchMap.has(this.normalizeCompactText(text)))
      .map((text) => {
        const matchText = this.normalizeMenuBoardTextForMatching(
          text,
          recognition,
        );

        return {
          inputText: text,
          menu: this.findBestRecognitionCandidateFromTexts(
            [matchText, text],
            menus,
            recognition.inferredBrand,
            recognition.inferredCategory,
            58,
          ),
        };
      })
      .filter(
        (match): match is RecognitionTextMenuMatch => match.menu !== null,
      );
    timing?.mark('menu_board_local_one_to_one_match_completed', {
      matchedCount: localMatches.length,
    });
    const localMatchMap = new Map(
      localMatches.map((match) => [
        this.normalizeCompactText(match.inputText),
        match.menu,
      ]),
    );
    const matchedById = new Map<number, MenuRecognitionCandidate>();

    texts.forEach((text) => {
      const key = this.normalizeCompactText(text);
      const matched = vectorMatchMap.get(key) ?? localMatchMap.get(key);

      if (!matched || matchedById.has(matched.id)) {
        return;
      }

      matchedById.set(matched.id, {
        ...matched,
        brand: matched.brand ?? recognition.inferredBrand ?? null,
        category: matched.category ?? recognition.inferredCategory ?? null,
      });
    });

    return Array.from(matchedById.values()).slice(0, 30);
  }

  private async matchMenuBoardRecognizedTextsToDbMenusByVector(
    userId: number,
    texts: string[],
    recognition: MenuBoardRecognitionResult,
    timing?: ChatTimingLogger,
  ): Promise<RecognitionTextMenuMatch[]> {
    if (!this.isVectorSearchEnabled() || !this.menuVectorService) {
      timing?.mark('menu_board_one_to_one_vector_match_skipped', {
        textCount: texts.length,
      });
      return [];
    }

    const menuVectorService = this.menuVectorService;

    try {
      const matches = await this.mapWithConcurrency(
        texts,
        this.getMenuBoardVectorMatchConcurrency(),
        async (text) => {
          const matchText = this.normalizeMenuBoardTextForMatching(
            text,
            recognition,
          );
          const vectorResults = await menuVectorService.searchMenusByText(
            this.buildSingleMenuBoardMatchVectorQuery(text, recognition),
            {
              userId,
              limit: this.getMenuBoardPerTextVectorCandidateLimit(),
            },
          );
          const menuIds = vectorResults.map((result) => result.menuId);
          const candidates = await this.getRecognitionCandidatesByIds(
            userId,
            menuIds,
          );
          const matchedMenu = this.findBestRecognitionCandidateFromTexts(
            [matchText, text],
            candidates,
            recognition.inferredBrand,
            recognition.inferredCategory,
            25,
          );

          return matchedMenu ? { inputText: text, menu: matchedMenu } : null;
        },
      );
      const matched = matches.filter(
        (match): match is RecognitionTextMenuMatch => match !== null,
      );
      timing?.mark('menu_board_one_to_one_vector_match_completed', {
        textCount: texts.length,
        matchedCount: matched.length,
      });

      return matched;
    } catch (error) {
      console.warn('[CHAT] menu board one-to-one vector match failed', {
        message: error instanceof Error ? error.message : String(error),
      });
      timing?.mark('menu_board_one_to_one_vector_match_failed', {
        textCount: texts.length,
      });

      return [];
    }
  }

  private buildSingleMenuBoardMatchVectorQuery(
    text: string,
    recognition: MenuBoardRecognitionResult,
  ): string {
    const matchText = this.normalizeMenuBoardTextForMatching(text, recognition);
    const parts = [
      `메뉴판 OCR 메뉴명: ${text}`,
      matchText !== text ? `정제 메뉴명: ${matchText}` : null,
      '이 메뉴명과 이름/의미가 가장 가까운 DB 메뉴를 찾는다.',
      '매장명, 브랜드명, 세트/정식/단품 같은 판매 형태 표현보다 실제 음식명을 우선한다.',
      recognition.inferredBrand
        ? `메뉴판 추정 브랜드: ${recognition.inferredBrand}`
        : null,
      recognition.inferredCategory
        ? `메뉴판 추정 카테고리: ${recognition.inferredCategory}`
        : null,
    ];

    return parts.filter((value): value is string => !!value).join('\n');
  }

  private buildVectorRecognitionQuery(
    texts: string[],
    context: Pick<MenuBoardRecognitionResult, 'inferredBrand' | 'inferredCategory'>,
  ): string {
    const expandedTexts = this.expandRecognitionTexts(texts);
    const parts = [
      `인식된 음식/메뉴 텍스트: ${expandedTexts.join(', ')}`,
      context.inferredBrand ? `추정 브랜드: ${context.inferredBrand}` : null,
      context.inferredCategory
        ? `추정 카테고리: ${context.inferredCategory}`
        : null,
    ];

    return parts.filter((value): value is string => !!value).join('\n');
  }

  private async getRecognitionCandidatesByIds(
    userId: number,
    menuIds: number[],
  ): Promise<MenuRecognitionCandidate[]> {
    if (menuIds.length === 0) {
      return [];
    }

    const rows = await this.menuRepository
      .createQueryBuilder('menu')
      .leftJoin('menu.user', 'user')
      .select([
        'menu.id AS id',
        'menu.name AS name',
        'menu.brand AS brand',
        'menu.category AS category',
      ])
      .where('menu.id IN (:...menuIds)', { menuIds })
      .andWhere(
        new Brackets((qb) => {
          qb.where('user.id IS NULL').orWhere('user.id = :userId', { userId });
        }),
      )
      .andWhere('menu.is_deleted = :isDeleted', { isDeleted: 0 })
      .getRawMany<MenuRecognitionCandidate>();
    const candidates = rows.map((candidate) => ({
      ...candidate,
      id: Number(candidate.id),
    }));
    const candidateMap = new Map(
      candidates.map((candidate) => [candidate.id, candidate]),
    );

    return menuIds
      .map((menuId) => candidateMap.get(menuId))
      .filter((candidate): candidate is MenuRecognitionCandidate => !!candidate);
  }

  private buildRecognitionCandidatePool(
    texts: string[],
    menus: MenuRecognitionCandidate[],
    context: Pick<
      MenuBoardRecognitionResult,
      'inferredBrand' | 'inferredCategory'
    >,
    limit: number,
    perTextLimit: number,
    minScore: number,
  ): MenuRecognitionCandidate[] {
    const scoredById = new Map<number, RecognitionCandidateScore>();

    this.expandRecognitionTexts(texts).forEach((text) => {
      this.findTopRecognitionCandidates(
        text,
        menus,
        context.inferredBrand,
        context.inferredCategory,
        perTextLimit,
        minScore,
      ).forEach((candidate) => {
        const current = scoredById.get(candidate.menu.id);

        if (!current || candidate.score > current.score) {
          scoredById.set(candidate.menu.id, {
            menu: {
              ...candidate.menu,
              brand: candidate.menu.brand ?? context.inferredBrand ?? null,
              category:
                candidate.menu.category ?? context.inferredCategory ?? null,
            },
            score: candidate.score,
          });
        }
      });
    });

    return Array.from(scoredById.values())
      .sort((a, b) => b.score - a.score)
      .map(({ menu }) => menu)
      .slice(0, limit);
  }

  private expandRecognitionTexts(texts: string[]): string[] {
    const expanded = new Set<string>();

    texts.forEach((text) => {
      const normalized = text.trim();
      if (!normalized) {
        return;
      }

      expanded.add(normalized);

      const compact = this.normalizeCompactText(normalized);
      if (compact.includes('햄버거') || compact.includes('버거')) {
        expanded.add('버거');
        expanded.add(normalized.replace(/햄버거/g, '버거'));
      }
      if (compact.includes('베이컨')) {
        expanded.add('베이컨');
        expanded.add('샌드위치');
        expanded.add('서브');
        expanded.add('비엘티');
        expanded.add('BLT');
      }
      if (compact.includes('샌드위치') || compact.includes('샌드')) {
        expanded.add('샌드위치');
        expanded.add('서브');
      }
      if (
        compact.includes('감자튀김') ||
        compact.includes('프렌치프라이') ||
        compact.includes('후렌치후라이') ||
        compact.includes('프라이')
      ) {
        expanded.add('감자');
        expanded.add('프라이');
        expanded.add('후렌치후라이');
      }
      if (compact.includes('치킨')) {
        expanded.add('치킨');
      }
      if (compact.includes('샐러드')) {
        expanded.add('샐러드');
      }
      if (compact.includes('콜라') || compact.includes('음료')) {
        expanded.add('콜라');
        expanded.add('음료');
      }
    });

    return Array.from(expanded);
  }

  private isLikelyStandaloneIngredient(value: string): boolean {
    const compact = this.normalizeCompactText(value);
    return [
      '베이컨',
      '치즈',
      '토마토',
      '양상추',
      '상추',
      '양파',
      '피클',
      '소스',
      '마요네즈',
      '마요',
      '햄',
    ].includes(compact);
  }

  private async rematchMenuBoardCandidatesWithGemini(
    recognition: MenuBoardRecognitionResult,
    candidates: MenuRecognitionCandidate[],
    timing?: ChatTimingLogger,
  ): Promise<MenuRecognitionCandidate[]> {
    if (recognition.recognizedTexts.length === 0 || candidates.length === 0) {
      timing?.mark('menu_board_gemini_rematch_skipped', {
        recognizedTextCount: recognition.recognizedTexts.length,
        candidateCount: candidates.length,
      });
      return [];
    }

    const prompt = `
메뉴판 OCR 결과와 서버가 추린 후보 메뉴만 보고 최종 매칭되는 메뉴 id를 골라 JSON object로 반환해.

규칙:
- 반드시 JSON object만 반환하고 마크다운, 설명, 코드펜스는 금지
- 후보 목록에 없는 메뉴 id는 절대 반환하지 마
- OCR 텍스트와 후보 메뉴명이 같은 메뉴를 우선 선택해
- 브랜드/카테고리는 보조 정보로만 사용해
- 확실하지 않은 후보는 제외해
- candidate_menu_ids는 중복 없이 최대 30개까지만 반환해

OCR 결과:
${JSON.stringify(recognition)}

후보 메뉴:
${JSON.stringify(candidates)}

반환 shape:
{
  "candidate_menu_ids": [1, 2, 3]
}
`.trim();

    try {
      const data = await this.callGeminiJson(prompt);
      timing?.mark('menu_board_gemini_rematch_request_completed', {
        candidateCount: candidates.length,
      });
      const candidateIds: unknown[] = Array.isArray(data?.candidate_menu_ids)
        ? data.candidate_menu_ids
        : [];
      const candidateMap = new Map(candidates.map((menu) => [menu.id, menu]));

      return Array.from(
        new Set(
          candidateIds
            .map((value) => Number(value))
            .filter((id) => Number.isInteger(id) && candidateMap.has(id)),
        ),
      )
        .map((id) => candidateMap.get(id)!)
        .slice(0, 30);
    } catch {
      timing?.mark('menu_board_gemini_rematch_failed', {
        candidateCount: candidates.length,
      });
      return [];
    }
  }

  private async rematchFoodImageMenusWithGemini(
    file: Express.Multer.File,
    predictions: FoodImagePrediction[],
    candidateGroups: FoodImageCandidateGroup[],
    timing?: ChatTimingLogger,
  ): Promise<RecognizedFoodImageMenu[]> {
    if (predictions.length === 0 || candidateGroups.length === 0) {
      timing?.mark('food_image_gemini_rematch_skipped', {
        predictionCount: predictions.length,
        groupCount: candidateGroups.length,
      });
      return [];
    }
    const candidateMap = new Map<number, MenuRecognitionCandidate>();
    const candidateIdsByFoodIndex = new Map<number, Set<number>>();

    candidateGroups.forEach((group) => {
      const candidateIds = new Set<number>();
      group.candidates.forEach((candidate) => {
        candidateMap.set(candidate.id, candidate);
        candidateIds.add(candidate.id);
      });
      candidateIdsByFoodIndex.set(group.foodIndex, candidateIds);
    });

    const prompt = `
음식 사진, 1차 인식 결과, 서버가 음식별로 추린 후보 메뉴를 함께 보고 각 음식에 가장 잘 맞는 menu_id를 골라 JSON object로 반환해.

규칙:
- 반드시 JSON object만 반환하고 마크다운, 설명, 코드펜스는 금지
- food_index는 입력 detected_foods의 index 값을 그대로 사용해
- 각 food_index는 자기 candidate_menus 안에 있는 menu_id 중에서만 골라
- 다른 food_index의 후보 menu_id를 가져와서 쓰지 마
- 후보 목록에 없는 메뉴 id는 절대 반환하지 마
- 음식 사진의 시각 정보, 1차 food_name, 해당 food_index의 후보 메뉴명/브랜드/카테고리를 함께 비교해
- 한 음식에 확실히 맞는 후보가 없으면 그 음식은 제외해
- 같은 메뉴가 여러 음식에 보이면 가장 대표적인 food_index 하나만 같은 menu_id에 매칭해

detected_foods:
${JSON.stringify(
  predictions.map((prediction, index) => ({
    index,
    food_name: prediction.foodName,
    confidence: prediction.confidence,
  })),
)}

음식별 후보 메뉴:
${JSON.stringify(
  candidateGroups.map((group) => ({
    food_index: group.foodIndex,
    food_name: group.foodName,
    candidate_menus: group.candidates,
  })),
)}

반환 shape:
{
  "detected_foods": [
    {
      "food_index": 0,
      "menu_id": 1,
      "confidence": 0.86
    }
  ]
}
`.trim();

    try {
      const data = await this.callGeminiJsonWithImage(prompt, file);
      timing?.mark('food_image_gemini_rematch_request_completed', {
        predictionCount: predictions.length,
        groupCount: candidateGroups.length,
        candidateCount: candidateMap.size,
      });
      const detectedFoods: unknown[] = Array.isArray(data?.detected_foods)
        ? data.detected_foods
        : [];

      const recognizedFoods = detectedFoods
        .map((value) =>
          this.normalizeRematchedFoodImageMenu(
            value,
            predictions,
            candidateMap,
            candidateIdsByFoodIndex,
          ),
        )
        .filter((food): food is RecognizedFoodImageMenu => food !== null);

      return this.deduplicateRecognizedFoodImageMenus(recognizedFoods);
    } catch {
      timing?.mark('food_image_gemini_rematch_failed', {
        predictionCount: predictions.length,
        groupCount: candidateGroups.length,
      });
      return [];
    }
  }

  private deduplicateRecognizedFoodImageMenus(
    foods: RecognizedFoodImageMenu[],
  ): RecognizedFoodImageMenu[] {
    const foodMap = new Map<number, RecognizedFoodImageMenu>();

    foods.forEach((food) => {
      const existing = foodMap.get(food.id);

      if (!existing) {
        foodMap.set(food.id, food);
        return;
      }

      const existingConfidence = existing.confidence ?? -1;
      const currentConfidence = food.confidence ?? -1;

      if (currentConfidence > existingConfidence) {
        foodMap.set(food.id, food);
      }
    });

    return Array.from(foodMap.values());
  }

  private normalizeRematchedFoodImageMenu(
    value: unknown,
    predictions: FoodImagePrediction[],
    candidateMap: Map<number, MenuRecognitionCandidate>,
    candidateIdsByFoodIndex: Map<number, Set<number>>,
  ): RecognizedFoodImageMenu | null {
    if (!value || typeof value !== 'object') {
      return null;
    }

    const item = value as Record<string, unknown>;
    const foodIndex = this.asNullableNumber(item.food_index);
    const menuId = this.asNullableNumber(item.menu_id);

    if (
      foodIndex === null ||
      menuId === null ||
      !Number.isInteger(foodIndex) ||
      !Number.isInteger(menuId) ||
      foodIndex < 0 ||
      foodIndex >= predictions.length ||
      !candidateMap.has(menuId) ||
      !candidateIdsByFoodIndex.get(foodIndex)?.has(menuId)
    ) {
      return null;
    }

    const prediction = predictions[foodIndex];
    const matchedMenu = candidateMap.get(menuId)!;
    const confidence = this.asNullableNumber(item.confidence);

    return {
      ...matchedMenu,
      confidence:
        confidence === null
          ? prediction.confidence
          : this.roundNormalizedCoordinate(confidence),
      position: prediction.position,
    };
  }

  private findTopRecognitionCandidates(
    inputName: string,
    menus: MenuRecognitionCandidate[],
    inferredBrand: string | null,
    inferredCategory: string | null,
    limit: number,
    minScore: number,
  ): RecognitionCandidateScore[] {
    return menus
      .map((menu) => ({
        menu,
        score: this.calculateRecognitionCandidateScore(
          inputName,
          menu,
          inferredBrand,
          inferredCategory,
        ),
      }))
      .filter(({ score }) => score >= minScore)
      .sort((a, b) => b.score - a.score)
      .slice(0, limit);
  }

  private findBestRecognitionCandidate(
    inputName: string,
    menus: MenuRecognitionCandidate[],
    inferredBrand: string | null,
    inferredCategory: string | null,
    minScore: number,
  ): MenuRecognitionCandidate | null {
    const [bestMatch] = menus
      .map((menu) => ({
        menu,
        score: this.calculateRecognitionCandidateScore(
          inputName,
          menu,
          inferredBrand,
          inferredCategory,
        ),
      }))
      .sort((a, b) => b.score - a.score);

    return bestMatch && bestMatch.score >= minScore ? bestMatch.menu : null;
  }

  private findBestRecognitionCandidateFromTexts(
    inputNames: string[],
    menus: MenuRecognitionCandidate[],
    inferredBrand: string | null,
    inferredCategory: string | null,
    minScore: number,
  ): MenuRecognitionCandidate | null {
    const normalizedInputs = Array.from(
      new Set(
        inputNames
          .map((inputName) => inputName.trim())
          .filter((inputName) => inputName.length >= 2),
      ),
    );

    if (normalizedInputs.length === 0) {
      return null;
    }

    const [bestMatch] = menus
      .flatMap((menu) =>
        normalizedInputs.map((inputName) => ({
          menu,
          score: this.calculateRecognitionCandidateScore(
            inputName,
            menu,
            inferredBrand,
            inferredCategory,
          ),
        })),
      )
      .sort((a, b) => b.score - a.score);

    return bestMatch && bestMatch.score >= minScore ? bestMatch.menu : null;
  }

  private normalizeMenuBoardTextForMatching(
    text: string,
    recognition: MenuBoardRecognitionResult,
  ): string {
    const brandTokens = (recognition.inferredBrand ?? '')
      .split(/\s+/)
      .map((token) => token.trim())
      .filter((token) => token.length >= 2);
    let normalized = text.replace(/[()[\]{}]/g, ' ');

    brandTokens.forEach((token) => {
      normalized = normalized.replace(new RegExp(this.escapeRegExp(token), 'gi'), ' ');
    });

    normalized = normalized
      .replace(/\b(?:set)\b/gi, ' ')
      .replace(/(?:세트|정식|단품|메뉴|대표|추천|best)/gi, ' ')
      .replace(/\s+/g, ' ')
      .trim();

    return normalized.length >= 2 ? normalized : text.trim();
  }

  private calculateRecognitionCandidateScore(
    inputName: string,
    menu: MenuRecognitionCandidate,
    inferredBrand: string | null,
    inferredCategory: string | null,
  ): number {
    const input = this.normalizeCompactText(inputName);
    const menuName = this.normalizeCompactText(menu.name);
    const brand = this.normalizeCompactText(menu.brand ?? '');
    const category = this.normalizeCompactText(menu.category ?? '');
    const searchable = `${menuName}${brand}${category}`;

    if (!input) {
      return 0;
    }

    let score = 0;

    if (menuName === input) {
      score = 100;
    } else if (menuName.includes(input) || input.includes(menuName)) {
      score = 84;
    } else if (searchable.includes(input)) {
      score = 74;
    } else if (
      category &&
      (input.includes(category) || category.includes(input))
    ) {
      score = 68;
    } else {
      score = this.calculateCharacterDiceScore(input, menuName) * 72;
    }

    const inferredBrandText = this.normalizeCompactText(inferredBrand ?? '');
    const inferredCategoryText = this.normalizeCompactText(
      inferredCategory ?? '',
    );

    if (inferredBrandText && brand && brand.includes(inferredBrandText)) {
      score += 6;
    }
    if (
      inferredCategoryText &&
      category &&
      category.includes(inferredCategoryText)
    ) {
      score += 4;
    }

    if (
      this.isLikelyStandaloneIngredient(inputName) &&
      menuName === input &&
      !['샌드위치', '버거', '샐러드'].some((dishCategory) =>
        category.includes(dishCategory),
      )
    ) {
      score -= 45;
    }

    return Math.min(score, 100);
  }

  private normalizeCompactText(value: string): string {
    return this.normalizeComparableText(value).replace(/\s+/g, '');
  }

  private calculateCharacterDiceScore(left: string, right: string): number {
    if (left.length === 0 || right.length === 0) {
      return 0;
    }

    if (left.length === 1 || right.length === 1) {
      return left === right ? 1 : 0;
    }

    const leftBigrams = this.toBigramCounts(left);
    const rightBigrams = this.toBigramCounts(right);
    let intersection = 0;

    leftBigrams.forEach((count, bigram) => {
      intersection += Math.min(count, rightBigrams.get(bigram) ?? 0);
    });

    return (2 * intersection) / (left.length - 1 + right.length - 1);
  }

  private toBigramCounts(value: string): Map<string, number> {
    const counts = new Map<string, number>();

    for (let index = 0; index < value.length - 1; index += 1) {
      const bigram = value.slice(index, index + 2);
      counts.set(bigram, (counts.get(bigram) ?? 0) + 1);
    }

    return counts;
  }

  private getImageDimensions(buffer: Buffer): FoodImageDimensions | null {
    return this.getPngImageDimensions(buffer) ?? this.getJpegImageDimensions(buffer);
  }

  private getPngImageDimensions(buffer: Buffer): FoodImageDimensions | null {
    if (
      buffer.length < 24 ||
      buffer[0] !== 0x89 ||
      buffer[1] !== 0x50 ||
      buffer[2] !== 0x4e ||
      buffer[3] !== 0x47
    ) {
      return null;
    }

    const width = buffer.readUInt32BE(16);
    const height = buffer.readUInt32BE(20);

    return width > 0 && height > 0 ? { width, height } : null;
  }

  private getJpegImageDimensions(buffer: Buffer): FoodImageDimensions | null {
    if (buffer.length < 4 || buffer[0] !== 0xff || buffer[1] !== 0xd8) {
      return null;
    }

    let offset = 2;

    while (offset < buffer.length) {
      if (buffer[offset] !== 0xff) {
        offset += 1;
        continue;
      }

      const marker = buffer[offset + 1];
      offset += 2;

      if (marker === 0xd9 || marker === 0xda) {
        break;
      }

      if (offset + 2 > buffer.length) {
        break;
      }

      const segmentLength = buffer.readUInt16BE(offset);

      if (segmentLength < 2 || offset + segmentLength > buffer.length) {
        break;
      }

      if (this.isJpegStartOfFrameMarker(marker)) {
        if (offset + 7 > buffer.length) {
          break;
        }

        const height = buffer.readUInt16BE(offset + 3);
        const width = buffer.readUInt16BE(offset + 5);

        return width > 0 && height > 0 ? { width, height } : null;
      }

      offset += segmentLength;
    }

    return null;
  }

  private isJpegStartOfFrameMarker(marker: number): boolean {
    return (
      (marker >= 0xc0 && marker <= 0xc3) ||
      (marker >= 0xc5 && marker <= 0xc7) ||
      (marker >= 0xc9 && marker <= 0xcb) ||
      (marker >= 0xcd && marker <= 0xcf)
    );
  }

  private normalizeFoodImagePosition(
    value: unknown,
    imageDimensions: FoodImageDimensions | null = null,
  ): FoodImagePosition | null {
    if (!value || typeof value !== 'object') {
      return null;
    }

    const position = value as Record<string, unknown>;
    const x =
      this.asNullableNumber(position.x) ??
      this.asNullableNumber(position.center_x) ??
      this.asNullableNumber(position.x_center);
    const y =
      this.asNullableNumber(position.y) ??
      this.asNullableNumber(position.center_y) ??
      this.asNullableNumber(position.y_center);

    if (x !== null && y !== null) {
      return this.normalizeCoordinatePair(x, y, imageDimensions);
    }

    const xMin =
      this.asNullableNumber(position.x_min) ??
      this.asNullableNumber(position.left);
    const yMin =
      this.asNullableNumber(position.y_min) ??
      this.asNullableNumber(position.top);
    const xMax =
      this.asNullableNumber(position.x_max) ??
      this.asNullableNumber(position.right);
    const yMax =
      this.asNullableNumber(position.y_max) ??
      this.asNullableNumber(position.bottom);

    if (xMin === null || yMin === null || xMax === null || yMax === null) {
      return null;
    }

    return {
      ...this.normalizeCoordinatePair(
        (xMin + xMax) / 2,
        (yMin + yMax) / 2,
        imageDimensions,
      ),
    };
  }

  private assertFoodImageRecognizable(value: any): void {
    const failureReason = this.asFoodImageRecognitionFailureReason(
      value?.failure_reason,
    );
    const isFailed = value?.recognition_status === 'failed';

    if (!isFailed && !failureReason) {
      return;
    }

    throw new BadRequestException(
      failureReason
        ? FOOD_IMAGE_RECOGNITION_FAILURE_MESSAGES[failureReason]
        : 'food image could not be recognized',
    );
  }

  private asFoodImageRecognitionFailureReason(
    value: unknown,
  ): FoodImageRecognitionFailureReason | null {
    if (typeof value !== 'string') {
      return null;
    }

    return value in FOOD_IMAGE_RECOGNITION_FAILURE_MESSAGES
      ? (value as FoodImageRecognitionFailureReason)
      : null;
  }

  private clampNormalizedCoordinate(value: number): number {
    return this.roundNormalizedCoordinate(Math.min(Math.max(value, 0), 1));
  }

  private normalizeCoordinatePair(
    x: number,
    y: number,
    imageDimensions: FoodImageDimensions | null,
  ): FoodImagePosition {
    const looksLikeThousandScaleCoordinate =
      (Math.abs(x) > 100 || Math.abs(y) > 100) &&
      Math.abs(x) <= 1000 &&
      Math.abs(y) <= 1000;

    if (looksLikeThousandScaleCoordinate) {
      return {
        x: this.clampNormalizedCoordinate(x / 1000),
        y: this.clampNormalizedCoordinate(y / 1000),
      };
    }

    const looksLikePixelCoordinate =
      !!imageDimensions && (Math.abs(x) > 100 || Math.abs(y) > 100);

    if (looksLikePixelCoordinate) {
      return {
        x: this.clampNormalizedCoordinate(x / imageDimensions.width),
        y: this.clampNormalizedCoordinate(y / imageDimensions.height),
      };
    }

    return {
      x: this.normalizeCoordinateUnit(x),
      y: this.normalizeCoordinateUnit(y),
    };
  }

  private normalizeCoordinateUnit(value: number): number {
    const normalizedValue =
      Math.abs(value) > 1 && Math.abs(value) <= 100 ? value / 100 : value;

    return this.clampNormalizedCoordinate(normalizedValue);
  }

  private roundNormalizedCoordinate(value: number): number {
    return Math.round(value * 1000) / 1000;
  }

  private async getCandidateMenus(
    userId: number,
    userInfo: UserInfoEntity,
    intent: ParsedChatIntent,
    input: string,
    timing?: ChatTimingLogger,
  ): Promise<{
    menus: MenuEntity[];
    introMessage: string | null;
    intent: ParsedChatIntent;
  }> {
    const hasUnsupportedBrand =
      await this.hasUnsupportedBrandRecommendation(userId, intent);
    const candidateIntent = hasUnsupportedBrand
      ? this.toUnsupportedBrandGenericIntent(intent)
      : intent;
    timing?.mark('brand_support_checked', {
      hasBrandIntent: this.hasBrandIntent(intent),
      unsupported: hasUnsupportedBrand,
      brandFilters: this.getIntentBrandFilters(intent),
    });

    const geminiGeneratedResult =
      await this.getGeminiGeneratedGenericCandidateMenus(
        userId,
        userInfo,
        candidateIntent,
        input,
        hasUnsupportedBrand,
        timing,
      );
    const geminiGeneratedMenus = geminiGeneratedResult.menus;

    if (geminiGeneratedMenus.length > 0) {
      return {
        menus: geminiGeneratedMenus,
        introMessage: geminiGeneratedResult.introMessage,
        intent: candidateIntent,
      };
    }

    if (hasUnsupportedBrand) {
      return {
        menus: [],
        introMessage: null,
        intent: candidateIntent,
      };
    }

    const vectorMenus = await this.getVectorCandidateMenus(
      userId,
      intent,
      input,
      timing,
    );
    timing?.mark('vector_candidates_loaded', {
      vectorCandidateCount: vectorMenus.length,
    });

    if (vectorMenus.length >= this.getVectorSearchMinResult()) {
      return {
        menus: this.mergeMenusById(geminiGeneratedMenus, vectorMenus),
        introMessage: null,
        intent: candidateIntent,
      };
    }

    if (vectorMenus.length > 0) {
      const sqlMenus = this.filterRecommendationMainMenuCandidates(
        await this.getSqlCandidateMenus(userId, intent),
        intent,
      );
      timing?.mark('sql_fallback_candidates_loaded', {
        sqlCandidateCount: sqlMenus.length,
      });
      return {
        menus: this.mergeMenusById(geminiGeneratedMenus, vectorMenus, sqlMenus),
        introMessage: null,
        intent: candidateIntent,
      };
    }

    const sqlMenus = this.filterRecommendationMainMenuCandidates(
      await this.getSqlCandidateMenus(userId, intent),
      intent,
    );
    timing?.mark('sql_candidates_loaded', {
      sqlCandidateCount: sqlMenus.length,
    });
    return {
      menus: this.mergeMenusById(geminiGeneratedMenus, sqlMenus),
      introMessage: null,
      intent: candidateIntent,
    };
  }

  private async getVectorCandidateMenus(
    userId: number,
    intent: ParsedChatIntent,
    input: string,
    timing?: ChatTimingLogger,
  ): Promise<MenuEntity[]> {
    if (!this.isVectorSearchEnabled() || !this.menuVectorService) {
      timing?.mark('vector_search_skipped');
      return [];
    }

    try {
      const vectorResults = await this.menuVectorService.searchMenusByText(
        this.buildVectorRecommendationQuery(input, intent),
        {
          userId,
          limit: this.getVectorCandidateLimit(),
          brands: this.getVectorFilters([
            intent.desired_brand,
            ...intent.include.brands,
          ]),
          category: this.getSingleVectorFilter([
            intent.desired_category,
            ...intent.include.categories,
          ]),
          namePrefix: this.shouldUseDefaultRecommendationMenuScope(intent)
            ? DEFAULT_RECOMMENDATION_MENU_NAME_PREFIX
            : null,
          maxCalories: intent.nutrition_constraints.max_calories,
          minProtein: intent.nutrition_constraints.min_protein,
          excludeTextTerms: this.shouldPreferMainMenuForRecommendation(intent)
            ? this.getSideDrinkOrDessertMenuTerms()
            : null,
        },
      );
      timing?.mark('vector_search_completed', {
        resultCount: vectorResults.length,
      });
      const menuIds = vectorResults.map((result) => result.menuId);

      if (menuIds.length === 0) {
        return [];
      }

      const menus = await this.getMenusByIds(userId, menuIds);
      const filteredMenus = this.filterRecommendationMainMenuCandidates(
        menus,
        intent,
      );
      timing?.mark('vector_mysql_detail_loaded', {
        menuCount: filteredMenus.length,
        beforeMainMenuFilterCount: menus.length,
      });
      return filteredMenus;
    } catch (error) {
      console.warn('[CHAT] vector candidate search failed, fallback to mysql', {
        message: error instanceof Error ? error.message : String(error),
      });

      return [];
    }
  }

  private async getGeminiGeneratedGenericCandidateMenus(
    userId: number,
    userInfo: UserInfoEntity,
    intent: ParsedChatIntent,
    input: string,
    hasUnsupportedBrand: boolean,
    timing?: ChatTimingLogger,
  ): Promise<{ menus: MenuEntity[]; introMessage: string | null }> {
    if (!this.shouldUseGeminiGeneratedGenericCandidates(intent, hasUnsupportedBrand)) {
      const skipReason = this.getGeminiGeneratedGenericCandidateSkipReason(
        intent,
        hasUnsupportedBrand,
      );
      console.log('[CHAT] generic Gemini menu candidates skipped', {
        reason: skipReason,
        desiredBrand: intent.desired_brand,
        includeBrands: intent.include.brands,
        includeMenuNames: intent.include.menu_names,
      });
      timing?.mark('gemini_generic_candidates_skipped', {
        reason: skipReason,
        desiredBrand: intent.desired_brand,
        includeBrands: intent.include.brands,
        includeMenuNames: intent.include.menu_names,
      });
      return { menus: [], introMessage: null };
    }

    try {
      const userContext = await this.buildGenericMenuCandidateUserContext(
        userId,
        userInfo,
        intent,
      );
      const genericPlan =
        await this.generateGenericMenuCandidatePlanWithGemini(
          input,
          intent,
          userContext,
          timing,
        );
      timing?.mark('gemini_generic_candidates_generated', {
        generatedCount: genericPlan.candidates.length,
      });

      if (genericPlan.candidates.length === 0) {
        return {
          menus: [],
          introMessage: null,
        };
      }

      const matchedMenus =
        await this.matchGenericMenuCandidatesToDbMenusByVector(
          userId,
          genericPlan.candidates,
          intent,
        );
      timing?.mark('gemini_generic_candidates_matched', {
        matchedCount: matchedMenus.length,
      });

      return {
        menus: matchedMenus,
        introMessage: null,
      };
    } catch (error) {
      console.warn('[CHAT] Gemini generic candidate generation failed', {
        message: error instanceof Error ? error.message : String(error),
      });
      timing?.mark('gemini_generic_candidates_failed');

      return { menus: [], introMessage: null };
    }
  }

  private shouldUseGeminiGeneratedGenericCandidates(
    intent: ParsedChatIntent,
    hasUnsupportedBrand = false,
  ): boolean {
    return true;
  }

  private getGeminiGeneratedGenericCandidateSkipReason(
    intent: ParsedChatIntent,
    hasUnsupportedBrand = false,
  ): string {
    if (hasUnsupportedBrand) {
      return 'unsupported_brand_uses_generic_candidates';
    }

    if (intent.desired_brand) {
      return 'desired_brand_present';
    }

    if (intent.include.brands.length > 0) {
      return 'include_brands_present';
    }

    return 'unknown';
  }

  private async buildGenericMenuCandidateUserContext(
    userId: number,
    userInfo: UserInfoEntity,
    intent: ParsedChatIntent,
  ): Promise<GenericMenuCandidateUserContext> {
    const targetDate = this.resolveTargetDate();
    const snapshot = await this.getDailyMealSnapshot(userId, targetDate);
    const mealTime =
      intent.meal_time ?? this.inferMealTimeFromClock(new Date());
    const basis = this.buildRecommendationBasis(
      userInfo,
      snapshot.nutrition,
      mealTime,
      intent.amount_preference,
    );

    return {
      goal: this.goalToLabel(userInfo.goal),
      remainingCalories: roundToOneDecimal(basis.remainingCalories),
      remainingMacros: {
        carbs: roundToOneDecimal(basis.remainingMacros.carbs),
        protein: roundToOneDecimal(basis.remainingMacros.protein),
        fat: roundToOneDecimal(basis.remainingMacros.fat),
      },
      recentMenuSummary:
        snapshot.recentMenuNames.length > 0
          ? snapshot.recentMenuNames.join(', ')
          : '오늘 기록된 식사 없음',
    };
  }

  private async generateGenericMenuCandidatePlanWithGemini(
    input: string,
    intent: ParsedChatIntent,
    userContext: GenericMenuCandidateUserContext,
    timing?: ChatTimingLogger,
  ): Promise<GenericMenuCandidatePlan> {
    const prompt = `
메뉴 추천 요청에 대해, 사용자 정보를 고려한 랭킹 후보 메뉴를 JSON object로 만들어줘.
반드시 JSON만 반환하고 코드펜스는 쓰지 마.

작성 규칙:
- 최종 사용자 답변 문장은 만들지 마
- 각 후보는 name, brand, category, reason만 작성해
- name은 DB와 1대1 매칭하기 쉬운 실제 음식명/메뉴명으로 작성해
- brand는 사용자가 특정 브랜드/매장을 명시했고 그 후보가 그 브랜드 메뉴일 때만 넣어. 불명확하면 null
- category는 음식 카테고리나 메뉴군이 명확할 때만 넣어. 불명확하면 null
- reason은 후보를 고른 짧은 판단 근거야. 사용자에게 그대로 노출하지 않는 내부 참고용으로 40자 이내로 작성해
- DB에 없는 브랜드가 언급됐으면 그 브랜드의 메뉴 성격을 추론하되, name은 DB에서 일반 음식으로 매칭 가능한 후보명으로 만들어
- 사용자가 특정 카테고리를 말했으면 그 범위 안에서 후보를 만들어
- 사용자가 "A B C 중 어디갈까", "A, B, C 중 뭐가 나아"처럼 여러 선택지를 제시하면 반드시 그 선택지 안에서만 순위를 정해
- 선택지형 입력에서는 선택지를 다른 음식으로 바꾸거나 넓은 유사 음식으로 대체하지 마
- 예: "샤브샤브 삼겹살 중국집 중 어디갈까"는 샤브샤브, 삼겹살구이/삼겹살, 짜장면/짬뽕 같은 선택지 대표 메뉴만 후보로 써. 돼지고기 수육, 제육, 김치찌개처럼 선택지 밖 메뉴는 금지
- 예: "맥도날드 버거킹 롯데리아 중 어디갈까"는 각 브랜드의 대표 메인 메뉴 후보만 만들고, 패티/소스/음료/사이드 같은 부품 메뉴는 금지
- "가볍게", "든든하게", "배달음식", "다이어트식" 같은 맥락을 반영해
- 사용자 목표, 오늘 남은 칼로리, 남은 탄수화물/단백질/지방, 최근 먹은 메뉴 요약을 반영해
- 후보 순위는 사용자의 현재 목표와 남은 영양 흐름에 더 잘 맞는 순서로 정해
- 우리 DB와 매칭하기 쉽도록 너무 추상적인 표현 대신 실제 음식명으로 작성해
- 후보는 최대 10개
- name은 2~20자 정도의 자연스러운 한국어 음식명
- 브랜드명, 매장명, 제조사명, 편의점 제품명 자체를 음식 후보명으로 쓰지 마
- 음료, 소스, 토핑, 패티, 사이드 메뉴는 사용자가 명시적으로 요청한 경우가 아니면 후보에서 제외해
- 아래 사용자 식사 정보는 후보 생성을 위한 내부 참고 정보야
- target_meal_calories 같은 서비스 내부 계산 기준이나 "이번 끼니 목표 칼로리" 표현은 사용자에게 말하지 마

사용자 입력:
${input}

정규화 의도:
${JSON.stringify(intent)}

사용자 식사 정보:
${JSON.stringify(userContext)}

반환 shape:
{
  "menu_candidates": [
    {
      "rank": 1,
      "name": "닭가슴살 샐러드",
      "brand": null,
      "category": "샐러드",
      "reason": "단백질을 챙기기 쉬움"
    }
  ]
}
`.trim();

    const data = await this.callGeminiJson(prompt, {
      context: 'generic-menu-candidates',
      systemInstruction: CHAT_RESPONSE_SYSTEM_INSTRUCTION,
    });
    const candidates = Array.isArray(data?.menu_candidates)
      ? data.menu_candidates
      : [];
    const rawCandidateLogItems = candidates
      .map((candidate) => ({
        rank: Number(candidate?.rank),
        name: this.asNonEmptyString(candidate?.name) ?? null,
        brand: this.asNonEmptyString(candidate?.brand) ?? null,
        category: this.asNonEmptyString(candidate?.category) ?? null,
        reason: this.asNonEmptyString(candidate?.reason) ?? null,
      }))
      .filter((candidate) => candidate.name)
      .slice(0, 20);

    const normalizedCandidates = candidates
      .map((candidate) => ({
        rank: Number(candidate?.rank),
        name: this.asNonEmptyString(candidate?.name) ?? '',
        brand: this.asNonEmptyString(candidate?.brand),
        category: this.asNonEmptyString(candidate?.category),
        reason: this.asNonEmptyString(candidate?.reason),
      }))
      .filter((candidate) => candidate.name.length >= 2)
      .sort((a, b) => {
        const leftRank = Number.isFinite(a.rank) ? a.rank : Number.MAX_SAFE_INTEGER;
        const rightRank = Number.isFinite(b.rank) ? b.rank : Number.MAX_SAFE_INTEGER;

        return leftRank - rightRank;
      })
      .map((candidate, index) => ({
        name: candidate.name,
        rank: Number.isFinite(candidate.rank) ? candidate.rank : index + 1,
        brand: candidate.brand ?? null,
        category: candidate.category ?? null,
        reason: candidate.reason ?? null,
      }))
      .slice(0, this.getGeminiGenericMenuCandidateLimit());

    console.log('[CHAT] generic Gemini menu candidates generated', {
      rawCandidates: rawCandidateLogItems,
      normalizedCandidates,
    });
    timing?.mark('gemini_generic_candidate_names_logged', {
      rawCandidates: rawCandidateLogItems,
      normalizedCandidates,
    });

    return {
      candidates: normalizedCandidates,
    };
  }

  private async matchGenericMenuCandidatesToDbMenusByVector(
    userId: number,
    genericCandidates: GenericMenuCandidate[],
    intent: ParsedChatIntent,
  ): Promise<MenuEntity[]> {
    if (!this.isVectorSearchEnabled() || !this.menuVectorService) {
      return await this.matchGenericMenuCandidatesToDbMenusLocally(
        userId,
        genericCandidates,
      );
    }

    const menuVectorService = this.menuVectorService;
    const supportedCandidateBrandKeys =
      await this.getSupportedGenericCandidateBrandKeys(
        userId,
        genericCandidates,
      );
    const matchedMenus = await this.mapWithConcurrency(
      genericCandidates,
      this.getGeminiGenericMenuVectorConcurrency(),
      async (candidate) => {
        const brandFilters = this.getGenericCandidateVectorBrands(
          candidate,
          supportedCandidateBrandKeys,
        );
        const shouldUseDefaultScope =
          this.shouldUseDefaultGenericCandidateMenuScope(
            candidate,
            supportedCandidateBrandKeys,
          );
        const vectorResults = await menuVectorService.searchMenusByText(
          this.buildSingleGenericCandidateVectorQuery(candidate, intent),
          {
            userId,
            limit: this.getGeminiGenericMenuPerCandidateLimit(),
            brands: brandFilters,
            category: this.getSingleVectorFilter([
              candidate.category,
              intent.desired_category,
              ...intent.include.categories,
            ]),
            namePrefix: shouldUseDefaultScope
              ? DEFAULT_RECOMMENDATION_MENU_NAME_PREFIX
              : null,
            maxCalories: intent.nutrition_constraints.max_calories,
            minProtein: intent.nutrition_constraints.min_protein,
            excludeTextTerms: this.shouldPreferMainMenuForRecommendation(intent)
              ? this.getSideDrinkOrDessertMenuTerms()
              : null,
          },
        );
        const menuIds = vectorResults.map((result) => result.menuId);
        const vectorMenus = await this.getMenusByIds(userId, menuIds);
        const matchedMenu = this.findMostSimilarMenuAboveThreshold(
          candidate.name,
          vectorMenus,
          25,
        );

        return matchedMenu;
      },
    );

    return this.mergeMenusById(
      matchedMenus.filter((menu): menu is MenuEntity => !!menu),
    ).slice(
      0,
      this.getGeminiGenericMenuMatchedMenuLimit(),
    );
  }

  private getGenericCandidateVectorBrands(
    candidate: GenericMenuCandidate,
    supportedCandidateBrandKeys: Set<string>,
  ): string[] | null {
    const candidateBrand = this.asNonEmptyString(candidate.brand);
    const candidateBrandKey = candidateBrand
      ? this.normalizeCompactText(candidateBrand)
      : null;

    if (!candidateBrand || !supportedCandidateBrandKeys.has(candidateBrandKey ?? '')) {
      return null;
    }

    return [candidateBrand];
  }

  private async getSupportedGenericCandidateBrandKeys(
    userId: number,
    genericCandidates: GenericMenuCandidate[],
  ): Promise<Set<string>> {
    const candidateBrands = Array.from(
      new Set(
        genericCandidates
          .map((candidate) => this.asNonEmptyString(candidate.brand))
          .filter((brand): brand is string => !!brand),
      ),
    );

    if (candidateBrands.length === 0) {
      return new Set();
    }

    const matchedBrands = await this.findMatchedMenuBrands(userId, candidateBrands);

    return new Set(
      matchedBrands.map((brand) => this.normalizeCompactText(brand)),
    );
  }

  private shouldUseDefaultGenericCandidateMenuScope(
    candidate: GenericMenuCandidate,
    supportedCandidateBrandKeys: Set<string>,
  ): boolean {
    const candidateBrand = this.asNonEmptyString(candidate.brand);

    if (!candidateBrand) {
      return true;
    }

    return !supportedCandidateBrandKeys.has(
      this.normalizeCompactText(candidateBrand),
    );
  }

  private async matchGenericMenuCandidatesToDbMenusLocally(
    userId: number,
    genericCandidates: GenericMenuCandidate[],
  ): Promise<MenuEntity[]> {
    const candidateMenus = await this.getSqlDefaultScopedCandidateMenus(userId);

    if (candidateMenus.length === 0) {
      return [];
    }

    const matchedMenus = genericCandidates
      .map((candidate) => this.findMostSimilarMenu(candidate.name, candidateMenus))
      .filter((menu): menu is MenuEntity => !!menu);

    return this.mergeMenusById(matchedMenus).slice(
      0,
      this.getGeminiGenericMenuMatchedMenuLimit(),
    );
  }

  private buildSingleGenericCandidateVectorQuery(
    candidate: GenericMenuCandidate,
    intent: ParsedChatIntent,
  ): string {
    return [
      `추천 후보 음식명: ${candidate.name}`,
      candidate.brand ? `후보 브랜드/매장: ${candidate.brand}` : null,
      candidate.category ? `후보 카테고리: ${candidate.category}` : null,
      candidate.reason ? `후보 판단 근거: ${candidate.reason}` : null,
      '이 후보와 같은 음식명/대표 음식만 DB에서 찾는다.',
      '재료가 비슷해도 조리 방식이나 음식 종류가 다르면 제외한다.',
      '예: 삼겹살 후보는 삼겹살/삼겹살구이를 우선하고 돼지고기 수육, 제육, 김치찌개는 제외한다.',
      '예: 샤브샤브 후보는 샤브샤브를 우선하고 다른 국물요리나 찌개는 제외한다.',
      '예: 중국집 후보는 짜장면/짬뽕 같은 대표 중식 식사 메뉴를 우선한다.',
      intent.desired_category ? `카테고리: ${intent.desired_category}` : null,
      intent.amount_preference
        ? `식사량 선호: ${this.toAmountPreferenceText(intent.amount_preference)}`
        : null,
      intent.nutrition_focus.length > 0
        ? `영양 포커스: ${intent.nutrition_focus.join(', ')}`
        : null,
    ]
      .filter((value): value is string => !!value)
      .join('\n');
  }

  private async getMenusByIds(
    userId: number,
    menuIds: number[],
  ): Promise<MenuEntity[]> {
    if (menuIds.length === 0) {
      return [];
    }

    const menus = await this.menuRepository
      .createQueryBuilder('menu')
      .leftJoinAndSelect('menu.user', 'user')
      .where('menu.id IN (:...menuIds)', { menuIds })
      .andWhere(
        new Brackets((qb) => {
          qb.where('user.id IS NULL').orWhere('user.id = :userId', { userId });
        }),
      )
      .andWhere('menu.is_deleted = :isDeleted', { isDeleted: 0 })
      .getMany();
    const menuMap = new Map(menus.map((menu) => [menu.id, menu]));

    return menuIds
      .map((menuId) => menuMap.get(menuId))
      .filter((menu): menu is MenuEntity => !!menu);
  }

  private async getSqlCandidateMenus(
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

    if (this.shouldUseDefaultRecommendationMenuScope(intent)) {
      builder.andWhere('menu.name LIKE :defaultMenuNamePrefix', {
        defaultMenuNamePrefix: `${DEFAULT_RECOMMENDATION_MENU_NAME_PREFIX}%`,
      });
    }

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
            const condition =
              `(menu.category LIKE :${parameterName} OR menu.name LIKE :${parameterName} OR menu.brand LIKE :${parameterName})`;

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

  private async getSqlDefaultScopedCandidateMenus(
    userId: number,
  ): Promise<MenuEntity[]> {
    return await this.menuRepository
      .createQueryBuilder('menu')
      .leftJoinAndSelect('menu.user', 'user')
      .where(
        new Brackets((qb) => {
          qb.where('user.id IS NULL').orWhere('user.id = :userId', { userId });
        }),
      )
      .andWhere('menu.is_deleted = :isDeleted', { isDeleted: 0 })
      .andWhere('menu.name LIKE :defaultMenuNamePrefix', {
        defaultMenuNamePrefix: `${DEFAULT_RECOMMENDATION_MENU_NAME_PREFIX}%`,
      })
      .getMany();
  }

  private shouldUseDefaultRecommendationMenuScope(
    intent: ParsedChatIntent,
  ): boolean {
    return false;
  }

  private buildVectorRecommendationQuery(
    input: string,
    intent: ParsedChatIntent,
  ): string {
    const parts = [
      input,
      intent.normalized_request
        ? `정규화 요청: ${intent.normalized_request}`
        : null,
      intent.desired_brand ? `브랜드: ${intent.desired_brand}` : null,
      intent.desired_category ? `카테고리: ${intent.desired_category}` : null,
      intent.amount_preference
        ? `식사량 선호: ${this.toAmountPreferenceText(intent.amount_preference)}`
        : null,
      intent.nutrition_focus.length > 0
        ? `영양 포커스: ${intent.nutrition_focus.join(', ')}`
        : null,
      intent.keywords.length > 0
        ? `키워드: ${intent.keywords.join(', ')}`
        : null,
      intent.include.menu_names.length > 0
        ? `포함 메뉴: ${intent.include.menu_names.join(', ')}`
        : null,
      intent.include.keywords.length > 0
        ? `포함 키워드: ${intent.include.keywords.join(', ')}`
        : null,
      this.shouldPreferMainMenuForRecommendation(intent)
        ? [
            '추천 범위: 브랜드의 한 끼 식사용 메인 메뉴만 우선한다.',
            '음료, 커피, 디저트, 사이드, 감자튀김, 너겟, 치즈스틱, 소스, 토핑, 추가 옵션은 제외한다.',
          ].join('\n')
        : null,
    ];

    return parts.filter((value): value is string => !!value).join('\n');
  }

  private filterRecommendationMainMenuCandidates(
    menus: MenuEntity[],
    intent: ParsedChatIntent,
  ): MenuEntity[] {
    const brandFilteredMenus = this.filterMenusByBrandIntent(menus, intent);

    if (!this.shouldPreferMainMenuForRecommendation(intent)) {
      return brandFilteredMenus;
    }

    const filteredMenus = brandFilteredMenus.filter(
      (menu) => !this.isLikelySideDrinkOrDessertMenu(menu),
    );

    return filteredMenus;
  }

  private filterMenusByBrandIntent(
    menus: MenuEntity[],
    intent: ParsedChatIntent,
  ): MenuEntity[] {
    const brandFilters = this.getIntentBrandFilters(intent);

    if (brandFilters.length === 0) {
      return menus;
    }

    const filteredMenus = menus.filter((menu) =>
      this.matchesAnyTerm(menu.brand, brandFilters),
    );

    return filteredMenus.length > 0 ? filteredMenus : menus;
  }

  private shouldPreferMainMenuForRecommendation(
    intent: ParsedChatIntent,
  ): boolean {
    return (
      (this.hasBrandIntent(intent) || intent.amount_preference !== null) &&
      !this.isExplicitSideDrinkOrDessertRequest(intent)
    );
  }

  private hasBrandIntent(intent: ParsedChatIntent): boolean {
    return !!intent.desired_brand || intent.include.brands.length > 0;
  }

  private async hasUnsupportedBrandRecommendation(
    userId: number,
    intent: ParsedChatIntent,
  ): Promise<boolean> {
    const brandFilters = this.getIntentBrandFilters(intent);

    if (brandFilters.length === 0) {
      return false;
    }

    const matchedBrands = await this.findMatchedMenuBrands(userId, brandFilters);

    return matchedBrands.length === 0;
  }

  private toUnsupportedBrandGenericIntent(
    intent: ParsedChatIntent,
  ): ParsedChatIntent {
    return {
      ...intent,
      desired_brand: null,
      include: {
        ...intent.include,
        brands: [],
      },
    };
  }

  private async findMatchedMenuBrands(
    userId: number,
    brandFilters: string[],
  ): Promise<string[]> {
    if (brandFilters.length === 0) {
      return [];
    }

    const rows = await this.menuRepository
      .createQueryBuilder('menu')
      .leftJoin('menu.user', 'user')
      .select('menu.brand', 'brand')
      .where('menu.brand IS NOT NULL')
      .andWhere('menu.brand != :emptyBrand', { emptyBrand: '' })
      .andWhere('menu.is_deleted = :isDeleted', { isDeleted: 0 })
      .andWhere(
        new Brackets((qb) => {
          qb.where('user.id IS NULL').orWhere('user.id = :userId', { userId });
        }),
      )
      .groupBy('menu.brand')
      .getRawMany<{ brand: string }>();

    const normalizedFilters = brandFilters
      .map((brand) => this.normalizeCompactText(brand))
      .filter((brand) => brand.length > 0);

    if (normalizedFilters.length === 0) {
      return [];
    }

    return rows
      .map((row) => row.brand)
      .filter((brand): brand is string => !!brand)
      .filter((brand) => {
        const normalizedBrand = this.normalizeCompactText(brand);

        return normalizedFilters.some(
          (filter) =>
            normalizedBrand === filter ||
            normalizedBrand.includes(filter) ||
            (filter.includes(normalizedBrand) &&
              normalizedBrand.length >= 4 &&
              normalizedBrand.length / filter.length >= 0.6),
        );
      });
  }

  private getIntentBrandFilters(intent: ParsedChatIntent): string[] {
    return Array.from(
      new Set(
        [intent.desired_brand, ...intent.include.brands]
          .map((brand) => brand?.trim())
          .filter((brand): brand is string => !!brand),
      ),
    );
  }

  private isExplicitSideDrinkOrDessertRequest(
    intent: ParsedChatIntent,
  ): boolean {
    const text = this.normalizeCompactText(
      [
        intent.normalized_request,
        intent.desired_category,
        ...intent.keywords,
        ...intent.include.categories,
        ...intent.include.menu_names,
        ...intent.include.keywords,
      ]
        .filter((value): value is string => !!value)
        .join(' '),
    );

    if (!text) {
      return false;
    }

    return [
      '음료',
      '주류',
      '술',
      '마실',
      '콜라',
      '사이다',
      '커피',
      '라떼',
      '에이드',
      '주스',
      '쥬스',
      '쉐이크',
      '스무디',
      '하이볼',
      '맥주',
      '소주',
      '와인',
      '칵테일',
      '레몬진',
      '디저트',
      '아이스크림',
      '쿠키',
      '사이드',
      '감튀',
      '감자튀김',
      '프라이',
      '너겟',
      '치즈스틱',
      '텐더',
      '윙',
      '소스',
    ].some((keyword) => text.includes(keyword));
  }

  private isLikelySideDrinkOrDessertMenu(menu: MenuEntity): boolean {
    const name = this.normalizeCompactText(menu.name);
    const category = this.normalizeCompactText(menu.category ?? '');
    const text = `${name} ${category}`;

    if (
      this.getSideDrinkOrDessertMenuTerms().some((keyword) =>
        text.includes(this.normalizeCompactText(keyword)),
      )
    ) {
      return true;
    }

    const mainMenuIndicators = [
      '버거',
      '샌드위치',
      '샌드',
      '랩',
      '덮밥',
      '도시락',
      '비빔밥',
      '볶음밥',
      '국밥',
      '찌개',
      '탕',
      '면',
      '라면',
      '파스타',
      '피자',
      '샐러드',
      '정식',
      '세트',
    ];

    if (mainMenuIndicators.some((keyword) => text.includes(keyword))) {
      return false;
    }

    return false;
  }

  private getSideDrinkOrDessertMenuTerms(): string[] {
    return [
      '음료',
      '주류',
      '술',
      '콜라',
      '사이다',
      '제로',
      '탄산',
      '커피',
      '아메리카노',
      '라떼',
      '에이드',
      '주스',
      '쥬스',
      '쉐이크',
      '스무디',
      '하이볼',
      '맥주',
      '소주',
      '와인',
      '칵테일',
      '레몬진',
      '순하리',
      '처음처럼',
      '참이슬',
      '카스',
      '테라',
      '클라우드',
      '막걸리',
      '디저트',
      '아이스크림',
      '쿠키',
      '애플파이',
      '케이크',
      '사이드',
      '감튀',
      '감자튀김',
      '프렌치프라이',
      '프라이',
      '너겟',
      '치즈스틱',
      '해쉬브라운',
      '코울슬로',
      '콘샐러드',
      '너겟킹',
      '어니언링',
      '치즈볼',
      '모짜볼',
      '스낵',
      '윙',
      '봉',
      '텐더',
      '소스',
      '디핑',
      '토핑',
      '추가',
    ];
  }

  private toAmountPreferenceText(
    amountPreference: ParsedChatIntent['amount_preference'],
  ): string {
    switch (amountPreference) {
      case 'light':
        return '가볍게 먹기, 부담 적은 메뉴, 저칼로리';
      case 'hearty':
        return '든든하게 먹기, 포만감 있는 메뉴';
      case 'regular':
        return '일반적인 한 끼';
      default:
        return '';
    }
  }

  private getSingleVectorFilter(values: Array<string | null>): string | null {
    const uniqueValues = this.getVectorFilters(values);

    return uniqueValues.length === 1 ? uniqueValues[0] : null;
  }

  private getVectorFilters(values: Array<string | null>): string[] {
    return Array.from(
      new Set(
        values
          .map((value) => value?.trim())
          .filter((value): value is string => !!value),
      ),
    );
  }

  private mergeMenusById(...menuGroups: MenuEntity[][]): MenuEntity[] {
    const menuMap = new Map<number, MenuEntity>();

    menuGroups.flat().forEach((menu) => {
      if (!menuMap.has(menu.id)) {
        menuMap.set(menu.id, menu);
      }
    });

    return Array.from(menuMap.values());
  }

  private async mapWithConcurrency<T, R>(
    items: T[],
    concurrency: number,
    mapper: (item: T, index: number) => Promise<R>,
  ): Promise<R[]> {
    const results: R[] = new Array(items.length);
    let nextIndex = 0;
    const workerCount = Math.min(Math.max(concurrency, 1), items.length);

    await Promise.all(
      Array.from({ length: workerCount }, async () => {
        while (nextIndex < items.length) {
          const currentIndex = nextIndex;
          nextIndex += 1;
          results[currentIndex] = await mapper(items[currentIndex], currentIndex);
        }
      }),
    );

    return results;
  }

  private isVectorSearchEnabled(): boolean {
    return ['1', 'true', 'yes', 'y'].includes(
      (process.env.VECTOR_SEARCH_ENABLED ?? '').toLowerCase(),
    );
  }

  private getVectorCandidateLimit(): number {
    const parsed = Number(process.env.VECTOR_CANDIDATE_LIMIT ?? 500);

    if (!Number.isFinite(parsed)) {
      return 500;
    }

    return Math.max(10, Math.min(Math.floor(parsed), 2000));
  }

  private getVectorSearchMinResult(): number {
    const parsed = Number(process.env.VECTOR_SEARCH_MIN_RESULT ?? 30);

    if (!Number.isFinite(parsed)) {
      return 30;
    }

    return Math.max(1, Math.floor(parsed));
  }

  private getComparisonVectorCandidateLimit(): number {
    const parsed = Number(process.env.VECTOR_COMPARISON_CANDIDATE_LIMIT ?? 20);

    if (!Number.isFinite(parsed)) {
      return 20;
    }

    return Math.max(5, Math.min(Math.floor(parsed), 50));
  }

  private getMenuBoardVectorCandidateLimit(): number {
    return this.getEnvNumberInRange(
      'MENU_BOARD_VECTOR_CANDIDATE_LIMIT',
      40,
      10,
      100,
    );
  }

  private getMenuBoardRematchCandidateLimit(): number {
    return this.getEnvNumberInRange(
      'MENU_BOARD_REMATCH_CANDIDATE_LIMIT',
      40,
      10,
      100,
    );
  }

  private getMenuBoardPerTextVectorCandidateLimit(): number {
    return this.getEnvNumberInRange(
      'MENU_BOARD_PER_TEXT_VECTOR_CANDIDATE_LIMIT',
      20,
      5,
      50,
    );
  }

  private getMenuBoardVectorMatchConcurrency(): number {
    return this.getEnvNumberInRange(
      'MENU_BOARD_VECTOR_MATCH_CONCURRENCY',
      4,
      1,
      8,
    );
  }

  private getFoodImageVectorCandidateLimit(): number {
    return this.getEnvNumberInRange(
      'FOOD_IMAGE_VECTOR_CANDIDATE_LIMIT',
      50,
      10,
      100,
    );
  }

  private getFoodImagePerFoodVectorCandidateLimit(): number {
    return this.getEnvNumberInRange(
      'FOOD_IMAGE_PER_FOOD_VECTOR_CANDIDATE_LIMIT',
      8,
      3,
      20,
    );
  }

  private getFoodImageVectorMatchConcurrency(): number {
    return this.getEnvNumberInRange(
      'FOOD_IMAGE_VECTOR_MATCH_CONCURRENCY',
      4,
      1,
      8,
    );
  }

  private getFoodImageRematchCandidateLimit(): number {
    return this.getEnvNumberInRange(
      'FOOD_IMAGE_REMATCH_CANDIDATE_LIMIT',
      50,
      10,
      100,
    );
  }

  private getEnvNumberInRange(
    key: string,
    fallback: number,
    min: number,
    max: number,
  ): number {
    const parsed = Number(process.env[key] ?? fallback);

    if (!Number.isFinite(parsed)) {
      return fallback;
    }

    return Math.max(min, Math.min(Math.floor(parsed), max));
  }

  private getGeminiGenericMenuCandidateLimit(): number {
    const parsed = Number(process.env.GEMINI_GENERIC_MENU_CANDIDATE_LIMIT ?? 10);

    if (!Number.isFinite(parsed)) {
      return 10;
    }

    return Math.max(1, Math.min(Math.floor(parsed), 10));
  }

  private getGeminiGenericMenuMatchedMenuLimit(): number {
    const parsed = Number(
      process.env.GEMINI_GENERIC_MENU_MATCHED_MENU_LIMIT ?? 10,
    );

    if (!Number.isFinite(parsed)) {
      return 10;
    }

    return Math.max(1, Math.min(Math.floor(parsed), 10));
  }

  private getGeminiGenericMenuPerCandidateLimit(): number {
    const parsed = Number(
      process.env.GEMINI_GENERIC_MENU_PER_CANDIDATE_LIMIT ?? 8,
    );

    if (!Number.isFinite(parsed)) {
      return 8;
    }

    return Math.max(3, Math.min(Math.floor(parsed), 20));
  }

  private getGeminiGenericMenuVectorConcurrency(): number {
    const parsed = Number(
      process.env.GEMINI_GENERIC_MENU_VECTOR_CONCURRENCY ?? 4,
    );

    if (!Number.isFinite(parsed)) {
      return 4;
    }

    return Math.max(1, Math.min(Math.floor(parsed), 8));
  }

  private shouldSkipIntentFilters(): boolean {
    return ['1', 'true', 'yes', 'y'].includes(
      (process.env.CHAT_SKIP_INTENT_FILTERS ?? '').toLowerCase(),
    );
  }

  private isGeminiMenuRerankEnabled(): boolean {
    const value = process.env.GEMINI_MENU_RERANK_ENABLED;

    if (value === undefined) {
      return true;
    }

    return ['1', 'true', 'yes', 'y'].includes(value.toLowerCase());
  }

  private getGeminiRerankCandidateLimit(): number {
    const parsed = Number(process.env.GEMINI_MENU_RERANK_CANDIDATE_LIMIT ?? 30);

    if (!Number.isFinite(parsed)) {
      return 30;
    }

    return Math.max(10, Math.min(Math.floor(parsed), 50));
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

  private async getComparisonCandidateMenus(
    userId: number,
    menuNames: string[],
    timing?: ChatTimingLogger,
  ): Promise<MenuEntity[]> {
    const vectorMatches =
      await this.getComparisonCandidateMenusByVector(userId, menuNames, timing);
    const vectorMatchMap = new Map(
      vectorMatches.map((match) => [
        this.normalizeComparisonMenuKey(match.inputMenuName),
        match.menu,
      ]),
    );

    if (vectorMatchMap.size >= menuNames.length) {
      return this.toOrderedUniqueComparisonMenus(menuNames, vectorMatchMap);
    }

    const candidateMenus = await this.getAllCandidateMenus(userId);

    if (candidateMenus.length === 0) {
      return this.toOrderedUniqueComparisonMenus(menuNames, vectorMatchMap);
    }

    const localMatchMap = new Map<string, MenuEntity>();

    menuNames.forEach((menuName) => {
      const key = this.normalizeComparisonMenuKey(menuName);

      if (vectorMatchMap.has(key)) {
        return;
      }

      const matchedMenu = this.findBestComparisonMenuAboveThreshold(
        menuName,
        candidateMenus,
        45,
      );

      if (matchedMenu) {
        localMatchMap.set(key, matchedMenu);
      }
    });

    timing?.mark('comparison_local_match_completed', {
      matchedCount: localMatchMap.size,
    });

    return this.toOrderedUniqueComparisonMenus(
      menuNames,
      vectorMatchMap,
      localMatchMap,
    );
  }

  private async getComparisonCandidateMenusByVector(
    userId: number,
    menuNames: string[],
    timing?: ChatTimingLogger,
  ): Promise<ComparisonMenuMatch[]> {
    if (!this.isVectorSearchEnabled() || !this.menuVectorService) {
      timing?.mark('comparison_vector_match_skipped');
      return [];
    }

    const matchedMenus: ComparisonMenuMatch[] = [];

    try {
      for (const menuName of menuNames) {
        const vectorResults = await this.menuVectorService.searchMenusByText(
          this.buildComparisonVectorQuery(menuName),
          {
            userId,
            limit: this.getComparisonVectorCandidateLimit(),
          },
        );
        const vectorMenuIds = vectorResults.map((result) => result.menuId);
        const vectorMenus = await this.getMenusByIds(userId, vectorMenuIds);
        const matchedMenu = this.findBestComparisonMenuAboveThreshold(
          menuName,
          vectorMenus,
          30,
        );

        if (matchedMenu) {
          matchedMenus.push({ inputMenuName: menuName, menu: matchedMenu });
        }
      }

      timing?.mark('comparison_vector_match_completed', {
        matchedCount: matchedMenus.length,
      });

      return matchedMenus;
    } catch (error) {
      console.warn('[CHAT] comparison vector match failed, fallback to local', {
        message: error instanceof Error ? error.message : String(error),
      });
      timing?.mark('comparison_vector_match_failed');

      return [];
    }
  }

  private toOrderedUniqueComparisonMenus(
    menuNames: string[],
    ...matchMaps: Array<Map<string, MenuEntity>>
  ): MenuEntity[] {
    const usedMenuIds = new Set<number>();
    const menus: MenuEntity[] = [];

    menuNames.forEach((menuName) => {
      const key = this.normalizeComparisonMenuKey(menuName);
      const matchedMenu = matchMaps
        .map((matchMap) => matchMap.get(key))
        .find((menu): menu is MenuEntity => !!menu);

      if (!matchedMenu || usedMenuIds.has(matchedMenu.id)) {
        return;
      }

      usedMenuIds.add(matchedMenu.id);
      menus.push(matchedMenu);
    });

    return menus;
  }

  private buildComparisonVectorQuery(menuName: string): string {
    const aliases = this.getComparisonRepresentativeAliases(menuName);
    return [
      `비교 대상 일반 음식명: ${menuName}`,
      aliases.length > 0 ? `대표 음식 후보: ${aliases.join(', ')}` : null,
      '사용자가 말한 음식의 대표 메뉴를 찾는다.',
      '사용자가 음식점/업종을 말했으면 그 업종의 대표적인 한 끼 메뉴를 찾는다.',
      '파생 메뉴, 제품명, 변형 메뉴보다 기본 음식명을 우선한다.',
      '가공식품/제품명보다 일반 음식명을 우선한다.',
      '예: 짜장/자장 입력은 짜장면/자장면을 우선한다.',
      '예: 짬뽕 입력은 짬뽕을 우선한다.',
    ].filter(Boolean).join('\n');
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
        this.matchesAnyMenuText(menu, include.categories)) &&
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
      this.matchesAnyMenuText(menu, exclude.categories) ||
      this.matchesAnyMenuText(menu, exclude.menu_names, 'name') ||
      this.matchesAnyMenuText(menu, exclude.keywords)
    );
  }

  private relaxSoftIncludeConditions(intent: ParsedChatIntent): ParsedChatIntent {
    return {
      ...intent,
      include: {
        brands: [...intent.include.brands],
        categories: [],
        menu_names: [],
        keywords: [],
      },
    };
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
      this.getEffectiveCarbs(menu) > constraints.max_carbs
    ) {
      return false;
    }

    if (
      constraints.max_sugars !== null &&
      (menu.sugars ?? 0) > constraints.max_sugars
    ) {
      return false;
    }

    if (
      constraints.max_fat !== null &&
      this.getEffectiveFat(menu) > constraints.max_fat
    ) {
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

  private hasHardNutritionConstraints(intent: ParsedChatIntent): boolean {
    const constraints = intent.nutrition_constraints;

    return (
      constraints.max_calories !== null ||
      constraints.min_calories !== null ||
      constraints.min_protein !== null ||
      constraints.max_carbs !== null ||
      constraints.max_sugars !== null ||
      constraints.max_fat !== null ||
      constraints.max_sodium !== null ||
      constraints.caffeine_allowed !== null
    );
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
    const macroOverages = {
      carbs: Math.max(dailyNutrition.carbs - targetMacroGrams.carbs, 0),
      protein: Math.max(dailyNutrition.protein - targetMacroGrams.protein, 0),
      fat: Math.max(dailyNutrition.fat - targetMacroGrams.fat, 0),
    };
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
      targetMealCalories *= 0.7;
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
      macroOverages,
      targetMacroGrams,
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

  private getEffectiveCarbs(menu: MenuEntity): number {
    const carbs = menu.carbs ?? 0;

    if (carbs !== 0) {
      return carbs;
    }

    return menu.sugars ?? carbs;
  }

  private getEffectiveFat(menu: MenuEntity): number {
    const fat = menu.fat ?? 0;

    if (fat !== 0) {
      return fat;
    }

    const detailedFats = [menu.sat_fat, menu.trans_fat, menu.un_sat_fat].filter(
      (value): value is number => value !== null && value !== undefined,
    );

    return detailedFats.length > 0
      ? detailedFats.reduce((sum, value) => sum + value, 0)
      : fat;
  }

  private scoreMenu(
    menu: MenuEntity,
    intent: ParsedChatIntent,
    userInfo: UserInfoEntity,
    basis: ReturnType<ChatService['buildRecommendationBasis']>,
  ): ScoreBreakdown {
    // 메뉴별 점수는 칼로리 적합도, 탄단지 적합도, 목표 적합도, 포만감, 당 밀도, 의도 매칭으로 구성합니다.
    const calories = menu.calories ?? 0;
    const carbs = this.getEffectiveCarbs(menu);
    const protein = menu.protein ?? 0;
    const fat = this.getEffectiveFat(menu);
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
    const macroOveragePenalty = this.calculateMacroOveragePenalty(
      { carbs, protein, fat },
      basis.macroOverages,
      basis.targetMacroGrams,
    );
    const macroScore = this.clampScore(
      100 - macroDistance / 1.8 - macroOveragePenalty,
    );

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
    const carbsCalories = this.getEffectiveCarbs(menu) * 4;
    const proteinCalories = (menu.protein ?? 0) * 4;
    const fatCalories = this.getEffectiveFat(menu) * 9;
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
    remainingMacros: MacroAmounts,
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

  private calculateMacroOveragePenalty(
    menuMacros: MacroAmounts,
    macroOverages: MacroAmounts,
    targetMacroGrams: MacroAmounts,
  ): number {
    const macroPenaltyWeights: MacroAmounts = {
      carbs: 1,
      protein: 0.45,
      fat: 1.25,
    };

    return (Object.keys(menuMacros) as Array<keyof MacroAmounts>).reduce(
      (penalty, macro) => {
        const target = Math.max(targetMacroGrams[macro], 1);
        const overageRatio = macroOverages[macro] / target;

        if (overageRatio <= 0) {
          return penalty;
        }

        const menuRatio = menuMacros[macro] / target;

        return (
          penalty + overageRatio * menuRatio * macroPenaltyWeights[macro] * 100
        );
      },
      0,
    );
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
          score += this.getEffectiveFat(menu) >= 18 ? 12 : 0;
          break;
        case 'low_carb':
          score += this.getEffectiveCarbs(menu) <= 20 ? 12 : 0;
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
      reasons.push('현재 끼니 기준에 잘 맞아');
    }
    if (scores.macroScore >= 75) {
      reasons.push('남은 탄단지 흐름에 맞아');
    }
    if (scores.satietyScore >= 75) {
      reasons.push('포만감 효율이 좋아');
    }
    if (scores.sugarScore >= 75) {
      reasons.push('당 부담이 덜해');
    }
    if (scores.intentScore >= 75) {
      reasons.push('브랜드/카테고리/영양 의도와 맞아');
    }

    if (reasons.length === 0) {
      reasons.push('여러 기준에서 무난한 균형형 선택이야');
    }

    return `${menu.name}: ${reasons.join(', ')}.`;
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
      return '포만감 효율이 좋아 한 끼로 안정적이야.';
    }
    if (score.macroScore >= 75) {
      return '남은 탄단지 흐름과 잘 맞아.';
    }
    if (score.calorieScore >= 75) {
      return '현재 식사 흐름에 잘 맞는 메뉴야.';
    }
    return `${menu.name}: 전체 균형 점수가 높아.`;
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
    score: ScoreBreakdown,
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
    response.score = roundToOneDecimal(score.finalScore);
    response.is_appropriate = score.finalScore >= 65;
    response.data_source = menu.data_source;

    return response;
  }

  private sumFeedbackNutrition(menus: MenuEntity[]): FeedbackNutrition {
    return menus.reduce(
      (acc, menu) => {
        acc.calories += menu.calories ?? 0;
        acc.carbs += this.getEffectiveCarbs(menu);
        acc.protein += menu.protein ?? 0;
        acc.fat += this.getEffectiveFat(menu);
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
    const bestMatch = this.findMostSimilarMenuWithScore(inputMenuName, menus);

    if (!bestMatch) {
      throw new BadRequestException('No menus available for matching');
    }

    return bestMatch.menu;
  }

  private findMostSimilarMenuAboveThreshold(
    inputMenuName: string,
    menus: MenuEntity[],
    minSimilarity: number,
  ): MenuEntity | null {
    const bestMatch = this.findMostSimilarMenuWithScore(inputMenuName, menus);

    return bestMatch && bestMatch.similarity >= minSimilarity
      ? bestMatch.menu
      : null;
  }

  private findBestComparisonMenuAboveThreshold(
    inputMenuName: string,
    menus: MenuEntity[],
    minSimilarity: number,
  ): MenuEntity | null {
    const bestMatch = this.findBestComparisonMenuWithScore(
      inputMenuName,
      menus,
    );

    return bestMatch && bestMatch.similarity >= minSimilarity
      ? bestMatch.menu
      : null;
  }

  private findBestComparisonMenuWithScore(
    inputMenuName: string,
    menus: MenuEntity[],
  ): { menu: MenuEntity; similarity: number } | null {
    if (menus.length === 0) {
      return null;
    }

    return menus
      .map((menu) => ({
        menu,
        similarity: this.calculateComparisonMenuSimilarity(
          inputMenuName,
          menu,
        ),
      }))
      .sort((a, b) => b.similarity - a.similarity)[0];
  }

  private calculateComparisonMenuSimilarity(
    inputMenuName: string,
    menu: MenuEntity,
  ): number {
    return (
      this.calculateMenuSimilarity(inputMenuName, menu) +
      this.calculateRepresentativeMenuPreferenceScore(inputMenuName, menu.name)
    );
  }

  private calculateRepresentativeMenuPreferenceScore(
    inputMenuName: string,
    menuName: string,
  ): number {
    const input = this.normalizeMenuMatchText(inputMenuName);
    const strippedMenuName = this.stripMenuSourcePrefix(menuName);
    const menu = this.normalizeMenuMatchText(strippedMenuName);
    const sourcePrefixed = /^\([^)]*\)\s*/.test(menuName.trim());

    if (!input || !menu) {
      return 0;
    }

    const rules = [
      {
        triggers: ['중국집', '중식집', '중화요리', '중식'],
        aliases: ['짜장면', '자장면', '짬뽕'],
        variants: [
          '중국집간짜장',
          '옛날중국집',
          '백짜장',
          '백자장',
          '짜장라면',
          '자장라면',
          '짬뽕라면',
          '나가사키짬뽕',
        ],
      },
      {
        triggers: ['샤브샤브', '샤브'],
        aliases: ['샤브샤브'],
        variants: ['버섯샤브샤브', '마라샤브샤브'],
      },
      {
        triggers: ['삼겹살'],
        aliases: ['삼겹살구이', '삼겹살'],
        variants: ['삼겹살김치찌개', '삼겹살볶음', '삼겹살덮밥'],
      },
      {
        triggers: ['짜장', '자장'],
        aliases: ['짜장면', '자장면'],
        variants: [
          '백짜장',
          '백자장',
          '짜장라면',
          '자장라면',
          '간짜장',
          '간자장',
          '쟁반짜장',
          '쟁반자장',
          '삼선짜장',
          '삼선자장',
          '유니짜장',
          '유니자장',
          '사천짜장',
          '사천자장',
        ],
      },
      {
        triggers: ['짬뽕'],
        aliases: ['짬뽕'],
        variants: [
          '백짬뽕',
          '짬뽕라면',
          '삼선짬뽕',
          '해물짬뽕',
          '굴짬뽕',
          '나가사키짬뽕',
          '짬뽕밥',
        ],
      },
    ];

    const matchedRule = rules.find((rule) =>
      rule.triggers.some((trigger) => input.includes(trigger)),
    );

    if (!matchedRule) {
      return 0;
    }

    let score = 0;

    if (matchedRule.aliases.some((alias) => menu === alias)) {
      score += 80;
      if (sourcePrefixed) {
        score += 10;
      }
    } else if (matchedRule.aliases.some((alias) => menu.startsWith(alias))) {
      score += 40;
    } else if (matchedRule.aliases.some((alias) => menu.includes(alias))) {
      score += 20;
    }

    const unrequestedVariantMatched = matchedRule.variants.some(
      (variant) => menu.includes(variant) && !input.includes(variant),
    );

    if (unrequestedVariantMatched) {
      score -= 45;
    }

    return score;
  }

  private getComparisonRepresentativeAliases(inputMenuName: string): string[] {
    const input = this.normalizeMenuMatchText(inputMenuName);

    if (!input) {
      return [];
    }

    const rules = [
      {
        triggers: ['중국집', '중식집', '중화요리', '중식'],
        aliases: ['짜장면', '짬뽕'],
      },
      {
        triggers: ['샤브샤브', '샤브'],
        aliases: ['샤브샤브'],
      },
      {
        triggers: ['삼겹살'],
        aliases: ['삼겹살구이', '삼겹살'],
      },
      {
        triggers: ['짜장', '자장'],
        aliases: ['짜장면', '자장면'],
      },
      {
        triggers: ['짬뽕'],
        aliases: ['짬뽕'],
      },
    ];

    return (
      rules.find((rule) =>
        rule.triggers.some((trigger) => input.includes(trigger)),
      )?.aliases ?? []
    );
  }

  private findMostSimilarMenuWithScore(
    inputMenuName: string,
    menus: MenuEntity[],
  ): { menu: MenuEntity; similarity: number } | null {
    if (menus.length === 0) {
      return null;
    }

    return menus
      .map((menu) => ({
        menu,
        similarity: this.calculateMenuSimilarity(inputMenuName, menu),
      }))
      .sort((a, b) => b.similarity - a.similarity)[0];
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
    const compactInput = this.normalizeMenuMatchText(inputMenuName);
    const compactMenuName = this.normalizeMenuMatchText(menu.name);
    const compactSearchable = this.normalizeMenuMatchText(
      `${menu.name} ${menu.brand ?? ''} ${menu.category ?? ''}`,
    );

    if (!input) {
      return 0;
    }

    if (menuName === input || compactMenuName === compactInput) {
      return 100;
    }

    if (
      menuName.includes(input) ||
      input.includes(menuName) ||
      compactMenuName.includes(compactInput) ||
      compactInput.includes(compactMenuName)
    ) {
      return 82;
    }

    if (searchable.includes(input) || compactSearchable.includes(compactInput)) {
      return 72;
    }

    const inputTokens = new Set(input.split(/\s+/).filter(Boolean));
    const menuTokens = new Set(searchable.split(/\s+/).filter(Boolean));
    const overlapCount = Array.from(inputTokens).filter((token) =>
      menuTokens.has(token),
    ).length;
    const tokenScore =
      inputTokens.size > 0 ? (overlapCount / inputTokens.size) * 60 : 0;
    const characterScore = Math.max(
      this.calculateCharacterDiceScore(compactInput, compactMenuName) * 72,
      this.calculateCharacterDiceScore(compactInput, compactSearchable) * 60,
    );

    return Math.max(tokenScore, characterScore);
  }

  private normalizeComparableText(value: string): string {
    return value
      .toLowerCase()
      .replace(/계란/g, '달걀')
      .replace(/후라이/g, '프라이')
      .replace(/[^\w가-힣\s]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  }

  private normalizeMenuMatchText(value: string): string {
    return this.normalizeComparableText(value).replace(/\s+/g, '');
  }

  private stripMenuSourcePrefix(value: string): string {
    return value.replace(/^\([^)]*\)\s*/g, '').trim();
  }

  private normalizeComparisonMenuKey(value: string): string {
    return this.normalizeMenuMatchText(value);
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

  private toFoodImageRecognizedMenuResponse(
    food: RecognizedFoodImageMenu,
  ): ChatFoodImageRecognizedMenuResponseDto {
    const position = new ChatFoodImagePositionResponseDto();
    position.x = food.position.x;
    position.y = food.position.y;

    const response = new ChatFoodImageRecognizedMenuResponseDto();
    response.menu_id = food.id;
    response.menu_name = food.name;
    response.brand = food.brand;
    response.category = food.category;
    response.confidence = food.confidence;
    response.position = position;
    return response;
  }

  private async analyzeChatWithGemini(
    input: string,
    userInfo: UserInfoEntity,
    chatContext: ChatContextSummary,
  ): Promise<ChatAnalysis> {
    const fallbackIntent = this.buildFallbackIntent(input);
    const prompt = `
사용자 입력을 채팅 카테고리와 메뉴 추천 의도로 동시에 분석하고 JSON object만 반환해.
반드시 JSON만 반환하고 마크다운, 설명, 코드펜스는 금지.

채팅 분류:
- recommendation: 사용자가 메뉴를 추천해 달라고 요청하는 경우
- recommendation: "A와 B 중 뭐 먹을까?", "A랑 B 중 뭐가 나아?", "A vs B 추천"처럼 구체적인 음식 메뉴명 중 하나를 골라달라는 비교 선택 요청
- recommendation: "맥도날드, 버거킹, 롯데리아 중 어디갈까?", "중국집, 샤브샤브, 삼겹살 중 어디갈까?"처럼 브랜드/매장/장소/음식 카테고리 중 어디를 갈지 묻는 요청은 비교 선택이 아니라 일반 추천 요청으로 분류해
- recommendation: 브랜드 별칭, 줄임말, 외래어 표기가 섞인 브랜드/매장 선택 요청도 브랜드 선택형 일반 추천이고, 구체 메뉴 비교가 아니야
- feedback: 사용자가 이미 먹었거나 먹으려는 메뉴/식단/음식 선택이 괜찮은지 평가, 판단, 피드백, 리뷰를 요청하는 경우
- general: 메뉴 추천 또는 메뉴/식단 피드백이 아닌 모든 일반 질문, 설명, 상담, 대화 요청

맥락 규칙:
- feedback일 때는 입력에 언급된 메뉴명/음식명을 menu_names에 넣어
- recommendation일 때도 명확한 메뉴명이 있으면 menu_names에 넣을 수 있지만 보통 빈 배열
- 비교 선택 recommendation일 때는 비교 대상이 실제로 먹을 수 있는 구체적인 음식 메뉴명일 때만 menu_names와 intent.include.menu_names에 넣어
- 브랜드/매장명/장소명/음식 카테고리 비교는 menu_names와 intent.include.menu_names에 넣지 말고, include.brands/categories/keywords 또는 desired_brand/desired_category에 반영해
- 비교 선택 recommendation의 menu_names는 DB 검색에 바로 쓸 수 있는 완성 음식명으로 정규화해
- 비교 대상 중 한쪽이 "후라이", "프라이", "구이", "볶음", "찜", "탕", "국"처럼 조리 방식만 말한 생략 표현이면, 같은 문장 안의 다른 비교 대상이나 문맥에서 공통 재료를 추론해 완성 음식명으로 복원해
- 예: "삶은 달걀이랑 후라이 중에 뭐 먹을까?" -> menu_names=["삶은 달걀","달걀 프라이"], intent.include.menu_names도 동일
- 예: "삶은 계란이랑 프라이 중에는?" -> menu_names=["삶은 계란","계란 프라이"], intent.include.menu_names도 동일
- 예: "돼지고기 구이랑 찜 중 뭐가 나아?" -> menu_names=["돼지고기 구이","돼지고기 찜"], intent.include.menu_names도 동일
- 예: "맥도날드, 버거킹, 롯데리아 중 어디갈까?" -> recommendation, menu_names=[], intent.include.menu_names=[]
- 예: "중국집, 샤브샤브, 삼겹살 중 어디갈까?" -> recommendation, menu_names=[], intent.include.menu_names=[]
- 단, 원문에 재료 단서가 전혀 없으면 억지로 추론하지 말고 원문 표현을 유지해
- general일 때는 menu_names를 빈 배열로 반환해
- 이전 대화의 추천/피드백 대상을 가리키는 "그거", "아까", "다른 거", "말고", "비슷한 걸로" 같은 표현이면 context_dependent를 true로 반환해
- "그거 말고", "다른 거", "아까 추천한 거 빼고"처럼 이전 추천 메뉴를 제외해야 하면 context_action은 "exclude_previous_recommendations"
- "그 조건으로", "비슷한 걸로", "아까처럼"처럼 이전 조건을 유지해야 하면 context_action은 "reuse_previous_conditions"
- "그거 먹어도 돼?", "아까 거 괜찮아?"처럼 이전 메뉴를 평가해야 하면 feedback 및 "evaluate_previous_menus"

추천 의도 규칙:
- meal_time: 0(아침), 1(점심), 2(저녁), 3(간식), 4(야식), 불명확하면 null
- desired_brand, desired_category: 문자열 또는 null
- 사용자가 여러 브랜드/매장 후보 중 하나를 고르는 요청이면 desired_brand는 반드시 null로 두고, 모든 브랜드/매장명은 include.brands에 넣어
- 예: "맥도날드, 버거킹, 롯데리아 중 어디갈까?" -> desired_brand=null, include.brands=["맥도날드","버거킹","롯데리아"]
- 브랜드 별칭, 줄임말, 오타, 외래어 표기는 문맥상 가장 일반적인 표준 브랜드명으로 정규화해
- 브랜드/매장 후보를 고르는 요청이면 구체 메뉴 비교로 보지 말고 desired_brand=null, include.brands에 정규화된 브랜드들을 넣고 menu_names는 비워
- nutrition_focus: 다음 값만 사용 ["high_protein","high_fat","low_carb","low_sugar","light_meal","hearty_meal"]
- amount_preference: "light" | "regular" | "hearty" | null
- keywords: 추천 검색에 도움이 되는 핵심 키워드 배열
- normalized_request: 사용자의 의도를 한 문장으로 정리
- include: 반드시 포함해야 하는 조건. "샐러드만", "버거 중에서", "싸이버거로" 같은 조건
- "A와 B 중 뭐 먹을까?" 같은 구체적인 음식 메뉴명 비교 선택 요청은 include.menu_names에 정규화된 A, B를 넣어
- "A, B, C 중 어디갈까?"처럼 브랜드/매장/장소/음식 카테고리를 고르는 요청은 include.menu_names를 비워두고, 브랜드/매장명은 include.brands에 넣고 desired_brand는 null로 둬
- 브랜드 별칭이 포함된 선택 요청도 구체 메뉴 비교가 아니라 브랜드 선택형 일반 추천이야
- 비교 선택 요청에서 classification.menu_names와 intent.include.menu_names는 같은 정규화 메뉴명 목록을 사용해
- exclude: 반드시 제외해야 하는 조건. "싸이버거 제외", "음료 빼고", "치킨 말고" 같은 조건
- nutrition_constraints: 명확한 수치 조건만 넣고, "낮은/많은"처럼 수치가 없으면 null
- caffeine_allowed: "카페인 없는", "디카페인", "카페인 빼고"는 false, 명확하지 않으면 null
- context_action이 "exclude_previous_recommendations"이면 이전 추천 메뉴명은 exclude.menu_names에 넣어
- context_action이 "reuse_previous_conditions"이면 이전 요청의 브랜드/카테고리/끼니 맥락은 유지하고, 현재 입력에서 바꾼 조건만 덮어써

사용자 프로필:
goal=${this.goalToLabel(userInfo.goal)}
target_calories=${userInfo.target_calories}
target_ratio=${JSON.stringify(this.normalizeTargetRatio(userInfo.target_ratio))}

최근 대화 요약:
${JSON.stringify(chatContext)}

입력:
${input}

반환 shape:
{
  "chat_category": "recommendation",
  "menu_names": [],
  "context_dependent": false,
  "context_action": null,
  "intent": {
    "normalized_request": "string",
    "meal_time": null,
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
}
`.trim();

    const data = await this.callGeminiJson(prompt);
    const chatCategory: ChatCategory =
      data?.chat_category === 'feedback'
        ? 'feedback'
        : data?.chat_category === 'general'
          ? 'general'
          : 'recommendation';
    const contextDependent =
      typeof data?.context_dependent === 'boolean'
        ? data.context_dependent
        : this.isContextDependentInput(input);
    const contextAction =
      this.normalizeContextAction(data?.context_action) ??
      this.inferContextAction(input, chatCategory, contextDependent);
    const classification: ChatClassification = {
      chat_category: chatCategory,
      menu_names:
        chatCategory === 'feedback'
          ? this.normalizeFreeTextArray(
              data?.menu_names,
              this.extractFeedbackMenuNamesFallback(input, chatContext),
            )
          : chatCategory === 'general'
            ? []
            : this.normalizeFreeTextArray(data?.menu_names, []),
      context_dependent: contextDependent,
      context_action: contextAction,
    };
    const intentSource = data?.intent ?? {};
    const intent: ParsedChatIntent = {
      normalized_request:
        this.asNonEmptyString(intentSource.normalized_request) ??
        fallbackIntent.normalized_request,
      meal_time:
        typeof intentSource.meal_time === 'number' &&
        intentSource.meal_time >= 0 &&
        intentSource.meal_time <= 4
          ? intentSource.meal_time
          : fallbackIntent.meal_time,
      desired_brand:
        this.asNonEmptyString(intentSource.desired_brand) ??
        fallbackIntent.desired_brand,
      desired_category:
        this.normalizeCategoryKeyword(
          this.asNonEmptyString(intentSource.desired_category),
        ) ?? fallbackIntent.desired_category,
      nutrition_focus: this.normalizeStringArray(
        intentSource.nutrition_focus,
        [
          'high_protein',
          'high_fat',
          'low_carb',
          'low_sugar',
          'light_meal',
          'hearty_meal',
        ],
        fallbackIntent.nutrition_focus,
      ),
      amount_preference:
        this.normalizeAmountPreference(intentSource.amount_preference) ??
        fallbackIntent.amount_preference,
      keywords: this.normalizeKeywordArray(
        intentSource.keywords,
        fallbackIntent.keywords,
      ),
      include: this.normalizeIntentConditionGroup(
        intentSource.include,
        fallbackIntent.include,
      ),
      exclude: this.normalizeIntentConditionGroup(
        intentSource.exclude,
        fallbackIntent.exclude,
      ),
      nutrition_constraints: this.normalizeNutritionConstraints(
        intentSource.nutrition_constraints,
        fallbackIntent.nutrition_constraints,
      ),
    };

    return {
      classification,
      intent: this.normalizeMultiBrandSelectionIntent(intent),
    };
  }

  private async classifyChatWithGemini(
    input: string,
    chatContext: ChatContextSummary,
  ): Promise<ChatClassification> {
    const prompt = `
사용자 입력을 채팅 카테고리로 분류하고 JSON object만 반환해.

분류 규칙:
- recommendation: 사용자가 메뉴를 추천해 달라고 요청하는 경우
- recommendation: "A와 B 중 뭐 먹을까?", "A랑 B 중 뭐가 나아?", "A vs B 추천"처럼 구체적인 음식 메뉴명 중 하나를 골라달라는 비교 선택 요청
- recommendation: "맥도날드, 버거킹, 롯데리아 중 어디갈까?", "중국집, 샤브샤브, 삼겹살 중 어디갈까?"처럼 브랜드/매장/장소/음식 카테고리 중 어디를 갈지 묻는 요청은 비교 선택이 아니라 일반 추천 요청으로 분류해
- feedback: 사용자가 이미 먹었거나 먹으려는 메뉴/식단/음식 선택이 괜찮은지 평가, 판단, 피드백, 리뷰를 요청하는 경우
- general: 메뉴 추천 또는 메뉴/식단 피드백이 아닌 모든 일반 질문, 설명, 상담, 대화 요청
- feedback일 때는 입력에 언급된 메뉴명/음식명을 menu_names에 넣어
- recommendation일 때도 명확한 메뉴명이 있으면 menu_names에 넣을 수 있지만 보통 빈 배열
- 비교 선택 recommendation일 때는 비교 대상이 실제로 먹을 수 있는 구체적인 음식 메뉴명일 때만 menu_names에 넣어
- 브랜드/매장명/장소명/음식 카테고리 비교는 menu_names에 넣지 마
- 비교 선택 recommendation의 menu_names는 DB 검색에 바로 쓸 수 있는 완성 음식명으로 정규화해
- 비교 대상 중 한쪽이 "후라이", "프라이", "구이", "볶음", "찜", "탕", "국"처럼 조리 방식만 말한 생략 표현이면, 같은 문장 안의 다른 비교 대상이나 문맥에서 공통 재료를 추론해 완성 음식명으로 복원해
- 예: "삶은 달걀이랑 후라이 중에 뭐 먹을까?" -> recommendation, menu_names=["삶은 달걀","달걀 프라이"]
- 예: "삶은 계란이랑 프라이 중에는?" -> recommendation, menu_names=["삶은 계란","계란 프라이"]
- 예: "돼지고기 구이랑 찜 중 뭐가 나아?" -> recommendation, menu_names=["돼지고기 구이","돼지고기 찜"]
- 예: "맥도날드, 버거킹, 롯데리아 중 어디갈까?" -> recommendation, menu_names=[]
- 예: "중국집, 샤브샤브, 삼겹살 중 어디갈까?" -> recommendation, menu_names=[]
- 단, 원문에 재료 단서가 전혀 없으면 억지로 추론하지 말고 원문 표현을 유지해
- general일 때는 menu_names를 빈 배열로 반환해
- 이전 대화의 추천/피드백 대상을 가리키는 "그거", "아까", "다른 거", "말고", "비슷한 걸로" 같은 표현이면 context_dependent를 true로 반환해
- "그거 말고", "다른 거", "아까 추천한 거 빼고"처럼 이전 추천 메뉴를 제외해야 하면 context_action은 "exclude_previous_recommendations"
- "그 조건으로", "비슷한 걸로", "아까처럼"처럼 이전 조건을 유지해야 하면 context_action은 "reuse_previous_conditions"
- "그거 먹어도 돼?", "아까 거 괜찮아?"처럼 이전 메뉴를 평가해야 하면 feedback 및 "evaluate_previous_menus"
- 반드시 JSON object만 반환하고 마크다운, 설명, 코드펜스는 금지

예시:
"맘스터치에서 싸이버거 제외하고 메뉴 추천해줘" -> recommendation
"싸이버거랑 빅맥 중 뭐 먹을까?" -> recommendation, menu_names=["싸이버거","빅맥"]
"삶은 달걀이랑 후라이 중에 뭐 먹을까?" -> recommendation, menu_names=["삶은 달걀","달걀 프라이"]
"맥도날드, 버거킹, 롯데리아 중 어디갈까?" -> recommendation, menu_names=[]
"중국집, 샤브샤브, 삼겹살 중 어디갈까?" -> recommendation, menu_names=[]
"오늘 점심 싸이버거 먹어도 돼?" -> feedback
"싸이버거랑 콜라 먹었는데 괜찮아?" -> feedback
"탄수화물은 언제 먹는 게 좋아?" -> general
"다이어트 중 나트륨 줄이는 법 알려줘" -> general
"단백질 하루에 얼마나 먹어야 해?" -> general
"오늘 날씨 얘기해줘" -> general
"코딩 질문 하나 해도 돼?" -> general
"그거 말고 다른 거 추천해줘" -> recommendation, context_dependent=true, context_action="exclude_previous_recommendations"
"아까 거 먹어도 돼?" -> feedback, context_dependent=true, context_action="evaluate_previous_menus"

최근 대화 요약:
${JSON.stringify(chatContext)}

입력:
${input}

반환 shape:
{
  "chat_category": "recommendation",
  "menu_names": [],
  "context_dependent": false,
  "context_action": null
}
`.trim();

    const data = await this.callGeminiJson(prompt);
    const chatCategory: ChatCategory =
      data?.chat_category === 'feedback'
        ? 'feedback'
        : data?.chat_category === 'general'
          ? 'general'
          : 'recommendation';

    const contextDependent =
      typeof data?.context_dependent === 'boolean'
        ? data.context_dependent
        : this.isContextDependentInput(input);
    const contextAction =
      this.normalizeContextAction(data?.context_action) ??
      this.inferContextAction(input, chatCategory, contextDependent);

    return {
      chat_category: chatCategory,
      menu_names:
        chatCategory === 'feedback'
          ? this.normalizeFreeTextArray(
              data?.menu_names,
              this.extractFeedbackMenuNamesFallback(input, chatContext),
            )
          : chatCategory === 'general'
            ? []
            : this.normalizeFreeTextArray(data?.menu_names, []),
      context_dependent: contextDependent,
      context_action: contextAction,
    };
  }

  private normalizeContextAction(
    value: unknown,
  ): ChatClassification['context_action'] {
    return value === 'exclude_previous_recommendations' ||
      value === 'reuse_previous_conditions' ||
      value === 'evaluate_previous_menus'
      ? value
      : null;
  }

  private isContextDependentInput(input: string): boolean {
    const normalized = input.replace(/\s+/g, '');
    return /(그거|그것|이거|이것|저거|저것|아까|방금|전에|이전|다른거|다른것|다른메뉴|비슷한|말고|빼고|제외)/.test(
      normalized,
    );
  }

  private inferContextAction(
    input: string,
    chatCategory: ChatCategory,
    contextDependent: boolean,
  ): ChatClassification['context_action'] {
    if (!contextDependent) {
      return null;
    }

    const normalized = input.replace(/\s+/g, '');

    if (/(말고|빼고|제외|다른거|다른것|다른메뉴)/.test(normalized)) {
      return 'exclude_previous_recommendations';
    }

    if (
      chatCategory === 'feedback' &&
      /(먹어도돼|괜찮|어때|피드백|평가|판단)/.test(normalized)
    ) {
      return 'evaluate_previous_menus';
    }

    if (/(비슷한|그조건|그대로|아까처럼|전에처럼)/.test(normalized)) {
      return 'reuse_previous_conditions';
    }

    return null;
  }

  private applyChatContextToIntent(
    intent: ParsedChatIntent,
    chatContext: ChatContextSummary,
    classification: ChatClassification,
  ): ParsedChatIntent {
    const nextIntent: ParsedChatIntent = {
      ...intent,
      include: {
        brands: [...intent.include.brands],
        categories: [...intent.include.categories],
        menu_names: [...intent.include.menu_names],
        keywords: [...intent.include.keywords],
      },
      exclude: {
        brands: [...intent.exclude.brands],
        categories: [...intent.exclude.categories],
        menu_names: [...intent.exclude.menu_names],
        keywords: [...intent.exclude.keywords],
      },
      keywords: [...intent.keywords],
      nutrition_focus: [...intent.nutrition_focus],
    };

    if (!classification.context_dependent) {
      return nextIntent;
    }

    if (classification.context_action === 'exclude_previous_recommendations') {
      nextIntent.exclude.menu_names = this.mergeTextValues(
        nextIntent.exclude.menu_names,
        chatContext.previous_recommended_menu_names,
        chatContext.previous_feedback_menu_names,
      );
    }

    if (classification.context_action === 'reuse_previous_conditions') {
      if (!nextIntent.desired_brand && chatContext.previous_brand) {
        nextIntent.desired_brand = chatContext.previous_brand;
      }
      if (!nextIntent.desired_category && chatContext.previous_category_name) {
        nextIntent.desired_category = chatContext.previous_category_name;
      }
      if (
        nextIntent.meal_time === null &&
        chatContext.previous_meal_time !== null
      ) {
        nextIntent.meal_time = chatContext.previous_meal_time;
      }
    }

    return nextIntent;
  }

  private applyChatContextToClassification(
    classification: ChatClassification,
    chatContext: ChatContextSummary,
  ): ChatClassification {
    if (
      classification.chat_category !== 'feedback' ||
      classification.context_action !== 'evaluate_previous_menus'
    ) {
      return classification;
    }

    const contextMenuNames = this.mergeTextValues(
      chatContext.previous_feedback_menu_names,
      chatContext.previous_recommended_menu_names,
    ).slice(0, 5);

    if (contextMenuNames.length === 0) {
      return classification;
    }

    const menuNames = classification.menu_names.filter(
      (menuName) => !this.isContextPointerText(menuName),
    );

    return {
      ...classification,
      menu_names: menuNames.length > 0 ? menuNames : contextMenuNames,
    };
  }

  private isContextPointerText(value: string): boolean {
    const normalized = value.replace(/\s+/g, '');
    return /^(그거|그것|이거|이것|저거|저것|아까|방금|전에|이전|아까거|방금거|이전거)$/.test(
      normalized,
    );
  }

  private mergeTextValues(...groups: string[][]): string[] {
    const seen = new Set<string>();
    const merged: string[] = [];

    groups.flat().forEach((value) => {
      const normalized = value.trim();
      const key = normalized.toLowerCase();

      if (!normalized || seen.has(key)) {
        return;
      }

      seen.add(key);
      merged.push(normalized);
    });

    return merged;
  }

  private normalizeMultiBrandSelectionIntent(
    intent: ParsedChatIntent,
  ): ParsedChatIntent {
    if (!intent.desired_brand || intent.include.brands.length < 2) {
      return intent;
    }

    const desiredBrandKey = this.normalizeCompactText(intent.desired_brand);
    const includeBrandKeys = intent.include.brands.map((brand) =>
      this.normalizeCompactText(brand),
    );

    if (!includeBrandKeys.includes(desiredBrandKey)) {
      return intent;
    }

    return {
      ...intent,
      desired_brand: null,
      include: {
        ...intent.include,
        brands: this.mergeTextValues(intent.include.brands, [
          intent.desired_brand,
        ]),
      },
    };
  }

  private extractFeedbackMenuNamesFallback(
    input: string,
    chatContext?: ChatContextSummary,
  ): string[] {
    const normalized = input
      .replace(/먹어도\s*돼|괜찮아|어때|피드백|평가|판단|먹었는데/g, ' ')
      .replace(/[^\w가-힣\s]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();

    if (!normalized) {
      if (chatContext && this.isContextDependentInput(input)) {
        return [
          ...chatContext.previous_feedback_menu_names,
          ...chatContext.previous_recommended_menu_names,
        ].slice(0, 5);
      }
      return [];
    }

    return normalized
      .split(/\s*(?:랑|하고|과|와|,)\s*/)
      .map((value) => value.trim())
      .filter((value) => value.length >= 2)
      .slice(0, 5);
  }

  private extractComparisonMenuNames(
    input: string,
    classification: ChatClassification,
    intent: ParsedChatIntent,
  ): string[] {
    if (!this.isMenuComparisonRequest(input)) {
      return [];
    }

    if (intent.include.brands.length >= 2) {
      return [];
    }

    const geminiMenuNames = this.normalizeComparisonMenuNames(
      classification.menu_names,
      intent.include.menu_names,
    );

    if (geminiMenuNames.length >= 2) {
      return geminiMenuNames.slice(0, 5);
    }

    const fallbackMenuNames = this.normalizeComparisonMenuNames(
      ...[geminiMenuNames, this.extractComparisonMenuNamesFallback(input)],
    );

    return fallbackMenuNames.slice(0, 5);
  }

  private normalizeComparisonMenuNames(...groups: string[][]): string[] {
    const seen = new Set<string>();
    const normalizedNames: string[] = [];

    groups
      .flatMap((group) => group)
      .flatMap((value) =>
        value
          .split(/\s*(?:이랑|랑|하고|과|와|,|vs|VS)\s*/)
          .map((part) =>
            part
              .replace(/\s*(?:중(?:에서|에)?)$/g, '')
              .replace(
                /(?:중(?:에서)?|중에)?\s*(?:뭘|뭐|무엇|어느|어떤)?\s*(?:먹는\s*게|먹을까|먹지|먹어야\s*해|고르는\s*게|고를까|선택할까|추천해줘|추천|좋아|낫지|나아|골라줘).*$/g,
                '',
              )
              .replace(/\s*(?:이|가|을|를)$/g, '')
              .trim(),
          )
          .filter((part) => part.length >= 2),
      )
      .forEach((name) => {
        const key = this.normalizeComparisonMenuKey(name);

        if (!key || seen.has(key)) {
          return;
        }

        seen.add(key);
        normalizedNames.push(name);
      });

    return normalizedNames;
  }

  private isMenuComparisonRequest(input: string): boolean {
    const normalized = input.trim();

    if (!normalized) {
      return false;
    }

    const hasComparisonConnector =
      /(?:\S+)\s*(?:랑|하고|과|와|,|vs|VS)\s*(?:\S+)/.test(normalized) ||
      normalized.includes(' 중');
    const hasEllipticalChoice =
      /(?:\S+)\s+(?:\S+)\s+중(?:에서|에|에는)?\??$/.test(normalized);
    const asksChoice =
      /(?:뭐|무엇|어느|어떤|뭘|머)\s*(?:먹|고르|선택)/.test(normalized) ||
      /(?:낫|좋|추천|골라|먹는 게|먹을까|선택)/.test(normalized);
    const asksFeedbackOnly =
      /(?:먹어도\s*돼|괜찮아|어때|피드백|평가|판단)/.test(normalized) &&
      !/(?:중|골라|추천|낫|좋|먹을까|먹는 게)/.test(normalized);

    return (
      hasComparisonConnector &&
      (asksChoice || hasEllipticalChoice) &&
      !asksFeedbackOnly
    );
  }

  private extractComparisonMenuNamesFallback(input: string): string[] {
    const ellipticalChoiceMatch = input
      .replace(/[?？!！]/g, '')
      .trim()
      .match(/^(.+?)\s+중(?:에서|에|에는)?$/);

    if (ellipticalChoiceMatch?.[1]) {
      return ellipticalChoiceMatch[1]
        .split(/\s*(?:랑|하고|과|와|,|vs|VS)\s*|\s+/)
        .map((value) =>
          value
            .replace(/^(?:나는|나|오늘|지금|이번에)\s+/g, '')
            .trim(),
        )
        .filter((value) => value.length >= 2)
        .slice(0, 5);
    }

    const withoutQuestion = input
      .replace(
        /(?:중(?:에서)?|중에)?\s*(?:뭘|뭐|무엇|어느|어떤)?\s*(?:먹는\s*게|먹을까|먹지|먹어야\s*해|고르는\s*게|고를까|선택할까|추천해줘|추천|좋아|낫지|나아|골라줘).*/g,
        '',
      )
      .replace(/[?？!！]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();

    if (!withoutQuestion) {
      return [];
    }

    return withoutQuestion
      .split(/\s*(?:랑|하고|과|와|,|vs|VS)\s*/)
      .map((value) =>
        value
          .replace(/^(?:나는|나|오늘|지금|이번에)\s+/g, '')
          .replace(/\s*(?:중(?:에서|에)?)$/g, '')
          .trim(),
      )
      .filter((value) => value.length >= 2)
      .slice(0, 5);
  }

  private applyComparisonMenuNamesToIntent(
    intent: ParsedChatIntent,
    menuNames: string[],
  ): ParsedChatIntent {
    return {
      ...intent,
      normalized_request: `${menuNames.join(', ')} 중 현재 목표에 더 맞는 메뉴 비교 추천`,
      include: {
        ...intent.include,
        menu_names: this.mergeTextValues(intent.include.menu_names, menuNames),
      },
    };
  }

  private async parseIntentWithGemini(
    input: string,
    userInfo: UserInfoEntity,
    chatContext?: ChatContextSummary,
    classification?: ChatClassification,
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
- 사용자가 여러 브랜드/매장 후보 중 하나를 고르는 요청이면 desired_brand는 반드시 null로 두고, 모든 브랜드/매장명은 include.brands에 넣어
- 예: "맥도날드, 버거킹, 롯데리아 중 어디갈까?" -> desired_brand=null, include.brands=["맥도날드","버거킹","롯데리아"]
- nutrition_focus: 다음 값만 사용 ["high_protein","high_fat","low_carb","low_sugar","light_meal","hearty_meal"]
- amount_preference: "light" | "regular" | "hearty" | null
- keywords: 추천 검색에 도움이 되는 핵심 키워드 배열
- normalized_request: 사용자의 의도를 한 문장으로 정리
- include: 반드시 포함해야 하는 조건. "샐러드만", "버거 중에서", "싸이버거로" 같은 조건
- "싸이버거랑 빅맥 중 뭐 먹을까?"처럼 구체적인 음식 메뉴명 비교는 include.menu_names에 넣어
- "맥도날드, 버거킹, 롯데리아 중 어디갈까?"처럼 브랜드/매장/장소/음식 카테고리를 고르는 요청은 include.menu_names를 비우고, 브랜드/매장명은 include.brands에 넣고 desired_brand는 null로 둬
- exclude: 반드시 제외해야 하는 조건. "싸이버거 제외", "음료 빼고", "치킨 말고" 같은 조건
- nutrition_constraints: 명확한 수치 조건만 넣고, "낮은/많은"처럼 수치가 없으면 null
- caffeine_allowed: "카페인 없는", "디카페인", "카페인 빼고"는 false, 명확하지 않으면 null
- 최근 대화 요약이 있고 사용자가 "그거", "아까", "다른 거", "말고", "비슷한 걸로"처럼 이전 대화를 가리키면 최근 대화의 조건/메뉴를 반영해 normalized_request, include, exclude를 채워
- context_action이 "exclude_previous_recommendations"이면 이전 추천 메뉴명은 exclude.menu_names에 넣어
- context_action이 "reuse_previous_conditions"이면 이전 요청의 브랜드/카테고리/끼니 맥락은 유지하고, 현재 입력에서 바꾼 조건만 덮어써
- context_action이 "evaluate_previous_menus"이면 추천 intent가 아니라 피드백용 메뉴명을 유지해야 하므로 이전 메뉴명을 참고해

사용자 프로필:
goal=${this.goalToLabel(userInfo.goal)}
target_calories=${userInfo.target_calories}
target_ratio=${JSON.stringify(this.normalizeTargetRatio(userInfo.target_ratio))}

최근 대화 요약:
${JSON.stringify(chatContext ?? null)}

채팅 분류:
${JSON.stringify(classification ?? null)}

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
      const intent: ParsedChatIntent = {
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
          this.normalizeCategoryKeyword(
            this.asNonEmptyString(data.desired_category),
          ) ?? fallback.desired_category,
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

      return this.normalizeMultiBrandSelectionIntent(intent);
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
    return null;
  }

  private extractCategoryKeyword(input: string): string | null {
    return this.normalizeCategoryKeyword(input);
  }

  private normalizeCategoryKeyword(input: string | null): string | null {
    if (!input) {
      return null;
    }

    const compact = input.replace(/\s+/g, '').toLowerCase();
    const categoryAliases: Array<{ category: string; aliases: string[] }> = [
      { category: '버거', aliases: ['햄버거', '버거', '버거류', '버거종류'] },
      { category: '샌드위치', aliases: ['샌드위치', '샌드위치류'] },
      { category: '도시락', aliases: ['도시락', '도시락류'] },
      { category: '샐러드', aliases: ['샐러드', '샐러드류'] },
      { category: '치킨', aliases: ['치킨', '치킨류'] },
      { category: '라면', aliases: ['라면', '라멘', '면류'] },
    ];

    return (
      categoryAliases.find(({ aliases }) =>
        aliases.some((alias) => compact.includes(alias)),
      )?.category ?? null
    );
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

  private async generateGeneralAnswerWithGemini(params: {
    input: string;
    userInfo: UserInfoEntity;
    dailyNutrition: DailyNutrition;
    basis: ReturnType<ChatService['buildRecommendationBasis']>;
  }): Promise<{ intro_message: string; general_answer: string }> {
    const prompt = `
사용자의 범용 질문에 답변하는 한국어 JSON object를 작성해줘.
반드시 JSON만 반환하고 코드펜스는 쓰지 마.

작성 규칙:
- system_instruction의 코치 페르소나, 반말 해체, 결론 우선 구조를 반드시 적용해
- intro_message와 general_answer 모두 같은 페르소나/말투로 작성해
- 존댓말, 해요체, 하십시오체 금지. "좋아요", "가능합니다", "추천해요", "드릴게요" 같은 표현은 쓰지 마
- 딱딱한 해라체/문어체 금지. "~다.", "~이다.", "~한다.", "~하라."로 끝내지 마
- 문장은 "~야.", "~있어.", "~해.", "~먹어.", "~가.", "~나아.", "~괜찮아." 같은 편한 반말로 끝내
- 특정 메뉴를 추천하거나 DB 메뉴를 고르지 말고, 사용자의 질문에 직접 답해
- 질문이 식단/영양/운동/생활습관과 관련될 때만 사용자의 목표, 오늘 섭취 흐름, 남은 섭취량을 자연스럽게 참고해
- 질문이 식단/영양과 관련 없으면 사용자 식단 정보는 언급하지 말고, system_instruction의 코치 페르소나와 반말 해체를 유지해
- 질문이 식단/영양과 관련 없으면 건강/식단/운동 이야기로 억지 전환하지 말고 질문 자체에 답해
- 실시간 날씨, 최신 뉴스, 주가처럼 현재 조회가 필요한 질문은 실시간 조회가 어렵다고 짧게 말하고, 사용자가 확인할 수 있는 방법을 안내해
- target_meal_calories 같은 서비스 내부 계산 기준이나 "이번 끼니 목표 칼로리" 표현은 사용자에게 말하지 않기
- intro_message는 1~2문장으로 짧게 작성
- general_answer는 사용자가 길게 설명해달라고 요청하지 않는 한 3~4문장 이내로 작성
- 핵심 결론을 먼저 말하고, 이어서 짧은 이유나 실행 팁을 자연문으로 덧붙여
- "[결론]", "[이유]", "[Action]" 같은 라벨 텍스트는 쓰지 마
- intro_message와 general_answer 모두 "안녕하세요", "안녕하세요!", "반가워요" 같은 인사 문구로 시작하지 않기
- 2~5개의 짧은 문단으로 줄바꿈을 넣고, JSON 문자열 안의 줄바꿈은 \\n으로 포함
- 실천 팁이 필요한 질문이면 1~3개 정도만 포함
- 과장, 의학적 단정, 진단/처방처럼 들리는 표현은 피하기
- 질병, 약물, 임신, 섭식장애 등 고위험 상황은 전문가 상담을 권하기
- 죄책감을 자극하지 말고, 지속 가능한 선택을 돕는 현실적인 톤으로 작성
- 느낌표는 필요할 때만 최대 1개 사용

사용자 질문:
${params.input}

사용자 정보:
${JSON.stringify({
  goal: this.goalToLabel(params.userInfo.goal),
  target_calories: params.userInfo.target_calories,
  target_ratio: this.normalizeTargetRatio(params.userInfo.target_ratio),
  consumed_today: {
    calories: roundToOneDecimal(params.dailyNutrition.calories),
    carbs: roundToOneDecimal(params.dailyNutrition.carbs),
    protein: roundToOneDecimal(params.dailyNutrition.protein),
    fat: roundToOneDecimal(params.dailyNutrition.fat),
  },
  remaining_today: {
    calories: roundToOneDecimal(params.basis.remainingCalories),
    carbs: roundToOneDecimal(params.basis.remainingMacros.carbs),
    protein: roundToOneDecimal(params.basis.remainingMacros.protein),
    fat: roundToOneDecimal(params.basis.remainingMacros.fat),
  },
})}

반환 shape:
{
  "intro_message": "string",
  "general_answer": "string"
}
`.trim();

    const data = await this.callGeminiJson(prompt, {
      context: 'general-answer',
      systemInstruction: CHAT_RESPONSE_SYSTEM_INSTRUCTION,
    });
    const introMessage =
      this.asNonEmptyString(data?.intro_message) ??
      '핵심부터 정리할게.';
    const generalAnswer =
      this.asNonEmptyString(data?.general_answer) ??
      '지금 질문은 일반 질문으로 분류됐어.\n\n원하는 범위를 조금만 더 구체적으로 말해줘.\n그 기준에 맞춰 바로 정리해줄게.';

    return {
      intro_message: introMessage.slice(0, 300),
      general_answer: generalAnswer.slice(0, 1200),
    };
  }

  private async generateIntroMessageWithGemini(params: {
    source: ChatIntroMessageSource;
    input: string;
    userInfo: UserInfoEntity;
    dailyNutrition: DailyNutrition;
    basis: ReturnType<ChatService['buildRecommendationBasis']>;
    fallback: string;
    intent?: ParsedChatIntent;
    rankedMenus?: RankedMenu[];
    recognizedCandidates?: MenuRecognitionCandidate[];
    feedback?: ChatFeedbackResponseDto;
    matchedMenus?: Array<{ inputMenuName: string; menu: MenuEntity }>;
    extractedItems?: unknown[];
    chatContext?: ChatContextSummary;
  }): Promise<string> {
    const sourceLabelMap: Record<ChatIntroMessageSource, string> = {
      text_recommendation: '사용자 텍스트 기반 메뉴 추천',
      text_feedback: '사용자 텍스트 기반 메뉴 피드백',
      menu_board_recommendation: '메뉴판 사진 기반 메뉴 추천',
      food_image_feedback: '음식 사진 기반 메뉴 피드백',
    };

    const isImageSource =
      params.source === 'menu_board_recommendation' ||
      params.source === 'food_image_feedback';
    const rankedMenuPayload = params.rankedMenus?.map(
      ({ menu, score }, index) => ({
        rank: index + 1,
        menu_id: menu.id,
        menu: menu.name,
        brand: isImageSource ? null : menu.brand,
        category: menu.category,
        calories: roundNullableToOneDecimal(menu.calories) ?? 0,
        score: roundToOneDecimal(score.finalScore),
      }),
    );
    const matchedMenuPayload = params.matchedMenus?.map(
      ({ inputMenuName, menu }, index) => ({
        rank: index + 1,
        input_menu_name: inputMenuName,
        menu_id: menu.id,
        menu: menu.name,
        brand: isImageSource ? null : menu.brand,
        category: menu.category,
        calories: roundNullableToOneDecimal(menu.calories) ?? 0,
      }),
    );
    const promptPayloadReplacer = (key: string, value: unknown) =>
      isImageSource && key === 'brand' ? undefined : value;

    const prompt = `
사용자에게 채팅 응답의 첫 문장 intro_message를 한국어 JSON object로 작성해줘.
반드시 JSON만 반환하고 코드펜스는 쓰지 마.

작성 규칙:
- intro_message는 90~200자 정도의 자연스러운 한국어 답변
- system_instruction의 코치 페르소나, 반말 해체, 결론 우선 구조를 반드시 적용
- 범용 질문 답변과 같은 페르소나/말투로 작성해
- 존댓말, 해요체, 하십시오체 금지. "좋아요", "가능합니다", "추천해요", "드릴게요" 같은 표현은 쓰지 마
- 딱딱한 해라체/문어체 금지. "~다.", "~이다.", "~한다.", "~하라."로 끝내지 마
- 문장은 "~야.", "~있어.", "~해.", "~먹어.", "~가.", "~나아.", "~괜찮아." 같은 편한 반말로 끝내
- 핵심 결론을 먼저 말하고, 이어서 짧은 이유나 실행 팁을 자연문으로 덧붙여
- "[결론]", "[이유]", "[Action]" 같은 라벨 텍스트는 쓰지 마
- 한 문장으로 길게 쓰지 말고, 1~2개의 짧은 문단으로 줄바꿈을 넣어 작성
- JSON 문자열 안에 줄바꿈은 \\n으로 포함
- 사용자가 "먹어도 돼?", "괜찮아?"처럼 물으면 먼저 명확하게 답하고, 그 뒤 조건과 조절법을 설명
- "안녕하세요", "안녕하세요!", "반가워요" 같은 인사 문구로 시작하지 않기
- 딱딱한 템플릿처럼 쓰지 말고, 실제 코치가 말하듯 현실적인 톤으로 작성
- 메뉴명/목표/오늘 섭취 흐름/사진 인식 맥락 중 중요한 것을 자연스럽게 반영
- 추천 메뉴나 피드백 메뉴명은 가장 중요한 상위 1개만 언급
- 나머지 분량은 현재 목표와의 관계 또는 현실적인 조절 팁 중 핵심 1가지만 짧게 말하기
- target_meal_calories 같은 서비스 내부 계산 기준이나 "이번 끼니 목표 칼로리" 표현은 사용자에게 말하지 않기
- 단품/조합/다음 끼니 조절 같은 실행 가능한 팁은 1개만 포함
- 과장, 의학적 단정, 확정적인 건강 효과 표현은 피하기
- 죄책감을 자극하지 말고, 지속 가능한 선택을 돕는 방향으로 작성
- 장황한 응원 문구나 반복 설명은 쓰지 않기
- 느낌표는 필요할 때만 최대 1개 사용
- 사용자 텍스트의 종류가 메뉴 피드백이어도 위 분량, 줄바꿈, 상위 1개 메뉴명 언급, 내부 계산 기준 미노출 규칙을 동일하게 적용
- 사용자 텍스트의 종류가 이미지 기반이면 특정 브랜드명을 절대 언급하지 않기
- 이미지 기반 답변에서 "보내주신 사진은 {브랜드}의 {메뉴}로 보이네요"처럼 브랜드를 추정하거나 단정하는 표현 금지

사용자 텍스트의 종류:
${sourceLabelMap[params.source]}

사용자 입력:
${params.input}

최근 대화 요약:
${JSON.stringify(params.chatContext ?? null, promptPayloadReplacer)}

사용자 정보:
${JSON.stringify(
  {
    goal: this.goalToLabel(params.userInfo.goal),
    target_calories: params.userInfo.target_calories,
    target_ratio: this.normalizeTargetRatio(params.userInfo.target_ratio),
    consumed_today: {
      calories: roundToOneDecimal(params.dailyNutrition.calories),
      carbs: roundToOneDecimal(params.dailyNutrition.carbs),
      protein: roundToOneDecimal(params.dailyNutrition.protein),
      fat: roundToOneDecimal(params.dailyNutrition.fat),
    },
    remaining_today: {
      calories: roundToOneDecimal(params.basis.remainingCalories),
      carbs: roundToOneDecimal(params.basis.remainingMacros.carbs),
      protein: roundToOneDecimal(params.basis.remainingMacros.protein),
      fat: roundToOneDecimal(params.basis.remainingMacros.fat),
    },
  },
  promptPayloadReplacer,
)}

정규화 의도:
${JSON.stringify(params.intent ?? null, promptPayloadReplacer)}

알고리즘 추천 메뉴 랭크:
${JSON.stringify(rankedMenuPayload ?? null, promptPayloadReplacer)}

사진/텍스트에서 추출한 후보 랭크:
${JSON.stringify(
  params.recognizedCandidates ?? params.extractedItems ?? null,
  promptPayloadReplacer,
)}

피드백 메뉴 랭크:
${JSON.stringify(matchedMenuPayload ?? null, promptPayloadReplacer)}

피드백 결과:
${JSON.stringify(params.feedback ?? null, promptPayloadReplacer)}

반환 shape:
{
  "intro_message": "string"
}
`.trim();

    try {
      const data = await this.callGeminiJson(prompt, {
        context: 'intro-message',
        systemInstruction: CHAT_RESPONSE_SYSTEM_INSTRUCTION,
      });
      const introMessage = this.asNonEmptyString(data?.intro_message);

      if (!introMessage) {
        return params.fallback;
      }

      return introMessage.slice(0, 300);
    } catch {
      return params.fallback;
    }
  }

  private async generateRecommendationPresentationWithGemini(params: {
    source: ChatIntroMessageSource;
    input: string;
    userInfo: UserInfoEntity;
    dailyNutrition: DailyNutrition;
    basis: ReturnType<ChatService['buildRecommendationBasis']>;
    rankedMenus: RankedMenu[];
    fallbackIntro: string;
    intent?: ParsedChatIntent;
    recognizedCandidates?: MenuRecognitionCandidate[];
    chatContext?: ChatContextSummary;
  }): Promise<{ intro_message: string }> {
    const sourceLabelMap: Record<ChatIntroMessageSource, string> = {
      text_recommendation: '사용자 텍스트 기반 메뉴 추천',
      text_feedback: '사용자 텍스트 기반 메뉴 피드백',
      menu_board_recommendation: '메뉴판 사진 기반 메뉴 추천',
      food_image_feedback: '음식 사진 기반 메뉴 피드백',
    };
    const isImageSource =
      params.source === 'menu_board_recommendation' ||
      params.source === 'food_image_feedback';
    const promptPayloadReplacer = (key: string, value: unknown) =>
      isImageSource && key === 'brand' ? undefined : value;
    const menusPayload = params.rankedMenus.map(({ menu, score }, index) => ({
      rank: index + 1,
      menu_id: menu.id,
      menu: menu.name,
      cleaned_menu: this.toIntroDisplayMenuName(menu.name),
      brand: isImageSource ? null : menu.brand,
      category: menu.category,
      amount: this.formatAmount(menu),
      calories: roundNullableToOneDecimal(menu.calories) ?? 0,
      carbs: roundToOneDecimal(this.getEffectiveCarbs(menu)),
      protein: roundNullableToOneDecimal(menu.protein) ?? 0,
      fat: roundToOneDecimal(this.getEffectiveFat(menu)),
      sugars: roundNullableToOneDecimal(menu.sugars) ?? 0,
      score: roundToOneDecimal(score.finalScore),
    }));
    const prompt = `
추천 응답에 사용할 intro_message를 한국어 JSON object로 작성해줘.
반드시 JSON만 반환하고 코드펜스는 쓰지 마.

작성 규칙:
- 90~200자 정도의 자연스러운 한국어 답변
- system_instruction의 코치 페르소나, 반말 해체, 결론 우선 구조를 반드시 적용
- 범용 질문 답변과 같은 페르소나/말투로 작성해
- 존댓말, 해요체, 하십시오체 금지. "좋아요", "가능합니다", "추천해요", "드릴게요" 같은 표현은 쓰지 마
- 딱딱한 해라체/문어체 금지. "~다.", "~이다.", "~한다.", "~하라."로 끝내지 마
- 문장은 "~야.", "~있어.", "~해.", "~먹어.", "~가.", "~나아.", "~괜찮아." 같은 편한 반말로 끝내
- 핵심 결론을 먼저 말하고, 이어서 짧은 이유나 실행 팁을 자연문으로 덧붙여
- "[결론]", "[이유]", "[Action]" 같은 라벨 텍스트는 쓰지 마
- 한 문장으로 길게 쓰지 말고, 1~2개의 짧은 문단으로 줄바꿈을 넣어 작성
- JSON 문자열 안에 줄바꿈은 \\n으로 포함
- "안녕하세요", "반가워요" 같은 인사 문구로 시작하지 않기
- 추천 메뉴명은 가장 중요한 상위 1개만 언급
- 후보 메뉴의 menu는 DB 원본명이고, cleaned_menu는 DB prefix/괄호 정도만 제거한 참고 이름이야
- intro_message에서 메뉴명을 언급할 때는 menu와 cleaned_menu를 보고 네가 직접 사용자에게 자연스러운 대표 음식명으로 정제해 말해
- "(식약처_음식)", "(식약처_가공)" 같은 DB prefix, 브랜드/제품명처럼 긴 원본명, 광고 문구형 이름은 절대 그대로 말하지 마
- 원본명이 길거나 제품명/문장형이면 가장 가까운 일반 음식명으로 말해. 예: "두마리같은한마리치킨주세요 닭튀김"은 "치킨", "옛날중국집간짜장곱빼기"는 "짜장면"처럼 말해
- 나머지는 현재 목표와의 관계 또는 현실적인 조절 팁 중 핵심 1가지만 짧게 말하기
- target_meal_calories 같은 서비스 내부 계산 기준이나 "이번 끼니 목표 칼로리" 표현은 사용자에게 말하지 않기
- 과장, 의학적 단정, 확정적인 건강 효과 표현은 피하기
- 죄책감을 자극하지 말고, 지속 가능한 선택을 돕는 방향으로 작성
- 느낌표는 필요할 때만 최대 1개 사용
- 사용자 텍스트의 종류가 이미지 기반이면 특정 브랜드명을 절대 언급하지 않기

사용자 텍스트의 종류:
${sourceLabelMap[params.source]}

사용자 입력:
${params.input}

최근 대화 요약:
${JSON.stringify(params.chatContext ?? null, promptPayloadReplacer)}

사용자 정보:
${JSON.stringify(
  {
    goal: this.goalToLabel(params.userInfo.goal),
    target_calories: params.userInfo.target_calories,
    target_ratio: this.normalizeTargetRatio(params.userInfo.target_ratio),
    consumed_today: {
      calories: roundToOneDecimal(params.dailyNutrition.calories),
      carbs: roundToOneDecimal(params.dailyNutrition.carbs),
      protein: roundToOneDecimal(params.dailyNutrition.protein),
      fat: roundToOneDecimal(params.dailyNutrition.fat),
    },
    remaining_today: {
      calories: roundToOneDecimal(params.basis.remainingCalories),
      carbs: roundToOneDecimal(params.basis.remainingMacros.carbs),
      protein: roundToOneDecimal(params.basis.remainingMacros.protein),
      fat: roundToOneDecimal(params.basis.remainingMacros.fat),
    },
  },
  promptPayloadReplacer,
)}

정규화 의도:
${JSON.stringify(params.intent ?? null, promptPayloadReplacer)}

사진/텍스트에서 추출한 후보 랭크:
${JSON.stringify(params.recognizedCandidates ?? null, promptPayloadReplacer)}

후보 메뉴:
${JSON.stringify(menusPayload, promptPayloadReplacer)}

반환 shape:
{
  "intro_message": "string"
}
`.trim();

    try {
      const data = await this.callGeminiJson(prompt, {
        context: 'recommendation-presentation',
        systemInstruction: CHAT_RESPONSE_SYSTEM_INSTRUCTION,
      });
      const introMessage =
        this.asNonEmptyString(data?.intro_message) ?? params.fallbackIntro;

      return {
        intro_message: introMessage.slice(0, 300),
      };
    } catch {
      return {
        intro_message: params.fallbackIntro,
      };
    }
  }

  private async selectFinalRankedMenus(params: {
    input: string;
    intent: ParsedChatIntent;
    userInfo: UserInfoEntity;
    basis: ReturnType<ChatService['buildRecommendationBasis']>;
    localRankedMenus: RankedMenu[];
    introSource: ChatIntroMessageSource;
    timing?: ChatTimingLogger;
  }): Promise<RankedMenu[]> {
    const localTopMenus = params.localRankedMenus.slice(0, 10);

    if (
      params.introSource !== 'text_recommendation' ||
      params.localRankedMenus.length <= 10 ||
      !this.isGeminiMenuRerankEnabled()
    ) {
      params.timing?.mark('gemini_rerank_skipped');
      return localTopMenus;
    }

    const selectedMenuIds = await this.selectFinalMenuIdsWithGemini(params);
    params.timing?.mark('gemini_rerank_completed', {
      selectedCount: selectedMenuIds.length,
    });

    if (selectedMenuIds.length === 0) {
      return localTopMenus;
    }

    const rankedMenuMap = new Map(
      params.localRankedMenus.map((rankedMenu) => [
        rankedMenu.menu.id,
        rankedMenu,
      ]),
    );
    const finalMenus: RankedMenu[] = [];

    selectedMenuIds.forEach((menuId) => {
      const rankedMenu = rankedMenuMap.get(menuId);

      if (
        rankedMenu &&
        !finalMenus.some((selected) => selected.menu.id === menuId)
      ) {
        finalMenus.push(rankedMenu);
      }
    });

    params.localRankedMenus.forEach((rankedMenu) => {
      if (
        finalMenus.length < 10 &&
        !finalMenus.some((selected) => selected.menu.id === rankedMenu.menu.id)
      ) {
        finalMenus.push(rankedMenu);
      }
    });

    return finalMenus.slice(0, 10);
  }

  private async selectFinalMenuIdsWithGemini(params: {
    input: string;
    intent: ParsedChatIntent;
    userInfo: UserInfoEntity;
    basis: ReturnType<ChatService['buildRecommendationBasis']>;
    localRankedMenus: RankedMenu[];
  }): Promise<number[]> {
    const candidateLimit = this.getGeminiRerankCandidateLimit();
    const candidates = params.localRankedMenus
      .slice(0, candidateLimit)
      .map(({ menu, score }, index) => ({
        local_rank: index + 1,
        menu_id: menu.id,
        menu: menu.name,
        brand: menu.brand,
        category: menu.category,
        calories: roundNullableToOneDecimal(menu.calories) ?? 0,
        protein: roundNullableToOneDecimal(menu.protein) ?? 0,
        internal_score: roundToOneDecimal(score.finalScore),
      }));
    const prompt = `
아래 후보 메뉴 중 사용자 문맥에 가장 잘 맞는 최종 추천 메뉴를 골라 한국어 JSON object로 반환해줘.
반드시 JSON만 반환하고 코드펜스는 쓰지 마.

선택 규칙:
- candidate_menus 안에 있는 menu_id만 사용
- 최종 추천은 최대 10개
- internal_score는 칼로리, 탄단지, 목표, 포만감, 당류, 의도 매칭을 종합한 내부 점수야
- 세부 점수는 생략되어 있으니 internal_score를 중요한 기준으로 참고해
- 사용자의 표현, 장소, 가볍게/든든하게 같은 문맥을 함께 고려해 순서를 조정해
- 내부 점수가 현저히 낮은 메뉴를 특별한 이유 없이 상위로 올리지 마
- 사용자가 특정 브랜드/카테고리를 말했으면 그 문맥을 우선해
- 다양성을 위해 거의 같은 메뉴가 여러 개면 더 적합한 것만 상위에 둬
- 설명 문장은 작성하지 말고 menu_id 배열만 반환

사용자 입력:
${params.input}

정규화 의도:
${JSON.stringify(params.intent)}

사용자 정보:
${JSON.stringify({
  goal: this.goalToLabel(params.userInfo.goal),
  target_calories: params.userInfo.target_calories,
  target_ratio: this.normalizeTargetRatio(params.userInfo.target_ratio),
})}

추천 기준:
${JSON.stringify({
  remaining_calories: roundToOneDecimal(params.basis.remainingCalories),
  remaining_macros: {
    carbs: roundToOneDecimal(params.basis.remainingMacros.carbs),
    protein: roundToOneDecimal(params.basis.remainingMacros.protein),
    fat: roundToOneDecimal(params.basis.remainingMacros.fat),
  },
})}

candidate_menus:
${JSON.stringify(candidates)}

반환 shape:
{
  "selected_menu_ids": [1, 2, 3]
}
`.trim();

    try {
      const data = await this.callGeminiJson(prompt);
      const selectedMenuIds = Array.isArray(data?.selected_menu_ids)
        ? data.selected_menu_ids
            .map((menuId) => Number(menuId))
            .filter((menuId) => Number.isFinite(menuId))
        : [];
      const candidateMenuIdSet = new Set(
        candidates.map((candidate) => candidate.menu_id),
      );

      return selectedMenuIds
        .filter((menuId) => candidateMenuIdSet.has(menuId))
        .slice(0, 10);
    } catch {
      return [];
    }
  }

  private async callGeminiJson(
    prompt: string,
    options: {
      context?: string;
      timeoutMs?: number;
      systemInstruction?: string;
    } = {},
  ): Promise<any> {
    // Gemini 공통 호출부: JSON 응답 강제와 에러 변환을 한곳에서 처리합니다.
    const apiKey = process.env.GEMINI_API_KEY;
    const primaryModel = process.env.GEMINI_MODEL ?? DEFAULT_GEMINI_MODEL;
    const configuredFallbackModels = [
      ...(process.env.GEMINI_FALLBACK_MODELS
        ?.split(',')
        .map((model) => model.trim()) ?? []),
      process.env.GEMINI_FALLBACK_MODEL,
    ];
    const hasConfiguredFallbackModels =
      process.env.GEMINI_FALLBACK_MODELS !== undefined ||
      process.env.GEMINI_FALLBACK_MODEL !== undefined;
    const fallbackModels = hasConfiguredFallbackModels
      ? configuredFallbackModels
      : DEFAULT_GEMINI_FALLBACK_MODELS;
    const baseUrlOverride = process.env.GEMINI_BASE_URL;

    if (!apiKey) {
      console.log('[CHAT] GEMINI ENV CHECK', {
        GEMINI_API_KEY: this.maskSecret(process.env.GEMINI_API_KEY),
        GEMINI_MODEL: primaryModel,
      });
      throw new ServiceUnavailableException('GEMINI_API_KEY is not configured');
    }

    const attempts = Array.from(
      new Set(
        [
          primaryModel,
          ...fallbackModels,
          GEMINI_HIGH_DEMAND_FALLBACK_MODEL,
        ].filter(
          (model): model is string =>
            typeof model === 'string' && model.trim().length > 0,
        ),
      ),
    );

    for (const [index, model] of attempts.entries()) {
      const baseUrl = this.buildGeminiBaseUrl(model, baseUrlOverride);

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
              ...(options.systemInstruction
                ? {
                    system_instruction: {
                      parts: [{ text: options.systemInstruction }],
                    },
                  }
                : {}),
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
              timeout: options.timeoutMs ?? this.getGeminiTextTimeoutMs(),
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
        this.logGeminiError(
          index === 0
            ? (options.context ?? 'text-json')
            : `${options.context ?? 'text-json'}-fallback:${model}`,
          error,
        );

        if (
          index === attempts.length - 1 ||
          !this.shouldRetryGeminiWithFallback(error)
        ) {
          break;
        }
      }
    }

    throw new ServiceUnavailableException(
      'Gemini recommendation pipeline is unavailable',
    );
  }

  private getGeminiTextTimeoutMs(): number {
    const parsed = Number(process.env.GEMINI_TEXT_TIMEOUT_MS ?? 45000);

    if (!Number.isFinite(parsed)) {
      return 45000;
    }

    return Math.min(Math.max(parsed, 5000), 120000);
  }

  private async callGeminiJsonWithImage(
    prompt: string,
    file: Express.Multer.File,
  ): Promise<any> {
    const apiKey = process.env.GEMINI_API_KEY;
    const primaryModel =
      process.env.GEMINI_IMAGE_MODEL ??
      process.env.GEMINI_MODEL ??
      DEFAULT_GEMINI_MODEL;
    const configuredFallbackModels = [
      ...(process.env.GEMINI_IMAGE_FALLBACK_MODELS
        ?.split(',')
        .map((model) => model.trim()) ?? []),
      process.env.GEMINI_IMAGE_FALLBACK_MODEL,
    ];
    const hasConfiguredFallbackModels =
      process.env.GEMINI_IMAGE_FALLBACK_MODELS !== undefined ||
      process.env.GEMINI_IMAGE_FALLBACK_MODEL !== undefined;
    const fallbackModels = hasConfiguredFallbackModels
      ? configuredFallbackModels
      : DEFAULT_GEMINI_IMAGE_FALLBACK_MODELS;
    const baseUrlOverride =
      process.env.GEMINI_IMAGE_BASE_URL ?? process.env.GEMINI_BASE_URL;

    if (!apiKey) {
      console.log('[CHAT] GEMINI ENV CHECK', {
        GEMINI_API_KEY: this.maskSecret(process.env.GEMINI_API_KEY),
        GEMINI_MODEL: primaryModel,
      });
      throw new ServiceUnavailableException('GEMINI_API_KEY is not configured');
    }

    const attempts = Array.from(
      new Set(
        [
          primaryModel,
          ...fallbackModels,
          GEMINI_HIGH_DEMAND_FALLBACK_MODEL,
        ].filter(
          (model): model is string =>
            typeof model === 'string' && model.trim().length > 0,
        ),
      ),
    );
    for (const [index, model] of attempts.entries()) {
      const baseUrl = this.buildGeminiBaseUrl(model, baseUrlOverride);

      try {
        return await this.postGeminiImageJson(prompt, file, apiKey, baseUrl);
      } catch (error) {
        this.logGeminiError(
          index === 0 ? 'image-json' : `image-json-fallback:${model}`,
          error,
        );

        if (
          index === attempts.length - 1 ||
          !this.shouldRetryGeminiWithFallback(error)
        ) {
          break;
        }
      }
    }

    throw new ServiceUnavailableException(
      'Gemini recommendation pipeline is unavailable',
    );
  }

  private async postGeminiImageJson(
    prompt: string,
    file: Express.Multer.File,
    apiKey: string,
    baseUrl: string,
  ): Promise<any> {
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
      throw error;
    }
  }

  private async uploadChatImage(
    user: UserEntity,
    file: Express.Multer.File,
    imageType: 'menu-board' | 'food-image-feedback',
  ): Promise<string> {
    const date = new Date().toISOString().slice(0, 10).replace(/-/g, '');
    const randomString = Math.random().toString(36).substring(2, 12);
    const fileExtension = this.getImageExtension(file.mimetype);
    const fileKey = `chat-images/${imageType}/${user.id}/${date}/${randomString}.${fileExtension}`;

    await this.s3.send(
      new PutObjectCommand({
        Bucket: this.bucketName,
        Key: fileKey,
        Body: file.buffer,
        ContentType: file.mimetype,
      }),
    );

    return `https://${this.bucketName}.s3.${process.env.AWS_REGION}.amazonaws.com/${fileKey}`;
  }

  private getImageExtension(mimeType?: string): string {
    switch (mimeType) {
      case 'image/jpeg':
      case 'image/jpg':
        return 'jpg';
      case 'image/png':
        return 'png';
      case 'image/webp':
        return 'webp';
      case 'image/heic':
        return 'heic';
      default:
        return 'bin';
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
    const brands = this.normalizeFreeTextArray(source.brands, fallback.brands);
    const rawCategories = this.normalizeFreeTextArray(
      source.categories,
      fallback.categories,
    );
    const rawMenuNames = this.normalizeFreeTextArray(
      source.menu_names,
      fallback.menu_names,
    );
    const rawKeywords = this.normalizeFreeTextArray(
      source.keywords,
      fallback.keywords,
    );
    const categories = Array.from(
      new Set(
        [
          ...rawCategories
            .map(
              (category) => this.normalizeCategoryKeyword(category) ?? category,
            )
            .filter((category) => category.length >= 2),
          ...rawMenuNames
            .map((menuName) => this.normalizeCategoryKeyword(menuName))
            .filter((category): category is string => !!category),
          ...rawKeywords
            .map((keyword) => this.normalizeCategoryKeyword(keyword))
            .filter((category): category is string => !!category),
        ],
      ),
    );
    const menuNames = rawMenuNames.filter(
      (menuName) => !this.normalizeCategoryKeyword(menuName),
    );
    const keywords = rawKeywords.filter(
      (keyword) => !this.normalizeCategoryKeyword(keyword),
    );

    return {
      brands,
      categories,
      menu_names: menuNames,
      keywords,
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
