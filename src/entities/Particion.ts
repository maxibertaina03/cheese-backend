import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  CreateDateColumn,
} from 'typeorm';
import { Unidad } from './Unidad';

@Entity('particiones')
export class Particion {
  @PrimaryGeneratedColumn()
  id!: number;

  @ManyToOne(() => Unidad, (unidad) => unidad.particiones, {
    nullable: false,
  })
  unidad!: Unidad;

  @Column('decimal', { precision: 10, scale: 2 })
  peso!: number;

  @Column({ type: 'text', nullable: true })
  observacionesCorte!: string | null; 
  
  @CreateDateColumn()
  createdAt!: Date;
}
