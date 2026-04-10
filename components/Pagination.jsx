export default function Pagination({ page, total, perPage, onChange }) {
  const totalPages = Math.ceil(total / perPage)
  if (!total || totalPages <= 1) return null

  const from = (page - 1) * perPage + 1
  const to   = Math.min(page * perPage, total)

  // Build page list: always show first, last, current ±1, with ellipsis gaps
  function getPages() {
    const set    = new Set([1, totalPages, page, page - 1, page + 1].filter(p => p >= 1 && p <= totalPages))
    const sorted = [...set].sort((a, b) => a - b)
    const result = []
    for (let i = 0; i < sorted.length; i++) {
      if (i > 0 && sorted[i] - sorted[i - 1] > 1) {
        result.push({ type: 'ellipsis', key: 'e' + i })
      }
      result.push({ type: 'page', num: sorted[i], key: 'p' + sorted[i] })
    }
    return result
  }

  function navBtn(label, onClick, disabled) {
    return (
      <button key={label} onClick={onClick} disabled={disabled}
        style={{
          minWidth: 34, height: 34, padding: '0 8px',
          border: '1.5px solid var(--border)', borderRadius: 8,
          cursor: disabled ? 'default' : 'pointer',
          background: 'transparent',
          color: disabled ? 'var(--muted)' : 'var(--text)',
          fontSize: 13, fontFamily: 'DM Sans, sans-serif',
          opacity: disabled ? 0.4 : 1, transition: 'all .15s',
        }}>
        {label}
      </button>
    )
  }

  return (
    <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between',
      marginTop:20, flexWrap:'wrap', gap:10 }}>

      {/* "Showing X–Y of Z" */}
      <div style={{ fontSize:13, color:'var(--muted)' }}>
        Showing{' '}
        <strong style={{ color:'var(--text)' }}>{from}–{to}</strong>
        {' '}of{' '}
        <strong style={{ color:'var(--text)' }}>{total}</strong>
      </div>

      {/* Page buttons */}
      <div style={{ display:'flex', gap:5, alignItems:'center' }}>
        {navBtn('←', () => onChange(page - 1), page === 1)}

        {getPages().map(item =>
          item.type === 'ellipsis'
            ? <span key={item.key} style={{ padding:'0 4px', color:'var(--muted)', fontSize:13 }}>…</span>
            : <button key={item.key} onClick={() => onChange(item.num)}
                style={{
                  minWidth: 34, height: 34, padding: '0 8px',
                  border: `1.5px solid ${item.num === page ? 'var(--green)' : 'var(--border)'}`,
                  borderRadius: 8, cursor: 'pointer',
                  background: item.num === page ? 'var(--green)' : 'transparent',
                  color: item.num === page ? '#fff' : 'var(--text)',
                  fontSize: 13, fontWeight: item.num === page ? 600 : 400,
                  fontFamily: 'DM Sans, sans-serif',
                  transition: 'all .15s',
                }}>
                {item.num}
              </button>
        )}

        {navBtn('→', () => onChange(page + 1), page === totalPages)}
      </div>
    </div>
  )
}
