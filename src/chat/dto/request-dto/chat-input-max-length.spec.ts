import { BadRequestException, ValidationPipe } from '@nestjs/common';
import { ChatRecommendRequestDto } from './chat-recommend-request-dto';
import { ChatMealRecordParseRequestDto } from './chat-meal-record-parse-request-dto';

// main.ts의 전역 ValidationPipe와 같은 옵션
const pipe = new ValidationPipe({
  transform: true,
  whitelist: true,
  forbidNonWhitelisted: true,
});

describe('chat input max length (chat_history.input_text varchar(1000))', () => {
  it.each([
    [ChatRecommendRequestDto, 'input'],
    [ChatMealRecordParseRequestDto, 'text'],
  ])(
    '%p accepts 1000 chars and rejects 1001 chars with the usual 400',
    async (metatype, field) => {
      await expect(
        pipe.transform(
          { [field]: 'a'.repeat(1000) },
          { type: 'body', metatype },
        ),
      ).resolves.toBeInstanceOf(metatype);

      const error = await pipe
        .transform({ [field]: 'a'.repeat(1001) }, { type: 'body', metatype })
        .catch((caught) => caught);

      expect(error).toBeInstanceOf(BadRequestException);
      expect(error.getStatus()).toBe(400);
      expect(error.getResponse()).toEqual({
        statusCode: 400,
        error: 'Bad Request',
        message: [`${field} must be shorter than or equal to 1000 characters`],
      });
    },
  );
});
