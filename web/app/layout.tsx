import type { Metadata, Viewport } from 'next';
import type { ReactNode } from 'react';
import { Inter, JetBrains_Mono } from 'next/font/google';
import './globals.css';

const sans = Inter({ subsets: ['latin'], variable: '--font-inter', display: 'swap' });
const mono = JetBrains_Mono({ subsets: ['latin'], variable: '--font-jetbrains', display: 'swap' });

export const metadata: Metadata = {
  title: 'Last Mile · live evacuation dispatch',
  description: "Live evacuation dispatch for people who can't drive out of a wildfire or flood. Simulation with synthetic people.",
};
export const viewport: Viewport = { themeColor: '#06080b', colorScheme: 'dark' };

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" className={`${sans.variable} ${mono.variable}`}>
      <body className="min-h-dvh bg-bg text-fg">{children}</body>
    </html>
  );
}
