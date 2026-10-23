
// Star display; pass onChange to make it an input
function StarRating({
  value = 0,
  onChange,
  size = 18
}) {

  const interactive =
    typeof onChange === 'function'

  return (

    <span
      style={{
        display: 'inline-flex',
        gap: interactive ? 4 : 1,
        lineHeight: 1
      }}
      role={interactive ? 'radiogroup' : 'img'}
      aria-label={`${value} out of 5 stars`}
    >

      {[1, 2, 3, 4, 5].map(star => {

        const filled =
          star <= Math.round(value)

        const style = {
          fontSize: size,
          color: filled ? '#f59e0b' : '#d4d9e1',
          background: 'none',
          border: 0,
          padding: 0,
          cursor: interactive ? 'pointer' : 'default'
        }

        return interactive ? (

          <button
            key={star}
            type="button"
            role="radio"
            aria-checked={star === value}
            aria-label={`${star} star${star === 1 ? '' : 's'}`}
            onClick={() => onChange(star)}
            style={style}
          >
            ★
          </button>

        ) : (

          <span key={star} style={style}>
            ★
          </span>

        )
      })}

    </span>

  )
}

export default StarRating
