// 타임테이블용 시각 선택지 (12:00 ~ 23:55, 5분 간격)
export const TIME_OPTIONS: string[] = (() => {
  const out: string[] = [];
  for (let m = 12 * 60; m <= 23 * 60 + 55; m += 5) {
    out.push(
      `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`,
    );
  }
  return out;
})();

export function addMinutes(hhmm: string, delta: number): string {
  const [h, m] = hhmm.split(":").map(Number);
  let t = (h || 0) * 60 + (m || 0) + delta;
  t = Math.max(0, Math.min(t, 23 * 60 + 55));
  return `${String(Math.floor(t / 60)).padStart(2, "0")}:${String(t % 60).padStart(2, "0")}`;
}
