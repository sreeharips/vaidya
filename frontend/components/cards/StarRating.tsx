interface StarRatingProps {
  rating: number
  count?: number
  size?: 'sm' | 'md'
}

export default function StarRating({ rating, count, size = 'md' }: StarRatingProps) {
  const fontSize = size === 'sm' ? '12px' : '13px'
  const filled = Math.round(rating)

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: '4px',
        fontSize,
        color: 'var(--slate)',
      }}
    >
      <span style={{ color: 'var(--gold)', letterSpacing: '-1px' }}>
        {'★'.repeat(filled)}{'☆'.repeat(5 - filled)}
      </span>
      <strong>{rating.toFixed(1)}</strong>
      {count !== undefined && (
        <span style={{ color: 'var(--muted)' }}>({count.toLocaleString()} reviews)</span>
      )}
    </div>
  )
}
