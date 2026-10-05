export const today = new Date().toISOString().slice(0, 10)
const days = (date) => Math.ceil((new Date(`${date}T00:00:00`) - new Date(`${today}T00:00:00`)) / 86400000)
const fmt = (date) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
export const addMonths = (date, months) => { const d = new Date(`${date}T00:00:00`); const day = d.getDate(); d.setMonth(d.getMonth() + months); if (d.getDate() < day) d.setDate(0); return fmt(d) }
export const cycles = [
  { id: 'month', label: '月缴', months: 1 },
  { id: 'quarter', label: '季缴', months: 3 },
  { id: 'half', label: '半年缴', months: 6 },
  { id: 'year', label: '年缴', months: 12 },
]
export const cycleOf = (id) => cycles.find((c) => c.id === id) || cycles[3]
export const REMIND_DAYS = 30
export const policyStatus = (policy) => {
  const remain = days(policy.nextDue)
  if (remain < 0) return { id: 'lapsed', label: '已断缴', tone: 'danger', remain }
  if (remain <= REMIND_DAYS) return { id: 'due', label: '待缴费', tone: 'warn', remain }
  return { id: 'active', label: '保障中', tone: 'good', remain }
}
export const normalizePolicies = (list) => (list || []).map((p) => ({ history: [], ...p, cycle: p.cycle || (cycles.find((c) => c.label === p.payment) || cycles[3]).id, nextDue: p.nextDue || p.expires || today }))
export const config = {
  storageKey: 'family-document-keeper-v1',
  brand: '家档管家', subtitle: 'Family Archive', icon: 'FolderLock', entityLabel: '证件档案', secondaryLabel: '家庭保险', secondaryTitle: '保单与缴费管理', secondaryAction: '添加保单', historyLabel: '使用记录', heroTitle: '让重要文件，始终井然有序。', heroCopy: '证件、保单和家庭文件，都有清晰的去处与提醒。', createLabel: '新建档案',
  nav: [{ id: 'overview', label: '总览' }, { id: 'documents', label: '证件档案' }, { id: 'history', label: '使用记录' }, { id: 'insurance', label: '家庭保险' }, { id: 'achievements', label: '成就与榜单' }],
  metrics: [
    { label: '证件总数', collection: 'documents', tone: 'green' },
    { label: '90天内到期', tone: 'peach', value: (s) => s.documents.filter((x) => x.expires && days(x.expires) >= 0 && days(x.expires) <= 90).length },
    { label: '已过期', tone: 'red', value: (s) => s.documents.filter((x) => x.expires && days(x.expires) < 0).length },
    { label: '外借未还', tone: 'blue', value: (s) => s.usages.filter((x) => x.status === '借用中').length },
  ],
  form: { title: '新建证件档案', collection: 'documents', fields: [
    ['name', '证件名称', '身份证'], ['category', '类别', '身份类'], ['holder', '持有人', '林小满'], ['number', '证件号码', '110***********'], ['issued', '签发日期', '2023-01-01', 'date'], ['expires', '有效期至', '2033-01-01', 'date'], ['issuer', '发证机关', 'XX市公安局'], ['location', '存放位置', '保险柜'], ['copyLocation', '复印件位置', '云盘 / 家庭共享'], ['notes', '备注', ''],
  ]},
  categories: ['身份类', '资产类', '合同类', '医疗类', '教育类', '其他'],
  achievements: ['首次建档', '证件齐全', '零过期遗忘', '续办及时', '家庭档案大师', '收纳有序', '安全存档', '保险规划师', '使用有迹', '家庭守护者', '资料无忧', '档案领航员']
}
export const seed = {
  documents: [
    { id: 'doc-1', name: '林小满身份证', category: '身份类', holder: '林小满', number: '110***********', issued: '2023-01-18', expires: '2033-01-18', issuer: '杭州市公安局', location: '保险柜 · A-02', copyLocation: '家庭云盘 / 身份证', notes: '正反面已扫描' },
    { id: 'doc-2', name: '家庭医疗保险合同', category: '医疗类', holder: '林家', number: 'POL-2026-019', issued: '2026-01-01', expires: '2026-11-20', issuer: '安和保险', location: '书房文件盒', copyLocation: '云盘 / 保单', notes: '续保前确认受益人' },
    { id: 'doc-3', name: '周末房产合同', category: '资产类', holder: '林小满', number: 'PROP-0081', issued: '2024-06-12', expires: '2026-08-10', issuer: '杭城置业', location: '主卧抽屉', copyLocation: '云盘 / 房产', notes: '已过期的合同提醒仅供归档' },
  ],
  usages: [{ id: 'use-1', documentId: 'doc-1', date: '2026-09-16', purpose: '办理银行业务', borrower: '林小满', status: '借用中', note: '周五归还' }, { id: 'use-2', documentId: 'doc-2', date: '2026-08-11', purpose: '理赔资料', borrower: '林小满', status: '已归还', note: '' }],
  policies: [
    { id: 'pol-1', company: '安和保险', type: '家庭医疗险', number: 'AH-33001', insured: '林家', premium: 2890, cycle: 'year', nextDue: '2026-11-01', expires: '2026-11-20',
      history: [{ id: 'pay-1', paidAt: '2025-11-02', amount: 2890, cycleId: 'year', cycleLabel: '年缴', periodStart: '2025-11-01', periodEnd: '2026-11-01' }] },
    { id: 'pol-2', company: '泰平人寿', type: '重疾险（林小满）', number: 'TP-88210', insured: '林小满', premium: 4200, cycle: 'half', nextDue: '2026-09-10', expires: '2046-03-10',
      history: [
        { id: 'pay-2', paidAt: '2026-03-08', amount: 4200, cycleId: 'half', cycleLabel: '半年缴', periodStart: '2026-03-10', periodEnd: '2026-09-10' },
        { id: 'pay-3', paidAt: '2025-09-12', amount: 3960, cycleId: 'half', cycleLabel: '半年缴', periodStart: '2025-09-10', periodEnd: '2026-03-10' },
      ] },
    { id: 'pol-3', company: '云保科技', type: '百万医疗险（周予安）', number: 'YB-10492', insured: '周予安', premium: 156, cycle: 'month', nextDue: '2026-10-12', expires: '2027-04-12',
      history: [{ id: 'pay-4', paidAt: '2026-09-12', amount: 156, cycleId: 'month', cycleLabel: '月缴', periodStart: '2026-09-12', periodEnd: '2026-10-12' }] },
  ],
}
export { days }
