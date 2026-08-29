import { afterEach, vi } from 'vitest'
import { cleanup } from '@testing-library/react'

const store = new Map()
const memoryStorage = {
  getItem: (k) => (store.has(String(k)) ? store.get(String(k)) : null),
  setItem: (k, v) => { store.set(String(k), String(v)) },
  removeItem: (k) => { store.delete(String(k)) },
  clear: () => { store.clear() },
  key: (i) => [...store.keys()][i] ?? null,
  get length() { return store.size },
}

Object.defineProperty(globalThis, 'localStorage', {
  value: memoryStorage,
  writable: true,
  configurable: true,
})
if (typeof window !== 'undefined') {
  Object.defineProperty(window, 'localStorage', {
    value: memoryStorage,
    writable: true,
    configurable: true,
  })
  try {
    vi.spyOn(window.location, 'reload').mockImplementation(() => {})
  } catch {
    // jsdom Location.reload is not always spy-able
  }
}

afterEach(() => {
  cleanup()
  memoryStorage.clear()
})
