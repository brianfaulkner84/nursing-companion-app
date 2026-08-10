import type { PostgrestError } from "@supabase/supabase-js";

// Supabase's PostgREST layer caps any single request at 1,000 rows by default (the
// project's db-max-rows setting) and truncates silently instead of erroring. Once the
// question bank passed 1,000 rows, every unpaginated `.from("questions").select(...)` in
// this app started quietly returning only 1,000 of them -- and because none of those
// queries specified an explicit order, which 1,000 came back shifted between requests,
// which is why dashboard tile counts and the content-gaps badge were flickering instead of
// just being low. This pages through with .range() until a page comes back short of the
// page size, so callers always get every row no matter how large the table grows.
const PAGE_SIZE = 1000;

// Supabase query builders are "thenable" (awaitable) but not real Promise instances -- they
// don't have .catch/.finally/Symbol.toStringTag -- so this is typed as PromiseLike rather
// than Promise, which is the minimal shape `await` actually needs and the shape a query
// builder actually has.
export async function fetchAllRows<T>(
  build: (from: number, to: number) => PromiseLike<{ data: T[] | null; error: PostgrestError | null }>
): Promise<T[]> {
  const all: T[] = [];
  let from = 0;
  for (;;) {
    const to = from + PAGE_SIZE - 1;
    const { data, error } = await build(from, to);
    if (error) throw error;
    const page = data ?? [];
    all.push(...page);
    if (page.length < PAGE_SIZE) break;
    from += PAGE_SIZE;
  }
  return all;
}
