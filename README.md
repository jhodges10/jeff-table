# Jeff Table

A strongly typed, virtualized, themeable React data grid built on TanStack Table v9. It consolidates the best behavior from the HOPS, Compflow, and Pullit grids into one package without depending on any of their UI kits.

## What was carried forward

| Source | Consolidated behavior |
| --- | --- |
| HOPS | Stable row-ID requirement for selection, Shift range selection through v9, deterministic skeleton widths, per-column skeleton shapes, column formatting/alignment, and thorough interaction coverage |
| Compflow | TanStack v9 feature gating and exported feature-aware types, unified column preferences, drag/resize separation, inline filters, and the sticky far-right Columns control |
| Pullit | Presentation-only section headers that participate in virtualization without changing the flat column contract |

The package currently targets React 19 and TanStack Table v9. `totalCount` is required by design: it lets the grid establish a correct scroll model and record count before all server pages have loaded.

## Install

### shadcn registry

Install the complete source-owned component into your configured shadcn `ui` directory:

```sh
bunx shadcn@latest add https://jeff-table.vercel.app/r/data-grid.json
```

Or register the hosted catalog in your `components.json`:

```json
{
  "registries": {
    "jeff-table": {
      "url": "https://jeff-table.vercel.app/r/{name}.json"
    }
  }
}
```

Then install by namespace:

```sh
bunx shadcn@latest add @jeff-table/data-grid
```

You can also install directly from the public GitHub source registry without waiting for a hosted
registry build:

```sh
bunx shadcn@latest add jhodges10/jeff-table/data-grid
```

The registry item installs the required TanStack and date-picker dependencies, then writes the
component source to `@ui/jeff-table`. Import it through the generated source entry point:

```tsx
import { DataGrid, type DataGridColumnDef } from "@/components/ui/jeff-table";
```

Its stylesheet maps the DataGrid theme to shadcn's `background`, `foreground`, `primary`, `muted`,
`accent`, `border`, `destructive`, and `radius` variables, while retaining standalone fallbacks and
the existing typed `theme` overrides.

### Package

```sh
bun add @jhodges/jeff-table
```

The default stylesheet is included by the package entry. It is also exported as `@jhodges/jeff-table/styles.css` for build systems that prefer an explicit CSS entry.

## Quick start

```tsx
import {
  DataGrid,
  type DataGridColumnDef,
} from "@jhodges/jeff-table";

interface User {
  id: string;
  name: string;
  email: string;
  status: "active" | "paused";
}

const columns: DataGridColumnDef<User>[] = [
  {
    accessorKey: "name",
    enableHiding: false,
    header: "Name",
    meta: {
      filter: { type: "text", placeholder: "Find a name…" },
      minWidth: 180,
      width: "minmax(180px, 1fr)",
    },
  },
  { accessorKey: "email", header: "Email", meta: { width: "1.5fr" } },
  {
    accessorKey: "status",
    header: "Status",
    meta: {
      filter: {
        type: "single-select",
        options: [
          { label: "Active", value: "active" },
          { label: "Paused", value: "paused" },
        ],
      },
    },
  },
];

export function UsersGrid({ users, totalCount }: { users: User[]; totalCount: number }) {
  return (
    <DataGrid
      aria-label="Users"
      columns={columns}
      data={users}
      totalCount={totalCount}
      getRowId={(user) => user.id}
      enableColumnFiltering
      enableColumnReordering
      enableColumnResizing
      enableColumnVisibility
      tableId="users"
    />
  );
}
```

Use this package's `DataGridColumnDef<T>` alias instead of importing `ColumnDef` directly from TanStack. V9 includes the registered feature set in its column, row, header, and table generics; the exported alias preserves that complete contract, including typed `meta`.

## Virtualization and loading

Virtualization is on by default. The viewport derives a useful height from `totalCount`, `rowHeight`, and `maxVisibleRows`; pass `height` when the parent owns the exact size.

```tsx
<DataGrid
  columns={columns}
  data={loadedUsers}
  totalCount={10_000}
  height={600}
  hasMore={loadedUsers.length < 10_000}
  isLoadingMore={query.isFetchingNextPage}
  onLoadMore={({ loadedCount }) => query.fetchNextPage({ offset: loadedCount })}
/>
```

- Unloaded virtual positions render deterministic skeletons instead of blank space.
- Skeleton widths vary by absolute row index and column ID, so recycled rows do not shimmer into a different layout.
- `meta.skeleton` supports `bar`, `square`, and `circle`, a fixed size, width bounds, or `false`.
- `isLoading` with no data renders initial skeleton rows. With existing data it becomes a refresh state.
- `isLoadingMore` preserves loaded rows and puts the loading indicator directly beside the record count in the bottom-left footer.
- `slots.loadingIndicator` replaces the default spinner.

Set `virtualize={false}` for a genuinely small, fully loaded data set. Unloaded placeholders are never materialized in that mode.

## Sections

Sections are presentation-only. Filtering and sorting run first; section order follows the first row in the resulting model and rows retain their model order within each section.

```tsx
<DataGrid
  columns={columns}
  data={users}
  totalCount={users.length}
  sections={{
    getKey: (user) => user.status,
    headerHeight: 44,
    renderHeader: ({ key, rows }) => (
      <div className="flex justify-between">
        <strong>{key}</strong>
        <span>{rows.length} loaded</span>
      </div>
    ),
    renderSelection: ({ checked, indeterminate, key, toggle }) => (
      <IndeterminateCheckbox
        aria-label={`Select ${key} section`}
        checked={checked}
        indeterminate={indeterminate}
        onChange={(event) => toggle(event.currentTarget.checked)}
      />
    ),
  }}
/>
```

Section headers are part of the virtual item model. With row selection enabled, they receive a default animated select-all checkbox; `renderSelection` can replace it while retaining the section's checked, indeterminate, disabled, and toggle behavior. When a server result is partially loaded, the grid renders known sections followed by unloaded row placeholders because section keys for records not yet fetched are unknowable.

## Header, column-header, and footer slots

The outer header, sticky column headers, scroll body, and footer are separate surfaces. Slots accept a node or a render callback with the live table instance and useful grid state.

```tsx
<DataGrid
  // ...
  slots={{
    headerStart: <SavedViewPicker />,
    headerEnd: <CreateButton />,
    columnHeaderEnd: <LiveBadge />,
    footerStart: ({ selectedRows }) => <BulkActions rows={selectedRows} />,
    footerEnd: ({ resetPreferences }) => (
      <button onClick={resetPreferences}>Reset columns</button>
    ),
    empty: <EmptyUsers />,
    error: ({ totalCount }) => <RetryState expectedCount={totalCount} />,
  }}
/>
```

Available slots are `headerStart`, `headerEnd`, `columnHeaderEnd`, `footerStart`, `footerEnd`, `loadingIndicator`, `empty`, and `error`.

## Column controls and preferences

Column behaviors are independent opt-ins:

```tsx
<DataGrid
  enableColumnReordering
  enableColumnResizing
  enableColumnVisibility
  tableId="opportunities"
  // ...
/>
```

- Reordering begins on the six-dot grab handle. `Alt+Left` and `Alt+Right` provide a keyboard alternative.
- The remaining sortable header is still a sort target and the right edge remains a resize target.
- Set `meta.reorderable: false`, `meta.resizable: false`, or TanStack's `enableHiding: false` per column.
- The far-right Columns menu follows the current order, includes hidden columns, locks non-hideable columns, and never permits the final visible column to be hidden.
- `tableId` persists order, sizes, and visibility in a versioned localStorage document.
- Supply `initialPreferences`, `onPreferencesChange`, or a custom synchronous `preferenceStorage` adapter for SSR cookies or application-owned storage.

## Filtering and sorting

Set `enableGlobalFilter` for fuzzy, case- and accent-insensitive search. Set `enableColumnFiltering` and declare `meta.filter` to render inline controls.

Supported column filter types:

- `text`
- `single-select`
- `multi-select`
- `boolean`
- `number-range`
- `date-range`

Date ranges use the exported `DateRangePickerPanel`: preset ranges commit immediately, while calendar selections remain drafts until Apply. The standalone `DateRangePicker` adds a formatted trigger, popover dismissal, and clear action for use outside a grid.

```tsx
<DateRangePicker
  from={range.from}
  to={range.to}
  onChange={setRange}
  placeholder="Order date"
/>
```

All filter UIs use TanStack's `columnFilters` state. Sorting, column filters, and global filtering can each be controlled or uncontrolled. Set `manualSorting` or `manualFiltering` when a server owns the results; the UI continues to report state through `onSortingChange`, `onColumnFiltersChange`, and `onGlobalFilterChange`.

## Selection

Selection is a discriminated TypeScript contract. Turning it on makes `getRowId` mandatory, preventing index-based selection from drifting after server sorting or infinite-page appends.

```tsx
<DataGrid
  enableRowSelection
  getRowId={(user) => user.id}
  isRowSelectable={(user) => user.status !== "paused"}
  onRowSelectionChange={(selection, selectedUsers) => {
    // selection is the TanStack v9 ID map; selectedUsers contains loaded originals
  }}
  // ...
/>
```

TanStack v9 supplies contiguous Shift selection through the row checkbox handlers. Select-all only applies to currently loaded, selectable rows.

## Column metadata

`DataGridColumnMeta` adds:

| Field | Purpose |
| --- | --- |
| `width`, `minWidth`, `maxWidth` | Default CSS grid track and resize bounds |
| `headerAlign`, `cellAlign` | Independent header/body alignment |
| `headerTooltip` | Accessible help content beside the label |
| `filter` | Inline filter configuration |
| `numericSort` | Numeric sorting for formatted values |
| `prefix`, `suffix` | Default-cell value decoration |
| `reorderable`, `resizable` | Per-column interaction opt-outs |
| `skeleton` | Placeholder shape and stable sizing |
| `headerClassName`, `cellClassName` | Per-column style hooks |

## Theming and Tailwind

The default theme uses CSS variables. Pass a typed `theme` object for runtime values:

```tsx
<DataGrid
  theme={{
    accent: "#0f766e",
    border: "#99f6e4",
    headerBackground: "#f0fdfa",
    selected: "#ccfbf1",
    radius: "1rem",
  }}
  // ...
/>
```

For Tailwind, use the `className`, `classNames`, and per-column class hooks. Every important element also has a stable `data-slot` or state attribute.

```tsx
<DataGrid
  className="rounded-none border-2 border-violet-500 shadow-xl"
  classNames={{
    columnHeader: "bg-violet-50 uppercase tracking-wide",
    row: "hover:bg-violet-50 data-[state=selected]:bg-violet-100",
    footer: "bg-slate-50",
  }}
  // ...
/>
```

No Tailwind runtime is required by this package. The defaults live in the standard CSS `components` layer, so Tailwind's `utilities` layer wins when class slots supply utilities. This keeps the package compatible with Tailwind v4 projects, plain CSS, CSS Modules, and other styling systems.

## Development

The package is type-checked with TypeScript 7 (the native Go compiler) and formatted/linted with Biome. Install the workspace-recommended **Biome** and **TypeScript 7** extensions so format-on-save and editor diagnostics match CI.

```sh
bun run check
bun run typecheck
bun run test
bun run test:coverage
bun run registry:validate
bun run registry:build
bun run storybook
bun run build:storybook
bun run build
```

Storybook includes overview, 10,000-row virtualization, all column controls, every filter family, sections, stable/range selection, separate slots, initial/refresh/load-more states, custom empty/error states, CSS-variable themes, Tailwind class overrides, and density variants.
