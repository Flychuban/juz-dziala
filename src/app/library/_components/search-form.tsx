import Form from "next/form";
import { SearchIcon } from "lucide-react";

import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { type LibraryParams } from "./filters";

/**
 * GET search form: works without JavaScript; with it, next/form navigates
 * client-side. Hidden fields keep the active filters.
 */
export function LibrarySearchForm({ params }: { params: LibraryParams }) {
  return (
    <Form
      action="/library"
      role="search"
      aria-label="Szukaj w Bibliotece"
      scroll={false}
    >
      <label htmlFor="library-q" className="block text-lg font-semibold">
        Czego szukasz?
      </label>
      <p id="library-q-hint" className="text-foreground/85 mt-1 text-base">
        Wpisz własnymi słowami, np. „samotność seniorów” albo „opieka
        wytchnieniowa”.
      </p>
      <div className="mt-3 flex max-w-2xl flex-col gap-3 sm:flex-row">
        <Input
          id="library-q"
          name="q"
          type="search"
          defaultValue={params.q ?? ""}
          aria-describedby="library-q-hint"
          autoComplete="off"
          className="sm:flex-1"
        />
        {params.area ? (
          <input type="hidden" name="area" value={params.area} />
        ) : null}
        {params.category ? (
          <input type="hidden" name="category" value={params.category} />
        ) : null}
        {params.video ? <input type="hidden" name="video" value="1" /> : null}
        <Button type="submit" className="sm:px-6">
          <SearchIcon aria-hidden="true" />
          Szukaj
        </Button>
      </div>
    </Form>
  );
}
