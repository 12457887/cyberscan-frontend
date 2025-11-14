'use client';

import Link from 'next/link';

const sections = [
  {
    title: '1. Objet et champ d’application',
    body:
      "Les présentes conditions générales de vente et d’utilisation (CGVU) encadrent l’accès à la plateforme CyberScan ainsi que les services associés (détection de CMS, scans automatisés et génération de rapports). Toute création de compte ou utilisation du service implique l’acceptation pleine et entière des présentes conditions."
  },
  {
    title: '2. Définitions',
    list: [
      'Plateforme : l’application web CyberScan permettant de détecter des CMS et d’exécuter des scans de vulnérabilités.',
      "Utilisateur : toute personne ou entité disposant d'un accès à la Plateforme.",
      "Client : l’Utilisateur bénéficiant d’un contrat commercial lui donnant droit à l’usage du service.",
      'Rapport : le document (PDF/ZIP) contenant les résultats de scans réalisés via la Plateforme.'
    ]
  },
  {
    title: '3. Conditions d’accès et d’utilisation',
    list: [
      "L’Utilisateur doit disposer des droits ou autorisations nécessaires sur les domaines ou applications scannés.",
      'La Plateforme doit être utilisée conformément aux lois et règlements en vigueur, notamment en matière de cybersécurité.',
      "Le Client est responsable de la confidentialité de ses identifiants et de toute action réalisée depuis son compte."
    ]
  },
  {
    title: '4. Services fournis',
    body:
      "CyberScan propose la détection automatique du CMS cible, l’exécution de scans « light » ou « complete » basés sur des signatures connues, ainsi que la génération de rapports destinés aux équipes de sécurité. Les résultats sont des indicateurs à interpréter par des professionnels qualifiés."
  },
  {
    title: '5. Modalités financières',
    body:
      "Sauf stipulation contraire, les prix sont exprimés en euros hors taxes et facturés à la commande. Les licences ou abonnements prennent effet à la date de mise à disposition du service. Tout retard de paiement entraîne l’application d’intérêts légaux et de frais de recouvrement."
  },
  {
    title: '6. Obligations de l’Utilisateur',
    list: [
      "Fournir des informations exactes pour l’ouverture et la gestion de son compte.",
      'Veiller à ce que tout fichier transmis à la Plateforme soit exempt de code malveillant.',
      "Notifier immédiatement l’éditeur de toute faille de sécurité ou utilisation non autorisée de ses comptes."
    ]
  },
  {
    title: '7. Limites de responsabilité',
    body:
      "Les résultats fournis par la Plateforme sont basés sur des modèles automatisés et ne garantissent pas l’absence de vulnérabilités. L’éditeur ne saurait être tenu responsable des dommages indirects, pertes d’exploitation ou atteintes à l’image résultant de l’usage du service. La responsabilité globale est limitée au montant des sommes versées sur les douze derniers mois."
  },
  {
    title: '8. Propriété intellectuelle',
    body:
      "La Plateforme, son code source, ses interfaces, logos et rapports restent la propriété exclusive de l’éditeur. Toute reproduction, diffusion ou exploitation non autorisée est strictement interdite."
  },
  {
    title: '9. Données personnelles et confidentialité',
    body:
      "Les données collectées (URLs, résultats, informations de compte) sont traitées conformément à la réglementation applicable et uniquement aux fins d’exécution du service. L’éditeur met en œuvre les mesures nécessaires pour en préserver la confidentialité."
  },
  {
    title: '10. Durée, suspension et résiliation',
    body:
      "Les CGVU s’appliquent pendant toute la durée d’utilisation de la Plateforme. L’éditeur peut suspendre un accès en cas de manquement grave, d’usage frauduleux ou de non-paiement. Chaque partie peut résilier avec un préavis écrit de 30 jours, sauf faute justifiant une résiliation immédiate."
  },
  {
    title: '11. Évolution des services et des CGVU',
    body:
      "L’éditeur se réserve le droit de faire évoluer la Plateforme ou d’actualiser les présentes CGVU. Les Utilisateurs sont informés de toute modification substantielle, l’usage continu du service valant acceptation."
  },
  {
    title: '12. Droit applicable et règlement des litiges',
    body:
      "Les CGVU sont soumises au droit français. En cas de litige, les parties rechercheront une solution amiable. À défaut d’accord dans un délai de 30 jours, compétence exclusive est attribuée aux tribunaux du siège de l’éditeur."
  }
];

export default function TermsPage() {
  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 py-16 px-4">
      <div className="max-w-4xl mx-auto bg-slate-900/70 backdrop-blur rounded-3xl border border-slate-800 shadow-2xl p-8 md:p-12 space-y-8">
        <header className="space-y-3">
          <p className="text-sm uppercase tracking-widest text-blue-400">CyberScan</p>
          <h1 className="text-3xl md:text-4xl font-semibold text-white">Conditions générales de vente et d&apos;utilisation</h1>
          <p className="text-sm text-slate-400">
            Dernière mise à jour : {new Date().toLocaleDateString('fr-FR')}
          </p>
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
          <span>Pour toute question, contactez votre interlocuteur CyberScan habituel.</span>
          <Link href="/register" className="text-blue-400 hover:text-blue-300 font-medium">
            Retour à l’inscription
          </Link>
        </footer>
      </div>
    </div>
  );
}
