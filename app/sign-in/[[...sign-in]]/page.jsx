import { SignIn } from "@clerk/nextjs";

export const metadata = { title: "Sign in", robots: { index: false } };

export default function SignInPage() {
  return (
    <section className="page-hero" style={{ display: "grid", placeItems: "center" }}>
      <h1 className="syne">Sign in</h1>
      <SignIn />
    </section>
  );
}
