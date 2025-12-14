"use client";

import { useEffect, useState, type ChangeEvent } from "react";
import { onAuthStateChanged, type User } from "firebase/auth";
import { auth } from "@/lib/firebaseClient";

const ADMIN_EMAIL =
  process.env.NEXT_PUBLIC_ADMIN_EMAIL ?? "idris.ghamid@gmail.com";

interface ActionState {
  status: "idle" | "loading" | "success" | "error";
  message?: string;
}

const BACKEND_URL =
  process.env.NEXT_PUBLIC_BACKEND_URL ?? "http://localhost:10000";

export default function AdminDashboard() {
  const [email, setEmail] = useState<string | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [keyInput, setKeyInput] = useState("");
  const [actionState, setActionState] = useState<ActionState>({ status: "idle" });

  useEffect(() => {
    if (!auth) return;

    const unsub = onAuthStateChanged(auth, (user: User | null) => {
      const mail = user?.email ?? null;
      setEmail(mail);
      setIsAdmin(mail === ADMIN_EMAIL);
    });
    return () => unsub();
  }, []);

  if (!email) {
    return (
      <section className="mt-10 rounded-2xl border border-zinc-800/80 bg-black/60 p-6 text-sm text-zinc-300">
        Sign in to access the IDRISIUM admin dashboard.
      </section>
    );
  }

  if (!isAdmin) {
    return (
      <section className="mt-10 rounded-2xl border border-rose-600/60 bg-black/80 p-6 text-sm text-rose-200">
        This zone is reserved for Idris. Your account does not have God Mode access.
      </section>
    );
  }

  const runAction = async (path: string, body: unknown) => {
    try {
      setActionState({ status: "loading" });
      const res = await fetch(`${BACKEND_URL}${path}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body ?? {}),
      });
      if (!res.ok) throw new Error(await res.text());
      setActionState({ status: "success", message: "Action executed successfully." });
    } catch (err) {
      console.error(err);
      setActionState({ status: "error", message: "Action failed. Check backend logs." });
    }
  };

  return (
    <section className="mt-12 space-y-6">
      <header>
        <h2 className="font-space text-xl font-semibold text-zinc-50">
          Admin God Mode
        </h2>
        <p className="text-xs text-zinc-500">
          Manage AI keys, submissions, and the cosmic hammer of moderation.
        </p>
      </header>

      <div className="grid gap-4 md:grid-cols-2">
        <div className="rounded-2xl border border-aurora-neon/40 bg-black/70 p-4 backdrop-blur-12">
          <h3 className="mb-2 text-sm font-semibold text-aurora-neon">
            Key Manager
          </h3>
          <p className="mb-2 text-xs text-zinc-400">
            Add Gemini API keys to the rotation pool. Keys are stored server-side only.
          </p>
          <textarea
            value={keyInput}
            onChange={(e: ChangeEvent<HTMLTextAreaElement>) => setKeyInput(e.target.value)}
            className="mb-2 h-20 w-full rounded-lg border border-zinc-700 bg-black/60 p-2 text-xs text-zinc-100 outline-none focus:border-aurora-neon/70"
            placeholder="Paste one API key per line"
          />
          <button
            type="button"
            onClick={() =>
              runAction("/admin/gemini-keys", { keys: keyInput.split(/\r?\n/).filter(Boolean) })
            }
            className="rounded-full border border-aurora-neon/70 bg-black/70 px-3 py-1 text-[11px] font-semibold tracking-[0.18em] text-aurora-neon shadow-neon-green"
          >
            UPDATE KEYS
          </button>
        </div>

        <div className="space-y-4">
          <div className="rounded-2xl border border-zinc-700 bg-black/70 p-4 backdrop-blur-12">
            <h3 className="mb-2 text-sm font-semibold text-zinc-100">
              Submission Gate
            </h3>
            <p className="mb-2 text-xs text-zinc-400">
              Force submissions open or closed, overriding the midnight lock.
            </p>
            <div className="flex gap-2 text-[11px]">
              <button
                type="button"
                onClick={() => runAction("/admin/submissions/open", {})}
                className="flex-1 rounded-full border border-emerald-500/70 bg-emerald-500/10 px-3 py-1 font-semibold text-emerald-300"
              >
                FORCE OPEN
              </button>
              <button
                type="button"
                onClick={() => runAction("/admin/submissions/close", {})}
                className="flex-1 rounded-full border border-rose-500/70 bg-rose-500/10 px-3 py-1 font-semibold text-rose-300"
              >
                FORCE CLOSE
              </button>
            </div>
          </div>

          <div className="rounded-2xl border border-aurora-neon/60 bg-black/80 p-4 text-center shadow-neon-green backdrop-blur-12">
            <h3 className="mb-2 text-sm font-semibold text-aurora-neon">
              The Randomizer
            </h3>
            <p className="mb-3 text-xs text-zinc-400">
              Smash this to spotlight a random idea with confetti in the feed.
            </p>
            <button
              type="button"
              onClick={() => runAction("/admin/random-idea", {})}
              className="w-full rounded-full border border-aurora-neon bg-aurora-neon/20 px-4 py-2 text-xs font-semibold tracking-[0.3em] text-aurora-neon shadow-neon-green"
            >
              RANDOMIZE
            </button>
          </div>
        </div>
      </div>

      {actionState.status !== "idle" && (
        <p
          className={`text-xs ${
            actionState.status === "success"
              ? "text-emerald-400"
              : actionState.status === "error"
                ? "text-rose-400"
                : "text-zinc-400"
          }`}
        >
          {actionState.message ?? "Working..."}
        </p>
      )}
    </section>
  );
}
