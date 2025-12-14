"use client";

import { useEffect, useState } from "react";

function getCairoMidnightDiff(): number {
  const now = new Date();
  const cairoNow = new Date(
    now.toLocaleString("en-US", { timeZone: "Africa/Cairo" }),
  );
  const midnight = new Date(cairoNow);
  midnight.setHours(24, 0, 0, 0);
  return midnight.getTime() - cairoNow.getTime();
}

function formatRemaining(ms: number) {
  const totalSeconds = Math.max(0, Math.floor(ms / 1000));
  const hours = Math.floor(totalSeconds / 3600)
    .toString()
    .padStart(2, "0");
  const minutes = Math.floor((totalSeconds % 3600) / 60)
    .toString()
    .padStart(2, "0");
  const seconds = Math.floor(totalSeconds % 60)
    .toString()
    .padStart(2, "0");
  return `${hours}:${minutes}:${seconds}`;
}

export default function DoomsdayTimer() {
  const [remaining, setRemaining] = useState(getCairoMidnightDiff());

  useEffect(() => {
    const id = setInterval(() => {
      setRemaining(getCairoMidnightDiff());
    }, 1000);
    return () => clearInterval(id);
  }, []);

  const label = remaining <= 0 ? "Submissions closed" : "Time until Cairo midnight";

  return (
    <div className="rounded-xl border border-aurora-neon/40 bg-black/40 px-4 py-2 shadow-neon-green backdrop-blur-12 text-right">
      <div className="text-[10px] uppercase tracking-[0.22em] text-zinc-400">
        {label}
      </div>
      <div className="font-jetbrains text-lg text-aurora-neon">{formatRemaining(remaining)}</div>
    </div>
  );
}
