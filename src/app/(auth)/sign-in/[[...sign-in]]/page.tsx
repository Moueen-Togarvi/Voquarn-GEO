import { SignIn } from "@clerk/nextjs";

export default function SignInPage() {
  return (
    <SignIn
      path="/sign-in"
      signUpUrl="/sign-up"
      fallbackRedirectUrl="/dashboard"
      fallback={
        <div className="text-muted-foreground text-sm">Loading sign-in…</div>
      }
    />
  );
}
