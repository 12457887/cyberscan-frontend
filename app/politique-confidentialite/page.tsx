'use client';

import Link from 'next/link';

const sections = [
  {
    title: '1. Data Controller',
    body:
      'CyberScan (Securas Technologies) is the controller for the personal data collected via the Platform and related services.'
  },
  {
    title: '2. Data We Collect',
    list: [
      'Account data (name, email, authentication identifiers).',
      'Billing and subscription data (plan, status, payment reference).',
      'Scan metadata (target URLs, scan results, timestamps).',
      'Support communications and contact messages.'
    ]
  },
  {
    title: '3. Why We Process Data',
    list: [
      'Provide and maintain the Platform and its security features.',
      'Generate reports, dashboards, and alerts you request.',
      'Handle billing, accounting, and legal obligations.',
      'Answer support requests and improve the service.'
    ]
  },
  {
    title: '4. Legal Bases',
    body:
      'We rely on contract performance (delivering the service you requested), legitimate interests (platform security, product improvement), and compliance with legal obligations. When required, we obtain your consent (for optional communications).'
  },
  {
    title: '5. Sharing and Transfers',
    body:
      'We use trusted sub-processors (hosting, analytics, payment providers) that offer adequate safeguards. Data may be transferred outside the EU/EEA with standard contractual clauses or equivalent guarantees.'
  },
  {
    title: '6. Retention',
    body:
      'Account data is kept for the duration of the contract and deleted or anonymized within a reasonable time after termination, unless we must keep it for legal reasons. Scan results can be deleted by customers at any time or automatically after the retention period defined in the contract.'
  },
  {
    title: '7. Your Rights',
    list: [
      'Access, rectification, deletion, or portability of your personal data.',
      'Restriction or objection to processing in certain cases.',
      'Withdrawal of consent when processing is based on consent.',
      'Lodging a complaint with your local data protection authority.'
    ]
  },
  {
    title: '8. Security',
    body:
      'CyberScan applies access controls, encryption, monitoring, and disaster recovery procedures to protect stored data. We review our security posture regularly and restrict access to personnel who require it.'
  },
  {
    title: '9. Contact',
    body:
      'Reach out at privacy@securas.fr or by using the contact form on the website. We will answer any privacy-related request as soon as possible.'
  }
];

export default function PrivacyPolicyPage() {
  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 py-16 px-4">
      <div className="max-w-4xl mx-auto bg-slate-900/70 backdrop-blur rounded-3xl border border-slate-800 shadow-2xl p-8 md:p-12 space-y-8">
        <header className="space-y-3">
          <p className="text-sm uppercase tracking-widest text-blue-400">CyberScan</p>
          <h1 className="text-3xl md:text-4xl font-semibold text-white">Privacy Policy</h1>
          <p className="text-sm text-slate-400">Last updated: {new Date().toLocaleDateString('en-US')}</p>
        </header>

        <section className="space-y-8">
          {sections.map((section) => (
            <div key={section.title} className="rounded-2xl border border-slate-800 bg-slate-900/50 p-6">
              <h2 className="text-xl font-semibold text-white mb-4">{section.title}</h2>
              {section.body && <p className="text-slate-300 leading-relaxed">{section.body}</p>}
              {section.list && (
                <ul className="list-disc pl-5 text-slate-300 space-y-1">
                  {section.list.map((item) => (
                    <li key={item}>{item}</li>
                  ))}
                </ul>
              )}
            </div>
          ))}
        </section>

        <footer className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between text-sm text-slate-400">
          <span>Questions? Email privacy@securas.fr.</span>
          <Link href="/register" className="text-blue-400 hover:text-blue-300 font-medium">
            Back to signup
          </Link>
        </footer>
      </div>
    </div>
  );
}
