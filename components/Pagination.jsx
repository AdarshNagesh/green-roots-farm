export default function Pagination({ page, total, perPage, onChange }) {
  const totalPages = Math.ceil(total / perPage)
  if (totalPages <= 1) return null

  const from = (page - 1) * perPage + 1
  const to   = Math.min(page * perPage, total)

  // Build page numbers to show: always first, last, current ±1, with ellipsis
  function getPages() {
    const pages = new Set([1, totalPages, page, page - 1, page + 1].filter(p => p >= 1 && p <= totalPages))
    const sorted = [...pages].sort((a, b) => a - b)
    const result = []
    for (let i = 0; i < sorted.length; i++) {
      if (i > 0 && sorted[i] - sorted[i - 1] > 1) result.push('...')
      result.push(sorted[i])
    }
    return result
  }

  const btn = (label, onClick, active = false, disabled = false) => (
    <button key={label + active}
      onClick={onClick}
      disabled={disabled}
      style={{
        minWidth: 34, height: 34, padding: '0 8px',
        border: `1.5px solid ${active ? 'var(--green)' : 'var(--border)'}`,
        borderRadius: 8, cursor: disabled ? 'default' : 'pointer',
        background: active ? 'var(--green)' : 'transparent',
        color: active ? '#fff' : disabled ? 'var(--muted)' : 'var(--text)',
        fontSize: 13, fontWeight: active ? 600 : 400,
        fontFamily: 'DM Sans, sans-serif',
        opacity: disabled ? 0.45 : 1,
        transition: 'all .15s',
      }}>
      {label}
    </button>
  )

  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      marginTop: 20, flexWrap: 'wrap', gap: 10 }}>
      <div style={{ fontSize: 13, color: 'var(--muted)' }}>
        Showing <strong style={{ color: 'var(--text)' }}>{from}–{to}</strong> of <strong style={{ color: 'var(--text)' }}>{total}</strong>
      </div>
      <div style={{ display: 'flex', gap: 5, alignItems: 'center' }}>
        {btn('←', () => onChange(page - 1), false, page === 1)}
        {getPages().map((p, i) =>
          p === '...'
            ? <span key={'e' + i} style={{ padding: '0 4px', color: 'var(--muted)', fontSize: 13 }}>…</span>
            : btn(p, () => onChange(p), p === page)
        )}
        {btn('→', () => onChange(page + 1), false, page === totalPages)}
      </div>
    </div>
  )
}
