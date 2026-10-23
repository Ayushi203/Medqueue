
function Sidebar({
  activePage = 'Dashboard',
  onNavigate,
  user
}) {
  const menuItems = [
    { name: 'Dashboard', icon: '▦' },
    { name: 'Doctors', icon: '♙' },
    { name: 'Appointments', icon: '▣' },
    { name: 'Prescriptions', icon: '⌁' },
    { name: 'History', icon: '◷' }
  ]

  const handleNavigation = page => {
    if (onNavigate) {
      onNavigate(page)
    }
  }

  return (
    <aside className="mq-sidebar">

      {/* BRAND */}
      <div className="mq-brand">

        <div className="mq-brand-icon">
          +
        </div>

        <div>
          <div className="mq-brand-name">
            MedQueue
          </div>

          <div className="mq-brand-subtitle">
            Healthcare made simple
          </div>
        </div>

      </div>


      {/* MAIN MENU */}
      <div className="mq-sidebar-section">

        <div className="mq-sidebar-label">
          MENU
        </div>

        <nav>

          {menuItems.map(item => (

            <button
              key={item.name}
              type="button"
              className={
                activePage === item.name
                  ? 'mq-nav-item active'
                  : 'mq-nav-item'
              }
              onClick={() =>
                handleNavigation(item.name)
              }
            >

              <span className="mq-nav-icon">
                {item.icon}
              </span>

              <span>
                {item.name}
              </span>

            </button>

          ))}

        </nav>

      </div>


      {/* BOTTOM ACCOUNT MENU */}
      <div className="mq-sidebar-bottom">

        <div className="mq-sidebar-section">

          <div className="mq-sidebar-label">
            ACCOUNT
          </div>


          <button
            type="button"
            className={
              activePage === 'Profile'
                ? 'mq-nav-item active'
                : 'mq-nav-item'
            }
            onClick={() =>
              handleNavigation('Profile')
            }
          >

            <span className="mq-nav-icon">
              ◉
            </span>

            <span>
              Profile
            </span>

          </button>


          <button
            type="button"
            className={
              activePage === 'Settings'
                ? 'mq-nav-item active'
                : 'mq-nav-item'
            }
            onClick={() =>
              handleNavigation('Settings')
            }
          >

            <span className="mq-nav-icon">
              ⚙
            </span>

            <span>
              Settings
            </span>

          </button>

        </div>


        {/* USER */}
        {user && (

          <div className="mq-sidebar-user">

            <div className="mq-avatar">

              {user.name
                ? user.name
                    .charAt(0)
                    .toUpperCase()
                : 'U'}

            </div>


            <div className="mq-user-info">

              <div className="mq-user-name">
                {user.name}
              </div>

              <div className="mq-user-role">
                Patient
              </div>

            </div>

          </div>

        )}

      </div>

    </aside>
  )
}

export default Sidebar

