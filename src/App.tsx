import { Toaster } from "sonner";
import { Header } from "~/components/Layout/Header";
import { Footer } from "~/components/Layout/Footer";
import { Hero } from "~/components/Hero";
import { Stats } from "~/components/Stats";
import { AgentList } from "~/components/AgentList";
import { TryIt } from "~/components/TryIt";
import { useJobSubscription } from "~/hooks/useJobs";

export function App() {
  useJobSubscription();

  return (
    <div className="min-h-screen bg-white">
      <Toaster
        position="bottom-right"
        toastOptions={{
          style: {
            background: "#ffffff",
            color: "#111111",
            border: "1px solid #e5e5e5",
            borderRadius: "12px",
            fontSize: "13px",
            fontWeight: 500,
            boxShadow: "0 4px 24px rgba(0,0,0,0.10), 0 1px 4px rgba(0,0,0,0.06)",
          },
          descriptionStyle: {
            color: "#737373",
            fontWeight: 400,
          },
        }}
      />
      <Header />
      <Hero />
      <Stats />
      <TryIt />
      <AgentList />
      <Footer />
    </div>
  );
}
