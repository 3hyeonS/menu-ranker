import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
  Optional,
  ServiceUnavailableException,
  UnauthorizedException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Between, Brackets, In, LessThan, Repository } from 'typeorm';
import { JwtService } from '@nestjs/jwt';
import { HttpService } from '@nestjs/axios';
import { firstValueFrom } from 'rxjs';
import { UserEntity } from '../auth/entity/user/user.entity';
import { UserInfoEntity } from '../auth/entity/user/userInfo.entity';
import { MenuEntity } from './entity/menu.entity';
import { SearchMenuRequestDto } from './dto/request-dto/search-menu-request-dto';
import { SearchResponseDto } from './dto/response-dto/search-response-dto';
import { MenuSimpleResponseDto } from './dto/response-dto/menu-simple-response-dto';
import { MenuListResponseDto } from './dto/response-dto/menu-list-response-dto';
import { MenuResponseDto } from './dto/response-dto/menu-response-dto';
import { RegisterMealRequestDto } from './dto/request-dto/register-meal-request-dto';
import { MealEntity } from './entity/meal.entity';
import { MealMenuEntity } from './entity/meal-menu.entity';
import { DeleteMealRequestDto } from './dto/request-dto/delete-meal-request-dto';
import { DateRequestDto } from './dto/request-dto/date-request-dto';
import { MealRecordResponseDto } from './dto/response-dto/meal-record-response-dto';
import {
  MealResponseDto,
  MealSetResponseDto,
} from './dto/response-dto/meal-response-dto';
import { MealRecordedDatesRequestDto } from './dto/request-dto/meal-recorded-dates-request-dto';
import { MealRecordedDatesResponseDto } from './dto/response-dto/meal-recorded-dates-response-dto';
import { RegisterMenuRequestDto } from './dto/request-dto/register-menu-request-dto';
import { SearchBrandResponseDto } from './dto/response-dto/search-brand-response-dto';
import { ModifyMenuRequestDto } from './dto/request-dto/modify-menu-request-dto';
import { RegisterWeightRequestDto } from './dto/request-dto/register-weight-request-dto';
import { RegisterStepsRequestDto } from './dto/request-dto/register-step-request-dto';
import { WeightStepsEntity } from './entity/weight-steps.entity';
import { WeightStepsResponseDto } from './dto/response-dto/weight-steps-response-dto';
import { MenuIdResponseDto } from './dto/response-dto/menu-id-response-dto';
import {
  roundNullableToOneDecimal,
  roundToOneDecimal,
} from '../utils/number.util';
import { BrandAddEntity } from './entity/brand-add.entity';
import {
  DeleteObjectCommand,
  PutObjectCommand,
  S3Client,
} from '@aws-sdk/client-s3';
import { MealImageUploadRequestDto } from './dto/request-dto/meal-image-upload-request-dto';
import { NutritionLabelRecognitionResponseDto } from './dto/response-dto/nutrition-label-recognition-response-dto';
import { NutritionLabelRecognition } from './types/nutrition-label-recognition.type';
import { FoodImageRecognitionResponseDto } from './dto/response-dto/food-image-recognition-response-dto';
import { MenuCsvImportResponseDto } from './dto/response-dto/menu-csv-import-response-dto';
import { MenuVectorService } from '../vector/menu-vector.service';
import {
  canonicalizeMenuSearchName,
  normalizeMenuSearchName,
  stripPublicMenuSourcePrefix,
} from '../utils/menu-name.util';
import { FolderEntity } from './entity/folder.entity';
import { FolderMenuEntity } from './entity/folder-menu.entity';
import { UpsertFolderRequestDto } from './dto/request-dto/upsert-folder-request-dto';
import { FolderIdResponseDto } from './dto/response-dto/folder-id-response-dto';
import { FolderListRequestDto } from './dto/request-dto/folder-list-request-dto';
import {
  FolderListItemResponseDto,
  FolderListResponseDto,
} from './dto/response-dto/folder-list-response-dto';
import { FolderDetailRequestDto } from './dto/request-dto/folder-detail-request-dto';
import { FolderDetailResponseDto } from './dto/response-dto/folder-detail-response-dto';
import { DeleteFolderRequestDto } from './dto/request-dto/delete-folder-request-dto';
import { MenuSetEntity } from './entity/menu-set.entity';
import { MenuSetMenuEntity } from './entity/menu-set-menu.entity';
import { MealSetEntity } from './entity/meal-set.entity';
import { UpsertMenuSetRequestDto } from './dto/request-dto/upsert-menu-set-request-dto';
import { MenuSetIdResponseDto } from './dto/response-dto/menu-set-id-response-dto';
import { MenuSetListRequestDto } from './dto/request-dto/menu-set-list-request-dto';
import {
  MenuSetListItemResponseDto,
  MenuSetListResponseDto,
} from './dto/response-dto/menu-set-list-response-dto';
import { MenuSetDetailRequestDto } from './dto/request-dto/menu-set-detail-request-dto';
import { MenuSetDetailResponseDto } from './dto/response-dto/menu-set-detail-response-dto';
import { DeleteMenuSetRequestDto } from './dto/request-dto/delete-menu-set-request-dto';
import { WorkoutEntity, WorkoutType } from './entity/workout.entity';
import { WorkoutRecordEntity } from './entity/workout-record.entity';
import { WorkoutRecordSetEntity } from './entity/workout-record-set.entity';
import { GetWorkoutRecordRequestDto } from './dto/request-dto/get-workout-record-request-dto';
import { DeleteWorkoutRecordRequestDto } from './dto/request-dto/delete-workout-record-request-dto';
import { SearchWorkoutRequestDto } from './dto/request-dto/search-workout-request-dto';
import { WorkoutDetailRequestDto } from './dto/request-dto/workout-detail-request-dto';
import { UpsertWorkoutRecordRequestDto } from './dto/request-dto/upsert-workout-record-request-dto';
import { WorkoutIdResponseDto } from './dto/response-dto/workout-id-response-dto';
import {
  WorkoutRecordItemResponseDto,
  WorkoutRecordResponseDto,
  WorkoutRecordSetResponseDto,
} from './dto/response-dto/workout-record-response-dto';
import {
  WorkoutSearchItemResponseDto,
  WorkoutSearchResponseDto,
} from './dto/response-dto/workout-search-response-dto';
import { WorkoutDetailResponseDto } from './dto/response-dto/workout-detail-response-dto';

const FOOD_IMAGE_RECOGNITION_FAILURE_MESSAGES = {
  LOW_IMAGE_QUALITY: 'food image quality is too low',
  FOOD_TOO_SMALL: 'food in image is too small',
  TOO_BLURRY: 'food image is too blurry',
  POOR_LIGHTING: 'food image lighting is too poor',
  FOOD_OCCLUDED: 'food is occluded or cut off',
  NO_FOOD_DETECTED: 'no food detected in image',
  NO_MATCHING_MENU: 'no recognizable menu matched candidates',
} as const;
const DEFAULT_GEMINI_MODEL = 'gemini-3.1-flash-lite';
const DEFAULT_GEMINI_IMAGE_FALLBACK_MODELS = ['gemini-2.5-flash-lite'];
const GEMINI_HIGH_DEMAND_FALLBACK_MODEL = 'gemini-2.5-flash-lite';

type FoodImageRecognitionFailureReason =
  keyof typeof FOOD_IMAGE_RECOGNITION_FAILURE_MESSAGES;

type HomeFoodImageRecognitionCandidate = {
  id: number;
  name: string;
  brand: string | null;
  category: string | null;
  weight: number | null;
};

type HomeFoodImageCandidateGroup = {
  foodIndex: number;
  foodName: string;
  candidates: HomeFoodImageRecognitionCandidate[];
};

type AlternativeNutritionGoal =
  | 'lowCalorie'
  | 'highProtein'
  | 'lowSugar'
  | 'meal'
  | 'light';

type AlternativeSearchIntent = {
  families: string[];
  categories: string[];
  attributes: string[];
  nutritionGoals: AlternativeNutritionGoal[];
  candidateKeywords: string[];
};

type AlternativeFamilyRule = {
  family: string;
  keywords: string[];
  categories: string[];
  candidateKeywords: string[];
};

type AlternativeAttributeRule = {
  attribute: string;
  keywords: string[];
  candidateKeywords: string[];
};

type AlternativeNutritionGoalRule = {
  goal: AlternativeNutritionGoal;
  keywords: string[];
};

const ALTERNATIVE_FAMILY_RULES: AlternativeFamilyRule[] = [
  {
    family: 'burger',
    keywords: ['버거', '햄버거'],
    categories: ['즉석식품류', '빵 및 과자류', '과자류·빵류 또는 떡류'],
    candidateKeywords: ['버거', '햄버거'],
  },
  {
    family: 'noodle',
    keywords: ['라면', '국수', '면', '파스타', '우동', '쫄면', '냉면'],
    categories: ['면 및 만두류', '면류', '즉석식품류'],
    candidateKeywords: ['라면', '국수', '면', '파스타', '우동', '쫄면', '냉면'],
  },
  {
    family: 'rice',
    keywords: ['밥', '덮밥', '볶음밥', '비빔밥', '도시락', '김밥'],
    categories: ['밥류', '즉석식품류', '특수영양식품'],
    candidateKeywords: ['밥', '덮밥', '볶음밥', '비빔밥', '도시락', '김밥'],
  },
  {
    family: 'soup',
    keywords: ['국', '탕', '찌개', '전골', '국밥', '곰탕', '해장국'],
    categories: ['국 및 탕류', '찌개 및 전골류', '즉석식품류'],
    candidateKeywords: ['국', '탕', '찌개', '전골', '국밥', '곰탕', '해장국'],
  },
  {
    family: 'drink',
    keywords: ['커피', '라떼', '주스', '음료', '차', '티', '콜드브루'],
    categories: ['음료 및 차류', '음료류'],
    candidateKeywords: ['커피', '라떼', '주스', '음료', '차', '티', '콜드브루'],
  },
  {
    family: 'dessert',
    keywords: ['빵', '케이크', '쿠키', '과자', '떡', '베이글', '도넛'],
    categories: ['빵 및 과자류', '과자류·빵류 또는 떡류'],
    candidateKeywords: ['빵', '케이크', '쿠키', '과자', '떡', '베이글', '도넛'],
  },
  {
    family: 'ice',
    keywords: ['아이스크림', '빙수', '젤라또', '쉐이크'],
    categories: ['유제품류 및 빙과류', '빙과류', '유가공품류'],
    candidateKeywords: ['아이스크림', '빙수', '젤라또', '쉐이크'],
  },
  {
    family: 'fried',
    keywords: ['튀김', '프라이', '치킨', '돈까스', '가라아게'],
    categories: ['튀김류', '식육가공품 및 포장육', '즉석식품류'],
    candidateKeywords: ['튀김', '프라이', '치킨', '돈까스', '가라아게'],
  },
  {
    family: 'grill',
    keywords: ['구이', '불고기', '스테이크', '갈비', '삼겹살'],
    categories: ['구이류', '식육가공품 및 포장육', '즉석식품류'],
    candidateKeywords: ['구이', '불고기', '스테이크', '갈비', '삼겹살'],
  },
  {
    family: 'salad',
    keywords: ['샐러드', '샐러트'],
    categories: ['생채·무침류', '즉석식품류', '특수영양식품'],
    candidateKeywords: ['샐러드', '샐러트'],
  },
];

const ALTERNATIVE_ATTRIBUTE_RULES: AlternativeAttributeRule[] = [
  {
    attribute: 'spicy',
    keywords: ['매운', '매콤', '불닭', '핫', '스파이시', '고추', '칠리'],
    candidateKeywords: [
      '매운',
      '매콤',
      '불닭',
      '핫',
      '스파이시',
      '고추',
      '칠리',
    ],
  },
  {
    attribute: 'cheese',
    keywords: ['치즈', '크림', '버터', '까르보'],
    candidateKeywords: ['치즈', '크림', '버터', '까르보'],
  },
  {
    attribute: 'chicken',
    keywords: ['닭', '치킨', '닭가슴살'],
    candidateKeywords: ['닭', '치킨', '닭가슴살'],
  },
  {
    attribute: 'beef',
    keywords: ['소고기', '쇠고기', '비프', '불고기'],
    candidateKeywords: ['소고기', '쇠고기', '비프', '불고기'],
  },
  {
    attribute: 'pork',
    keywords: ['돼지', '돈', '삼겹', '제육'],
    candidateKeywords: ['돼지', '돈', '삼겹', '제육'],
  },
  {
    attribute: 'seafood',
    keywords: ['새우', '해물', '참치', '연어', '오징어', '고등어'],
    candidateKeywords: ['새우', '해물', '참치', '연어', '오징어', '고등어'],
  },
  {
    attribute: 'sweet',
    keywords: ['달달', '달콤', '초코', '딸기', '바닐라', '카라멜', '꿀'],
    candidateKeywords: [
      '달달',
      '달콤',
      '초코',
      '딸기',
      '바닐라',
      '카라멜',
      '꿀',
    ],
  },
  {
    attribute: 'vegetable',
    keywords: ['야채', '채소', '나물', '비건', '두부'],
    candidateKeywords: ['야채', '채소', '나물', '비건', '두부'],
  },
];

const ALTERNATIVE_NUTRITION_GOAL_RULES: AlternativeNutritionGoalRule[] = [
  {
    goal: 'lowCalorie',
    keywords: ['저칼로리', '낮은칼로리', '칼로리낮', '다이어트'],
  },
  {
    goal: 'highProtein',
    keywords: ['고단백', '단백질', '프로틴', '닭가슴살'],
  },
  {
    goal: 'lowSugar',
    keywords: ['저당', '무설탕', '제로', '당류낮', '당낮'],
  },
  {
    goal: 'meal',
    keywords: ['든든', '식사', '한끼', '배부른'],
  },
  {
    goal: 'light',
    keywords: ['가벼운', '간단', '라이트'],
  },
];

@Injectable()
export class HomeService {
  private s3: S3Client;
  private bucketName: string;

  constructor(
    @InjectRepository(UserEntity)
    private userRepository: Repository<UserEntity>,
    @InjectRepository(UserInfoEntity)
    private userInfoRepository: Repository<UserInfoEntity>,
    @InjectRepository(MenuEntity)
    private menuRepository: Repository<MenuEntity>,
    @InjectRepository(MealEntity)
    private mealRepository: Repository<MealEntity>,
    @InjectRepository(MealMenuEntity)
    private mealMenuRepository: Repository<MealMenuEntity>,
    @InjectRepository(FolderEntity)
    private folderRepository: Repository<FolderEntity>,
    @InjectRepository(FolderMenuEntity)
    private folderMenuRepository: Repository<FolderMenuEntity>,
    @InjectRepository(MenuSetEntity)
    private menuSetRepository: Repository<MenuSetEntity>,
    @InjectRepository(MenuSetMenuEntity)
    private menuSetMenuRepository: Repository<MenuSetMenuEntity>,
    @InjectRepository(MealSetEntity)
    private mealSetRepository: Repository<MealSetEntity>,
    @InjectRepository(WorkoutEntity)
    private workoutRepository: Repository<WorkoutEntity>,
    @InjectRepository(WorkoutRecordEntity)
    private workoutRecordRepository: Repository<WorkoutRecordEntity>,
    @InjectRepository(WorkoutRecordSetEntity)
    private workoutRecordSetRepository: Repository<WorkoutRecordSetEntity>,
    @InjectRepository(WeightStepsEntity)
    private weightStepsRepository: Repository<WeightStepsEntity>,
    @InjectRepository(BrandAddEntity)
    private brandAddRepository: Repository<BrandAddEntity>,
    private httpService: HttpService,
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

  // 문자 출력
  getHello(): string {
    return 'Welcome home';
  }

  private toSearchTokens(input: string): string[] {
    return Array.from(
      new Set(
        input
          .split(/\s+/)
          .map((token) => token.trim())
          .filter((token) => token.length > 0),
      ),
    );
  }

  private normalizeSearchText(value: string): string {
    return (value ?? '')
      .toLowerCase()
      .replace(/[^\w가-힣\s]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  }

  private normalizeCompactSearchText(value: string): string {
    return this.normalizeSearchText(value).replace(/\s+/g, '');
  }

  private applyMenuSearchFields<T extends { name: string }>(
    menu: T,
  ): T & { search_name: string; canonical_name: string } {
    return {
      ...menu,
      search_name: normalizeMenuSearchName(menu.name),
      canonical_name: canonicalizeMenuSearchName(menu.name),
    };
  }

  private calculateSearchSimilarity(keyword: string, menu: MenuEntity): number {
    const input = this.normalizeSearchText(keyword);
    const compactInput = this.normalizeCompactSearchText(keyword);
    const searchInput = normalizeMenuSearchName(keyword);
    const canonicalInput = canonicalizeMenuSearchName(keyword);
    const menuName = this.normalizeSearchText(menu.name);
    const compactMenuName = this.normalizeCompactSearchText(menu.name);
    const menuSearchName =
      menu.search_name ?? normalizeMenuSearchName(menu.name);
    const menuCanonicalName =
      menu.canonical_name ?? canonicalizeMenuSearchName(menu.name);
    const brand = this.normalizeSearchText(menu.brand ?? '');
    const category = this.normalizeSearchText(menu.category ?? '');
    const searchable = [menuName, brand, category].filter(Boolean).join(' ');

    if (!input || !compactInput) {
      return 0;
    }

    let score = 0;

    if (this.isExactDisplayNameMatch(menu, keyword)) {
      score = 130;
    } else if (menuName === input || compactMenuName === compactInput) {
      score = 125;
    } else if (menuSearchName === searchInput) {
      score = 120;
    } else if (menuCanonicalName === canonicalInput) {
      score = 110;
    } else if (
      menuName.startsWith(input) ||
      compactMenuName.startsWith(compactInput) ||
      menuSearchName.startsWith(searchInput) ||
      menuCanonicalName.startsWith(canonicalInput)
    ) {
      score = 94;
    } else if (
      menuName.includes(input) ||
      compactMenuName.includes(compactInput) ||
      menuSearchName.includes(searchInput) ||
      menuCanonicalName.includes(canonicalInput)
    ) {
      score = 86;
    } else if (brand === input) {
      score = 74;
    } else if (searchable.includes(input)) {
      score = 66;
    }

    if (score > 0) {
      const exactComparableName = this.normalizeCompactSearchText(
        this.normalizeMenuNameForExactSearch(menu.name),
      );
      const lengthGap = Math.abs(exactComparableName.length - compactInput.length);
      score -= Math.min(lengthGap, 20) * 0.8;
    }

    const keywordTokens = this.toSearchTokens(input);
    if (keywordTokens.length > 0) {
      const matchedTokens = keywordTokens.filter((token) =>
        searchable.includes(token),
      ).length;
      score += (matchedTokens / keywordTokens.length) * 12;
    }

    return score;
  }

  private sortMenusBySearchSimilarity(
    menus: MenuEntity[],
    keyword: string,
  ): MenuEntity[] {
    return [...menus]
      .map((menu) => ({
        menu,
        score: this.calculateSearchSimilarity(keyword, menu),
      }))
      .sort((a, b) => {
        if (b.score !== a.score) {
          return b.score - a.score;
        }

        const sourcePriorityDiff =
          this.getMenuSearchSourcePriority(a.menu, keyword) -
          this.getMenuSearchSourcePriority(b.menu, keyword);

        if (sourcePriorityDiff !== 0) {
          return sourcePriorityDiff;
        }

        const aNameLength = this.normalizeCompactSearchText(a.menu.name).length;
        const bNameLength = this.normalizeCompactSearchText(b.menu.name).length;

        if (aNameLength !== bNameLength) {
          return aNameLength - bNameLength;
        }

        return a.menu.name.localeCompare(b.menu.name, 'ko');
      })
      .map(({ menu }) => menu);
  }

  private getMenuSearchSourcePriority(
    menu: MenuEntity,
    keyword: string,
  ): number {
    if (
      this.hasFoodPublicMenuSourcePrefix(menu.name) &&
      this.isExactDisplayNameMatch(menu, keyword)
    ) {
      return 0;
    }

    if (this.isExactDisplayNameMatch(menu, keyword)) {
      return 1;
    }

    if (this.hasFoodPublicMenuSourcePrefix(menu.name)) {
      return 2;
    }

    if (!this.hasPublicMenuSourcePrefix(menu.name)) {
      return 3;
    }

    return 4;
  }

  private async getMealRecordCountsByMenuId(
    menuIds: number[],
  ): Promise<Map<number, number>> {
    if (menuIds.length === 0) {
      return new Map();
    }

    const rows = await this.mealMenuRepository
      .createQueryBuilder('mealMenu')
      .select('menu.id', 'menuId')
      .addSelect('COUNT(mealMenu.id)', 'recordCount')
      .innerJoin('mealMenu.menu', 'menu')
      .where('menu.id IN (:...menuIds)', { menuIds })
      .groupBy('menu.id')
      .getRawMany<{ menuId: string; recordCount: string }>();

    return new Map(
      rows.map((row) => [Number(row.menuId), Number(row.recordCount)]),
    );
  }

  private async insertPopularRecordedMenusAfterTopSearchResults(
    menus: MenuEntity[],
  ): Promise<MenuEntity[]> {
    const fixedTopCount = 3;
    const popularInsertCount = 3;

    if (menus.length <= fixedTopCount + 1) {
      return menus;
    }

    const topMenus = menus.slice(0, fixedTopCount);
    const restMenus = menus.slice(fixedTopCount);
    const recordCounts = await this.getMealRecordCountsByMenuId(
      restMenus.map((menu) => menu.id),
    );
    const popularMenus = [...restMenus]
      .sort((a, b) => {
        const countDiff =
          (recordCounts.get(b.id) ?? 0) - (recordCounts.get(a.id) ?? 0);

        if (countDiff !== 0) {
          return countDiff;
        }

        return menus.indexOf(a) - menus.indexOf(b);
      })
      .slice(0, popularInsertCount);
    const popularMenuIds = new Set(popularMenus.map((menu) => menu.id));
    const continuedMenus = restMenus.filter(
      (menu) => !popularMenuIds.has(menu.id),
    );

    return [...topMenus, ...popularMenus, ...continuedMenus];
  }

  private dedupeMenusByDisplayName(menus: MenuEntity[]): MenuEntity[] {
    const nonPrefixedDisplayKeys = new Set(
      menus
        .filter((menu) => !this.hasPublicMenuSourcePrefix(menu.name))
        .map((menu) => this.normalizeMenuDisplayDedupeKey(menu.name))
        .filter((displayKey) => displayKey.length > 0),
    );
    const seenNonPrefixedDisplayKeys = new Set<string>();
    const dedupedMenus: MenuEntity[] = [];

    menus.forEach((menu) => {
      const displayKey = this.normalizeMenuDisplayDedupeKey(menu.name);

      if (!displayKey) {
        return;
      }

      const hasPublicSourcePrefix = this.hasPublicMenuSourcePrefix(menu.name);

      if (hasPublicSourcePrefix && nonPrefixedDisplayKeys.has(displayKey)) {
        return;
      }

      if (!hasPublicSourcePrefix) {
        if (seenNonPrefixedDisplayKeys.has(displayKey)) {
          return;
        }
        seenNonPrefixedDisplayKeys.add(displayKey);
      }

      dedupedMenus.push(menu);
    });

    return dedupedMenus;
  }

  private normalizeMenuDisplayDedupeKey(menuName: string): string {
    return this.normalizeCompactSearchText(
      stripPublicMenuSourcePrefix(menuName),
    );
  }

  private hasPublicMenuSourcePrefix(menuName: string): boolean {
    return /^\((?:식약처_음식|식약처_가공)\)\s*/.test(menuName.trim());
  }

  private hasFoodPublicMenuSourcePrefix(menuName: string): boolean {
    return /^\(식약처_음식\)\s*/.test(menuName.trim());
  }

  private dedupeMenusById(menus: MenuEntity[]): MenuEntity[] {
    const seenMenuIds = new Set<number>();

    return menus.filter((menu) => {
      if (seenMenuIds.has(menu.id)) {
        return false;
      }

      seenMenuIds.add(menu.id);
      return true;
    });
  }

  private normalizeMenuNameForExactSearch(menuName: string): string {
    return stripPublicMenuSourcePrefix(menuName)
      .replace(/\s*[\(\[\{（［【][^\)\]\}）］】]*[\)\]\}）］】]/g, '')
      .replace(/\s+/g, ' ')
      .trim();
  }

  private isExactDisplayNameMatch(menu: MenuEntity, keyword: string): boolean {
    const normalize = (value: string) =>
      value.replace(/\s+/g, '').trim().toLowerCase();

    return (
      normalize(this.normalizeMenuNameForExactSearch(menu.name)) ===
      normalize(keyword)
    );
  }

  private hasAnyKeyword(text: string, keywords: string[]): boolean {
    return keywords.some((keyword) => text.includes(keyword));
  }

  private uniqueValues(values: string[]): string[] {
    return Array.from(new Set(values.filter((value) => value.length > 0)));
  }

  private inferAlternativeSearchIntent(
    keyword: string,
  ): AlternativeSearchIntent {
    const normalized = this.normalizeCompactSearchText(keyword);
    const matchedFamilyRules = ALTERNATIVE_FAMILY_RULES.filter((rule) =>
      this.hasAnyKeyword(normalized, rule.keywords),
    );
    const matchedAttributeRules = ALTERNATIVE_ATTRIBUTE_RULES.filter((rule) =>
      this.hasAnyKeyword(normalized, rule.keywords),
    );
    const matchedNutritionGoalRules = ALTERNATIVE_NUTRITION_GOAL_RULES.filter(
      (rule) => this.hasAnyKeyword(normalized, rule.keywords),
    );

    return {
      families: matchedFamilyRules.map((rule) => rule.family),
      categories: this.uniqueValues(
        matchedFamilyRules.flatMap((rule) => rule.categories),
      ),
      attributes: matchedAttributeRules.map((rule) => rule.attribute),
      nutritionGoals: this.uniqueValues(
        matchedNutritionGoalRules.map((rule) => rule.goal),
      ) as AlternativeNutritionGoal[],
      candidateKeywords: this.uniqueValues([
        ...matchedFamilyRules.flatMap((rule) => rule.candidateKeywords),
        ...matchedAttributeRules.flatMap((rule) => rule.candidateKeywords),
      ]),
    };
  }

  private hasAlternativeSearchIntent(intent: AlternativeSearchIntent): boolean {
    return (
      intent.categories.length > 0 ||
      intent.candidateKeywords.length > 0 ||
      intent.nutritionGoals.length > 0
    );
  }

  private async findAlternativeMenusByIntent(
    keyword: string,
    user: UserEntity,
  ): Promise<MenuEntity[]> {
    const intent = this.inferAlternativeSearchIntent(keyword);

    if (!this.hasAlternativeSearchIntent(intent)) {
      return [];
    }

    let queryBuilder = this.menuRepository
      .createQueryBuilder('menu')
      .leftJoinAndSelect('menu.user', 'user')
      .where(
        new Brackets((qb) => {
          qb.where('user.id IS NULL').orWhere('user.id = :userId', {
            userId: user.id,
          });
        }),
      )
      .andWhere('menu.is_deleted = :isDeleted', { isDeleted: 0 });

    if (intent.categories.length > 0 || intent.candidateKeywords.length > 0) {
      queryBuilder = queryBuilder.andWhere(
        new Brackets((qb) => {
          if (intent.categories.length > 0) {
            qb.orWhere('menu.category IN (:...alternativeCategories)', {
              alternativeCategories: intent.categories,
            });
          }

          intent.candidateKeywords.forEach((candidateKeyword, index) => {
            qb.orWhere(`menu.name LIKE :alternativeKeyword${index}`, {
              [`alternativeKeyword${index}`]: `%${candidateKeyword}%`,
            })
              .orWhere(`menu.brand LIKE :alternativeKeyword${index}`, {
                [`alternativeKeyword${index}`]: `%${candidateKeyword}%`,
              })
              .orWhere(`menu.category LIKE :alternativeKeyword${index}`, {
                [`alternativeKeyword${index}`]: `%${candidateKeyword}%`,
              });
          });
        }),
      );
    }

    if (
      intent.nutritionGoals.includes('lowCalorie') ||
      intent.nutritionGoals.includes('light')
    ) {
      queryBuilder = queryBuilder.orderBy('menu.calories', 'ASC');
    } else if (intent.nutritionGoals.includes('highProtein')) {
      queryBuilder = queryBuilder
        .andWhere('menu.protein IS NOT NULL')
        .orderBy('menu.protein', 'DESC');
    } else if (intent.nutritionGoals.includes('lowSugar')) {
      queryBuilder = queryBuilder
        .andWhere('menu.sugars IS NOT NULL')
        .orderBy('menu.sugars', 'ASC');
    } else if (intent.nutritionGoals.includes('meal')) {
      queryBuilder = queryBuilder
        .orderBy('menu.calories', 'DESC')
        .addOrderBy('menu.protein', 'DESC');
    } else {
      queryBuilder = queryBuilder.orderBy('menu.name', 'ASC');
    }

    queryBuilder = queryBuilder
      .andWhere('menu.calories BETWEEN :minCalories AND :maxCalories', {
        minCalories: 0,
        maxCalories: 1200,
      })
      .andWhere('(menu.weight IS NULL OR menu.weight <= :maxWeight)', {
        maxWeight: 1000,
      })
      .limit(200);

    const candidates = await queryBuilder.getMany();

    return candidates
      .map((menu) => ({
        menu,
        score: this.calculateAlternativeMenuScore(menu, intent),
      }))
      .filter(({ score }) => score >= 30)
      .sort((a, b) => {
        if (b.score !== a.score) {
          return b.score - a.score;
        }

        return a.menu.name.localeCompare(b.menu.name, 'ko');
      })
      .slice(0, 20)
      .map(({ menu }) => menu);
  }

  private calculateAlternativeMenuScore(
    menu: MenuEntity,
    intent: AlternativeSearchIntent,
  ): number {
    const name = this.normalizeCompactSearchText(menu.name);
    const brand = this.normalizeCompactSearchText(menu.brand ?? '');
    const category = menu.category ?? '';
    const searchable = `${name}${brand}${this.normalizeCompactSearchText(
      category,
    )}`;

    let score = 0;

    if (intent.categories.includes(category)) {
      score += 34;
    } else if (
      intent.categories.some((intentCategory) =>
        category.includes(intentCategory),
      )
    ) {
      score += 22;
    }

    for (const familyRule of ALTERNATIVE_FAMILY_RULES) {
      if (!intent.families.includes(familyRule.family)) {
        continue;
      }

      if (this.hasAnyKeyword(searchable, familyRule.candidateKeywords)) {
        score += 22;
      }
    }

    for (const attributeRule of ALTERNATIVE_ATTRIBUTE_RULES) {
      if (!intent.attributes.includes(attributeRule.attribute)) {
        continue;
      }

      if (this.hasAnyKeyword(searchable, attributeRule.candidateKeywords)) {
        score += 18;
      }
    }

    score += this.calculateAlternativeNutritionScore(menu, intent);
    score += this.calculateAlternativeQualityScore(menu);

    return score;
  }

  private calculateAlternativeNutritionScore(
    menu: MenuEntity,
    intent: AlternativeSearchIntent,
  ): number {
    const calories = menu.calories ?? 0;
    const protein = menu.protein ?? 0;
    const sugars = menu.sugars;
    let score = 0;

    if (intent.nutritionGoals.includes('lowCalorie')) {
      if (calories > 0 && calories <= 250) {
        score += 24;
      } else if (calories > 0 && calories <= 450) {
        score += 16;
      } else if (calories > 0 && calories <= 650) {
        score += 8;
      } else {
        score -= 10;
      }
    }

    if (intent.nutritionGoals.includes('highProtein')) {
      if (protein >= 25) {
        score += 24;
      } else if (protein >= 15) {
        score += 16;
      } else if (protein >= 8) {
        score += 8;
      }
    }

    if (intent.nutritionGoals.includes('lowSugar')) {
      if (sugars === null || sugars === undefined) {
        score += 0;
      } else if (sugars <= 3) {
        score += 20;
      } else if (sugars <= 8) {
        score += 12;
      } else {
        score -= 8;
      }
    }

    if (intent.nutritionGoals.includes('meal')) {
      if (calories >= 350 && protein >= 12) {
        score += 18;
      } else if (calories >= 250) {
        score += 10;
      }
    }

    if (intent.nutritionGoals.includes('light')) {
      if (calories > 0 && calories <= 350) {
        score += 18;
      } else if (calories > 0 && calories <= 500) {
        score += 8;
      } else {
        score -= 8;
      }
    }

    return score;
  }

  private calculateAlternativeQualityScore(menu: MenuEntity): number {
    const calories = menu.calories ?? 0;
    const weight = menu.weight ?? 0;
    let score = 0;

    if (calories > 0 && calories <= 900) {
      score += 6;
    }

    if (weight > 0 && weight <= 700) {
      score += 4;
    }

    if (calories > 1000 || weight > 1000) {
      score -= 20;
    }

    return score;
  }

  // menu controller
  // 메뉴 검색
  async search(
    searchMenuRequestDto: SearchMenuRequestDto,
    user: UserEntity,
  ): Promise<SearchResponseDto> {
    const keyword = searchMenuRequestDto.input?.trim();
    const limit = searchMenuRequestDto.limit;
    const cursor = searchMenuRequestDto.cursor;

    if (!keyword) {
      return new SearchResponseDto(false, [], null);
    }

    const searchName = normalizeMenuSearchName(keyword);
    const canonicalName = canonicalizeMenuSearchName(keyword);
    const keywordPattern = `%${keyword}%`;
    const searchNamePattern = `%${searchName}%`;
    const canonicalNamePattern = `%${canonicalName}%`;
    const keywordTokens = this.toSearchTokens(keyword);
    const exactNameCandidates = [
      keyword,
      `(식약처_음식) ${keyword}`,
      `(식약처_가공) ${keyword}`,
    ];
    const exactParentheticalPatterns = [
      `${keyword}(%`,
      `${keyword} (%`,
      `(식약처_음식) ${keyword}(%`,
      `(식약처_음식) ${keyword} (%`,
      `(식약처_가공) ${keyword}(%`,
      `(식약처_가공) ${keyword} (%`,
    ];
    const rawFetchLimit = Math.min(limit * 4 + 1, 401);
    const buildSearchQuery = () => {
      const menuQuery = this.menuRepository
        .createQueryBuilder('menu')
        .leftJoinAndSelect('menu.user', 'user')
        .where(
          new Brackets((qb) => {
            qb.where('user.id IS NULL').orWhere('user.id = :userId', {
              userId: user.id,
            });
          }),
        )
        .andWhere('menu.is_deleted = :isDeleted', { isDeleted: 0 })
        .andWhere(
          new Brackets((qb) => {
            qb.where('menu.name LIKE :keyword', {
              keyword: keywordPattern,
            }).orWhere('menu.brand = :brandKeyword', {
              brandKeyword: keyword,
            });

            if (searchName) {
              qb.orWhere('menu.search_name LIKE :searchNamePattern', {
                searchNamePattern,
              });
            }

            if (canonicalName) {
              qb.orWhere('menu.canonical_name LIKE :canonicalNamePattern', {
                canonicalNamePattern,
              });
            }

            if (keywordTokens.length > 1) {
              qb.orWhere(
                new Brackets((tokenQb) => {
                  keywordTokens.forEach((token, index) => {
                    tokenQb.andWhere(
                      new Brackets((fieldQb) => {
                        fieldQb
                          .where(`menu.name LIKE :searchToken${index}`, {
                            [`searchToken${index}`]: `%${token}%`,
                          })
                          .orWhere(`menu.brand LIKE :searchToken${index}`, {
                            [`searchToken${index}`]: `%${token}%`,
                          })
                          .orWhere(`menu.category LIKE :searchToken${index}`, {
                            [`searchToken${index}`]: `%${token}%`,
                          });
                      }),
                    );
                  });
                }),
              );
            }
          }),
        );

      if (cursor !== undefined) {
        menuQuery.andWhere('menu.id > :cursor', { cursor });
      }

      return menuQuery;
    };

    const exactMenus =
      cursor === undefined
        ? await this.menuRepository
            .createQueryBuilder('menu')
            .leftJoinAndSelect('menu.user', 'user')
            .where(
              new Brackets((qb) => {
                qb.where('user.id IS NULL').orWhere('user.id = :userId', {
                  userId: user.id,
                });
              }),
            )
            .andWhere('menu.is_deleted = :isDeleted', { isDeleted: 0 })
            .andWhere(
              new Brackets((qb) => {
                qb.where('menu.name IN (:...exactNameCandidates)', {
                  exactNameCandidates,
                });
                if (searchName) {
                  qb.orWhere('menu.search_name = :searchName', {
                    searchName,
                  });
                }
                if (canonicalName) {
                  qb.orWhere('menu.canonical_name = :canonicalName', {
                    canonicalName,
                  });
                }

                exactParentheticalPatterns.forEach((pattern, index) => {
                  qb.orWhere(`menu.name LIKE :exactParenthetical${index}`, {
                    [`exactParenthetical${index}`]: pattern,
                  });
                });
              }),
            )
            .orderBy('menu.id', 'ASC')
            .take(rawFetchLimit)
            .getMany()
        : [];
    const remainingRawLimit = Math.max(rawFetchLimit - exactMenus.length, 0);
    const exactMenuIds = exactMenus.map((menu) => menu.id);
    const rawMenuList = this.dedupeMenusById(
      remainingRawLimit > 0
        ? [
            ...exactMenus,
            ...(await (() => {
              const query = buildSearchQuery();

              if (exactMenuIds.length > 0) {
                query.andWhere('menu.id NOT IN (:...exactMenuIds)', {
                  exactMenuIds,
                });
              }

              return query
                .orderBy('menu.id', 'ASC')
                .take(remainingRawLimit)
                .getMany();
            })()),
          ]
        : exactMenus,
    ).sort((left, right) => {
      const leftExact = this.isExactDisplayNameMatch(left, keyword) ? 0 : 1;
      const rightExact = this.isExactDisplayNameMatch(right, keyword) ? 0 : 1;
      const sourcePriorityDiff =
        this.getMenuSearchSourcePriority(left, keyword) -
        this.getMenuSearchSourcePriority(right, keyword);
      const leftCanonicalExact =
        (left.canonical_name ?? canonicalizeMenuSearchName(left.name)) ===
        canonicalName
          ? 0
          : 1;
      const rightCanonicalExact =
        (right.canonical_name ?? canonicalizeMenuSearchName(right.name)) ===
        canonicalName
          ? 0
          : 1;

      if (leftExact !== rightExact) {
        return leftExact - rightExact;
      }

      if (sourcePriorityDiff !== 0) {
        return sourcePriorityDiff;
      }

      if (leftCanonicalExact !== rightCanonicalExact) {
        return leftCanonicalExact - rightCanonicalExact;
      }

      return 0;
    });

    const uniqueMenuList = this.dedupeMenusByDisplayName(rawMenuList);
    const basePagedMenuList = uniqueMenuList.slice(0, limit);
    const pagedMenuList =
      cursor === undefined
        ? await this.insertPopularRecordedMenusAfterTopSearchResults(
            basePagedMenuList,
          )
        : basePagedMenuList;
    let menu_list: MenuSimpleResponseDto[] = pagedMenuList.map(
      (menu) => new MenuSimpleResponseDto(menu),
    );
    let nextCursor =
      (uniqueMenuList.length > limit || rawMenuList.length >= rawFetchLimit) &&
      rawMenuList.length > 0
        ? rawMenuList[rawMenuList.length - 1].id
        : null;
    let has_result = menu_list.length > 0;

    if (!has_result && cursor === undefined) {
      const alternativeMenus = await this.findAlternativeMenusByIntent(
        keyword,
        user,
      );
      menu_list = this.dedupeMenusByDisplayName(alternativeMenus).map(
        (menu) => new MenuSimpleResponseDto(menu),
      );
      nextCursor = null;
    }

    return new SearchResponseDto(has_result, menu_list, nextCursor);
  }

  // 메뉴 영양성분 상세 조회
  async menuDetail(menuId: number): Promise<MenuResponseDto> {
    const menu = await this.menuRepository.findOneBy({
      id: menuId,
      // is_deleted: 0,
    });

    if (!menu) {
      throw new NotFoundException('Menu not found');
    }

    return new MenuResponseDto(menu);
  }

  // 브랜드 내 메뉴 검색
  async searchInBrand(
    brand: string,
    input: string,
    user: UserEntity,
  ): Promise<MenuSimpleResponseDto[]> {
    const keyword = input?.trim();

    if (!keyword) {
      const menuList = await this.menuRepository
        .createQueryBuilder('menu')
        .leftJoinAndSelect('menu.user', 'user')
        .where(
          new Brackets((qb) => {
            qb.where('user.id IS NULL').orWhere('user.id = :userId', {
              userId: user.id,
            });
          }),
        )
        .andWhere('menu.is_deleted = :isDeleted', { isDeleted: 0 })
        .andWhere('menu.brand = :brand', { brand })
        .getMany();

      return menuList.map((menu) => new MenuSimpleResponseDto(menu));
    }

    const keywordPattern = `%${keyword}%`;

    const menuList = await this.menuRepository
      .createQueryBuilder('menu')
      .leftJoinAndSelect('menu.user', 'user')
      .where(
        new Brackets((qb) => {
          qb.where('user.id IS NULL').orWhere('user.id = :userId', {
            userId: user.id,
          });
        }),
      )
      .andWhere('menu.is_deleted = :isDeleted', { isDeleted: 0 })
      .andWhere('menu.brand = :brand', { brand })
      .andWhere('menu.name LIKE :keyword', {
        keyword: keywordPattern,
      })
      .getMany();

    return menuList.map((menu) => new MenuSimpleResponseDto(menu));
  }

  async getFrequentlyRecordedMenus(
    user: UserEntity,
  ): Promise<MenuListResponseDto> {
    const rawRows: Array<{
      menu_id: number;
      record_count: string;
      last_recorded_at: Date;
    }> = await this.mealMenuRepository
      .createQueryBuilder('mealMenu')
      .innerJoin('mealMenu.meal', 'meal')
      .innerJoin('mealMenu.menu', 'menu')
      .where('meal.userId = :userId', { userId: user.id })
      .andWhere('menu.is_deleted = :isDeleted', { isDeleted: 0 })
      .groupBy('menu.id')
      .select('menu.id', 'menu_id')
      .addSelect('COUNT(mealMenu.id)', 'record_count')
      .addSelect('MAX(meal.updatedAt)', 'last_recorded_at')
      .orderBy('record_count', 'DESC')
      .addOrderBy('last_recorded_at', 'DESC')
      .addOrderBy('menu.id', 'ASC')
      .limit(20)
      .getRawMany();
    const menuIds = rawRows
      .map((row) => Number(row.menu_id))
      .filter((menuId) => Number.isInteger(menuId));

    if (menuIds.length === 0) {
      return new MenuListResponseDto([]);
    }

    const menus = await this.menuRepository
      .createQueryBuilder('menu')
      .leftJoinAndSelect('menu.user', 'user')
      .where('menu.id IN (:...menuIds)', { menuIds })
      .andWhere(
        new Brackets((qb) => {
          qb.where('user.id IS NULL').orWhere('user.id = :userId', {
            userId: user.id,
          });
        }),
      )
      .andWhere('menu.is_deleted = :isDeleted', { isDeleted: 0 })
      .getMany();
    const menuMap = new Map(menus.map((menu) => [menu.id, menu]));
    const menuList = menuIds
      .map((menuId) => menuMap.get(menuId))
      .filter((menu): menu is MenuEntity => !!menu)
      .map((menu) => new MenuSimpleResponseDto(menu));

    return new MenuListResponseDto(menuList);
  }

  async getRegisteredMenus(user: UserEntity): Promise<MenuListResponseDto> {
    const menuList = await this.menuRepository
      .createQueryBuilder('menu')
      .leftJoinAndSelect('menu.user', 'user')
      .where('user.id = :userId', { userId: user.id })
      .andWhere('menu.is_deleted = :isDeleted', { isDeleted: 0 })
      .orderBy('menu.id', 'DESC')
      .getMany();

    return new MenuListResponseDto(
      menuList.map((menu) => new MenuSimpleResponseDto(menu)),
    );
  }

  // 식사 사진 S3 업로드
  async uploadMealImage(
    user: UserEntity,
    file: Express.Multer.File,
    mealImageUploadRequestDto: MealImageUploadRequestDto,
  ): Promise<string> {
    const { date, time } = mealImageUploadRequestDto;

    const existingMeal = await this.mealRepository.findOne({
      where: {
        date,
        time,
        user: { id: user.id },
      },
      relations: {
        mealMenus: true,
      },
    });

    // 해당 식사의 사진이 이미 있으면 삭제
    if (existingMeal.image) {
      const fileKey = existingMeal.image.split('com/')[1];
      const params = {
        Bucket: this.bucketName,
        Key: fileKey,
      };
      await this.s3.send(new DeleteObjectCommand(params));
    }
    const randomString = Math.random().toString(36).substring(2, 12);
    const newFileKey = `meal/${user.id}/${date}/${time}/${randomString}`;

    // 업로드
    const params = {
      Bucket: this.bucketName,
      Key: newFileKey,
      Body: file.buffer,
      ContentType: file.mimetype,
    };

    await this.s3.send(new PutObjectCommand(params));
    return `https://${this.bucketName}.s3.${process.env.AWS_REGION}.amazonaws.com/${newFileKey}`;
  }

  // 음식 사진 인식
  async recognizeFoodImage(
    user: UserEntity,
    file: Express.Multer.File,
  ): Promise<FoodImageRecognitionResponseDto> {
    if (!file) {
      throw new BadRequestException('image file is required');
    }

    if (!file.mimetype?.startsWith('image/')) {
      throw new BadRequestException('image file must be an image');
    }

    try {
      const foodImageDescription = await this.describeFoodImage(file);
      const perFoodRecognized = await this.recognizeFoodImageByPerFoodRematch(
        user.id,
        file,
        foodImageDescription,
      );

      if (perFoodRecognized.menu_ids.length > 0) {
        const imageUrl = await this.uploadRecognizedFoodImage(user, file);

        return new FoodImageRecognitionResponseDto({
          ...perFoodRecognized,
          image_url: imageUrl,
        });
      }

      const menus = await this.getFoodImageRecognitionCandidateMenus(
        user.id,
        foodImageDescription,
      );

      if (menus.length === 0) {
        throw new NotFoundException('No menus available for recognition');
      }

      const prompt = `
음식 사진을 보고, 아래 후보 메뉴 중 사진에 실제로 포함된 음식만 골라서 JSON object만 반환해.

규칙:
- 반드시 JSON object만 반환하고 마크다운, 설명, 코드펜스는 금지
- 후보 메뉴에 없는 음식은 절대 추가하지 마
- 가장 일치하는 후보 menu id를 선택해
- 같은 음식이 여러 개면 개수를 합산해서 수량으로 반환해
- 확실하지 않은 음식은 제외해
- menu_ids와 menu_quantities의 길이는 반드시 같아야 해
- 수량은 0보다 큰 숫자만 허용해
- 사진 문제로 인식이 어렵다면 아래 failure_reason 중 가장 가까운 값을 하나 선택해
- 사진 문제로 실패한 경우 recognition_status는 "failed", menu_ids와 menu_quantities는 빈 배열로 반환해
- 음식은 보이지만 후보 메뉴와 일치하는 항목이 없으면 failure_reason은 "NO_MATCHING_MENU"로 반환해

후보 메뉴:
${JSON.stringify(menus)}

1차 사진 분석:
${JSON.stringify(foodImageDescription)}

반환 shape:
{
  "recognition_status": "recognized",
  "failure_reason": null,
  "menu_ids": [1, 2],
  "menu_quantities": [1, 2]
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

      const data = await this.callGeminiJsonWithImage(
        prompt,
        file,
        'Food image recognition is unavailable',
      );
      const recognized = this.normalizeFoodImageRecognition(data, menus);
      const imageUrl = await this.uploadRecognizedFoodImage(user, file);

      return new FoodImageRecognitionResponseDto({
        ...recognized,
        image_url: imageUrl,
      });
    } catch (error) {
      await this.uploadFailedFoodImageRecognitionIfPossible(user, file, error);
      throw error;
    }
  }

  private async describeFoodImage(file: Express.Multer.File): Promise<{
    foodNames: string[];
    visualDescription: string | null;
  }> {
    const prompt = `
음식 사진을 보고, 사진에 실제로 포함된 음식명과 시각적 특징을 JSON object로 반환해.

규칙:
- 반드시 JSON object만 반환하고 마크다운, 설명, 코드펜스는 금지
- 음식명은 알 수 있는 범위에서 최대한 구체적으로 작성해
- 정확한 메뉴명을 모르더라도 "양념된 구운 돼지고기", "숯불에 구운 고기", "구운 마늘"처럼 보이는 특징을 food_names에 넣어
- visual_description에는 주요 식재료, 조리 방식, 양념 여부, 보이는 구성 요소를 1~3문장으로 설명해
- 같은 음식이 여러 개 보여도 food_names에는 중복 없이 한 번만 넣어
- 확실하지 않은 경우에도 사진에서 보이는 범용 음식 설명은 남겨
- 사진 문제로 인식이 어렵다면 아래 failure_reason 중 가장 가까운 값을 하나 선택해
- 사진 문제로 실패한 경우에만 recognition_status는 "failed", food_names는 빈 배열로 반환해
- 음식은 보이지만 정확한 메뉴명을 특정하기 어려운 경우에는 실패로 처리하지 말고 범용 설명을 반환해

반환 shape:
{
  "recognition_status": "recognized",
  "failure_reason": null,
  "food_names": ["양념된 구운 고기", "구운 마늘"],
  "visual_description": "불판 위에 양념된 고기와 소금구이처럼 보이는 고기, 구운 마늘이 함께 보입니다."
}

failure_reason enum:
- LOW_IMAGE_QUALITY
- FOOD_TOO_SMALL
- TOO_BLURRY
- POOR_LIGHTING
- FOOD_OCCLUDED
- NO_FOOD_DETECTED
`.trim();
    const data = await this.callGeminiJsonWithImage(
      prompt,
      file,
      'Food image recognition is unavailable',
    );

    const failureReason = this.asFoodImageRecognitionFailureReason(
      data?.failure_reason,
    );
    const isFailed = data?.recognition_status === 'failed';

    if (isFailed && failureReason && failureReason !== 'NO_MATCHING_MENU') {
      throw new BadRequestException(
        FOOD_IMAGE_RECOGNITION_FAILURE_MESSAGES[failureReason],
      );
    }

    const foodNames = Array.isArray(data?.food_names) ? data.food_names : [];
    const normalizedFoodNames = foodNames
      .map((foodName) => (typeof foodName === 'string' ? foodName.trim() : ''))
      .filter((foodName) => foodName.length >= 2);

    const visualDescription =
      typeof data?.visual_description === 'string' &&
      data.visual_description.trim().length > 0
        ? data.visual_description.trim()
        : null;

    if (normalizedFoodNames.length === 0 && !visualDescription) {
      throw new BadRequestException(
        FOOD_IMAGE_RECOGNITION_FAILURE_MESSAGES.NO_MATCHING_MENU,
      );
    }

    return {
      foodNames: Array.from(new Set<string>(normalizedFoodNames)).slice(0, 10),
      visualDescription,
    };
  }

  private async getFoodImageRecognitionCandidateMenus(
    userId: number,
    description: {
      foodNames: string[];
      visualDescription: string | null;
    },
  ): Promise<
    Array<{
      id: number;
      name: string;
      brand: string | null;
      category: string | null;
      weight: number | null;
    }>
  > {
    const vectorMenus = await this.getVectorFoodImageCandidateMenus(
      userId,
      description,
    );

    if (vectorMenus.length > 0) {
      return vectorMenus;
    }

    return await this.getAllFoodImageRecognitionCandidateMenus(userId);
  }

  private async getVectorFoodImageCandidateMenus(
    userId: number,
    description: {
      foodNames: string[];
      visualDescription: string | null;
    },
  ): Promise<
    Array<{
      id: number;
      name: string;
      brand: string | null;
      category: string | null;
      weight: number | null;
    }>
  > {
    if (
      !this.isVectorSearchEnabled() ||
      !this.menuVectorService ||
      (description.foodNames.length === 0 && !description.visualDescription)
    ) {
      return [];
    }

    try {
      const vectorResults = await this.menuVectorService.searchMenusByText(
        this.buildFoodImageVectorQuery(description),
        {
          userId,
          limit: this.getFoodImageVectorCandidateLimit(),
        },
      );

      return await this.getFoodImageRecognitionMenusByIds(
        userId,
        vectorResults.map((result) => result.menuId),
      );
    } catch (error) {
      console.warn(
        '[HOME] vector food image search failed, fallback to mysql',
        {
          message: error instanceof Error ? error.message : String(error),
        },
      );

      return [];
    }
  }

  private buildFoodImageVectorQuery(description: {
    foodNames: string[];
    visualDescription: string | null;
  }): string {
    return [
      description.foodNames.length > 0
        ? `음식 후보명: ${description.foodNames.join(', ')}`
        : null,
      description.visualDescription
        ? `시각적 특징: ${description.visualDescription}`
        : null,
    ]
      .filter((value): value is string => !!value)
      .join('\n');
  }

  private async recognizeFoodImageByPerFoodRematch(
    userId: number,
    file: Express.Multer.File,
    description: {
      foodNames: string[];
      visualDescription: string | null;
    },
  ): Promise<{
    menu_ids: number[];
    menu_quantities: number[];
  }> {
    const foodNames = description.foodNames.slice(0, 10);

    if (foodNames.length === 0) {
      return { menu_ids: [], menu_quantities: [] };
    }

    const candidateGroups = await Promise.all(
      foodNames.map(async (foodName, index) => {
        const candidates = await this.getFoodImageCandidatesForSingleFood(
          userId,
          foodName,
          description.visualDescription,
        );

        return {
          foodIndex: index,
          foodName,
          candidates,
        };
      }),
    );
    const groupsWithCandidates = candidateGroups.filter(
      (group) => group.candidates.length > 0,
    );

    if (groupsWithCandidates.length === 0) {
      return { menu_ids: [], menu_quantities: [] };
    }

    return await this.rematchHomeFoodImageMenusWithGemini(
      file,
      groupsWithCandidates,
    );
  }

  private async getFoodImageCandidatesForSingleFood(
    userId: number,
    foodName: string,
    visualDescription: string | null,
  ): Promise<HomeFoodImageRecognitionCandidate[]> {
    const limit = this.getFoodImagePerFoodVectorCandidateLimit();
    const keywordMenus = await this.searchFoodImageCandidateMenusByKeyword(
      userId,
      foodName,
      limit,
      visualDescription,
    );

    if (this.isVectorSearchEnabled() && this.menuVectorService) {
      try {
        const vectorResults = await this.menuVectorService.searchMenusByText(
          [
            `음식명: ${foodName}`,
            visualDescription ? `사진 전체 특징: ${visualDescription}` : null,
          ]
            .filter((value): value is string => !!value)
            .join('\n'),
          {
            userId,
            limit,
          },
        );

        const vectorMenus = await this.getFoodImageRecognitionMenusByIds(
          userId,
          vectorResults.map((result) => result.menuId),
        );

        return this.mergeFoodImageRecognitionCandidates([
          ...keywordMenus,
          ...vectorMenus,
        ]).slice(0, limit);
      } catch (error) {
        console.warn('[HOME] per-food vector image search failed', {
          foodName,
          message: error instanceof Error ? error.message : String(error),
        });
      }
    }

    return keywordMenus;
  }

  private mergeFoodImageRecognitionCandidates(
    candidates: HomeFoodImageRecognitionCandidate[],
  ): HomeFoodImageRecognitionCandidate[] {
    const candidateMap = new Map<number, HomeFoodImageRecognitionCandidate>();

    candidates.forEach((candidate) => {
      if (!candidateMap.has(candidate.id)) {
        candidateMap.set(candidate.id, candidate);
      }
    });

    return Array.from(candidateMap.values());
  }

  private async searchFoodImageCandidateMenusByKeyword(
    userId: number,
    foodName: string,
    limit: number,
    contextText: string | null = null,
  ): Promise<HomeFoodImageRecognitionCandidate[]> {
    const normalizedFoodName = stripPublicMenuSourcePrefix(foodName).trim();
    const compactFoodName =
      this.normalizeCompactSearchText(normalizedFoodName);
    const compactContext = this.normalizeCompactSearchText(
      `${foodName} ${contextText ?? ''}`,
    );

    if (normalizedFoodName.length === 0) {
      return [];
    }

    const displayNameExpression =
      "REPLACE(REPLACE(menu.name, '(식약처_음식) ', ''), '(식약처_가공) ', '')";
    const compactNameExpression = `REPLACE(${displayNameExpression}, ' ', '')`;

    const rows = await this.menuRepository
      .createQueryBuilder('menu')
      .leftJoin('menu.user', 'user')
      .select([
        'menu.id AS id',
        'menu.name AS name',
        'menu.brand AS brand',
        'menu.category AS category',
        'menu.weight AS weight',
      ])
      .where(
        new Brackets((qb) => {
          qb.where('user.id IS NULL').orWhere('user.id = :userId', { userId });
        }),
      )
      .andWhere('menu.is_deleted = :isDeleted', { isDeleted: 0 })
      .andWhere(
        new Brackets((qb) => {
          qb.where(
            `${displayNameExpression} = :exactName`,
            { exactName: normalizedFoodName },
          )
            .orWhere(`${compactNameExpression} = :compactName`, {
              compactName: compactFoodName,
            })
            .orWhere('menu.name LIKE :likeName', {
              likeName: `%${normalizedFoodName}%`,
            });
        }),
      )
      .orderBy(
        `CASE
          WHEN ${displayNameExpression} = :exactName THEN 0
          WHEN ${compactNameExpression} = :compactName THEN 1
          WHEN CHAR_LENGTH(${compactNameExpression}) >= 3
            AND INSTR(:compactContext, ${compactNameExpression}) > 0 THEN 2
          ELSE 3
        END`,
        'ASC',
      )
      .addOrderBy('menu.id', 'ASC')
      .setParameter('exactName', normalizedFoodName)
      .setParameter('compactName', compactFoodName)
      .setParameter('compactContext', compactContext)
      .limit(limit)
      .getRawMany<{
        id: number;
        name: string;
        brand: string | null;
        category: string | null;
        weight: number | null;
      }>();

    return rows.map((row) => ({
      id: Number(row.id),
      name: row.name,
      brand: row.brand ?? null,
      category: row.category ?? null,
      weight: this.asNullableNumber(row.weight),
    }));
  }

  private async rematchHomeFoodImageMenusWithGemini(
    file: Express.Multer.File,
    candidateGroups: HomeFoodImageCandidateGroup[],
  ): Promise<{
    menu_ids: number[];
    menu_quantities: number[];
  }> {
    const candidateMap = new Map<number, HomeFoodImageRecognitionCandidate>();
    const candidateIdsByFoodIndex = new Map<number, Set<number>>();

    candidateGroups.forEach((group) => {
      const ids = new Set<number>();

      group.candidates.forEach((candidate) => {
        candidateMap.set(candidate.id, candidate);
        ids.add(candidate.id);
      });
      candidateIdsByFoodIndex.set(group.foodIndex, ids);
    });

    const prompt = `
음식 사진, 1차 인식 음식명, 서버가 음식별로 추린 후보 메뉴를 함께 보고 각 음식에 가장 잘 맞는 menu_id를 골라 JSON object만 반환해.

규칙:
- 반드시 JSON object만 반환하고 마크다운, 설명, 코드펜스는 금지
- food_index는 입력 food_groups의 food_index 값을 그대로 사용해
- 각 food_index는 자기 candidate_menus 안에 있는 menu_id 중에서만 골라
- 다른 food_index의 후보 menu_id를 가져와서 쓰지 마
- 후보 목록에 없는 menu_id는 절대 반환하지 마
- 사진의 시각 정보, food_name, 후보 메뉴명/브랜드/카테고리를 함께 비교해
- 한 음식에 확실히 맞는 후보가 없으면 그 음식은 제외해
- 같은 메뉴가 여러 위치에 보여도 같은 menu_id는 한 번만 반환해
- quantity는 사진 속 해당 음식의 대략적인 인분/개수야. 모르겠으면 1로 반환해

food_groups:
${JSON.stringify(
  candidateGroups.map((group) => ({
    food_index: group.foodIndex,
    food_name: group.foodName,
    candidate_menus: group.candidates.map((candidate) => ({
      menu_id: candidate.id,
      name: candidate.name,
      brand: candidate.brand,
      category: candidate.category,
    })),
  })),
)}

반환 shape:
{
  "detected_foods": [
    {
      "food_index": 0,
      "menu_id": 1,
      "quantity": 1
    }
  ]
}
`.trim();

    try {
      const data = await this.callGeminiJsonWithImage(
        prompt,
        file,
        'Food image recognition is unavailable',
      );
      const detectedFoods: unknown[] = Array.isArray(data?.detected_foods)
        ? data.detected_foods
        : [];

      return this.normalizeHomeFoodImageRematchResult(
        detectedFoods,
        candidateMap,
        candidateIdsByFoodIndex,
      );
    } catch (error) {
      console.warn('[HOME] food image Gemini rematch failed', {
        message: error instanceof Error ? error.message : String(error),
      });

      return { menu_ids: [], menu_quantities: [] };
    }
  }

  private normalizeHomeFoodImageRematchResult(
    values: unknown[],
    candidateMap: Map<number, HomeFoodImageRecognitionCandidate>,
    candidateIdsByFoodIndex: Map<number, Set<number>>,
  ): {
    menu_ids: number[];
    menu_quantities: number[];
  } {
    const merged = new Map<number, number>();

    values.forEach((value) => {
      if (!value || typeof value !== 'object') {
        return;
      }

      const item = value as Record<string, unknown>;
      const foodIndex = this.asNullableNumber(item.food_index);
      const menuId = this.asNullableNumber(item.menu_id);
      const quantity = this.asNullableNumber(item.quantity) ?? 1;

      if (
        foodIndex === null ||
        menuId === null ||
        !Number.isInteger(foodIndex) ||
        !Number.isInteger(menuId) ||
        quantity <= 0 ||
        !candidateIdsByFoodIndex.get(foodIndex)?.has(menuId)
      ) {
        return;
      }

      const candidate = candidateMap.get(menuId);

      if (!candidate) {
        return;
      }

      const weight = this.asNullableNumber(candidate.weight) ?? 0;
      const weightQuantity = weight > 0 ? weight * quantity : quantity;
      const previousQuantity = merged.get(menuId) ?? 0;
      merged.set(menuId, roundToOneDecimal(previousQuantity + weightQuantity));
    });

    return {
      menu_ids: Array.from(merged.keys()),
      menu_quantities: Array.from(merged.values()),
    };
  }

  private async getFoodImageRecognitionMenusByIds(
    userId: number,
    menuIds: number[],
  ): Promise<
    Array<{
      id: number;
      name: string;
      brand: string | null;
      category: string | null;
      weight: number | null;
    }>
  > {
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
        'menu.weight AS weight',
      ])
      .where('menu.id IN (:...menuIds)', { menuIds })
      .andWhere(
        new Brackets((qb) => {
          qb.where('user.id IS NULL').orWhere('user.id = :userId', { userId });
        }),
      )
      .andWhere('menu.is_deleted = :isDeleted', { isDeleted: 0 })
      .getRawMany<{
        id: number;
        name: string;
        brand: string | null;
        category: string | null;
        weight: number | null;
      }>();
    const menuMap = new Map(rows.map((menu) => [Number(menu.id), menu]));

    return menuIds
      .map((menuId) => menuMap.get(menuId))
      .filter((menu): menu is NonNullable<typeof menu> => !!menu)
      .map((menu) => ({
        ...menu,
        id: Number(menu.id),
        weight: this.asNullableNumber(menu.weight),
      }));
  }

  private async getAllFoodImageRecognitionCandidateMenus(
    userId: number,
  ): Promise<
    Array<{
      id: number;
      name: string;
      brand: string | null;
      category: string | null;
      weight: number | null;
    }>
  > {
    return await this.menuRepository
      .createQueryBuilder('menu')
      .leftJoin('menu.user', 'user')
      .select([
        'menu.id AS id',
        'menu.name AS name',
        'menu.brand AS brand',
        'menu.category AS category',
        'menu.weight AS weight',
      ])
      .where(
        new Brackets((qb) => {
          qb.where('user.id IS NULL').orWhere('user.id = :userId', {
            userId,
          });
        }),
      )
      .andWhere('menu.is_deleted = :isDeleted', { isDeleted: 0 })
      .orderBy('menu.id', 'ASC')
      .getRawMany<{
        id: number;
        name: string;
        brand: string | null;
        category: string | null;
        weight: number | null;
      }>();
  }

  private isVectorSearchEnabled(): boolean {
    return ['1', 'true', 'yes', 'y'].includes(
      (process.env.VECTOR_SEARCH_ENABLED ?? '').toLowerCase(),
    );
  }

  private getFoodImageVectorCandidateLimit(): number {
    const parsed = Number(process.env.FOOD_IMAGE_VECTOR_CANDIDATE_LIMIT ?? 100);

    if (!Number.isFinite(parsed)) {
      return 100;
    }

    return Math.max(10, Math.min(Math.floor(parsed), 500));
  }

  private getFoodImagePerFoodVectorCandidateLimit(): number {
    const parsed = Number(
      process.env.FOOD_IMAGE_PER_FOOD_VECTOR_CANDIDATE_LIMIT ?? 10,
    );

    if (!Number.isFinite(parsed)) {
      return 10;
    }

    return Math.max(3, Math.min(Math.floor(parsed), 30));
  }

  // 영양성분표 사진 인식
  async recognizeNutritionLabel(
    user: UserEntity,
    file: Express.Multer.File,
  ): Promise<NutritionLabelRecognitionResponseDto> {
    if (!file) {
      throw new BadRequestException('image file is required');
    }

    if (!file.mimetype?.startsWith('image/')) {
      throw new BadRequestException('image file must be an image');
    }

    const prompt = `
영양성분표 사진을 분석해서 menu.entity 기준 JSON 객체 1개만 반환해.

규칙:
- 반드시 JSON object만 반환하고 마크다운, 설명, 코드펜스는 금지
- 사진에 명확히 보이는 값만 넣고, 확인되지 않으면 null
- 숫자는 단위 문자를 제외한 숫자만 넣기
- calories 는 kcal
- carbs, sugars, sugar_alchol, dietary_fiber, protein, fat, sat_fat, trans_fat, un_sat_fat, alcohol 은 g
- sodium, caffeine, potassium, cholesterol 은 mg
- unit 은 g 이면 0, ml 이면 1
- weight 는 1회 제공량 또는 총 내용량의 수치만 넣기
- 추정하지 말고 보이는 정보만 사용

반환 shape:
{
  "unit": 0,
  "weight": 0,
  "calories": 0,
  "carbs": null,
  "sugars": null,
  "sugar_alchol": null,
  "dietary_fiber": null,
  "protein": null,
  "fat": null,
  "sat_fat": null,
  "trans_fat": null,
  "un_sat_fat": null,
  "sodium": null,
  "caffeine": null,
  "potassium": null,
  "cholesterol": null,
  "alcohol": null
}
`.trim();

    const data = await this.callGeminiJsonWithImage(prompt, file);
    await this.uploadNutritionLabelImage(user, file);

    return new NutritionLabelRecognitionResponseDto(
      this.normalizeNutritionLabelRecognition(data),
    );
  }

  // 오늘의 식사 등록
  async registerMeal(
    user: UserEntity,
    registerMealRequestDto: RegisterMealRequestDto,
  ): Promise<void> {
    const {
      date,
      time,
      meal_time,
      image,
      menu_ids,
      menu_quantities,
      menu_input_modes,
      menu_set_ids,
    } = registerMealRequestDto;

    const hasAnyMenuField =
      menu_ids !== undefined ||
      menu_quantities !== undefined ||
      menu_input_modes !== undefined;
    const hasMenuSetField = menu_set_ids !== undefined && menu_set_ids !== null;
    const hasAnyRecordField = hasAnyMenuField || hasMenuSetField;
    const hasAllMenuFields =
      menu_ids !== undefined &&
      menu_quantities !== undefined &&
      menu_input_modes !== undefined;

    if (hasAnyMenuField && !hasAllMenuFields) {
      throw new BadRequestException(
        'menu_ids, menu_quantities and menu_input_modes must be provided together',
      );
    }

    const existingMeal = await this.mealRepository.findOne({
      where: {
        date,
        time,
        user: { id: user.id },
      },
      relations: {
        mealMenus: true,
        mealSets: true,
      },
    });

    if (!hasAnyRecordField) {
      if (existingMeal) {
        if (existingMeal.mealMenus?.length) {
          await this.mealMenuRepository.remove(existingMeal.mealMenus);
        }
        if (existingMeal.mealSets?.length) {
          await this.mealSetRepository.remove(existingMeal.mealSets);
        }

        existingMeal.image = null;
        if (meal_time !== undefined) {
          existingMeal.mealTime = meal_time;
        }
        existingMeal.mealMenus = [];
        existingMeal.mealSets = [];
        existingMeal.updatedAt = new Date();

        await this.mealRepository.save(existingMeal);
        return;
      }

      const meal = this.mealRepository.create({
        date,
        time,
        mealTime: meal_time ?? null,
        image: null,
        mealMenus: [],
        mealSets: [],
        user,
      });

      await this.mealRepository.save(meal);
      return;
    }

    let mealMenus: MealMenuEntity[] = [];

    if (hasAnyMenuField) {
      if (
        menu_ids.length !== menu_quantities.length ||
        menu_ids.length !== menu_input_modes.length
      ) {
        throw new BadRequestException(
          'menu_ids, menu_quantities and menu_input_modes must have the same length',
        );
      }

      const uniqueMenuIds = Array.from(new Set(menu_ids));
      const menus = await this.menuRepository.find({
        where: {
          id: In(uniqueMenuIds),
          is_deleted: 0,
        },
      });

      if (menus.length !== uniqueMenuIds.length) {
        throw new BadRequestException('Some menu_ids do not exist');
      }

      const menuMap = new Map(menus.map((menu) => [menu.id, menu]));

      mealMenus = menu_ids.map((menuId, index) =>
        this.mealMenuRepository.create({
          menu: menuMap.get(menuId),
          quantity: roundToOneDecimal(menu_quantities[index]),
          menu_input_mode: menu_input_modes[index],
        }),
      );
    }

    let mealSets: MealSetEntity[] = [];

    if (hasMenuSetField) {
      const uniqueSetIds = Array.from(new Set(menu_set_ids));
      const menuSets =
        uniqueSetIds.length > 0
          ? await this.menuSetRepository.find({
              where: {
                id: In(uniqueSetIds),
                user: { id: user.id },
              },
              relations: {
                setMenus: {
                  menu: true,
                },
              },
            })
          : [];

      if (menuSets.length !== uniqueSetIds.length) {
        throw new BadRequestException('Some menu_set_ids do not exist');
      }

      const setMap = new Map(menuSets.map((menuSet) => [menuSet.id, menuSet]));

      mealSets = menu_set_ids.map((setId, index) =>
        this.mealSetRepository.create({
          menuSet: setMap.get(setId),
          sort_order: index,
        }),
      );

      menu_set_ids.forEach((setId) => {
        const menuSet = setMap.get(setId);
        const setMenus = this.sortSetMenus(menuSet?.setMenus ?? []);
        const expandedMealMenus = setMenus.map((setMenu) =>
          this.mealMenuRepository.create({
            menu: setMenu.menu,
            quantity: setMenu.quantity,
            menu_input_mode: setMenu.menu_input_mode,
          }),
        );

        mealMenus.push(...expandedMealMenus);
      });
    }

    if (existingMeal) {
      if (existingMeal.mealMenus?.length) {
        await this.mealMenuRepository.remove(existingMeal.mealMenus);
      }
      if (existingMeal.mealSets?.length) {
        await this.mealSetRepository.remove(existingMeal.mealSets);
      }

      existingMeal.image = image ?? null;
      if (meal_time !== undefined) {
        existingMeal.mealTime = meal_time;
      }
      existingMeal.mealMenus = mealMenus;
      existingMeal.mealSets = mealSets;
      existingMeal.updatedAt = new Date();

      await this.mealRepository.save(existingMeal);
      return;
    }

    const meal = this.mealRepository.create({
      date,
      time,
      mealTime: meal_time ?? null,
      image,
      mealMenus,
      mealSets,
      user,
    });

    await this.mealRepository.save(meal);
  }

  // 오늘의 식사 삭제
  async deleteMeal(
    user: UserEntity,
    deleteMealRequestDto: DeleteMealRequestDto,
  ): Promise<void> {
    const { date, time, menu_id } = deleteMealRequestDto;

    const meal = await this.mealRepository.findOne({
      where: {
        date,
        time,
        user: { id: user.id },
      },
      relations: {
        mealMenus: {
          menu: true,
        },
      },
    });

    if (!meal) {
      throw new NotFoundException('Meal not found');
    }

    if (menu_id === undefined) {
      if (meal.mealMenus.length > 0) {
        throw new BadRequestException(
          'menu_id is required to delete a menu from the meal',
        );
      }

      await this.mealRepository.remove(meal);
      return;
    }

    const mealMenuToDelete = meal.mealMenus.find(
      (mealMenu) => mealMenu.menu.id === menu_id,
    );

    if (!mealMenuToDelete) {
      throw new BadRequestException('menu_id does not exist in the meal');
    }

    await this.mealMenuRepository.remove(mealMenuToDelete);

    const remainingMealMenuCount = await this.mealMenuRepository.count({
      where: {
        meal: { id: meal.id },
      },
    });

    if (remainingMealMenuCount === 0) {
      await this.mealRepository.remove(meal);
    }
  }

  // 오늘의 식사 조회
  async getMealRecord(
    user: UserEntity,
    dateRequestDto: DateRequestDto,
  ): Promise<MealRecordResponseDto> {
    const { date } = dateRequestDto;
    const startOfDay = new Date(date);
    const endOfDay = new Date(date);

    startOfDay.setHours(0, 0, 0, 0);
    endOfDay.setHours(23, 59, 59, 999);

    const mealList = await this.mealRepository.find({
      where: {
        date: Between(startOfDay, endOfDay),
        user: { id: user.id },
      },
      relations: {
        mealMenus: {
          menu: true,
        },
        mealSets: {
          menuSet: {
            setMenus: {
              menu: true,
            },
          },
        },
      },
      order: {
        time: 'ASC',
        mealMenus: {
          id: 'ASC',
        },
        mealSets: {
          sort_order: 'ASC',
          id: 'ASC',
        },
      },
    });

    return new MealRecordResponseDto(
      mealList.map(
        (meal) =>
          new MealResponseDto(
            meal.time,
            meal.mealTime,
            meal.image,
            meal.createdAt,
            meal.updatedAt,
            meal.mealMenus.map(
              (mealMenu) => new MenuSimpleResponseDto(mealMenu.menu),
            ),
            meal.mealMenus.map((mealMenu) => mealMenu.quantity),
            meal.mealMenus.map((mealMenu) => mealMenu.menu_input_mode),
            this.buildMealSetResponseList(meal.mealSets),
          ),
      ),
    );
  }

  async getMealRecordedDates(
    user: UserEntity,
    dto: MealRecordedDatesRequestDto,
  ): Promise<MealRecordedDatesResponseDto> {
    const startOfRange = this.parseDateOnly(dto.startDate, false);
    const endOfRange = this.parseDateOnly(dto.endDate, true);

    if (startOfRange > endOfRange) {
      throw new BadRequestException(
        'startDate must be before or equal to endDate',
      );
    }

    const rows = await this.mealRepository
      .createQueryBuilder('meal')
      .select('DATE(meal.date)', 'recordedDate')
      .where('meal.userId = :userId', { userId: user.id })
      .andWhere('meal.date BETWEEN :startOfRange AND :endOfRange', {
        startOfRange,
        endOfRange,
      })
      .groupBy('DATE(meal.date)')
      .orderBy('DATE(meal.date)', 'ASC')
      .getRawMany<{ recordedDate: string | Date }>();

    return new MealRecordedDatesResponseDto(
      rows.map((row) => this.formatDateOnly(row.recordedDate)),
    );
  }

  private parseDateOnly(date: string, endOfDay: boolean): Date {
    const [year, month, day] = date.split('-').map(Number);
    const parsedDate = new Date(
      year,
      month - 1,
      day,
      endOfDay ? 23 : 0,
      endOfDay ? 59 : 0,
      endOfDay ? 59 : 0,
      endOfDay ? 999 : 0,
    );

    if (
      parsedDate.getFullYear() !== year ||
      parsedDate.getMonth() !== month - 1 ||
      parsedDate.getDate() !== day
    ) {
      throw new BadRequestException('Invalid date');
    }

    return parsedDate;
  }

  private formatDateOnly(date: string | Date): string {
    if (typeof date === 'string') {
      return date.slice(0, 10);
    }

    const year = date.getFullYear();
    const month = `${date.getMonth() + 1}`.padStart(2, '0');
    const day = `${date.getDate()}`.padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  // 브랜드 검색
  async searchBrand(input: string): Promise<SearchBrandResponseDto> {
    const keyword = input?.trim();

    if (!keyword) {
      return new SearchBrandResponseDto([]);
    }

    const keywordPattern = `%${keyword}%`;

    const searchedBrandRows = await this.menuRepository
      .createQueryBuilder('menu')
      .select('menu.brand', 'brand')
      .where('menu.brand LIKE :keyword', { keyword: keywordPattern })
      .andWhere('menu.is_deleted = :isDeleted', { isDeleted: 0 })
      .andWhere('menu.user IS NULL')
      .groupBy('menu.brand')
      .orderBy('menu.brand', 'ASC')
      .getRawMany<{ brand: string }>();

    const brand_list: string[] = searchedBrandRows.map((row) => row.brand);

    return new SearchBrandResponseDto(brand_list);
  }

  // 브랜드 추가 요청
  async brandAddRequet(user: UserEntity, input: string): Promise<void> {
    const brand = input?.trim();

    if (!brand) {
      throw new BadRequestException('brand must not be empty');
    }

    const existingBrand = await this.menuRepository
      .createQueryBuilder('menu')
      .select('menu.brand', 'brand')
      .where('menu.brand = :brand', { brand })
      .andWhere('menu.is_deleted = :isDeleted', { isDeleted: 0 })
      .andWhere('menu.user IS NULL')
      .getRawOne<{ brand: string }>();

    if (existingBrand) {
      throw new ConflictException('Your brand already exists');
    }

    const duplicatedBrandRequest = await this.brandAddRepository.findOne({
      where: {
        brand,
        user: { id: user.id },
      },
    });

    if (duplicatedBrandRequest) {
      throw new ConflictException('Your brand request already exists');
    }

    const newBrand = this.brandAddRepository.create({
      brand,
      user,
    });

    await this.brandAddRepository.save(newBrand);
  }

  // 영양성분 등록
  async registerMenu(
    user: UserEntity,
    registerMenuRequestDto: RegisterMenuRequestDto,
  ): Promise<MenuIdResponseDto> {
    const menu = this.menuRepository.create({
      ...this.applyMenuSearchFields(
        this.normalizeMenuFloatValues(registerMenuRequestDto),
      ),
      data_source: 1,
      is_deleted: 0,
      category: null,
      unit_quantity: '인분',
      user,
    });

    await this.menuRepository.save(menu);

    return new MenuIdResponseDto(menu);
  }

  // CSV 메뉴 등록
  async importMenusCsv(
    file: Express.Multer.File,
  ): Promise<MenuCsvImportResponseDto> {
    if (!file) {
      throw new BadRequestException('csv file is required');
    }

    const csvText = this.decodeCsvBuffer(file.buffer);
    const rows = this.parseCsv(csvText);

    if (rows.length < 2) {
      throw new BadRequestException('csv must include header and data rows');
    }

    const headers = rows[0].map((header) => header.trim());
    const menus = rows
      .slice(1)
      .filter((row) => row.some((value) => value.trim().length > 0))
      .map((row) => this.toMenuFromCsvRow(headers, row))
      .filter((menu): menu is MenuEntity => menu !== null);

    const savedMenus = await this.menuRepository.save(menus);

    return new MenuCsvImportResponseDto(savedMenus.length);
  }

  // 영양성분 수정
  async modifyMenu(
    user: UserEntity,
    modifyMenuRequestDto: ModifyMenuRequestDto,
  ): Promise<void> {
    const menu = await this.menuRepository.findOne({
      where: {
        id: modifyMenuRequestDto.id,
        is_deleted: 0,
        user: { id: user.id },
      },
    });

    if (!menu) {
      throw new NotFoundException('Menu not found');
    }

    Object.assign(menu, {
      ...this.applyMenuSearchFields(
        this.normalizeMenuFloatValues(modifyMenuRequestDto),
      ),
      data_source: 1,
      category: null,
      unit_quantity: '인분',
    });

    await this.menuRepository.save(menu);
  }

  // 영양성분 삭제
  async deleteMenu(user: UserEntity, menuId: number): Promise<void> {
    const menu = await this.menuRepository.findOne({
      where: {
        id: menuId,
        is_deleted: 0,
        user: { id: user.id },
      },
    });

    if (!menu) {
      throw new NotFoundException('Menu not found');
    }

    menu.is_deleted = 1;
    await this.menuRepository.save(menu);
  }

  // 오늘의 체중 등록
  async registerWeight(
    user: UserEntity,
    registerWeightRequestDto: RegisterWeightRequestDto,
  ): Promise<void> {
    const { date, weight } = registerWeightRequestDto;
    const startOfDay = new Date(date);
    const endOfDay = new Date(date);

    startOfDay.setHours(0, 0, 0, 0);
    endOfDay.setHours(23, 59, 59, 999);

    const weightSteps = await this.weightStepsRepository.findOne({
      where: {
        date: Between(startOfDay, endOfDay),
        user: { id: user.id },
      },
    });

    if (weightSteps) {
      weightSteps.weight = roundToOneDecimal(weight);
      await this.weightStepsRepository.save(weightSteps);
      return;
    }

    await this.weightStepsRepository.save(
      this.weightStepsRepository.create({
        date,
        weight: roundToOneDecimal(weight),
        steps: null,
        user,
      }),
    );
  }

  // 오늘의 걸음 수 등록
  async registerSteps(
    user: UserEntity,
    registerStepsRequestDto: RegisterStepsRequestDto,
  ): Promise<void> {
    const { date, steps } = registerStepsRequestDto;
    const startOfDay = new Date(date);
    const endOfDay = new Date(date);

    startOfDay.setHours(0, 0, 0, 0);
    endOfDay.setHours(23, 59, 59, 999);

    const weightSteps = await this.weightStepsRepository.findOne({
      where: {
        date: Between(startOfDay, endOfDay),
        user: { id: user.id },
      },
    });

    if (weightSteps) {
      weightSteps.steps = roundToOneDecimal(steps);
      await this.weightStepsRepository.save(weightSteps);
      return;
    }

    await this.weightStepsRepository.save(
      this.weightStepsRepository.create({
        date,
        weight: null,
        steps: roundToOneDecimal(steps),
        user,
      }),
    );
  }

  // CSV 버퍼 디코딩
  private decodeCsvBuffer(buffer: Buffer): string {
    const utf8Text = new TextDecoder('utf-8').decode(buffer);

    if (!utf8Text.includes('�')) {
      return utf8Text;
    }

    try {
      return new TextDecoder('euc-kr').decode(buffer);
    } catch (error) {
      return utf8Text;
    }
  }

  // CSV 텍스트 파싱
  private parseCsv(csvText: string): string[][] {
    const rows: string[][] = [];
    let row: string[] = [];
    let value = '';
    let inQuotes = false;

    for (let index = 0; index < csvText.length; index += 1) {
      const char = csvText[index];
      const nextChar = csvText[index + 1];

      if (char === '"') {
        if (inQuotes && nextChar === '"') {
          value += '"';
          index += 1;
        } else {
          inQuotes = !inQuotes;
        }
        continue;
      }

      if (char === ',' && !inQuotes) {
        row.push(value);
        value = '';
        continue;
      }

      if ((char === '\n' || char === '\r') && !inQuotes) {
        if (char === '\r' && nextChar === '\n') {
          index += 1;
        }
        row.push(value);
        rows.push(row);
        row = [];
        value = '';
        continue;
      }

      value += char;
    }

    if (value.length > 0 || row.length > 0) {
      row.push(value);
      rows.push(row);
    }

    if (inQuotes) {
      throw new BadRequestException('csv has an unclosed quoted value');
    }

    return rows;
  }

  // CSV 행을 메뉴 엔티티로 변환
  private toMenuFromCsvRow(
    headers: string[],
    row: string[],
  ): MenuEntity | null {
    const valueByField = this.mapCsvRow(headers, row);
    const name = this.asNullableString(valueByField.name);

    if (!name) {
      return null;
    }

    const weight = this.asNullableNumber(valueByField.weight) ?? 0;
    const calories = this.asNullableNumber(valueByField.calories) ?? 0;

    return this.menuRepository.create({
      ...this.applyMenuSearchFields(
        this.normalizeMenuFloatValues({
          name,
          brand: this.asNullableString(valueByField.brand),
          category: this.asNullableString(valueByField.category),
          unit: this.asCsvUnit(
            valueByField.unit,
            valueByField.unit_quantity,
            valueByField.weight,
          ),
          weight,
          unit_quantity: this.asCsvUnitQuantity(
            valueByField.unit_quantity,
            valueByField.unit,
          ),
          calories,
          carbs: this.asNullableNumber(valueByField.carbs),
          sugars: this.asNullableNumber(valueByField.sugars),
          sugar_alchol: this.asNullableNumber(valueByField.sugar_alchol),
          dietary_fiber: this.asNullableNumber(valueByField.dietary_fiber),
          protein: this.asNullableNumber(valueByField.protein),
          fat: this.asNullableNumber(valueByField.fat),
          sat_fat: this.asNullableNumber(valueByField.sat_fat),
          trans_fat: this.asNullableNumber(valueByField.trans_fat),
          un_sat_fat: this.asNullableNumber(valueByField.un_sat_fat),
          sodium: this.asNullableNumber(valueByField.sodium),
          caffeine: this.asNullableNumber(valueByField.caffeine),
          potassium: this.asNullableNumber(valueByField.potassium),
          cholesterol: this.asNullableNumber(valueByField.cholesterol),
          alcohol: this.asNullableNumber(valueByField.alcohol),
        }),
      ),
      data_source: 0,
      is_deleted: 0,
      user: null,
    });
  }

  // CSV 헤더를 엔티티 필드명에 매칭
  private mapCsvRow(
    headers: string[],
    row: string[],
  ): Record<string, string | undefined> {
    const valueByField: Record<string, string | undefined> = {};
    const mappings: Array<{ field: string; keywords: string[] }> = [
      { field: 'unit_quantity', keywords: ['중량 단위'] },
      { field: 'unit', keywords: ['단위량'] },
      { field: 'sugar_alchol', keywords: ['당알코올', '당 알코올'] },
      { field: 'dietary_fiber', keywords: ['식이섬유', '식이 섬유'] },
      { field: 'protein', keywords: ['단백질'] },
      { field: 'calories', keywords: ['칼로리'] },
      { field: 'sat_fat', keywords: ['포화지방', '포화 지방'] },
      { field: 'trans_fat', keywords: ['트랜스지방', '트랜스 지방'] },
      { field: 'un_sat_fat', keywords: ['불포화지방', '불포화 지방'] },
      { field: 'sodium', keywords: ['나트륨'] },
      { field: 'caffeine', keywords: ['카페인'] },
      { field: 'potassium', keywords: ['칼륨'] },
      { field: 'cholesterol', keywords: ['콜레스테롤'] },
      { field: 'alcohol', keywords: ['알코올'] },
      { field: 'sugars', keywords: ['당류'] },
      { field: 'carbs', keywords: ['탄수화물'] },
      { field: 'weight', keywords: ['중량'] },
      { field: 'category', keywords: ['카테고리'] },
      { field: 'brand', keywords: ['브랜드'] },
      { field: 'name', keywords: ['메뉴'] },
      { field: 'fat', keywords: ['지방'] },
    ];

    headers.forEach((header, index) => {
      const normalizedHeader = header.replace(/\s/g, '');
      const matched = mappings.find((mapping) =>
        mapping.keywords.some((keyword) =>
          normalizedHeader.includes(keyword.replace(/\s/g, '')),
        ),
      );

      if (matched) {
        valueByField[matched.field] = row[index];
      }
    });

    return valueByField;
  }

  // CSV 중량 단위 변환
  private asCsvUnit(
    value: unknown,
    fallback: unknown,
    weight: unknown,
  ): number {
    const parsed = this.asNullableNumber(value);

    if (parsed === 0 || parsed === 1) {
      return parsed;
    }

    const fallbackParsed = this.asNullableNumber(fallback);

    if (fallbackParsed === 0 || fallbackParsed === 1) {
      return fallbackParsed;
    }

    try {
      return this.asUnit(value, fallback, weight);
    } catch (error) {
      return 0;
    }
  }

  // CSV 단위량 변환
  private asCsvUnitQuantity(value: unknown, fallback: unknown): string {
    const text = this.asNullableString(value);

    if (text && !Number.isFinite(this.extractNumericValue(text))) {
      return text;
    }

    const fallbackText = this.asNullableString(fallback);

    if (
      fallbackText &&
      !Number.isFinite(this.extractNumericValue(fallbackText))
    ) {
      return fallbackText;
    }

    return '인분';
  }

  // 메뉴 영양성분 소수점 값 정규화
  private normalizeMenuFloatValues<
    T extends {
      weight: number;
      calories: number;
      carbs?: number | null;
      sugars?: number | null;
      sugar_alchol?: number | null;
      dietary_fiber?: number | null;
      protein?: number | null;
      fat?: number | null;
      sat_fat?: number | null;
      trans_fat?: number | null;
      un_sat_fat?: number | null;
      sodium?: number | null;
      caffeine?: number | null;
      potassium?: number | null;
      cholesterol?: number | null;
      alcohol?: number | null;
    },
  >(value: T): T {
    return {
      ...value,
      weight: roundToOneDecimal(value.weight),
      calories: roundToOneDecimal(value.calories),
      carbs: roundNullableToOneDecimal(value.carbs),
      sugars: roundNullableToOneDecimal(value.sugars),
      sugar_alchol: roundNullableToOneDecimal(value.sugar_alchol),
      dietary_fiber: roundNullableToOneDecimal(value.dietary_fiber),
      protein: roundNullableToOneDecimal(value.protein),
      fat: roundNullableToOneDecimal(value.fat),
      sat_fat: roundNullableToOneDecimal(value.sat_fat),
      trans_fat: roundNullableToOneDecimal(value.trans_fat),
      un_sat_fat: roundNullableToOneDecimal(value.un_sat_fat),
      sodium: roundNullableToOneDecimal(value.sodium),
      caffeine: roundNullableToOneDecimal(value.caffeine),
      potassium: roundNullableToOneDecimal(value.potassium),
      cholesterol: roundNullableToOneDecimal(value.cholesterol),
      alcohol: roundNullableToOneDecimal(value.alcohol),
    };
  }

  // 영양성분표 인식 결과 정규화
  private normalizeNutritionLabelRecognition(
    value: any,
  ): NutritionLabelRecognition {
    const weightRaw = value?.weight;
    const inferredUnit = this.asUnit(value?.unit, weightRaw);

    const normalized = this.normalizeMenuFloatValues({
      unit: inferredUnit,
      weight: this.asRequiredNumber(weightRaw, 'weight'),
      calories: this.asRequiredNumber(value?.calories, 'calories'),
      carbs: this.asNullableNumber(value?.carbs),
      sugars: this.asNullableNumber(value?.sugars),
      sugar_alchol: this.asNullableNumber(value?.sugar_alchol),
      dietary_fiber: this.asNullableNumber(value?.dietary_fiber),
      protein: this.asNullableNumber(value?.protein),
      fat: this.asNullableNumber(value?.fat),
      sat_fat: this.asNullableNumber(value?.sat_fat),
      trans_fat: this.asNullableNumber(value?.trans_fat),
      un_sat_fat: this.asNullableNumber(value?.un_sat_fat),
      sodium: this.asNullableNumber(value?.sodium),
      caffeine: this.asNullableNumber(value?.caffeine),
      potassium: this.asNullableNumber(value?.potassium),
      cholesterol: this.asNullableNumber(value?.cholesterol),
      alcohol: this.asNullableNumber(value?.alcohol),
    });

    return normalized;
  }

  // 음식 사진 인식 결과 정규화
  private normalizeFoodImageRecognition(
    value: any,
    menus: Array<{ id: number; weight: number | null }>,
  ): {
    menu_ids: number[];
    menu_quantities: number[];
  } {
    this.assertFoodImageRecognizable(value);

    const menuMap = new Map(
      menus.map((menu) => [
        Number(menu.id),
        {
          weight: this.asNullableNumber(menu.weight) ?? 0,
        },
      ]),
    );
    const menuIds = Array.isArray(value?.menu_ids) ? value.menu_ids : [];
    const menuQuantities = Array.isArray(value?.menu_quantities)
      ? value.menu_quantities
      : [];

    if (menuIds.length !== menuQuantities.length) {
      throw new ServiceUnavailableException(
        'Food image recognition returned mismatched arrays',
      );
    }

    const merged = new Map<number, number>();

    for (let index = 0; index < menuIds.length; index += 1) {
      const menuId = this.asNullableNumber(menuIds[index]);
      const quantity = this.asNullableNumber(menuQuantities[index]);

      if (
        menuId === null ||
        quantity === null ||
        !Number.isInteger(menuId) ||
        quantity <= 0 ||
        !menuMap.has(menuId)
      ) {
        continue;
      }

      const menuWeight = menuMap.get(menuId)!.weight;
      const weightQuantity = menuWeight > 0 ? quantity * menuWeight : 0;
      const previousQuantity = merged.get(menuId) ?? 0;
      merged.set(menuId, roundToOneDecimal(previousQuantity + weightQuantity));
    }

    if (merged.size === 0) {
      throw new BadRequestException(
        FOOD_IMAGE_RECOGNITION_FAILURE_MESSAGES.NO_MATCHING_MENU,
      );
    }

    return {
      menu_ids: Array.from(merged.keys()),
      menu_quantities: Array.from(merged.values()),
    };
  }

  // 음식 사진 인식 실패 사유를 클라이언트에 전달
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

  // 음식 사진 인식 실패 사유 enum 검증
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

  // Gemini 이미지 JSON 응답 호출
  private async callGeminiJsonWithImage(
    prompt: string,
    file: Express.Multer.File,
    unavailableMessage = 'Nutrition label recognition is unavailable',
  ): Promise<any> {
    const apiKey = process.env.GEMINI_API_KEY;
    const primaryModel =
      process.env.GEMINI_IMAGE_MODEL ??
      process.env.GEMINI_MODEL ??
      DEFAULT_GEMINI_MODEL;
    const configuredFallbackModels = [
      ...(process.env.GEMINI_IMAGE_FALLBACK_MODELS?.split(',').map((model) =>
        model.trim(),
      ) ?? []),
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
        if (
          index === attempts.length - 1 ||
          !this.shouldRetryGeminiWithFallback(error)
        ) {
          break;
        }
      }
    }

    throw new ServiceUnavailableException(unavailableMessage);
  }

  private async postGeminiImageJson(
    prompt: string,
    file: Express.Multer.File,
    apiKey: string,
    baseUrl: string,
  ): Promise<any> {
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

  // 인식용 음식 사진 S3 업로드
  private async uploadRecognizedFoodImage(
    user: UserEntity,
    file: Express.Multer.File,
  ): Promise<string> {
    const date = new Date().toISOString().slice(0, 10).replace(/-/g, '');
    const randomString = Math.random().toString(36).substring(2, 12);
    const fileExtension = this.getImageExtension(file.mimetype);
    const fileKey = `meal-recognition/${user.id}/${date}/${randomString}.${fileExtension}`;

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

  private async uploadFailedFoodImageRecognitionIfPossible(
    user: UserEntity,
    file: Express.Multer.File,
    error: unknown,
  ): Promise<void> {
    try {
      const imageUrl = await this.uploadFailedFoodImageRecognition(user, file);

      console.warn('[HOME] failed food image recognition uploaded', {
        userId: user.id,
        imageUrl,
        errorMessage: error instanceof Error ? error.message : String(error),
      });
    } catch (uploadError) {
      console.warn('[HOME] failed food image recognition upload failed', {
        userId: user.id,
        originalErrorMessage:
          error instanceof Error ? error.message : String(error),
        uploadErrorMessage:
          uploadError instanceof Error
            ? uploadError.message
            : String(uploadError),
      });
    }
  }

  private async uploadFailedFoodImageRecognition(
    user: UserEntity,
    file: Express.Multer.File,
  ): Promise<string> {
    const date = new Date().toISOString().slice(0, 10).replace(/-/g, '');
    const randomString = Math.random().toString(36).substring(2, 12);
    const fileExtension = this.getImageExtension(file.mimetype);
    const fileKey = `meal-recognition/failed/${user.id}/${date}/${randomString}.${fileExtension}`;

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

  // 영양성분표 인식용 사진 S3 업로드
  private async uploadNutritionLabelImage(
    user: UserEntity,
    file: Express.Multer.File,
  ): Promise<string> {
    const date = new Date().toISOString().slice(0, 10).replace(/-/g, '');
    const randomString = Math.random().toString(36).substring(2, 12);
    const fileExtension = this.getImageExtension(file.mimetype);
    const fileKey = `nutrition-label-recognition/${user.id}/${date}/${randomString}.${fileExtension}`;

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

  // 응답 문자열의 코드 펜스 제거
  private stripCodeFence(value: string): string {
    return value
      .replace(/^```json\s*/i, '')
      .replace(/^```\s*/i, '')
      .replace(/\s*```$/i, '')
      .trim();
  }

  // 빈 문자열을 null로 변환
  private asNullableString(value: unknown): string | null {
    return typeof value === 'string' && value.trim().length > 0
      ? value.trim()
      : null;
  }

  // 단위 값을 g 또는 ml 기준으로 변환
  private asUnit(value: unknown, ...hints: Array<unknown>): number {
    if (value === 0 || value === '0') {
      return 0;
    }

    if (value === 1 || value === '1') {
      return 1;
    }

    const texts = [value, ...hints]
      .filter((item): item is string => typeof item === 'string')
      .map((item) => item.toLowerCase());

    if (texts.some((text) => text.includes('ml'))) {
      return 1;
    }

    if (texts.some((text) => /\bg\b/.test(text) || text.includes('그램'))) {
      return 0;
    }

    throw new ServiceUnavailableException(
      'Nutrition label recognition returned invalid unit',
    );
  }

  // 필수 숫자 필드 검증 및 변환
  private asRequiredNumber(value: unknown, fieldName: string): number {
    const parsed = this.asNullableNumber(value);

    if (parsed === null) {
      throw new ServiceUnavailableException(
        `Nutrition label recognition returned invalid ${fieldName}`,
      );
    }

    return parsed;
  }

  // 선택 숫자 필드 변환
  private asNullableNumber(value: unknown): number | null {
    if (value === null || value === undefined || value === '') {
      return null;
    }

    const numericValue = this.extractNumericValue(value);

    return Number.isFinite(numericValue) ? numericValue : null;
  }

  // 문자열에서 숫자 값 추출
  private extractNumericValue(value: unknown): number {
    if (typeof value === 'number') {
      return value;
    }

    if (typeof value !== 'string') {
      return NaN;
    }

    const normalized = value.replace(/,/g, '').trim();
    const directNumber = Number(normalized);

    if (Number.isFinite(directNumber)) {
      return directNumber;
    }

    const matchedNumber = normalized.match(/-?\d+(?:\.\d+)?/);

    if (!matchedNumber) {
      return NaN;
    }

    return Number(matchedNumber[0]);
  }

  // MIME 타입에 맞는 이미지 확장자 반환
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

  private calculateMenuCaloriesForQuantity(
    menu: MenuEntity,
    quantity: number,
    inputMode: number,
  ): number {
    const calories = Number(menu.calories ?? 0);

    if (inputMode === 1) {
      const weight = Number(menu.weight ?? 0);
      return weight > 0 ? calories * (quantity / weight) : calories;
    }

    return calories * quantity;
  }

  private sortSetMenus(setMenus: MenuSetMenuEntity[]): MenuSetMenuEntity[] {
    return [...(setMenus ?? [])].sort(
      (a, b) => a.sort_order - b.sort_order || a.id - b.id,
    );
  }

  private calculateSetTotalCalories(setMenus: MenuSetMenuEntity[]): number {
    return roundToOneDecimal(
      this.sortSetMenus(setMenus).reduce(
        (sum, setMenu) => {
          const calories = Number(setMenu.menu.calories ?? 0);
          const weight = Number(setMenu.menu.weight ?? 0);
          const quantity = Number(setMenu.quantity);
          const calculatedCalories =
            weight > 0 ? calories * (quantity / weight) : calories;

          return sum + calculatedCalories;
        },
        0,
      ),
    );
  }

  private buildMealSetResponseList(
    mealSets?: MealSetEntity[],
  ): MealSetResponseDto[] | null {
    const sortedMealSets = [...(mealSets ?? [])].sort(
      (a, b) => a.sort_order - b.sort_order || a.id - b.id,
    );

    if (sortedMealSets.length === 0) {
      return null;
    }

    return sortedMealSets.map((mealSet) => {
      const setMenus = this.sortSetMenus(mealSet.menuSet?.setMenus ?? []);

      return new MealSetResponseDto(
        mealSet.menuSet.id,
        mealSet.menuSet.name,
        setMenus.map((setMenu) => new MenuSimpleResponseDto(setMenu.menu)),
        this.calculateSetTotalCalories(setMenus),
      );
    });
  }

  async upsertFolder(
    user: UserEntity,
    dto: UpsertFolderRequestDto,
  ): Promise<FolderIdResponseDto> {
    const folderName = dto.folder_name.trim();

    if (!folderName) {
      throw new BadRequestException('folder_name should not be empty');
    }

    this.validateFolderMenuArrays(dto);

    const uniqueMenuIds = Array.from(new Set(dto.menu_ids));
    const menuCount = await this.menuRepository.count({
      where: {
        id: In(uniqueMenuIds),
        is_deleted: 0,
      },
    });

    if (menuCount !== uniqueMenuIds.length) {
      throw new NotFoundException('Menu not found');
    }

    const folderId = await this.folderRepository.manager.transaction(
      async (manager) => {
        const folderRepository = manager.getRepository(FolderEntity);
        const folderMenuRepository = manager.getRepository(FolderMenuEntity);

        let folder: FolderEntity;

        if (dto.folder_id) {
          folder = await folderRepository
            .createQueryBuilder('folder')
            .innerJoin('folder.user', 'user')
            .where('folder.id = :folderId', { folderId: dto.folder_id })
            .andWhere('user.id = :userId', { userId: user.id })
            .getOne();

          if (!folder) {
            throw new NotFoundException('Folder not found');
          }

          folder.name = folderName;
          folder = await folderRepository.save(folder);
          await folderMenuRepository.delete({ folder: { id: folder.id } });
        } else {
          folder = folderRepository.create({
            name: folderName,
            user,
          });
          folder = await folderRepository.save(folder);
        }

        const folderMenus = dto.menu_ids.map((menuId, index) =>
          folderMenuRepository.create({
            folder,
            menu: { id: menuId } as MenuEntity,
            quantity: dto.menu_quantities[index],
            menu_input_mode: dto.menu_input_modes[index],
            sort_order: index,
          }),
        );

        await folderMenuRepository.save(folderMenus);

        return folder.id;
      },
    );

    return new FolderIdResponseDto(folderId);
  }

  async getFolders(
    user: UserEntity,
    dto: FolderListRequestDto,
  ): Promise<FolderListResponseDto> {
    const limit = dto.limit;
    const query = this.folderRepository
      .createQueryBuilder('folder')
      .innerJoin('folder.user', 'user')
      .where('user.id = :userId', { userId: user.id })
      .orderBy('folder.id', 'DESC')
      .limit(limit + 1);

    if (dto.cursor) {
      query.andWhere('folder.id < :cursor', { cursor: dto.cursor });
    }

    const folders = await query.getMany();
    const hasNext = folders.length > limit;
    const pagedFolders = hasNext ? folders.slice(0, limit) : folders;
    const folderIds = pagedFolders.map((folder) => folder.id);

    const folderMenus =
      folderIds.length > 0
        ? await this.folderMenuRepository.find({
            where: {
              folder: {
                id: In(folderIds),
              },
            },
            relations: {
              folder: true,
              menu: true,
            },
            order: {
              sort_order: 'ASC',
              id: 'ASC',
            },
          })
        : [];

    const menuNamesByFolderId = new Map<number, string[]>();
    folderMenus.forEach((folderMenu) => {
      const folderId = folderMenu.folder.id;
      const menuNames = menuNamesByFolderId.get(folderId) ?? [];
      menuNames.push(stripPublicMenuSourcePrefix(folderMenu.menu.name));
      menuNamesByFolderId.set(folderId, menuNames);
    });

    const folderList: FolderListItemResponseDto[] = pagedFolders.map(
      (folder) => ({
        folder_id: folder.id,
        folder_name: folder.name,
        menu_names: menuNamesByFolderId.get(folder.id) ?? [],
      }),
    );

    const nextCursor =
      hasNext && pagedFolders.length > 0
        ? pagedFolders[pagedFolders.length - 1].id
        : null;

    return new FolderListResponseDto(folderList, nextCursor);
  }

  async getFolderDetail(
    user: UserEntity,
    dto: FolderDetailRequestDto,
  ): Promise<FolderDetailResponseDto> {
    const folder = await this.folderRepository
      .createQueryBuilder('folder')
      .innerJoin('folder.user', 'user')
      .where('folder.id = :folderId', { folderId: dto.folder_id })
      .andWhere('user.id = :userId', { userId: user.id })
      .getOne();

    if (!folder) {
      throw new NotFoundException('Folder not found');
    }

    const folderMenus = await this.folderMenuRepository.find({
      where: {
        folder: {
          id: folder.id,
        },
      },
      relations: {
        menu: true,
      },
      order: {
        sort_order: 'ASC',
        id: 'ASC',
      },
    });

    return new FolderDetailResponseDto(
      folder.name,
      folderMenus.map(
        (folderMenu) => new MenuSimpleResponseDto(folderMenu.menu),
      ),
      folderMenus.map((folderMenu) => folderMenu.quantity),
      folderMenus.map((folderMenu) => folderMenu.menu_input_mode),
    );
  }

  async deleteFolder(
    user: UserEntity,
    dto: DeleteFolderRequestDto,
  ): Promise<void> {
    const folder = await this.folderRepository
      .createQueryBuilder('folder')
      .innerJoin('folder.user', 'user')
      .where('folder.id = :folderId', { folderId: dto.folder_id })
      .andWhere('user.id = :userId', { userId: user.id })
      .getOne();

    if (!folder) {
      throw new NotFoundException('Folder not found');
    }

    await this.folderRepository.delete(folder.id);
  }

  private validateFolderMenuArrays(dto: UpsertFolderRequestDto): void {
    const menuCount = dto.menu_ids.length;

    if (
      dto.menu_quantities.length !== menuCount ||
      dto.menu_input_modes.length !== menuCount
    ) {
      throw new BadRequestException(
        'menu_ids, menu_quantities and menu_input_modes must have the same length',
      );
    }
  }

  async upsertMenuSet(
    user: UserEntity,
    dto: UpsertMenuSetRequestDto,
  ): Promise<MenuSetIdResponseDto> {
    const setName = dto.set_name.trim();

    if (!setName) {
      throw new BadRequestException('set_name should not be empty');
    }

    this.validateMenuSetMenuArrays(dto);

    const uniqueMenuIds = Array.from(new Set(dto.menu_ids));
    const menuCount = await this.menuRepository.count({
      where: {
        id: In(uniqueMenuIds),
        is_deleted: 0,
      },
    });

    if (menuCount !== uniqueMenuIds.length) {
      throw new NotFoundException('Menu not found');
    }

    const setId = await this.menuSetRepository.manager.transaction(
      async (manager) => {
        const menuSetRepository = manager.getRepository(MenuSetEntity);
        const menuSetMenuRepository =
          manager.getRepository(MenuSetMenuEntity);

        let menuSet: MenuSetEntity;

        if (dto.set_id) {
          menuSet = await menuSetRepository
            .createQueryBuilder('menuSet')
            .innerJoin('menuSet.user', 'user')
            .where('menuSet.id = :setId', { setId: dto.set_id })
            .andWhere('user.id = :userId', { userId: user.id })
            .getOne();

          if (!menuSet) {
            throw new NotFoundException('Menu set not found');
          }

          menuSet.name = setName;
          menuSet = await menuSetRepository.save(menuSet);
          await menuSetMenuRepository.delete({ menuSet: { id: menuSet.id } });
        } else {
          menuSet = menuSetRepository.create({
            name: setName,
            user,
          });
          menuSet = await menuSetRepository.save(menuSet);
        }

        const setMenus = dto.menu_ids.map((menuId, index) =>
          menuSetMenuRepository.create({
            menuSet,
            menu: { id: menuId } as MenuEntity,
            quantity: roundToOneDecimal(dto.menu_quantities[index]),
            menu_input_mode: dto.menu_input_modes[index],
            sort_order: index,
          }),
        );

        await menuSetMenuRepository.save(setMenus);

        return menuSet.id;
      },
    );

    return new MenuSetIdResponseDto(setId);
  }

  async getMenuSets(
    user: UserEntity,
    dto: MenuSetListRequestDto,
  ): Promise<MenuSetListResponseDto> {
    const limit = dto.limit;
    const query = this.menuSetRepository
      .createQueryBuilder('menuSet')
      .innerJoin('menuSet.user', 'user')
      .where('user.id = :userId', { userId: user.id })
      .orderBy('menuSet.id', 'DESC')
      .limit(limit + 1);

    if (dto.cursor) {
      query.andWhere('menuSet.id < :cursor', { cursor: dto.cursor });
    }

    const menuSets = await query.getMany();
    const hasNext = menuSets.length > limit;
    const pagedMenuSets = hasNext ? menuSets.slice(0, limit) : menuSets;
    const setIds = pagedMenuSets.map((menuSet) => menuSet.id);

    const setMenus =
      setIds.length > 0
        ? await this.menuSetMenuRepository.find({
            where: {
              menuSet: {
                id: In(setIds),
              },
            },
            relations: {
              menuSet: true,
              menu: true,
            },
            order: {
              sort_order: 'ASC',
              id: 'ASC',
            },
          })
        : [];

    const setMenusBySetId = new Map<number, MenuSetMenuEntity[]>();
    setMenus.forEach((setMenu) => {
      const setId = setMenu.menuSet.id;
      const groupedSetMenus = setMenusBySetId.get(setId) ?? [];
      groupedSetMenus.push(setMenu);
      setMenusBySetId.set(setId, groupedSetMenus);
    });

    const setList: MenuSetListItemResponseDto[] = pagedMenuSets.map(
      (menuSet) => {
        const groupedSetMenus = this.sortSetMenus(
          setMenusBySetId.get(menuSet.id) ?? [],
        );

        return {
          set_id: menuSet.id,
          set_name: menuSet.name,
          menu_names: groupedSetMenus.map((setMenu) =>
            stripPublicMenuSourcePrefix(setMenu.menu.name),
          ),
          menu_ids: groupedSetMenus.map((setMenu) => setMenu.menu.id),
          total_calories: this.calculateSetTotalCalories(groupedSetMenus),
        };
      },
    );

    const nextCursor =
      hasNext && pagedMenuSets.length > 0
        ? pagedMenuSets[pagedMenuSets.length - 1].id
        : null;

    return new MenuSetListResponseDto(setList, nextCursor);
  }

  async getMenuSetDetail(
    user: UserEntity,
    dto: MenuSetDetailRequestDto,
  ): Promise<MenuSetDetailResponseDto> {
    const menuSet = await this.menuSetRepository
      .createQueryBuilder('menuSet')
      .innerJoin('menuSet.user', 'user')
      .where('menuSet.id = :setId', { setId: dto.set_id })
      .andWhere('user.id = :userId', { userId: user.id })
      .getOne();

    if (!menuSet) {
      throw new NotFoundException('Menu set not found');
    }

    const setMenus = await this.menuSetMenuRepository.find({
      where: {
        menuSet: {
          id: menuSet.id,
        },
      },
      relations: {
        menu: true,
      },
      order: {
        sort_order: 'ASC',
        id: 'ASC',
      },
    });

    return new MenuSetDetailResponseDto(
      menuSet.id,
      menuSet.name,
      setMenus.map((setMenu) => new MenuSimpleResponseDto(setMenu.menu)),
      setMenus.map((setMenu) => setMenu.quantity),
      setMenus.map((setMenu) => setMenu.menu_input_mode),
    );
  }

  async deleteMenuSet(
    user: UserEntity,
    dto: DeleteMenuSetRequestDto,
  ): Promise<void> {
    const menuSet = await this.menuSetRepository
      .createQueryBuilder('menuSet')
      .innerJoin('menuSet.user', 'user')
      .where('menuSet.id = :setId', { setId: dto.set_id })
      .andWhere('user.id = :userId', { userId: user.id })
      .getOne();

    if (!menuSet) {
      throw new NotFoundException('Menu set not found');
    }

    await this.menuSetRepository.delete(menuSet.id);
  }

  private validateMenuSetMenuArrays(dto: UpsertMenuSetRequestDto): void {
    const menuCount = dto.menu_ids.length;

    if (
      dto.menu_quantities.length !== menuCount ||
      dto.menu_input_modes.length !== menuCount
    ) {
      throw new BadRequestException(
        'menu_ids, menu_quantities and menu_input_modes must have the same length',
      );
    }
  }

  async getWorkoutRecord(
    user: UserEntity,
    dto: GetWorkoutRecordRequestDto,
  ): Promise<WorkoutRecordResponseDto> {
    const records = await this.workoutRecordRepository.find({
      where: {
        user: { id: user.id },
        date: dto.date,
      },
      relations: {
        workout: true,
        setList: true,
      },
      order: {
        id: 'ASC',
      },
    });

    return new WorkoutRecordResponseDto(
      records.map((record) => this.toWorkoutRecordItemResponse(record)),
    );
  }

  async deleteWorkoutRecord(
    user: UserEntity,
    dto: DeleteWorkoutRecordRequestDto,
  ): Promise<void> {
    const query = this.workoutRecordRepository
      .createQueryBuilder('record')
      .innerJoin('record.user', 'user')
      .innerJoin('record.workout', 'workout')
      .where('user.id = :userId', { userId: user.id })
      .andWhere('record.date = :date', { date: dto.date });

    if (dto.workout_id !== null && dto.workout_id !== undefined) {
      query.andWhere('workout.id = :workoutId', {
        workoutId: dto.workout_id,
      });
    }

    const records = await query.getMany();

    if (records.length === 0) {
      throw new NotFoundException('Workout record not found');
    }

    await this.workoutRecordRepository.remove(records);
  }

  async searchWorkout(
    dto: SearchWorkoutRequestDto,
  ): Promise<WorkoutSearchResponseDto> {
    const limit = Math.min(Math.max(dto.limit, 1), 100);
    const input = dto.input.trim();
    const bodyParts = dto.body_parts?.trim();
    const equipments = dto.equipments?.trim();

    const query = this.workoutRepository
      .createQueryBuilder('workout')
      .where('1 = 1');

    if (input.length > 0) {
      query.andWhere('workout.name LIKE :input', { input: `%${input}%` });
    }

    if (bodyParts) {
      query.andWhere('workout.body_parts LIKE :bodyParts', {
        bodyParts: `%${bodyParts}%`,
      });
    }

    if (equipments) {
      query.andWhere('workout.equipments LIKE :equipments', {
        equipments: `%${equipments}%`,
      });
    }

    if (dto.cursor !== null && dto.cursor !== undefined) {
      query.andWhere('workout.id > :cursor', { cursor: dto.cursor });
    }

    const workouts = await query
      .orderBy('workout.id', 'ASC')
      .take(limit + 1)
      .getMany();

    const hasNext = workouts.length > limit;
    const page = hasNext ? workouts.slice(0, limit) : workouts;
    const nextCursor = hasNext ? page[page.length - 1].id : null;

    return new WorkoutSearchResponseDto(
      page.map((workout) => ({
        workout_id: workout.id,
        workout_name: workout.name,
        workout_image: workout.image ?? null,
        workout_type: workout.workout_type,
      })),
      nextCursor,
    );
  }

  async getWorkoutDetail(
    dto: WorkoutDetailRequestDto,
  ): Promise<WorkoutDetailResponseDto> {
    const workout = await this.workoutRepository.findOne({
      where: { id: dto.workout_id },
    });

    if (!workout) {
      throw new NotFoundException('Workout not found');
    }

    return {
      workout_id: workout.id,
      workout_name: workout.name,
      workout_gif: workout.gif ?? null,
      workout_type: workout.workout_type,
      equipments: workout.equipments ?? null,
      body_parts: this.toWorkoutBodyParts(workout.body_parts),
    };
  }

  async upsertWorkoutRecord(
    user: UserEntity,
    dto: UpsertWorkoutRecordRequestDto,
  ): Promise<WorkoutIdResponseDto> {
    const workout = await this.workoutRepository.findOne({
      where: { id: dto.workout_id },
    });

    if (!workout) {
      throw new NotFoundException('Workout not found');
    }

    if (workout.workout_type !== dto.workout_type) {
      throw new BadRequestException(
        'workout_type does not match selected workout',
      );
    }

    this.validateWorkoutRecordRequest(dto);

    const date = this.getTodayKstDateString();

    await this.workoutRecordRepository.manager.transaction(async (manager) => {
      const workoutRecordRepository =
        manager.getRepository(WorkoutRecordEntity);
      const workoutRecordSetRepository = manager.getRepository(
        WorkoutRecordSetEntity,
      );

      let record = await workoutRecordRepository
        .createQueryBuilder('record')
        .innerJoin('record.user', 'user')
        .innerJoin('record.workout', 'workout')
        .where('user.id = :userId', { userId: user.id })
        .andWhere('workout.id = :workoutId', { workoutId: workout.id })
        .andWhere('record.date = :date', { date })
        .getOne();

      if (!record) {
        record = workoutRecordRepository.create({
          user,
          workout,
          date,
        });
      }

      record.workout_duration = roundToOneDecimal(dto.workout_duration);
      record.burned_calories = roundToOneDecimal(dto.burned_calories);
      record.workout_type = dto.workout_type;
      record.intensity =
        dto.workout_type === 'cardio' ? (dto.intensity ?? null) : null;

      const savedRecord = await workoutRecordRepository.save(record);

      await workoutRecordSetRepository.delete({
        workoutRecord: { id: savedRecord.id },
      });

      if (dto.workout_type === 'weight') {
        const setRows = (dto.set_list ?? []).map((set) =>
          workoutRecordSetRepository.create({
            workoutRecord: savedRecord,
            set_order: set.set_order,
            weight: roundToOneDecimal(set.weight),
            reps: set.reps,
          }),
        );

        await workoutRecordSetRepository.save(setRows);
      }
    });

    return new WorkoutIdResponseDto(workout.id);
  }

  private validateWorkoutRecordRequest(
    dto: UpsertWorkoutRecordRequestDto,
  ): void {
    if (dto.workout_type === 'weight') {
      if (!dto.set_list || dto.set_list.length === 0) {
        throw new BadRequestException('set_list is required for weight workout');
      }

      return;
    }

    if (
      dto.intensity !== null &&
      dto.intensity !== undefined &&
      ![0, 1, 2].includes(dto.intensity)
    ) {
      throw new BadRequestException('intensity must be 0, 1, 2 or null');
    }
  }

  private toWorkoutRecordItemResponse(
    record: WorkoutRecordEntity,
  ): WorkoutRecordItemResponseDto {
    const workout = record.workout;
    const sortedSets = [...(record.setList ?? [])].sort(
      (a, b) => a.set_order - b.set_order || a.id - b.id,
    );

    return {
      workout_id: workout.id,
      workout_name: workout.name,
      workout_image: workout.image ?? null,
      workout_duration: roundToOneDecimal(record.workout_duration),
      burned_calories: roundToOneDecimal(record.burned_calories),
      workout_type: record.workout_type,
      intensity:
        record.workout_type === 'cardio'
          ? ((record.intensity ?? null) as 0 | 1 | 2 | null)
          : null,
      set_list:
        record.workout_type === 'weight'
          ? sortedSets.map<WorkoutRecordSetResponseDto>((set) => ({
              set_order: set.set_order,
              weight: roundToOneDecimal(set.weight),
              reps: set.reps,
            }))
          : null,
    };
  }

  private toWorkoutBodyParts(bodyParts: string[] | string | null): string[] {
    if (Array.isArray(bodyParts)) {
      return bodyParts.filter((bodyPart) => typeof bodyPart === 'string');
    }

    if (typeof bodyParts !== 'string' || bodyParts.trim().length === 0) {
      return [];
    }

    try {
      const parsed = JSON.parse(bodyParts);
      if (Array.isArray(parsed)) {
        return parsed.filter((bodyPart) => typeof bodyPart === 'string');
      }
    } catch {
      return bodyParts
        .split(',')
        .map((bodyPart) => bodyPart.trim())
        .filter((bodyPart) => bodyPart.length > 0);
    }

    return [];
  }

  private getTodayKstDateString(): string {
    return new Intl.DateTimeFormat('en-CA', {
      timeZone: 'Asia/Seoul',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).format(new Date());
  }

  // 오늘의 체중/걸음 수 반환
  async weightSteps(
    user: UserEntity,
    dateRequestDto: DateRequestDto,
  ): Promise<WeightStepsResponseDto> {
    const { date } = dateRequestDto;
    const startOfDay = new Date(date);
    const endOfDay = new Date(date);

    startOfDay.setHours(0, 0, 0, 0);
    endOfDay.setHours(23, 59, 59, 999);

    const weightSteps = await this.weightStepsRepository.findOne({
      where: {
        date: Between(startOfDay, endOfDay),
        user: { id: user.id },
      },
    });

    if (!weightSteps) {
      return new WeightStepsResponseDto(null, null);
    }

    return new WeightStepsResponseDto(weightSteps.weight, weightSteps.steps);
  }
}
