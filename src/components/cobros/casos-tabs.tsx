"use client";

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

/** Pestañas de los casos de contraentrega; cada tabla llega renderizada del servidor. */
export function CasosTabs({
  tabs,
}: {
  tabs: { value: string; label: string; count: number; content: React.ReactNode }[];
}) {
  return (
    <Tabs defaultValue={tabs[0]?.value}>
      <div className="border-t border-border px-5 py-3">
        <TabsList aria-label="Filtrar casos">
          {tabs.map((tab) => (
            <TabsTrigger key={tab.value} value={tab.value}>
              {tab.label}
              <span className="tabular-nums text-muted-foreground">{tab.count}</span>
            </TabsTrigger>
          ))}
        </TabsList>
      </div>
      {tabs.map((tab) => (
        <TabsContent key={tab.value} value={tab.value}>
          {tab.content}
        </TabsContent>
      ))}
    </Tabs>
  );
}
