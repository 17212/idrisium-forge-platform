"use client";

import { useMatrixEasterEgg } from "@/hooks/useMatrixEasterEgg";

export default function MatrixRainOverlay() {
  const { active } = useMatrixEasterEgg();

  if (!active) return null;

  return <div className="matrix-rain z-20" />;
}
