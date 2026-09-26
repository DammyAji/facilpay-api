import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
} from 'typeorm';

@Entity('merchant_settings')
@Index('idx_merchant_settings_merchant_id', ['merchantId'], { unique: true })
export class MerchantSettings {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  merchantId: string;

  @Column({ default: true })
  remindersEnabled: boolean = true;

  @Column('int', { array: true, default: [-3, 0, 7] })
  reminderOffsets: number[] = [-3, 0, 7];

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}