// src/scripts/seed-users.ts
// Crea (o actualiza) los usuarios del sistema con sus permisos por seccion.
// Uso:  npx ts-node src/scripts/seed-users.ts
//
// Permisos por seccion posibles: quesos | elementos | indumentaria | dashboard | historial
// Los usuarios con rol 'admin' tienen acceso a todo (los permisos se ignoran).
import 'reflect-metadata';
import bcrypt from 'bcryptjs';
import { AppDataSource } from '../config/database';
import { Usuario } from '../entities/Usuario';

interface SeedUser {
  username: string;
  password: string;
  rol: 'admin' | 'usuario';
  permisos: string[];
}

const usuarios: SeedUser[] = [
  // Acceso total
  { username: 'Jochi', password: 'Jochi0812', rol: 'admin', permisos: [] },
  // Solo quesos, historial y dashboard
  { username: 'Queco', password: 'Queco0812', rol: 'usuario', permisos: ['quesos', 'historial', 'dashboard'] },
  // Elementos, indumentaria y dashboard (sin quesos)
  { username: 'Mari', password: 'Mari0912', rol: 'usuario', permisos: ['elementos', 'indumentaria', 'dashboard'] },
];

async function main() {
  await AppDataSource.initialize();
  console.log('✔ Conectado a la base de datos');

  const repo = AppDataSource.getRepository(Usuario);

  for (const data of usuarios) {
    const hashed = await bcrypt.hash(data.password, 10);
    let user = await repo.findOne({ where: { username: data.username } });

    if (user) {
      user.password = hashed;
      user.rol = data.rol;
      user.permisos = data.rol === 'admin' ? [] : data.permisos;
      await repo.save(user);
      console.log(`↻ "${data.username}" actualizado (rol: ${data.rol}, permisos: ${user.permisos.join(', ') || 'todos'}).`);
    } else {
      user = repo.create({
        username: data.username,
        password: hashed,
        rol: data.rol,
        permisos: data.rol === 'admin' ? [] : data.permisos,
      });
      await repo.save(user);
      console.log(`✔ "${data.username}" creado (rol: ${data.rol}, permisos: ${user.permisos.join(', ') || 'todos'}).`);
    }
  }

  await AppDataSource.destroy();
  console.log('✔ Listo. Los usuarios ya pueden iniciar sesion.');
}

main().catch(async (err) => {
  console.error('✖ Error al crear los usuarios:', err.message);
  if (AppDataSource.isInitialized) {
    await AppDataSource.destroy();
  }
  process.exit(1);
});
