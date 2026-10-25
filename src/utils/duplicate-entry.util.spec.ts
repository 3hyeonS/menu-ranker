import { QueryFailedError } from 'typeorm';
import {
  isDuplicateEntryError,
  retryOnceOnDuplicateEntry,
} from './duplicate-entry.util';

const createDuplicateEntryError = (): QueryFailedError =>
  new QueryFailedError(
    'INSERT INTO `meal` ...',
    [],
    Object.assign(new Error("Duplicate entry '1-2026-10-25-0'"), {
      code: 'ER_DUP_ENTRY',
      errno: 1062,
    }),
  );

describe('duplicate entry util', () => {
  it('detects only MySQL duplicate-key query failures', () => {
    expect(isDuplicateEntryError(createDuplicateEntryError())).toBe(true);
    expect(
      isDuplicateEntryError(
        new QueryFailedError(
          'INSERT',
          [],
          Object.assign(new Error('Deadlock'), { code: 'ER_LOCK_DEADLOCK' }),
        ),
      ),
    ).toBe(false);
    expect(isDuplicateEntryError(new Error('ER_DUP_ENTRY'))).toBe(false);
  });

  it('runs the upsert again once after a duplicate-key race', async () => {
    const operation = jest
      .fn()
      .mockRejectedValueOnce(createDuplicateEntryError())
      .mockResolvedValueOnce('updated');

    await expect(retryOnceOnDuplicateEntry(operation)).resolves.toBe('updated');
    expect(operation).toHaveBeenCalledTimes(2);
  });

  it('rethrows other errors and a second duplicate without more retries', async () => {
    const other = jest.fn().mockRejectedValue(new Error('boom'));
    await expect(retryOnceOnDuplicateEntry(other)).rejects.toThrow('boom');
    expect(other).toHaveBeenCalledTimes(1);

    const alwaysDuplicate = jest
      .fn()
      .mockRejectedValue(createDuplicateEntryError());
    await expect(retryOnceOnDuplicateEntry(alwaysDuplicate)).rejects.toThrow(
      QueryFailedError,
    );
    expect(alwaysDuplicate).toHaveBeenCalledTimes(2);
  });
});
