
function StatusBadge({
  status
}) {

  const normalizedStatus =
    (status || '')
      .toUpperCase()


  let className =
    'mq-status-badge booked'


  if (normalizedStatus === 'COMPLETED') {

    className =
      'mq-status-badge completed'

  } else if (normalizedStatus === 'CALLED') {

    className =
      'mq-status-badge called'

  } else if (normalizedStatus === 'SKIPPED') {

    className =
      'mq-status-badge skipped'

  } else if (normalizedStatus === 'CANCELLED') {

    className =
      'mq-status-badge cancelled'

  } else if (normalizedStatus === 'EXPIRED') {

    className =
      'mq-status-badge skipped'

  }


  const label =
    normalizedStatus === 'EXPIRED'
      ? 'NOT COMPLETED'
      : normalizedStatus


  return (

    <span className={className}>

      <span className="mq-status-dot">
      </span>

      {label}

    </span>

  )
}

export default StatusBadge

