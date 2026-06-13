import {
  Body,
  Controller,
  Get,
  HttpException,
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
import { NullApiResponse } from '../decorators/null-api-response-decorator';
import { UserEntity } from '../auth/entity/user/user.entity';
import { ChatService } from './chat.service';
import { ChatRecommendRequestDto } from './dto/request-dto/chat-recommend-request-dto';
import { ChatMealRecordRequestDto } from './dto/request-dto/chat-meal-record-request-dto';
import { ChatMealRecordDeleteRequestDto } from './dto/request-dto/chat-meal-record-delete-request-dto';
import { ChatRecommendResponseDto } from './dto/response-dto/chat-recommend-response-dto';
import { ChatHistoryResponseDto } from './dto/response-dto/chat-history-response-dto';
import { ChatMenuBoardRecommendResponseDto } from './dto/response-dto/chat-menu-board-recommend-response-dto';
import { ChatFoodImageFeedbackResponseDto } from './dto/response-dto/chat-food-image-feedback-response-dto';
import { ChatFeedbackResponseDto } from './dto/response-dto/chat-feedback-response-dto';
import { ChatFeedbackMenuResponseDto } from './dto/response-dto/chat-feedback-menu-response-dto';

@ApiTags('채팅')
@UseInterceptors(ResponseTransformInterceptor)
@ApiExtraModels(ResponseDto)
@Controller('/chat')
export class ChatController {
  constructor(private readonly chatService: ChatService) {}

  private logChatApiError(
    context: string,
    user: UserEntity | null,
    error: unknown,
    extra: Record<string, unknown> = {},
  ): void {
    const maybeError = error as {
      name?: string;
      message?: string;
      stack?: string;
      code?: string;
      response?: {
        status?: number;
        data?: unknown;
      };
    };
    const httpStatus =
      error instanceof HttpException
        ? error.getStatus()
        : maybeError.response?.status ?? null;
    const responseBody =
      error instanceof HttpException
        ? error.getResponse()
        : maybeError.response?.data ?? null;

    console.error('[CHAT_API_ERROR]', {
      context,
      userId: user?.id ?? null,
      httpStatus,
      errorName: maybeError.name ?? null,
      errorMessage: maybeError.message ?? null,
      errorCode: maybeError.code ?? null,
      responseBody,
      stack:
        typeof maybeError.stack === 'string'
          ? maybeError.stack.split('\n').slice(0, 8).join('\n')
          : null,
      ...extra,
    });
  }

  @ApiBearerAuth('accessToken')
  @ApiOperation({
    summary: '채팅형 메뉴 피드백/추천/범용 질문',
    description:
      '입력값을 Gemini로 피드백/추천/범용 질문으로 분류. 피드백은 입력 메뉴를 DB 메뉴와 매핑한 뒤 현재 유저 목표와 식사기록 기준으로 판단하고, 추천은 기존 메뉴 추천 로직을 사용. 범용 질문은 메뉴 DB 랭킹 없이 질문에 직접 답변',
  })
  @ApiExtraModels(
    ResponseDto,
    ChatRecommendResponseDto,
    ChatFeedbackResponseDto,
    ChatFeedbackMenuResponseDto,
  )
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
                      score: 71.2,
                      is_appropriate: true,
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
                      score: 48.5,
                      is_appropriate: false,
                      data_source: 0,
                    },
                  ],
                  total_calories: 744,
                  score: 63.2,
                  is_appropriate: false,
                },
              },
            },
          },
          general: {
            summary: '범용 일반 질문으로 분류된 경우',
            value: {
              message: 'Menu recommendations generated successfully',
              statusCode: 201,
              data: {
                chat_category: 'general',
                intro_message:
                  '탄수화물 섭취 타이밍은 목표와 활동량에 맞춰 조절하는 편이 좋습니다.',
                general_answer:
                  '탄수화물은 무조건 줄이기보다 하루 활동량이 큰 시간대에 배치하는 방식이 현실적입니다. 운동을 한다면 운동 전후나 활동량이 많은 낮 시간대에 나눠 먹는 편이 컨디션 유지에 도움이 될 수 있어요.\n\n감량 중이라도 탄수화물을 완전히 끊으면 식욕이 커지거나 다음 끼니에서 과하게 먹기 쉬울 수 있습니다. 밥, 고구마, 과일처럼 양을 조절하기 쉬운 식품을 기준으로 잡고, 저녁에는 오늘 섭취 흐름에 따라 양만 조금 줄이는 식으로 접근해보세요.',
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
    try {
      return await this.chatService.recommend(user, chatRecommendRequestDto);
    } catch (error) {
      this.logChatApiError('POST /chat/recommend', user, error, {
        inputLength: chatRecommendRequestDto?.input?.length ?? null,
      });
      throw error;
    }
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
    try {
      return await this.chatService.recommendFromMenuBoard(user, file);
    } catch (error) {
      this.logChatApiError('POST /chat/menu-board', user, error, {
        fileSize: file?.size ?? null,
        mimeType: file?.mimetype ?? null,
      });
      throw error;
    }
  }

  @ApiBearerAuth('accessToken')
  @ApiOperation({
    summary: '음식 사진 기반 메뉴 피드백',
    description:
      '음식 사진에서 메뉴와 좌표를 복수 인식한 뒤 현재 유저 목표와 식사기록 기준으로 메뉴 조합 피드백을 반환',
  })
  @GenericApiResponse({
    status: 201,
    description: '음식 사진 기반 메뉴 피드백 성공',
    message: 'Food image feedback generated successfully',
    model: ChatFoodImageFeedbackResponseDto,
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
    message: 'Gemini recommendation pipeline is unavailable',
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
  @ResponseMsg('Food image feedback generated successfully')
  @UseGuards(AuthGuard())
  @UseInterceptors(FileInterceptor('image'))
  @Post('/food-image-feedback')
  async feedbackMenusFromFoodImage(
    @GetUser() user: UserEntity,
    @UploadedFile() file: Express.Multer.File,
  ): Promise<ChatFoodImageFeedbackResponseDto> {
    try {
      return await this.chatService.feedbackFromFoodImage(user, file);
    } catch (error) {
      this.logChatApiError('POST /chat/food-image-feedback', user, error, {
        fileSize: file?.size ?? null,
        mimeType: file?.mimetype ?? null,
      });
      throw error;
    }
  }

  @ApiBearerAuth('accessToken')
  @ApiOperation({
    summary: '채팅 기반 식사 기록 메타데이터 저장',
    description:
      '실제 식사 기록 저장은 home/registerMeal에서 진행하고, 이 API는 채팅 기록에 식사 기록을 진행했다는 메타데이터만 저장',
  })
  @NullApiResponse({
    status: 201,
    description: '채팅 식사 기록 메타데이터 저장 성공',
    message: 'Chat meal record saved successfully',
  })
  @ErrorApiResponse({
    status: 400,
    description: 'Bad Request  \nbody 입력값의 필드 조건 및 배열 길이 오류',
    message:
      'menu_ids, menu_quantities and menu_input_modes must have the same length',
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
    description: '본인 소유의 채팅 기록을 찾을 수 없음',
    message: 'Chat history not found',
    error: 'NotFoundException',
  })
  @ResponseMsg('Chat meal record saved successfully')
  @UseGuards(AuthGuard())
  @Post('/meal-record')
  async recordMealFromChat(
    @GetUser() user: UserEntity,
    @Body() chatMealRecordRequestDto: ChatMealRecordRequestDto,
  ): Promise<void> {
    await this.chatService.recordMealFromChat(user, chatMealRecordRequestDto);
  }

  @ApiBearerAuth('accessToken')
  @ApiOperation({
    summary: '채팅 기반 식사 기록 메타데이터 삭제',
    description:
      '해당 채팅 기록의 meal_record를 null로 변경합니다. 실제 meal DB 기록은 삭제하지 않습니다.',
  })
  @NullApiResponse({
    status: 200,
    description: '채팅 식사 기록 메타데이터 삭제 성공',
    message: 'Chat meal record deleted successfully',
  })
  @ErrorApiResponse({
    status: 400,
    description: 'Bad Request  \nbody 입력값의 필드 조건 오류',
    message: 'chat_id must be a number',
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
    description: '본인 소유의 채팅 기록을 찾을 수 없음',
    message: 'Chat history not found',
    error: 'NotFoundException',
  })
  @ResponseMsg('Chat meal record deleted successfully')
  @UseGuards(AuthGuard())
  @Post('/meal-record/delete')
  async deleteMealRecordFromChat(
    @GetUser() user: UserEntity,
    @Body() chatMealRecordDeleteRequestDto: ChatMealRecordDeleteRequestDto,
  ): Promise<void> {
    await this.chatService.deleteMealRecordFromChat(
      user,
      chatMealRecordDeleteRequestDto,
    );
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
