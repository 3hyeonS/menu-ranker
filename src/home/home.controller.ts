import {
  Body,
  Controller,
  Post,
  UnauthorizedException,
  UploadedFile,
  UseFilters,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { GetUser } from '../decorators/get-user-decorator';
import { JwtService } from '@nestjs/jwt';
import {
  ApiBearerAuth,
  ApiBody,
  ApiConsumes,
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
import { SearchMenuRequestDto } from './dto/request-dto/search-menu-request-dto';
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
import { RegisterWeightRequestDto } from './dto/request-dto/register-weight-request-dto';
import { RegisterStepsRequestDto } from './dto/request-dto/register-step-request-dto';
import { WeightStepsResponseDto } from './dto/response-dto/weight-steps-response-dto';
import { MenuIdResponseDto } from './dto/response-dto/menu-id-response-dto';
import { PrimitiveApiResponse } from 'src/decorators/primitive-api-response-decorator';
import { SearchBrandRequestDto } from './dto/request-dto/search-brand-request-dto';
import { FileInterceptor } from '@nestjs/platform-express';
import { MealImageUploadRequestDto } from './dto/request-dto/meal-image-upload-request-dto';

@ApiTags('홈 탭')
@UseInterceptors(ResponseTransformInterceptor)
@ApiExtraModels(ResponseDto)
@Controller('/home')
export class HomeController {
  constructor(
    private homeService: HomeService,
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
    @Body() searchMenuRequestDto: SearchMenuRequestDto,
  ): Promise<SearchResponseDto> {
    return await this.homeService.search(searchMenuRequestDto.input, user);
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
    @Body() searchBrandRequestDto: SearchBrandRequestDto,
  ): Promise<SearchBrandResponseDto> {
    return await this.homeService.searchBrand(searchBrandRequestDto.input);
  }

  // 브랜드 추가 요청
  @ApiBearerAuth('accessToken')
  @ApiOperation({
    summary: '브랜드 추가 요청',
  })
  @NullApiResponse({
    status: 201,
    description: '브랜드 추가 요청 성공',
    message: 'Brand request registered successfully',
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
    status: 409,
    description: '이미 존재하는 브랜드 또는 이미 요청한 브랜드',
    message: 'Your brand already exists',
    error: 'ConflictException',
  })
  @ResponseMsg('Brand request registered successfully')
  @UseGuards(AuthGuard())
  @Post('/brandAddRequest')
  async brandAddRequest(
    @GetUser() user: UserEntity,
    @Body() searchBrandRequestDto: SearchBrandRequestDto,
  ): Promise<void> {
    await this.homeService.brandAddRequet(user, searchBrandRequestDto.input);
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
    return await this.homeService.menuDetail(menuIdRequestDto.id);
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
    return await this.homeService.searchInBrand(
      searchInBrandRequestDto.brand,
      searchInBrandRequestDto.input,
      user,
    );
  }

  @ApiBearerAuth('accessToken')
  @ApiOperation({
    summary: '식사 사진 업로드',
  })
  @PrimitiveApiResponse({
    status: 201,
    description: '식사 사진 업로드 성공',
    message: 'Meal image uploaded successfully',
    type: 'string',
    isArray: true,
    example: 'urlexample',
  })
  @ErrorApiResponse({
    status: 400,
    description: 'Bad Request  \nbody 입력값의 필드 조건 및 JSON 형식 오류',
    message: 'Invalid request body',
    error: 'BadRequestException',
  })
  @ErrorApiResponse({
    status: 401,
    description: '유효하지 않거나 기간이 만료된 acccessToken',
    message: 'Invalid or expired accessToken',
    error: 'UnauthorizedException',
  })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    description: '이미지 업로드',
    schema: {
      type: 'object',
      properties: {
        image: {
          type: 'string',
          format: 'binary',
          description: '이미지 파일',
        },
      },
    },
  })
  @UseGuards(AuthGuard())
  @UseInterceptors(FileInterceptor('image'))
  @ResponseMsg('Meal image uploaded successfully')
  @Post('uploadMealImage')
  async uploadMealImage(
    @GetUser() user: UserEntity,
    @UploadedFile() file: Express.Multer.File,
    @Body() mealImageUploadRequestDto: MealImageUploadRequestDto,
  ): Promise<string> {
    return await this.homeService.uploadMealImage(
      user,
      file,
      mealImageUploadRequestDto,
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
  @Post('/registerMeal')
  async registerMeal(
    @GetUser() user: UserEntity,
    @Body() registerMealRequestDto: RegisterMealRequestDto,
  ): Promise<void> {
    await this.homeService.registerMeal(user, registerMealRequestDto);
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
  @Post('/deleteMeal')
  async deleteMeal(
    @GetUser() user: UserEntity,
    @Body() deleteMealRequestDto: DeleteMealRequestDto,
  ): Promise<void> {
    await this.homeService.deleteMeal(user, deleteMealRequestDto);
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
  @Post('/getMealRecord')
  async getMealRecord(
    @GetUser() user: UserEntity,
    @Body() dateRequestDto: DateRequestDto,
  ): Promise<MealRecordResponseDto> {
    return await this.homeService.getMealRecord(user, dateRequestDto);
  }

  // 영양성분 등록
  @ApiBearerAuth('accessToken')
  @ApiOperation({
    summary: '영양성분 등록',
  })
  @GenericApiResponse({
    status: 201,
    description: '영양성분 등록 성공',
    message: 'Menu registered successfully',
    model: MenuIdResponseDto,
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
  @Post('/registerMenu')
  async registerMenu(
    @GetUser() user: UserEntity,
    @Body() registerMenuRequestDto: RegisterMenuRequestDto,
  ): Promise<MenuIdResponseDto> {
    return await this.homeService.registerMenu(user, registerMenuRequestDto);
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
  @Post('/modifyMenu')
  async modifyMenu(
    @GetUser() user: UserEntity,
    @Body() modifyMenuRequestDto: ModifyMenuRequestDto,
  ): Promise<void> {
    await this.homeService.modifyMenu(user, modifyMenuRequestDto);
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
  @Post('/deleteMenu')
  async deleteMenu(
    @GetUser() user: UserEntity,
    @Body() menuIdRequestDto: MenuIdRequestDto,
  ): Promise<void> {
    await this.homeService.deleteMenu(user, menuIdRequestDto.id);
  }

  // 오늘의 체중 등록
  @ApiBearerAuth('accessToken')
  @ApiOperation({
    summary: '오늘의 체중 등록',
  })
  @NullApiResponse({
    status: 201,
    description: '오늘의 체중 등록 성공',
    message: 'Weight registered successfully',
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
  @ResponseMsg('Weight registered successfully')
  @UseGuards(AuthGuard())
  @Post('/registerWeight')
  async registerWeight(
    @GetUser() user: UserEntity,
    @Body() registerWeightRequestDto: RegisterWeightRequestDto,
  ): Promise<void> {
    await this.homeService.registerWeight(user, registerWeightRequestDto);
  }

  // 오늘의 걸음 수 등록
  @ApiBearerAuth('accessToken')
  @ApiOperation({
    summary: '오늘의 걸음 수 등록',
  })
  @NullApiResponse({
    status: 201,
    description: '오늘의 걸음 수 등록 성공',
    message: 'Steps registered successfully',
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
  @ResponseMsg('Steps registered successfully')
  @UseGuards(AuthGuard())
  @Post('/registerSteps')
  async registerSteps(
    @GetUser() user: UserEntity,
    @Body() registerStepsRequestDto: RegisterStepsRequestDto,
  ): Promise<void> {
    await this.homeService.registerSteps(user, registerStepsRequestDto);
  }

  // 오늘의 체중/걸음 수 반환
  @ApiBearerAuth('accessToken')
  @ApiOperation({
    summary: '오늘의 체중/걸음 수 조회',
  })
  @GenericApiResponse({
    status: 201,
    description: '오늘의 체중/걸음 수 조회 성공',
    message: 'Weight and steps returned successfully',
    model: WeightStepsResponseDto,
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
  @ResponseMsg('Weight and steps returned successfully')
  @UseGuards(AuthGuard())
  @Post('/weightSteps')
  async weightSteps(
    @GetUser() user: UserEntity,
    @Body() dateRequestDto: DateRequestDto,
  ): Promise<WeightStepsResponseDto> {
    return await this.homeService.weightSteps(user, dateRequestDto);
  }
}
