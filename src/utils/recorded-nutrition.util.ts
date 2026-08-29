export const getRecordedWeightMultiplier = (
  quantity: number | null | undefined,
  referenceWeight: number | null | undefined,
): number => {
  const normalizedQuantity = Number(quantity);
  const normalizedReferenceWeight = Number(referenceWeight);

  if (
    !Number.isFinite(normalizedQuantity) ||
    normalizedQuantity <= 0 ||
    !Number.isFinite(normalizedReferenceWeight) ||
    normalizedReferenceWeight <= 0
  ) {
    return 0;
  }

  return normalizedQuantity / normalizedReferenceWeight;
};
