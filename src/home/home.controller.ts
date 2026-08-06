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
import { MenuListResponseDto } from './dto/response-dto/menu-list-response-dto';
import { SearchInBrandRequestDto } from './dto/request-dto/search-in brand-request-dto';
import { RegisterMealRequestDto } from './dto/request-dto/register-meal-request-dto';
import { DeleteMealRequestDto } from './dto/request-dto/delete-meal-request-dto';
import { DateRequestDto } from './dto/request-dto/date-request-dto';
import { MealRecordResponseDto } from './dto/response-dto/meal-record-response-dto';
import { MealRecordedDatesRequestDto } from './dto/request-dto/meal-recorded-dates-request-dto';
import { MealRecordedDatesResponseDto } from './dto/response-dto/meal-recorded-dates-response-dto';
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
import { NutritionLabelRecognitionResponseDto } from './dto/response-dto/nutrition-label-recognition-response-dto';
import { FoodImageRecognitionResponseDto } from './dto/response-dto/food-image-recognition-response-dto';
import { MenuCsvImportResponseDto } from './dto/response-dto/menu-csv-import-response-dto';
import { WorkoutCsvImportResponseDto } from './dto/response-dto/workout-csv-import-response-dto';
import { UpsertFolderRequestDto } from './dto/request-dto/upsert-folder-request-dto';
import { FolderIdResponseDto } from './dto/response-dto/folder-id-response-dto';
import { FolderListRequestDto } from './dto/request-dto/folder-list-request-dto';
import { FolderListResponseDto } from './dto/response-dto/folder-list-response-dto';
import { FolderDetailRequestDto } from './dto/request-dto/folder-detail-request-dto';
import { FolderDetailResponseDto } from './dto/response-dto/folder-detail-response-dto';
import { DeleteFolderRequestDto } from './dto/request-dto/delete-folder-request-dto';
import { UpsertMenuSetRequestDto } from './dto/request-dto/upsert-menu-set-request-dto';
import { MenuSetIdResponseDto } from './dto/response-dto/menu-set-id-response-dto';
import { MenuSetListRequestDto } from './dto/request-dto/menu-set-list-request-dto';
import { MenuSetListResponseDto } from './dto/response-dto/menu-set-list-response-dto';
import { MenuSetDetailRequestDto } from './dto/request-dto/menu-set-detail-request-dto';
import { MenuSetDetailResponseDto } from './dto/response-dto/menu-set-detail-response-dto';
import { DeleteMenuSetRequestDto } from './dto/request-dto/delete-menu-set-request-dto';
import { GetWorkoutRecordRequestDto } from './dto/request-dto/get-workout-record-request-dto';
import { DeleteWorkoutRecordRequestDto } from './dto/request-dto/delete-workout-record-request-dto';
import { SearchWorkoutRequestDto } from './dto/request-dto/search-workout-request-dto';
import { WorkoutDetailRequestDto } from './dto/request-dto/workout-detail-request-dto';
import { UpsertWorkoutRecordRequestDto } from './dto/request-dto/upsert-workout-record-request-dto';
import { WorkoutRecordResponseDto } from './dto/response-dto/workout-record-response-dto';
import { WorkoutSearchResponseDto } from './dto/response-dto/workout-search-response-dto';
import { WorkoutDetailResponseDto } from './dto/response-dto/workout-detail-response-dto';
import { WorkoutIdResponseDto } from './dto/response-dto/workout-id-response-dto';

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
    return await this.homeService.search(searchMenuRequestDto, user);
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

  // 자주 먹은 메뉴 조회
  @ApiBearerAuth('accessToken')
  @ApiOperation({
    summary: '자주 먹은 메뉴 조회',
    description: '사용자가 자주 기록한 메뉴를 최대 20개 반환',
  })
  @GenericApiResponse({
    status: 201,
    description: '자주 먹은 메뉴 조회 성공',
    message: 'Frequently recorded menus returned successfully',
    model: MenuListResponseDto,
  })
  @ErrorApiResponse({
    status: 401,
    description: '유효하지 않거나 기간이 만료된 accessToken',
    message: 'Invalid or expired accessToken',
    error: 'UnauthorizedException',
  })
  @ResponseMsg('Frequently recorded menus returned successfully')
  @UseGuards(AuthGuard())
  @Post('/frequentlyRecordedMenus')
  async frequentlyRecordedMenus(
    @GetUser() user: UserEntity,
  ): Promise<MenuListResponseDto> {
    return await this.homeService.getFrequentlyRecordedMenus(user);
  }

  // 직접 등록한 메뉴 조회
  @ApiBearerAuth('accessToken')
  @ApiOperation({
    summary: '직접 등록한 메뉴 조회',
  })
  @GenericApiResponse({
    status: 201,
    description: '직접 등록한 메뉴 조회 성공',
    message: 'Registered menus returned successfully',
    model: MenuListResponseDto,
  })
  @ErrorApiResponse({
    status: 401,
    description: '유효하지 않거나 기간이 만료된 accessToken',
    message: 'Invalid or expired accessToken',
    error: 'UnauthorizedException',
  })
  @ResponseMsg('Registered menus returned successfully')
  @UseGuards(AuthGuard())
  @Post('/registeredMenus')
  async registeredMenus(
    @GetUser() user: UserEntity,
  ): Promise<MenuListResponseDto> {
    return await this.homeService.getRegisteredMenus(user);
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

  @ApiBearerAuth('accessToken')
  @ApiOperation({
    summary: '영양성분표 사진 인식',
  })
  @GenericApiResponse({
    status: 201,
    description: '영양성분표 사진 인식 성공',
    message: 'Nutrition label recognized successfully',
    model: NutritionLabelRecognitionResponseDto,
  })
  @ErrorApiResponse({
    status: 400,
    description: 'Bad Request  \nimage 파일 누락 또는 잘못된 형식',
    message: 'image file is required',
    error: 'BadRequestException',
  })
  @ErrorApiResponse({
    status: 401,
    description: '유효하지 않거나 기간이 만료된 accessToken',
    message: 'Invalid or expired accessToken',
    error: 'UnauthorizedException',
  })
  @ErrorApiResponse({
    status: 503,
    description: 'Gemini API 호출 실패 또는 응답 파싱 실패',
    message: 'Nutrition label recognition is unavailable',
    error: 'ServiceUnavailableException',
  })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    description: '영양성분표 이미지 업로드',
    schema: {
      type: 'object',
      properties: {
        image: {
          type: 'string',
          format: 'binary',
          description: '영양성분표 이미지 파일',
        },
      },
      required: ['image'],
    },
  })
  @UseGuards(AuthGuard())
  @UseInterceptors(FileInterceptor('image'))
  @ResponseMsg('Nutrition label recognized successfully')
  @Post('recognizeNutritionLabel')
  async recognizeNutritionLabel(
    @GetUser() user: UserEntity,
    @UploadedFile() file: Express.Multer.File,
  ): Promise<NutritionLabelRecognitionResponseDto> {
    return await this.homeService.recognizeNutritionLabel(user, file);
  }

  @ApiBearerAuth('accessToken')
  @ApiOperation({
    summary: '음식 사진 인식',
  })
  @GenericApiResponse({
    status: 201,
    description: '음식 사진 인식 성공',
    message: 'Food image recognized successfully',
    model: FoodImageRecognitionResponseDto,
  })
  @ErrorApiResponse({
    status: 400,
    description:
      'Bad Request  \nimage 파일 누락, 잘못된 형식, 또는 음식 사진 인식 실패 사유',
    message: 'image file is required',
    error: 'BadRequestException',
    examples: {
      imageRequired: {
        summary: 'image 파일 누락',
        value: {
          message: 'image file is required',
          statusCode: 400,
          error: 'BadRequestException',
        },
      },
      invalidImageType: {
        summary: 'image 파일 형식 오류',
        value: {
          message: 'image file must be an image',
          statusCode: 400,
          error: 'BadRequestException',
        },
      },
      lowImageQuality: {
        summary: '사진 화질이 너무 낮음',
        value: {
          message: 'food image quality is too low',
          statusCode: 400,
          error: 'BadRequestException',
        },
      },
      foodTooSmall: {
        summary: '사진에서 음식이 너무 작음',
        value: {
          message: 'food in image is too small',
          statusCode: 400,
          error: 'BadRequestException',
        },
      },
      tooBlurry: {
        summary: '사진이 흐림',
        value: {
          message: 'food image is too blurry',
          statusCode: 400,
          error: 'BadRequestException',
        },
      },
      poorLighting: {
        summary: '조명이 좋지 않음',
        value: {
          message: 'food image lighting is too poor',
          statusCode: 400,
          error: 'BadRequestException',
        },
      },
      foodOccluded: {
        summary: '음식이 가려지거나 잘림',
        value: {
          message: 'food is occluded or cut off',
          statusCode: 400,
          error: 'BadRequestException',
        },
      },
      noFoodDetected: {
        summary: '사진에서 음식을 찾을 수 없음',
        value: {
          message: 'no food detected in image',
          statusCode: 400,
          error: 'BadRequestException',
        },
      },
      noMatchingMenu: {
        summary: '후보 메뉴와 매칭 불가',
        value: {
          message: 'no recognizable menu matched candidates',
          statusCode: 400,
          error: 'BadRequestException',
        },
      },
    },
  })
  @ErrorApiResponse({
    status: 401,
    description: '유효하지 않거나 기간이 만료된 accessToken',
    message: 'Invalid or expired accessToken',
    error: 'UnauthorizedException',
  })
  @ErrorApiResponse({
    status: 503,
    description: 'Gemini API 호출 실패 또는 응답 파싱 실패',
    message: 'Food image recognition is unavailable',
    error: 'ServiceUnavailableException',
  })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    description: '음식 이미지 업로드',
    schema: {
      type: 'object',
      properties: {
        image: {
          type: 'string',
          format: 'binary',
          description: '음식 사진 파일',
        },
      },
      required: ['image'],
    },
  })
  @UseGuards(AuthGuard())
  @UseInterceptors(FileInterceptor('image'))
  @ResponseMsg('Food image recognized successfully')
  @Post('recognizeFoodImage')
  async recognizeFoodImage(
    @GetUser() user: UserEntity,
    @UploadedFile() file: Express.Multer.File,
  ): Promise<FoodImageRecognitionResponseDto> {
    return await this.homeService.recognizeFoodImage(user, file);
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

  // 폴더 생성 및 수정
  @ApiBearerAuth('accessToken')
  @ApiOperation({
    summary: '폴더 생성 및 수정',
  })
  @GenericApiResponse({
    status: 201,
    description: '폴더 생성 및 수정 성공',
    message: 'Folder saved successfully',
    model: FolderIdResponseDto,
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
    description: '수정할 폴더 또는 메뉴를 찾을 수 없음',
    message: 'Folder not found',
    error: 'NotFoundException',
  })
  @ResponseMsg('Folder saved successfully')
  @UseGuards(AuthGuard())
  @Post('/folder')
  async upsertFolder(
    @GetUser() user: UserEntity,
    @Body() upsertFolderRequestDto: UpsertFolderRequestDto,
  ): Promise<FolderIdResponseDto> {
    return await this.homeService.upsertFolder(user, upsertFolderRequestDto);
  }

  // 폴더 조회
  @ApiBearerAuth('accessToken')
  @ApiOperation({
    summary: '폴더 조회',
  })
  @GenericApiResponse({
    status: 201,
    description: '폴더 조회 성공',
    message: 'Folder list returned successfully',
    model: FolderListResponseDto,
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
  @ResponseMsg('Folder list returned successfully')
  @UseGuards(AuthGuard())
  @Post('/folders')
  async getFolders(
    @GetUser() user: UserEntity,
    @Body() folderListRequestDto: FolderListRequestDto,
  ): Promise<FolderListResponseDto> {
    return await this.homeService.getFolders(user, folderListRequestDto);
  }

  // 폴더 메뉴 상세 조회
  @ApiBearerAuth('accessToken')
  @ApiOperation({
    summary: '폴더 메뉴 상세 조회',
  })
  @GenericApiResponse({
    status: 201,
    description: '폴더 메뉴 상세 조회 성공',
    message: 'Folder detail returned successfully',
    model: FolderDetailResponseDto,
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
    description: '폴더를 찾을 수 없음',
    message: 'Folder not found',
    error: 'NotFoundException',
  })
  @ResponseMsg('Folder detail returned successfully')
  @UseGuards(AuthGuard())
  @Post('/folder/detail')
  async getFolderDetail(
    @GetUser() user: UserEntity,
    @Body() folderDetailRequestDto: FolderDetailRequestDto,
  ): Promise<FolderDetailResponseDto> {
    return await this.homeService.getFolderDetail(user, folderDetailRequestDto);
  }

  // 폴더 삭제
  @ApiBearerAuth('accessToken')
  @ApiOperation({
    summary: '폴더 삭제',
  })
  @NullApiResponse({
    status: 201,
    description: '폴더 삭제 성공',
    message: 'Folder deleted successfully',
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
    description: '삭제할 폴더를 찾을 수 없음',
    message: 'Folder not found',
    error: 'NotFoundException',
  })
  @ResponseMsg('Folder deleted successfully')
  @UseGuards(AuthGuard())
  @Post('/folder/delete')
  async deleteFolder(
    @GetUser() user: UserEntity,
    @Body() deleteFolderRequestDto: DeleteFolderRequestDto,
  ): Promise<void> {
    await this.homeService.deleteFolder(user, deleteFolderRequestDto);
  }

  // 세트 생성 및 수정
  @ApiBearerAuth('accessToken')
  @ApiOperation({
    summary: '세트 생성 및 수정',
  })
  @GenericApiResponse({
    status: 201,
    description: '세트 생성 및 수정 성공',
    message: 'Menu set saved successfully',
    model: MenuSetIdResponseDto,
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
    description: '수정할 세트 또는 메뉴를 찾을 수 없음',
    message: 'Menu set not found',
    error: 'NotFoundException',
  })
  @ResponseMsg('Menu set saved successfully')
  @UseGuards(AuthGuard())
  @Post('/set')
  async upsertMenuSet(
    @GetUser() user: UserEntity,
    @Body() upsertMenuSetRequestDto: UpsertMenuSetRequestDto,
  ): Promise<MenuSetIdResponseDto> {
    return await this.homeService.upsertMenuSet(
      user,
      upsertMenuSetRequestDto,
    );
  }

  // 세트 조회
  @ApiBearerAuth('accessToken')
  @ApiOperation({
    summary: '세트 조회',
  })
  @GenericApiResponse({
    status: 201,
    description: '세트 조회 성공',
    message: 'Menu set list returned successfully',
    model: MenuSetListResponseDto,
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
  @ResponseMsg('Menu set list returned successfully')
  @UseGuards(AuthGuard())
  @Post('/sets')
  async getMenuSets(
    @GetUser() user: UserEntity,
    @Body() menuSetListRequestDto: MenuSetListRequestDto,
  ): Promise<MenuSetListResponseDto> {
    return await this.homeService.getMenuSets(user, menuSetListRequestDto);
  }

  // 세트 메뉴 상세 조회
  @ApiBearerAuth('accessToken')
  @ApiOperation({
    summary: '세트 메뉴 상세 조회',
  })
  @GenericApiResponse({
    status: 201,
    description: '세트 메뉴 상세 조회 성공',
    message: 'Menu set detail returned successfully',
    model: MenuSetDetailResponseDto,
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
    description: '세트를 찾을 수 없음',
    message: 'Menu set not found',
    error: 'NotFoundException',
  })
  @ResponseMsg('Menu set detail returned successfully')
  @UseGuards(AuthGuard())
  @Post('/set/detail')
  async getMenuSetDetail(
    @GetUser() user: UserEntity,
    @Body() menuSetDetailRequestDto: MenuSetDetailRequestDto,
  ): Promise<MenuSetDetailResponseDto> {
    return await this.homeService.getMenuSetDetail(
      user,
      menuSetDetailRequestDto,
    );
  }

  // 세트 삭제
  @ApiBearerAuth('accessToken')
  @ApiOperation({
    summary: '세트 삭제',
  })
  @NullApiResponse({
    status: 201,
    description: '세트 삭제 성공',
    message: 'Menu set deleted successfully',
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
    description: '삭제할 세트를 찾을 수 없음',
    message: 'Menu set not found',
    error: 'NotFoundException',
  })
  @ResponseMsg('Menu set deleted successfully')
  @UseGuards(AuthGuard())
  @Post('/set/delete')
  async deleteMenuSet(
    @GetUser() user: UserEntity,
    @Body() deleteMenuSetRequestDto: DeleteMenuSetRequestDto,
  ): Promise<void> {
    await this.homeService.deleteMenuSet(user, deleteMenuSetRequestDto);
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

  @ApiBearerAuth('accessToken')
  @ApiOperation({
    summary: '특정 기간 내 식사 기록 날짜 조회',
  })
  @GenericApiResponse({
    status: 201,
    description: '특정 기간 내 식사 기록 날짜 조회 성공',
    message: 'Meal recorded dates returned successfully',
    model: MealRecordedDatesResponseDto,
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
  @ResponseMsg('Meal recorded dates returned successfully')
  @UseGuards(AuthGuard())
  @Post('/getMealRecordedDates')
  async getMealRecordedDates(
    @GetUser() user: UserEntity,
    @Body() dto: MealRecordedDatesRequestDto,
  ): Promise<MealRecordedDatesResponseDto> {
    return await this.homeService.getMealRecordedDates(user, dto);
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
  @ResponseMsg('Menu registered successfully')
  @UseGuards(AuthGuard())
  @Post('/registerMenu')
  async registerMenu(
    @GetUser() user: UserEntity,
    @Body() registerMenuRequestDto: RegisterMenuRequestDto,
  ): Promise<MenuIdResponseDto> {
    return await this.homeService.registerMenu(user, registerMenuRequestDto);
  }

  // CSV 메뉴 등록
  // @ApiBearerAuth('accessToken')
  @ApiOperation({
    summary: 'CSV 메뉴 등록',
  })
  @GenericApiResponse({
    status: 201,
    description: 'CSV 메뉴 등록 성공',
    message: 'Menus imported successfully',
    model: MenuCsvImportResponseDto,
  })
  @ErrorApiResponse({
    status: 400,
    description: 'Bad Request  \ncsv 파일 누락 또는 CSV 형식 오류',
    message: 'csv file is required',
    error: 'BadRequestException',
  })
  @ErrorApiResponse({
    status: 401,
    description: '유효하지 않거나 기간이 만료된 accessToken',
    message: 'Invalid or expired accessToken',
    error: 'UnauthorizedException',
  })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    description: '메뉴 CSV 업로드',
    schema: {
      type: 'object',
      properties: {
        csv: {
          type: 'string',
          format: 'binary',
          description: '메뉴 CSV 파일',
        },
      },
      required: ['csv'],
    },
  })
  // @UseGuards(AuthGuard())
  @UseInterceptors(FileInterceptor('csv'))
  @ResponseMsg('Menus imported successfully')
  @Post('/importMenusCsv')
  async importMenusCsv(
    @UploadedFile() file: Express.Multer.File,
  ): Promise<MenuCsvImportResponseDto> {
    return await this.homeService.importMenusCsv(file);
  }

  // CSV 운동 등록
  @ApiOperation({
    summary: 'CSV 운동 등록',
  })
  @GenericApiResponse({
    status: 201,
    description: 'CSV 운동 등록 성공',
    message: 'Workouts imported successfully',
    model: WorkoutCsvImportResponseDto,
  })
  @ErrorApiResponse({
    status: 400,
    description: 'Bad Request  \ncsv 파일 누락 또는 CSV 형식 오류',
    message: 'csv file is required',
    error: 'BadRequestException',
  })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    description: '운동 CSV 업로드',
    schema: {
      type: 'object',
      properties: {
        csv: {
          type: 'string',
          format: 'binary',
          description: '운동 CSV 파일',
        },
      },
      required: ['csv'],
    },
  })
  @UseInterceptors(FileInterceptor('csv'))
  @ResponseMsg('Workouts imported successfully')
  @Post('/importWorkoutsCsv')
  async importWorkoutsCsv(
    @UploadedFile() file: Express.Multer.File,
  ): Promise<WorkoutCsvImportResponseDto> {
    return await this.homeService.importWorkoutsCsv(file);
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

  // 오늘 운동 기록 조회
  @ApiBearerAuth('accessToken')
  @ApiOperation({
    summary: '오늘 운동 기록 조회',
  })
  @GenericApiResponse({
    status: 201,
    description: '오늘 운동 기록 조회 성공',
    message: 'Workout record returned successfully',
    model: WorkoutRecordResponseDto,
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
  @ResponseMsg('Workout record returned successfully')
  @UseGuards(AuthGuard())
  @Post('/getWorkoutRecord')
  async getWorkoutRecord(
    @GetUser() user: UserEntity,
    @Body() getWorkoutRecordRequestDto: GetWorkoutRecordRequestDto,
  ): Promise<WorkoutRecordResponseDto> {
    return await this.homeService.getWorkoutRecord(
      user,
      getWorkoutRecordRequestDto,
    );
  }

  // 오늘 운동 기록 취소
  @ApiBearerAuth('accessToken')
  @ApiOperation({
    summary: '오늘 운동 기록 취소',
    description: 'workout_id가 null이면 해당 날짜의 전체 운동 기록 취소',
  })
  @NullApiResponse({
    status: 201,
    description: '오늘 운동 기록 취소 성공',
    message: 'Workout record deleted successfully',
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
    description: '삭제할 운동 기록을 찾을 수 없음',
    message: 'Workout record not found',
    error: 'NotFoundException',
  })
  @ResponseMsg('Workout record deleted successfully')
  @UseGuards(AuthGuard())
  @Post('/deleteWorkoutRecord')
  async deleteWorkoutRecord(
    @GetUser() user: UserEntity,
    @Body() deleteWorkoutRecordRequestDto: DeleteWorkoutRecordRequestDto,
  ): Promise<void> {
    await this.homeService.deleteWorkoutRecord(
      user,
      deleteWorkoutRecordRequestDto,
    );
  }

  // 운동 검색
  @ApiBearerAuth('accessToken')
  @ApiOperation({
    summary: '운동 검색',
  })
  @GenericApiResponse({
    status: 201,
    description: '운동 검색 성공',
    message: 'Workout searched successfully',
    model: WorkoutSearchResponseDto,
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
  @ResponseMsg('Workout searched successfully')
  @UseGuards(AuthGuard())
  @Post('/searchWorkout')
  async searchWorkout(
    @Body() searchWorkoutRequestDto: SearchWorkoutRequestDto,
  ): Promise<WorkoutSearchResponseDto> {
    return await this.homeService.searchWorkout(searchWorkoutRequestDto);
  }

  // 운동 상세 내역
  @ApiBearerAuth('accessToken')
  @ApiOperation({
    summary: '운동 상세 내역',
  })
  @GenericApiResponse({
    status: 201,
    description: '운동 상세 내역 조회 성공',
    message: 'Workout detail returned successfully',
    model: WorkoutDetailResponseDto,
  })
  @ErrorApiResponse({
    status: 400,
    description: 'Bad Request  \nbody 입력값의 필드 조건 및 JSON 형식 오류',
    message: 'Invalid request body',
    error: 'BadRequestException',
  })
  @ErrorApiResponse({
    status: 404,
    description: '운동을 찾을 수 없음',
    message: 'Workout not found',
    error: 'NotFoundException',
  })
  @ResponseMsg('Workout detail returned successfully')
  @UseGuards(AuthGuard())
  @Post('/workout/detail')
  async getWorkoutDetail(
    @Body() workoutDetailRequestDto: WorkoutDetailRequestDto,
  ): Promise<WorkoutDetailResponseDto> {
    return await this.homeService.getWorkoutDetail(workoutDetailRequestDto);
  }

  // 운동 추가 및 수정
  @ApiBearerAuth('accessToken')
  @ApiOperation({
    summary: '운동 추가 및 수정',
    description: '오늘 날짜 기준으로 같은 운동 기록이 있으면 수정하고 없으면 추가',
  })
  @GenericApiResponse({
    status: 201,
    description: '운동 추가 및 수정 성공',
    message: 'Workout record registered successfully',
    model: WorkoutIdResponseDto,
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
    description: '운동을 찾을 수 없음',
    message: 'Workout not found',
    error: 'NotFoundException',
  })
  @ResponseMsg('Workout record registered successfully')
  @UseGuards(AuthGuard())
  @Post('/registerWorkout')
  async registerWorkout(
    @GetUser() user: UserEntity,
    @Body() upsertWorkoutRecordRequestDto: UpsertWorkoutRecordRequestDto,
  ): Promise<WorkoutIdResponseDto> {
    return await this.homeService.upsertWorkoutRecord(
      user,
      upsertWorkoutRecordRequestDto,
    );
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
