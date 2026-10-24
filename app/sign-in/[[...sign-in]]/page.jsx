import { SignIn } from "@clerk/nextjs";

export const metadata = { title: "Sign in", robots: { index: false } };

// Own wrapper, not .page-hero: Clerk renders its own h1/p inside the card,
// and the page-hero heading styles would otherwise restyle them.
// withSignUp lets invited members create their account here: Clerk's invitation
// links land on this page with a __clerk_ticket the component redeems.
export default function SignInPage() {
  return (
    <section className="auth-page">
      <SignIn withSignUp fallbackRedirectUrl="/members" />
    </section>
  );
}
