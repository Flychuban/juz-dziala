/**
 * „Mapa Wyzwań Społecznych" (ROPS Kraków, listopad 2024, 44 slajdy) → data/knowledge.json
 *
 *   pnpm exec tsx scripts/build-knowledge.ts
 *
 * The transcription below was made from the archived PDF (text layer via pdftotext, every
 * multi-column slide checked against the rendered page). Text is verbatim, including the
 * source's own typos („w Polce", „badawczym", „Institue"). Report links come from the PDF's
 * link annotations, matched to the cover images left-to-right; report titles are the PDF's own
 * alternative text („Strona tytułowa raportu: …") where it has one, otherwise the title printed
 * on the cover (marked below). Names of individual report authors are left out of report
 * titles (sponsor rule: no real personal data); the personas are fictional and stay as written.
 *
 * The data in the map is NATIONAL („Dane zawarte w »Mapie wyzwań społecznych« są danymi
 * ogólnopolskimi", slide 1), so every figure carries scope "Polska".
 */
import { politeFetch, writeJson } from "./lib/http";
import { Knowledge } from "./schemas";
import type { z } from "zod";

export const MAPA_URL = "https://rops.krakow.pl/mpliki/IS/IWS_20/za._nr_2._Mapa_Wyzwa_Spoecznych.pdf";

type Area = z.infer<typeof Knowledge>["areas"][number];
type Persona = NonNullable<Area["persona"]>;
type Fig = Area["figures"][number];

const fig = (value: string, label: string, year: string | null, page: number): Fig => ({ value, label, scope: "Polska", year, page });

const ANIA_I_STAS: Persona = {
  name: "Ania i Staś",
  age: null, // two children: „Ania ma 7 lat, z kolei Staś 12"
  description: [
    "Rodzeństwo pochodzące z dysfunkcyjnej rodziny",
    "Ania ma Zespół Downa, Staś jest osobą niedosłyszącą",
    "Ania ma 7 lat, z kolei Staś 12",
    "Są z reguły nieufni i wycofani",
    "Trafiali do wielu rodzin zastępczych i placówek opiekuńczo-wychowawczych",
  ].join("\n"),
  goals: [
    "Umieszczenie dzieci w pieczy rodzinnej, bez konieczności ich rozdzielania",
    "Zapewnienie specjalistycznego wsparcia, w odpowiedzi na ich potrzeby związane z niepełnosprawnością",
    "Wzmocnienie kompetencji społecznych oraz umiejętności budowania relacji międzyludzkich",
  ],
  challenges: [
    "Niepełnosprawność obydwojga dzieci",
    "Bagaż doświadczeń jaki dzieci wyniosły ze swojego środowiska rodzinnego",
    "Brak stabilności w zakresie miejsca przebywania rodzeństwa",
  ],
  motivations: [
    "Mieć „prawdziwą” rodzinę, rodziców, którzy będą się o nas troszczyć.",
    "Nie być rozdzielonymi - wychowywać się razem, w tym samym miejscu.",
    "Poznać nowych kolegów i koleżanki, być akceptowanymi wśród rówieśników",
  ],
};

const KUBA: Persona = {
  name: "Kuba",
  age: 22,
  description: [
    "Przebywa w Warszawie",
    "Ma 22 lata (były wychowanek placówki opiekuńczo-wychowawczej)",
    "Przejawia symptomy uzależnienia od środków psychoaktywnych",
    "Miał możliwość mieszkania w mieszkaniu wspieranym, ale nie utrzymał go",
  ].join("\n"),
  goals: [
    "Zabezpieczenie schronienia i pożywienia na najbliższe dni",
    "Dostęp do prądu (dysponuje telefonem, dzięki któremu utrzymuje kontakt ze znajomymi, u których zdarza mu się rotacyjnie nocować)",
    "Utrzymanie schludnego wyglądu, by nikt nic „nie zauważył”",
  ],
  challenges: [
    "Znalezienie miejsca na nocleg w perspektywie najbliższych dni",
    "Brak kontaktu z osobami, które mogą go wesprzeć na drodze „ku dorosłości”",
  ],
  motivations: [
    "„Żeby nikt nie zobaczył, że nie mam domu. Bo przecież nie jestem bezdomny!”",
    "„Chcę zrobić coś ze swoim życiem, żeby nie skończyć jak moi starzy”",
  ],
};

const KRYSTIAN: Persona = {
  name: "Krystian",
  age: 38,
  description: [
    "Mieszka sam w małej miejscowości (rodzice mieszkają nieopodal)",
    "Ma 38 lat",
    "Pracuje zdalnie jako operator danych, obsługuje komputer wzrokowo, obsługuje inteligentny dom",
    "Ma porażenie czterokończynowe, nie mówi",
  ].join("\n"),
  goals: [
    "Realizować codzienne czynności bez „obciążania” innych osób",
    "Zdobyć znajomych, rozwinąć życie towarzyskie",
    "Dokształcać się, rozwijać zawodowo,",
    "Zdobyć uznanie",
  ],
  challenges: ["Samotność, brak przyjaciół", "Samoobsługa - ubieranie się, wyjście z domu", "Podtrzymanie ciała w miarę dobrym zdrowiu"],
  motivations: [
    "„Mieć w życiu coś więcej niż tylko pracę”",
    "Wyjść z domu kiedy chce, pojechać gdzieś, coś przeżyć",
    "Decydować o sobie, „mówić w swoim imieniu”",
  ],
};

const TOMEK: Persona = {
  name: "Tomek",
  age: 60,
  description: [
    "Mieszka na Śląsku",
    "Ma 60 lat",
    "Jeszcze do niedawna mieszkał z matką",
    "Ma wykształcenie techniczne, pracował w gospodarstwie rolnym",
    "Obecnie na rencie rolniczej, nie pracuje",
  ].join("\n"),
  goals: ["Zapewnić bezpieczeństwo finansowe i zdrowotne", "Znaleźć pracę dorywczą", "Zabezpieczyć opał do domu"],
  challenges: ["Samotność, brak sieci wsparcia", "Poczucie rezygnacji, beznadziei", "Zagrożenie alkoholizmem"],
  motivations: [
    "Poznanie nowych osób, „żeby się spotkać, napić razem herbaty”",
    "Mieć pewność, „że będę mieć co jeść i ogrzeję dom na zimę”",
  ],
};

const SWIETLANA: Persona = {
  name: "Swietłana",
  age: 37,
  description: [
    "Pochodzi z Ukrainy",
    "Ma 37 lat",
    "Ma 2 małych dzieci: 4 i 9 lat",
    "Mąż został w Ukrainie",
    "Jest nauczycielką historii, w Ukrainie pracowała w liceum",
    "W Polsce szuka pracy poza swoim zawodem",
  ].join("\n"),
  goals: ["Zapewnić bezpieczeństwo sobie i rodzinie", "Znaleźć pracę i mieszkanie", "Zabezpieczyć przedszkole/ szkołę dla dzieci"],
  challenges: [
    "Wynajęcie mieszkania (niechęć wynajmujących do matki z dziećmi z Ukrainy)",
    "Kulturowa adaptacja dzieci (nie mówią po polsku)",
  ],
  motivations: [
    "Odnalezienie się w Polce i kulturowa oraz społeczna aktywizacja i integracja",
    "Duża motywacja wewnętrzna, chęć zmiany",
  ],
};

const STANISLAW: Persona = {
  name: "Stanisław",
  age: 56,
  description: [
    "Ma 56 lat",
    "Pracuje na etat i opiekuje się chorą matką",
    "Z powodu intensywnego trybu życia zaniedbuje własne zdrowie",
    "Boryka się z otyłością i chorobą serca",
    "Wycofany społecznie",
  ].join("\n"),
  goals: [
    "Równowaga między życiem prywatnym a opieką nad matką",
    "Zwiększenie energii, witalności i poprawa stanu zdrowia",
    "Wzmocnienie relacji społecznych",
  ],
  challenges: [
    "Fizyczne i emocjonalne wyzwania związane z codzienną opieką nad osobą zależną",
    "Niepokój związany ze złym samopoczuciem i narastającymi problemami zdrowotnymi",
  ],
  motivations: [
    "Zapewnienie bezpieczeństwa i codziennej opieki matce",
    "Znalezienie chwili by zrobić coś dla siebie, spotkać się z kimś",
    "Chęć wyjścia poza schemat obowiązków",
  ],
};

const MATEUSZ: Persona = {
  name: "Mateusz",
  age: 17,
  description: [
    "Ma 17 lat",
    "Chodzi do liceum w dużym mieście",
    "Większość wolnego czasu spędza przed komputerem w sieci",
    "Niedawno doświadczył rozstania z pierwszą dziewczyną, co mocno przeżył",
    "Odczuwa pustkę, miewa stany depresyjne",
  ].join("\n"),
  goals: [
    "Realizowanie celów poza wirtualną rzeczywistością",
    "Znalezienie wsparcia w trudnym przeżywaniu emocji",
    "Przełamanie izolacji, poczucie przynależności do grupy",
  ],
  challenges: [
    "Skąpe kontakty z rówieśnikami, poczucie wyobcowania",
    "Nadmierny czas spędzany przed komputerem",
    "Trudność w rozumieniu emocji i radzeniu sobie z nimi, obniżona motywacja do działania",
  ],
  motivations: [
    "Poczucie zadowolenia i bycia ważnym",
    "Chęć bycia akceptowanym, znalezienie „bratniej duszy”",
    "Poczucie bezpieczeństwa, kiedy niebo wali się na głowę",
  ],
};

const KARINA: Persona = {
  name: "Karina",
  age: 41,
  description: [
    "Mieszka w dużym mieście",
    "Ma 41 lat",
    "Od lat boryka się z problemami zdrowia psychicznego, niedawno zdiagnozowano u niej chorobę afektywną dwubiegunową",
    "Odbywa długoterminowe leczenie pozostaje pod obserwacją psychiatry",
    "Obecnie powraca na rynek pracy",
  ].join("\n"),
  goals: [
    "Znalezienie stabilnego zatrudnienia",
    "Zapewnienie wsparcia w aktywizacji zawodowej i przygotowanie do wejścia na rynek pracy",
    "Zindywidualizowanie konkretnych działań pod osobiste możliwości",
  ],
  challenges: [
    "Odnalezienie się w rzeczywistości po powrocie ze szpitala",
    "Poczucie wyobcowania i wstydu w związku z otrzymaną diagnozą",
    "Spadek energii i motywacji, lęk przed odrzuceniem społecznym",
    "Zagrożenie bezrobociem i ponownym pojawieniem się kryzysu psychicznego",
  ],
  motivations: [
    "Powrót do „normalności” i życia społecznego",
    "Poradzenie sobie z nowym wyzwaniem jakim jest znalezienie i podjęcie pracy",
    "Odbudowanie wiary we własne możliwości",
  ],
};

const JANINA: Persona = {
  name: "Janina",
  age: 73,
  description: [
    "Mieszka sama w małym mieście",
    "Ma 73 lata",
    "Niedawno straciła męża, doświadcza samotności, rzadko wychodzi z domu",
    "Zmaga się z wieloma schorzeniami, przyjmuje sporo leków i suplementów",
  ].join("\n"),
  goals: [
    "Zminimalizowanie samotności i pobudzenie aktywności społecznej",
    "Zbudowanie poczucia wartości i użyteczności",
    "Świadome podejście do zdrowia fizycznego i psychicznego, utrzymanie opieki zdrowotnej i monitorowanie przyjmowanych leków.",
  ],
  challenges: ["Samotność i brak integracji społecznej", "Nadużywanie leków i suplementów", "Zmiana życia po utracie małżonka"],
  motivations: [
    "Odnalezienie sensu życia i przyjemności w prostych rzeczach",
    "Organizacja dnia codziennego",
    "Polepszenie samopoczucia i wyjście do ludzi",
  ],
};

const OECD_2023 = "https://www.oecd.org/pl/publications/2023/12/poland-country-health-profile-2023_80434439.html";

export const AREAS: Area[] = [
  {
    key: "family",
    label: "Rodzina i piecza zastępcza",
    definition: [
      "Rodzinie jako podstawowej formie życia zbiorowego przypisuje się pewne role, których właściwe pełnienie stanowi fundament prawidłowo rozwijającego się społeczeństwa. Niejednokrotnie mogą pojawiać się sytuacje, w których rodziny przeżywają trudności w sprawowaniu opieki nad dziećmi i ich wychowaniu. W tym przypadku udzielane jest wsparcie w formie systemu zaplanowanych działań, mających na celu przywrócenie takim rodzinom zdolności do pełnienia funkcji opiekuńczo-wychowawczych.",
      "Jedną z tych form jest piecza zastępcza, która jest sprawowana w przypadku niemożności zapewnienia dziecku opieki i wychowania przez rodziców biologicznych oraz ma za zadanie zagwarantować dziecku bezpieczeństwo, wsparcie emocjonalne oraz odpowiednie warunki do życia i rozwoju.",
    ].join("\n\n"),
    analysis: [
      "Jak wynika z dostępnych danych statystycznych, w 2023 roku względem roku 2022 nastąpił wzrost liczby dzieci przebywających w pieczy zastępczej o 3,5%.",
      "Proces deinstytucjonalizacji systemu pieczy zastępczej jest spowalniany przez niewystarczającą liczbę rodzin zastępczych w stosunku do potrzeb.",
      "Na zróżnicowaną skuteczność działań podejmowanych na rzecz dziecka i rodziny na terenie JST wpływ ma brak wszystkich form wsparcia rodzin zastępczych przewidzianych w ustawie oraz niedostateczna współpraca instytucji ze szczebla powiatu i gminy.",
      "Do ośrodków instytucjonalnej pieczy zastępczej wbrew założeniom ustawy trafiają również dzieci poniżej 10 roku życia. Ponadto w ośrodkach tych niejednokrotnie przebywa więcej dzieci niż przewidują regulacje.",
      "Znaczna część dzieci przebywających w systemie pieczy zastępczej to dzieci starsze, z licznych rodzeństw bądź dzieci z orzeczeniami o niepełnosprawności lub cierpiące na choroby przewlekłe.",
    ],
    keyChallengesIntro: null,
    keyChallenges: [
      "Rozwój rodzinnej pieczy zastępczej poprzez zwiększenie liczby pozytywnie zweryfikowanych kandydatów do pełnienia funkcji rodziny zastępczej.",
      "Priorytety dla rodzinnej pieczy zastępczej.",
      "Wdrażanie rozwiązań skutkujących poprawą współpracy między powiatami w zakresie funkcjonowania systemu pieczy zastępczej.",
      "Podejmowanie wszelkich działań prowadzących do nierozdzielania rodzeństwa w toku prowadzonych procedur w zakresie umieszczenia w pieczy zastępczej.",
      "Dążenie do nie przedłużania ponad miarę pobytu wychowanków w pieczy zastępczej i jak najszybszego kierowania dzieci z uregulowaną sytuacją prawną do docelowej formy opieki.",
      "Zapewnienie spójnego funkcjonowania systemu adopcyjnego, gdyż brak jednolitych wymogów jakościowych i kryteriów wykonywania zadań powoduje, że praktyka adopcyjna znacząco różni się w poszczególnych ośrodkach.",
    ],
    persona: ANIA_I_STAS,
    personas: [ANIA_I_STAS],
    figures: [fig("3,5%", "Wzrost liczby dzieci przebywających w pieczy zastępczej w 2023 r. względem 2022 r.", "2023", 4)],
    reports: [
      // Slide 7: neither cover has alternative text; titles as printed on the covers. The GUS cover
      // carries no link on slide 7 — the URL is the one slide 4 gives for the same publication.
      {
        title: "Piecza zastępcza w 2023 r. (Główny Urząd Statystyczny)",
        url: "https://stat.gov.pl/download/gfx/portalinformacyjny/pl/defaultaktualnosci/6000/1/8/1/piecza_zastepcza_w_2023_r..pdf",
        page: 7,
      },
      {
        title: "Wsparcie systemu pieczy zastępczej w procesie deinstytucjonalizacji. Informacja o wynikach kontroli NIK",
        url: "https://www.nik.gov.pl/kontrole/P/22/031/",
        page: 7,
      },
    ],
    pages: [3, 4, 5, 6, 7],
  },
  {
    key: "homelessness",
    label: "Bezdomność",
    definition: [
      "Doświadczenie bezdomności jest przejawem najbardziej jaskrawego, wyraźnego i brutalnego wykluczenia społecznego.",
      "Nie ma jednej uznanej definicji bezdomności. Mianem bezdomności określa się m.in. sytuację osób, które w danym czasie nie posiadają i własnym staraniem nie mogą zapewnić sobie takiego schronienia, które mogłyby uważać za swoje i które spełniałoby minimalne warunki, pozwalające uznać je za pomieszczenie mieszkalne. Z kolei zgodnie z „ustawą o pomocy społecznej”, osoba bezdomna to osoba niezamieszkująca w lokalu mieszkalnym w rozumieniu przepisów o ochronie praw lokatorów i mieszkaniowym zasobie gminy i niezameldowana na pobyt stały, w rozumieniu przepisów o ewidencji ludności, a także osoba niezamieszkująca w lokalu mieszkalnym i zameldowana na pobyt stały w lokalu, w którym nie ma możliwości zamieszkania.",
      "Bezdomność jest zjawiskiem społecznym, wynikającym z wielu współistniejących i przenikających się przyczyn. Należą do nich najczęściej: bezrobocie, ubóstwo, uzależnienia, przemoc domowa, zadłużenie, eksmisje, rozpad rodziny, zaburzenia psychiczne, zaburzenia osobowości, zakłócony proces socjalizacji. Bardzo rzadko zdarza się, że tylko jeden czynnik jest powodem bezdomności konkretnej osoby.",
    ].join("\n\n"),
    analysis: [], // the map has no „Analiza danych zastanych" slide for this area
    keyChallengesIntro: null,
    keyChallenges: [
      "rośnie liczba młodych bezdomnych (w wieku 0-25 r.ż)",
      "„niewidzialność” i „niepoliczalność” młodych bezdomnych - często noszą modne ubrania, mają staranny makijaż, spędzają czas na kanapie w kawiarni, galeriach handlowych, sprawiając wrażenie beztroskich młodych ludzi,",
      "konieczność odrębnego traktowania doświadczenia bezdomności młodych dorosłych i nastolatków - niepełnoletność powoduje problemy formalno-prawne, przez które szanse instytucjonalnego wsparcia bezdomnych nastolatków są niewielkie,",
      "instytucjonalna bezsilność wobec potrzeb młodych osób coraz częściej zgłaszających się do noclegowni i schronisk dla bezdomnych - brak dostosowanej oferty wsparcia dla tej grupy beneficjentów,",
      "luka w transferze pomocy międzyinstytucjonalnej w przypadku młodych bezdomnych, będących wcześniej wychowankami placówek opiekuńczo-wychowawczych,",
      "„bezrodzinowość” młodych bezdomnych - brak warunków do zawiązania silnych więzi emocjonalnych i społecznych w okresie dorastania, a także ich utrata w okresie wczesnej dorosłości (np. w związku z uzależnieniem młodego człowieka).",
    ],
    persona: KUBA,
    personas: [KUBA],
    figures: [],
    reports: [
      { title: "Bezdomność młodzieży i młodych dorosłych w Polsce. Raport z 2023 roku. Fundacja „Po Drugie”", url: "https://podrugie.pl/dodaj-mnie-raport-z-projektu/", page: 11 },
      {
        title: "Informacja o wynikach kontroli Najwyższej Izby Kontroli \"Działania aktywizujące i wspierające osoby bezdomne\" z 2020 roku",
        url: "https://www.nik.gov.pl/kontrole/P/18/096/",
        page: 11,
      },
      // The source names an individual author after the title; left out (no personal data).
      { title: "Raport na temat osób bezdomnych, 2010", url: "https://open.icm.edu.pl/items/edfec420-329f-4b2c-874c-2a6c28f99f3a", page: 11 },
      {
        title: "Diagnoza sytuacji osób doświadczających bezdomności na terenie miasta stołecznego Warszawy z 2022 roku. Biuro Pomocy i Projektów Społecznych Urzędu m.st. Warszawa",
        url: "https://wsparcie.um.warszawa.pl/problematyka-bezdomnosci-w-warszawie",
        page: 11,
      },
    ],
    pages: [8, 9, 10, 11],
  },
  {
    key: "disability",
    label: "Niepełnosprawność",
    definition: [
      "Niepełnosprawność to trwała zmiana w prawidłowym funkcjonowaniu organizmu człowieka. Jest długotrwałym naruszeniem sprawności organizmu. Powoduje w sposób istotny obniżenie zdolności do pracy i samodzielnego życia. Może być wrodzona, lub powstać na skutek wypadku lub choroby.",
      "Z niepełnosprawnością można się urodzić, osobą z niepełnosprawnością można się stać, niepełnosprawności można dożyć. Brak pełnej sprawności dotyczy, w różny sposób i na różnych etapach życia, dużej części społeczeństwa. Dotyka bezpośrednio osób z niepełnosprawnościami jak i osób z ich otoczenia.",
      "Utrudniony dostęp do edukacji, zarówno na etapie edukacji szkolnej, jak i wyższej, dostęp do kursów, szkoleń specjalizacyjnych, wiąże się z ograniczeniami w pozyskaniu pracy, rozwoju zawodowym, realizacji swoich pasji i budowania sieci kontaktów społecznych.",
      "Wskaźnik zatrudnienia osób z niepełnosprawnością w wieku 16-64 lata, wyniósł pod koniec 2023 roku 30,1%.",
    ].join("\n\n"),
    analysis: [
      "Osoby z niepełnosprawnościami stanowią bardzo niejednorodną grupę o zróżnicowanych potrzebach życiowych i różnych motywacjach. Trudności w funkcjonowaniu osób z niepełnosprawnością, są wielowymiarowe. Nie ograniczają się do medycznej strony funkcjonowania, ale składają się na nie czynniki ekonomiczne, prawne, komunikacyjne, społeczne, edukacyjne czy technologiczne.",
      "Na podstawie wyników Narodowego Spisu Powszechnego Ludności i Mieszkań z 2021 roku liczba osób niepełnosprawnych ogółem według stanu na dzień 31 marca 2021 r. wynosiła 5,4 mln i stanowiła 14,3% ludności kraju wobec 12,2% w 2011 r. oraz 14,3% w 2002 r. Udział mężczyzn wśród osób niepełnosprawnych wynosił 45,1% wobec 54,9% kobiet.",
      "Osoby z niepełnosprawnościami za najważniejsze uznają swoje potrzeby w zakresie mieszkalnictwa, form spędzenia czasu wolnego, dostępu do rehabilitacji, pracy oraz informacji (badanie PFRON z 2024 r.). Deklarują też, że najbardziej niezaspokojone potrzeby dotyczą zagadnień związanych z dostępem do informacji.",
      "Kluczowym elementem, wymagającym wypracowania nowych rozwiązań i dopracowania już istniejących jest moment przejścia między etapem edukacji a dorosłością i wspieraniem na rynku pracy.",
    ],
    keyChallengesIntro: null,
    keyChallenges: [
      "Zwiększenie dostępu do rynku pracy.",
      "Trudność z uzyskaniem wykształcenia pozwalającego na samodzielność życiową, rozwój zawodowy.",
      "Budowanie samodzielnych relacji społecznych i towarzyskich.",
      "Wsparcie emocjonalne.",
      "Wsparcie techniczne, infrastrukturalne, dostępność.",
      "Możliwość samodzielnego przemieszczania się, korzystania z usług bez asysty.",
      "Dostęp do adekwatnej opieki medycznej, fizjoterapii, farmakoterapii i pomocy w codziennych czynnościach (jeśli jest to konieczne).",
      "Rozwój zainteresowań.",
      "Dostosowane mieszkań i wyposażenia ich pod kątem potrzeb osób z niepełnosprawnością i ich ograniczeń funkcjonalnych.",
    ],
    persona: KRYSTIAN,
    personas: [KRYSTIAN],
    figures: [
      fig("30,1%", "Wskaźnik zatrudnienia osób z niepełnosprawnością w wieku 16-64 lata (koniec 2023 r.)", "2023", 12),
      fig("5,4 mln", "Liczba osób niepełnosprawnych ogółem (NSP 2021, stan na 31 marca 2021 r.)", "2021", 13),
      fig("14,3%", "Udział osób niepełnosprawnych w ludności kraju (NSP 2021)", "2021", 13),
      fig("12,2%", "Udział osób niepełnosprawnych w ludności kraju w 2011 r.", "2011", 13),
      fig("14,3%", "Udział osób niepełnosprawnych w ludności kraju w 2002 r.", "2002", 13),
      fig("45,1%", "Udział mężczyzn wśród osób niepełnosprawnych (NSP 2021)", "2021", 13),
      fig("54,9%", "Udział kobiet wśród osób niepełnosprawnych (NSP 2021)", "2021", 13),
    ],
    reports: [
      {
        title: "Strategia na rzecz Osób z Niepełnosprawnościami 2021-2030 MONITOR POLSKI 2021 r. poz. 218",
        url: "https://niepelnosprawni.gov.pl/p,170,strategia-na-rzecz-osob-z-niepelnosprawnosciami-2021-2030",
        page: 16,
      },
      {
        title: "Konwencja o prawach osób niepełnosprawnych. Poradnik RPO. Rzecznik Praw Obywatelskich, Warszawa 2013",
        url: "https://bip.brpo.gov.pl/sites/default/files/BIULETYN%20RPO%20%E2%80%93%20Materia%C5%82y%20nr%2082%20KPON.pdf",
        page: 16,
      },
      {
        title: "E-podręcznik dostępny dla wszystkich. Poradnik dla twórców elektronicznych materiałów edukacyjnych. Fundacja Instytut Rozwoju Regionalnego, 2013",
        url: "https://www.power.gov.pl/media/13591/e_podrecznik_dostepny_dla_wszystkich.pdf",
        page: 16,
      },
      // The source adds „autor:" and an individual's name; left out (no personal data).
      { title: "Projektowanie bez barier - wytyczne, Stowarzyszenie Przyjaciół Integracji", url: "https://www.power.gov.pl/media/13910/projektowanie_zus.pdf", page: 16 },
      {
        title: "Sami-Dzielni! Nowe standardy mieszkalnictwa wspomaganego dla osób z niepełnosprawnościami sprzężonymi 2023",
        url: "https://rops.krakow.pl/dzial-publikacje/sami-dzielni-nowe-standardy-mieszkalnictwa-wspomaganego-dla-osob-z-niepelnosprawnosciami-sprzezonymi-2023-1",
        page: 16,
      },
    ],
    pages: [12, 13, 14, 15, 16],
  },
  {
    key: "poverty",
    label: "Ubóstwo",
    definition: [
      "W 2023 roku ubóstwo skrajne w Polsce, dotyczyło 6,6% gospodarstw domowych, co stanowi wzrost względem roku poprzedniego na poziomie 2 pp.",
      "Do grup najczęściej doświadczających ubóstwa skrajnego, można zaliczyć w szczególności beneficjentów świadczeń społecznych, rolników, mieszkańców wsi, zwłaszcza poza aglomeracyjnych terenów wiejskich.",
      "W 2023 roku progi określające granice ubóstwa dla 1-osobowych gospodarstw wyniosły 776 zł w przypadku ubóstwa ustawowego, 1 092 zł – ubóstwa relatywnego, 913 zł – ubóstwa skrajnego.",
      "Blisko 78% osób ubogich korzystających z bezpłatnej pomocy żywnościowej stwierdziło, że ich sytuacja ekonomiczna pogorszyła w ostatnim roku. Ponad 53% ankietowanych przyznało, że ich środki finansowe nie wystarczają na zaspokojenie podstawowych potrzeb (badanie Federacji Banków Żywności z 2023 r.).",
    ].join("\n\n"),
    analysis: [
      "Ubóstwo ekonomiczne dotyka Polaków w różnym stopniu w zależności od grup społecznych. Zasięg ubóstwa skrajnego w 2023 roku był najniższy w przypadku osób pracujących na własny rachunek, gdyż mierzyło się z nim zaledwie 3,8% Polaków. Wśród emerytów wynosiło ono 5,9%, a w grupie pracowników 6,4%. Z problemem tym mierzyło się także 8,4% rencistów oraz 14,1% rolników. Najwyższy poziom ubóstwa odnotowano w przypadku osób utrzymujących się z innych niezarobkowych źródeł, gdzie ubóstwo skrajne dotyczyło aż 17,9% tej grupy. Wszystkie powyższe wartości wzrosły względem 2022 roku.",
      "W Polsce występuje także zjawisko pracujących biednych (working poor). Osoby biedne często nie są bezrobotne - pracują na nisko opłacanych stanowiskach, są to zazwyczaj osoby o niskich kwalifikacjach i podstawowym wykształceniu.",
      "Według GUS w 2023 roku wśród osób z wykształceniem maksymalnie gimnazjalnym, średnio co ósma żyła w ubóstwie skrajnym (12,8%). Wśród osób z wykształceniem wyższym był to najniższy odsetek - 3,5%.",
      "Jedna piąta Polaków w wieku 25-55 lat nie jest w stanie zainwestować w siebie i nie poszerza kwalifikacji, które mogłyby przełożyć się na lepiej płatną pracę (Raport o biedzie 2023, Szlachetna Paczka).",
      "Odnotowany w 2023 odsetek wyrażających lęk przed biedą jest najwyższy od 2015 roku i wyniósł aż 30%.",
    ],
    keyChallengesIntro: "Realizacja działań na rzecz różnych grup:",
    keyChallenges: [
      "ubóstwo dzieci - np. dobrej jakości usługi wczesnej opieki i edukacji (żłobki, przedszkola) zwiększające szanse dzieci z rodzin o niskich dochodach na to, że będą sobie lepiej radziły w szkole i w dorosłym życiu",
      "ubóstwo seniorów",
      "ubóstwo osób z niepełnosprawnościami",
      "ubóstwo osób pracujących (np. rolników gospodarujących na niewielkich areałach)",
      "ubóstwo osób bezrobotnych i bezdomnych – np. zatrudnienie socjalne (reintegracja zawodowa i społeczna oraz zatrudnienie wspomagane) oraz spółdzielczość socjalna ubogich osób bezrobotnych",
      "ubóstwo uchodźców z Ukrainy",
      "ubóstwo energetyczne",
      "głód i niedożywienie",
    ],
    persona: TOMEK,
    personas: [TOMEK],
    figures: [
      fig("6,6%", "Gospodarstwa domowe w ubóstwie skrajnym", "2023", 17),
      fig("2 pp.", "Wzrost odsetka gospodarstw domowych w ubóstwie skrajnym względem roku poprzedniego", "2023", 17),
      fig("776 zł", "Próg ubóstwa ustawowego dla gospodarstwa 1-osobowego", "2023", 17),
      fig("1 092 zł", "Próg ubóstwa relatywnego dla gospodarstwa 1-osobowego", "2023", 17),
      fig("913 zł", "Próg ubóstwa skrajnego dla gospodarstwa 1-osobowego", "2023", 17),
      fig("blisko 78%", "Osoby ubogie korzystające z bezpłatnej pomocy żywnościowej, których sytuacja ekonomiczna pogorszyła się w ostatnim roku (badanie Federacji Banków Żywności)", "2023", 17),
      fig("ponad 53%", "Ankietowani, którym środki finansowe nie wystarczają na zaspokojenie podstawowych potrzeb (badanie Federacji Banków Żywności)", "2023", 17),
      fig("3,8%", "Zasięg ubóstwa skrajnego — osoby pracujące na własny rachunek", "2023", 18),
      fig("5,9%", "Zasięg ubóstwa skrajnego — emeryci", "2023", 18),
      fig("6,4%", "Zasięg ubóstwa skrajnego — pracownicy", "2023", 18),
      fig("8,4%", "Zasięg ubóstwa skrajnego — renciści", "2023", 18),
      fig("14,1%", "Zasięg ubóstwa skrajnego — rolnicy", "2023", 18),
      fig("17,9%", "Zasięg ubóstwa skrajnego — osoby utrzymujące się z innych niezarobkowych źródeł", "2023", 18),
      fig("12,8%", "Ubóstwo skrajne wśród osób z wykształceniem maksymalnie gimnazjalnym („średnio co ósma”)", "2023", 18),
      fig("3,5%", "Ubóstwo skrajne wśród osób z wykształceniem wyższym", "2023", 18),
      fig("jedna piąta", "Polacy w wieku 25-55 lat, którzy nie są w stanie zainwestować w siebie i nie poszerzają kwalifikacji (Raport o biedzie 2023, Szlachetna Paczka)", "2023", 18),
      fig("30%", "Odsetek wyrażających lęk przed biedą — najwyższy od 2015 roku", "2023", 18),
    ],
    reports: [
      { title: "Raport o biedzie 2023, Szlachetna Paczka", url: "https://www.szlachetnapaczka.pl/raport-o-biedzie/", page: 21 },
      {
        title: "POVERTY WATCH 2023 monitoring ubóstwa i polityki społecznej przeciw ubóstwu w Polsce 2022-2023",
        url: "https://www.eapn.org.pl/eapn/uploads/2023/10/poverty_watch_23_v12_10_v2_ost.pdf",
        page: 21,
      },
      {
        title: "Zasięg ubóstwa ekonomicznego w Polsce w 2023 r. Główny Urząd Statystyczny",
        url: "https://stat.gov.pl/obszary-tematyczne/warunki-zycia/ubostwo-pomoc-spoleczna/zasieg-ubostwa-ekonomicznego-w-polsce-w-2023-roku,14,11.html",
        page: 21,
      },
      {
        title: "POVERTY WATCH 2022 monitoring ubóstwa finansowego i polityki społecznej przeciw ubóstwu w Polsce 2021-2022.",
        url: "https://www.eapn.org.pl/eapn/uploads/2022/10/monitoring_ubostwa_2022_ost.pdf",
        page: 21,
      },
    ],
    pages: [17, 18, 19, 20, 21],
  },
  {
    key: "migrants",
    label: "Integracja cudzoziemców",
    definition: [
      "Integracja cudzoziemców jest elementem polityk włączających, czyli takich, które oferują wszystkim mieszkańcom gmin równe szanse uczestnictwa w życiu ekonomicznym, społecznym, kulturowym i politycznym.",
      "Polityki integrujące cudzoziemców zapewniają wszystkim, także tym nie mówiącym w języku polskim równe szanse korzystania z publicznych usług.",
    ].join("\n\n"),
    analysis: [
      "Samo pojęcie „włączania” nie odnosi się tu do asymilacji, tylko integracji jako wielostronnego i wielotorowego procesu.",
      "Model takiej integracji cudzoziemców może obejmować:",
      "1. Partycypacyjne projektowanie i wdrażanie działań włączających migrantki i migrantów, polegające na współpracy lokalnego samorządu z różnymi interesariuszami, w tym lokalnymi organizacjami społecznymi oraz organizacjami i grupami reprezentującymi migrantów.",
      "2. Badania - planowanie działań w oparciu o dowody, w tym diagnozę potrzeb, a także wyniki badań realizowanych w różnych innych kontekstach oraz ewaluację, we współpracy z ośrodkami badawczym.",
      "3. Skuteczną koordynację wymiany informacji oraz planowanych długofalowo działań lokalnych, realizowaną przez wiodącą jednostkę w ramach administracji lokalnej.",
      "4. Stabilne finansowanie, konieczność zapewnienia finansowania działań zarówno samej administracji, jak i zaangażowanych organizacji społecznych wychodzących poza system finansowania tymczasowego w ramach działań projektowych (często stosunkowo krótkotrwałych, bez gwarancji kontynuacji).",
      "5. Dbałość o dostosowanie wszelkich usług do potrzeb migrantów na równi z innymi mieszkańcami, a tym samym, równe traktowanie migrantów w dostępie do usług publicznych.",
      "6. Równy dostęp, czyli wyrównanie szans migrantów w dostępie do usług publicznych, co wymaga tworzenia również programów celowanych, czyli specjalnie adresowanych do migrantów, takich jak na przykład kursy nauki języka polskiego dla dzieci i dorosłych.",
    ],
    keyChallengesIntro: null,
    keyChallenges: [
      "Zapewnienie migrantom równego dostępu do usług społecznych.",
      "Zindywidualizowanie niektórych usług publicznych, zgodnie z potrzebami i problemami migrantów (np. zapewnienie tłumacza, asysta kulturowa, indywidualne programy integracji).",
      "Włączenie kulturowe cudzoziemców, w tym dzieci i młodzieży w wieku szkolnym.",
      "Rynek pracy otwarty na cudzoziemców, zapewniający formy wsparcia zgodne z kwalifikacjami, wykształceniem itp. (w tym m.in. nauka języka branżowego, uznawania kwalifikacji zdobytych za granicą).",
      "Integracja dzieci migrantów w polskim w systemie edukacyjnym.",
      "Zmiana/wzmacnianie postaw wolnych od stereotypów, względem cudzoziemców przebywających na terenie Polski.",
      "Zabezpieczenie potrzeb w zakresie zdrowia psychicznego cudzoziemców.",
    ],
    persona: SWIETLANA,
    personas: [SWIETLANA],
    figures: [],
    reports: [
      {
        title: "Model lokalnej polityki włączania migrantów i migrantek w życie miast. Założenia i rekomendacje. Laboratorium Polityk Migracyjnych Miast i Regionów OBM UW, 2023",
        // the PDF's link carries a Facebook click id (?fbclid=…); dropped, the document is the same
        url: "https://nomada.info.pl/wp-content/uploads/2023/08/Model_polityki_wlaczania_migrantow_i_migrantek_FIN.pdf",
        page: 26,
      },
      {
        title: "Uchodźcy z Ukrainy w Polsce. Wyzwania i potencjał integracji. Monitor Deloitte, 2022",
        url: "https://www2.deloitte.com/content/dam/Deloitte/pl/Documents/Reports/pl-Uchodzcy-z-Ukrainy-w-Polsce-Report.pdf",
        page: 26,
      },
      {
        title: "Biała Księga. Wyzwania systemowego wsparcia uchodźców na poziomie lokalnym i krajowym, 2022.",
        url: "https://www.batory.org.pl/wp-content/uploads/2022/06/Okragly_stol_Biala-ksiega_www_S.pdf",
        page: 26,
      },
      { title: "Polacy i Ukraińcy - wyzwania integracji uchodźców, 2023. Polski Instytut Ekonomiczny", url: "https://pie.net.pl/wp-content/uploads/2023/05/Wyzwania-integracji-.pdf", page: 26 },
    ],
    pages: [22, 23, 24, 25, 26],
  },
  {
    key: "health",
    label: "Zdrowie",
    definition:
      "W dzisiejszym świecie pełnym wyzwań związanych ze stylem życia, środowiskiem czy presją społeczną, promowanie zdrowego stylu życia staje się coraz istotniejsze. Edukacja zdrowotna, dostęp do opieki medycznej, prewencja chorób czy promocja zdrowego środowiska to kluczowe obszary, które wspierają zdrowie psychiczne i fizyczne jednostek i społeczeństw jako całości.",
    analysis: [
      "Pośród problemów zdrowotnych choroba niedokrwienna serca jest i nadal będzie największym wyzwaniem dla polskiego systemu ochrony zdrowia. Konieczne jest podjęcie działań w celu odwrócenia trendu wzrostowego zachorowalności, chorobowości i umieralności na to schorzenie.",
      "Niezwykle poważnym problem zdrowotnym pozostają udary, które oprócz tego, że stanowią drugą najczęstszą przyczynę zgonów, znacząco wpływają na sprawność psychofizyczną.",
      "W najbliższych latach spodziewamy się wzrostu liczby nowych przypadków i zgonów wśród pacjentów cierpiących na choroby nowotworowe. Jednocześnie znaczny wzrost we wszystkich istotnych wskaźnikach notuje choroba Alzheimera i inne choroby otępienne.",
      "Nieustająco problemem są również choroby przewlekłe, takie jak cukrzyca oraz obturacyjna choroba płuc, a także choroby psychiczne.",
      "Pandemia wywołała lub nasiliła samotność, która dotyka głównie osoby starsze, mieszkające w pojedynkę. Z powodów wielu chorób czy niepełnosprawności lub lęku przed światem nie opuszczają one swoich mieszkań. Następstwem izolacji mogą być zaburzenia uwagi, pamięci, zmęczenie czy nawet choroby psychiczne.",
      "Jednymi z głównych przyczyn zwiększenia wskaźnika umieralności w Polsce są palenie tytoniu i nieodpowiednia dieta.",
    ],
    keyChallengesIntro:
      "Poprawa stanu zdrowia społeczeństwa to kompleksowe zadanie, które wymaga uwzględnienia wielu czynników. Główne wyzwania związane z tą kwestią obejmują:",
    keyChallenges: [
      "Wzrost świadomości i edukacja w zakresie zdrowego stylu życia, prewencji chorób oraz znaczenia zdrowej diety i aktywności fizycznej.",
      "Zapewnienie równego dostępu do wysokiej jakości opieki zdrowotnej dla wszystkich warstw społeczeństwa.",
      "Dostosowanie systemów opieki zdrowotnej do rosnącej liczby osób starszych, ze szczególnym uwzględnieniem opieki długoterminowej.",
      "Promocja zdrowia wśród młodych: inwestowanie w zdrowie dzieci i młodzieży, aby zbudować zdrową przyszłość społeczeństwa.",
      "Świadomość zdrowia psychicznego: Zwiększenie świadomości na temat znaczenia zdrowia psychicznego i przeciwdziałanie stygmatyzacji związanej z problemami psychicznymi.",
    ],
    persona: STANISLAW,
    personas: [STANISLAW],
    figures: [],
    reports: [
      { title: "Raport o samotności 2021. Pierwszy rok pandemii. Szlachetna Paczka", url: "https://www.szlachetnapaczka.pl/raport-o-samotnosci/", page: 31 },
      { title: "Mapy potrzeb zdrowotnych – Baza Analiz Systemowych i Wdrożeniowych 2021", url: "https://dziennikmz.mz.gov.pl/legalact/2021/69/", page: 31 },
      {
        title: "State of Health in the UE Polska. Profil systemu ochrony zdrowia 2023",
        url: "https://www.oecd.org/pl/publications/polska-profil-systemu-ochrony-zdrowia-2023_b12d3d03-pl.html",
        page: 31,
      },
    ],
    pages: [27, 28, 29, 30, 31],
  },
  {
    key: "mental_health",
    label: "Zdrowie psychiczne",
    definition: [
      "Dobrostan jednostki obejmuje równowagę emocjonalną, psychiczną i społeczną. Osoba ciesząca się dobrym zdrowiem psychicznym ma zdolność radzenia sobie ze stresem, utrzymywania satysfakcjonujących relacji z otoczeniem, czy podejmowania skutecznych decyzji.",
      "Zdrowie psychiczne nie oznacza jedynie braku chorób psychicznych, ale jest także warunkiem pozytywnego samopoczucia, rozwoju osobistego oraz umiejętności adaptacji do zmian w życiu.",
    ].join("\n\n"),
    analysis: [
      // slide 33: „Analiza danych zastanych (dzieci i młodzież)"
      "Młodzi Polacy w wieku szkolnym coraz częściej zmagają się z brakiem zainteresowania i ogólnej motywacji do działania, a także deklarują problem z samoakceptacją.",
      "Niepokojące dane wskazują na wzrost prób samobójczych wśród dzieci i młodzieży. Również znaczna ich część podejmuje rozmowy związane z odebraniem sobie życia, bądź ma myśli samobójcze.",
      "Udowodniono, że nadmierne korzystanie z urządzeń elektronicznych i Internetu przez dzieci i młodzież, może mieć realny wpływ na występowanie stanów depresyjnych czy też problemów w zakresie odżywiania i postrzegania własnego ciała.",
      "Jednym ze zjawisk dotykających obecnie średnio co trzeciego młodego Polaka jest FOMO (ang. Fear of missing out), czyli lęk przed odłączeniem od sieci i poczucie, że wówczas coś ich może ominąć.",
      // slide 34: „Analiza danych zastanych (osoby dorosłe)"
      "Jednym z długofalowych skutków pandemii koronawirusa są problemy w zakresie zdrowia psychicznego jest, zarówno wśród młodych, jak i dorosłych osób.",
      "Poziom finansowania opieki w zakresie zdrowia psychicznego jest w Polsce bardzo niski (ok. 3% wydatków NFZ).",
      "Czynniki stresogenne w miejscu pracy mają negatywny wpływ na stan zdrowia psychicznego większości pracowników. Część pracodawców podejmuje inicjatywy mające na celu tylko powierzchowne zmniejszenie obciążenia psychicznego swoich pracowników (np. strefy relaksu, dodatkowe dni wolne), jednakże nie są to działania ukierunkowane na wyeliminowanie bądź ograniczenie kluczowych czynników powodujących stres.",
      "Problemy ze zdrowiem psychicznym mogą być w Polsce bardziej powszechne niż jest to zgłaszane ze względu na brak świadomości, stygmatyzację społeczną i słaby dostęp do usług.",
    ],
    keyChallengesIntro:
      "Zapobieganie oraz podejmowanie efektywnych działań w celu ograniczenia problemów natury psychicznej wśród mieszkańców naszego kraju, powinno być realizowane poprzez:",
    keyChallenges: [
      "Zwiększenie działań na rzecz rozwoju edukacji prozdrowotnej w tym zdrowia psychicznego, szczególnie wśród dzieci, młodzieży i osób w podeszłym wieku.",
      "Wzmacnianie kompetencji rodzicielskich w zakresie prawidłowego rozpoznawania oraz reagowania na sygnały mogące świadczyć o problemach natury psychicznej swoich dzieci.",
      "Zmiana modelu funkcjonowania systemu ochrony zdrowia psychicznego w Polsce - przejście z opieki instytucjonalnej na środowiskową.",
      "Ograniczanie zjawiska stygmatyzacji osób zmagających się z problemami natury psychicznej, co wpływa znacznie na niechęć do uzyskania specjalistycznej pomocy oraz może prowadzić do pogłębienia tego rodzaju problemów.",
    ],
    persona: MATEUSZ,
    personas: [MATEUSZ, KARINA],
    figures: [
      fig("średnio co trzeci", "Młodzi Polacy, których dotyka FOMO (lęk przed odłączeniem od sieci)", null, 33),
      fig("ok. 3%", "Udział opieki w zakresie zdrowia psychicznego w wydatkach NFZ", null, 34),
    ],
    reports: [
      {
        title: "Pomiędzy pandemią COVID-19 a wojną w Ukrainie. Diagnoza stanu polskiego społeczeństwa, Kraków 2022",
        url: "http://fundacjaprofuturo.pl/wp-content/uploads/2023/04/Pomi%C4%99dzy-pandemi%C4%85-COVID-19-a-wojn%C4%85-w-Ukrainie-Diagonoza.2022-ebook.pdf",
        page: 38,
      },
      // No alternative text on this cover; title as printed on it (author's name left out).
      {
        title: "Raport z badania kondycji psychicznej młodzieży 2022",
        url: "https://rep.up.krakow.pl/xmlui/bitstream/handle/11716/13321/Solecki%20-%20Raport%20z%20badania%20kondycji%20psychicznej%20m%c5%82odzierzy.pdf?sequence=1&isAllowed=y",
        page: 38,
      },
      {
        title: "Młode głowy. Otwarcie o zdrowiu psychicznym. Fundacja UNAWEZA, 2023",
        url: "https://mlodeglowy.pl/wp-content/uploads/2023/04/MLODE-GLOWY.-Otwarcie-o-zdrowiu-psychicznym_-Raport-final.pdf",
        page: 38,
      },
      { title: "Polska: Profil systemu ochrony zdrowia 2023, State of Health in the EU", url: OECD_2023, page: 38 },
      { title: "People at Work 2022: A Global Workforce View", url: "https://pl.adp.com/baza-wiedzy-hr/insights/people-at-work-2022-a-global-workforce-view.aspx", page: 38 },
    ],
    pages: [32, 33, 34, 35, 36, 37, 38],
  },
  {
    key: "seniors",
    label: "Seniorzy",
    definition: [
      "Sytuacja społeczna Seniorów jest często odzwierciedleniem aktualnych wyzwań socjalnych i obywatelskich. Współcześnie stajemy przed zadaniem dostosowania się do starzejącej się populacji, co wymaga skutecznych działań w obszarze opieki zdrowotnej i opiekuńczej, ale także wsparcia w zapewnieniu godnej starości.",
      "Osoby starsze powinny mieć możliwość pełnego i efektywnego bycia częścią społeczeństwa, mieć zapewnione prawo do życia w sposób bezpieczny, wolny od dyskryminacji, izolacji, zaniedbania i na tyle niezależny jak to tylko możliwe.",
    ].join("\n\n"),
    analysis: [
      "Zgodnie z najnowszymi badaniami, największymi problemami seniorów, w których oczekują pomocy i wsparcia są: zdrowie, samotność, finanse i potrzeba cyfryzacji.",
      "Postępujące zjawisko starzejącego się społeczeństwa w Polsce, jak i innych krajach będzie pociągać za sobą negatywne skutki nie tylko dla seniorów, ale również wpływać na ogólny rozwój kraju.",
      "W dalszym ciągu znaczna liczba seniorów zamieszkuje w budynkach posiadających bariery architektoniczne. Jest to szczególnie uciążliwe w przypadku osób mieszkających samotnie, co jest charakterystyczne przede wszystkim dla obszarów miejskich.",
      "Nawykiem niosącym duże niebezpieczeństwo szczególnie w przypadku seniorów jest polipragmazja, czyli tzw. wielolekowość, objawiająca się przyjmowaniem wielu leków i suplementów jednocześnie, co może prowadzić do interakcji między nimi i działań niepożądanych.",
      "Poczucie samotności stanowiące nadal problem dotykający grupę społeczną jaką są seniorzy, skorelowana jest poniekąd z sytuacją materialną (im gorsza sytuacja materialna, tym większe poczucie samotności).",
    ],
    keyChallengesIntro: null,
    keyChallenges: [
      "Konieczność dostosowania bazy instytucjonalnej i usług zdrowotnych do potrzeb starzejącego się społeczeństwa, również w oparciu o nowoczesne technologie.",
      "Wdrażanie standardów uniwersalnego projektowania w przestrzeni wspólnej oraz w budownictwie mieszkalnym, m.in. we współpracy z samymi odbiorcami oraz organizacjami działającymi na ich rzecz, w tym rozwój mieszkalnictwa senioralnego.",
      "Kształtowanie odpowiedzialnej postawy seniorów względem sięgania po leki i suplementy oraz uwrażliwienie opiekunów osób starszych na to zjawisko.",
      "Poszerzanie oferty aktywizacji i integracji seniorów, z uwzględnieniem ich możliwości psychofizycznych, sytuacji materialnej oraz innych istotnych czynników.",
      "Rozwój kompetencji cyfrowych seniorów, które mogłyby stanowić odpowiedź na problemy w obszarze zdrowia oraz relacji towarzyskich.",
      "Poprawa dostępności do usług opiekuńczych (w obrębie gmin), w tym specjalistycznych usług opiekuńczych, które są osobami samotnymi lub samotnie gospodarującymi, a także tych, które pozostają w rodzinie.",
    ],
    persona: JANINA,
    personas: [JANINA],
    figures: [],
    reports: [
      {
        title: "Sytuacja osób starszych w Polsce w 2022 r., Główny Urząd Statystyczny",
        url: "https://stat.gov.pl/obszary-tematyczne/osoby-starsze/osoby-starsze/sytuacja-osob-starszych-w-polsce-w-2022-roku,2,5.html",
        page: 43,
      },
      {
        title: "Ocena potrzeb w zakresie wsparcia dla Seniorów w Polsce 2023. Raport z badania opinii publicznej. SeniorApp",
        url: "https://seniorapp.pl/wp-content/uploads/2023/10/Raport_SeniorApp_2023_19.10.23_small.pdf",
        page: 43,
      },
      {
        title: "Wielolekowość seniorów w Polsce, aspekty prawno-społeczne i medyczne. Raport 2021. FCIS Instytut dla zdrowej i lepszej starości",
        url: "https://fundacjafcis.pl/wielolekowosc-seniorow-w-polsce-aspekty-prawno-spoleczne-i-medyczne-raport/",
        page: 43,
      },
    ],
    pages: [39, 40, 41, 42, 43],
  },
];

async function main() {
  const pdf = await politeFetch(MAPA_URL);
  const out = Knowledge.parse({
    source: {
      title: "Mapa Wyzwań Społecznych",
      url: MAPA_URL,
      publisher: "ROPS Kraków",
      date: "2024-11",
      capturedAt: pdf.capturedAt,
      sha256: pdf.sha256,
      note: "Dane ogólnopolskie. Mapa opracowana przez Regionalny Ośrodek Polityki Społecznej w Krakowie (Dział Innowacji Społecznych) na potrzeby projektu „Inkubator Włączenia Społecznego 2.0” (FERS, Działanie 5.1). Persony są fikcyjne.",
    },
    areas: AREAS,
  });
  writeJson("data/knowledge.json", out);
  console.log(
    `knowledge.json: ${out.areas.length} obszarów, ${out.areas.reduce((a, x) => a + x.figures.length, 0)} liczb, ${out.areas.reduce((a, x) => a + x.reports.length, 0)} raportów, ${out.areas.reduce((a, x) => a + x.personas.length, 0)} person`,
  );
}

await main();
