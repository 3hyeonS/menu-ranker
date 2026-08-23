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
import { CreateMenstrualCycleRequestDto } from './dto/request-dto/create-menstrual-cycle-request.dto';
import { CreateMenstrualRecordRequestDto } from './dto/request-dto/create-menstrual-record-request.dto';
import { DeleteMenstrualCycleRequestDto } from './dto/request-dto/delete-menstrual-cycle-request.dto';
import { GetMenstrualCyclesRequestDto } from './dto/request-dto/get-menstrual-cycles-request.dto';
import {
  MenstrualDateRequestDto,
  MenstrualRecordFieldsDto,
} from './dto/request-dto/menstrual-record-fields.dto';
import {
  MenstrualCycleResponseDto,
  MenstrualCyclesResponseDto,
} from './dto/response-dto/menstrual-cycle-response.dto';
import { MenstrualRecordResponseDto } from './dto/response-dto/menstrual-record-response.dto';
import { MenstrualService } from './menstrual.service';

@ApiTags('월경 기록')
@ApiBearerAuth('accessToken')
@ApiExtraModels(ResponseDto)
@UseGuards(AuthGuard())
@UseInterceptors(ResponseTransformInterceptor)
@Controller('/menstrual')
export class MenstrualController {
  constructor(private readonly menstrualService: MenstrualService) {}

  @ApiOperation({ summary: '새 월경 회차 생성' })
  @GenericApiResponse({
    status: 201,
    description: '새 월경 회차 생성 성공',
    message: 'Menstrual cycle created successfully',
    model: MenstrualCycleResponseDto,
  })
  @ResponseMsg('Menstrual cycle created successfully')
  @Post('/cycle')
  createCycle(
    @GetUser() user: UserEntity,
    @Body() request: CreateMenstrualCycleRequestDto,
  ): Promise<MenstrualCycleResponseDto> {
    return this.menstrualService.createCycle(user, request);
  }

  @ApiOperation({ summary: '월경 일별 기록 생성' })
  @GenericApiResponse({
    status: 201,
    description: '월경 일별 기록 생성 성공',
    message: 'Menstrual record created successfully',
    model: MenstrualRecordResponseDto,
  })
  @ResponseMsg('Menstrual record created successfully')
  @Post('/record')
  createRecord(
    @GetUser() user: UserEntity,
    @Body() request: CreateMenstrualRecordRequestDto,
  ): Promise<MenstrualRecordResponseDto> {
    return this.menstrualService.createRecord(user, request);
  }

  @ApiOperation({ summary: '기준일 이전 월경 회차 목록 조회' })
  @GenericApiResponse({
    status: 201,
    description: '월경 회차 목록 조회 성공',
    message: 'Menstrual cycles returned successfully',
    model: MenstrualCyclesResponseDto,
  })
  @ResponseMsg('Menstrual cycles returned successfully')
  @Post('/cycles')
  getCycles(
    @GetUser() user: UserEntity,
    @Body() request: GetMenstrualCyclesRequestDto,
  ): Promise<MenstrualCyclesResponseDto> {
    return this.menstrualService.getCycles(user, request);
  }

  @ApiOperation({ summary: '특정 날짜 직접 입력 기록 조회' })
  @GenericApiResponse({
    status: 201,
    description: '월경 기록 조회 성공',
    message: 'Menstrual record returned successfully',
    model: MenstrualRecordResponseDto,
  })
  @ResponseMsg('Menstrual record returned successfully')
  @Post('/record/detail')
  getRecord(
    @GetUser() user: UserEntity,
    @Body() request: MenstrualDateRequestDto,
  ): Promise<MenstrualRecordResponseDto> {
    return this.menstrualService.getRecord(user, request.date);
  }

  @ApiOperation({ summary: '특정 날짜 월경 기록 수정' })
  @GenericApiResponse({
    status: 201,
    description: '월경 기록 수정 성공',
    message: 'Menstrual record updated successfully',
    model: MenstrualRecordResponseDto,
  })
  @ResponseMsg('Menstrual record updated successfully')
  @Post('/record/update')
  updateRecord(
    @GetUser() user: UserEntity,
    @Body() request: MenstrualRecordFieldsDto,
  ): Promise<MenstrualRecordResponseDto> {
    return this.menstrualService.updateRecord(user, request);
  }

  @ApiOperation({ summary: '월경 회차와 연결된 일별 기록 전체 삭제' })
  @NullApiResponse({
    status: 201,
    description: '월경 회차 삭제 성공',
    message: 'Menstrual cycle deleted successfully',
  })
  @ResponseMsg('Menstrual cycle deleted successfully')
  @Post('/cycle/delete')
  async deleteCycle(
    @GetUser() user: UserEntity,
    @Body() request: DeleteMenstrualCycleRequestDto,
  ): Promise<void> {
    await this.menstrualService.deleteCycle(user, request.cycle_id);
  }
}
