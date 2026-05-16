import { UserEntity } from '../../auth/entity/user/user.entity';
import {
  Column,
  CreateDateColumn,
  Entity,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';

export type ChatMealRecord = {
  time: number;
  menu_ids: number[];
  menu_quantities: number[];
  menu_input_modes: number[];
};

@Entity('chat_history')
export class ChatHistoryEntity {
  @PrimaryGeneratedColumn({ type: 'int', name: 'id' })
  id: number;

  @Column({ type: 'varchar', name: 'input_text', length: 1000, nullable: false })
  input_text: string;

  @Column({ type: 'json', name: 'response_payload', nullable: false })
  response_payload: Record<string, any>;

  @Column({ type: 'json', name: 'meal_record', nullable: true })
  meal_record: ChatMealRecord | null;

  @CreateDateColumn({
    type: 'datetime',
    name: 'createdAt',
    nullable: false,
  })
  createdAt: Date;

  @ManyToOne(() => UserEntity, (user) => user.chat_histories, {
    eager: true,
    nullable: false,
    onUpdate: 'CASCADE',
    onDelete: 'CASCADE',
  })
  user: UserEntity;
}
