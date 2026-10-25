import { getMetadataArgsStorage } from 'typeorm';
import { MealEntity } from './entity/meal.entity';
import { WeightStepsEntity } from './entity/weight-steps.entity';
import { WorkoutRecordEntity } from './entity/workout-record.entity';
import { AddRecordUniqueConstraints1783710000000 } from '../migrations/1783710000000-AddRecordUniqueConstraints';

describe('record UNIQUE constraints', () => {
  it.each([
    [MealEntity, 'UQ_meal_user_date_time', ['user', 'date', 'time']],
    [WeightStepsEntity, 'UQ_weight_steps_user_date', ['user', 'date']],
    [
      WorkoutRecordEntity,
      'IDX_workout_record_user_date_workout',
      ['user', 'date', 'workout'],
    ],
  ])('%p declares the unique index %s', (target, name, columns) => {
    const index = getMetadataArgsStorage().indices.find(
      (item) => item.target === target && item.name === name,
    );

    expect(index).toEqual(expect.objectContaining({ unique: true, columns }));
  });

  function createQueryRunner(workoutIndexCount: number) {
    return {
      query: jest.fn(async (sql: string) =>
        sql.includes('information_schema.statistics')
          ? [{ count: workoutIndexCount }]
          : undefined,
      ),
    };
  }

  it('adds meal and weight_steps unique indexes and skips the existing workout_record index', async () => {
    const queryRunner = createQueryRunner(1);

    await new AddRecordUniqueConstraints1783710000000().up(queryRunner as any);

    const statements = queryRunner.query.mock.calls.map((call) => call[0]);
    expect(statements).toEqual([
      'ALTER TABLE `meal` ADD UNIQUE INDEX `UQ_meal_user_date_time` (`userId`, `date`, `time`)',
      'ALTER TABLE `weight_steps` ADD UNIQUE INDEX `UQ_weight_steps_user_date` (`userId`, `date`)',
      expect.stringContaining('information_schema.statistics'),
    ]);
  });

  it('creates the workout_record unique index only when it is missing', async () => {
    const queryRunner = createQueryRunner(0);

    await new AddRecordUniqueConstraints1783710000000().up(queryRunner as any);

    expect(queryRunner.query).toHaveBeenLastCalledWith(
      'ALTER TABLE `workout_record` ADD UNIQUE INDEX `IDX_workout_record_user_date_workout` (`userId`, `date`, `workoutId`)',
    );
  });

  it('keeps a userId index for the foreign keys when reverting', async () => {
    const queryRunner = createQueryRunner(1);

    await new AddRecordUniqueConstraints1783710000000().down(
      queryRunner as any,
    );

    expect(queryRunner.query.mock.calls.map((call) => call[0])).toEqual([
      'ALTER TABLE `weight_steps` ADD INDEX `IDX_weight_steps_user` (`userId`), DROP INDEX `UQ_weight_steps_user_date`',
      'ALTER TABLE `meal` ADD INDEX `IDX_meal_user` (`userId`), DROP INDEX `UQ_meal_user_date_time`',
    ]);
  });
});
