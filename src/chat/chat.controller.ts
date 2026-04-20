import {
  Body,
  Controller,
  Get,
  Post,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import {
  ApiBearerAuth,
  ApiBody,
  ApiConsumes,
  ApiExtraModels,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { FileInterceptor } from '@nestjs/platform-express';
import { GetUser } from '../decorators/get-user-decorator';
import { ResponseTransformInterceptor } from '../interceptors/response-transform-interceptor';
import { ResponseMsg } from '../decorators/response-message-decorator';
import { ResponseDto } from '../response-dto';
import { GenericApiResponse } from '../decorators/generic-api-response-decorator';
import { ErrorApiResponse } from '../decorators/error-api-response-decorator';
import { UserEntity } from '../auth/entity/user/user.entity';
import { ChatService } from './chat.service';
import { ChatRecommendRequestDto } from './dto/request-dto/chat-recommend-request-dto';
import { ChatRecommendResponseDto } from './dto/response-dto/chat-recommend-response-dto';
import { ChatHistoryResponseDto } from './dto/response-dto/chat-history-response-dto';

@ApiTags('채팅')
@UseInterceptors(ResponseTransformInterceptor)
@ApiExtraModels(ResponseDto)
@Controller('/chat')
export class ChatController {
  constructor(private readonly chatService: ChatService) {}

  @ApiBearerAuth('accessToken')
  @ApiOperation({
    summary: '채팅형 메뉴 추천',
    description:
      '자연어 요청을 Gemini로 구조화한 뒤 내부 영양 알고리즘으로 상위 10개 메뉴를 산출하고, 다시 Gemini로 설명을 생성합니다. 날짜는 서버의 현재 날짜를 사용하고, 시간대는 텍스트에 있으면 그 값을 우선합니다.',
  })
  @GenericApiResponse({
    status: 201,
    description: '채팅형 메뉴 추천 성공',
    message: 'Menu recommendations generated successfully',
    model: ChatRecommendResponseDto,
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
    status: 503,
    description: 'Gemini API 호출 실패 또는 응답 파싱 실패',
    message: 'Gemini recommendation pipeline is unavailable',
    error: 'ServiceUnavailableException',
  })
  @ResponseMsg('Menu recommendations generated successfully')
  @UseGuards(AuthGuard())
  @Post('/recommend')
  async recommendMenus(
    @GetUser() user: UserEntity,
    @Body() chatRecommendRequestDto: ChatRecommendRequestDto,
  ): Promise<ChatRecommendResponseDto> {
    return await this.chatService.recommend(user, chatRecommendRequestDto);
  }

  @ApiBearerAuth('accessToken')
  @ApiOperation({
    summary: '메뉴판 사진 기반 메뉴 추천',
  })
  @GenericApiResponse({
    status: 201,
    description: '메뉴판 사진 기반 메뉴 추천 성공',
    message: 'Menu board recommendations generated successfully',
    model: ChatRecommendResponseDto,
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
    message: 'Gemini recommendation pipeline is unavailable',
    error: 'ServiceUnavailableException',
  })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    description: '메뉴판 이미지 업로드',
    schema: {
      type: 'object',
      properties: {
        image: {
          type: 'string',
          format: 'binary',
          description: '메뉴판 사진 파일',
        },
      },
      required: ['image'],
    },
  })
  @ResponseMsg('Menu board recommendations generated successfully')
  @UseGuards(AuthGuard())
  @UseInterceptors(FileInterceptor('image'))
  @Post('/menu-board')
  async recommendMenusFromMenuBoard(
    @GetUser() user: UserEntity,
    @UploadedFile() file: Express.Multer.File,
  ): Promise<ChatRecommendResponseDto> {
    return await this.chatService.recommendFromMenuBoard(user, file);
  }

  @ApiBearerAuth('accessToken')
  @ApiOperation({
    summary: '채팅 기록 조회',
    description:
      '사용자의 메뉴 추천 채팅 기록을 최신순으로 반환합니다. 저장된 추천 응답 JSON 전체도 함께 포함됩니다.',
  })
  @GenericApiResponse({
    status: 200,
    description: '채팅 기록 조회 성공',
    message: 'Chat history returned successfully',
    model: ChatHistoryResponseDto,
  })
  @ErrorApiResponse({
    status: 401,
    description: '유효하지 않거나 기간이 만료된 accessToken',
    message: 'Invalid or expired accessToken',
    error: 'UnauthorizedException',
  })
  @ResponseMsg('Chat history returned successfully')
  @UseGuards(AuthGuard())
  @Get('/history')
  async getChatHistory(
    @GetUser() user: UserEntity,
  ): Promise<ChatHistoryResponseDto> {
    return await this.chatService.getChatHistory(user);
  }
}
