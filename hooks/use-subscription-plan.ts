'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';

export type SubscriptionPlan = 'free' | 'basic' | 'pro' | 'enterprise' | 'admin';

export function useSubscriptionPlan() {
  const { user, profile } = useAuth();
  const [plan, setPlan] = useState<SubscriptionPlan | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let isMounted = true;

    if (!user) {
      setPlan(null);
      setLoading(false);
      return () => {
        isMounted = false;
      };
    }

    if (profile?.role === 'admin') {
      setPlan('admin');
      setLoading(false);
      return () => {
        isMounted = false;
      };
    }

    const fetchPlan = async () => {
      try {
        setLoading(true);
        const { data, error } = await supabase
          .from('subscriptions')
          .select('plan_type')
          .eq('user_id', user.id)
          .maybeSingle();

        if (!isMounted) return;

        if (error) {
          console.error('Error fetching subscription plan:', error);
          setPlan('free');
        } else if (data?.plan_type) {
          setPlan(data.plan_type);
        } else {
          setPlan('free');
        }
      } catch (err) {
        if (!isMounted) return;
        console.error('Error fetching subscription plan:', err);
        setPlan('free');
      } finally {
        if (isMounted) setLoading(false);
      }
    };

    fetchPlan();

    return () => {
      isMounted = false;
    };
  }, [user, profile?.role]);

  return { plan, loading };
}
