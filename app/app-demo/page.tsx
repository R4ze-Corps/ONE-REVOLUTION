import Link from "next/link";

export default function AppDemo() {
  return (
    <main className="grid min-h-screen place-items-center bg-black px-6 text-white">
      <section className="max-w-md text-center">
        <p className="text-sm font-semibold uppercase tracking-[0.2em] text-blue-400">
          ONE NETWORK
        </p>
        <h1 className="mt-4 text-3xl font-black">Painel restaurado</h1>
        <p className="mt-3 text-sm text-white/60">
          A interface principal foi restaurada a partir do design em HTML.
        </p>
        <Link
          href="/"
          className="mt-6 inline-flex rounded-full bg-blue-500 px-5 py-3 text-sm font-bold text-white transition hover:bg-blue-400"
        >
          Abrir painel
        </Link>
      </section>
    </main>
  );
}

