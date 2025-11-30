import { StreamProvider } from '@/context/stream-ctx'

export default function StreamLayout({ children }: { children: React.ReactNode }) {
  return (
    <StreamProvider>
      <main className="max-w-7xl mx-auto">{children}</main>
    </StreamProvider>
  )
}
