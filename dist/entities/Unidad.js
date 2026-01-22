"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.Unidad = void 0;
const typeorm_1 = require("typeorm");
const Producto_1 = require("./Producto");
const Particion_1 = require("./Particion");
let Unidad = class Unidad {
};
exports.Unidad = Unidad;
__decorate([
    (0, typeorm_1.PrimaryGeneratedColumn)(),
    __metadata("design:type", Number)
], Unidad.prototype, "id", void 0);
__decorate([
    (0, typeorm_1.ManyToOne)(() => Producto_1.Producto, (producto) => producto.unidades, {
        nullable: false,
    }),
    __metadata("design:type", Producto_1.Producto)
], Unidad.prototype, "producto", void 0);
__decorate([
    (0, typeorm_1.Column)('decimal', { precision: 10, scale: 2 }),
    __metadata("design:type", Number)
], Unidad.prototype, "pesoInicial", void 0);
__decorate([
    (0, typeorm_1.Column)('decimal', { precision: 10, scale: 2 }),
    __metadata("design:type", Number)
], Unidad.prototype, "pesoActual", void 0);
__decorate([
    (0, typeorm_1.Column)({ default: true }),
    __metadata("design:type", Boolean)
], Unidad.prototype, "activa", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'text', nullable: true }),
    __metadata("design:type", String)
], Unidad.prototype, "observacionesIngreso", void 0);
__decorate([
    (0, typeorm_1.OneToMany)(() => Particion_1.Particion, (particion) => particion.unidad),
    __metadata("design:type", Array)
], Unidad.prototype, "particiones", void 0);
__decorate([
    (0, typeorm_1.CreateDateColumn)(),
    __metadata("design:type", Date)
], Unidad.prototype, "createdAt", void 0);
exports.Unidad = Unidad = __decorate([
    (0, typeorm_1.Entity)('unidades')
], Unidad);
