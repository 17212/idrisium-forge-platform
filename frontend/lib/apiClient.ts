const BACKEND_URL =
  process.env.NEXT_PUBLIC_BACKEND_URL ?? "http://localhost:10000";

export async function roastIdea(ideaText: string): Promise<{ roast: string }> {
  const res = await fetch(`${BACKEND_URL}/ai/roast`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ idea_text: ideaText }),
  });

  if (!res.ok) {
    throw new Error("Failed to roast idea");
  }

  return res.json();
}
