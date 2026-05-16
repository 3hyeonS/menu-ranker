import { applyDecorators } from '@nestjs/common';
import { ApiResponse } from '@nestjs/swagger';

export interface ErrorApiResponseOption {
  description?: string;
  status?: number;
  message?: string;
  error?: string;
  examples?: Record<
    string,
    {
      summary?: string;
      value: {
        message: string;
        statusCode: number;
        error: string;
      };
    }
  >;
}

export const ErrorApiResponse = (option: ErrorApiResponseOption) => {
  return applyDecorators(
    ApiResponse({
      status: option.status || 777,
      description: option.description || '설명 없음',
      content: option.examples
        ? {
            'application/json': {
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
              examples: option.examples,
            },
          }
        : undefined,
      schema: option.examples
        ? undefined
        : {
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
