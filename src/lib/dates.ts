/**
 * Hora del negocio: la de Buenos Aires, sin importar dónde corra el código
 * (Vercel corre en UTC: a las 22:00 de acá, para el servidor ya es mañana).
 * Las reglas con hora local pasan por acá: el corte de las 11:00 (RN-80), el
 * día de la caja, la semana del corte con la mensajería.
 *
 * Las fechas del negocio van como "YYYY-MM-DD"; los instantes, como Date.
 */

export const BUSINESS_TIME_ZONE = "America/Argentina/Buenos_Aires";

/** 0 = domingo … 6 = sábado, como Date.getDay(). */
export type Weekday = 0 | 1 | 2 | 3 | 4 | 5 | 6;

export type BusinessClock = {
  /** "2026-11-02" */
  date: string;
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
  weekday: Weekday;
};

const formatter = new Intl.DateTimeFormat("en-US", {
  timeZone: BUSINESS_TIME_ZONE,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  second: "2-digit",
  hourCycle: "h23",
});

const DATE_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/;
const TIME_PATTERN = /^([01]\d|2[0-3]):([0-5]\d)$/;
const DAY_MS = 24 * 60 * 60 * 1000;

function parts(instant: Date) {
  const values: Record<string, number> = {};
  for (const part of formatter.formatToParts(instant)) {
    if (part.type !== "literal") values[part.type] = Number(part.value);
  }
  return values as Record<"year" | "month" | "day" | "hour" | "minute" | "second", number>;
}

function pad(value: number) {
  return String(value).padStart(2, "0");
}

function parseDate(date: string) {
  const match = DATE_PATTERN.exec(date);
  if (!match) throw new RangeError(`Fecha inválida, se espera YYYY-MM-DD: "${date}"`);
  return { year: Number(match[1]), month: Number(match[2]), day: Number(match[3]) };
}

/** Lo que marca el reloj en Buenos Aires en ese instante. */
function clock(instant: Date = new Date()): BusinessClock {
  const { year, month, day, hour, minute } = parts(instant);
  return {
    date: `${year}-${pad(month)}-${pad(day)}`,
    year,
    month,
    day,
    hour,
    minute,
    weekday: new Date(Date.UTC(year, month - 1, day)).getUTCDay() as Weekday,
  };
}

/** Fecha del negocio: "2026-11-02". */
function today(instant: Date = new Date()) {
  return clock(instant).date;
}

/** Si en Buenos Aires todavía no son las `time` ("11:00"). */
function isBefore(time: string, instant: Date = new Date()) {
  const match = TIME_PATTERN.exec(time);
  if (!match) throw new RangeError(`Hora inválida, se espera HH:MM: "${time}"`);
  const { hour, minute } = clock(instant);
  return hour * 60 + minute < Number(match[1]) * 60 + Number(match[2]);
}

/** Instante en que empieza ese día en Buenos Aires, para filtrar en la base. */
function startOfDay(date: string) {
  const { year, month, day } = parseDate(date);
  const asUtc = Date.UTC(year, month - 1, day);
  // Diferencia entre el reloj de acá y UTC en ese momento (hoy, −3 h fijo).
  const offset = (at: number) => {
    const local = parts(new Date(at));
    return Date.UTC(local.year, local.month - 1, local.day, local.hour, local.minute, local.second) - at;
  };
  const guess = asUtc - offset(asUtc);
  return new Date(asUtc - offset(guess));
}

function addDays(date: string, days: number) {
  const { year, month, day } = parseDate(date);
  const result = new Date(Date.UTC(year, month - 1, day) + days * DAY_MS);
  return `${result.getUTCFullYear()}-${pad(result.getUTCMonth() + 1)}-${pad(result.getUTCDate())}`;
}

/** Primer día de la semana que contiene `date`, si la semana arranca el `weekStartsOn`. */
function startOfWeek(date: string, weekStartsOn: Weekday) {
  const { year, month, day } = parseDate(date);
  const weekday = new Date(Date.UTC(year, month - 1, day)).getUTCDay();
  return addDays(date, -((weekday - weekStartsOn + 7) % 7));
}

export const businessTime = { clock, today, isBefore, startOfDay, addDays, startOfWeek };
