import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
} from 'typeorm';

// Slug blocklist - reserved words that cannot be used as payment link slugs
export const RESERVED_SLUGS = new Set([
  'admin', 'api', 'login', 'logout', 'register', 'signup', 'signin',
  'password', 'reset', 'verify', 'confirm', 'email', 'webhook',
  'v1', 'v2', 'v3', 'payment', 'payments', 'checkout', 'pay',
  'invoice', 'invoices', 'refund', 'refunds', 'merchant', 'merchants',
  'account', 'settings', 'profile', 'dashboard', 'help', 'support',
  'status', 'health', 'docs', 'documentation', 'terms', 'privacy',
  'legal', 'about', 'contact', 'blog', 'news', 'home', 'root',
  'www', 'mail', 'ftp', 'ssh', 'sftp', 'cdn', 'assets', 'static',
  'assets', 'js', 'css', 'images', 'img', 'media', 'uploads',
]);

export interface CustomField {
  key: string;
  label: string;
  type: 'text' | 'number' | 'select';
  options?: string[]; // For select type
  required: boolean;
}

export interface PaymentLinkRequiredFields {
  name: boolean;
  email: boolean;
  phone: boolean;
}

@Entity('payment_links')
export class PaymentLink {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index({ unique: true })
  @Column({ length: 32 })
  token: string;

  @Index({ unique: true })
  @Column({ length: 64, nullable: true })
  slug: string | null = null;

  @Column({ type: 'decimal', precision: 10, scale: 2, nullable: true })
  amount: number | null;

  @Column({ default: false })
  flexibleAmount: boolean;

  @Column({ type: 'decimal', precision: 10, scale: 2, nullable: true })
  minAmount: number | null;

  @Column({ length: 3 })
  currency: string;

  @Column({ nullable: true, length: 500 })
  description: string | null = null;

  @Column({ nullable: true })
  expiresAt: Date | null = null;

  @Column({ default: true })
  isActive: boolean = true;

  @Column({ default: 0 })
  views: number;

  @Column({ default: 0 })
  completions: number;

  @Column({ type: 'integer', nullable: true })
  maxCompletions: number | null = null;

  @Column()
  merchantId: string;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
