
function StatCard({
  title,
  value,
  subtitle,
  icon,
  type = 'blue'
}) {

  return (

    <div className="mq-stat-card">

      <div className={`mq-stat-icon ${type}`}>
        {icon}
      </div>


      <div className="mq-stat-content">

        <div className="mq-stat-title">
          {title}
        </div>

        <div className="mq-stat-value">
          {value}
        </div>

        {subtitle && (

          <div className="mq-stat-subtitle">
            {subtitle}
          </div>

        )}

      </div>

    </div>

  )
}

export default StatCard

