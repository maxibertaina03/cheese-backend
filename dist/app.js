"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const cors_1 = __importDefault(require("cors"));
const producto_routes_1 = __importDefault(require("./routes/producto.routes"));
const unidad_routes_1 = __importDefault(require("./routes/unidad.routes"));
const tipoQueso_routes_1 = __importDefault(require("./routes/tipoQueso.routes"));
const particion_routes_1 = __importDefault(require("./routes/particion.routes"));
const auth_routes_1 = __importDefault(require("./routes/auth.routes"));
const app = (0, express_1.default)();
const corsOptions = {
    origin: process.env.NODE_ENV === 'production'
        ? ['https://cheese-stock-frontend-jsq7.vercel.app']
        : 'http://localhost:3001',
    credentials: true,
};
app.use((0, cors_1.default)(corsOptions));
app.use(express_1.default.json());
app.use('/api/tipos-queso', tipoQueso_routes_1.default);
app.use('/api/productos', producto_routes_1.default);
app.use('/api/unidades', unidad_routes_1.default);
app.use('/api/particiones', particion_routes_1.default);
app.use('/api/auth', auth_routes_1.default);
app.get('/', (_req, res) => res.send('Cheese-stock API ok'));
console.log('✅ /api/auth routes mounted');
exports.default = app;
