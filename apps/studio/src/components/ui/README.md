# FarmacoGraph Studio UI

Reusable design system primitives for Studio. Built with **shadcn/ui** patterns, **Radix UI**, **Tailwind CSS**, and **class-variance-authority**.

## Import

```tsx
import { Button, Card, Table, EmptyState } from "@/components/ui";
```

## Design tokens

Colors and radii come from CSS variables in `src/app/globals.css`:

| Token | Usage |
|-------|-------|
| `--primary` | Primary actions, links |
| `--destructive` | Errors, danger states |
| `--muted` | Subtle backgrounds, secondary text |
| `--border` | Borders, dividers |
| `--radius` | Border radius (`rounded-lg`, etc.) |
| `--sidebar-*` | Navigation chrome |

Dark mode is toggled via the `dark` class on `<html>` (see `ThemeProvider`).

## Components

### Actions
- **Button** — `variant`: default, secondary, ghost, outline, destructive, link; `size`: default, sm, lg, icon

### Layout & containers
- **Card** — `CardHeader`, `CardTitle`, `CardDescription`, `CardContent`, `CardFooter`
- **Separator**, **ScrollArea**

### Data
- **Table** — composable table primitives
- **Timeline** — vertical activity feed

### Overlays
- **Dialog** — centered modal
- **Drawer** — slide-in panel (`side`: right, left, bottom)

### Forms
- **Form** — react-hook-form integration (`FormField`, `FormItem`, `FormLabel`, etc.)
- **Input**, **Textarea**, **Label**
- **SearchInput** — icon + optional clear button
- **PropertyEditor** — key-value field list for detail panels

### Feedback
- **Skeleton** — base pulse placeholder
- **Loading skeletons** — `CardSkeleton`, `TableSkeleton`, `ListSkeleton`, `StatGridSkeleton`, `PageHeaderSkeleton`
- **EmptyState** — dashed border placeholder with optional action
- **ErrorState** — card or inline error with optional retry

### Badges
- **Badge** — base badge with color variants
- **ValidationBadge** — valid / invalid / pending
- **ConfidenceBadge** — high / medium / low (+ optional score)
- **EvidenceBadge** — primary / secondary / tertiary / unsupported
- **StatusBadge** — active / inactive / draft / archived / error / processing

## Examples

```tsx
// Search with clear
<SearchInput value={query} onChange={(e) => setQuery(e.target.value)} onClear={() => setQuery("")} />

// Property editor
<PropertyEditor
  title="Details"
  fields={[
    { key: "name", label: "Name", value: name, onFieldChange: setName },
    { key: "id", label: "ID", value: id, type: "readonly" },
  ]}
  onFieldChange={(key, value) => updateField(key, value)}
/>

// Empty / error states
<EmptyState title="No results" description="Try adjusting your filters." actionLabel="Reset" onAction={reset} />
<ErrorState message="Failed to load data." onRetry={refetch} />

// Semantic badges
<ValidationBadge status="pending" />
<ConfidenceBadge level="high" score={92} />
<StatusBadge status="processing" />
```

## Conventions

- Use `cn()` from `@/lib/utils` for class merging
- Prefer composition over one-off styled divs
- Keep business logic in feature modules — these components are presentation-only
