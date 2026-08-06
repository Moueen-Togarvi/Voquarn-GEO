"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { authClient } from "@/lib/auth/client";

function slugify(value: string): string {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

export default function SignUpPage() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setPending(true);

    const signUpResult = await authClient.signUp.email({
      name,
      email,
      password,
    });
    if (signUpResult.error) {
      setError(
        signUpResult.error.message ?? "We could not create your account.",
      );
      setPending(false);
      return;
    }

    // Every account gets a personal workspace immediately — there is no
    // "join later" step in this beta, and requireWorkspaceContext() requires
    // an active workspace on every subsequent page.
    const slug = `${slugify(name) || "workspace"}-${Date.now().toString(36)}`;
    const orgResult = await authClient.organization.create({
      name: `${name}'s Workspace`,
      slug,
    });

    if (orgResult.error || !orgResult.data) {
      setError(
        "Your account was created, but we could not set up your workspace. Try signing in.",
      );
      setPending(false);
      return;
    }

    // organization.create() activates the new org for most sessions, but
    // this makes it explicit rather than assumed.
    await authClient.organization.setActive({
      organizationId: orgResult.data.id,
    });

    router.push("/onboarding");
    router.refresh();
  }

  return (
    <main className="auth-shell">
      <div className="auth-card">
        <div>
          <h1>Create your account</h1>
          <p>Start measuring how AI engines see your brand.</p>
        </div>

        {error ? (
          <div className="form-alert" role="alert">
            {error}
          </div>
        ) : null}

        <form className="auth-form" onSubmit={handleSubmit} noValidate>
          <label className="field">
            <span>Name</span>
            <input
              value={name}
              onChange={(event) => setName(event.target.value)}
              autoComplete="name"
              required
              disabled={pending}
            />
          </label>
          <label className="field">
            <span>Email</span>
            <input
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              autoComplete="email"
              required
              disabled={pending}
            />
          </label>
          <label className="field">
            <span>Password</span>
            <input
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              autoComplete="new-password"
              minLength={8}
              required
              disabled={pending}
            />
            <small>At least 8 characters.</small>
          </label>
          <button
            className="button button-primary button-large"
            type="submit"
            disabled={pending}
          >
            {pending ? "Creating account…" : "Create account"}
          </button>
        </form>

        <p className="auth-footer">
          Already have an account? <Link href="/sign-in">Sign in</Link>
        </p>
      </div>
    </main>
  );
}
