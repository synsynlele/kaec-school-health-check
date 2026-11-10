import { LoadingScreen } from "@/components/navigation/LoadingScreen";

export default function KhposRouteLoading() {
  return (
    <main className="mx-auto max-w-4xl px-4 py-6 sm:px-6">
      <LoadingScreen inline />
    </main>
  );
}
