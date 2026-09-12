import type { Metadata, Viewport } from 'next';
import './globals.css';
import { CopilotShell } from '@/components/copilot/CopilotShell';

export const metadata: Metadata = {
  title: 'REPEAT — Show it once. Never do it again.',
  description:
    'REPEAT is an AI layer that learns repetitive workflows by watching how you already work. Your behavior becomes the automation.',
  applicationName: 'REPEAT',
};

export const viewport: Viewport = {
  themeColor: '#04060a',
  width: 'device-width',
  initialScale: 1,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-screen">
        {/* Live mode only: the AG-UI transport for the Ghost Run. A pass-through in Demo Mode. */}
        <CopilotShell>
          <div className="relative z-10">{children}</div>
        </CopilotShell>
      </body>
    </html>
  );
}
