import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { AuthProvider } from "@/contexts/AuthContext";
import { ErrorBoundary } from "@/components/error-boundary";
import { AppStateProvider } from "@/lib/state-context";

const inter = Inter({ 
  subsets: ["latin"], 
  variable: "--font-inter",
  display: 'swap',
});

export const metadata: Metadata = {
  title: "PolyFit — Corporate Fitness & Wellness Network",
  description: "PolyFit connects companies and employees to a network of gyms and fitness providers, making corporate fitness benefits more accessible, flexible and measurable.",
  openGraph: {
    title: "PolyFit — Corporate Fitness & Wellness Network",
    description: "PolyFit connects companies and employees to a network of gyms and fitness providers, making corporate fitness benefits more accessible, flexible and measurable.",
    siteName: "PolyFit",
    type: "website",
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`marketing-theme ${inter.variable} antialiased`}>
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
      <body className="min-h-screen bg-background text-foreground">
        <ErrorBoundary>
          <AuthProvider>
            <AppStateProvider>
              <a href="#main-content" className="skip-to-main">
                Skip to main content
              </a>
              {children}
            </AppStateProvider>
          </AuthProvider>
        </ErrorBoundary>
      </body>
    </html>
  );
}
