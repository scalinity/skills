# Language-Specific Bug Patterns

Reference checklist for DB1's Sweep 3 (Type Safety, Integration & Regressions). The agent reads only the section matching the detected stack. Sections are deliberately concrete — patterns Claude has seen ship to prod, not encyclopedic dumps.

## How to use

1. Identify the language(s) of the changed files from `[CONTEXT]` and from the file extensions in `[LIST FILES]`.
2. Read only the matching sections below. Don't read sections for languages not in the changeset.
3. For each pattern in the section, scan the diff for instances. If you find one, emit a finding using the shared severity calibration.

If a file is in a language not covered below, fall back to general type-safety/integration heuristics; flag that the language isn't covered so the maintainer knows to expand this reference.

---

## JavaScript / TypeScript

### Type-system holes
- `any`, `as unknown as T`, `// @ts-ignore`, `// @ts-expect-error` — flag every instance and ask whether the cast is hiding a real type mismatch.
- Implicit `any` from missing return types on exported functions — public API surfaces should always declare return types.
- Loose generics (`<T = any>`, unconstrained `T extends {}`) that don't actually constrain anything — the type parameter is decorative.
- `Object.keys(x)` returning `string[]` instead of `keyof typeof x` — common source of "this key isn't in T" runtime errors.
- Discriminated-union narrowing failures — `if (x.kind === 'foo')` followed by access to a field that only exists on `kind === 'bar'`.
- Non-exhaustive `switch` on a union type with no `default` clause that throws — adding a new variant silently skips the switch.

### Async & promise pitfalls
- `async` function whose return value is never `await`ed at the call site — silently swallowed errors.
- `Promise.all([...])` where one rejected promise rejects the whole batch and discards the others' results — sometimes desired, often not (compare to `Promise.allSettled`).
- `for (const x of arr) { await something(x); }` when `Promise.all(arr.map(something))` would parallelize correctly — performance bug.
- `forEach` with an `async` callback — the outer code doesn't wait for the iterations to finish.
- `setTimeout(fn, 0)` or `queueMicrotask` used to "fix" race conditions — usually papering over a real ordering bug.

### `this` and binding
- Class method passed as a callback without `.bind(this)` or arrow wrapper — `this` will be undefined or wrong.
- Arrow function defined in a class body (`foo = () => {}`) — works for `this` but breaks subclassing and is harder to mock.

### Common runtime traps
- `JSON.parse(x)` without `try/catch` — throws on malformed input.
- `parseInt(x)` without radix — radix-10 input that starts with `0` parsed as octal in old engines (still happens with weird input strings).
- `==` instead of `===` — coerces in surprising ways (`[] == false` is `true`, `'1' == 1` is `true`).
- `Array(n)` creates a sparse array — `Array(3).map(...)` returns `[empty, empty, empty]` because `map` skips holes. Use `Array.from({length: n})` or `new Array(n).fill(undefined)`.
- Spreading large arrays with `Math.max(...arr)` — stack overflow at ~100k elements.
- Mutating function parameters that are passed by reference (objects, arrays) — caller's data changes unexpectedly.

### React-specific (if React is in stack)
- `useEffect` with missing or wrong dependencies — stale closures, infinite loops.
- `useState` setter called with a non-function update where the new value depends on the previous (`setX(x + 1)` instead of `setX(prev => prev + 1)`) — race conditions in batched updates.
- Conditionally calling hooks (rules-of-hooks violation) — silent bugs in dev, crashes in prod.
- Mutating state directly (`state.foo = 1`) instead of returning a new object — React skips re-render.

### Node-specific
- Streams without `error` listeners — uncaught exceptions crash the process.
- `fs.readFile` callback chain instead of `fs.promises.readFile` — easy to forget error handling.
- Process exit before async work completes — output is lost (e.g. `console.log` then immediate `process.exit`).

---

## Python

### Mutable defaults
- `def f(x=[])` or `def f(x={})` — the default is shared across all calls. Instances of this in a long-lived process accumulate state.

### Generators and iterators
- A generator consumed once and then expected to be reusable — second iteration yields nothing.
- `list(gen)` materializing a large generator inadvertently — memory blowup.
- `zip(*list_of_pairs)` on an empty list — silently returns empty without error, can hide a real bug.

### Concurrency & GIL
- `threading` for CPU-bound work expecting parallelism — GIL serializes; use `multiprocessing` or `asyncio` (depending on workload).
- `asyncio` with blocking calls (synchronous `requests`, `time.sleep`) — blocks the event loop for every other task.
- Async function not `await`ed — silently returns a coroutine object that never runs.

### Type hints (if used)
- `Optional[X]` defaults to `None` — code paths that assume `X` will crash on the `None` case.
- `List[T]` parameter being mutated by the function — caller's list changes; the type signature doesn't warn.
- Type hints that lie: `-> int` on a function that can also return `None` in error paths.

### String/bytes mismatch
- Mixing `str` and `bytes` in concatenation, file IO, or hashing — `TypeError` at runtime.
- Decoding bytes without `errors='replace'` or `errors='ignore'` on user input — random `UnicodeDecodeError`.

### Common runtime traps
- `except:` (bare) catches `KeyboardInterrupt` and `SystemExit` — swallows shutdown signals.
- `except Exception as e: pass` — silently swallows errors. Always log at minimum.
- `dict.get(key)` when you actually want `dict[key]` — `None` propagates instead of failing fast.
- `if x:` for objects where `__bool__` is overloaded (e.g. numpy arrays, pandas DataFrames) — raises or returns the wrong thing.
- Floating-point equality (`x == 0.1`) — use `math.isclose` or rounded comparison.
- Mutable class variables (`class Foo: items = []`) — shared across instances.

---

## Go

### Nil interfaces
- A typed-nil-pointer assigned to an interface variable produces a non-nil interface — `if err != nil` is true even though the underlying value is nil.
- Returning `(*Foo)(nil)` as an `error` interface value — same trap, common in error wrapping.

### Goroutine pitfalls
- `for _, v := range slice { go func() { use(v) }() }` — closure captures `v` by reference; all goroutines see the last value (Go < 1.22). In Go ≥ 1.22 this is fixed but still flag for codebases pinned to older versions.
- Goroutine started without a way to stop it — leaked goroutine on early return or context cancel.
- Channel send to a buffered-then-closed channel — panic.
- Reading from a nil channel — blocks forever.

### Defer pitfalls
- `defer file.Close()` immediately after `os.Open(...)` — fine, but if you want to capture close errors, `defer` discards them. Use a named return + assignment.
- `defer` in a loop — stacks up to function exit, can cause resource exhaustion. Use an inner function or explicit close.

### Errors
- Errors checked but not wrapped (`return err`) — the caller has no context about which call failed.
- `errors.Is` vs `errors.As` confusion — `Is` for sentinel comparison, `As` for type assertion.
- Panic in a library — public API should return errors, not panic.

### Slices and maps
- `append(a, b...)` reusing underlying array — modifying the result mutates `a`. Important when slices are aliased.
- Returning a slice of a larger underlying array — the larger array is retained, memory leak.
- Iterating a map and modifying it inside the loop — undefined behavior.

---

## Rust

### Borrow-checker workarounds
- `unsafe` blocks — every one is a finding (informational at minimum), since the borrow checker isn't enforcing invariants.
- `Rc<RefCell<T>>` proliferation — often a sign the data model is wrong; flag for design discussion.
- `clone()` chains used to "fix" borrow-checker errors — performance smell and sometimes hides a real ownership bug.
- `unwrap()` / `expect()` in non-test code — every instance is a panic risk; require justification.

### Async pitfalls
- `.await` inside a `Mutex` lock guard — holds the lock across yield points, easy to deadlock.
- Tokio task spawned without `JoinHandle` retained — fire-and-forget; errors disappear.
- Blocking calls in async context — block the runtime; use `spawn_blocking`.

### Lifetimes
- `'static` lifetime added to make a compile error go away — often hides a real ownership issue.
- Self-referential structs without `Pin` — typically indicates the design needs `Arc`/`Rc` or a redesign.

### Common bugs
- Integer overflow in release mode is silent (wraps); debug panics. Flag arithmetic on user-supplied integers.
- `as` casts that truncate or lose sign — use `try_into()` for fallible conversions.
- `Vec::reserve` vs `Vec::reserve_exact` confusion — over-allocates or under-allocates depending on intent.

---

## SQL (any dialect)

- Implicit type coercion in `WHERE` (e.g. comparing a `text` column to an integer) — disables index use.
- `SELECT *` in production code — every schema change is a behavior change.
- `LIKE '%foo%'` — full scan, no index use.
- `OR` in `WHERE` with no covering index — often forces full scan.
- Soft-delete columns (`deleted_at IS NULL`) missing from queries that should respect them.
- Missing `LIMIT` on user-facing queries — unbounded result sets.
- Transaction isolation level not set explicitly — defaults differ by dialect and can produce phantom reads.

---

## Bash / shell

- Unquoted variables in `[ $x = "y" ]` — empty `$x` produces a syntax error; quote always.
- `cd $dir && do_thing` without `set -e` — if `cd` fails, `do_thing` runs in the wrong directory.
- `$(...)` command substitution swallows trailing whitespace — sometimes desired, sometimes not.
- Pipes hide intermediate exit codes — use `set -o pipefail` and check `${PIPESTATUS[@]}`.
- Filenames with spaces/newlines breaking `for f in $(find ...)` — use `find -print0 | xargs -0` or `mapfile`.

---

## Maintenance note

If a real bug ships in a pattern not listed above, add it here. The point of this reference is to encode patterns we've actually seen — not to be exhaustive.
