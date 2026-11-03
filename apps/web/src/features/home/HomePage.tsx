export function HomePage() {
  return (
    <section aria-labelledby="home-title" className="mx-auto max-w-3xl space-y-4 py-16">
      <h1 id="home-title" className="text-4xl font-bold tracking-tight">
        Race strategy, lap by lap.
      </h1>
      <p className="text-lg text-text-muted">
        StintLine models tyre degradation, pit loss and undercut windows from real timing data, and
        predicts where a driver rejoins after a stop.
      </p>
      <p className="text-text-muted">Session picker and strategy views are under construction.</p>
    </section>
  );
}
