import { SignIn } from "@clerk/nextjs";

export const metadata = { title: "Sign in", robots: { index: false } };

// Own wrapper, not .page-hero: Clerk renders its own h1/p inside the card,
// and the page-hero heading styles would otherwise restyle them.
export default function SignInPage() {
  return (
    <section className="auth-page">
      <SignIn fallbackRedirectUrl="/members" />
    </section>
  );
}
