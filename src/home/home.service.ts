import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
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
import { SearchResponseDto } from './dto/response-dto/search-response-dto';
import { MenuSimpleResponseDto } from './dto/response-dto/menu-simple-response-dto';
import { MenuResponseDto } from './dto/response-dto/menu-response-dto';
import { RegisterMealRequestDto } from './dto/request-dto/register-meal-request-dto';
import { MealEntity } from './entity/meal.entity';
import { MealMenuEntity } from './entity/meal-menu.entity';
import { DeleteMealRequestDto } from './dto/request-dto/delete-meal-request-dto';
import { DateRequestDto } from './dto/request-dto/date-request-dto';
import { MealRecordResponseDto } from './dto/response-dto/meal-record-response-dto';
import { MealResponseDto } from './dto/response-dto/meal-response-dto';
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
    @InjectRepository(WeightStepsEntity)
    private weightStepsRepository: Repository<WeightStepsEntity>,
    @InjectRepository(BrandAddEntity)
    private brandAddRepository: Repository<BrandAddEntity>,
    private httpService: HttpService,
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

  // menu controller
  // 메뉴 검색
  async search(input: string, user: UserEntity): Promise<SearchResponseDto> {
    const keyword = input?.trim();

    if (!keyword) {
      return new SearchResponseDto(false, [], []);
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
      .andWhere('menu.name LIKE :keyword', {
        keyword: keywordPattern,
      })
      .getMany();

    const menu_list: MenuSimpleResponseDto[] = menuList.map(
      (menu) => new MenuSimpleResponseDto(menu),
    );

    const searchedBrandRows = await this.menuRepository
      .createQueryBuilder('menu')
      .select('menu.brand', 'brand')
      .where('menu.brand LIKE :keyword', { keyword: keywordPattern })
      .groupBy('menu.brand')
      .orderBy('menu.brand', 'ASC')
      .getRawMany<{ brand: string }>();

    const brand_list: string[] = searchedBrandRows.map((row) => row.brand);

    // 유사 메뉴, 브랜드 검색 알고리즘 필요

    return new SearchResponseDto(
      menu_list.length > 0 || brand_list.length > 0,
      menu_list,
      brand_list,
    );
  }

  // 메뉴 영양성분 상세 조회
  async menuDetail(menuId: number): Promise<MenuResponseDto> {
    return new MenuResponseDto(
      await this.menuRepository.findOneBy({ id: menuId }),
    );
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
      .andWhere('menu.brand = :brand', { brand })
      .andWhere('menu.name LIKE :keyword', {
        keyword: keywordPattern,
      })
      .getMany();

    return menuList.map((menu) => new MenuSimpleResponseDto(menu));
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

    const menus = await this.menuRepository
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
          qb.where('user.id IS NULL').orWhere('user.id = :userId', {
            userId: user.id,
          });
        }),
      )
      .orderBy('menu.id', 'ASC')
      .getRawMany<{
        id: number;
        name: string;
        brand: string | null;
        category: string | null;
      }>();

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
- 음식이 없거나 후보와 일치하는 항목이 없으면 빈 배열 반환

후보 메뉴:
${JSON.stringify(menus)}

반환 shape:
{
  "menu_ids": [1, 2],
  "menu_quantities": [1, 2]
}
`.trim();

    const data = await this.callGeminiJsonWithImage(prompt, file);
    const recognized = this.normalizeFoodImageRecognition(data, menus);
    const imageUrl = await this.uploadRecognizedFoodImage(user, file);

    return new FoodImageRecognitionResponseDto({
      ...recognized,
      image_url: imageUrl,
    });
  }

  // 영양성분표 사진 인식
  async recognizeNutritionLabel(
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

    return new NutritionLabelRecognitionResponseDto(
      this.normalizeNutritionLabelRecognition(data),
    );
  }

  // 오늘의 식사 등록
  async registerMeal(
    user: UserEntity,
    registerMealRequestDto: RegisterMealRequestDto,
  ): Promise<void> {
    const { date, time, image, menu_ids, menu_quantities } =
      registerMealRequestDto;

    if (menu_ids.length !== menu_quantities.length) {
      throw new BadRequestException(
        'menu_ids and menu_quantities must have the same length',
      );
    }

    const menus = await this.menuRepository.find({
      where: { id: In(menu_ids) },
    });

    if (menus.length !== menu_ids.length) {
      throw new BadRequestException('Some menu_ids do not exist');
    }

    const menuMap = new Map(menus.map((menu) => [menu.id, menu]));

    const mealMenus = menu_ids.map((menuId, index) =>
      this.mealMenuRepository.create({
        menu: menuMap.get(menuId),
        quantity: roundToOneDecimal(menu_quantities[index]),
      }),
    );

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

    if (existingMeal) {
      await this.mealMenuRepository.remove(existingMeal.mealMenus);

      existingMeal.image = image ?? null;
      existingMeal.mealMenus = mealMenus;

      await this.mealRepository.save(existingMeal);
      return;
    }

    const meal = this.mealRepository.create({
      date,
      time,
      image,
      mealMenus,
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
      },
      order: {
        time: 'ASC',
        mealMenus: {
          id: 'ASC',
        },
      },
    });

    return new MealRecordResponseDto(
      mealList.map(
        (meal) =>
          new MealResponseDto(
            meal.time,
            meal.image,
            meal.mealMenus.map(
              (mealMenu) => new MenuSimpleResponseDto(mealMenu.menu),
            ),
            meal.mealMenus.map((mealMenu) => mealMenu.quantity),
          ),
      ),
    );
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
    const duplicatedMenu = await this.menuRepository.findOne({
      where: {
        name: registerMenuRequestDto.name,
        brand: registerMenuRequestDto.brand,
        user: { id: user.id },
      },
    });

    if (duplicatedMenu) {
      throw new ConflictException('Your menu already exists');
    }

    const menu = this.menuRepository.create({
      ...this.normalizeMenuFloatValues(registerMenuRequestDto),
      data_source: 1,
      category: null,
      unit_quantity: '인분',
      user,
    });

    await this.menuRepository.save(menu);

    return new MenuIdResponseDto(menu);
  }

  // 영양성분 수정
  async modifyMenu(
    user: UserEntity,
    modifyMenuRequestDto: ModifyMenuRequestDto,
  ): Promise<void> {
    const menu = await this.menuRepository.findOne({
      where: {
        id: modifyMenuRequestDto.id,
        user: { id: user.id },
      },
    });

    if (!menu) {
      throw new NotFoundException('Menu not found');
    }

    const duplicatedMenu = await this.menuRepository.findOne({
      where: {
        name: modifyMenuRequestDto.name,
        brand: modifyMenuRequestDto.brand,
        user: { id: user.id },
      },
    });

    if (duplicatedMenu && duplicatedMenu.id !== menu.id) {
      throw new ConflictException('Your menu already exists');
    }

    Object.assign(menu, {
      ...this.normalizeMenuFloatValues(modifyMenuRequestDto),
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
        user: { id: user.id },
      },
    });

    if (!menu) {
      throw new NotFoundException('Menu not found');
    }

    await this.menuRepository.remove(menu);
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
    menus: Array<{ id: number }>,
  ): {
    menu_ids: number[];
    menu_quantities: number[];
  } {
    const menuIdSet = new Set(menus.map((menu) => Number(menu.id)));
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
        !menuIdSet.has(menuId)
      ) {
        continue;
      }

      const previousQuantity = merged.get(menuId) ?? 0;
      merged.set(menuId, roundToOneDecimal(previousQuantity + quantity));
    }

    return {
      menu_ids: Array.from(merged.keys()),
      menu_quantities: Array.from(merged.values()),
    };
  }

  // Gemini 이미지 JSON 응답 호출
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
        'Nutrition label recognition is unavailable',
      );
    }
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
