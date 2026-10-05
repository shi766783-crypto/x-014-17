<script setup>
import { computed, ref } from 'vue'
import { Archive, Award, Bell, BookOpen, CalendarClock, ChevronRight, CircleAlert, CreditCard, FilePlus2, FolderLock, LayoutDashboard, Menu, Pencil, Plus, RotateCcw, Search, ShieldCheck, TrendingUp, UserRound, X } from 'lucide-vue-next'
import { config, days, today } from './data'
import { BILLING_CYCLES, addDaysISO, addMonthsISO, cycleLabel, getPolicyBilling } from './services/policyBilling'
import { useKeeper } from './composables/useKeeper'

const { state, add, update, payRenewal, metrics, reset } = useKeeper()
const active = ref('overview')
const query = ref('')
const showForm = ref(false)
const showPolicyForm = ref(false)
const editingPolicyId = ref(null)
const mobileOpen = ref(false)
const draft = ref({})
const policyDraft = ref({})

const activeNav = computed(() => config.nav.find((x) => x.id === active.value))
const docs = computed(() => state.documents.filter((x) => `${x.name}${x.holder}${x.category}`.toLowerCase().includes(query.value.toLowerCase())))
const documentAlerts = computed(() => state.documents
  .map((x) => ({ ...x, remaining: days(x.expires) }))
  .filter((x) => x.remaining <= 90)
  .sort((a, b) => a.remaining - b.remaining))

const policyCards = computed(() => state.policies.map((item) => {
  const billing = getPolicyBilling(item, today, config.reminderDays)
  const lastPayment = item.paymentHistory.reduce((latest, entry) => {
    if (!latest || entry.paidDate > latest.paidDate) return entry
    return latest
  }, null)
  return { item, billing, lastPayment }
}))

const overviewAlerts = computed(() => {
  const documentEntries = documentAlerts.value.map((item) => ({
    kind: 'document',
    item,
    remaining: item.remaining,
    tone: item.remaining < 0 ? 'danger' : 'warn',
    title: item.name,
    subtitle: `${item.holder} · ${item.location}`,
    note: item.remaining < 0 ? `已过期 ${Math.abs(item.remaining)} 天` : `${item.remaining} 天后到期`,
  }))

  const policyEntries = policyCards.value
    .filter(({ billing }) => billing.status !== 'active')
    .map(({ item, billing }) => ({
      kind: 'policy',
      item,
      billing,
      remaining: billing.status === 'expired' || billing.status === 'expiring' ? billing.daysToExpiry : billing.paymentDueIn,
      tone: billing.tone === 'good' ? 'warn' : billing.tone,
      title: item.type,
      subtitle: `${item.company} · ${item.insured}`,
      note: billing.reminder,
    }))

  return [...documentEntries, ...policyEntries].sort((a, b) => a.remaining - b.remaining)
})

const attentionCount = computed(() => overviewAlerts.value.length)
const borrowed = computed(() => state.usages.filter((x) => x.status === '借用中'))
const completion = computed(() => Math.min(100, Math.round((state.documents.filter((x) => x.location && x.copyLocation).length / Math.max(state.documents.length, 1)) * 100)))
const paymentHistoryEntries = computed(() => state.policies
  .flatMap((policy) => policy.paymentHistory.map((entry) => ({ entry, policy })))
  .sort((a, b) => b.entry.paidDate.localeCompare(a.entry.paidDate)))

const weekdayNames = ['星期日', '星期一', '星期二', '星期三', '星期四', '星期五', '星期六']
const heroDate = computed(() => {
  const [year, month, day] = today.split('-').map(Number)
  const weekday = weekdayNames[new Date(`${today}T00:00:00`).getDay()]
  return `${weekday} · ${year}年${month}月${day}日`
})

function navTo(id) { active.value = id; mobileOpen.value = false }
function openCreate() {
  draft.value = Object.fromEntries(config.form.fields.map(([key, , value]) => [key, value || '']))
  showForm.value = true
}
function save() { add(config.form.collection, { ...draft.value }); showForm.value = false }
function readFile(event) {
  const file = event.target.files?.[0]
  if (!file) return
  const reader = new FileReader()
  reader.onload = () => { draft.value.photo = reader.result }
  reader.readAsDataURL(file)
}
function markRenewed(doc) { update('documents', doc.id, { expires: `${new Date().getFullYear() + 10}-12-31`, renewed: true }) }

function openPolicyCreate() {
  const firstDueDate = addMonthsISO(today, 12)
  editingPolicyId.value = null
  policyDraft.value = {
    company: '', type: '', number: '', insured: '林家', startedAt: today,
    billingCycle: 'annual', premium: '', nextPaymentDate: firstDueDate,
    expires: addDaysISO(firstDueDate, -1),
  }
  showPolicyForm.value = true
}
function openPolicyEdit(policy) {
  editingPolicyId.value = policy.id
  policyDraft.value = {
    company: policy.company, type: policy.type, number: policy.number, insured: policy.insured,
    startedAt: policy.startedAt, billingCycle: policy.billingCycle, premium: policy.premium,
    nextPaymentDate: policy.nextPaymentDate, expires: policy.expires,
  }
  showPolicyForm.value = true
}
function savePolicy() {
  const payload = { ...policyDraft.value, premium: Number(policyDraft.value.premium) || 0 }
  if (editingPolicyId.value) update('policies', editingPolicyId.value, payload)
  else add('policies', payload)
  showPolicyForm.value = false
}
function renewPolicyItem(policy) { payRenewal(policy.id, today) }
function handleAlertAction(alert) {
  if (alert.kind === 'document') markRenewed(alert.item)
  else if (alert.billing.status === 'due_soon' || alert.billing.status === 'lapsed') renewPolicyItem(alert.item)
  else navTo('insurance')
}
function alertAction(alert) {
  if (alert.kind === 'document') return { label: '已续办', disabled: false }
  if (alert.billing.status === 'due_soon') return { label: '立即续费', disabled: false }
  if (alert.billing.status === 'lapsed') return { label: '恢复缴费', disabled: false }
  if (alert.billing.status === 'expiring') return { label: '查看保单', disabled: false }
  return { label: '已到期', disabled: true }
}
function money(value) { return `¥${Number(value || 0).toLocaleString()}` }
</script>

<template>
  <div class="app-shell">
    <aside class="sidebar" :class="{ open: mobileOpen }">
      <div class="brand"><span class="brand-mark"><FolderLock :size="19" /></span><div><strong>{{ config.brand }}</strong><small>{{ config.subtitle }}</small></div><button class="icon-btn close" @click="mobileOpen = false"><X :size="17" /></button></div>
      <div class="family-chip"><span>林</span><div><b>林家家庭空间</b><small>4 位成员 · 私密存储</small></div><ChevronRight :size="15" /></div>
      <nav>
        <button v-for="item in config.nav" :key="item.id" :class="{ active: active === item.id }" @click="navTo(item.id)">
          <component :is="item.id === 'overview' ? LayoutDashboard : item.id === 'documents' ? Archive : item.id === 'history' ? CalendarClock : item.id === 'insurance' ? ShieldCheck : Award" :size="17" />
          <span>{{ item.label }}</span>
          <i v-if="item.id === 'documents' && documentAlerts.length">{{ documentAlerts.length }}</i>
        </button>
      </nav>
      <div class="sidebar-foot"><button><BookOpen :size="17" />使用指南</button><button><UserRound :size="17" />个人中心</button><button class="reset" @click="reset"><RotateCcw :size="15" />恢复演示数据</button></div>
    </aside>

    <main class="main">
      <header class="topbar">
        <button class="icon-btn menu" @click="mobileOpen = true"><Menu :size="20" /></button>
        <div><span class="eyebrow">家庭文件空间</span><h1>{{ activeNav.label }}</h1></div>
        <div class="top-actions"><button class="icon-btn"><Bell :size="18" /><em v-if="attentionCount"></em></button><span class="avatar">林</span><b>Lin</b></div>
      </header>

      <div class="page">
        <section class="intro">
          <div><span class="eyebrow">{{ active === 'overview' ? heroDate : '数据随时保存在当前设备' }}</span><h2>{{ active === 'overview' ? config.heroTitle : activeNav.label }}</h2><p>{{ active === 'overview' ? config.heroCopy : '集中查看、编辑和追踪家庭资料。' }}</p></div>
          <button class="primary" @click="active === 'insurance' ? openPolicyCreate() : openCreate()"><Plus :size="16" />{{ active === 'insurance' ? '添加保单' : (config.createLabel || '新建档案') }}</button>
        </section>

        <section v-if="active === 'overview'" class="metric-grid">
          <article v-for="metric in metrics" :key="metric.label" class="metric">
            <span class="metric-icon" :class="metric.tone"><Archive v-if="metric.tone === 'green'" :size="17" /><CalendarClock v-else-if="metric.tone === 'peach'" :size="17" /><CircleAlert v-else-if="metric.tone === 'red'" :size="17" /><ShieldCheck v-else :size="17" /></span>
            <div><small>{{ metric.label }}</small><strong>{{ metric.value }}</strong><em>{{ metric.tone === 'red' && metric.value ? '需要尽快处理' : metric.tone === 'peach' && metric.value ? '请提前安排续办' : '当前状态稳定' }}</em></div>
          </article>
        </section>

        <section v-if="active === 'overview'" class="content-grid">
          <article class="panel">
            <div class="panel-head"><div><span class="eyebrow">到期与续费预警</span><h3>需要你留意的事项</h3></div><button class="text-btn" @click="navTo('insurance')">查看保单 <ChevronRight :size="14" /></button></div>
            <div class="alert-list">
              <div v-for="(item, index) in overviewAlerts.slice(0, 5)" :key="`${item.kind}-${item.item.id}-${index}`" class="alert-row">
                <span class="alert-icon" :class="item.tone === 'danger' ? 'danger' : 'warn'"><CircleAlert :size="16" /></span>
                <div><b>{{ item.title }}</b><small>{{ item.kind === 'policy' ? '保单续费' : '证件续办' }} · {{ item.subtitle }}</small></div>
                <span class="date-pill" :class="item.tone === 'danger' ? 'danger' : 'warn'">{{ item.note }}</span>
                <button class="tiny-btn" :disabled="alertAction(item).disabled" @click="handleAlertAction(item)">{{ alertAction(item).label }}</button>
              </div>
              <div v-if="!overviewAlerts.length" class="empty">目前没有临期文件或待续保单，保持得很好。</div>
            </div>
          </article>

          <article class="panel score">
            <div class="panel-head"><div><span class="eyebrow">档案完整度</span><h3>家庭资料健康度</h3></div><TrendingUp :size="18" class="accent" /></div>
            <div class="score-ring"><strong>{{ completion }}<small>%</small></strong></div>
            <p>每一份文件都有存放位置和备份位置，家人需要时可以快速找到。</p>
            <div class="progress"><span :style="{ width: `${completion}%` }"></span></div>
            <small class="muted">已完善 {{ state.documents.filter(x => x.location && x.copyLocation).length }} / {{ state.documents.length }} 份</small>
          </article>
        </section>

        <section v-else-if="active === 'documents'" class="panel">
          <div class="toolbar"><div class="search"><Search :size="16" /><input v-model="query" :placeholder="`搜索${config.entityLabel}`" /></div><select><option>全部类别</option><option v-for="item in config.categories" :key="item">{{ item }}</option></select></div>
          <div class="table-head"><span>{{ config.entityLabel }}</span><span>类别 / 关联人</span><span>{{ config.dateLabel || '有效期' }}</span><span>{{ config.locationLabel || '存放位置' }}</span><span></span></div>
          <div v-for="item in docs" :key="item.id" class="table-row"><div class="item-title"><span class="file-icon"><Archive :size="16" /></span><div><b>{{ item.name }}</b><small>{{ item.number || '未填写编号' }}</small></div></div><span><b>{{ item.category }}</b><small>{{ item.holder }}</small></span><span><b :class="{ dangerText: days(item.expires) < 0, warnText: days(item.expires) >= 0 && days(item.expires) <= 90 }">{{ item.expires }}</b><small>{{ days(item.expires) < 0 ? '已过期' : `${config.remainingPrefix || '剩余'} ${days(item.expires)} 天` }}</small></span><span><b>{{ item.location || '未填写' }}</b><small>{{ config.copyLabel || '备份位置' }}：{{ item.copyLocation || '未填写' }}</small></span><button class="icon-btn"><ChevronRight :size="16" /></button></div>
          <div v-if="!docs.length" class="empty">没有匹配的档案。</div>
        </section>

        <section v-else-if="active === 'history'" class="panel">
          <div class="panel-head"><div><span class="eyebrow">{{ config.historyLabel }}</span><h3>{{ config.historyTitle || `${config.entityLabel}历史` }}</h3></div><span class="count-note">{{ borrowed.length }} 条待处理</span></div>
          <div class="history-grid"><div v-for="entry in state.usages" :key="entry.id" class="history-card"><div class="history-date">{{ entry.date }}<span :class="entry.status === '借用中' ? 'warnText' : 'goodText'">{{ entry.status }}</span></div><b>{{ state.documents.find(x => x.id === entry.documentId)?.name || config.entityLabel }}</b><p>{{ entry.purpose }} · 经办人 {{ entry.borrower }}</p><small>{{ entry.note || '无备注' }}</small></div></div>
        </section>

        <section v-else-if="active === 'insurance'" class="insurance-page">
          <article class="panel">
            <div class="panel-head"><div><span class="eyebrow">{{ config.secondaryLabel }}</span><h3>缴费周期与续费提醒</h3></div><button class="text-btn" @click="openPolicyCreate">{{ config.secondaryAction || '添加保单' }} <Plus :size="14" /></button></div>
            <div class="policy-grid">
              <div v-for="card in policyCards" :key="card.item.id" class="policy-card" :class="card.billing.tone">
                <div class="policy-main">
                  <div class="policy-logo"><ShieldCheck :size="20" /></div>
                  <div class="policy-title"><b>{{ card.item.type }}</b><small>{{ card.item.company }} · {{ card.item.number }}</small></div>
                  <span class="status-pill" :class="card.billing.tone">{{ card.billing.statusLabel }}</span>
                </div>

                <div class="policy-premium"><strong>{{ money(card.item.premium) }}</strong><span>{{ cycleLabel(card.item.billingCycle) }}</span></div>

                <div class="policy-dates">
                  <div><small>下次缴费日</small><b :class="card.billing.tone === 'danger' ? 'dangerText' : card.billing.tone === 'warn' ? 'warnText' : ''">{{ card.item.nextPaymentDate }}</b><em>{{ card.billing.reminder }}</em></div>
                  <div><small>保障到期日</small><b>{{ card.item.expires }}</b><em>{{ card.billing.daysToExpiry < 0 ? `已到期 ${Math.abs(card.billing.daysToExpiry)} 天` : `剩余 ${card.billing.daysToExpiry} 天` }}</em></div>
                </div>

                <div v-if="card.lastPayment" class="last-payment"><CreditCard :size="14" /><span>上次缴费：{{ card.lastPayment.paidDate }} · {{ money(card.lastPayment.premiumAmount) }} / {{ cycleLabel(card.lastPayment.billingCycle) }}</span></div>
                <p>{{ card.item.insured || '已加入家庭计划' }}</p>
                <div class="policy-actions">
                  <button class="tiny-btn renewal" :disabled="card.billing.status === 'expired'" @click="renewPolicyItem(card.item)">{{ card.billing.status === 'lapsed' ? '恢复缴费' : '立即续费' }}</button>
                  <button class="tiny-btn ghost" @click="openPolicyEdit(card.item)"><Pencil :size="11" />修改保单</button>
                </div>
              </div>
            </div>
          </article>

          <article class="panel payment-panel">
            <div class="panel-head"><div><span class="eyebrow">缴费历史</span><h3>每一周期保留独立快照</h3></div><span class="count-note">{{ paymentHistoryEntries.length }} 条缴费记录</span></div>
            <div class="payment-list">
              <div v-for="row in paymentHistoryEntries" :key="row.entry.id" class="payment-row">
                <div><b>{{ row.policy.type }}</b><small>{{ row.policy.company }} · {{ row.policy.number }}</small></div>
                <span><small>缴费日期</small><b>{{ row.entry.paidDate }}</b></span>
                <span><small>保障周期</small><b>{{ row.entry.periodStart }} 至 {{ row.entry.periodEnd }}</b></span>
                <span><small>实缴金额</small><b>{{ money(row.entry.premiumAmount) }} / {{ cycleLabel(row.entry.billingCycle) }}</b></span>
                <span class="snapshot-note" :class="{ changed: Number(row.entry.premiumAmount) !== Number(row.policy.premium) || row.entry.billingCycle !== row.policy.billingCycle }">
                  {{ Number(row.entry.premiumAmount) !== Number(row.policy.premium) || row.entry.billingCycle !== row.policy.billingCycle ? '当前保费或周期已调整，历史不回改' : '按缴费时方案入账' }}
                </span>
              </div>
              <div v-if="!paymentHistoryEntries.length" class="empty">暂无缴费记录。</div>
            </div>
          </article>
        </section>

        <section v-else class="content-grid"><article class="panel"><div class="panel-head"><div><span class="eyebrow">成长记录</span><h3>成就徽章</h3></div><Award :size="18" class="accent" /></div><div class="badge-grid"><div v-for="(item, index) in config.achievements" :key="item" class="badge" :class="{ unlocked: index < Math.min(5, state.documents.length + 2) }"><span><Award :size="18" /></span><b>{{ item }}</b><small>{{ index < 5 ? '已解锁' : '待解锁' }}</small></div></div></article><article class="panel"><div class="panel-head"><div><span class="eyebrow">家庭榜单</span><h3>档案管理达人</h3></div></div><div class="rank"><b>01</b><span class="rank-avatar">林</span><div><b>林小满</b><small>建档 {{ state.documents.length }} 份 · 处理率 92%</small></div><strong>98</strong></div><div class="rank"><b>02</b><span class="rank-avatar alt">周</span><div><b>周予安</b><small>建档 8 份 · 处理率 88%</small></div><strong>86</strong></div></article></section>
      </div>
    </main>

    <div v-if="showForm" class="modal-backdrop" @click.self="showForm = false">
      <form class="modal" @submit.prevent="save">
        <div class="modal-head"><div><span class="eyebrow">建立家庭档案</span><h3>{{ config.form.title }}</h3></div><button type="button" class="icon-btn" @click="showForm = false"><X :size="17" /></button></div>
        <div class="form-grid"><label v-for="[key, label, placeholder, type] in config.form.fields" :key="key" :class="{ wide: key === 'notes' }">{{ label }}<input v-model="draft[key]" :type="type || 'text'" :placeholder="placeholder" /></label><label class="wide upload-field">照片或扫描件（可选）<input type="file" accept="image/*" @change="readFile" /><small>{{ draft.photo ? '已读取图片，可随档案保存' : '支持 JPG、PNG，内容仅保存在本机' }}</small></label></div>
        <div class="modal-actions"><button type="button" class="secondary" @click="showForm = false">取消</button><button class="primary" type="submit"><FilePlus2 :size="16" />保存档案</button></div>
      </form>
    </div>

    <div v-if="showPolicyForm" class="modal-backdrop" @click.self="showPolicyForm = false">
      <form class="modal" @submit.prevent="savePolicy">
        <div class="modal-head"><div><span class="eyebrow">家庭保险</span><h3>{{ editingPolicyId ? '修改保单' : '添加保单' }}</h3></div><button type="button" class="icon-btn" @click="showPolicyForm = false"><X :size="17" /></button></div>
        <div class="form-grid">
          <label>保险公司<input v-model="policyDraft.company" placeholder="如：安和保险" required /></label>
          <label>险种名称<input v-model="policyDraft.type" placeholder="如：家庭医疗险" required /></label>
          <label>保单号<input v-model="policyDraft.number" placeholder="AH-33001" /></label>
          <label>被保险人<input v-model="policyDraft.insured" placeholder="林家" /></label>
          <label>保障生效日<input v-model="policyDraft.startedAt" type="date" required /></label>
          <label>缴费周期<select v-model="policyDraft.billingCycle"><option v-for="cycle in BILLING_CYCLES" :key="cycle.value" :value="cycle.value">{{ cycle.label }}</option></select></label>
          <label>当前保费（每期）<input v-model.number="policyDraft.premium" type="number" min="0" step="1" placeholder="2890" required /></label>
          <label>下次缴费日<input v-model="policyDraft.nextPaymentDate" type="date" required /></label>
          <label class="wide">保障到期日<input v-model="policyDraft.expires" type="date" required /></label>
        </div>
        <p class="form-note">当前保费和缴费周期只影响下一周期；已生成的缴费记录会保留缴费时的金额、周期和保障期间，不会被后续调整回改。</p>
        <div class="modal-actions"><button type="button" class="secondary" @click="showPolicyForm = false">取消</button><button class="primary" type="submit"><FilePlus2 :size="16" />保存保单</button></div>
      </form>
    </div>
  </div>
</template>
