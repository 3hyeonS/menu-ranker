import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import { isRequestCancellationError } from '../utils/request-abort.util';

@Catch()
export class CustomHttpExceptionFilter implements ExceptionFilter {
  catch(exception: any, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse();
    const request = ctx.getRequest();

    // 클라이언트가 연결을 끊은 요청에는 더 이상 오류 응답을 쓰지 않는다.
    if (
      isRequestCancellationError(exception) ||
      request?.aborted === true ||
      response?.destroyed === true ||
      response?.writableEnded === true
    ) {
      return;
    }

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
