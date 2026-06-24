// Heatmap de contribuții stil GitHub — prezentațional. Zilele vin deja generate de profileService
// (aliniate pe săptămâni Luni→Duminică, UTC, ultimul an), fiecare cu nivelul 0..4. Aici doar randăm grila.

export type ContributionDay = { date: string; count: number; level: number };

// Scală: 0 = neutru cald; 1..4 = verde crescător (verde = „contribuție", ca aprobarea).
const LEVEL_BG = ["#ece4d6", "#cfe3d2", "#9cc8a4", "#5fa06e", "#2f6b3f"] as const;

const MONTHS_RO = ["ian", "feb", "mar", "apr", "mai", "iun", "iul", "aug", "sep", "oct", "nov", "dec"];
const WEEKDAY_LABELS: Record<number, string> = { 0: "Lun", 2: "Mie", 4: "Vin" };

function chunkWeeks(days: ContributionDay[]): ContributionDay[][] {
  const weeks: ContributionDay[][] = [];
  for (let i = 0; i < days.length; i += 7) weeks.push(days.slice(i, i + 7));
  return weeks;
}

function fmtRo(dateISO: string): string {
  const d = new Date(`${dateISO}T00:00:00Z`);
  return `${d.getUTCDate()} ${MONTHS_RO[d.getUTCMonth()]} ${d.getUTCFullYear()}`;
}

export function ContributionGraph({ days, total }: { days: ContributionDay[]; total: number }) {
  const weeks = chunkWeeks(days);

  // Etichetă de lună deasupra primei coloane în care începe o lună nouă (comparăm cu săptămâna precedentă).
  const monthOf = (week: ContributionDay[]): number | null =>
    week[0] ? new Date(`${week[0].date}T00:00:00Z`).getUTCMonth() : null;
  const monthLabels = weeks.map((week, wi) => {
    const m = monthOf(week);
    if (m === null) return "";
    const prev = wi > 0 ? monthOf(weeks[wi - 1]) : -1;
    return m !== prev ? MONTHS_RO[m] : "";
  });

  return (
    <div className="rounded-lg bg-card p-5 ring-1 ring-foreground/10">
      <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="font-mono text-[11px] uppercase tracking-[0.12em] text-muted-foreground">
          Contribuții în ultimul an
        </h2>
        <span className="text-[13px] text-muted-foreground">
          <b className="font-semibold text-foreground">{total}</b> contribuții
        </span>
      </div>

      <div className="overflow-x-auto">
        <div className="inline-flex flex-col gap-1">
          {/* Etichete de lună. */}
          <div className="flex gap-[3px] pl-[30px]">
            {monthLabels.map((label, i) => (
              <span
                key={i}
                className="w-[11px] whitespace-nowrap font-mono text-[9px] text-muted-foreground"
              >
                {label}
              </span>
            ))}
          </div>

          {/* Coloană etichete zi + grila de săptămâni. */}
          <div className="flex gap-[3px]">
            <div className="mr-0.5 flex w-[26px] flex-col gap-[3px]">
              {Array.from({ length: 7 }, (_, r) => (
                <span key={r} className="h-[11px] font-mono text-[9px] leading-[11px] text-muted-foreground">
                  {WEEKDAY_LABELS[r] ?? ""}
                </span>
              ))}
            </div>

            {weeks.map((week, wi) => (
              <div key={wi} className="flex flex-col gap-[3px]">
                {week.map((day) => (
                  <span
                    key={day.date}
                    title={`${day.count} ${day.count === 1 ? "contribuție" : "contribuții"} · ${fmtRo(day.date)}`}
                    className="size-[11px] rounded-[2px]"
                    style={{ backgroundColor: LEVEL_BG[day.level] ?? LEVEL_BG[0] }}
                  />
                ))}
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Legendă. */}
      <div className="mt-3 flex items-center justify-end gap-1.5 font-mono text-[10px] text-muted-foreground">
        <span>Mai puțin</span>
        {LEVEL_BG.map((bg, i) => (
          <span key={i} className="size-[11px] rounded-[2px]" style={{ backgroundColor: bg }} />
        ))}
        <span>Mai mult</span>
      </div>
    </div>
  );
}
