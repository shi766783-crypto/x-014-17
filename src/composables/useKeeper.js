import { computed, reactive } from 'vue'
import { createStorage } from '../services/storage'
import { buildInitialPayment, normalizePolicy, renewPolicy } from '../services/policyBilling'
import { config, seed } from '../data'

const storage = createStorage(config.storageKey, seed)
export function useKeeper() {
  const state = reactive(storage.read())
  const persist = () => storage.write(state)
  const add = (collection, item) => {
    const id = `${collection}-${Date.now()}`
    const entry = { id, createdAt: new Date().toISOString(), ...item }

    if (collection === 'policies') {
      const policy = normalizePolicy(entry)
      if (!policy.paymentHistory.length) policy.paymentHistory.push(buildInitialPayment(policy))
      state.policies.unshift(policy)
    } else {
      state[collection].unshift(entry)
    }

    persist()
  }
  const update = (collection, id, patch) => {
    const item = state[collection].find((entry) => entry.id === id)
    if (!item) return

    if (collection === 'policies') Object.assign(item, normalizePolicy({ ...item, ...patch }))
    else Object.assign(item, patch)

    persist()
  }
  const payRenewal = (id, paidDate) => {
    const policy = state.policies.find((entry) => entry.id === id)
    if (!policy) return null

    const record = renewPolicy(policy, paidDate)
    if (record) persist()
    return record
  }
  const remove = (collection, id) => { state[collection] = state[collection].filter((entry) => entry.id !== id); persist() }
  const reset = () => { Object.assign(state, normalizeState(structuredClone(seed))); persist() }
  const metrics = computed(() => config.metrics.map((metric) => ({ ...metric, value: metric.value ? metric.value(state) : state[metric.collection]?.length || 0 })))
  return { state, add, update, remove, payRenewal, reset, persist, metrics }
}
