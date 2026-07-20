
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

  // Secciones a las que el usuario tiene acceso cuando no es admin.
  // Valores posibles: 'quesos' | 'elementos' | 'indumentaria' | 'dashboard' | 'historial'
  // Los admin tienen acceso a todo y este campo se ignora.
  @Column({ type: 'simple-array', default: '' })
  permisos!: string[];

  @CreateDateColumn()
  createdAt!: Date;
}