import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'ARMS Red Team Console',
  description: 'Red Team agentique (5 agents IA) qui met à l’épreuve le système ARMS face à DORA, MiCA et l’AI Act.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="fr">
      <body>{children}</body>
    </html>
  );
}
