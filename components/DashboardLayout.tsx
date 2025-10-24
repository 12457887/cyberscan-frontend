'use client';

import { useAuth } from '@/contexts/AuthContext';
import { useRouter, usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';
import { Shield, Home, Scan, FileText, CreditCard, User, Bell, LogOut, Menu, X, Settings } from 'lucide-react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const { user, profile, loading, signOut } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  useEffect(() => {
    if (!loading && !user) {
      router.push('/login');
    }
  }, [user, loading, router]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="text-center">
          <Shield className="w-12 h-12 text-blue-600 mx-auto mb-4 animate-pulse" />
          <p className="text-slate-600">Chargement...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return null;
  }

  const navigation = [
    { name: 'Tableau de bord', href: '/dashboard', icon: Home },
    { name: 'Nouveau Scan', href: '/dashboard/scan', icon: Scan },
    { name: 'Détection', href: '/dashboard/detection', icon: Shield },
    { name: 'Rapports', href: '/dashboard/reports', icon: FileText },
    { name: 'Abonnement', href: '/dashboard/subscription', icon: CreditCard },
    { name: 'Profil', href: '/dashboard/profile', icon: User },
  ];

  const adminNavigation = [
    { name: 'Administration', href: '/admin', icon: Settings },
  ];

  return (
    <div className="min-h-screen bg-slate-50">
      <nav className="bg-white border-b border-slate-200 sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16">
            <div className="flex items-center">
              <div className="flex-shrink-0 flex items-center">
                <Shield className="w-8 h-8 text-blue-600" />
                <span className="ml-2 text-xl font-bold text-slate-900">CyberScan</span>
              </div>
            </div>

            <div className="hidden md:flex items-center space-x-4">
              <Button variant="ghost" size="icon" asChild>
                <Link href="/dashboard/notifications">
                  <Bell className="w-5 h-5" />
                </Link>
              </Button>
              <div className="text-sm text-slate-600">
                {profile?.full_name}
              </div>
              {profile?.role === 'admin' && (
                <Badge variant="secondary">Admin</Badge>
              )}
              <Button variant="ghost" size="icon" onClick={signOut}>
                <LogOut className="w-5 h-5" />
              </Button>
            </div>

            <div className="md:hidden flex items-center">
              <Button variant="ghost" size="icon" onClick={() => setMobileMenuOpen(!mobileMenuOpen)}>
                {mobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
              </Button>
            </div>
          </div>
        </div>

        {mobileMenuOpen && (
          <div className="md:hidden border-t border-slate-200">
            <div className="px-2 pt-2 pb-3 space-y-1">
              {navigation.map((item) => (
                <Link
                  key={item.name}
                  href={item.href}
                  className="block px-3 py-2 rounded-md text-base font-medium text-slate-700 hover:bg-slate-100"
                  onClick={() => setMobileMenuOpen(false)}
                >
                  {item.name}
                </Link>
              ))}
              <button
                onClick={signOut}
                className="block w-full text-left px-3 py-2 rounded-md text-base font-medium text-slate-700 hover:bg-slate-100"
              >
                Se déconnecter
              </button>
            </div>
          </div>
        )}
      </nav>

      <div className="flex">
        <aside className="hidden md:flex md:flex-shrink-0">
          <div className="flex flex-col w-64 bg-white border-r border-slate-200 h-[calc(100vh-4rem)] sticky top-16">
            <nav className="flex-1 px-4 py-6 space-y-1">
              {navigation.map((item) => {
                const Icon = item.icon;
                const isActive = pathname === item.href;
                return (
                  <Link
                    key={item.name}
                    href={item.href}
                    className={`flex items-center px-4 py-3 text-sm font-medium rounded-lg transition-colors ${
                      isActive
                        ? 'bg-blue-50 text-blue-700'
                        : 'text-slate-700 hover:bg-slate-100'
                    }`}
                  >
                    <Icon className={`w-5 h-5 mr-3 ${isActive ? 'text-blue-700' : 'text-slate-500'}`} />
                    {item.name}
                  </Link>
                );
              })}

              {profile?.role === 'admin' && (
                <>
                  <div className="border-t border-slate-200 my-4"></div>
                  {adminNavigation.map((item) => {
                    const Icon = item.icon;
                    const isActive = pathname === item.href;
                    return (
                      <Link
                        key={item.name}
                        href={item.href}
                        className={`flex items-center px-4 py-3 text-sm font-medium rounded-lg transition-colors ${
                          isActive
                            ? 'bg-orange-50 text-orange-700'
                            : 'text-slate-700 hover:bg-slate-100'
                        }`}
                      >
                        <Icon className={`w-5 h-5 mr-3 ${isActive ? 'text-orange-700' : 'text-slate-500'}`} />
                        {item.name}
                      </Link>
                    );
                  })}
                </>
              )}
            </nav>
          </div>
        </aside>

        <main className="flex-1 p-6">
          <div className="max-w-7xl mx-auto">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}
