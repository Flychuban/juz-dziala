import Link from "next/link";

import { PageHeader, ReadAloud } from "~/components/kit";

export const metadata = { title: "Tekst łatwy do czytania" };

const ETR = [
  {
    h: "Co to jest za strona?",
    p: [
      "Ta strona nazywa się Już Działa.",
      "Prowadzi ją Regionalny Ośrodek Polityki Społecznej w Krakowie.",
      "W skrócie: ROPS.",
      "ROPS pomaga ludziom w Małopolsce.",
    ],
  },
  {
    h: "Do czego jest ta strona?",
    p: [
      "Możesz tu opisać swój problem.",
      "Na przykład: Mama mieszka sama i nie wychodzi z domu.",
      "Strona pokaże Ci rozwiązania.",
      "Te rozwiązania już działają w Małopolsce.",
      "Sprawdził je ROPS.",
    ],
  },
  {
    h: "Jak to zrobić?",
    p: [
      "Wejdź na stronę główną.",
      "Napisz swój problem w dużym okienku.",
      "Możesz też nacisnąć przycisk Powiedz i mówić.",
      "Naciśnij przycisk Szukaj rozwiązań.",
    ],
  },
  {
    h: "Co jeśli potrzebuję pomocy człowieka?",
    p: [
      "Naciśnij przycisk Poproś ROPS o pomoc.",
      "Dostaniesz kod sprawy.",
      "Zapisz ten kod albo go wydrukuj.",
      "Pracownik ROPS odpowie Ci.",
      "Odpowiedź zobaczysz po wpisaniu kodu w zakładce Moja sprawa.",
      "Możemy też do Ciebie zadzwonić, jeśli tego chcesz.",
    ],
  },
  {
    h: "Czy muszę zakładać konto?",
    p: ["Nie.", "Nie musisz zakładać konta.", "Nie musisz podawać nazwiska."],
  },
  {
    h: "Jak powiększyć tekst?",
    p: [
      "Na górze strony są przyciski A+ i A−.",
      "A+ powiększa tekst.",
      "Przycisk Kontrast zmienia kolory na bardziej wyraźne.",
    ],
  },
  {
    h: "Jak czytać prościej?",
    p: [
      "Na górze strony jest przycisk Tekst łatwy.",
      "Naciśnij go.",
      "Przy każdym rozwiązaniu zobaczysz krótki, prosty opis.",
      "Ten opis przygotowuje komputer na podstawie karty.",
      "Pełny opis jest zawsze pod spodem.",
    ],
  },
];

export default function EasyReadPage() {
  const all = ETR.flatMap((s) => [s.h, ...s.p]).join(" ");
  return (
    <>
      <PageHeader
        width="narrow"
        eyebrow="Dostępność"
        title="Tekst łatwy do czytania"
        lead="Informacja o stronie Już Działa napisana prostym językiem."
      >
        <ReadAloud text={all} />
      </PageHeader>
      <div className="mx-auto max-w-2xl space-y-10 px-4 py-10">
        {ETR.map((s) => (
          <section key={s.h}>
            <h2 className="text-2xl font-bold">{s.h}</h2>
            <ul className="mt-3 space-y-2 text-xl leading-relaxed">
              {s.p.map((line) => (
                <li key={line}>{line}</li>
              ))}
            </ul>
          </section>
        ))}
        <p className="text-xl">
          <Link href="/" className="font-semibold">
            Przejdź na stronę główną
          </Link>
        </p>
      </div>
    </>
  );
}
