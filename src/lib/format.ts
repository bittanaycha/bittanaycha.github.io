/** Small date helpers. Everything is parsed at noon local time so a DST edge
 *  cannot shift a date by a day, and printed lower-case to sit quietly in the
 *  mono captions. */

const day = new Intl.DateTimeFormat('en-GB', { day: '2-digit', month: 'short' });

function parse(iso: string): Date {
	return new Date(`${iso}T12:00:00`);
}

/** `2026-10-12` → `12 oct` */
export function shortDate(iso: string): string {
	return day.format(parse(iso)).replace('.', '').toLowerCase();
}

/** `2026-10-12` + `2026-10-18` → `12–18 oct`, or `28 sep–04 oct` across months */
export function dateRange(start: string, end: string): string {
	const a = parse(start);
	const b = parse(end);
	if (a.getMonth() === b.getMonth() && a.getFullYear() === b.getFullYear()) {
		return `${a.getDate()}–${shortDate(end)}`;
	}
	return `${shortDate(start)}–${shortDate(end)}`;
}

/** `2027-04-11` → `11.04.2027` */
export function dotted(iso: string): string {
	const [year, month, date] = iso.split('-');
	return `${date}.${month}.${year}`;
}

/** Calendar date of a `Date`, as `YYYY-MM-DD` in local time. */
export function isoDay(date: Date): string {
	const month = `${date.getMonth() + 1}`.padStart(2, '0');
	const date1 = `${date.getDate()}`.padStart(2, '0');
	return `${date.getFullYear()}-${month}-${date1}`;
}
