'use client';

import { useAuth } from '@/contexts/AuthContext';
import { useRouter, usePathname } from 'next/navigation';
import { useEffect, useState, useMemo } from 'react';
import {
  Shield,
  Home,
  BarChart3,
  Scan,
  FileText,
  CreditCard,
  User,
  Bell,
  LogOut,
  Menu,
  X,
  Settings,
  Zap,
  ArrowRight,
  Inbox,
  ScrollText,
  Layers,
  Database,
  CalendarClock,
} from 'lucide-react';
import Link from 'next/link';
import { Logo } from '@/components/Logo';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useSubscriptionPlan } from '@/hooks/use-subscription-plan';
import { Language, useLanguage } from '@/contexts/LanguageContext';
import { supabase } from '@/lib/supabase';

const NAV_ITEMS = [
  { key: 'nav.dashboard', href: '/dashboard', icon: Home },
  { key: 'nav.newScan', href: '/dashboard/scan', icon: Scan },
  { key: 'nav.checkDomain', href: '/dashboard/check-domain', icon: Database },
  { key: 'nav.reports', href: '/dashboard/reports', icon: FileText },
  { key: 'nav.scheduledScans', href: '/dashboard/scheduled-scans', icon: CalendarClock },
  { key: 'nav.detection', href: '/dashboard/detection', icon: Shield },
  { key: 'nav.subscription', href: '/dashboard/subscription', icon: CreditCard },
  { key: 'nav.profile', href: '/dashboard/profile', icon: User },
  { key: 'nav.support', href: '/dashboard?section=support', icon: User },
] as const;

const ADMIN_NAV_ITEMS = [
  { key: 'nav.admin', href: '/admin', icon: Settings },
  { key: 'nav.manageSubscriptions', href: '/admin/subscriptions', icon: Layers },
  { key: 'nav.freeScans', href: '/admin/free-scans', icon: Inbox },
  { key: 'nav.scanLogs', href: '/admin/logs', icon: ScrollText },
  { key: 'nav.apiUsage', href: '/admin/api-usage-statistics', icon: BarChart3 },
  { key: 'nav.refundRequests', href: '/admin/refunds', icon: CreditCard },
] as const;

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const { user, profile, credits, loading, signOut } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const { plan } = useSubscriptionPlan();
  const { t, language, setLanguage, choose } = useLanguage();
  const localize = <T,>(fr: T, en: T) => choose({ fr, en });
  console.log('[DashboardLayout] profile role:', profile?.role, 'plan:', plan);
  const planLabel = useMemo(() => {
    if (!plan) {
      return null;
    }
    return t(`plans.${plan}`, t('plans.unknown'));
  }, [plan, t]);


  useEffect(() => {
    if (!loading && !user) {
      router.push('/login');
    }
  }, [user, loading, router]);

  useEffect(() => {
    if (!user) return;
    const fetchUnreadCount = async () => {
      try {
        const { data: sessionData } = await supabase.auth.getSession();
        const token = sessionData?.session?.access_token;
        const res = await fetch('/api/alerts', {
          headers: token ? { Authorization: `Bearer ${token}` } : {},
          cache: 'no-store',
        });
        if (res.ok) {
          const alerts = await res.json();
          setUnreadCount(alerts.filter((a: { is_read: boolean }) => !a.is_read).length);
        }
      } catch {}
    };
    fetchUnreadCount();
  }, [user]);

  const creditDisplay =
    credits
      ? `${credits.remaining}/${credits.total}`
      : loading
      ? t('header.creditsLoading')
      : profile?.role === 'admin'
      ? t('header.creditsUnlimited')
      : t('header.creditsUnavailable');

  if (loading) {
    return null;
  }

  if (!user) {
    return null;
  }

  const effectivePlan = plan ?? (profile?.role === 'admin' ? 'admin' : 'free');

  const shouldDisplayNavItem = (href: string) => {
    if (profile?.role === 'admin' || effectivePlan === 'admin') {
      return true;
    }
    if (effectivePlan === 'free') {
      return href !== '/dashboard/analyzer' && href !== '/dashboard/detection';
    }
    if (effectivePlan === 'basic') {
      return href !== '/dashboard/analyzer';
    }
    return true;
  };

  const filteredNavigation = NAV_ITEMS.filter((item) => shouldDisplayNavItem(item.href));
  const upgradeTagline = localize('Plus de scans et alertes avancées', 'More scans & advanced alerts');

  const UpgradeButton = () => (
    <Button
      className="group w-full justify-between bg-gradient-to-r from-blue-600 via-indigo-600 to-purple-600 text-white shadow-lg border-0 hover:shadow-2xl transition-all hover:-translate-y-0.5 focus-visible:ring-offset-0"
      asChild
    >
      <Link href="/dashboard/subscription" className="flex w-full items-center justify-between gap-3">
        <div className="text-left">
          <p className="text-sm font-semibold leading-none">{t('header.upgrade')}</p>
          <p className="text-[11px] text-white/80 mt-1 leading-none">{upgradeTagline}</p>
        </div>
        <ArrowRight className="w-4 h-4 transition-transform group-hover:translate-x-1" />
      </Link>
    </Button>
  );


  return (
    <div className="min-h-screen bg-slate-50">
      <nav className="bg-[#1e293b] border-b border-slate-800 text-white sticky top-0 z-50">
        <div className="px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16">
            <div className="flex items-center">
              <div className="flex-shrink-0 flex items-center gap-3">
                <Logo width={65} height={65} className="!justify-start" />
                <span className="text-xl font-bold text-white">{t('common.appName')}</span>
              </div>
            </div>

            <div className="hidden md:flex items-center space-x-4">
              <div className="flex items-center gap-2 rounded-full bg-slate-800/70 border border-slate-700 px-3 py-1 text-xs font-medium text-blue-200">
                <Zap className="w-4 h-4 text-blue-300" />
                <span className="text-slate-100">{t('header.creditsLabel')}</span>
                <span className="text-white">{creditDisplay}</span>
              </div>
              <div className="flex items-center gap-2 text-sm text-slate-200">
                <label htmlFor="language-select" className="text-xs uppercase tracking-wide">
                  {t('language.label')}
                </label>
                <select
                  id="language-select"
                  value={language}
                  onChange={(event) => setLanguage(event.target.value as Language)}
                  className="rounded-md border border-slate-600 bg-slate-800 px-2 py-1 text-sm text-white focus:outline-none focus:ring-2 focus:ring-blue-400"
                >
                  <option value="fr">{t('language.short.fr')}</option>
                  <option value="en">{t('language.short.en')}</option>
                </select>
              </div>
              <Button variant="ghost" size="icon" asChild aria-label={t('common.notifications')} className="relative">
                <Link href="/dashboard/notifications">
                  <Bell className="w-5 h-5 text-white" />
                  {unreadCount > 0 && (
                    <span className="absolute -top-1 -right-1 flex items-center justify-center w-4 h-4 rounded-full bg-red-500 text-white text-[10px] font-bold leading-none">
                      {unreadCount > 99 ? '99+' : unreadCount}
                    </span>
                  )}
                </Link>
              </Button>
              <div className="flex flex-col items-end text-sm text-slate-200">
                <span>{profile?.full_name}</span>
                {planLabel && <span className="text-xs font-medium text-green-400">{planLabel}</span>}
              </div>
              {profile?.role === 'admin' && (
                <Badge variant="secondary" className="bg-slate-800 text-white border-slate-700">
                  {t('common.adminBadge')}
                </Badge>
              )}
              <Button variant="ghost" size="icon" onClick={signOut} className="text-white hover:bg-slate-800">
                <LogOut className="w-5 h-5" />
              </Button>
            </div>

            <div className="md:hidden flex items-center">
              <Button
                variant="ghost"
                size="icon"
                className="text-white hover:bg-slate-800"
                onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              >
                {mobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
              </Button>
            </div>
          </div>
        </div>

        {mobileMenuOpen && (
          <div className="md:hidden border-t border-slate-800 bg-[#111827] text-white">
          <div className="px-2 pt-2 pb-3 space-y-1">
            {filteredNavigation.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  className="block px-3 py-2 rounded-md text-base font-medium text-slate-100 hover:bg-slate-900"
                  onClick={() => setMobileMenuOpen(false)}
                >
                  {t(item.key)}
                </Link>
              ))}
              <div className="px-3 py-2">
                <UpgradeButton />
              </div>
              <div className="px-3 py-2 space-y-3">
                <label htmlFor="language-select-mobile" className="text-xs uppercase tracking-wide text-slate-300">
                  {t('language.label')}
                </label>
                <select
                  id="language-select-mobile"
                  value={language}
                  onChange={(event) => setLanguage(event.target.value as Language)}
                  className="mt-1 block w-full rounded-md border border-slate-600 bg-slate-900 px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-blue-400"
                >
                  <option value="fr">{t('language.short.fr')}</option>
                  <option value="en">{t('language.short.en')}</option>
                </select>
                <div className="flex items-center gap-2 rounded-full bg-slate-900 border border-slate-700 px-3 py-1 text-xs font-medium text-blue-200">
                  <Zap className="w-4 h-4 text-blue-300" />
                  <span className="text-slate-100">{t('header.creditsLabel')}</span>
                  <span className="text-white">{creditDisplay}</span>
                </div>
              </div>
              <button
                onClick={signOut}
                className="block w-full text-left px-3 py-2 rounded-md text-base font-medium text-slate-100 hover:bg-slate-900"
              >
                {t('nav.logout')}
              </button>
            </div>
          </div>
        )}
      </nav>

      <div className="flex">
        <aside className="hidden md:flex md:flex-shrink-0">
          <div className="flex flex-col w-56 bg-[#1e293b] border-r border-slate-800/60 h-[calc(100vh-4rem)] sticky top-16 shadow-xl">
            <div className="flex-1 overflow-y-auto px-3 py-5 space-y-0.5 text-white scrollbar-thin scrollbar-thumb-slate-700 scrollbar-track-transparent">
              {filteredNavigation.map((item) => {
                const Icon = item.icon;
                const isActive = pathname === item.href;
                const label = t(item.key);
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={`group flex items-center px-3 py-2 text-sm font-medium rounded-lg transition-all duration-150 relative ${
                      isActive
                        ? 'bg-blue-600/20 text-white ring-1 ring-blue-500/30'
                        : 'text-white hover:bg-slate-800/70 hover:text-white'
                    }`}
                  >
                    {isActive && (
                      <span className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-5 bg-blue-500 rounded-r-full" />
                    )}
                    <Icon className={`w-4 h-4 mr-3 flex-shrink-0 transition-colors ${isActive ? 'text-blue-300' : 'text-white/70 group-hover:text-white'}`} />
                    <span className="leading-tight">{label}</span>
                  </Link>
                );
              })}

              {profile?.role === 'admin' && (
                <>
                  <div className="my-4 flex items-center gap-2 px-3">
                    <div className="flex-1 border-t border-slate-700/60" />
                    <span className="text-[10px] font-semibold uppercase tracking-widest text-slate-500">Admin</span>
                    <div className="flex-1 border-t border-slate-700/60" />
                  </div>
                  {ADMIN_NAV_ITEMS.map((item) => {
                    const Icon = item.icon;
                    const isActive = pathname === item.href;
                    return (
                      <Link
                        key={item.href}
                        href={item.href}
                        className={`group flex items-center px-3 py-2 text-sm font-medium rounded-lg transition-all duration-150 relative ${
                          isActive
                            ? 'bg-orange-500/20 text-white ring-1 ring-orange-500/30'
                            : 'text-white hover:bg-slate-800/70 hover:text-white'
                        }`}
                      >
                        {isActive && (
                          <span className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-5 bg-orange-500 rounded-r-full" />
                        )}
                        <Icon className={`w-4 h-4 mr-3 flex-shrink-0 transition-colors ${isActive ? 'text-orange-300' : 'text-white/70 group-hover:text-white'}`} />
                        <span className="leading-tight">{t(item.key)}</span>
                      </Link>
                    );
                  })}
                </>
              )}
              <div className="mt-6 px-1">
                <UpgradeButton />
              </div>
            </div>
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
