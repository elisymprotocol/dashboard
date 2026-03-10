import { useNetwork, type Network } from "~/hooks/useNetwork";

export function Header() {
  const { network, setNetwork } = useNetwork();

  return (
    <header className="bg-black text-white">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-3">
        <a href="/" className="shrink-0">
          <img src="/logo.png" alt="elisym" className="h-5" />
        </a>

        <div className="flex items-center rounded-full bg-white/10 p-0.5 text-xs font-medium">
          {(["devnet", "mainnet"] as Network[]).map((n) => (
            <button
              key={n}
              onClick={() => n === "devnet" && setNetwork(n)}
              className={`flex items-center rounded-full px-3 py-1 transition-all ${
                network === n
                  ? "bg-white text-black shadow-sm"
                  : n === "mainnet"
                    ? "cursor-not-allowed text-gray-600"
                    : "text-gray-400 hover:text-white"
              }`}
              disabled={n === "mainnet"}
              title={n === "mainnet" ? "Coming soon" : undefined}
            >
              {n}
            </button>
          ))}
        </div>

        <nav className="hidden items-center gap-1 sm:flex">
          {[
            { label: "Try it", href: "#try-it" },
            { label: "Elisym agents", href: "#agents" },
          ].map((link) => (
            <a
              key={link.href}
              href={link.href}
              className="rounded-lg px-3 py-1.5 text-sm text-gray-400 transition-colors hover:bg-white/10 hover:text-white"
            >
              {link.label}
            </a>
          ))}
        </nav>
      </div>
    </header>
  );
}
