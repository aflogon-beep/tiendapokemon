// Formatos de la v10
const EUR = new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR' });

export const fmt = (n: number): string => EUR.format(n);
export const pct = (x: number): string => (x >= 0 ? '+' : '') + (x * 100).toFixed(1).replace('.', ',') + ' %';
