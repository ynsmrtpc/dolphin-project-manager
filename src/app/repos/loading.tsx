export default function ReposLoading() {
  return (
    <div className="flex flex-col gap-6" aria-busy="true" aria-live="polite">
      <div className="flex flex-col gap-2 border-b border-base-300 pb-5">
        <div className="skeleton h-6 w-40" />
        <div className="skeleton h-3.5 w-full max-w-lg" />
      </div>

      <div className="flex items-center justify-between gap-3">
        <div className="skeleton h-8 w-full max-w-xs" />
        <div className="skeleton h-8 w-64" />
      </div>

      <div className="overflow-hidden rounded-box border border-base-300 bg-base-100">
        {Array.from({ length: 9 }).map((_, index) => (
          <div key={index} className="flex items-start gap-3 border-b border-base-300 px-4 py-3 last:border-b-0">
            <div className="skeleton size-4 shrink-0 rounded" />
            <div className="flex w-full flex-col gap-2">
              <div className="skeleton h-3.5 w-1/3" />
              <div className="skeleton h-3 w-2/3" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
