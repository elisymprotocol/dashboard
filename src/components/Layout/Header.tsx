import { useWallet } from "@solana/wallet-adapter-react";
import { useWalletModal } from "@solana/wallet-adapter-react-ui";
import { useNetwork, type Network } from "~/hooks/useNetwork";
import { truncateKey } from "~/lib/format";
import { track } from "~/lib/analytics";

export function Header() {
  const { network, setNetwork } = useNetwork();
  const { connected, publicKey, disconnect } = useWallet();
  const { setVisible } = useWalletModal();

  return (
    <header className="bg-black text-white">
      {connected && network === "devnet" && (
        <div className="bg-amber-500/90 text-black text-center text-xs py-1.5 font-medium">
          You're on Devnet. Make sure your wallet is also set to Devnet:{" "}
          <span className="font-normal">Settings &rarr; Developer Settings &rarr; Testnet Mode</span>
        </div>
      )}
      <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-3">
        <div className="flex items-center gap-3">
          <a href="/" className="shrink-0">
            <img src="/logo.png" alt="elisym" className="h-5" />
          </a>
          <span className="border border-white/20 rounded px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wider text-white/50">
            alpha
          </span>
          <div className="hidden sm:flex items-center rounded-full bg-white/10 p-0.5 text-xs font-medium">
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
        </div>

        <div className="flex items-center gap-3">
          {connected && publicKey ? (
            <button
              type="button"
              onClick={() => disconnect()}
              className="flex h-8 items-center gap-2 rounded-lg bg-white/10 px-3.5 text-sm font-medium text-white transition-colors hover:bg-white/20"
            >
              <span className="h-2 w-2 rounded-full bg-emerald-400" />
              {truncateKey(publicKey.toBase58(), 4)}
            </button>
          ) : (
            <button
              type="button"
              onClick={() => { track("wallet-connect"); setVisible(true); }}
              className="flex h-8 items-center gap-2 rounded-lg bg-white/10 px-4 text-sm font-medium text-white transition-colors hover:bg-white/20"
            >
              Connect
            </button>
          )}
        </div>

      </div>
    </header>
  );
}
