import raw from '../data/energy-transition-monthly.csv?raw';

const [head, ...lines] = raw.trim().split(/\r?\n/);
const cols = head.split(',');
const rows = lines.map((l) => {
	const v = l.split(',');
	const r: Record<string, string | number> = {};
	cols.forEach((c, i) => (r[c] = c === 'month' || c === 'record_time' ? v[i] : Number(v[i])));
	return r as Record<string, any>;
});

const MON = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
export const monthLabel = (m: string) => `${MON[+m.slice(5) - 1]} ${m.slice(0, 4)}`;
const sum = (rs: typeof rows, k: string) => rs.reduce((s, r) => s + r[k], 0);
const ren = (rs: typeof rows) => sum(rs, 'wind_mwh') + sum(rs, 'usolar_mwh') + sum(rs, 'hydro_mwh') + sum(rs, 'rooftop_mwh');

// 12-month rolling shares (energy-weighted), one point per month from the 12th.
export const rolling = rows.slice(11).map((_, k) => {
	const w = rows.slice(k, k + 12), t = sum(w, 'total_mwh');
	return {
		month: rows[k + 11].month as string,
		wind: sum(w, 'wind_mwh') / t,
		roof: sum(w, 'rooftop_mwh') / t,
		hydro: sum(w, 'hydro_mwh') / t,
		usol: sum(w, 'usolar_mwh') / t,
		ren: ren(w) / t,
		renTwh: ren(w) / 1e6,
		coal: sum(w, 'coal_mwh') / t,
	};
});

const lastWin = rows.slice(-12);
export const last12 = {
	to: monthLabel(rows[rows.length - 1].month),
	ren: ren(lastWin) / sum(lastWin, 'total_mwh'),
	coal: sum(lastWin, 'coal_mwh') / sum(lastWin, 'total_mwh'),
	// Gas, other and the <1% of units with no fuel mapping.
	gasOther: 1 - ren(lastWin) / sum(lastWin, 'total_mwh') - sum(lastWin, 'coal_mwh') / sum(lastWin, 'total_mwh'),
	renTwh: ren(lastWin) / 1e6,
	totalTwh: sum(lastWin, 'total_mwh') / 1e6,
	first: rolling[0].ren, // Jul 2018 to Jun 2019
};

// Best 30-minute renewable share per calendar year (2019 onward) and the all-time record.
const years = [...new Set(rows.map((r) => (r.month as string).slice(0, 4)))].filter((y) => y > '2018');
export const recordByYear = years.map((y) => ({
	year: y,
	share: Math.max(...rows.filter((r) => r.month.startsWith(y)).map((r) => r.record_share)),
}));
const best = rows.reduce((a, r) => (r.record_share > a.record_share ? r : a));
export const record = {
	share: best.record_share as number,
	time: new Date(best.record_time + 'Z'),
	previous: Math.max(...rows.filter((r) => r !== best).map((r) => r.record_share)),
};
