'use client';

import { Shell } from '@/components/layout/Shell';
import { PageHeader } from '@/components/shared/PageHeader';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/Tabs';

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
        </Tabs>
      </div>
    </Shell>
  );
}
