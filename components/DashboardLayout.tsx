'use client';

import { useAuth } from '@/contexts/AuthContext';
import { useRouter, usePathname } from 'next/navigation';
import { useEffect, useState, useMemo } from 'react';
import { Shield, Home, Scan, FileText, CreditCard, User, Bell, LogOut, Menu, X, Settings, Zap, ArrowRight } from 'lucide-react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useSubscriptionPlan } from '@/hooks/use-subscription-plan';
import { Language, useLanguage } from '@/contexts/LanguageContext';

const NAV_ITEMS = [
  { key: 'nav.dashboard', href: '/dashboard', icon: Home },
  { key: 'nav.newScan', href: '/dashboard/scan', icon: Scan },
  { key: 'nav.reports', href: '/dashboard/reports', icon: FileText },
  { key: 'nav.detection', href: '/dashboard/detection', icon: Shield },
  { key: 'nav.subscription', href: '/dashboard/subscription', icon: CreditCard },
  { key: 'nav.profile', href: '/dashboard/profile', icon: User },
  { key: 'nav.support', href: '/dashboard?section=support', icon: User },
] as const;

const ADMIN_NAV_ITEMS = [{ key: 'nav.admin', href: '/admin', icon: Settings }] as const;

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const { user, profile, credits, loading, signOut } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const { plan } = useSubscriptionPlan();
  const { t, language, setLanguage, choose } = useLanguage();
  const localize = <T,>(fr: T, en: T) => choose({ fr, en });
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

  const creditDisplay =
    credits
      ? `${credits.remaining}/${credits.total}`
      : loading
      ? t('header.creditsLoading')
      : profile?.role === 'admin'
      ? t('header.creditsUnlimited')
      : t('header.creditsUnavailable');

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="text-center">
          <Shield className="w-12 h-12 text-blue-600 mx-auto mb-4 animate-pulse" />
          <p className="text-slate-600">{t('common.loading')}</p>
        </div>
      </div>
    );
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
      <nav className="bg-white border-b border-slate-200 sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16">
            <div className="flex items-center">
              <div className="flex-shrink-0 flex items-center">
                <Shield className="w-8 h-8 text-blue-600" />
                <span className="ml-2 text-xl font-bold text-slate-900">{t('common.appName')}</span>
              </div>
            </div>

            <div className="hidden md:flex items-center space-x-4">
              <div className="flex items-center gap-2 rounded-full bg-blue-50 border border-blue-100 px-3 py-1 text-xs font-medium text-blue-700">
                <Zap className="w-4 h-4" />
                <span>{t('header.creditsLabel')}</span>
                <span className="text-slate-900">{creditDisplay}</span>
              </div>
              <div className="flex items-center gap-2 text-sm text-slate-500">
                <label htmlFor="language-select" className="text-xs uppercase tracking-wide">
                  {t('language.label')}
                </label>
                <select
                  id="language-select"
                  value={language}
                  onChange={(event) => setLanguage(event.target.value as Language)}
                  className="rounded-md border border-slate-200 bg-white px-2 py-1 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="fr">{t('language.short.fr')}</option>
                  <option value="en">{t('language.short.en')}</option>
                </select>
              </div>
              <Button variant="ghost" size="icon" asChild aria-label={t('common.notifications')}>
                <Link href="/dashboard/notifications">
                  <Bell className="w-5 h-5" />
                </Link>
              </Button>
              <div className="flex flex-col items-end text-sm text-slate-600">
                <span>{profile?.full_name}</span>
                {planLabel && <span className="text-xs font-medium text-green-600">{planLabel}</span>}
              </div>
              {profile?.role === 'admin' && (
                <Badge variant="secondary">{t('common.adminBadge')}</Badge>
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
            {filteredNavigation.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  className="block px-3 py-2 rounded-md text-base font-medium text-slate-700 hover:bg-slate-100"
                  onClick={() => setMobileMenuOpen(false)}
                >
                  {t(item.key)}
                </Link>
              ))}
              <div className="px-3 py-2">
                <UpgradeButton />
              </div>
              <div className="px-3 py-2 space-y-3">
                <label htmlFor="language-select-mobile" className="text-xs uppercase tracking-wide text-slate-500">
                  {t('language.label')}
                </label>
                <select
                  id="language-select-mobile"
                  value={language}
                  onChange={(event) => setLanguage(event.target.value as Language)}
                  className="mt-1 block w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="fr">{t('language.short.fr')}</option>
                  <option value="en">{t('language.short.en')}</option>
                </select>
                <div className="flex items-center gap-2 rounded-full bg-blue-50 border border-blue-100 px-3 py-1 text-xs font-medium text-blue-700">
                  <Zap className="w-4 h-4" />
                  <span>{t('header.creditsLabel')}</span>
                  <span className="text-slate-900">{creditDisplay}</span>
                </div>
              </div>
              <button
                onClick={signOut}
                className="block w-full text-left px-3 py-2 rounded-md text-base font-medium text-slate-700 hover:bg-slate-100"
              >
                {t('nav.logout')}
              </button>
            </div>
          </div>
        )}
      </nav>

      <div className="flex">
        <aside className="hidden md:flex md:flex-shrink-0">
          <div className="flex flex-col w-64 bg-white border-r border-slate-200 h-[calc(100vh-4rem)] sticky top-16">
            <nav className="flex-1 px-4 py-6 space-y-1">
              {filteredNavigation.map((item) => {
                const Icon = item.icon;
                const isActive = pathname === item.href;
                const label = t(item.key);
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={`flex items-center px-4 py-3 text-sm font-medium rounded-lg transition-colors ${
                      isActive
                        ? 'bg-blue-50 text-blue-700'
                        : 'text-slate-700 hover:bg-slate-100'
                    }`}
                  >
                    <Icon className={`w-5 h-5 mr-3 ${isActive ? 'text-blue-700' : 'text-slate-500'}`} />
                    {label}
                  </Link>
                );
              })}

              {profile?.role === 'admin' && (
                <>
                  <div className="border-t border-slate-200 my-4"></div>
                  {ADMIN_NAV_ITEMS.map((item) => {
                    const Icon = item.icon;
                    const isActive = pathname === item.href;
                    return (
                      <Link
                        key={item.href}
                        href={item.href}
                        className={`flex items-center px-4 py-3 text-sm font-medium rounded-lg transition-colors ${
                          isActive
                            ? 'bg-orange-50 text-orange-700'
                            : 'text-slate-700 hover:bg-slate-100'
                        }`}
                      >
                        <Icon className={`w-5 h-5 mr-3 ${isActive ? 'text-orange-700' : 'text-slate-500'}`} />
                        {t(item.key)}
                      </Link>
                    );
                  })}
                </>
              )}
              <div className="mt-6">
                <UpgradeButton />
              </div>
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
