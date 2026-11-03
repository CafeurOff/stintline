import { EventGrid } from "@/features/session-picker/components/EventGrid";

export function HomePage() {
  return (
    <div className="space-y-10 py-8">
      <section
        aria-labelledby="home-title"
        className="relative overflow-hidden rounded-3xl border border-border bg-gradient-to-br from-panel via-surface to-panel p-6 shadow-card sm:p-10"
      >
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -top-24 -right-24 size-72 rounded-full bg-accent/20 blur-3xl"
        />
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-x-0 bottom-0 h-1 bg-gradient-to-r from-accent via-accent/40 to-transparent"
        />
        <p className="text-xs font-semibold tracking-widest text-accent-text uppercase">
          Race strategy decision support
        </p>
        <h1
          id="home-title"
          className="mt-2 max-w-2xl text-4xl font-bold tracking-tight sm:text-5xl"
        >
          Race strategy, lap by lap.
        </h1>
        <p className="mt-4 max-w-2xl text-lg text-text-muted">
          StintLine models tyre degradation, pit loss and undercut windows from real timing data,
          and predicts where a driver rejoins after a stop. Pick a race to start.
        </p>
      </section>
      <EventGrid />
    </div>
  );
}
