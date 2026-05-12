export const fmtMiles = (n: number) =>
  n >= 1000 ? `${(n / 1000).toFixed(2)}k mi` : `${n.toFixed(0)} mi`;

export const fmtHours = (n: number) => `${n.toFixed(2)} hr`;

export const fmtDuration = (min: number) => {
  if (min < 60) return `${min} min`;
  const h = Math.floor(min / 60);
  const m = min % 60;
  return m === 0 ? `${h} hr` : `${h} hr ${m} min`;
};

export const fmtClock = (minOfDay: number) => {
  const h = Math.floor(minOfDay / 60);
  const m = minOfDay % 60;
  const hh = h % 12 === 0 ? 12 : h % 12;
  const ap = h < 12 ? "AM" : "PM";
  return `${hh}:${m.toString().padStart(2, "0")} ${ap}`;
};

export const fmtDate = (iso: string) => {
  const d = new Date(iso);
  return d.toLocaleDateString(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
  });
};
