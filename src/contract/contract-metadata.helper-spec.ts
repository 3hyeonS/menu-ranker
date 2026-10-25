import { RequestMethod, Type } from '@nestjs/common';
import {
  CUSTOM_ROUTE_ARGS_METADATA,
  EXCEPTION_FILTERS_METADATA,
  GUARDS_METADATA,
  HTTP_CODE_METADATA,
  INTERCEPTORS_METADATA,
  METHOD_METADATA,
  MODULE_METADATA,
  PATH_METADATA,
  ROUTE_ARGS_METADATA,
} from '@nestjs/common/constants';
import { RouteParamtypes } from '@nestjs/common/enums/route-paramtypes.enum';
import { AuthGuard } from '@nestjs/passport';
import { getMetadataStorage, ValidationTypes } from 'class-validator';
import { defaultMetadataStorage } from 'class-transformer/cjs/storage';
import { TransformationType } from 'class-transformer';
import { OptionalAuthGuard } from '../auth/custom-option.guard';
import { RolesGuard } from '../auth/custom-role.guard';
import { ROLES_KEY } from '../decorators/roles-decorator';
import { ResponseMsg } from '../decorators/response-message-decorator';
import { GetUser } from '../decorators/get-user-decorator';
import { GetOptionalUser } from '../decorators/get-optional-user-decorator';

// 계약 스냅샷 테스트(src/contract/*.spec.ts)가 공유하는 Nest·class-validator 메타데이터 해석기.
// 파일명이 `-spec.ts`로 끝나 tsconfig.build.json의 `**/*spec.ts` 제외에 걸려 dist에 포함되지 않고,
// `.spec.ts`가 아니라 jest 테스트로 실행되지도 않는다.
// DB나 Nest 앱을 띄우지 않고 데코레이터가 남긴 Reflect 메타데이터만 읽는다.

export type RouteContract = {
  handler: string;
  method: string;
  path: string;
  status: number;
  responseMessage: string | null;
  guards: string[];
  roles: string[] | null;
  interceptors: string[];
  filters: string[];
  params: string[];
};

export type DtoPropertyContract = {
  designType: string;
  transformType: string | null;
  hasTransform: boolean;
  validators: string[];
};

export type DtoContract = Record<string, DtoPropertyContract>;

/** 모듈 imports를 따라가며 AppModule에 등록된 모든 컨트롤러를 모은다. */
export function collectControllers(rootModule: Type<unknown>): Type<unknown>[] {
  const controllers = new Set<Type<unknown>>();
  const visited = new Set<unknown>();

  const visit = (moduleRef: any) => {
    if (!moduleRef || visited.has(moduleRef)) return;
    visited.add(moduleRef);

    // forRoot()·register() 같은 동적 모듈은 { module, controllers, imports } 객체다.
    const moduleClass = moduleRef.module ?? moduleRef;
    const ownControllers =
      Reflect.getMetadata(MODULE_METADATA.CONTROLLERS, moduleClass) ?? [];
    const imports =
      Reflect.getMetadata(MODULE_METADATA.IMPORTS, moduleClass) ?? [];

    [...ownControllers, ...(moduleRef.controllers ?? [])].forEach((c) =>
      controllers.add(c),
    );
    [...imports, ...(moduleRef.imports ?? [])].forEach(visit);
  };

  visit(rootModule);
  return [...controllers];
}

const KNOWN_GUARDS = new Map<unknown, string>([
  [AuthGuard(), 'AuthGuard()'],
  [AuthGuard('jwt'), "AuthGuard('jwt')"],
  [AuthGuard('kakao'), "AuthGuard('kakao')"],
  [AuthGuard('apple'), "AuthGuard('apple')"],
  [RolesGuard, 'RolesGuard'],
  [OptionalAuthGuard, 'OptionalAuthGuard'],
]);

function describeEnhancer(enhancer: any): string {
  if (KNOWN_GUARDS.has(enhancer)) return KNOWN_GUARDS.get(enhancer);
  if (typeof enhancer === 'function') {
    const fileField = probeFileInterceptorField(enhancer);
    if (fileField) return `FileInterceptor('${fileField}')`;
    // mixin()으로 만든 클래스는 이름이 실행마다 바뀌는 임의 문자열이라 스냅샷에 넣지 않는다.
    return isMixinName(enhancer.name) ? '[mixin]' : enhancer.name;
  }
  return `instance:${enhancer?.constructor?.name ?? typeof enhancer}`;
}

function isMixinName(name: string): boolean {
  return !name || /^[0-9a-f]{16,}$/.test(name);
}

/**
 * FileInterceptor(field)는 필드명을 클로저에만 들고 있어 메타데이터로 읽을 수 없다.
 * 인스턴스의 multer를 가짜로 바꿔 intercept가 요청하는 필드명을 받아 온다.
 */
function probeFileInterceptorField(enhancer: any): string | null {
  if (typeof enhancer.prototype?.intercept !== 'function') return null;
  let fieldName: string | null = null;
  let instance: any;
  try {
    instance = new enhancer();
  } catch {
    return null;
  }
  if (!('multer' in instance)) return null;
  instance.multer = {
    single: (name: string) => {
      fieldName = name;
      return (_req, _res, done) => done();
    },
  };
  instance.intercept(
    {
      switchToHttp: () => ({ getRequest: () => ({}), getResponse: () => ({}) }),
    },
    { handle: () => undefined },
  );
  return fieldName;
}

// createParamDecorator는 실행할 때마다 임의 키를 만들므로 factory 함수로 식별한다.
const CUSTOM_PARAM_NAMES = new Map<unknown, string>();
for (const [name, decorator] of [
  ['GetUser', GetUser],
  ['GetOptionalUser', GetOptionalUser],
] as const) {
  class Probe {
    handler(@decorator() value: unknown) {
      return value;
    }
  }
  const args = Reflect.getMetadata(ROUTE_ARGS_METADATA, Probe, 'handler');
  for (const arg of Object.values<any>(args)) {
    CUSTOM_PARAM_NAMES.set(arg.factory, name);
  }
}

function describeParams(controller: Type<unknown>, handler: string): string[] {
  const args =
    Reflect.getMetadata(ROUTE_ARGS_METADATA, controller, handler) ?? {};
  const paramTypes: any[] =
    Reflect.getMetadata('design:paramtypes', controller.prototype, handler) ??
    [];

  return Object.entries<any>(args)
    .map(([key, arg]) => {
      const [paramtype] = key.split(':');
      const kind = paramtype.includes(CUSTOM_ROUTE_ARGS_METADATA)
        ? `@${CUSTOM_PARAM_NAMES.get(arg.factory) ?? 'CustomParam'}`
        : `@${toPascalCase(RouteParamtypes[Number(paramtype)])}`;
      const data = arg.data === undefined ? '' : `'${arg.data}'`;
      const typeName = paramTypes[arg.index]?.name ?? 'unknown';
      return {
        index: arg.index,
        text: `${arg.index}: ${kind}(${data}) ${typeName}`,
      };
    })
    .sort((a, b) => a.index - b.index)
    .map((p) => p.text);
}

function toPascalCase(name: string): string {
  return name.charAt(0) + name.slice(1).toLowerCase();
}

function joinPath(...parts: string[]): string {
  const joined = parts
    .flatMap((p) => p.split('/'))
    .filter(Boolean)
    .join('/');
  return `/${joined}`;
}

export function describeRoutes(controller: Type<unknown>): RouteContract[] {
  const basePath: string = Reflect.getMetadata(PATH_METADATA, controller) ?? '';
  const classGuards = Reflect.getMetadata(GUARDS_METADATA, controller) ?? [];
  const classInterceptors =
    Reflect.getMetadata(INTERCEPTORS_METADATA, controller) ?? [];
  const classFilters =
    Reflect.getMetadata(EXCEPTION_FILTERS_METADATA, controller) ?? [];

  return Object.getOwnPropertyNames(controller.prototype)
    .filter((name) => name !== 'constructor')
    .filter((name) => {
      const fn = controller.prototype[name];
      return typeof fn === 'function' && Reflect.hasMetadata(PATH_METADATA, fn);
    })
    .map((handler) => {
      const fn = controller.prototype[handler];
      const method: RequestMethod = Reflect.getMetadata(METHOD_METADATA, fn);
      const methodGuards = Reflect.getMetadata(GUARDS_METADATA, fn) ?? [];
      const methodInterceptors =
        Reflect.getMetadata(INTERCEPTORS_METADATA, fn) ?? [];
      const methodFilters =
        Reflect.getMetadata(EXCEPTION_FILTERS_METADATA, fn) ?? [];
      const defaultStatus = method === RequestMethod.POST ? 201 : 200;
      const roles =
        Reflect.getMetadata(ROLES_KEY, fn) ??
        Reflect.getMetadata(ROLES_KEY, controller) ??
        null;

      return {
        handler,
        method: RequestMethod[method],
        path: joinPath(basePath, Reflect.getMetadata(PATH_METADATA, fn)),
        status: Reflect.getMetadata(HTTP_CODE_METADATA, fn) ?? defaultStatus,
        responseMessage: Reflect.getMetadata(ResponseMsg.KEY, fn) ?? null,
        // Nest는 class → method 순서로 guard·interceptor를 실행한다.
        guards: [...classGuards, ...methodGuards].map(describeEnhancer),
        roles,
        interceptors: [...classInterceptors, ...methodInterceptors].map(
          describeEnhancer,
        ),
        filters: [...classFilters, ...methodFilters].map(describeEnhancer),
        params: describeParams(controller, handler),
      };
    });
}

/** 라우트의 @Body·@Query·@Param 인자로 쓰이는 DTO 클래스를 모은다. */
export function collectRequestDtos(
  controllers: Type<unknown>[],
): Type<unknown>[] {
  const dtos = new Set<Type<unknown>>();
  const inputKinds = [
    RouteParamtypes.BODY,
    RouteParamtypes.QUERY,
    RouteParamtypes.PARAM,
  ].map(String);

  for (const controller of controllers) {
    for (const handler of Object.getOwnPropertyNames(controller.prototype)) {
      const args =
        Reflect.getMetadata(ROUTE_ARGS_METADATA, controller, handler) ?? {};
      const paramTypes: any[] =
        Reflect.getMetadata(
          'design:paramtypes',
          controller.prototype,
          handler,
        ) ?? [];
      for (const [key, arg] of Object.entries<any>(args)) {
        if (!inputKinds.includes(key.split(':')[0])) continue;
        const type = paramTypes[arg.index];
        if (isUserClass(type)) dtos.add(type);
      }
    }
  }
  return [...dtos];
}

const PRIMITIVE_TYPES = new Set<unknown>([
  String,
  Number,
  Boolean,
  Object,
  Array,
  Date,
]);

function isUserClass(type: unknown): type is Type<unknown> {
  return typeof type === 'function' && !PRIMITIVE_TYPES.has(type);
}

function serialize(value: unknown): unknown {
  if (typeof value === 'function') return `[Function ${value.name || ''}]`;
  if (value instanceof RegExp) return value.toString();
  if (Array.isArray(value)) return value.map(serialize);
  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value).map(([k, v]) => [k, serialize(v)]),
    );
  }
  return value;
}

function describeValidator(meta: any): string {
  // @IsOptional은 conditionalValidation에 name만 붙여 등록되고, @ValidateIf는 name이 없다.
  const name =
    meta.name ??
    (meta.type === ValidationTypes.CUSTOM_VALIDATION
      ? (getMetadataStorage().getTargetValidatorConstraints(
          meta.constraintCls,
        )[0]?.name ?? 'customValidation')
      : meta.type);
  const parts = [name];
  if (meta.constraints?.length && name !== 'isOptional') {
    parts.push(JSON.stringify(serialize(meta.constraints)));
  }
  if (meta.each) parts.push('each');
  if (meta.message)
    parts.push(`message=${JSON.stringify(serialize(meta.message))}`);
  if (meta.groups?.length) parts.push(`groups=${meta.groups.join(',')}`);
  return parts.join(' ');
}

/**
 * DTO 하나의 필드별 계약. 전역 ValidationPipe가 whitelist·forbidNonWhitelisted라
 * validation 데코레이터가 없는 필드는 요청에서 거부된다. 그래서 validator 목록이 곧 허용 필드 목록이다.
 */
export function describeDto(dto: Type<unknown>): DtoContract {
  const metadatas = getMetadataStorage().getTargetValidationMetadatas(
    dto,
    '',
    true,
    false,
  );
  const properties = [...new Set(metadatas.map((m) => m.propertyName))].sort();

  return Object.fromEntries(
    properties.map((property) => {
      const designType = Reflect.getMetadata(
        'design:type',
        dto.prototype,
        property,
      );
      const typeMeta = defaultMetadataStorage.findTypeMetadata(dto, property);
      const transforms = defaultMetadataStorage.findTransformMetadatas(
        dto,
        property,
        TransformationType.PLAIN_TO_CLASS,
      );
      return [
        property,
        {
          designType: designType?.name ?? 'unknown',
          transformType: typeMeta
            ? (typeMeta.typeFunction()?.name ?? null)
            : null,
          hasTransform: transforms.length > 0,
          validators: metadatas
            .filter((m) => m.propertyName === property)
            .map(describeValidator)
            .sort(),
        },
      ];
    }),
  );
}

/** @Type(() => Nested)로 연결된 중첩 DTO까지 포함한 DTO 목록. */
export function expandNestedDtos(dtos: Type<unknown>[]): Type<unknown>[] {
  const result = new Set<Type<unknown>>();
  const visit = (dto: Type<unknown>) => {
    if (result.has(dto)) return;
    result.add(dto);
    const metadatas = getMetadataStorage().getTargetValidationMetadatas(
      dto,
      '',
      true,
      false,
    );
    for (const property of new Set(metadatas.map((m) => m.propertyName))) {
      const nested = defaultMetadataStorage
        .findTypeMetadata(dto, property)
        ?.typeFunction();
      if (isUserClass(nested)) visit(nested);
    }
  };
  dtos.forEach(visit);
  return [...result];
}
