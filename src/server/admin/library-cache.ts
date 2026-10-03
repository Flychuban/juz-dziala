import "server-only";

import { revalidatePath } from "next/cache";

/**
 * Everything that must happen after a library card changes, in one place:
 * the public pages are re-rendered on the next request and the matcher's
 * in-memory card index is rebuilt.
 */
export async function afterLibraryChange(slug?: string): Promise<void> {
  try {
    revalidatePath("/library");
    revalidatePath("/library/[slug]", "page");
    if (slug) revalidatePath(`/library/${slug}`);
    revalidatePath("/knowledge", "layout");
    revalidatePath("/admin/library");
  } catch (e) {
    // revalidatePath throws outside a request scope (e.g. in scripts); harmless.
    console.warn("[admin] revalidatePath skipped", e);
  }
  // TODO(match): call `invalidateLibraryCache()` from "~/server/match" once
  // agent/match is merged into main. This is the only place that needs it.
}
