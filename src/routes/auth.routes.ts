// ============================================
// 3. ARCHIVO: src/routes/auth.routes.ts
// ============================================
import { Router } from 'express';
import { Request, Response } from 'express';
import { AppDataSource } from '../config/database';
import { Usuario } from '../entities/Usuario';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';

const router = Router();
const JWT_SECRET = process.env.JWT_SECRET || 'tu_secreto_temporal';

// POST /api/auth/register - Crear nuevo usuario
router.post('/register', async (req: Request, res: Response) => {
  try {
    const { username, password, rol = 'usuario' } = req.body;

    // Validaciones
    if (!username || !password) {
      return res.status(400).json({ 
        error: 'Faltan campos requeridos',
        details: 'Se requiere username y password'
      });
    }

    if (password.length < 4) {
      return res.status(400).json({ 
        error: 'La contraseña debe tener al menos 4 caracteres'
      });
    }

    if (rol !== 'admin' && rol !== 'usuario') {
      return res.status(400).json({ 
        error: 'El rol debe ser "admin" o "usuario"'
      });
    }

    // Verificar que el repositorio esté inicializado
    if (!AppDataSource.isInitialized) {
      return res.status(500).json({ 
        error: 'Base de datos no inicializada' 
      });
    }

    const usuarioRepo = AppDataSource.getRepository(Usuario);

    // Verificar si el usuario ya existe
    const existe = await usuarioRepo.findOne({ 
      where: { username } 
    });

    if (existe) {
      return res.status(409).json({ 
        error: 'El usuario ya existe',
        username: username
      });
    }

    // Encriptar contraseña
    const hashed = await bcrypt.hash(password, 10);

    // Crear usuario
    const nuevo = usuarioRepo.create({ 
      username, 
      password: hashed, 
      rol: rol as 'admin' | 'usuario'
    });

    await usuarioRepo.save(nuevo);

    // Respuesta sin incluir la contraseña
    res.status(201).json({ 
      message: 'Usuario creado exitosamente',
      user: {
        id: nuevo.id,
        username: nuevo.username,
        rol: nuevo.rol,
        createdAt: nuevo.createdAt
      }
    });

  } catch (err: any) {
    console.error('Error en /register:', err);
    res.status(500).json({ 
      error: 'Error al crear usuario',
      details: err.message 
    });
  }
});

// POST /api/auth/login - Iniciar sesión
router.post('/login', async (req: Request, res: Response) => {
  try {
    const { username, password } = req.body;

    // Validaciones
    if (!username || !password) {
      return res.status(400).json({ 
        error: 'Faltan campos requeridos',
        details: 'Se requiere username y password'
      });
    }

    // Verificar que el repositorio esté inicializado
    if (!AppDataSource.isInitialized) {
      return res.status(500).json({ 
        error: 'Base de datos no inicializada' 
      });
    }

    const usuarioRepo = AppDataSource.getRepository(Usuario);

    // Buscar usuario
    const user = await usuarioRepo.findOne({ 
      where: { username } 
    });

    if (!user) {
      return res.status(401).json({ 
        error: 'Credenciales inválidas',
        details: 'Usuario no encontrado'
      });
    }

    // Verificar contraseña
    const passwordValida = await bcrypt.compare(password, user.password);

    if (!passwordValida) {
      return res.status(401).json({ 
        error: 'Credenciales inválidas',
        details: 'Contraseña incorrecta'
      });
    }

    // Generar token
    const token = jwt.sign(
      { 
        id: user.id, 
        rol: user.rol,
        username: user.username
      }, 
      JWT_SECRET, 
      { expiresIn: '7d' }
    );

    res.json({ 
      message: 'Login exitoso',
      token,
      user: {
        id: user.id,
        username: user.username,
        rol: user.rol
      }
    });

  } catch (err: any) {
    console.error('Error en /login:', err);
    res.status(500).json({ 
      error: 'Error en el login',
      details: err.message 
    });
  }
});

// GET /api/auth/verify - Verificar token
router.get('/verify', async (req: Request, res: Response) => {
  try {
    const header = req.headers.authorization;
    
    if (!header) {
      return res.status(401).json({ error: 'No hay token' });
    }

    const token = header.split(' ')[1];
    
    try {
      const decoded = jwt.verify(token, JWT_SECRET) as any;
      res.json({ 
        valid: true,
        user: {
          id: decoded.id,
          rol: decoded.rol,
          username: decoded.username
        }
      });
    } catch {
      res.status(401).json({ 
        valid: false,
        error: 'Token inválido o expirado' 
      });
    }
  } catch (err: any) {
    res.status(500).json({ 
      error: 'Error al verificar token',
      details: err.message 
    });
  }
});

export default router;
