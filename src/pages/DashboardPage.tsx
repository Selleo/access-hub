import { PageHeader } from "../components/PageHeader";
import { AppLayout } from "../components/AppLayout";
import { EmptyContent } from "../components/EmptyContent";

export function DashboardPage() {
  return (
    <AppLayout>
      <PageHeader title="Dashboard" />
      <EmptyContent />
    </AppLayout>
  );
}
