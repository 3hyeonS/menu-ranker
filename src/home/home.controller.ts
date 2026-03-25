import {
  Body,
  Controller,
  Post,
  UnauthorizedException,
  UseFilters,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { GetUser } from '../decorators/get-user-decorator';
import { JwtService } from '@nestjs/jwt';
import {
  ApiBearerAuth,
  ApiExtraModels,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { ResponseTransformInterceptor } from '../interceptors/response-transform-interceptor';
import { ResponseMsg } from '../decorators/response-message-decorator';
import { ResponseDto } from '../response-dto';
import { GenericApiResponse } from '../decorators/generic-api-response-decorator';
import { NullApiResponse } from '../decorators/null-api-response-decorator';
import { ErrorApiResponse } from '../decorators/error-api-response-decorator';
import { SearchResponseDto } from './dto/response-dto/search-response-dto';
import { UserEntity } from '../auth/entity/user/user.entity';
import { SearchRequestDto } from './dto/request-dto/search-request-dto';
import { HomeService } from './home.service';
import { MenuResponseDto } from './dto/response-dto/menu-response-dto';
import { MenuIdRequestDto } from './dto/request-dto/menu-id-request-dto';
import { MenuSimpleResponseDto } from './dto/response-dto/menu-simple-response-dto';
import { SearchInBrandRequestDto } from './dto/request-dto/search-in brand-request-dto';
import { RegisterMealRequestDto } from './dto/request-dto/register-meal-request-dto';
import { DeleteMealRequestDto } from './dto/request-dto/delete-meal-request-dto';
import { DateRequestDto } from './dto/request-dto/date-request-dto';
import { MealRecordResponseDto } from './dto/response-dto/meal-record-response-dto';
import { RegisterMenuRequestDto } from './dto/request-dto/register-menu-request-dto';
import { SearchBrandResponseDto } from './dto/response-dto/search-brand-response-dto';
import { ModifyMenuRequestDto } from './dto/request-dto/modify-menu-request-dto';

@ApiTags('홈 탭')
@UseInterceptors(ResponseTransformInterceptor)
@ApiExtraModels(ResponseDto)
@Controller('/home')
export class HomeController {
  constructor(
    private menuService: HomeService,
    private readonly jwtService: JwtService, // JwtService 주입
  ) {}

  // 메뉴 검색
  @ApiBearerAuth('accessToken')
  @ApiOperation({
    summary: '메뉴 검색',
  })
  @GenericApiResponse({
    status: 201,
    description: '메뉴 검색 성공',
    message: 'Menu searched successfully',
    model: SearchResponseDto,
  })
  @ErrorApiResponse({
    status: 400,
    description: 'Bad Request  \nbody 입력값의 필드 조건 및 JSON 형식 오류',
    message: 'input must be a string',
    error: 'BadRequestException',
  })
  @ErrorApiResponse({
    status: 401,
    description: '유효하지 않거나 기간이 만료된 accessToken',
    message: 'Invalid or expired accessToken',
    error: 'UnauthorizedException',
  })
  @ErrorApiResponse({
    status: 401,
    description: '유효하지 않거나 기간이 만료된 refreshToken',
    message: 'Invalid or expired refreshToken',
    error: 'UnauthorizedException',
  })
  @ResponseMsg('Menu searched successfully')
  @UseGuards(AuthGuard())
  @Post('/search')
  async signout(
    @GetUser() user: UserEntity,
    @Body() searchRequestDto: SearchRequestDto,
  ): Promise<SearchResponseDto> {
    return await this.menuService.search(searchRequestDto.input, user);
  }

  // 메뉴 검색
  @ApiBearerAuth('accessToken')
  @ApiOperation({
    summary: '메뉴 검색',
  })
  @GenericApiResponse({
    status: 201,
    description: '메뉴 검색 성공',
    message: 'Menu searched successfully',
    model: SearchResponseDto,
  })
  @ErrorApiResponse({
    status: 400,
    description: 'Bad Request  \nbody 입력값의 필드 조건 및 JSON 형식 오류',
    message: 'input must be a string',
    error: 'BadRequestException',
  })
  @ErrorApiResponse({
    status: 401,
    description: '유효하지 않거나 기간이 만료된 accessToken',
    message: 'Invalid or expired accessToken',
    error: 'UnauthorizedException',
  })
  @ErrorApiResponse({
    status: 401,
    description: '유효하지 않거나 기간이 만료된 refreshToken',
    message: 'Invalid or expired refreshToken',
    error: 'UnauthorizedException',
  })
  @ResponseMsg('Menu searched successfully')
  @UseGuards(AuthGuard())
  @Post('/search')
  async search(
    @GetUser() user: UserEntity,
    @Body() searchRequestDto: SearchRequestDto,
  ): Promise<SearchResponseDto> {
    return await this.menuService.search(searchRequestDto.input, user);
  }

  // 브랜드 검색
  @ApiBearerAuth('accessToken')
  @ApiOperation({
    summary: '브랜드 검색',
  })
  @GenericApiResponse({
    status: 201,
    description: '브랜드 검색 성공',
    message: 'Brand searched successfully',
    model: SearchBrandResponseDto,
  })
  @ErrorApiResponse({
    status: 400,
    description: 'Bad Request  \nbody 입력값의 필드 조건 및 JSON 형식 오류',
    message: 'input must be a string',
    error: 'BadRequestException',
  })
  @ErrorApiResponse({
    status: 401,
    description: '유효하지 않거나 기간이 만료된 accessToken',
    message: 'Invalid or expired accessToken',
    error: 'UnauthorizedException',
  })
  @ResponseMsg('Brand searched successfully')
  @UseGuards(AuthGuard())
  @Post('/searchBrand')
  async searchBrand(
    @Body() searchRequestDto: SearchRequestDto,
  ): Promise<SearchBrandResponseDto> {
    return await this.menuService.searchBrand(searchRequestDto.input);
  }

  // 메뉴 영양성분 상세 조회
  @ApiBearerAuth('accessToken')
  @ApiOperation({
    summary: '메뉴 영양성분 상세 조회',
  })
  @GenericApiResponse({
    status: 201,
    description: '메뉴 영양성분 상세 조회 성공',
    message: 'Menu detail returned successfully',
    model: MenuResponseDto,
  })
  @ErrorApiResponse({
    status: 400,
    description: 'Bad Request  \nbody 입력값의 필드 조건 및 JSON 형식 오류',
    message: 'id must be a number',
    error: 'BadRequestException',
  })
  @ResponseMsg('Menu detail returned successfully')
  @Post('/menuDetail')
  async menuDetail(
    @Body() menuIdRequestDto: MenuIdRequestDto,
  ): Promise<MenuResponseDto> {
    return await this.menuService.menuDetail(menuIdRequestDto.id);
  }

  // 브랜드 내 메뉴 검색
  @ApiBearerAuth('accessToken')
  @ApiOperation({
    summary: '브랜드 내 메뉴 검색',
    description: 'input값 없이 호출 시 해당 브랜드 전체 메뉴 반환',
  })
  @GenericApiResponse({
    status: 201,
    description: '브랜드 내 메뉴 검색 성공',
    message: 'Menus in the brand searched successfully',
    model: MenuSimpleResponseDto,
    isArray: true,
  })
  @ErrorApiResponse({
    status: 400,
    description: 'Bad Request  \nbody 입력값의 필드 조건 및 JSON 형식 오류',
    message: 'input must be a string',
    error: 'BadRequestException',
  })
  @ErrorApiResponse({
    status: 401,
    description: '유효하지 않거나 기간이 만료된 accessToken',
    message: 'Invalid or expired accessToken',
    error: 'UnauthorizedException',
  })
  @ErrorApiResponse({
    status: 401,
    description: '유효하지 않거나 기간이 만료된 refreshToken',
    message: 'Invalid or expired refreshToken',
    error: 'UnauthorizedException',
  })
  @ResponseMsg('Menus in the brand searched successfully')
  @UseGuards(AuthGuard())
  @Post('/searchInBrand')
  async searchInBrand(
    @GetUser() user: UserEntity,
    @Body() searchInBrandRequestDto: SearchInBrandRequestDto,
  ): Promise<MenuSimpleResponseDto[]> {
    return await this.menuService.searchInBrand(
      searchInBrandRequestDto.brand,
      searchInBrandRequestDto.input,
      user,
    );
  }

  // 오늘의 식사 등록
  @ApiBearerAuth('accessToken')
  @ApiOperation({
    summary: '오늘의 식사 등록',
  })
  @NullApiResponse({
    status: 201,
    description: '오늘의 식사 등록 성공',
    message: 'Meal registered successfully',
  })
  @ErrorApiResponse({
    status: 400,
    description: 'Bad Request  \nbody 입력값의 필드 조건 및 JSON 형식 오류',
    message: 'Invalid request body',
    error: 'BadRequestException',
  })
  @ErrorApiResponse({
    status: 401,
    description: '유효하지 않거나 기간이 만료된 accessToken',
    message: 'Invalid or expired accessToken',
    error: 'UnauthorizedException',
  })
  @ResponseMsg('Meal registered successfully')
  @UseGuards(AuthGuard())
  @Post('/meal/register')
  async registerMeal(
    @GetUser() user: UserEntity,
    @Body() registerMealRequestDto: RegisterMealRequestDto,
  ): Promise<void> {
    await this.menuService.registerMeal(user, registerMealRequestDto);
  }

  // 오늘의 식사 삭제
  @ApiBearerAuth('accessToken')
  @ApiOperation({
    summary: '오늘의 식사 삭제',
  })
  @NullApiResponse({
    status: 201,
    description: '오늘의 식사 삭제 성공',
    message: 'Meal deleted successfully',
  })
  @ErrorApiResponse({
    status: 400,
    description: 'Bad Request  \nbody 입력값의 필드 조건 및 JSON 형식 오류',
    message: 'Invalid request body',
    error: 'BadRequestException',
  })
  @ErrorApiResponse({
    status: 401,
    description: '유효하지 않거나 기간이 만료된 accessToken',
    message: 'Invalid or expired accessToken',
    error: 'UnauthorizedException',
  })
  @ErrorApiResponse({
    status: 404,
    description: '삭제할 식사를 찾을 수 없음',
    message: 'Meal not found',
    error: 'NotFoundException',
  })
  @ResponseMsg('Meal deleted successfully')
  @UseGuards(AuthGuard())
  @Post('/meal/delete')
  async deleteMeal(
    @GetUser() user: UserEntity,
    @Body() deleteMealRequestDto: DeleteMealRequestDto,
  ): Promise<void> {
    await this.menuService.deleteMeal(user, deleteMealRequestDto);
  }

  // 오늘의 식사 조회
  @ApiBearerAuth('accessToken')
  @ApiOperation({
    summary: '오늘의 식사 조회',
  })
  @GenericApiResponse({
    status: 201,
    description: '오늘의 식사 조회 성공',
    message: 'Meal record returned successfully',
    model: MealRecordResponseDto,
  })
  @ErrorApiResponse({
    status: 400,
    description: 'Bad Request  \nbody 입력값의 필드 조건 및 JSON 형식 오류',
    message: 'Invalid request body',
    error: 'BadRequestException',
  })
  @ErrorApiResponse({
    status: 401,
    description: '유효하지 않거나 기간이 만료된 accessToken',
    message: 'Invalid or expired accessToken',
    error: 'UnauthorizedException',
  })
  @ResponseMsg('Meal record returned successfully')
  @UseGuards(AuthGuard())
  @Post('/meal/record')
  async getMealRecord(
    @GetUser() user: UserEntity,
    @Body() dateRequestDto: DateRequestDto,
  ): Promise<MealRecordResponseDto> {
    return await this.menuService.getMealRecord(user, dateRequestDto);
  }

  // 영양성분 등록
  @ApiBearerAuth('accessToken')
  @ApiOperation({
    summary: '영양성분 등록',
  })
  @NullApiResponse({
    status: 201,
    description: '영양성분 등록 성공',
    message: 'Menu registered successfully',
  })
  @ErrorApiResponse({
    status: 400,
    description: 'Bad Request  \nbody 입력값의 필드 조건 및 JSON 형식 오류',
    message: 'Invalid request body',
    error: 'BadRequestException',
  })
  @ErrorApiResponse({
    status: 401,
    description: '유효하지 않거나 기간이 만료된 accessToken',
    message: 'Invalid or expired accessToken',
    error: 'UnauthorizedException',
  })
  @ErrorApiResponse({
    status: 409,
    description: '이미 등록된 메뉴',
    message: 'Your menu already exists',
    error: 'ConflictException',
  })
  @ResponseMsg('Menu registered successfully')
  @UseGuards(AuthGuard())
  @Post('/menu/register')
  async registerMenu(
    @GetUser() user: UserEntity,
    @Body() registerMenuRequestDto: RegisterMenuRequestDto,
  ): Promise<void> {
    await this.menuService.registerMenu(user, registerMenuRequestDto);
  }

  // 영양성분 수정
  @ApiBearerAuth('accessToken')
  @ApiOperation({
    summary: '영양성분 수정',
  })
  @NullApiResponse({
    status: 201,
    description: '영양성분 수정 성공',
    message: 'Menu modified successfully',
  })
  @ErrorApiResponse({
    status: 400,
    description: 'Bad Request  \nbody 입력값의 필드 조건 및 JSON 형식 오류',
    message: 'Invalid request body',
    error: 'BadRequestException',
  })
  @ErrorApiResponse({
    status: 401,
    description: '유효하지 않거나 기간이 만료된 accessToken',
    message: 'Invalid or expired accessToken',
    error: 'UnauthorizedException',
  })
  @ErrorApiResponse({
    status: 404,
    description: '수정할 메뉴를 찾을 수 없음',
    message: 'Menu not found',
    error: 'NotFoundException',
  })
  @ErrorApiResponse({
    status: 409,
    description: '이미 등록된 메뉴',
    message: 'Your menu already exists',
    error: 'ConflictException',
  })
  @ResponseMsg('Menu modified successfully')
  @UseGuards(AuthGuard())
  @Post('/menu/modify')
  async modifyMenu(
    @GetUser() user: UserEntity,
    @Body() modifyMenuRequestDto: ModifyMenuRequestDto,
  ): Promise<void> {
    await this.menuService.modifyMenu(user, modifyMenuRequestDto);
  }

  // 영양성분 삭제
  @ApiBearerAuth('accessToken')
  @ApiOperation({
    summary: '영양성분 삭제',
  })
  @NullApiResponse({
    status: 201,
    description: '영양성분 삭제 성공',
    message: 'Menu deleted successfully',
  })
  @ErrorApiResponse({
    status: 400,
    description: 'Bad Request  \nbody 입력값의 필드 조건 및 JSON 형식 오류',
    message: 'id must be a number',
    error: 'BadRequestException',
  })
  @ErrorApiResponse({
    status: 401,
    description: '유효하지 않거나 기간이 만료된 accessToken',
    message: 'Invalid or expired accessToken',
    error: 'UnauthorizedException',
  })
  @ErrorApiResponse({
    status: 404,
    description: '삭제할 메뉴를 찾을 수 없음',
    message: 'Menu not found',
    error: 'NotFoundException',
  })
  @ResponseMsg('Menu deleted successfully')
  @UseGuards(AuthGuard())
  @Post('/menu/delete')
  async deleteMenu(
    @GetUser() user: UserEntity,
    @Body() menuIdRequestDto: MenuIdRequestDto,
  ): Promise<void> {
    await this.menuService.deleteMenu(user, menuIdRequestDto.id);
  }
}
