"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.requireRole = exports.auth = void 0;
// ============================================
// 2. ARCHIVO: src/middlewares/auth.ts
// ============================================
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const JWT_SECRET = process.env.JWT_SECRET || 'tu_secreto_temporal';
const auth = (req, res, next) => {
    try {
        const header = req.headers.authorization;
        if (!header) {
            return res.status(401).json({ error: 'No autorizado - No hay token' });
        }
        const token = header.split(' ')[1];
        if (!token) {
            return res.status(401).json({ error: 'No autorizado - Token inválido' });
        }
        const decoded = jsonwebtoken_1.default.verify(token, JWT_SECRET);
        req.user = decoded;
        next();
    }
    catch (error) {
        return res.status(401).json({ error: 'Token inválido o expirado' });
    }
};
exports.auth = auth;
const requireRole = (rol) => {
    return (req, res, next) => {
        if (!req.user) {
            return res.status(401).json({ error: 'No autenticado' });
        }
        if (req.user.rol !== rol) {
            return res.status(403).json({ error: 'Sin permisos suficientes' });
        }
        next();
    };
};
exports.requireRole = requireRole;
