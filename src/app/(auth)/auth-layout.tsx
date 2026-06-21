import Link from "next/link";

export function AuthShell({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle: string;
  children: React.ReactNode;
}) {
  return (
    <main className="min-h-screen flex items-center justify-center p-6">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <Link href="/" className="inline-flex items-baseline gap-2">
            <span className="seal px-3 py-1 text-xl">读</span>
            <span className="text-4xl font-bold tracking-wide text-ink">
              读伴
            </span>
          </Link>
          <p className="mt-3 text-ink-light text-sm tracking-widest">
            {subtitle}
          </p>
        </div>
        <div className="ink-card p-8">
          <h1 className="text-xl font-semibold mb-6 text-ink text-center">
            {title}
          </h1>
          {children}
        </div>
      </div>
    </main>
  );
}
