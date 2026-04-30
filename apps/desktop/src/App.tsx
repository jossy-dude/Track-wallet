export default function App() {
  return (
    <main className="min-h-screen bg-background px-6 py-10 text-on-background">
      <section className="mx-auto flex max-w-3xl flex-col gap-4 rounded-[24px] bg-surface-container-low p-8 shadow-[0_4px_20px_rgba(46,50,48,0.06)]">
        <p className="text-sm font-medium text-on-surface-variant">
          Dormant Tauri shell
        </p>
        <h1 className="font-headline text-4xl font-semibold text-on-surface">
          Desktop is scaffolded but intentionally inactive.
        </h1>
        <p className="max-w-2xl text-sm leading-6 text-on-surface-variant">
          This workspace reserves the desktop surface for later sync and review
          flows. The first active product slice remains mobile-only.
        </p>
      </section>
    </main>
  );
}

