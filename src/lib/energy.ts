import raw from '../data/energy-transition-daily.csv?raw';
import { compute } from './energy-calc.ts';

export { dayLabel, monthLabel } from './energy-calc.ts';
export const { rolling, last12, recordByYear, record } = compute(raw);
