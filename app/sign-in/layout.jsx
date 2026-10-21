import { ClerkProvider } from "@clerk/nextjs";

export default function SignInLayout({ children }) {
  return <ClerkProvider>{children}</ClerkProvider>;
}
