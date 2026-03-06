import { Reflector } from '@nestjs/core';

export const ResponseMsg = Reflector.createDecorator<string>();
