
// ============================================
// 1. ARCHIVO: src/entities/Usuario.ts
// ============================================
import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn } from 'typeorm';

@Entity()
export class Usuario {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column({ unique: true })
  username!: string;

  @Column()
  password!: string;

  @Column({ type: 'varchar', default: 'usuario' })
  rol!: 'admin' | 'usuario';

  @CreateDateColumn()
  createdAt!: Date;
}