"use client";

import { useEffect, useState } from "react";
import { collection, limit, onSnapshot, orderBy, query } from "firebase/firestore";
import { db } from "@/lib/firebaseClient";

interface TickerItem {
  id: string;
  user_name: string;
  idea_title: string;
  type: string;
}

export default function NewsTicker() {
  const [items, setItems] = useState<TickerItem[]>([]);

  useEffect(() => {
    const ref = collection(db, "activity_log");
    const q = query(ref, orderBy("created_at", "desc"), limit(20));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      setItems(
        snapshot.docs.map((doc) => {
          const data = doc.data() as any;
          return {
            id: doc.id,
            user_name: data.user_name ?? "Unknown",
            idea_title: data.idea_title ?? "an idea",
            type: data.type ?? "activity",
          };
        }),
      );
    });

    return () => unsubscribe();
  }, []);

  if (items.length === 0) return null;

  const marqueeText = items
    .map((item) => `User ${item.user_name} just interacted with "${item.idea_title}"`)
    .join("   •   ");

  return (
    <div className="overflow-hidden rounded-full border border-aurora-neon/40 bg-black/60 backdrop-blur-12">
      <div className="animate-ticker whitespace-nowrap px-4 py-1 text-xs text-zinc-300">
        {marqueeText}
      </div>
    </div>
  );
}
