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
  ApiResponse,
  ApiTags,
  getSchemaPath,
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
import { ChatMenuBoardRecommendResponseDto } from './dto/response-dto/chat-menu-board-recommend-response-dto';

@ApiTags('채팅')
@UseInterceptors(ResponseTransformInterceptor)
@ApiExtraModels(ResponseDto)
@Controller('/chat')
export class ChatController {
  constructor(private readonly chatService: ChatService) {}

  @ApiBearerAuth('accessToken')
  @ApiOperation({
    summary: '채팅형 메뉴 피드백/추천',
    description:
      '입력값을 Gemini로 피드백/추천으로 분류. 피드백은 입력 메뉴를 DB 메뉴와 매핑한 뒤 현재 유저 목표와 식사기록 기준으로 판단하고, 추천은 기존 메뉴 추천 로직을 사용',
  })
  @ApiExtraModels(ResponseDto, ChatRecommendResponseDto)
  @ApiResponse({
    status: 201,
    description: '채팅형 메뉴 추천 성공',
    content: {
      'application/json': {
        schema: {
          allOf: [
            { $ref: getSchemaPath(ResponseDto) },
            {
              properties: {
                message: {
                  type: 'string',
                  example: 'Menu recommendations generated successfully',
                },
                statusCode: {
                  type: 'number',
                  example: 201,
                },
                data: {
                  $ref: getSchemaPath(ChatRecommendResponseDto),
                },
              },
            },
          ],
        },
        examples: {
          recommendation: {
            summary: '추천으로 분류된 경우',
            value: {
              message: 'Menu recommendations generated successfully',
              statusCode: 201,
              data: {
                chat_category: 'recommendation',
                intro_message:
                  '단백질을 채우기 좋게 다이어트식으로 맘스터치에서 추천하는 메뉴를 정리해드렸어요!',
                recommendations: [
                  {
                    menu_id: 512,
                    menu_name: '그릴드 치킨 버거',
                    brand: '맘스터치',
                    unit: 0,
                    weight: 230,
                    unit_quantity: '인분',
                    calories: 412.5,
                    data_source: 0,
                    score: 84.6,
                    rank: 1,
                    one_line_summary:
                      '단백질 밀도가 높고 점심 칼로리 예산에 잘 맞는 선택입니다.',
                    recommendation_reason:
                      '목표 단백질 비중을 맞추는 데 유리하고, 당 밀도와 칼로리 밀도가 과도하지 않아 점심 한 끼로 안정적입니다.',
                  },
                ],
              },
            },
          },
          feedback: {
            summary: '피드백으로 분류된 경우',
            value: {
              message: 'Menu recommendations generated successfully',
              statusCode: 201,
              data: {
                chat_category: 'feedback',
                intro_message:
                  '감량 목표와 오늘 식사 기록을 기준으로 입력한 메뉴를 확인했어요.',
                feedback: {
                  menus: [
                    {
                      input_menu_name: '싸이버거',
                      menu_id: 1,
                      menu_name: '싸이버거',
                      brand: '맘스터치',
                      unit: 0,
                      weight: 230,
                      unit_quantity: '인분',
                      calories: 594,
                      data_source: 0,
                    },
                    {
                      input_menu_name: '콜라',
                      menu_id: 42,
                      menu_name: '콜라',
                      brand: '맘스터치',
                      unit: 1,
                      weight: 355,
                      unit_quantity: '잔',
                      calories: 150,
                      data_source: 0,
                    },
                  ],
                  total_calories: 744,
                  score: 63.2,
                  is_appropriate: false,
                  feedback_summary:
                    '먹을 수는 있지만 현재 목표 기준으로는 조금 아쉬운 조합입니다.',
                  feedback_reason:
                    '싸이버거, 콜라 조합은 감량 목표 기준 점수 63.2점입니다. 총 744kcal 조합입니다. 현재 끼니 목표 칼로리와는 차이가 있는 편입니다.',
                },
              },
            },
          },
        },
      },
    },
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
    model: ChatMenuBoardRecommendResponseDto,
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
  ): Promise<ChatMenuBoardRecommendResponseDto> {
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
