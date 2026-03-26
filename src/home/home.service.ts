import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
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

@Injectable()
export class HomeService {
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
    private jwtService: JwtService,
    private httpService: HttpService,
  ) {}

  // 문자 출력
  getHello(): string {
    return 'Welcome menu';
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

  // 오늘의 식사 등록
  async registerMeal(
    user: UserEntity,
    registerMealRequestDto: RegisterMealRequestDto,
  ): Promise<void> {
    const { date, time, image, menu_ids, menu_quantities } =
      registerMealRequestDto;

    const menus = await this.menuRepository.find({
      where: { id: In(menu_ids) },
    });

    const menuMap = new Map(menus.map((menu) => [menu.id, menu]));

    const mealMenus = menu_ids.map((menuId, index) =>
      this.mealMenuRepository.create({
        menu: menuMap.get(menuId)!,
        quantity: menu_quantities[index],
      }),
    );

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

  // 영양성분 등록
  async registerMenu(
    user: UserEntity,
    registerMenuRequestDto: RegisterMenuRequestDto,
  ): Promise<void> {
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
      ...registerMenuRequestDto,
      data_source: 1,
      category: null,
      unit_quantity: '1인분',
      user,
    });

    await this.menuRepository.save(menu);
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
      ...modifyMenuRequestDto,
      data_source: 1,
      category: null,
      unit_quantity: '1인분',
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
      weightSteps.weight = weight;
      await this.weightStepsRepository.save(weightSteps);
      return;
    }

    await this.weightStepsRepository.save(
      this.weightStepsRepository.create({
        date,
        weight,
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
      weightSteps.steps = steps;
      await this.weightStepsRepository.save(weightSteps);
      return;
    }

    await this.weightStepsRepository.save(
      this.weightStepsRepository.create({
        date,
        weight: null,
        steps,
        user,
      }),
    );
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
