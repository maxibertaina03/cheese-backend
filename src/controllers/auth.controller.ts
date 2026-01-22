import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { Request, Response } from 'express';
import { AppDataSource } from '../config/database';
import { Usuario } from '../entities/Usuario';

const usuarioRepo = AppDataSource.getRepository(Usuario);
const JWT_SECRET = process.env.JWT_SECRET || 'tu_secreto';

export const register = async (req: Request, res: Response) => {
  const { username, password, rol = 'usuario' } = req.body;
  const hashed = await bcrypt.hash(password, 10);
  const user = usuarioRepo.create({ username, password: hashed, rol });
  await usuarioRepo.save(user);
  res.status(201).json({ message: 'Usuario creado' });
};

export const login = async (req: Request, res: Response) => {
  const { username, password } = req.body;
  const user = await usuarioRepo.findOneBy({ username });
  if (!user || !(await bcrypt.compare(password, user.password))) {
    return res.status(401).json({ error: 'Credenciales inválidas' });
  }
  const token = jwt.sign({ id: user.id, rol: user.rol }, JWT_SECRET, { expiresIn: '1d' });
  res.json({ token, rol: user.rol });
};