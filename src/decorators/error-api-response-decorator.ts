import { applyDecorators } from '@nestjs/common';
import { ApiResponse } from '@nestjs/swagger';

export interface ErrorApiResponseOption {
  description?: string;
  status?: number;
  message?: string;
  error?: string;
}

export const ErrorApiResponse = (option: ErrorApiResponseOption) => {
  return applyDecorators(
    ApiResponse({
      status: option.status || 777,
      description: option.description || '설명 없음',
      schema: {
        properties: {
          message: {
            type: 'string',
            example: option.message,
          },
          statusCode: {
            type: 'number',
            example: option.status,
          },
          error: {
            type: 'string',
            example: option.error,
          },
        },
      },
    }),
  );
};
