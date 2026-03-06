import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
  HttpStatus,
} from '@nestjs/common';

@Catch()
export class CustomHttpExceptionFilter implements ExceptionFilter {
  catch(exception: any, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse();
    const request = ctx.getRequest();

    // 상태 코드 결정
    const status =
      exception instanceof HttpException
        ? exception.getStatus()
        : HttpStatus.INTERNAL_SERVER_ERROR;

    // 기본 에러 메시지
    let message =
      exception instanceof HttpException
        ? exception.getResponse()['message']
        : exception.message || 'An unexpected error occurred';

    // 기본 응답 커스터마이징
    const customResponse = {
      message: message, // 배열로 처리
      statusCode: status,
      error: exception.name || 'Error',
    };

    response.status(status).json(customResponse);
  }
}
