export const today = new Date().toISOString().slice(0, 10)

export const BILLING_CYCLES = [
  { value: 'monthly', label: '月缴', months: 1 },
  { value: 'quarterly', label: '季缴', months: 3 },
  { value: 'semiannual', label: '半年缴', months: 6 },
  { value: 'annual', label: '年缴', months: 12 },
]

const pad = (value) => String(value).padStart(2, '0')
const createId = () => `pay-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`

export function toISODate(date) {
  return `${date.getUTCFullYear()}-${pad(date.getUTCMonth() + 1)}-${pad(date.getUTCDate())}`
}

export function parseISODate(value) {
  const [year, month, day] = String(value || '').split('-').map(Number)
  return new Date(Date.UTC(year, (month || 1) - 1, day || 1))
}

export function addDaysISO(dateText, amount) {
  const date = parseISODate(dateText)
  date.setUTCDate(date.getUTCDate() + amount)
  return toISODate(date)
}

export function addMonthsISO(dateText, amount) {
  const date = parseISODate(dateText)
  const day = date.getUTCDate()
  date.setUTCDate(1)
  date.setUTCMonth(date.getUTCMonth() + amount)
  const nextMonth = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + 1, 0))
  date.setUTCDate(Math.min(day, nextMonth.getUTCDate()))
  return toISODate(date)
}

export function diffDays(dateText, reference = today) {
  return Math.round((parseISODate(dateText) - parseISODate(reference)) / 86400000)
}

export function cycleMonths(cycle) {
  return BILLING_CYCLES.find((item) => item.value === cycle)?.months || 12
}

export function cycleLabel(cycle) {
  return BILLING_CYCLES.find((item) => item.value === cycle)?.label || '年缴'
}

function normalizeCycle(value) {
  if (BILLING_CYCLES.some((item) => item.value === value)) return value
  return { 月缴: 'monthly', 季缴: 'quarterly', 半年缴: 'semiannual', 年缴: 'annual' }[value] || 'annual'
}

export function normalizePayment(policyId, entry = {}) {
  return {
    id: entry.id || createId(),
    policyId: entry.policyId || policyId,
    dueDate: entry.dueDate || entry.due || today,
    paidDate: entry.paidDate || entry.paidAt || entry.date || today,
    periodStart: entry.periodStart || entry.startDate || entry.dueDate || today,
    periodEnd: entry.periodEnd || entry.endDate || today,
    premiumAmount: Number(entry.premiumAmount ?? entry.premium ?? entry.amount ?? 0),
    billingCycle: normalizeCycle(entry.billingCycle || entry.cycle || entry.payment),
  }
}

export function normalizePolicy(input = {}) {
  const startedAt = input.startedAt || input.startDate || input.issued || input.effectiveDate || today
  const expires = input.expires || addMonthsISO(startedAt, 12)
  const billingCycle = normalizeCycle(input.billingCycle || input.cycle || input.payment)
  const premium = Number(input.premium ?? input.amount ?? 0)

  return {
    ...input,
    startedAt,
    expires,
    billingCycle,
    premium: Number.isFinite(premium) ? premium : 0,
    nextPaymentDate: input.nextPaymentDate || input.nextDueDate || expires,
    paymentHistory: Array.isArray(input.paymentHistory)
      ? input.paymentHistory.map((entry) => normalizePayment(input.id, entry))
      : [],
  }
}

export function normalizeState(raw = {}) {
  return {
    ...raw,
    documents: Array.isArray(raw.documents) ? raw.documents : [],
    usages: Array.isArray(raw.usages) ? raw.usages : [],
    policies: Array.isArray(raw.policies) ? raw.policies.map(normalizePolicy) : [],
  }
}

export function buildInitialPayment(policy) {
  return normalizePayment(policy.id, {
    dueDate: policy.startedAt,
    paidDate: policy.startedAt,
    periodStart: policy.startedAt,
    periodEnd: addDaysISO(policy.nextPaymentDate, -1),
    premiumAmount: policy.premium,
    billingCycle: policy.billingCycle,
  })
}

export function getPolicyBilling(policy, asOf = today, reminderDays = 30) {
  const paymentDueIn = diffDays(policy.nextPaymentDate, asOf)
  const daysToExpiry = diffDays(policy.expires, asOf)

  let status = 'active'
  if (daysToExpiry < 0) status = 'expired'
  else if (paymentDueIn < 0) status = 'lapsed'
  else if (paymentDueIn <= reminderDays) status = 'due_soon'
  else if (daysToExpiry <= 90) status = 'expiring'

  const statusLabel = {
    active: '进行中',
    due_soon: '待续费',
    lapsed: '已失效',
    expired: '已到期',
    expiring: '即将到期',
  }[status]

  let reminder = '保障中'
  if (status === 'lapsed') reminder = `缴费逾期 ${Math.abs(paymentDueIn)} 天，保障已失效`
  else if (status === 'due_soon') reminder = `${paymentDueIn} 天后扣费`
  else if (status === 'expired') reminder = '保单已到期'
  else if (status === 'expiring') reminder = `保单 ${daysToExpiry} 天后到期`

  return {
    status,
    statusLabel,
    tone: status === 'active' ? 'good' : status === 'due_soon' || status === 'expiring' ? 'warn' : 'danger',
    paymentDueIn,
    daysToExpiry,
    reminder,
  }
}

export function renewPolicy(policy, paidDate = today) {
  if (getPolicyBilling(policy, paidDate).status === 'expired') return null

  const periodStart = policy.nextPaymentDate
  const nextPaymentDate = addMonthsISO(periodStart, cycleMonths(policy.billingCycle))
  const record = normalizePayment(policy.id, {
    dueDate: periodStart,
    paidDate,
    periodStart,
    periodEnd: addDaysISO(nextPaymentDate, -1),
    premiumAmount: policy.premium,
    billingCycle: policy.billingCycle,
  })

  policy.paymentHistory.push(record)
  policy.nextPaymentDate = nextPaymentDate
  return record
}
