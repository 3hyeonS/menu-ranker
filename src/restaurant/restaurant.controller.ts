import {
  Body,
  Controller,
  Post,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import {
  ApiBearerAuth,
  ApiExtraModels,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { UserEntity } from '../auth/entity/user/user.entity';
import { GetUser } from '../decorators/get-user-decorator';
import { GenericApiResponse } from '../decorators/generic-api-response-decorator';
import { ErrorApiResponse } from '../decorators/error-api-response-decorator';
import { ResponseMsg } from '../decorators/response-message-decorator';
import { ResponseTransformInterceptor } from '../interceptors/response-transform-interceptor';
import { ResponseDto } from '../response-dto';
import { RestaurantSearchRequestDto } from './dto/request-dto/restaurant-search-request-dto';
import { RestaurantDetailRequestDto } from './dto/request-dto/restaurant-detail-request-dto';
import { RestaurantBrandsRequestDto } from './dto/request-dto/restaurant-brands-request-dto';
import { RestaurantPlaceRequestDto } from './dto/request-dto/restaurant-place-request-dto';
import { RestaurantSearchResponseDto } from './dto/response-dto/restaurant-search-response-dto';
import { RestaurantDetailResponseDto } from './dto/response-dto/restaurant-detail-response-dto';
import { RestaurantBrandsResponseDto } from './dto/response-dto/restaurant-brands-response-dto';
import { RestaurantPlaceResponseDto } from './dto/response-dto/restaurant-place-response-dto';
import { RestaurantService } from './restaurant.service';

@ApiTags('식당 탭')
@ApiExtraModels(ResponseDto)
@UseInterceptors(ResponseTransformInterceptor)
@ApiBearerAuth('accessToken')
@UseGuards(AuthGuard())
@Controller('/restaurant')
export class RestaurantController {
  constructor(private readonly restaurantService: RestaurantService) {}

  @ApiOperation({ summary: '식당 검색' })
  @GenericApiResponse({
    status: 201,
    description: '식당 검색 성공',
    message: 'Restaurants searched successfully',
    model: RestaurantSearchResponseDto,
  })
  @ErrorApiResponse({
    status: 400,
    description: 'input, limit 또는 cursor 형식 오류',
    message: 'Invalid request body',
    error: 'BadRequestException',
  })
  @ResponseMsg('Restaurants searched successfully')
  @Post('/search')
  async search(
    @Body() dto: RestaurantSearchRequestDto,
  ): Promise<RestaurantSearchResponseDto> {
    return await this.restaurantService.searchRestaurants(dto);
  }

  @ApiOperation({
    summary: '식당별 개인화 메뉴 추천',
    description:
      '브랜드 식당은 공식 영양정보 메뉴를, 개인 식당 가상 ID(/restaurant/brands가 준 100000000 이상)는 카카오 메뉴 중 영양 추정값이 있는 메뉴만 반환합니다. 개인 식당 메뉴의 영양값은 메뉴명 기반 추정이고 menu_category는 null입니다. 개인 식당 menu_id는 지점 메뉴를 다시 적재하면 바뀝니다. 추정 여부는 ID 범위가 아니라 메뉴의 nutrition_source(official/estimated)로 구분합니다.',
  })
  @GenericApiResponse({
    status: 201,
    description: '식당 메뉴 추천 성공',
    message: 'Restaurant recommendations returned successfully',
    model: RestaurantDetailResponseDto,
  })
  @ErrorApiResponse({
    status: 404,
    description: '식당 ID에 해당하는 식당이 없음',
    message: 'Restaurant not found',
    error: 'NotFoundException',
  })
  @ResponseMsg('Restaurant recommendations returned successfully')
  @Post('/detail')
  async detail(
    @Body() dto: RestaurantDetailRequestDto,
    @GetUser() user: UserEntity,
  ): Promise<RestaurantDetailResponseDto> {
    return await this.restaurantService.getRestaurantDetail(dto, user.id);
  }

  @ApiOperation({
    summary: '카카오 장소 ID로 등록 식당 조회',
    description:
      '요청한 장소 중 적재된 카카오 장소를 개인 식당까지 모두 요청 순서대로 반환합니다. 프랜차이즈 지점은 브랜드 restaurant_id·브랜드명을, 개인 식당은 카카오 장소명과 함께 영양 추정 메뉴가 있으면 가상 restaurant_id(100000000 이상), 없으면 null을 줍니다. 수집 지역 밖이나 수집 후 새로 생긴 장소는 나오지 않습니다.',
  })
  @GenericApiResponse({
    status: 201,
    description: '등록 식당 조회 성공',
    message: 'Registered brands returned successfully',
    model: RestaurantBrandsResponseDto,
  })
  @ErrorApiResponse({
    status: 400,
    description: 'place_ids 형식 오류(1~100개, number 또는 숫자 문자열)',
    message: 'Invalid request body',
    error: 'BadRequestException',
  })
  @ResponseMsg('Registered brands returned successfully')
  @Post('/brands')
  async brands(
    @Body() dto: RestaurantBrandsRequestDto,
  ): Promise<RestaurantBrandsResponseDto> {
    return await this.restaurantService.findRegisteredBrands(dto);
  }

  @ApiOperation({
    summary: '카카오 장소 ID로 지점 메뉴 조회',
    description:
      '수집한 카카오 장소(서울 25개 구 음식점)의 카카오 메뉴명·사진을 반환합니다. 영양정보는 없습니다. 프랜차이즈 지점이면 restaurant_id로 /restaurant/detail에서 영양정보 메뉴를 조회할 수 있습니다.',
  })
  @GenericApiResponse({
    status: 201,
    description: '지점 메뉴 조회 성공',
    message: 'Place returned successfully',
    model: RestaurantPlaceResponseDto,
  })
  @ErrorApiResponse({
    status: 400,
    description: 'place_id 형식 오류(number 또는 숫자 문자열)',
    message: 'Invalid request body',
    error: 'BadRequestException',
  })
  @ErrorApiResponse({
    status: 404,
    description: '수집하지 않은 장소',
    message: 'Place not found',
    error: 'NotFoundException',
  })
  @ResponseMsg('Place returned successfully')
  @Post('/place')
  async place(
    @Body() dto: RestaurantPlaceRequestDto,
  ): Promise<RestaurantPlaceResponseDto> {
    return await this.restaurantService.findPlace(dto);
  }
}
