"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useState } from "react";

import { authClient, useSession } from "@/lib/auth/client";

type Status = "checking" | "accepting" | "accepted" | "error";

export default function AcceptInvitePage() {
  const params = useParams<{ token: string }>();
  const router = useRouter();
  const { data: session, isPending: sessionPending } = useSession();
  const [status, setStatus] = useState<Status>("checking");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (sessionPending) return;
    if (!session) return; // Shown as a sign-in prompt below instead.

    let cancelled = false;

    async function accept() {
      setStatus("accepting");
      try {
        const result = await authClient.organization.acceptInvitation({
          invitationId: params.token,
        });
        if (cancelled) return;
        if (result.error || !result.data) {
          setError(
            result.error?.message ??
              "This invitation is no longer valid. Ask the workspace owner to send a new one.",
          );
          setStatus("error");
          return;
        }
        setStatus("accepted");
      } catch {
        if (!cancelled) {
          setError("We could not reach the server. Try again.");
          setStatus("error");
        }
      }
    }

    void accept();

    return () => {
      cancelled = true;
    };
  }, [session, sessionPending, params.token]);

  useEffect(() => {
    if (status !== "accepted") return;
    const timeout = window.setTimeout(() => {
      router.push("/");
      router.refresh();
    }, 1500);
    return () => window.clearTimeout(timeout);
  }, [status, router]);

  if (sessionPending || status === "checking" || status === "accepting") {
    return (
      <main className="auth-shell">
        <div className="auth-card" aria-busy="true" aria-live="polite">
          <h1>Joining workspace…</h1>
        </div>
      </main>
    );
  }

  if (!session) {
    const redirectTo = `/accept-invite/${params.token}`;
    return (
      <main className="auth-shell">
        <div className="auth-card">
          <h1>Sign in to accept this invitation</h1>
          <p>You need an account before you can join this workspace.</p>
          <Link
            className="button button-primary button-large"
            href={`/sign-in?redirectTo=${encodeURIComponent(redirectTo)}`}
          >
            Sign in
          </Link>
          <Link
            className="button button-secondary"
            href={`/sign-up?redirectTo=${encodeURIComponent(redirectTo)}`}
          >
            Create an account
          </Link>
        </div>
      </main>
    );
  }

  if (status === "error") {
    return (
      <main className="auth-shell">
        <div className="auth-card">
          <h1>Invitation could not be accepted</h1>
          <div className="form-alert" role="alert">
            {error}
          </div>
          <Link className="button button-secondary" href="/">
            Back to Voquarn
          </Link>
        </div>
      </main>
    );
  }

  return (
    <main className="auth-shell">
      <div className="auth-card">
        <h1>You&rsquo;re in</h1>
        <p>Taking you to the workspace…</p>
      </div>
    </main>
  );
}
