import type { ReactNode } from "react";

type Props = {
  children: ReactNode;
};

export default function AuroraBackground({ children }: Props) {
  return (
    <div className="relative min-h-screen bg-black overflow-hidden">
      <div className="aurora-bg">
        <div className="aurora-orb" style={{ top: "-10%", left: "-10%" }} />
        <div
          className="aurora-orb secondary"
          style={{ bottom: "-20%", right: "-10%" }}
        />
      </div>
      <div className="relative z-10">{children}</div>
    </div>
  );
}
