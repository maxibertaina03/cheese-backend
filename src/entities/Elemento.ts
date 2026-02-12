import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  CreateDateColumn,
  UpdateDateColumn,
  DeleteDateColumn,
} from 'typeorm';
import { Motivo } from './Motivo';
import { Usuario } from './Usuario';

@Entity('elementos')
export class Elemento {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column({ type: 'text' })
  descripcion!: string;

  @Column({ type: 'date' })
  fechaIngreso!: Date;

  @Column({ type: 'date', nullable: true })
  fechaEgreso!: Date | null;

  @Column({ type: 'varchar', length: 200, nullable: true })
  ubicacion!: string | null;

  @Column({ default: true })
  activo!: boolean;

  @ManyToOne(() => Motivo, { nullable: true })
  motivoEgreso!: Motivo | null;

  @ManyToOne(() => Usuario, { nullable: true })
  creadoPor!: Usuario | null;

  @ManyToOne(() => Usuario, { nullable: true })
  modificadoPor!: Usuario | null;

  @ManyToOne(() => Usuario, { nullable: true })
  eliminadoPor!: Usuario | null;

  @CreateDateColumn()
  createdAt!: Date;

  @UpdateDateColumn()
  updatedAt!: Date;

  @DeleteDateColumn()
  deletedAt!: Date | null;
}