import { ValueTransformer } from 'typeorm';

export const oneDecimalNumberOptions = {
  allowNaN: false,
  allowInfinity: false,
  maxDecimalPlaces: 1,
};

export const roundToOneDecimal = (value: number): number =>
  Math.round(value * 10) / 10;

export const roundNullableToOneDecimal = (
  value: number | null | undefined,
): number | null => {
  if (value === null || value === undefined) {
    return null;
  }

  return roundToOneDecimal(value);
};

export const singleDecimalTransformer: ValueTransformer = {
  to: (value: number | null | undefined) => roundNullableToOneDecimal(value),
  from: (value: number | null | undefined) => roundNullableToOneDecimal(value),
};
