import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  OneToMany,
  CreateDateColumn,
} from 'typeorm';
import { Producto } from './Producto';
import { Particion } from './Particion';

@Entity('unidades')
export class Unidad {
  @PrimaryGeneratedColumn()
  id!: number;

  @ManyToOne(() => Producto, (producto) => producto.unidades, {
    nullable: false,
  })
  producto!: Producto;

  // peso en gramos
  @Column('decimal', { precision: 10, scale: 2 })
  pesoInicial!: number;

  @Column('decimal', { precision: 10, scale: 2 })
  pesoActual!: number;

  @Column({ default: true })
  activa!: boolean;
  
  @Column({ type: 'text', nullable: true })
  observacionesIngreso!: string;

  @OneToMany(() => Particion, (particion) => particion.unidad)
  particiones!: Particion[];

  @CreateDateColumn()
  createdAt!: Date;
}
