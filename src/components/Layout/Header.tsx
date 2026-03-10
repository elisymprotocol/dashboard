import { useNetwork, type Network } from "~/hooks/useNetwork";

export function Header() {
  const { network, setNetwork } = useNetwork();

  return (
    <header className="bg-black text-white">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
        <div className="flex items-center gap-6">
          <a href="/">
            <img src="/logo.png" alt="elisym" className="h-6" />
          </a>
          <nav className="hidden items-center gap-4 text-sm text-gray-400 sm:flex">
            <a href="#agents" className="hover:text-white transition-colors">
              Agents
            </a>
            <a href="#try-it" className="hover:text-white transition-colors">
              Try it
            </a>
            <a href="#try-it" className="hover:text-white transition-colors">
              Jobs
            </a>
          </nav>
        </div>
        <div className="flex items-center rounded-full bg-white/10 p-0.5 text-xs">
          {(["devnet", "mainnet"] as Network[]).map((n) => (
            <button
              key={n}
              onClick={() => setNetwork(n)}
              className={`rounded-full px-3 py-1 font-medium transition-colors ${
                network === n
                  ? "bg-white text-black"
                  : "text-gray-400 hover:text-white"
              }`}
            >
              {n}
            </button>
          ))}
        </div>
      </div>
    </header>
  );
}
