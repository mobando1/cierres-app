'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';

const NAV_ITEMS = [
  { href: '/', label: 'Inicio', icon: '📊' },
  { href: '/cierres', label: 'Cierres', icon: '📋' },
  { href: '/sobres', label: 'Sobres', icon: '💼' },
  { href: '/alertas', label: 'Alertas', icon: '🔔' },
];

export default function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();

  async function handleLogout() {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push('/login');
  }

  return (
    <div className="min-h-screen flex flex-col bg-background">
      {/* Top bar */}
      <header className="bg-white border-b border-card-border px-4 py-3 flex items-center justify-between sticky top-0 z-40">
        <Link href="/" className="text-lg font-bold text-accent">
          Cierres de Caja
        </Link>
        <button
          onClick={handleLogout}
          className="text-sm text-muted hover:text-foreground transition-colors"
        >
          Salir
        </button>
      </header>

      {/* Content */}
      <main className="flex-1 pb-20 px-4 py-4 max-w-2xl mx-auto w-full">
        {children}
      </main>

      {/* Bottom navigation */}
      <nav className="fixed bottom-0 left-0 right-0 bg-white border-t border-card-border z-40 safe-area-bottom">
        <div className="flex justify-around items-center h-16 max-w-2xl mx-auto">
          {NAV_ITEMS.map((item) => {
            const active = item.href === '/' ? pathname === '/' : pathname.startsWith(item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex flex-col items-center gap-0.5 px-3 py-1 rounded-lg transition-colors ${
                  active ? 'text-accent' : 'text-muted hover:text-foreground'
                }`}
              >
                <span className="text-xl">{item.icon}</span>
                <span className="text-xs font-medium">{item.label}</span>
              </Link>
            );
          })}
        </div>
      </nav>
    </div>
  );
}
