import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpStatus,
  UnauthorizedException,
} from '@nestjs/common';

@Catch(UnauthorizedException)
export class CustomUnauthorizedExceptionFilter implements ExceptionFilter {
  catch(exception: UnauthorizedException, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse();
    const request = ctx.getRequest();

    // 상태 코드 결정
    const status = HttpStatus.UNAUTHORIZED;

    // 기본 에러 메시지
    let message =
      exception.message == 'Unauthorized'
        ? 'No, invalid or expired accessToken'
        : exception.message || 'An unexpected error occurred';

    // 기본 응답 커스터마이징
    const customResponse = {
      message: message,
      statusCode: status,
      error: exception.name,
    };

    response.status(status).json(customResponse);
  }
}
