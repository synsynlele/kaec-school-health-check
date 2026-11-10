import { LoadingScreen } from "@/components/navigation/LoadingScreen";

export default function SchoolPageLoading() {
  return (
    <div className="mx-auto max-w-4xl px-4 py-6 sm:px-6">
      <LoadingScreen inline />
    </div>
  );
}
