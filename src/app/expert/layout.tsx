import { requireStaff, StaffLoginPrompt } from "~/components/layout/staff-gate";

export default async function ExpertLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const staff = await requireStaff(["expert"]);
  if (!staff) return <StaffLoginPrompt role="expert" next="/expert" />;
  return <>{children}</>;
}
