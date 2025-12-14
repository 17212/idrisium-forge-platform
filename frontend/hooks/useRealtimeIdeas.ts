"use client";

import { useEffect, useState } from "react";
import {
  collection,
  getDocs,
  limit,
  onSnapshot,
  orderBy,
  query,
  type DocumentData,
} from "firebase/firestore";
import { db } from "@/lib/firebaseClient";

export type IdeaDifficultyLevel = "Easy" | "Medium" | "Impossible";

export type Idea = {
  id: string;
  title: string;
  description: string;
  author_name: string;
  votes: number;
  statu: "Pending" | "Approved" | "Development" | "Completed";
  tags?: string[];
  ai_analysis?: {
    difficulty?: IdeaDifficultyLevel;
    success_rate?: number;
  };
  created_at?: Date;
  roast?: string | null;
};

export function useRealtimeIdeas() {
  const [ideas, setIdeas] = useState<Idea[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const ideasRef = collection(db, "ideas");
    const baseQuery = query(ideasRef, orderBy("created_at", "desc"), limit(50));

    // Initial load with getDocs to control cost
    getDocs(baseQuery)
      .then((snapshot) => {
        setIdeas(snapshot.docs.map(mapIdeaDoc));
        setLoading(false);
      })
      .catch((err) => {
        console.error("Failed to load ideas", err);
        setLoading(false);
      });

    // Realtime listener for updates
    const unsubscribe = onSnapshot(baseQuery, (snapshot) => {
      setIdeas(snapshot.docs.map(mapIdeaDoc));
    });

    return () => unsubscribe();
  }, []);

  return { ideas, loading };
}

function mapIdeaDoc(doc: DocumentData): Idea {
  const data = doc.data() as any;
  return {
    id: doc.id,
    title: data.title ?? "Untitled Idea",
    description: data.description ?? "",
    author_name: data.author_name ?? "Anonymous",
    votes: data.votes ?? 0,
    statu: data.statu ?? "Pending",
    tags: data.tags ?? [],
    ai_analysis: data.ai_analysis ?? undefined,
    created_at: data.created_at?.toDate?.() ?? undefined,
    roast: data.roast ?? null,
  };
}
