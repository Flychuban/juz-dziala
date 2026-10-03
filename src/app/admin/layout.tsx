import { requireStaff, StaffLoginPrompt } from "~/components/layout/staff-gate";

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const staff = await requireStaff(["rops"]);
  if (!staff) return <StaffLoginPrompt role="rops" next="/admin" />;
  return <>{children}</>;
}
