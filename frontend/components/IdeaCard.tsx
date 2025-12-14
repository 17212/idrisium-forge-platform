"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import type { Idea } from "@/hooks/useRealtimeIdeas";
import { roastIdea } from "@/lib/apiClient";

interface Props {
  idea: Idea;
}

export default function IdeaCard({ idea }: Props) {
  const [roast, setRoast] = useState<string | null>(idea.roast ?? null);
  const [loadingRoast, setLoadingRoast] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleRoast = async () => {
    setLoadingRoast(true);
    setError(null);
    try {
      const payload = `${idea.title}\n\n${idea.description}`;
      const res = await roastIdea(payload);
      setRoast(res.roast);
    } catch (err) {
      console.error(err);
      setError("AI roast failed. Try again in a moment.");
    } finally {
      setLoadingRoast(false);
    }
  };

  const difficulty = idea.ai_analysis?.difficulty ?? "Medium";
  const successRate = idea.ai_analysis?.success_rate ?? undefined;

  const difficultyColor =
    difficulty === "Easy"
      ? "bg-emerald-500/20 text-emerald-300 border-emerald-400/40"
      : difficulty === "Medium"
        ? "bg-amber-500/20 text-amber-300 border-amber-400/40"
        : "bg-rose-500/20 text-rose-300 border-rose-400/40";

  return (
    <motion.article
      className="group relative flex flex-col rounded-2xl border border-aurora-neon/25 bg-black/50 p-4 shadow-[0_0_40px_rgba(0,0,0,0.9)] backdrop-blur-12"
      whileHover={{ rotateX: -4, rotateY: 4, scale: 1.02 }}
      transition={{ type: "spring", stiffness: 260, damping: 20 }}
    >
      <div className="absolute inset-px rounded-2xl bg-gradient-to-br from-emerald-400/10 via-transparent to-emerald-500/10 opacity-0 blur-3xl transition-opacity duration-300 group-hover:opacity-100" />

      <div className="relative z-10 flex flex-col gap-2">
        <header className="flex items-start justify-between gap-2">
          <div>
            <h2 className="font-space text-sm font-semibold text-zinc-50 line-clamp-2">
              {idea.title}
            </h2>
            <p className="text-[11px] text-zinc-500">by {idea.author_name}</p>
          </div>
          <div className="flex flex-col items-end gap-1 text-right">
            <span
              className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-medium uppercase tracking-[0.18em] ${difficultyColor}`}
            >
              {difficulty}
            </span>
            {successRate !== undefined && (
              <span className="font-jetbrains text-[10px] text-zinc-400">
                {successRate.toFixed(0)}% chance
              </span>
            )}
          </div>
        </header>

        <p className="mt-1 line-clamp-4 text-xs text-zinc-300">
          {idea.description}
        </p>

        <div className="mt-3 flex flex-wrap items-center justify-between gap-2 text-[11px] text-zinc-400">
          <div className="flex flex-wrap gap-1">
            {idea.tags?.slice(0, 4).map((tag) => (
              <span
                key={tag}
                className="rounded-full bg-zinc-900/80 px-2 py-0.5 text-[10px] uppercase tracking-[0.16em] text-zinc-400"
              >
                {tag}
              </span>
            ))}
          </div>
          <div className="flex items-center gap-2">
            <span className="font-jetbrains text-[11px] text-aurora-neon">
              ▲ {idea.votes ?? 0}
            </span>
            <span className="rounded-full border border-zinc-800/60 bg-zinc-950/70 px-2 py-0.5 text-[10px] uppercase tracking-[0.18em] text-zinc-500">
              {idea.statu}
            </span>
          </div>
        </div>

        <div className="mt-3 flex flex-col gap-2">
          <button
            type="button"
            onClick={handleRoast}
            className="inline-flex items-center justify-center rounded-full border border-aurora-neon/70 bg-black/60 px-3 py-1 text-[11px] font-medium tracking-[0.18em] text-aurora-neon shadow-neon-green transition-colors hover:bg-aurora-neon/10"
            disabled={loadingRoast}
          >
            {loadingRoast ? "ROASTING..." : "🔥 ROAST MY IDEA"}
          </button>
          {error && (
            <p className="text-[10px] text-rose-400">{error}</p>
          )}
          {roast && (
            <div className="mt-1 rounded-xl border border-zinc-800/80 bg-zinc-950/70 p-2 text-[11px] text-zinc-200">
              <div className="mb-1 text-[10px] font-semibold uppercase tracking-[0.2em] text-zinc-500">
                AI Roast
              </div>
              <p className="whitespace-pre-wrap leading-relaxed">{roast}</p>
            </div>
          )}
        </div>
      </div>
    </motion.article>
  );
}
