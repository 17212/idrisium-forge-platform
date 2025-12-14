"use client";

import { useEffect, useState, type ChangeEvent } from "react";
import {
  GoogleAuthProvider,
  onAuthStateChanged,
  signInWithPopup,
  type User,
} from "firebase/auth";
import { addDoc, collection, serverTimestamp } from "firebase/firestore";

import IdeaCard from "@/components/IdeaCard";
import DoomsdayTimer from "@/components/DoomsdayTimer";
import NewsTicker from "@/components/NewsTicker";
import { useRealtimeIdeas } from "@/hooks/useRealtimeIdeas";
import { auth, db } from "@/lib/firebaseClient";

export default function HomePage() {
  const { ideas, loading } = useRealtimeIdeas();

  const [user, setUser] = useState<User | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [submitLoading, setSubmitLoading] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  useEffect(() => {
    if (!auth) {
      setAuthLoading(false);
      return;
    }

    const unsub = onAuthStateChanged(auth, (firebaseUser: User | null) => {
      setUser(firebaseUser);
      setAuthLoading(false);
    });

    return () => unsub();
  }, []);

  const handleLogin = async () => {
    if (!auth) return;
    try {
      const provider = new GoogleAuthProvider();
      await signInWithPopup(auth, provider);
    } catch (err) {
      console.error("Login failed", err);
    }
  };

  const openForgeFlow = async () => {
    setSubmitError(null);
    if (!auth || !auth.currentUser) {
      await handleLogin();
      return;
    }
    setIsModalOpen(true);
  };

  const handleSubmitIdea = async () => {
    if (!auth || !auth.currentUser) {
      setSubmitError("You need to be signed in to submit an idea.");
      return;
    }
    if (!title.trim() || !description.trim()) {
      setSubmitError("Please add both a title and a description.");
      return;
    }

    try {
      setSubmitLoading(true);
      setSubmitError(null);
      const currentUser = auth.currentUser;
      await addDoc(collection(db, "ideas"), {
        title: title.trim(),
        description: description.trim(),
        author_uid: currentUser?.uid ?? null,
        author_name: currentUser?.displayName ?? "Anonymous",
        votes: 0,
        statu: "Pending",
        is_deleted: false,
        created_at: serverTimestamp(),
      });
      setTitle("");
      setDescription("");
      setIsModalOpen(false);
    } catch (err) {
      console.error("Failed to submit idea", err);
      setSubmitError("Failed to submit idea. Try again.");
    } finally {
      setSubmitLoading(false);
    }
  };

  const heroCtaLabel = authLoading
    ? "CHECKING ACCESS..."
    : user
      ? "🔨 FORGE NEW IDEA"
      : "🔑 LOGIN TO PARTICIPATE";

  const heroCtaHandler = authLoading
    ? undefined
    : user
      ? () => setIsModalOpen(true)
      : handleLogin;

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

      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <button
          type="button"
          onClick={heroCtaHandler}
          disabled={authLoading}
          className="inline-flex items-center justify-center rounded-full bg-[#39FF14] px-6 py-3 text-sm md:text-base font-semibold tracking-[0.2em] text-black shadow-[0_0_25px_rgba(57,255,20,0.7)] transition-shadow hover:shadow-[0_0_40px_rgba(57,255,20,0.9)] disabled:cursor-not-allowed disabled:opacity-60"
       >
          {heroCtaLabel}
        </button>
        <p className="text-xs text-zinc-500 max-w-md">
          Login with Google to forge new ideas into the IDRISIUM arena. Your best concepts
          get roasted, evolved, and pushed towards execution.
        </p>
      </div>

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
          <div className="col-span-full text-center text-zinc-400 border border-dashed border-zinc-700/60 rounded-2xl py-10 space-y-4">
            <p>No ideas yet. Start your legacy today.</p>
            <button
              type="button"
              onClick={openForgeFlow}
              className="inline-flex items-center justify-center rounded-full border border-aurora-neon/70 bg-black/70 px-5 py-2 text-xs md:text-sm font-semibold tracking-[0.18em] text-aurora-neon shadow-neon-green hover:bg-aurora-neon/10"
            >
              Be the First to Break the Silence
            </button>
          </div>
        )}
      </section>

      {isModalOpen && (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/70 backdrop-blur-md">
          <div className="w-full max-w-md rounded-2xl border border-aurora-neon/60 bg-black/90 p-6 text-sm text-zinc-100 shadow-[0_0_40px_rgba(0,0,0,0.9)]">
            <h2 className="mb-2 font-space text-lg font-semibold text-aurora-neon">
              Forge a New Idea
            </h2>
            <p className="mb-4 text-xs text-zinc-400">
              Drop the raw concept. The forge will handle the roasting and evolution.
            </p>
            <div className="space-y-3">
              <input
                type="text"
                value={title}
                onChange={(e: ChangeEvent<HTMLInputElement>) => setTitle(e.target.value)}
                placeholder="Idea title"
                className="w-full rounded-lg border border-zinc-700 bg-black/70 px-3 py-2 text-xs text-zinc-100 outline-none focus:border-aurora-neon/70"
              />
              <textarea
                value={description}
                onChange={(e: ChangeEvent<HTMLTextAreaElement>) => setDescription(e.target.value)}
                placeholder="Describe your idea like you're pitching to Idris at 3AM."
                className="h-28 w-full rounded-lg border border-zinc-700 bg-black/70 px-3 py-2 text-xs text-zinc-100 outline-none focus:border-aurora-neon/70"
              />
              {submitError && <p className="text-[11px] text-rose-400">{submitError}</p>}
              <div className="mt-2 flex items-center justify-end gap-2 text-[11px]">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="rounded-full border border-zinc-700 bg-black/60 px-3 py-1 text-zinc-300 hover:bg-zinc-900"
                  disabled={submitLoading}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleSubmitIdea}
                  disabled={submitLoading}
                  className="rounded-full bg-[#39FF14] px-4 py-1 font-semibold tracking-[0.18em] text-black shadow-[0_0_22px_rgba(57,255,20,0.8)] hover:shadow-[0_0_32px_rgba(57,255,20,1)] disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {submitLoading ? "FORGING..." : "SUBMIT IDEA"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
