import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter } from "react-router-dom";
import { NostrPoolProvider } from "~/hooks/useNostrPool";
import { NetworkProvider } from "~/hooks/useNetwork";
import { WalletProvider } from "~/hooks/useWallet";
import { App } from "./App";
import "./app.css";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 2,
      refetchOnWindowFocus: false,
    },
  },
});

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <NetworkProvider>
        <WalletProvider>
          <NostrPoolProvider>
            <BrowserRouter>
              <App />
            </BrowserRouter>
          </NostrPoolProvider>
        </WalletProvider>
      </NetworkProvider>
    </QueryClientProvider>
  </StrictMode>,
);
