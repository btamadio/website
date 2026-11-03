// Pure computation over the daily CSV text, so both the pages (Vite) and scripts/og.mjs (plain Node) can use it.
const MON = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
export const monthLabel = (m: string) => `${MON[+m.slice(5, 7) - 1]} ${m.slice(0, 4)}`;
export const dayLabel = (d: string) => `${+d.slice(8, 10)} ${monthLabel(d)}`;

export function compute(raw: string) {
	const [head, ...lines] = raw.trim().split(/\r?\n/);
	const cols = head.split(',');
	const days = lines.map((l) => {
		const v = l.split(',');
		const r: Record<string, any> = {};
		cols.forEach((c, i) => (r[c] = ['day', 'record_time', 'source'].includes(c) ? v[i] : Number(v[i])));
		return r;
	});

	const sum = (rs: typeof days, k: string) => rs.reduce((s, r) => s + r[k], 0);
	const ren = (rs: typeof days) => sum(rs, 'wind_mwh') + sum(rs, 'usolar_mwh') + sum(rs, 'hydro_mwh') + sum(rs, 'rooftop_mwh');

	// Fractional year at the end of a day, for the x axis.
	const xOf = (d: string) => {
		const t = Date.parse(d + 'T00:00:00Z') + 864e5, y = new Date(t).getUTCFullYear();
		return y + (t - Date.UTC(y, 0, 1)) / (365.25 * 864e5);
	};

	// 365-day windows (energy-weighted shares), ending on each month's last day and on the latest day.
	// Windows are by date, so a day AEMO has not fully published (and so is absent) just shortens the window.
	const num = (d: string) => Date.parse(d + 'T00:00:00Z') / 864e5;
	const span = (i: number) => days.filter((r) => num(r.day) > num(days[i].day) - 365 && num(r.day) <= num(days[i].day));
	const point = (i: number) => {
		const w = span(i), t = sum(w, 'total_mwh'), d = days[i].day;
		return {
			month: d.slice(0, 7),
			label: d === days[days.length - 1].day ? dayLabel(d) : monthLabel(d),
			x: xOf(d),
			wind: sum(w, 'wind_mwh') / t,
			roof: sum(w, 'rooftop_mwh') / t,
			hydro: sum(w, 'hydro_mwh') / t,
			usol: sum(w, 'usolar_mwh') / t,
			ren: ren(w) / t,
			renTwh: ren(w) / 1e6,
			coal: sum(w, 'coal_mwh') / t,
			gas: 1 - ren(w) / t - sum(w, 'coal_mwh') / t, // gas, other and unmapped units
		};
	};
	const ends = days.flatMap((r, i) => (num(r.day) - num(days[0].day) >= 364 && (i === days.length - 1 || days[i + 1].day.slice(0, 7) !== r.day.slice(0, 7)) ? [i] : []));
	const rolling = ends.map(point);

	const lastWin = span(days.length - 1);
	const lastTotal = sum(lastWin, 'total_mwh');
	const last12 = {
		to: dayLabel(days[days.length - 1].day),
		ren: ren(lastWin) / lastTotal,
		coal: sum(lastWin, 'coal_mwh') / lastTotal,
		// Gas, other and the <1% of units with no fuel mapping.
		gasOther: 1 - ren(lastWin) / lastTotal - sum(lastWin, 'coal_mwh') / lastTotal,
		renTwh: ren(lastWin) / 1e6,
		totalTwh: lastTotal / 1e6,
		first: rolling[0].ren, // Jul 2018 to Jun 2019
	};

	// Best 30-minute renewable share per calendar year (2019 onward) and the all-time record.
	const years = [...new Set(days.map((r) => r.day.slice(0, 4)))].filter((y) => y > '2018');
	const withRecord = days.filter((r) => r.record_time);
	const recordByYear = years.map((y) => ({
		year: y,
		share: Math.max(...withRecord.filter((r) => r.day.startsWith(y)).map((r) => r.record_share)),
	}));
	const best = withRecord.reduce((a, r) => (r.record_share > a.record_share ? r : a));
	const record = {
		share: best.record_share as number,
		time: new Date(best.record_time + 'Z'),
		previous: Math.max(...withRecord.filter((r) => r.day < best.day).map((r) => r.record_share)),
	};

	return { rolling, last12, recordByYear, record };
}
