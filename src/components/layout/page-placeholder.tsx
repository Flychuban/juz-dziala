/** Temporary page body used until a module agent builds the real screen. */
export function PagePlaceholder({
  title,
  lead,
  module,
}: {
  title: string;
  lead?: string;
  module: string;
}) {
  return (
    <div className="mx-auto max-w-4xl px-4 py-10">
      <p className="text-muted-foreground text-sm font-semibold tracking-wide uppercase">
        {module}
      </p>
      <h1 className="mt-1 text-3xl font-bold">{title}</h1>
      {lead && <p className="mt-3 max-w-prose text-lg">{lead}</p>}
      <p className="border-hairline bg-surface text-muted-foreground mt-6 rounded-md border p-4">
        Ten ekran jest w przygotowaniu.
      </p>
    </div>
  );
}
