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
import { GenericApiResponse } from '../decorators/generic-api-response-decorator';
import { GetUser } from '../decorators/get-user-decorator';
import { NullApiResponse } from '../decorators/null-api-response-decorator';
import { ResponseMsg } from '../decorators/response-message-decorator';
import { ResponseTransformInterceptor } from '../interceptors/response-transform-interceptor';
import { ResponseDto } from '../response-dto';
import { GetMenstrualRecordsRequestDto } from './dto/request-dto/get-menstrual-records-request.dto';
import { SaveMenstrualRecordsRequestDto } from './dto/request-dto/save-menstrual-records-request.dto';
import { MenstrualRecordsResponseDto } from './dto/response-dto/menstrual-records-response.dto';
import { MenstrualService } from './menstrual.service';

@ApiTags('월경 기록')
@ApiBearerAuth('accessToken')
@ApiExtraModels(ResponseDto)
@UseGuards(AuthGuard())
@UseInterceptors(ResponseTransformInterceptor)
@Controller('/menstrual')
export class MenstrualController {
  constructor(private readonly menstrualService: MenstrualService) {}

  @ApiOperation({ summary: '기간 내 월경 기록 구간 조회' })
  @GenericApiResponse({
    status: 201,
    description: '월경 기록 구간 조회 성공',
    message: 'Menstrual records returned successfully',
    model: MenstrualRecordsResponseDto,
  })
  @ResponseMsg('Menstrual records returned successfully')
  @Post('/records')
  getRecords(
    @GetUser() user: UserEntity,
    @Body() request: GetMenstrualRecordsRequestDto,
  ): Promise<MenstrualRecordsResponseDto> {
    return this.menstrualService.getRecords(user, request);
  }

  @ApiOperation({ summary: '월경 기록 구간 추가 및 삭제' })
  @NullApiResponse({
    status: 201,
    description: '월경 기록 저장 성공',
    message: 'Menstrual records saved successfully',
  })
  @ResponseMsg('Menstrual records saved successfully')
  @Post('/records/save')
  async saveRecords(
    @GetUser() user: UserEntity,
    @Body() request: SaveMenstrualRecordsRequestDto,
  ): Promise<void> {
    await this.menstrualService.saveRecords(user, request);
  }
}
