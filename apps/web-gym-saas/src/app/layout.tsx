import type { Metadata } from "next";
import { Manrope, Inter, JetBrains_Mono } from "next/font/google";
import "./globals.css";
import { AuthProvider } from "@/contexts/AuthContext";
import { ErrorBoundary } from "@/components/error-boundary";
import { NavigationRail } from "@/components/navigation-rail";
import { OfflineIndicator } from "@/components/offline-indicator";
import { AppStateProvider } from "@/lib/state-context";

const manrope = Manrope({ 
  subsets: ["latin"], 
  variable: "--font-manrope",
  display: 'swap',
});

const inter = Inter({ 
  subsets: ["latin"], 
  variable: "--font-inter",
  display: 'swap',
});

const jetbrainsMono = JetBrains_Mono({ 
  subsets: ["latin"], 
  variable: "--font-jetbrains-mono",
  display: 'swap',
});

export const metadata: Metadata = {
  title: "PolyFit — B2B Corporate Wellness Network & BOH SaaS",
  description: "PolyFit BOH SaaS Operations Console & B2B Corporate Wellness Network",
  openGraph: {
    title: "PolyFit — B2B Corporate Wellness Network & BOH SaaS",
    description: "PolyFit BOH SaaS Operations Console & B2B Corporate Wellness Network",
    siteName: "PolyFit",
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`dark ${manrope.variable} ${inter.variable} ${jetbrainsMono.variable} h-full antialiased`}>
      <head>
        <link href="https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:wght,FILL@100..700,0..1&display=swap" rel="stylesheet" />
        <style>
          {`
          .material-symbols-outlined {
            font-variation-settings: 'FILL' 0, 'wght' 400, 'GRAD' 0, 'opsz' 24;
          }
          .material-symbols-outlined[style*="'FILL' 1"] {
            font-variation-settings: 'FILL' 1, 'wght' 400, 'GRAD' 0, 'opsz' 24;
          }
          `}
        </style>
      </head>
      <body className="min-h-full flex bg-background text-foreground">
        <ErrorBoundary>
          <AuthProvider>
            <AppStateProvider>
              <a href="#main-content" className="skip-to-main">
                Skip to main content
              </a>
              <NavigationRail />
              <OfflineIndicator />
              <main className="flex-1 ml-0 lg:ml-[240px] pt-14 lg:pt-0 min-h-screen" id="main-content" role="main">
                {children}
              </main>
            </AppStateProvider>
          </AuthProvider>
        </ErrorBoundary>
      </body>
    </html>
  );
}
