import { ClerkProvider } from "@clerk/nextjs";
import { requireArea } from "@/lib/auth.js";
import MembersNav from "@/components/members/MembersNav.jsx";

export const metadata = { robots: { index: false } };

export default async function MembersLayout({ children }) {
  await requireArea("members");
  return (
    <ClerkProvider>
      <div className="admin members-area">
        <MembersNav />
        {children}
      </div>
    </ClerkProvider>
  );
}
