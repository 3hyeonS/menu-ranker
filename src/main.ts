import * as dotenv from 'dotenv';
dotenv.config({ override: true });
// .env 파일 로드

import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import {
  SwaggerModule,
  DocumentBuilder,
  SwaggerCustomOptions,
} from '@nestjs/swagger';
import { LoggingInterceptor } from './interceptors/logging-interceptor';
import { ValidationPipe } from '@nestjs/common';
// import * as cookieParser from 'cookie-parser';
import { SwaggerTheme, SwaggerThemeNameEnum } from 'swagger-themes';
import { CustomHttpExceptionFilter } from './interceptors/custom-httpException-filter';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  const config = new DocumentBuilder()
    .setTitle('VILLAGE API')
    .setDescription(
      'Menu Ranker API 문서입니다.  \nstatusCode 500은 에러는 서버 에러 -> 에러 내용과 함께 백엔드와 공유',
    )
    .setVersion('1.0')
    // .addTag('gyms')
    .addBearerAuth(
      {
        type: 'http',
        scheme: 'bearer',
        bearerFormat: 'JWT',
        name: 'JWT',
        description: 'Enter JWT token',
        in: 'header',
      },
      'accessToken',
    )
    // .setTermsOfService('사이트 주소')
    // .setContact('담당자', '사이트 주소', '이메일 주소')
    // .setLicense('라이센스명', '사이트 주소')
    // .addServer('http://13.209.47.246:3000/', 'production')
    .build();

  const documentFactory = () => SwaggerModule.createDocument(app, config);
  const theme = new SwaggerTheme();
  let themeColor;
  if (process.env.IP == 'localhost') {
    themeColor = SwaggerThemeNameEnum.DARK;
  } else {
    themeColor = SwaggerThemeNameEnum.CLASSIC;
  }

  const customCss =
    theme.getBuffer(themeColor) +
    `
    .renderedMarkdown p,
    .renderedMarkdown pre,
    div.prop-format {
      white-space: pre-line !important;
    }
  `;
  const myCustom: SwaggerCustomOptions = {
    customCss,
    swaggerOptions: {
      docExpansion: 'none',
      apisSorter: 'alpha',
    },
  };

  SwaggerModule.setup('api', app, documentFactory, myCustom);

  app.useGlobalInterceptors(new LoggingInterceptor());
  //글로벌 HttpException 필터 등록
  app.useGlobalFilters(new CustomHttpExceptionFilter());

  // 글로벌 ValidationPipe 설정
  app.useGlobalPipes(
    new ValidationPipe({
      transform: true,
      whitelist: true,
      forbidNonWhitelisted: true,
    }),
  );

  // // cookie parser 미들웨어 추가
  // app.use(cookieParser());

  // const whitelist = ['http://localhost:3000/'];
  app.enableCors();

  await app.listen(process.env.PORT ?? 3000);
}
bootstrap();
