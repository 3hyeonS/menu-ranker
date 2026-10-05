import { CallHandler, ExecutionContext } from '@nestjs/common';
import { EventEmitter } from 'events';
import { of } from 'rxjs';
import { LoggingInterceptor } from './logging-interceptor';

describe('LoggingInterceptor', () => {
  let consoleLogSpy: jest.SpyInstance;

  beforeEach(() => {
    consoleLogSpy = jest.spyOn(console, 'log').mockImplementation();
  });

  afterEach(() => {
    consoleLogSpy.mockRestore();
  });

  function createHttpContext() {
    const req = Object.assign(new EventEmitter(), {
      path: '/chat/recommend',
      originalUrl: '/chat/recommend?secret=value',
      method: 'POST',
      headers: {},
      user: { id: 101 },
      requestId: undefined as string | undefined,
    });
    const res = Object.assign(new EventEmitter(), {
      statusCode: 201,
      headersSent: false,
      setHeader: jest.fn(),
    });
    const context = {
      switchToHttp: () => ({
        getRequest: () => req,
        getResponse: () => res,
      }),
    } as unknown as ExecutionContext;
    const next = { handle: () => of({ ok: true }) } as CallHandler;

    return { req, res, context, next };
  }

  it('logs start and completion with the same request ID', () => {
    const { req, res, context, next } = createHttpContext();
    const interceptor = new LoggingInterceptor();

    interceptor.intercept(context, next).subscribe();
    res.emit('finish');

    const startLog = consoleLogSpy.mock.calls[0][1];
    const completionLog = consoleLogSpy.mock.calls[1][1];

    expect(startLog).toMatchObject({
      event: 'request.started',
      userId: 101,
      method: 'POST',
      path: '/chat/recommend',
    });
    expect(completionLog).toMatchObject({
      event: 'request.completed',
      requestId: startLog.requestId,
      userId: 101,
      statusCode: 201,
    });
    expect(req.requestId).toBe(startLog.requestId);
    expect(res.setHeader).toHaveBeenCalledWith(
      'x-request-id',
      startLog.requestId,
    );
  });

  it('logs an aborted request only once', () => {
    const { req, res, context, next } = createHttpContext();
    const interceptor = new LoggingInterceptor();

    interceptor.intercept(context, next).subscribe();
    req.emit('aborted');
    res.emit('close');

    const requestLogs = consoleLogSpy.mock.calls.map((call) => call[1]);
    expect(requestLogs).toHaveLength(2);
    expect(requestLogs[1]).toMatchObject({
      event: 'request.aborted',
      requestId: requestLogs[0].requestId,
      userId: 101,
      source: 'request.aborted',
    });
  });
});
