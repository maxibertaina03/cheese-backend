// ============================================
// ARCHIVO: src/entities/TipoQueso.ts (ACTUALIZADO)
// ============================================
import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  OneToMany,
  CreateDateColumn,
  UpdateDateColumn,
  DeleteDateColumn,
  ManyToOne,
} from 'typeorm';
import { Producto } from './Producto';
import { Usuario } from './Usuario';

@Entity('tipos_queso')
export class TipoQueso {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column({ unique: true })
  nombre!: string;

  // 🆕 Auditoría de Usuarios
  @ManyToOne(() => Usuario, { nullable: true })
  creadoPor!: Usuario | null;

  @ManyToOne(() => Usuario, { nullable: true })
  modificadoPor!: Usuario | null;

  @ManyToOne(() => Usuario, { nullable: true })
  eliminadoPor!: Usuario | null;

  @OneToMany(() => Producto, (producto) => producto.tipoQueso)
  productos!: Producto[];

  @CreateDateColumn()
  createdAt!: Date;

  @UpdateDateColumn()
  updatedAt!: Date;

  // 🆕 Soft Delete
  @DeleteDateColumn()
  deletedAt!: Date | null;
}