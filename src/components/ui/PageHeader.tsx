export function PageHeader({
  title,
  description,
  actions,
}: {
  title: string;
  description?: string;
  actions?: React.ReactNode;
}) {
  return (
    <div className="flex flex-wrap items-start justify-between gap-4 border-b border-base-300 pb-5">
      <div className="min-w-0">
        <h1 className="text-[22px] font-semibold leading-tight tracking-tight">
          {title}
        </h1>
        {description ? (
          <p className="mt-1.5 max-w-2xl text-[13px] leading-relaxed text-base-content/55">
            {description}
          </p>
        ) : null}
      </div>
      {actions ? <div className="flex shrink-0 items-center gap-2">{actions}</div> : null}
    </div>
  );
}

/** Baslik altindaki sessiz ozet seridi: kutu yok, yalnizca ayrac. */
export function MetaStrip({
  items,
}: {
  items: { label: string; value: string | number }[];
}) {
  return (
    <dl className="flex flex-wrap items-center gap-x-5 gap-y-1 text-[13px]">
      {items.map((item, index) => (
        <div key={item.label} className="flex items-center gap-2">
          {index > 0 ? (
            <span className="text-base-content/20" aria-hidden="true">
              ·
            </span>
          ) : null}
          <dt className="sr-only">{item.label}</dt>
          <dd className="flex items-baseline gap-1.5">
            <span className="tabular font-medium">{item.value}</span>
            <span className="text-base-content/50">{item.label}</span>
          </dd>
        </div>
      ))}
    </dl>
  );
}
