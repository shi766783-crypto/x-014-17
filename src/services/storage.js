import { normalizeState } from './policyBilling'

export function createStorage(key, seed) {
  const read = () => {
    try {
      const current = JSON.parse(localStorage.getItem(key))
      if (current) return normalizeState(current)

      const legacy = JSON.parse(localStorage.getItem('family-document-keeper-v1'))
      if (legacy) return normalizeState(legacy)
    } catch {
      // 无法读取的旧缓存使用演示数据兜底
    }
    return normalizeState(structuredClone(seed))
  }
  const write = (value) => localStorage.setItem(key, JSON.stringify(normalizeState(value)))
  return { read, write }
}
