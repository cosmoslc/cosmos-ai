export default function PageHeader({ title, hint, children }: { title: string; hint?: string; children?: React.ReactNode }) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
      <div>
        <h1 className="text-3xl font-bold">{title}</h1>
        {hint && <p className="mt-1.5 max-w-xl text-sm leading-relaxed text-ink-soft">{hint}</p>}
      </div>
      {children}
    </div>
  );
}
