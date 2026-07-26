import { SignUp } from "@clerk/nextjs";

export default function SignUpPage() {
  return (
    <SignUp
      path="/sign-up"
      signInUrl="/sign-in"
      fallbackRedirectUrl="/dashboard"
      fallback={
        <div className="text-muted-foreground text-sm">Loading sign-up…</div>
      }
    />
  );
}
