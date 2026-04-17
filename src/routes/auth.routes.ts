import { Router } from 'express';
import { Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import { AppDataSource } from '../config/database';
import { getOptionalAuthUser, signAuthToken, verifyAuthToken } from '../config/auth';
import { LoginDto, RegisterDto } from '../dtos/auth.dto';
import { Usuario } from '../entities/Usuario';
import { validateDto } from '../middlewares/validation.middleware';

const router = Router();

router.post('/register', validateDto(RegisterDto), async (req: Request, res: Response) => {
  try {
    const { username, password, rol = 'usuario' } = req.body;
    const actor = getOptionalAuthUser(req);
    const requestedRole = rol === 'admin' ? 'admin' : 'usuario';
    const finalRole = actor?.rol === 'admin' ? requestedRole : 'usuario';

    if (!username || !password) {
      return res.status(400).json({
        error: 'Faltan campos requeridos',
        details: 'Se requiere username y password',
      });
    }

    if (password.length < 6) {
      return res.status(400).json({
        error: 'La contrasena debe tener al menos 6 caracteres',
      });
    }

    if (rol !== 'admin' && rol !== 'usuario') {
      return res.status(400).json({
        error: 'El rol debe ser "admin" o "usuario"',
      });
    }

    if (requestedRole === 'admin' && actor?.rol !== 'admin') {
      return res.status(403).json({
        error: 'Solo un administrador puede crear otro administrador',
      });
    }

    if (!AppDataSource.isInitialized) {
      return res.status(500).json({
        error: 'Base de datos no inicializada',
      });
    }

    const usuarioRepo = AppDataSource.getRepository(Usuario);
    const existe = await usuarioRepo.findOne({
      where: { username },
    });

    if (existe) {
      return res.status(409).json({
        error: 'El usuario ya existe',
        username,
      });
    }

    const hashed = await bcrypt.hash(password, 10);
    const nuevo = usuarioRepo.create({
      username,
      password: hashed,
      rol: finalRole,
    });

    await usuarioRepo.save(nuevo);

    res.status(201).json({
      message: actor?.rol === 'admin'
        ? 'Usuario creado exitosamente'
        : 'Cuenta creada exitosamente',
      user: {
        id: nuevo.id,
        username: nuevo.username,
        rol: nuevo.rol,
        createdAt: nuevo.createdAt,
      },
    });
  } catch (err: any) {
    console.error('Error en /register:', err);
    res.status(500).json({
      error: 'Error al crear usuario',
      details: err.message,
    });
  }
});

router.post('/login', validateDto(LoginDto), async (req: Request, res: Response) => {
  try {
    const { username, password } = req.body;

    if (!username || !password) {
      return res.status(400).json({
        error: 'Faltan campos requeridos',
        details: 'Se requiere username y password',
      });
    }

    if (!AppDataSource.isInitialized) {
      return res.status(500).json({
        error: 'Base de datos no inicializada',
      });
    }

    const usuarioRepo = AppDataSource.getRepository(Usuario);
    const user = await usuarioRepo.findOne({
      where: { username },
    });

    if (!user) {
      return res.status(401).json({
        error: 'Credenciales invalidas',
        details: 'Usuario no encontrado',
      });
    }

    const passwordValida = await bcrypt.compare(password, user.password);

    if (!passwordValida) {
      return res.status(401).json({
        error: 'Credenciales invalidas',
        details: 'Contrasena incorrecta',
      });
    }

    const token = signAuthToken({
      id: user.id,
      rol: user.rol,
      username: user.username,
    });

    res.json({
      message: 'Login exitoso',
      token,
      user: {
        id: user.id,
        username: user.username,
        rol: user.rol,
      },
    });
  } catch (err: any) {
    console.error('Error en /login:', err);
    res.status(500).json({
      error: 'Error en el login',
      details: err.message,
    });
  }
});

router.get('/verify', async (req: Request, res: Response) => {
  try {
    const header = req.headers.authorization;

    if (!header) {
      return res.status(401).json({ error: 'No hay token' });
    }

    const token = header.split(' ')[1];

    try {
      const decoded = verifyAuthToken(token);
      res.json({
        valid: true,
        user: {
          id: decoded.id,
          rol: decoded.rol,
          username: decoded.username,
        },
      });
    } catch {
      res.status(401).json({
        valid: false,
        error: 'Token invalido o expirado',
      });
    }
  } catch (err: any) {
    res.status(500).json({
      error: 'Error al verificar token',
      details: err.message,
    });
  }
});

export default router;
