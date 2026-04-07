import { create } from 'zustand'

type ToastType = 'success' | 'error'

type Toast = {
  id: number
  message: string
  type: ToastType
}

type ToastStore = {
  toasts: Toast[]
  addToast: (message: string, type: ToastType) => void
  removeToast: (id: number) => void
}

let nextId = 1

export const useToastStore = create<ToastStore>((set) => ({
  toasts: [],
  addToast: (message, type) => {
    const id = nextId++
    set((s) => ({ toasts: [...s.toasts, { id, message, type }] }))
    setTimeout(() => {
      set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) }))
    }, 4000)
  },
  removeToast: (id) => set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) })),
}))
