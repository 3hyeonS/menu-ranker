import {
  Body,
  Controller,
  Post,
  UseInterceptors,
} from '@nestjs/common';
import {
  ApiExtraModels,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { GenericApiResponse } from '../decorators/generic-api-response-decorator';
import { ErrorApiResponse } from '../decorators/error-api-response-decorator';
import { ResponseMsg } from '../decorators/response-message-decorator';
import { ResponseTransformInterceptor } from '../interceptors/response-transform-interceptor';
import { ResponseDto } from '../response-dto';
import { RestaurantSearchRequestDto } from './dto/request-dto/restaurant-search-request-dto';
import { RestaurantDetailRequestDto } from './dto/request-dto/restaurant-detail-request-dto';
import { RestaurantSearchResponseDto } from './dto/response-dto/restaurant-search-response-dto';
import { RestaurantDetailResponseDto } from './dto/response-dto/restaurant-detail-response-dto';
import { RestaurantService } from './restaurant.service';

@ApiTags('식당 탭')
@ApiExtraModels(ResponseDto)
@UseInterceptors(ResponseTransformInterceptor)
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
    summary: '식당별 개인화 메뉴 추천 (임시 인증 없는 테스트 API)',
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
  ): Promise<RestaurantDetailResponseDto> {
    return await this.restaurantService.getRestaurantDetail(dto);
  }
}
