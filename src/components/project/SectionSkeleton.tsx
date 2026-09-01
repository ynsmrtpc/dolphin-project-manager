/** GitHub'dan veri bekleyen sekmeler icin yer tutucu. */
export function SectionSkeleton({ rows = 5 }: { rows?: number }) {
  return (
    <div className="flex max-w-3xl flex-col gap-4" aria-busy="true" aria-live="polite">
      <div className="skeleton h-8 w-56" />
      <div className="overflow-hidden rounded-box border border-base-300">
        {Array.from({ length: rows }).map((_, index) => (
          <div
            key={index}
            className="flex gap-3 border-b border-base-300 px-4 py-3 last:border-b-0"
          >
            <div className="skeleton size-5 shrink-0 rounded-full" />
            <div className="flex w-full flex-col gap-2">
              <div className="skeleton h-3.5 w-2/5" />
              <div className="skeleton h-3 w-1/4" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
