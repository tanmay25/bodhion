'use client';

import { Suspense, lazy } from 'react';
import { Shell } from '@/components/layout/Shell';
import { PageHeader } from '@/components/shared/PageHeader';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/Tabs';

const ConnectedServicesTab = lazy(() =>
  import('@/components/settings/tabs/ConnectedServicesTab').then((m) => ({
    default: m.ConnectedServicesTab,
  })),
);

function TabSkeleton() {
  return (
    <div className="flex flex-col gap-3 pt-2">
      {[1, 2, 3].map((i) => (
        <div key={i} className="h-16 w-full animate-pulse rounded-xl bg-white/5" />
      ))}
    </div>
  );
}

export default function SettingsPage() {
  return (
    <Shell>
      <div className="flex flex-col gap-6 p-6">
        <PageHeader title="Settings" description="Manage your account and application preferences." />
        <Tabs defaultValue="general">
          <TabsList>
            <TabsTrigger value="general">General</TabsTrigger>
            <TabsTrigger value="account">Account</TabsTrigger>
            <TabsTrigger value="interface">Interface</TabsTrigger>
            <TabsTrigger value="audio">Audio</TabsTrigger>
            <TabsTrigger value="connected-services">Connected Services</TabsTrigger>
          </TabsList>
          <TabsContent value="general">
            <p className="text-sm text-muted-foreground">General settings coming soon.</p>
          </TabsContent>
          <TabsContent value="account">
            <p className="text-sm text-muted-foreground">Account settings coming soon.</p>
          </TabsContent>
          <TabsContent value="interface">
            <p className="text-sm text-muted-foreground">Interface settings coming soon.</p>
          </TabsContent>
          <TabsContent value="audio">
            <p className="text-sm text-muted-foreground">Audio settings coming soon.</p>
          </TabsContent>
          <TabsContent value="connected-services">
            <Suspense fallback={<TabSkeleton />}>
              <ConnectedServicesTab />
            </Suspense>
          </TabsContent>
        </Tabs>
      </div>
    </Shell>
  );
}
