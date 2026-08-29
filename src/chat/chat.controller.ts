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
  ApiTags,
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
import { ChatMealRecordParseRequestDto } from './dto/request-dto/chat-meal-record-parse-request-dto';
import { ChatMealRecordDeleteRequestDto } from './dto/request-dto/chat-meal-record-delete-request-dto';
import { ChatUserMenuSearchRequestDto } from './dto/request-dto/chat-user-menu-search-request-dto';
import { ChatNutritionLabelMenuRegisterRequestDto } from './dto/request-dto/chat-nutrition-label-menu-register-request-dto';
import { ChatRecommendResponseDto } from './dto/response-dto/chat-recommend-response-dto';
import { ChatHistoryResponseDto } from './dto/response-dto/chat-history-response-dto';
import { ChatMenuBoardRecommendResponseDto } from './dto/response-dto/chat-menu-board-recommend-response-dto';
import { ChatFoodImageFeedbackResponseDto } from './dto/response-dto/chat-food-image-feedback-response-dto';
import { ChatNutritionLabelFeedbackResponseDto } from './dto/response-dto/chat-nutrition-label-feedback-response-dto';
import { ChatNutritionLabelMenuRegisterResponseDto } from './dto/response-dto/chat-nutrition-label-menu-register-response-dto';
import { ChatMealRecordParseResponseDto } from './dto/response-dto/chat-meal-record-parse-response-dto';
import { ChatUserMenuSearchResponseDto } from './dto/response-dto/chat-user-menu-search-response-dto';

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
        : (maybeError.response?.status ?? null);
    const responseBody =
      error instanceof HttpException
        ? error.getResponse()
        : (maybeError.response?.data ?? null);

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
    summary: '과거 대화 맥락 기반 Gemini 채팅',
    description:
      '사용자 프로필, 최근 3일 식단·운동 기록, 최근 대화, 이전 세션 요약과 장기 대화 기억을 Gemini에 전달하고 텍스트 답변을 그대로 반환합니다. 메뉴 분류, 추천 카드 및 서버 후처리는 수행하지 않습니다.',
  })
  @GenericApiResponse({
    status: 201,
    description: 'Gemini 채팅 답변 생성 성공',
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
    summary: '영양성분표 사진 기반 피드백',
    description:
      '영양성분표 사진에서 영양성분 값을 인식한 뒤 현재 유저 목표와 식사기록 기준으로 피드백을 반환',
  })
  @GenericApiResponse({
    status: 201,
    description: '영양성분표 사진 기반 피드백 성공',
    message: 'Nutrition label feedback generated successfully',
    model: ChatNutritionLabelFeedbackResponseDto,
  })
  @ErrorApiResponse({
    status: 400,
    description: 'Bad Request  \nimage 파일 누락 또는 잘못된 형식',
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
    description: '영양성분표 이미지 업로드',
    schema: {
      type: 'object',
      properties: {
        image: {
          type: 'string',
          format: 'binary',
          description: '영양성분표 사진 파일',
        },
      },
      required: ['image'],
    },
  })
  @ResponseMsg('Nutrition label feedback generated successfully')
  @UseGuards(AuthGuard())
  @UseInterceptors(FileInterceptor('image'))
  @Post('/nutrition-label-feedback')
  async feedbackFromNutritionLabel(
    @GetUser() user: UserEntity,
    @UploadedFile() file: Express.Multer.File,
  ): Promise<ChatNutritionLabelFeedbackResponseDto> {
    try {
      return await this.chatService.feedbackFromNutritionLabel(user, file);
    } catch (error) {
      this.logChatApiError('POST /chat/nutrition-label-feedback', user, error, {
        fileSize: file?.size ?? null,
        mimeType: file?.mimetype ?? null,
      });
      throw error;
    }
  }

  @ApiBearerAuth('accessToken')
  @ApiOperation({
    summary: '영양성분표 인식값 기반 개인 메뉴 등록',
    description:
      '사용자가 입력한 메뉴명, 선택 입력한 브랜드명, 인식된 영양성분값으로 개인 메뉴를 등록',
  })
  @GenericApiResponse({
    status: 201,
    description: '영양성분표 기반 개인 메뉴 등록 성공',
    message: 'Nutrition label menu registered successfully',
    model: ChatNutritionLabelMenuRegisterResponseDto,
  })
  @ErrorApiResponse({
    status: 400,
    description: 'Bad Request  \n메뉴명 누락 또는 영양성분 필드 오류',
    message: 'name must not be empty',
    error: 'BadRequestException',
  })
  @ErrorApiResponse({
    status: 401,
    description: '유효하지 않거나 기간이 만료된 accessToken',
    message: 'Invalid or expired accessToken',
    error: 'UnauthorizedException',
  })
  @ResponseMsg('Nutrition label menu registered successfully')
  @UseGuards(AuthGuard())
  @Post('/nutrition-label-feedback/register-menu')
  async registerNutritionLabelMenu(
    @GetUser() user: UserEntity,
    @Body() dto: ChatNutritionLabelMenuRegisterRequestDto,
  ): Promise<ChatNutritionLabelMenuRegisterResponseDto> {
    try {
      return await this.chatService.registerNutritionLabelMenu(user, dto);
    } catch (error) {
      this.logChatApiError(
        'POST /chat/nutrition-label-feedback/register-menu',
        user,
        error,
        {
          name: dto?.name ?? null,
          brand: dto?.brand ?? null,
        },
      );
      throw error;
    }
  }

  @ApiBearerAuth('accessToken')
  @ApiOperation({
    summary: '채팅 텍스트 기반 식사 기록 후보 생성',
    description:
      '사용자 입력을 Gemini로 음식명과 중량(g)으로 정제한 뒤 DB 메뉴와 매칭하여 기록 후보를 반환합니다. 입력에 끼니/날짜 정보가 명시된 경우 time/date도 함께 반환합니다.',
  })
  @GenericApiResponse({
    status: 201,
    description: '채팅 텍스트 기반 식사 기록 후보 생성 성공',
    message: 'Chat meal record candidates parsed successfully',
    model: ChatMealRecordParseResponseDto,
  })
  @ErrorApiResponse({
    status: 400,
    description: 'Bad Request  \nbody 입력값의 필드 조건 오류',
    message: 'text should not be empty',
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
    message: 'Gemini meal record parsing pipeline is unavailable',
    error: 'ServiceUnavailableException',
  })
  @ResponseMsg('Chat meal record candidates parsed successfully')
  @UseGuards(AuthGuard())
  // 텍스트 채팅에서 식사 기록 모드를 선택한 경우 후보 카드를 생성합니다.
  @Post('/meal-record/parse')
  async parseMealRecordFromChatText(
    @GetUser() user: UserEntity,
    @Body() dto: ChatMealRecordParseRequestDto,
  ): Promise<ChatMealRecordParseResponseDto> {
    try {
      return await this.chatService.parseMealRecordFromChatText(user, dto);
    } catch (error) {
      this.logChatApiError('POST /chat/meal-record/parse', user, error, {
        inputLength: dto?.text?.length ?? null,
      });
      throw error;
    }
  }

  @ApiBearerAuth('accessToken')
  @ApiOperation({
    summary: '채팅용 사용자 메뉴 검색',
    description:
      '채팅 탭에서 사용자가 자주 먹었던 메뉴 또는 직접 등록한 개인용 메뉴 중에서만 메뉴명을 검색합니다.',
  })
  @GenericApiResponse({
    status: 201,
    description: '채팅용 사용자 메뉴 검색 성공',
    message: 'Chat user menu search completed successfully',
    model: ChatUserMenuSearchResponseDto,
  })
  @ErrorApiResponse({
    status: 400,
    description: 'Bad Request  \nbody 입력값의 필드 조건 오류',
    message: 'text should not be empty',
    error: 'BadRequestException',
  })
  @ErrorApiResponse({
    status: 401,
    description: '유효하지 않거나 기간이 만료된 accessToken',
    message: 'Invalid or expired accessToken',
    error: 'UnauthorizedException',
  })
  @ResponseMsg('Chat user menu search completed successfully')
  @UseGuards(AuthGuard())
  // 사진 식사 기록에서 인식 메뉴를 수정하거나 교체할 때 사용합니다.
  @Post('/menu/search')
  async searchUserMenusForChat(
    @GetUser() user: UserEntity,
    @Body() dto: ChatUserMenuSearchRequestDto,
  ): Promise<ChatUserMenuSearchResponseDto> {
    try {
      return await this.chatService.searchUserMenusForChat(user, dto);
    } catch (error) {
      this.logChatApiError('POST /chat/menu/search', user, error, {
        inputLength: dto?.text?.length ?? null,
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
  // 음식 사진 채팅의 식사 기록 확정 메타데이터 저장 API입니다.
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
  // 음식 사진 채팅의 식사 기록 확정 메타데이터 취소 API입니다.
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
