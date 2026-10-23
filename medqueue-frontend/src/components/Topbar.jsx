
function Topbar({
  title = 'Dashboard',
  subtitle = '',
  user,
  onLogout
}) {

  return (

    <header className="mq-topbar">

      <div>

        <h1 className="mq-page-title">
          {title}
        </h1>

        {subtitle && (

          <p className="mq-page-subtitle">
            {subtitle}
          </p>

        )}

      </div>


      <div className="mq-topbar-right">

        <button
          type="button"
          className="mq-icon-button"
          title="Notifications"
        >
          ♧
        </button>


        <div className="mq-topbar-divider">
        </div>


        {user && (

          <div className="mq-topbar-user">

            <div className="mq-avatar small">
              {user.name
                ? user.name.charAt(0).toUpperCase()
                : 'U'}
            </div>


            <div className="mq-topbar-user-info">

              <div className="mq-topbar-user-name">
                {user.name}
              </div>

              <div className="mq-topbar-user-role">
                Patient
              </div>

            </div>

          </div>

        )}


        <button
          type="button"
          className="mq-logout-button"
          onClick={onLogout}
        >
          Logout
        </button>

      </div>

    </header>

  )
}

export default Topbar

