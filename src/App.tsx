import { Toaster } from "sonner";
import { Header } from "~/components/Layout/Header";
import { Footer } from "~/components/Layout/Footer";
import { Hero } from "~/components/Hero";
import { Stats } from "~/components/Stats";
import { AgentList } from "~/components/AgentList";
import { MyJobs } from "~/components/MyJobs";
import { TryIt } from "~/components/TryIt";
export function App() {

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
          descriptionClassName: "text-neutral-500 font-normal",
        }}
      />
      <Header />
      <Hero />
      <Stats />
      <TryIt />
      <AgentList />
      <MyJobs />
      <Footer />
    </div>
  );
}
