"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.BarcodeService = void 0;
class BarcodeService {
    static decode(codigoBarras) {
        if (!codigoBarras || codigoBarras.length !== 13) {
            throw new Error('Código de barras inválido');
        }
        // 00 02001 01500 3
        const plu = codigoBarras.substring(2, 7);
        const pesoStr = codigoBarras.substring(7, 12);
        const pesoGramos = parseInt(pesoStr, 10);
        if (isNaN(pesoGramos) || pesoGramos <= 0) {
            throw new Error('Peso inválido en código de barras');
        }
        return {
            plu,
            peso: pesoGramos / 1000, // kg
        };
    }
}
exports.BarcodeService = BarcodeService;
