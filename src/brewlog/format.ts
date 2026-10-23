export const stars = (n?: number) => (n ? '★'.repeat(n) + '☆'.repeat(5 - n) : '')

export const fmtDate = (ts: number) =>
  new Date(ts).toLocaleString('ru-RU', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })
