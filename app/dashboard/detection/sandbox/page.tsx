'use client';

import { useState } from 'react';
import DashboardLayout from '@/components/DashboardLayout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { AlertCircle, CheckCircle2, PlayCircle } from 'lucide-react';

type SandboxEnvironment = {
  name: string;
  type: 'wordpress' | 'drupal' | 'prestashop';
  version: string;
  status: 'ready' | 'starting' | 'stopped' | 'error';
  url?: string;
  error?: string;
};

export default function SandboxPage() {
  const [environments, setEnvironments] = useState<SandboxEnvironment[]>([]);
  const [selectedType, setSelectedType] = useState<string>('wordpress');
  const [selectedVersion, setSelectedVersion] = useState<string>('');
  const [envName, setEnvName] = useState('');
  const [isCreating, setIsCreating] = useState(false);

  // Versions disponibles par CMS
  const versions = {
    wordpress: ['6.4.2', '6.3.2', '5.9.3'],
    drupal: ['10.1.6', '9.5.11', '7.98'],
    prestashop: ['8.1.2', '1.7.8.9', '1.6.1.24']
  };

  const handleCreateEnvironment = async () => {
    if (!envName || !selectedType || !selectedVersion) return;

    setIsCreating(true);
    try {
      const response = await fetch('/api/sandbox/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: envName,
          type: selectedType,
          version: selectedVersion
        }),
      });

      if (!response.ok) throw new Error('Erreur lors de la création de l\'environnement');

      const newEnv = await response.json();
      setEnvironments(prev => [...prev, {
        name: envName,
        type: selectedType as any,
        version: selectedVersion,
        status: 'starting',
      }]);

      setEnvName('');
    } catch (error) {
      console.error('Erreur:', error);
    } finally {
      setIsCreating(false);
    }
  };

  const handleStartStop = async (env: SandboxEnvironment, action: 'start' | 'stop') => {
    try {
      const response = await fetch(`/api/sandbox/${action}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: env.name }),
      });

      if (!response.ok) throw new Error(`Erreur lors de l'action ${action}`);

      setEnvironments(prev => prev.map(e => {
        if (e.name === env.name) {
          return {
            ...e,
            status: action === 'start' ? 'starting' : 'stopped'
          };
        }
        return e;
      }));
    } catch (error) {
      console.error('Erreur:', error);
    }
  };

  return (
    <DashboardLayout>
      <div className="p-6 space-y-6">
        <div>
          <h1 className="text-2xl font-bold">Environnement Sandbox</h1>
          <p className="text-slate-600 mt-1">
            Créez et gérez des environnements CMS isolés pour vos tests
          </p>
        </div>

        <Tabs defaultValue="create">
          <TabsList>
            <TabsTrigger value="create">Créer un environnement</TabsTrigger>
            <TabsTrigger value="manage">Gérer les environnements</TabsTrigger>
          </TabsList>

          <TabsContent value="create">
            <Card>
              <CardHeader>
                <CardTitle>Nouvel environnement</CardTitle>
                <CardDescription>
                  Configurez un nouvel environnement CMS isolé pour vos tests
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid gap-4">
                  <div className="grid gap-2">
                    <label className="text-sm font-medium">Nom de l'environnement</label>
                    <Input
                      placeholder="mon-env-test"
                      value={envName}
                      onChange={e => setEnvName(e.target.value)}
                    />
                  </div>

                  <div className="grid gap-2">
                    <label className="text-sm font-medium">Type de CMS</label>
                    <Select value={selectedType} onValueChange={setSelectedType}>
                      <SelectTrigger>
                        <SelectValue placeholder="Sélectionnez un CMS" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="wordpress">WordPress</SelectItem>
                        <SelectItem value="drupal">Drupal</SelectItem>
                        <SelectItem value="prestashop">PrestaShop</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="grid gap-2">
                    <label className="text-sm font-medium">Version</label>
                    <Select value={selectedVersion} onValueChange={setSelectedVersion}>
                      <SelectTrigger>
                        <SelectValue placeholder="Sélectionnez une version" />
                      </SelectTrigger>
                      <SelectContent>
                        {versions[selectedType as keyof typeof versions]?.map(version => (
                          <SelectItem key={version} value={version}>
                            {version}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <Button
                    onClick={handleCreateEnvironment}
                    disabled={isCreating || !envName || !selectedVersion}
                  >
                    {isCreating ? 'Création...' : 'Créer l\'environnement'}
                  </Button>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="manage">
            <Card>
              <CardHeader>
                <CardTitle>Environnements actifs</CardTitle>
                <CardDescription>
                  Gérez vos environnements de test CMS
                </CardDescription>
              </CardHeader>
              <CardContent>
                {environments.length === 0 ? (
                  <p className="text-center text-slate-500 py-8">
                    Aucun environnement créé. Commencez par en créer un !
                  </p>
                ) : (
                  <div className="space-y-4">
                    {environments.map((env) => (
                      <div
                        key={env.name}
                        className="border rounded-lg p-4 flex items-center justify-between"
                      >
                        <div>
                          <h3 className="font-medium">{env.name}</h3>
                          <div className="text-sm text-slate-500">
                            {env.type} {env.version}
                          </div>
                          <div className="flex items-center mt-1 text-sm">
                            {env.status === 'ready' && (
                              <CheckCircle2 className="w-4 h-4 text-green-500 mr-1" />
                            )}
                            {env.status === 'error' && (
                              <AlertCircle className="w-4 h-4 text-red-500 mr-1" />
                            )}
                            {env.status === 'starting' && (
                              <PlayCircle className="w-4 h-4 text-blue-500 mr-1" />
                            )}
                            <span className={
                              env.status === 'ready' ? 'text-green-600' :
                              env.status === 'error' ? 'text-red-600' :
                              env.status === 'starting' ? 'text-blue-600' :
                              'text-slate-600'
                            }>
                              {env.status === 'ready' ? 'Prêt' :
                               env.status === 'error' ? 'Erreur' :
                               env.status === 'starting' ? 'Démarrage' :
                               'Arrêté'}
                            </span>
                          </div>
                        </div>
                        <div className="flex gap-2">
                          {env.url && (
                            <Button variant="outline" size="sm" asChild>
                              <a href={env.url} target="_blank" rel="noopener noreferrer">
                                Ouvrir
                              </a>
                            </Button>
                          )}
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleStartStop(env, env.status === 'stopped' ? 'start' : 'stop')}
                          >
                            {env.status === 'stopped' ? 'Démarrer' : 'Arrêter'}
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </DashboardLayout>
  );
}