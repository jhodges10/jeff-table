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

## Inline editing

`enableInlineEditing` turns the grid from a view into a surface. A column's
`meta.editor` picks its control, the same way `meta.filter` picks its filter UI.

```tsx
<DataGrid
  enableInlineEditing
  getRowId={(person) => person.id}
  onCellEdit={async ({ rowId, columnId, value }) => {
    await api.patch(rowId, { [columnId]: value });
  }}
  columns={[
    { accessorKey: "name", meta: { editor: { type: "text" } } },
    { accessorKey: "balance", meta: { editor: { type: "number", min: 0, step: 250 } } },
    { accessorKey: "status", meta: { editor: { type: "single-select" } } },
    { accessorKey: "skills", meta: { editor: { type: "multi-select", options: skills } } },
    { accessorKey: "onCall", meta: { editor: { type: "boolean" } } },
    { accessorKey: "joined", meta: { editor: { type: "date" } } },
  ]}
  // ...
/>
```

A `single-select` cell shows a chevron before it is touched, so a reader knows
it opens a list without having to try it. Enter expands that list *at* the value
the cell already holds, with the caret after that value — so arrow keys walk to
a replacement, Backspace deletes what is behind the caret, and typing filters.
The held value stays visible until something is typed over it.

Editor types are `text`, `number`, `single-select`, `multi-select`, `boolean`,
and `date`. The date editor is a text field holding the same string the cell
showed, plus one calendar — `<input type="date">` would open the platform's own
picker beside the grid's and re-render the value in the browser's locale. The two select editors are typeahead comboboxes; with no `options`
of their own they fall back to the column's `filter.options`, so a column that
already declares what it can be filtered by does not repeat the list to declare
what it can be edited to. Matching is fuzzy and accent-insensitive — the same
matcher the global search uses — but ranked, so a prefix match sits under the
Enter key. A `boolean` column renders a live control: there is no edit mode to
enter, and activating it is the commit. It draws a switch by default and a
checkbox when the column asks for one with `editor.control: "checkbox"` — a
switch reads as a setting that takes effect at once, a checkbox as a value in a
record, and the commit path behind them is identical.

Like selection, editing is a discriminated contract: turning it on makes
`getRowId` and `onCellEdit` mandatory, because the optimistic overlay and the
focused-cell coordinate are both addressed by row ID.

### Pointer

A single click opens a cell's editor, and the whole cell is the target — a
click on the padding beside a value opens it too. Content that handles its own
clicks is exempt: a boolean's switch commits on its own change event, and a
link or button in a custom `cell` renderer keeps its job, so one click never
runs two activations.

### Keyboard

The grid is one tab stop. The viewport is the way in until a cell is focused;
from then on the focused cell carries the stop. Because a click edits, a cell
that is focused but closed is reached by arrowing to it, or by pressing
`Escape` to step back out of the editor a click opened.

| Key | Not editing | Editing |
| --- | --- | --- |
| Arrow keys | Move the focused cell | Move the caret |
| `Enter` | Open the editor | Commit and step down |
| `Tab` / `Shift+Tab` | Leave the grid | Commit and step right / left |
| `F2` | Open the editor | Commit and stay |
| `Escape` | Release the cell | Cancel, restoring the previous value |
| Any character | Open the editor seeded with it | — |
| `Home` / `End`, with `Ctrl`/`Cmd` | Row edges, then grid edges | — |
| `Delete` / `Backspace` | Clear the cell | — |

Arrow keys walk the grid's display order rather than the row model's, so they
keep matching what the reader sees when `sections` has regrouped the rows.
Moving to a row outside the rendered window scrolls it in; moving past the last
loaded row asks for the next page.

### Committing

`onCellEdit` may return nothing or a promise. Either way the grid shows the new
value immediately, by patching the row the table is built from — so custom cell
renderers, sort comparators, and filters all agree with what the cell shows.

- A synchronous handler has already applied its own update in the same batch.
- A resolved promise keeps the value applied until new `data` arrives, so the
  cell never flashes the old value in between.
- A rejected promise reverts the row and marks the cell
  `data-edit-status="error"`, with the message as its `title`.

`isCellEditable({ columnId, row })` refuses individual cells while leaving them
focusable, the way a spreadsheet treats a locked one. `applyCellEdit(row,
columnId, value)` controls how the optimistic value is written back; the default
writes at the column ID, which is right for every `accessorKey` column, dotted
paths included, but a column with a custom `accessorFn` has no such property and
needs it.

Editing is built on TanStack v9's `cellSelectionFeature`, which the grid
registers and leaves inert unless `enableInlineEditing` is set. `cellSelection`
and `onCellSelectionChange` are controllable like every other state slice. Range
selection, drag, and clipboard are deliberately off for now.

### Numbers and currency

`meta.numberFormat` is `Intl.NumberFormat` options the grid owns both ends of.
It writes the cell, and the number editor reads it back — so a cell showing
`$40,845.00` opens an editor showing `$40,845.00`, right-aligned, with the caret
at the far right, and nothing on the row moves.

```tsx
{
  accessorKey: "balance",
  meta: {
    cellAlign: "right",
    editor: { type: "number", min: 0 },
    numberFormat: { currency: "USD", locale: "en-US" },
    numericSort: true,
  },
}
```

The field is a masked text input, not `<input type="number">`: the native
control drops the symbol and the grouping, adds a spinner, and left-aligns. As
you type, the integer side keeps its grouping and the fraction is left exactly
as typed — reformatting on every keystroke would append the minimum decimals and
make the field impossible to type into. `min` and `max` are enforced on commit,
and an unparseable value is refused rather than saved.

### One value, one appearance

A status badge is a property of the value, not of the body cell. Declare it once
as `meta.renderValue` and it is drawn in the cell, in the filter's option list,
in the editor's option list, and on a multi-select chip — so the same value
never reads three different ways.

```tsx
{
  accessorKey: "status",
  meta: {
    editor: { type: "single-select" },
    filter: { options: statuses, type: "single-select" },
    renderValue: (status) => <StatusBadge status={status} />,
  },
}
```

`renderValue` receives the underlying value and falls back to the option label
when it is not set. A `cell` renderer still wins in the body, where it has the
whole row to work with; `renderValue` covers every surface that only has the
value. Either config's `renderOption` overrides it for that one list.

## Column metadata

`DataGridColumnMeta` adds:

| Field | Purpose |
| --- | --- |
| `width`, `minWidth`, `maxWidth` | Default CSS grid track and resize bounds |
| `headerAlign`, `cellAlign` | Independent header/body alignment |
| `headerTooltip` | Accessible help content beside the label |
| `editor` | Inline editor configuration |
| `filter` | Inline filter configuration |
| `numberFormat` | Currency/decimal formatting for the cell and its editor |
| `numericSort` | Numeric sorting for formatted values |
| `prefix`, `suffix` | Default-cell value decoration |
| `renderValue` | How one value is drawn, in the cell and in every option list |
| `reorderable`, `resizable` | Per-column interaction opt-outs |
| `skeleton` | Placeholder shape and stable sizing |
| `headerClassName`, `cellClassName` | Per-column style hooks |

## Theming and Tailwind

Every visual decision is a design token — 29 of them, covering the palette,
overlay surfaces, elevation, focus ring, grid lines, skeletons, scrollbars,
spacing, and type. Each resolves in three steps:

1. whatever you set — the `theme` prop writes inline custom properties, or set
   `--jt-*` in plain CSS on any ancestor;
2. the matching shadcn/ui variable, if your app defines one (`--background`,
   `--foreground`, `--primary`, `--muted`, `--border`, `--radius`, `--ring`,
   `--popover`);
3. a built-in light/dark pair.

In an app that already defines the shadcn variables, the grid arrives themed.
Pass a typed `theme` object for runtime values:

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

`dataGridThemeTokens` maps every `theme` key to its custom property, and
`createThemeStyle` turns a partial theme into inline properties — both are
exported for building your own theme editors.

## Dark mode

Dark mode is a property of the page, not a prop. Every built-in default is a
`light-dark()` pair keyed off `color-scheme`, which CSS inherits:

| The page does this | The grid |
| --- | --- |
| Declares `color-scheme: dark` on `<html>` | Follows it |
| Sets `class="dark"` (Tailwind, shadcn/ui) | Follows it |
| Sets `data-theme="dark"` (next-themes) | Follows it |
| Redefines `--background` / `--foreground` in a `.dark` block | Uses those values |
| Nothing | Renders light |

Nothing needs to be passed, and nothing needs to stay in sync with your theme
state. When a grid has to differ from the page around it — a dark analytics
panel on a light dashboard — `colorScheme` pins it:

```tsx
<DataGrid colorScheme="dark" /> // "inherit" (default) | "light" | "dark" | "system"
```

A standalone `DateRangePickerPanel` rendered outside a grid needs the token
block; wrap it in `.jt-theme`.

Dark mode is not verified by eye: `bun run test:storybook` runs the whole story
suite in Chromium twice, once against a light host page and once against a dark
one, with axe assertions on both passes.

## Scrollbars

Viewport scrolling is overlay by default: inset thumbs sit on the rows instead of reserving an OS gutter. Pass `scrollbar="native"` for platform scrollbars — styled to the grid tokens on Chromium, thin on Firefox.

```tsx
<DataGrid scrollbar="native" /> // "overlay" (default) | "native"
```

## Performance

The grid renders a window, not a table, so a 50,000-row grid commits the same
rows, cells, and DOM nodes as a 1,000-row grid. `benchmarks/` asserts that
directly — and because wall-clock numbers fail for reasons nobody can act on,
every benchmark counts work instead: rendered rows, cell renders, React commits,
DOM nodes, filter evaluations, comparator calls. Fixed fixtures and a pinned
viewport mean two machines produce the same numbers.

```sh
bun run bench                      # assert every scenario against its budget
BENCH_REPORT_ONLY=1 bun run bench  # print the numbers without failing
```

See `benchmarks/README.md` for the metrics, the budgets, and how to re-baseline.

## Development

The package is type-checked with TypeScript 7 (the native Go compiler) and formatted/linted with Biome. Install the workspace-recommended **Biome** and **TypeScript 7** extensions so format-on-save and editor diagnostics match CI.

```sh
bun run check
bun run typecheck
bun run test
bun run test:coverage
bun run test:storybook
bun run bench
bun run registry:validate
bun run registry:build
bun run storybook
bun run build:storybook
bun run build
```

Storybook includes overview, 10,000-row virtualization, all column controls, every filter family, sections, stable/range selection, separate slots, initial/refresh/load-more states, custom empty/error states, CSS-variable themes, Tailwind class overrides, and density variants.
