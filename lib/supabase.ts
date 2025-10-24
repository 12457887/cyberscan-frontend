import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

export type Profile = {
  id: string;
  email: string;
  full_name: string | null;
  role: 'client' | 'admin';
  created_at: string;
  updated_at: string;
};

export type Subscription = {
  id: string;
  user_id: string;
  plan_type: 'free' | 'basic' | 'pro' | 'enterprise';
  status: 'active' | 'cancelled' | 'expired';
  credits_limit: number;
  started_at: string;
  expires_at: string | null;
  created_at: string;
};

export type Credits = {
  id: string;
  user_id: string;
  total_credits: number;
  used_credits: number;
  remaining_credits: number;
  last_reset_at: string;
  updated_at: string;
};

export type Scan = {
  id: string;
  user_id: string;
  site_name: string;
  site_url: string;
  scan_type: 'light' | 'complete';
  status: 'pending' | 'in_progress' | 'completed' | 'failed';
  risk_level: 'low' | 'medium' | 'high' | 'critical' | null;
  vulnerabilities_count: number;
  mongo_report_id: string | null;
  started_at: string;
  completed_at: string | null;
  created_at: string;
};

export type Vulnerability = {
  id: string;
  scan_id: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  count: number;
  created_at: string;
};

export type Alert = {
  id: string;
  user_id: string;
  scan_id: string | null;
  title: string;
  message: string;
  type: 'scan_complete' | 'vulnerability_found' | 'subscription' | 'system';
  severity: 'info' | 'warning' | 'error';
  is_read: boolean;
  created_at: string;
};
