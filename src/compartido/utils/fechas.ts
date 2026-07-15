// src/compartido/utils/fechas.ts
//
// Shared kernel: formateo de fechas para reportes y comprobantes.

// Etiqueta legible en formato es-AR (dd/mm/aaaa). Devuelve '-' si no hay fecha.
export const formatDateLabel = (date: Date | string | null | undefined) => {
  if (!date) {
    return '-';
  }

  return new Date(date).toLocaleDateString('es-AR');
};
