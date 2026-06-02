import { useToastStore } from '@/store/toast.store'

export function ToastContainer() {
  const { toasts, removeToast } = useToastStore()

  if (toasts.length === 0) return null

  return (
    <div className="fixed bottom-4 right-4 z-[9999] flex flex-col gap-2 pointer-events-none">
      {toasts.map((t) => (
        <div
          key={t.id}
          className="pointer-events-auto flex items-start gap-2 px-3 py-2 rounded border shadow-xl text-xs font-mono max-w-sm bg-zinc-900 border-red-700 text-red-300"
        >
          <span className="flex-1 break-words leading-relaxed">{t.message}</span>
          <button
            onClick={() => removeToast(t.id)}
            className="shrink-0 text-zinc-500 hover:text-zinc-200 transition-colors cursor-pointer leading-none mt-px"
            aria-label="Dismiss"
          >
            ✕
          </button>
        </div>
      ))}
    </div>
  )
}
