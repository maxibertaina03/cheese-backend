import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  CreateDateColumn,
  UpdateDateColumn,
  DeleteDateColumn,
} from 'typeorm';
import { Usuario } from '../../identidad/entities/Usuario';

@Entity('clientes')
export class Cliente {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column({ type: 'varchar', length: 200 })
  nombre!: string;

  @Column({ type: 'varchar', length: 10, default: 'DNI' })
  tipoDocumento!: 'DNI' | 'CUIT';

  @Column({ type: 'varchar', length: 20, nullable: true })
  numeroDocumento!: string | null;

  @Column({ type: 'varchar', length: 250, nullable: true })
  direccion!: string | null;

  @Column({ type: 'varchar', length: 20, nullable: true })
  codigoPostal!: string | null;

  @Column({ type: 'varchar', length: 150, nullable: true })
  localidad!: string | null;

  @Column({ type: 'varchar', length: 150, nullable: true })
  provincia!: string | null;

  @Column({ type: 'varchar', length: 50, nullable: true })
  telefono!: string | null;

  @Column({ type: 'varchar', length: 150, nullable: true })
  email!: string | null;

  @Column({ default: true })
  activo!: boolean;

  // Auditoría
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
