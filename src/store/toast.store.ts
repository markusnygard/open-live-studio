import { create } from 'zustand'
import { immer } from 'zustand/middleware/immer'

interface Toast {
  id: number
  message: string
  variant: 'error' | 'info'
}

interface ToastStore {
  toasts: Toast[]
  addToast: (message: string, variant?: Toast['variant']) => void
  removeToast: (id: number) => void
}

let nextId = 1

export const useToastStore = create<ToastStore>()(
  immer((set) => ({
    toasts: [],
    addToast: (message, variant = 'error') => {
      const id = nextId++
      set((s) => { s.toasts.push({ id, message, variant }) })
      setTimeout(() => {
        set((s) => { s.toasts = s.toasts.filter((t) => t.id !== id) })
      }, 6000)
    },
    removeToast: (id) => {
      set((s) => { s.toasts = s.toasts.filter((t) => t.id !== id) })
    },
  }))
)
