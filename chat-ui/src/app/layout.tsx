import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'FastAPI WebSocket Test Client',
  description: 'A test client for FastAPI WebSocket applications',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
