"use client";

import type { EntityEditorShellProps } from "./types";

export function EntityEditorShell({
  title,
  subtitle,
  headerActions,
  sectionNav,
  editor,
  contextPanel,
}: EntityEditorShellProps) {
  return (
    <div className="space-y-4 animate-fade-in">
      <div className="flex flex-col gap-3 border-b pb-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h2 className="text-2xl font-semibold tracking-tight">{title}</h2>
          {subtitle ? <p className="text-sm text-muted-foreground">{subtitle}</p> : null}
        </div>
        {headerActions ? <div className="flex flex-wrap items-center gap-2">{headerActions}</div> : null}
      </div>

      <div className="grid gap-4 lg:grid-cols-[14rem_minmax(0,1fr)] xl:grid-cols-[14rem_minmax(0,1fr)_18rem]">
        <aside className="space-y-2">{sectionNav}</aside>
        <main className="min-w-0">{editor}</main>
        {contextPanel ? <aside className="hidden min-w-0 xl:block">{contextPanel}</aside> : null}
      </div>
    </div>
  );
}

export type { EntityEditorField, EntityEditorSection, EntityEditorSnapshot, EntityPublishPackage } from "./types";
