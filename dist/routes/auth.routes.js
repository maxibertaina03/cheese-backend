"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
// ============================================
// 3. ARCHIVO: src/routes/auth.routes.ts
// ============================================
const express_1 = require("express");
const database_1 = require("../config/database");
const Usuario_1 = require("../entities/Usuario");
const bcryptjs_1 = __importDefault(require("bcryptjs"));
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const router = (0, express_1.Router)();
const JWT_SECRET = process.env.JWT_SECRET || 'tu_secreto_temporal';
// POST /api/auth/register - Crear nuevo usuario
router.post('/register', async (req, res) => {
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
        if (!database_1.AppDataSource.isInitialized) {
            return res.status(500).json({
                error: 'Base de datos no inicializada'
            });
        }
        const usuarioRepo = database_1.AppDataSource.getRepository(Usuario_1.Usuario);
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
        const hashed = await bcryptjs_1.default.hash(password, 10);
        // Crear usuario
        const nuevo = usuarioRepo.create({
            username,
            password: hashed,
            rol: rol
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
    }
    catch (err) {
        console.error('Error en /register:', err);
        res.status(500).json({
            error: 'Error al crear usuario',
            details: err.message
        });
    }
});
// POST /api/auth/login - Iniciar sesión
router.post('/login', async (req, res) => {
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
        if (!database_1.AppDataSource.isInitialized) {
            return res.status(500).json({
                error: 'Base de datos no inicializada'
            });
        }
        const usuarioRepo = database_1.AppDataSource.getRepository(Usuario_1.Usuario);
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
        const passwordValida = await bcryptjs_1.default.compare(password, user.password);
        if (!passwordValida) {
            return res.status(401).json({
                error: 'Credenciales inválidas',
                details: 'Contraseña incorrecta'
            });
        }
        // Generar token
        const token = jsonwebtoken_1.default.sign({
            id: user.id,
            rol: user.rol,
            username: user.username
        }, JWT_SECRET, { expiresIn: '7d' });
        res.json({
            message: 'Login exitoso',
            token,
            user: {
                id: user.id,
                username: user.username,
                rol: user.rol
            }
        });
    }
    catch (err) {
        console.error('Error en /login:', err);
        res.status(500).json({
            error: 'Error en el login',
            details: err.message
        });
    }
});
// GET /api/auth/verify - Verificar token
router.get('/verify', async (req, res) => {
    try {
        const header = req.headers.authorization;
        if (!header) {
            return res.status(401).json({ error: 'No hay token' });
        }
        const token = header.split(' ')[1];
        try {
            const decoded = jsonwebtoken_1.default.verify(token, JWT_SECRET);
            res.json({
                valid: true,
                user: {
                    id: decoded.id,
                    rol: decoded.rol,
                    username: decoded.username
                }
            });
        }
        catch {
            res.status(401).json({
                valid: false,
                error: 'Token inválido o expirado'
            });
        }
    }
    catch (err) {
        res.status(500).json({
            error: 'Error al verificar token',
            details: err.message
        });
    }
});
exports.default = router;
