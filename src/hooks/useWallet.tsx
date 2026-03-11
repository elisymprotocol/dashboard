import { type ReactNode, useMemo } from "react";
import {
  ConnectionProvider,
  WalletProvider as SolanaWalletProvider,
} from "@solana/wallet-adapter-react";
import { WalletModalProvider } from "@solana/wallet-adapter-react-ui";
import { PhantomWalletAdapter } from "@solana/wallet-adapter-phantom";
import { clusterApiUrl } from "@solana/web3.js";
import { useNetwork } from "./useNetwork";

import "@solana/wallet-adapter-react-ui/styles.css";

export function WalletProvider({ children }: { children: ReactNode }) {
  const { network } = useNetwork();
  const endpoint = useMemo(
    () => clusterApiUrl(network === "mainnet" ? "mainnet-beta" : "devnet"),
    [network],
  );
  const wallets = useMemo(() => [new PhantomWalletAdapter()], []);

  return (
    <ConnectionProvider endpoint={endpoint}>
      <SolanaWalletProvider wallets={wallets} autoConnect>
        <WalletModalProvider>{children}</WalletModalProvider>
      </SolanaWalletProvider>
    </ConnectionProvider>
  );
}
