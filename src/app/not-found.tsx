import Link from "next/link";

export default function NotFound() {
  return (
    <div className="mx-auto max-w-xl px-4 py-16">
      <h1 className="text-3xl font-bold">Nie ma takiej strony</h1>
      <p className="mt-3 text-lg">
        Adres mógł się zmienić albo zawiera literówkę.
      </p>
      <Link
        href="/"
        className="mt-6 inline-flex min-h-12 items-center font-semibold"
      >
        Wróć na stronę główną
      </Link>
    </div>
  );
}
