"use client";

import IdeaCard from "@/components/IdeaCard";
import DoomsdayTimer from "@/components/DoomsdayTimer";
import NewsTicker from "@/components/NewsTicker";
import { useRealtimeIdeas } from "@/hooks/useRealtimeIdeas";

export default function HomePage() {
  const { ideas, loading } = useRealtimeIdeas();

  return (
    <div className="relative z-10 flex flex-col gap-6 px-4 py-8 md:px-10 max-w-6xl mx-auto">
      <header className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="font-space text-3xl md:text-4xl tracking-tight">
            IDRISIUM <span className="text-aurora-neon">IDEAS FORGE</span>
          </h1>
          <p className="text-sm text-zinc-400">
            Intelligence from the shadows – forge, roast, and evolve your ideas.
          </p>
        </div>
        <DoomsdayTimer />
      </header>

      <NewsTicker />

      <section className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        {loading && (
          <>
            {Array.from({ length: 6 }).map((_, idx) => (
              <div
                key={idx}
                className="rounded-2xl border border-zinc-800/60 bg-zinc-900/40 backdrop-blur-12 animate-pulse h-44"
              />
            ))}
          </>
        )}

        {!loading &&
          ideas.map((idea) => (
            <IdeaCard key={idea.id} idea={idea} />
          ))}

        {!loading && ideas.length === 0 && (
          <div className="col-span-full text-center text-zinc-500 border border-dashed border-zinc-700/60 rounded-2xl py-10">
            No ideas yet. Start your legacy today.
          </div>
        )}
      </section>
    </div>
  );
}
