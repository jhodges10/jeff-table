# Benchmarks

```bash
bun run bench                      # assert every scenario against its budget
BENCH_REPORT_ONLY=1 bun run bench  # print the numbers without failing
```

Results are appended to `benchmarks/report.jsonl` (git-ignored) and printed as a
table at the end of each file.

## Why these are deterministic

Nothing here measures elapsed time. A wall-clock assertion fails on a busy CI
runner and passes on a quiet laptop for reasons that have nothing to do with the
change under review, so this suite counts **work** instead:

| Metric | What it counts |
| --- | --- |
| `rowElements` | Row elements committed to the DOM |
| `cellRenders` | Cell render functions invoked |
| `commits` | React commits of the grid subtree, via `<Profiler>` |
| `domNodes` | Elements inside the grid, chrome included |
| `filterEvaluations` | Column filter predicate calls |
| `comparisons` | Sort comparator calls |
| `sectionKeyReads` | `sections.getKey` calls |

Every input is fixed: fixture rows are index-derived rather than random, and the
benchmark setup pins `offsetWidth`/`offsetHeight` so the virtualizer measures the
same 600×1000 viewport on every machine. Two runs on two machines produce the
same numbers.

## Budgets and floors

Each scenario declares `budgets` (ceilings) and, where it matters, `floors`.
Floors exist because a grid that renders nothing would otherwise pass every
ceiling — `mount/1k-rows` asserts it rendered a full window, not merely "not too
much".

Budgets are derived from a model of the expected work rather than hand-tuned
magic numbers, so a failure names the invariant that broke:

```ts
TOP_WINDOW_ROWS = ceil(viewportHeight / rowHeight) + overscan
MOUNT_CELL_BUDGET = TOP_WINDOW_ROWS * columns * MOUNT_RENDER_PASSES
```

The one exception is `sort/first-toggle`: the exact comparison count belongs to
the engine's sort, so it is bounded as a band around `n log n`.

## The load-bearing assertion

`mount/50k-rows` must match `mount/1k-rows` **exactly** — same rendered rows,
same cell renders, same DOM nodes. That equality is the promise virtualization
makes, and it is checked directly rather than inferred from a budget.

## Updating a budget

1. `BENCH_REPORT_ONLY=1 bun run bench` and read the new numbers.
2. Work out why they moved. A budget rises because the grid does more work; that
   needs a reason in the commit message, not just a bigger number.
3. Edit the `budgets` in the scenario, keeping them expressed in terms of the
   window model where possible.
