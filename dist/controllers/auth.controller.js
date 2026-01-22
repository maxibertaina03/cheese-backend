"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.login = exports.register = void 0;
const bcryptjs_1 = __importDefault(require("bcryptjs"));
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const database_1 = require("../config/database");
const Usuario_1 = require("../entities/Usuario");
const usuarioRepo = database_1.AppDataSource.getRepository(Usuario_1.Usuario);
const JWT_SECRET = process.env.JWT_SECRET || 'tu_secreto';
const register = async (req, res) => {
    const { username, password, rol = 'usuario' } = req.body;
    const hashed = await bcryptjs_1.default.hash(password, 10);
    const user = usuarioRepo.create({ username, password: hashed, rol });
    await usuarioRepo.save(user);
    res.status(201).json({ message: 'Usuario creado' });
};
exports.register = register;
const login = async (req, res) => {
    const { username, password } = req.body;
    const user = await usuarioRepo.findOneBy({ username });
    if (!user || !(await bcryptjs_1.default.compare(password, user.password))) {
        return res.status(401).json({ error: 'Credenciales inválidas' });
    }
    const token = jsonwebtoken_1.default.sign({ id: user.id, rol: user.rol }, JWT_SECRET, { expiresIn: '1d' });
    res.json({ token, rol: user.rol });
};
exports.login = login;
