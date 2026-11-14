import type { Metadata, Viewport } from 'next';
import type { ReactNode } from 'react';
import './globals.css';

export const metadata: Metadata = {
  title: 'Last Mile · live evacuation dispatch',
  description: "Live evacuation dispatch for people who can't drive out of a wildfire or flood. Simulation with synthetic people.",
};
export const viewport: Viewport = { themeColor: '#06080b', colorScheme: 'dark' };

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-dvh bg-bg text-fg">{children}</body>
    </html>
  );
}
