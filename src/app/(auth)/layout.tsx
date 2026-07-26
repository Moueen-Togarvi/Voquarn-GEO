import Link from "next/link";

/**
 * Auth route group layout — a centered, focused shell for sign-in / sign-up.
 */
export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-svh flex-col items-center justify-center gap-8 px-4 py-12">
      <Link
        href="/"
        className="flex items-center gap-2 text-lg font-semibold tracking-tight"
      >
        <span className="bg-primary text-primary-foreground grid size-8 place-items-center rounded-md text-sm font-bold">
          V
        </span>
        Voquarn
      </Link>
      {children}
      <p className="text-muted-foreground max-w-sm text-center text-xs">
        Track and improve how your brand shows up in AI answers across ChatGPT,
        Claude, Gemini, and Perplexity.
      </p>
    </div>
  );
}
