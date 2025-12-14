"use client";

import { useEffect, useState } from "react";

const SEQUENCE = ["i", "d", "r", "i", "s"];

export function useMatrixEasterEgg() {
  const [active, setActive] = useState(false);

  useEffect(() => {
    let index = 0;

    const handler = (event: KeyboardEvent) => {
      const key = event.key.toLowerCase();
      if (key === SEQUENCE[index]) {
        index += 1;
        if (index === SEQUENCE.length) {
          setActive((prev) => !prev);
          index = 0;
        }
      } else {
        index = key === SEQUENCE[0] ? 1 : 0;
      }
    };

    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);

  return { active };
}
