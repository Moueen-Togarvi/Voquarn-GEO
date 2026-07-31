import Link from "next/link";

export default function NotFound() {
  return (
    <main className="center-page">
      <div className="empty-icon">404</div>
      <h1>Project not found</h1>
      <p className="muted-text">
        It may have been deleted or the link is no longer valid.
      </p>
      <Link className="button button-primary" href="/">
        Back to workspace
      </Link>
    </main>
  );
}
