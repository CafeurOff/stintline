import { Link } from "react-router";

export function NotFoundPage() {
  return (
    <section aria-labelledby="not-found-title" className="mx-auto max-w-3xl space-y-4 py-16">
      <h1 id="not-found-title" className="text-3xl font-bold">
        Page not found
      </h1>
      <Link to="/" className="text-accent underline underline-offset-4">
        Back to home
      </Link>
    </section>
  );
}
