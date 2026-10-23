
// Patient-facing live queue: answers "how many ahead, when am I called, is the doctor late?"

const MAX_DOTS = 9

// Live view starts this close to the slot; older unfinished ones count as missed
const WINDOW_MS = 12 * 60 * 60 * 1000

function clock(date) {
  return date.toLocaleTimeString('en-IN', { hour: 'numeric', minute: '2-digit' })
}

function slotTime(time) {
  if (!time) return ''
  const [hour, minute] = time.split(':')
  const date = new Date()
  date.setHours(Number(hour), Number(minute), 0, 0)
  return clock(date)
}

function longDate(value) {
  return new Date(`${value}T00:00:00`).toLocaleDateString('en-IN', {
    weekday: 'short',
    day: 'numeric',
    month: 'short'
  })
}

function waitText(minutes) {
  if (minutes <= 1) return 'any moment now'
  if (minutes < 60) return `in about ${minutes} min`

  const hours = Math.floor(minutes / 60)
  const rest = minutes % 60
  return `in about ${hours} hr${rest ? ` ${rest} min` : ''}`
}

const CHECK_IN_OPENS_MS = 3 * 60 * 60 * 1000
const LATE_OPTIONS = [10, 15, 30]

// "I've arrived" / "Running late" — lets the doctor know who is in the waiting room
function CheckInPanel({ appointment, onCheckIn, busy }) {

  if (appointment.arrivalStatus === 'ARRIVED') {
    return (
      <div style={styles.checkedIn}>
        ✓ You're checked in
        {appointment.checkedInAt && ` at ${clock(new Date(appointment.checkedInAt))}`}.
        The doctor can see you're here.
      </div>
    )
  }

  return (
    <div style={styles.checkInBox}>

      <div style={styles.checkInText}>
        {appointment.arrivalStatus === 'LATE'
          ? `You told the clinic you'd be about ${appointment.lateMinutes} min late.`
          : 'At the clinic? Let the doctor know.'}
      </div>

      <div style={styles.checkInActions}>

        <button
          type="button"
          disabled={busy}
          onClick={() => onCheckIn('ARRIVED')}
          style={styles.arrivedButton}
        >
          📍 I've arrived
        </button>

        <span style={styles.lateLabel}>Running late:</span>

        {LATE_OPTIONS.map(minutes => (
          <button
            key={minutes}
            type="button"
            disabled={busy}
            onClick={() => onCheckIn('LATE', minutes)}
            style={
              appointment.arrivalStatus === 'LATE' && appointment.lateMinutes === minutes
                ? { ...styles.lateButton, ...styles.lateButtonActive }
                : styles.lateButton
            }
          >
            {minutes} min
          </button>
        ))}

      </div>
    </div>
  )
}

function QueueTracker({ queueStatus, appointment, lastUpdated, now, onCheckIn, checkInBusy = false }) {

  if (!queueStatus || !appointment) return null

  const status = queueStatus.status

  // Real time of the slot, so night-shift slots after midnight work too
  const slotAt = new Date(`${appointment.appointmentDate}T${appointment.appointmentTime}`).getTime()
  const isLive = slotAt - now <= WINDOW_MS

  // Slot passed long ago but the visit was never closed by the doctor
  if ((status === 'BOOKED' || status === 'CALLED') && slotAt + WINDOW_MS < now) {
    return (
      <div style={{ ...styles.panel, ...styles.center }}>
        This appointment was on {longDate(appointment.appointmentDate)} and was not completed.
        Please book a new appointment if you still need to see the doctor.
      </div>
    )
  }

  // Remaining wait, counted down locally between server refreshes
  const elapsed = lastUpdated ? Math.floor((now - lastUpdated.getTime()) / 1000) : 0
  const remainingSeconds = Math.max(0, (queueStatus.estimatedWaitingSeconds ?? queueStatus.estimatedWaitingTime * 60) - elapsed)
  const remainingMinutes = Math.ceil(remainingSeconds / 60)

  // The server's own estimate, so the clock never drifts a minute from the slot
  const expectedAt = queueStatus.estimatedArrivalTime
    ? new Date(queueStatus.estimatedArrivalTime)
    : lastUpdated
      ? new Date(lastUpdated.getTime() + (queueStatus.estimatedWaitingSeconds ?? 0) * 1000)
      : null

  const ahead = queueStatus.patientsAhead || 0
  const served = queueStatus.patientsServed || 0
  const delay = queueStatus.delayMinutes || 0

  // ---- Finished / not active ----

  if (status === 'COMPLETED' || status === 'CANCELLED' || status === 'SKIPPED') {
    const text = {
      COMPLETED: 'Your consultation is complete.',
      CANCELLED: 'This appointment was cancelled.',
      SKIPPED: 'You were marked as missed. Please contact the clinic.'
    }[status]

    return <div style={{ ...styles.panel, ...styles.center }}>{text}</div>
  }

  // ---- Being seen now ----

  if (status === 'CALLED') {
    return (
      <div style={{ ...styles.panel, ...styles.turnPanel }}>
        <div style={styles.turnIcon}>✓</div>
        <div>
          <div style={styles.turnTitle}>It's your turn</div>
          <div style={styles.turnText}>
            Please go in to see {appointment.doctorName} now. Token #{queueStatus.tokenNumber}.
          </div>
        </div>
      </div>
    )
  }

  // ---- Booked for a later day ----

  if (!isLive) {
    return (
      <div style={styles.panel}>
        <div style={styles.label}>SCHEDULED</div>
        <div style={styles.headline}>
          {longDate(appointment.appointmentDate)} at {slotTime(appointment.appointmentTime)}
        </div>
        <div style={styles.sub}>
          {ahead === 0
            ? 'You are the first booking of the day for this doctor.'
            : `${ahead} patient${ahead === 1 ? ' is' : 's are'} booked before you that day.`}
        </div>
        <div style={styles.note}>
          Live waiting time starts closer to your visit.
        </div>
      </div>
    )
  }

  // ---- Waiting today ----

  const canCheckIn = Boolean(onCheckIn) && slotAt - now <= CHECK_IN_OPENS_MS

  const hiddenServed = Math.max(0, served - 2)
  const shownServed = Math.min(served, 2)
  const shownAhead = Math.min(ahead, MAX_DOTS - shownServed - 2)
  const hiddenAhead = ahead - shownAhead
  const hasCurrent = Boolean(queueStatus.currentToken)

  const consultingMinutes = queueStatus.currentConsultationStartedAt
    ? Math.max(0, Math.floor((now - new Date(queueStatus.currentConsultationStartedAt)) / 60000))
    : 0

  // The patient inside has gone past the usual length: any time we show
  // would just keep sliding, so say what is happening instead
  const overrunning = hasCurrent && Boolean(queueStatus.currentOverrunning)

  return (
    <div style={styles.panel}>

      <style>{'@keyframes mqPulse{0%,100%{box-shadow:0 0 0 0 rgba(15,118,110,.45)}50%{box-shadow:0 0 0 6px rgba(15,118,110,0)}}'}</style>

      {/* 1. Position in line */}
      <div style={styles.label}>
        <span style={styles.liveDot} /> LIVE QUEUE
      </div>

      <div style={styles.headline}>
        {ahead === 0
          ? hasCurrent ? "You're next" : "You're first in line"
          : `${ahead} patient${ahead === 1 ? '' : 's'} ahead of you`}
      </div>

      {/* 2. When you'll be called */}
      {overrunning && ahead === 0 ? (

        <div style={styles.overrunBox}>
          <div style={styles.overrunTitle}>
            You'll be called as soon as Token #{queueStatus.currentToken} finishes
          </div>
          <div style={styles.overrunText}>
            Token #{queueStatus.currentToken} has been with the doctor for {consultingMinutes} min
            (usually about {queueStatus.averageConsultationTime} min). Please stay nearby.
          </div>
        </div>

      ) : (

        <div style={styles.timeRow}>
          <div>
            <div style={styles.timeLabel}>
              {overrunning ? 'Expected to be called (may shift)' : 'Expected to be called'}
            </div>
            <div style={styles.timeValue}>
              {expectedAt ? clock(expectedAt) : '—'}
            </div>
          </div>
          <div style={overrunning ? styles.waitBadgeLate : styles.waitBadge}>
            {overrunning ? `at least ${Math.max(remainingMinutes, 1)} min` : waitText(remainingMinutes)}
          </div>
        </div>

      )}

      {overrunning && ahead > 0 && (
        <div style={styles.overrunNote}>
          Token #{queueStatus.currentToken} is taking longer than usual
          ({consultingMinutes} min so far), so this time may move later.
        </div>
      )}

      {canCheckIn && (
        <CheckInPanel
          appointment={appointment}
          onCheckIn={onCheckIn}
          busy={checkInBusy}
        />
      )}

      {/* 3. On time or running late */}
      <div style={delay > 0 ? styles.lateChip : styles.onTimeChip}>
        {delay > 0
          ? `Running about ${delay} min behind your ${slotTime(appointment.appointmentTime)} slot`
          : `On schedule for your ${slotTime(appointment.appointmentTime)} slot`}
      </div>

      {/* 4. Visual line */}
      <div style={styles.line} aria-label={`${served} done, ${ahead} ahead of you`}>
        {hiddenServed > 0 && <span style={styles.more}>+{hiddenServed}</span>}

        {Array.from({ length: shownServed }).map((_, index) => (
          <span key={`done-${index}`} style={{ ...styles.dot, ...styles.dotDone }}>✓</span>
        ))}

        {hasCurrent && (
          <span style={{ ...styles.dot, ...styles.dotCurrent }} title="With the doctor now">
            #{queueStatus.currentToken}
          </span>
        )}

        {Array.from({ length: shownAhead }).map((_, index) => (
          <span key={`ahead-${index}`} style={{ ...styles.dot, ...styles.dotAhead }} />
        ))}

        {hiddenAhead > 0 && <span style={styles.more}>+{hiddenAhead}</span>}

        <span style={{ ...styles.dot, ...styles.dotYou }}>You</span>
      </div>

      <div style={styles.legend}>
        <span><i style={{ ...styles.legendDot, background: '#cbd5e1' }} /> done</span>
        <span><i style={{ ...styles.legendDot, background: 'var(--mq-primary)' }} /> with doctor</span>
        <span><i style={{ ...styles.legendDot, border: '2px solid #94a3b8', background: '#fff' }} /> waiting</span>
      </div>

      {/* 5. What the doctor is doing right now */}
      <div style={styles.nowServing}>
        {hasCurrent
          ? `Now with the doctor: Token #${queueStatus.currentToken} (for ${consultingMinutes} min${overrunning ? ', longer than usual' : ''})`
          : queueStatus.doctorStarted
            ? 'The doctor is between patients.'
            : "The doctor hasn't started today's consultations yet."}
      </div>

      <div style={styles.note}>
        Estimate based on about {queueStatus.averageConsultationTime} min per patient
        {queueStatus.basedOnConsultations ? ` (from ${queueStatus.basedOnConsultations} recent visits)` : ''}.
        Updates automatically
        {lastUpdated ? ` · last checked ${lastUpdated.toLocaleTimeString('en-IN', { hour: 'numeric', minute: '2-digit', second: '2-digit' })}` : ''}.
      </div>
    </div>
  )
}

const styles = {
  panel: {
    border: '1px solid #e2ece9',
    background: '#fbfefd',
    borderRadius: 14,
    padding: 18,
    marginTop: 14
  },
  center: { textAlign: 'center', color: '#475569', fontSize: 13 },
  label: {
    display: 'flex',
    alignItems: 'center',
    gap: 6,
    fontSize: 12,
    fontWeight: 800,
    letterSpacing: 1,
    color: 'var(--mq-primary)'
  },
  liveDot: {
    width: 7,
    height: 7,
    borderRadius: '50%',
    background: '#16a34a',
    display: 'inline-block'
  },
  headline: { fontSize: 20, fontWeight: 800, color: '#172033', marginTop: 6 },
  sub: { fontSize: 13, color: '#475569', marginTop: 6 },
  timeRow: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
    gap: 12,
    flexWrap: 'wrap',
    marginTop: 14
  },
  timeLabel: { fontSize: 12, color: '#64748b' },
  timeValue: { fontSize: 30, fontWeight: 800, color: 'var(--mq-primary)', lineHeight: 1.1 },
  waitBadge: {
    background: '#ecfdf5',
    color: '#047857',
    borderRadius: 999,
    padding: '6px 12px',
    fontSize: 12,
    fontWeight: 700
  },
  waitBadgeLate: {
    background: '#fff7ed',
    color: '#9a3412',
    borderRadius: 999,
    padding: '6px 12px',
    fontSize: 12,
    fontWeight: 700
  },
  checkedIn: {
    marginTop: 12,
    fontSize: 12,
    fontWeight: 700,
    color: '#047857',
    background: '#ecfdf5',
    border: '1px solid #a7f3d0',
    borderRadius: 10,
    padding: '9px 12px'
  },
  checkInBox: {
    marginTop: 12,
    background: '#f8fafc',
    border: '1px dashed #cbd5e1',
    borderRadius: 10,
    padding: '10px 12px'
  },
  checkInText: { fontSize: 12, color: '#334155', fontWeight: 600 },
  checkInActions: {
    display: 'flex',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: 6,
    marginTop: 8
  },
  arrivedButton: {
    border: 0,
    background: 'var(--mq-primary)',
    color: '#fff',
    borderRadius: 8,
    padding: '8px 12px',
    fontSize: 12,
    fontWeight: 700,
    cursor: 'pointer'
  },
  lateLabel: { fontSize: 12, color: '#64748b', marginLeft: 6 },
  lateButton: {
    border: '1px solid #fed7aa',
    background: '#fff',
    color: '#9a3412',
    borderRadius: 999,
    padding: '6px 10px',
    fontSize: 12,
    fontWeight: 700,
    cursor: 'pointer'
  },
  lateButtonActive: { background: '#fff7ed', borderColor: '#f97316' },
  overrunBox: {
    marginTop: 14,
    background: '#fff7ed',
    border: '1px solid #fed7aa',
    borderRadius: 10,
    padding: '12px 14px'
  },
  overrunTitle: { fontSize: 15, fontWeight: 800, color: '#9a3412' },
  overrunText: { fontSize: 12, color: '#9a3412', marginTop: 4 },
  overrunNote: {
    marginTop: 8,
    fontSize: 12,
    color: '#9a3412'
  },
  onTimeChip: {
    marginTop: 12,
    fontSize: 12,
    color: '#047857',
    background: '#f0fdf4',
    borderRadius: 8,
    padding: '7px 10px'
  },
  lateChip: {
    marginTop: 12,
    fontSize: 12,
    color: '#9a3412',
    background: '#fff7ed',
    borderRadius: 8,
    padding: '7px 10px'
  },
  line: {
    display: 'flex',
    alignItems: 'center',
    gap: 6,
    flexWrap: 'wrap',
    marginTop: 16
  },
  dot: {
    minWidth: 26,
    height: 26,
    borderRadius: 999,
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: 12,
    fontWeight: 800,
    boxSizing: 'border-box'
  },
  dotDone: { background: '#e2e8f0', color: '#64748b' },
  dotCurrent: {
    background: 'var(--mq-primary)',
    color: '#fff',
    padding: '0 7px',
    animation: 'mqPulse 1.6s infinite'
  },
  dotAhead: { border: '2px solid #94a3b8', background: '#fff' },
  dotYou: {
    background: '#f59e0b',
    color: '#fff',
    padding: '0 9px'
  },
  more: { fontSize: 12, color: '#64748b', fontWeight: 700 },
  legend: {
    display: 'flex',
    gap: 12,
    flexWrap: 'wrap',
    fontSize: 12,
    color: '#64748b',
    marginTop: 8
  },
  legendDot: {
    display: 'inline-block',
    width: 9,
    height: 9,
    borderRadius: '50%',
    marginRight: 4,
    verticalAlign: 'middle',
    boxSizing: 'border-box'
  },
  nowServing: {
    marginTop: 14,
    fontSize: 12,
    color: '#334155',
    background: '#f1f5f9',
    borderRadius: 8,
    padding: '8px 10px'
  },
  note: { marginTop: 10, fontSize: 12, color: '#94a3b8' },
  turnPanel: {
    display: 'flex',
    alignItems: 'center',
    gap: 14,
    background: '#ecfdf5',
    borderColor: '#a7f3d0'
  },
  turnIcon: {
    width: 44,
    height: 44,
    borderRadius: '50%',
    background: '#059669',
    color: '#fff',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: 22,
    fontWeight: 800,
    flexShrink: 0
  },
  turnTitle: { fontSize: 20, fontWeight: 800, color: '#065f46' },
  turnText: { fontSize: 13, color: '#047857', marginTop: 3 }
}

export default QueueTracker
