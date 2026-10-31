import type { Metadata } from 'next';
import './globals.css';
export const metadata: Metadata = { title: 'Metric LP Detective — follow the evidence', description: 'Replay a real CRCLB/USDT liquidity position. Read-only, no wallet connection, with verifiable on-chain evidence.' };
export default function RootLayout({ children }: { children: React.ReactNode }) { return <html lang="en"><body>{children}</body></html>; }
