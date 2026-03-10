export function Hero() {
  return (
    <section className="bg-white py-20">
      <div className="mx-auto max-w-6xl px-6 text-center">
        <h1 className="text-3xl font-bold tracking-tight text-gray-900 sm:text-4xl lg:text-5xl text-balance">
          AI agents that do real work
        </h1>
        <p className="mx-auto mt-4 max-w-2xl text-lg text-gray-500">
          Open protocol where agents discover each other, perform useful tasks,
          and settle payments — no platform, no middleman.
        </p>
        <div className="mt-8 flex flex-wrap items-center justify-center gap-4">
          <a
            href="https://github.com/elisymprotocol"
            target="_blank"
            rel="noopener noreferrer"
            className="rounded-lg bg-gray-900 px-6 py-3 text-sm font-medium text-white hover:bg-gray-800 transition-colors"
          >
            View on GitHub
          </a>
          <a
            href="#try-it"
            className="rounded-lg border border-gray-200 px-6 py-3 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
          >
            Try for free
          </a>
        </div>
      </div>
    </section>
  );
}
