import { CRISIS_RESOURCES } from "~/server/domain/crisis";
import { formatDatePl } from "~/components/kit";

/**
 * Shown first on the results page when the text suggests danger to life or
 * health. Calm, plain words; every number is a tel: link and carries the date
 * on which it was checked on the operator's own website.
 */
export function CrisisBanner() {
  const verified = formatDatePl(CRISIS_RESOURCES[0]?.verifiedAt);
  return (
    <section
      aria-labelledby="crisis-heading"
      className="border-foreground bg-warning-bg rounded-lg border-2 p-5"
    >
      <h2 id="crisis-heading" className="text-2xl font-bold">
        Jeśli Ty albo ktoś bliski jest w niebezpieczeństwie — zadzwoń teraz
      </h2>
      <p className="mt-2 max-w-prose">
        Nie musisz zostawać z tym sam(a). Te telefony są bezpłatne. Rozwiązania z Biblioteki pokazujemy niżej, ale
        najpierw zadbaj o bezpieczeństwo.
      </p>
      <ul className="mt-4 grid gap-3 sm:grid-cols-2">
        {CRISIS_RESOURCES.map((r) => (
          <li key={r.phone} className="border-hairline bg-background rounded-lg border p-4">
            <a
              href={`tel:${r.phone.replace(/\s+/gu, "")}`}
              className="text-foreground inline-flex min-h-12 items-center text-3xl font-bold tracking-wide"
            >
              {r.phone}
              <span className="sr-only"> — zadzwoń</span>
            </a>
            <p className="font-semibold">{r.name}</p>
            {r.hours && <p className="text-sm">Czynny: {r.hours}</p>}
            <p className="text-muted-foreground text-sm">{r.who}</p>
          </li>
        ))}
      </ul>
      <p className="text-muted-foreground mt-3 text-sm">
        Numery sprawdziliśmy na stronach ich operatorów{verified ? ` (stan na ${verified})` : ""}:{" "}
        {CRISIS_RESOURCES.map((r, i) => (
          <span key={r.sourceUrl}>
            {i > 0 ? ", " : ""}
            <a href={r.sourceUrl} target="_blank" rel="noopener noreferrer" className="underline">
              {new URL(r.sourceUrl).hostname}
            </a>
          </span>
        ))}
        .
      </p>
    </section>
  );
}
