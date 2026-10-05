import { computed, reactive } from 'vue'
import { createStorage } from '../services/storage'
import { config, seed, addMonths, cycleOf, normalizePolicies, today } from '../data'

const storage = createStorage(config.storageKey, seed)
export function useKeeper() {
  const state = reactive(storage.read())
  state.policies = normalizePolicies(state.policies)
  const persist = () => storage.write(state)
  persist()
  const add = (collection, item) => { state[collection].unshift({ id: `${collection}-${Date.now()}`, createdAt: new Date().toISOString(), ...item }); persist() }
  const update = (collection, id, patch) => { const item = state[collection].find((entry) => entry.id === id); if (item) Object.assign(item, patch); persist() }
  const remove = (collection, id) => { state[collection] = state[collection].filter((entry) => entry.id !== id); persist() }
  const reset = () => { Object.assign(state, structuredClone(seed)); persist() }
  const renewPolicy = (id, paidAt = today) => {
    const policy = state.policies.find((x) => x.id === id)
    if (!policy) return
    const cycle = cycleOf(policy.cycle)
    const record = { id: `pay-${Date.now()}`, paidAt, amount: policy.premium, cycleId: cycle.id, cycleLabel: cycle.label, periodStart: policy.nextDue, periodEnd: addMonths(policy.nextDue, cycle.months) }
    policy.history = [record, ...(policy.history || [])]
    policy.nextDue = record.periodEnd
    if (!policy.expires || policy.expires < record.periodEnd) policy.expires = record.periodEnd
    persist()
  }
  const metrics = computed(() => config.metrics.map((metric) => ({ ...metric, value: metric.value ? metric.value(state) : state[metric.collection]?.length || 0 })))
  return { state, add, update, remove, reset, persist, metrics, renewPolicy }
}
