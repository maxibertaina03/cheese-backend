// src/scripts/create-admin.ts
// Crea (o resetea) un usuario en la base configurada en el .env.
// Uso:  npx ts-node src/scripts/create-admin.ts <username> <password> [rol]
//   rol opcional: admin (por defecto) | usuario
// Ej:  npx ts-node src/scripts/create-admin.ts admin2 "MiClaveSegura" admin
import 'reflect-metadata';
import bcrypt from 'bcryptjs';
import { AppDataSource } from '../config/database';
import { Usuario } from '../modulos/identidad/entities/Usuario';

const username = process.argv[2];
const password = process.argv[3];
const rol = (process.argv[4] as 'admin' | 'usuario') || 'admin';

if (!username || !password) {
  console.error('Uso: npx ts-node src/scripts/create-admin.ts <username> <password> [admin|usuario]');
  process.exit(1);
}

async function main() {
  await AppDataSource.initialize();
  console.log('✔ Conectado a la base de datos');

  const repo = AppDataSource.getRepository(Usuario);
  const hashed = await bcrypt.hash(password, 10);

  let user = await repo.findOne({ where: { username } });

  if (user) {
    user.password = hashed;
    user.rol = rol;
    await repo.save(user);
    console.log(`↻ Usuario "${username}" ya existía: contraseña y rol (${rol}) actualizados.`);
  } else {
    user = repo.create({ username, password: hashed, rol });
    await repo.save(user);
    console.log(`✔ Usuario "${username}" creado con rol ${rol} (id ${user.id}).`);
  }

  await AppDataSource.destroy();
  console.log('✔ Listo. Ya podés iniciar sesión.');
}

main().catch(async (err) => {
  console.error('✖ Error al crear el usuario:', err.message);
  if (AppDataSource.isInitialized) {
    await AppDataSource.destroy();
  }
  process.exit(1);
});
