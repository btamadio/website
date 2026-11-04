import raw from '../data/rbit-backtest.csv?raw';

const MON = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const hourLabel = (h: string) => `${+h.slice(8, 10)} ${MON[+h.slice(5, 7) - 1]} ${h.slice(11, 13)}:00`;

const [head, ...lines] = raw.trim().split(/\r?\n/);
const cols = head.split(',');
const rows = lines.map((l) => {
	const v = l.split(',');
	return Object.fromEntries(cols.map((c, i) => [c, ['settlementdate', 'regionid'].includes(c) ? v[i] : Number(v[i])])) as Record<string, any>;
});

export const regions = ['NSW1', 'QLD1', 'SA1', 'TAS1', 'VIC1'];
export const defaultRegion = 'VIC1';

const sum = (rs: typeof rows, f: (r: Record<string, any>) => number) => rs.reduce((s, r) => s + f(r), 0);

export const byRegion = Object.fromEntries(
	regions.map((id) => {
		const rs = rows.filter((r) => r.regionid === id);
		const net = sum(rs, (r) => r.arbitrage_revenue - r.degradation_cost);
		const perfect = sum(rs, (r) => r.oracle_arbitrage_revenue - r.oracle_degradation_cost);
		const summary = { net, perfect, pct: net / perfect, arbitrage: sum(rs, (r) => r.arbitrage_revenue), degradation: sum(rs, (r) => r.degradation_cost), cycles: sum(rs, (r) => r.battery_cycles) };

		// Hourly points (mean price, end-of-hour state of charge and cumulative net profit): 5-minute data would be 10k points a region.
		let cum = 0, cumPerfect = 0;
		const hourly: { label: string; t: number; price: number; soc: number; profit: number; perfect: number }[] = [];
		for (let i = 0; i < rs.length; ) {
			const h = rs[i].settlementdate.slice(0, 13), g = [];
			for (; i < rs.length && rs[i].settlementdate.startsWith(h); i++) g.push(rs[i]);
			cum += sum(g, (r) => r.arbitrage_revenue - r.degradation_cost);
			cumPerfect += sum(g, (r) => r.oracle_arbitrage_revenue - r.oracle_degradation_cost);
			hourly.push({ label: hourLabel(h), t: Date.parse(h + ':00:00Z'), price: sum(g, (r) => r.rrp) / g.length, soc: g[g.length - 1].state_of_charge, profit: cum, perfect: cumPerfect });
		}
		// Self-check: the hourly series ends on the full-resolution totals.
		const last = hourly[hourly.length - 1];
		if (Math.abs(last.profit - net) > 1e-6 || Math.abs(last.perfect - perfect) > 1e-6) throw new Error(`rbit hourly series disagrees with totals for ${id}`);
		return [id, { summary, hourly }];
	}),
);

export const period = { from: rows[0].settlementdate.slice(0, 10), to: rows[rows.length - 1].settlementdate.slice(0, 10) };
