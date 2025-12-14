import type { Metadata } from "next";
import "./globals.css";
import { Inter, JetBrains_Mono, Space_Grotesk } from "next/font/google";
import AuroraBackground from "@/components/AuroraBackground";
import MatrixRainOverlay from "@/components/MatrixRainOverlay";

const inter = Inter({ subsets: ["latin"], variable: "--font-inter" });
const spaceGrotesk = Space_Grotesk({ subsets: ["latin"], variable: "--font-space-grotesk" });
const jetbrains = JetBrains_Mono({ subsets: ["latin"], variable: "--font-jetbrains-mono" });

export const metadata: Metadata = {
  title: "IDRISIUM IDEAS FORGE",
  description: "Intelligence from the shadows: cinematic AI-powered idea forge.",
  metadataBase: new URL("https://idrisium-ideas-forge.vercel.app"),
  openGraph: {
    title: "IDRISIUM IDEAS FORGE",
    description: "Forge, roast, and evolve your ideas with AI.",
    url: "https://idrisium-ideas-forge.vercel.app",
    siteName: "IDRISIUM IDEAS FORGE",
    type: "website",
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="dark">
      <body
        className={`${inter.variable} ${spaceGrotesk.variable} ${jetbrains.variable} bg-black text-zinc-100 antialiased`}
      >
        <AuroraBackground>
          <MatrixRainOverlay />
          <main className="relative min-h-screen flex flex-col">{children}</main>
        </AuroraBackground>
      </body>
    </html>
  );
}
