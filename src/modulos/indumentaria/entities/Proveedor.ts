import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  OneToMany,
  CreateDateColumn,
  UpdateDateColumn,
  DeleteDateColumn,
} from 'typeorm';
import { Usuario } from '../../identidad/entities/Usuario';
import { Indumentaria } from './Indumentaria';

@Entity('proveedores')
export class Proveedor {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column({ type: 'varchar', length: 200 })
  nombre!: string;

  @Column({ type: 'varchar', length: 200, nullable: true })
  contacto!: string | null;

  @Column({ type: 'varchar', length: 50, nullable: true })
  telefono!: string | null;

  @Column({ type: 'varchar', length: 150, nullable: true })
  email!: string | null;

  @Column({ type: 'varchar', length: 250, nullable: true })
  direccion!: string | null;

  @Column({ type: 'text', nullable: true })
  observaciones!: string | null;

  @Column({ default: true })
  activo!: boolean;

  // Indumentaria suministrada por este proveedor
  @OneToMany(() => Indumentaria, (indumentaria) => indumentaria.proveedor)
  indumentaria!: Indumentaria[];

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
