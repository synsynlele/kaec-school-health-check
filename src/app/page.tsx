import { Header } from "@/components/site/Header";
import { Footer } from "@/components/site/Footer";
import { Hero } from "@/components/landing/Hero";
import { Faq } from "@/components/landing/Faq";
import {
  About,
  Benefits,
  ContactSection,
  HowItWorks,
  Receive,
  StatsStrip,
} from "@/components/landing/Sections";
import { getGlobalStats } from "@/lib/storage";

export const dynamic = "force-dynamic";

export default async function LandingPage() {
  const stats = await getGlobalStats();

  return (
    <>
      <Header />
      <main>
        <Hero />
        <StatsStrip stats={stats} />
        <HowItWorks />
        <Benefits />
        <Receive />
        <Faq />
        <About />
        <ContactSection />
      </main>
      <Footer />
    </>
  );
}
