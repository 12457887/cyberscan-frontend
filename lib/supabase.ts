import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

export type Profile = {
  id: string;
  email: string;
  full_name: string | null;
  phone_number?: string | null;
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
  updated_at: string | null;
};

export type SubscriptionHistory = {
  id: string;
  subscription_id?: string | null;
  user_id: string;
  plan_type?: 'free' | 'basic' | 'pro' | 'enterprise' | string | null;
  status?: 'active' | 'cancelled' | 'expired' | string | null;
  credits_limit?: number | null;
  started_at?: string | null;
  expires_at?: string | null;
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
  cms_type: string | null;
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

export type Ticket = {
  id: string;
  user_id: string;
  title: string;
  description: string;
  phone_number?: string | null;
  contact_email?: string | null;
  attachment_url?: string | null;
  attachment_name?: string | null;
  status: 'open' | 'in_progress' | 'resolved' | 'closed';
  priority: 'low' | 'medium' | 'high';
  created_at: string;
  updated_at: string;
  admin_response?: string | null;
  admin_response_at?: string | null;
  admin_response_by?: string | null;
  profiles?: {
    email: string | null;
    full_name: string | null;
  } | null;
  creator_email?: string | null;
};

export type RefundRequest = {
  id: string;
  user_id: string;
  invoice_id?: string | null;
  invoice_number?: string | null;
  stripe_invoice_id?: string | null;
  stripe_payment_intent_id?: string | null;
  stripe_charge_id?: string | null;
  stripe_checkout_session_id?: string | null;
  amount_cents?: number | null;
  currency?: string | null;
  reason?: string | null;
  status: 'pending' | 'approved' | 'accepted' | 'rejected';
  admin_id?: string | null;
  decision_reason?: string | null;
  stripe_refund_id?: string | null;
  decided_at?: string | null;
  created_at: string;
  profiles?: { email: string | null; full_name: string | null } | null;
};

export type ScheduledScan = {
  id: string;
  user_id: string;
  site_url: string;
  site_name?: string | null;
  scan_type: 'light' | 'complete';
  frequency: 'weekly' | 'monthly';
  next_scan_date: string;
  last_scan_date: string | null;
  is_active: boolean;
  is_running: boolean;
  created_at: string;
  updated_at: string;
};

export type Invoice = {
  id: string;
  user_id: string;
  plan_type: string;
  invoice_id?: string | null;
  hosted_invoice_url?: string | null;
  invoice_pdf_url?: string | null;
  customer_email?: string | null;
  payment_status?: string | null;
  currency?: string | null;
  amount_total_cents?: number | null;
  amount_subtotal_cents?: number | null;
  tax_amount_cents?: number | null;
  stripe_payment_intent_id?: string | null;
  stripe_checkout_session_id?: string | null;
  card_brand?: string | null;
  card_last4?: string | null;
  created_at: string;
};
