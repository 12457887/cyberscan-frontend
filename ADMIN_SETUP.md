# Configuration Administrateur CyberScan

## Compte Administrateur par Défaut

Un compte administrateur statique a été créé automatiquement dans la base de données :

**Identifiants Admin :**
- **Email:** `admin@cyberscan.com`
- **Mot de passe:** `Admin@2025!`

### Connexion au Dashboard Admin

1. Allez sur la page de connexion : `/login`
2. Entrez les identifiants admin ci-dessus
3. Une fois connecté, vous verrez le lien "Administration" dans le menu latéral
4. Cliquez sur "Administration" ou accédez directement à `/admin`

**Note importante :** Si c'est votre première connexion après l'installation, vous devrez peut-être vous déconnecter puis vous reconnecter pour que les permissions admin soient correctement chargées.

---

## Comment promouvoir un utilisateur en administrateur

### Méthode 1 : Via Supabase Dashboard (Recommandé)

1. Connectez-vous à votre dashboard Supabase : https://supabase.com/dashboard
2. Sélectionnez votre projet CyberScan
3. Allez dans **Table Editor** > **profiles**
4. Trouvez l'utilisateur que vous souhaitez promouvoir
5. Cliquez sur la ligne de l'utilisateur
6. Modifiez le champ `role` de `client` à `admin`
7. Cliquez sur **Save**

### Méthode 2 : Via SQL Editor

1. Connectez-vous à votre dashboard Supabase
2. Allez dans **SQL Editor**
3. Exécutez cette requête (remplacez l'email par celui de l'utilisateur) :

```sql
-- Mettre à jour le profil
UPDATE profiles
SET role = 'admin'
WHERE email = 'votre-email@example.com';

-- IMPORTANT : Mettre à jour aussi les métadonnées JWT
UPDATE auth.users
SET raw_app_meta_data = raw_app_meta_data || '{"role": "admin"}'::jsonb
WHERE email = 'votre-email@example.com';
```

**Important :** Les deux requêtes sont nécessaires. La première met à jour le profil, la seconde met à jour les métadonnées JWT qui sont utilisées pour les permissions RLS.

### Méthode 3 : Lors de l'inscription (Développement uniquement)

Si vous souhaitez créer directement un compte admin, modifiez temporairement le fichier `contexts/AuthContext.tsx` :

```typescript
// Dans la fonction signUp, remplacez :
role: 'client'

// Par :
role: 'admin'
```

**Important** : N'oubliez pas de remettre `'client'` après avoir créé votre compte admin !

## Accès au Dashboard Admin

Une fois qu'un utilisateur a le rôle `admin` :

1. Connectez-vous normalement à l'application
2. Dans le menu de navigation latéral, vous verrez apparaître une section "Administration"
3. Cliquez sur "Administration" pour accéder au dashboard admin
4. Ou accédez directement à : `/admin`

## Fonctionnalités Admin

Le dashboard admin permet de :
- Voir le nombre total d'utilisateurs
- Voir le nombre total de scans effectués
- Voir les abonnements actifs
- Consulter les utilisateurs récents
- Consulter les scans récents de tous les utilisateurs
- Avoir une vue d'ensemble de l'activité de la plateforme

## Sécurité

- Les routes admin sont protégées côté serveur via RLS (Row Level Security)
- Seuls les utilisateurs avec `role = 'admin'` peuvent voir les données sensibles
- Le dashboard admin n'est visible que pour les utilisateurs admin authentifiés
