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
exports.Particion = void 0;
const typeorm_1 = require("typeorm");
const Unidad_1 = require("./Unidad");
let Particion = class Particion {
};
exports.Particion = Particion;
__decorate([
    (0, typeorm_1.PrimaryGeneratedColumn)(),
    __metadata("design:type", Number)
], Particion.prototype, "id", void 0);
__decorate([
    (0, typeorm_1.ManyToOne)(() => Unidad_1.Unidad, (unidad) => unidad.particiones, {
        nullable: false,
    }),
    __metadata("design:type", Unidad_1.Unidad)
], Particion.prototype, "unidad", void 0);
__decorate([
    (0, typeorm_1.Column)('decimal', { precision: 10, scale: 2 }),
    __metadata("design:type", Number)
], Particion.prototype, "peso", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'text', nullable: true }),
    __metadata("design:type", Object)
], Particion.prototype, "observacionesCorte", void 0);
__decorate([
    (0, typeorm_1.CreateDateColumn)(),
    __metadata("design:type", Date)
], Particion.prototype, "createdAt", void 0);
exports.Particion = Particion = __decorate([
    (0, typeorm_1.Entity)('particiones')
], Particion);
