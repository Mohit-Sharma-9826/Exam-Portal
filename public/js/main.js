document.addEventListener('DOMContentLoaded', () => {
  // ==========================================
  // RESPONSIVE SIDEBAR NAVIGATION
  // ==========================================
  const sidebar = document.getElementById('sidebar');
  const mobileToggle = document.getElementById('mobile-sidebar-toggle');
  const mobileClose = document.getElementById('mobile-sidebar-close');

  if (mobileToggle && sidebar) {
    mobileToggle.addEventListener('click', () => {
      sidebar.classList.add('open');
    });
  }

  if (mobileClose && sidebar) {
    mobileClose.addEventListener('click', () => {
      sidebar.classList.remove('open');
    });
  }

  // ==========================================
  // THEME SWITCHER (DARK / LIGHT MODE)
  // ==========================================
  const themeToggle = document.getElementById('theme-toggle');
  
  // Set initial icon display state
  const syncThemeIcon = (theme) => {
    const sunIcon = document.getElementById('theme-icon-light');
    const moonIcon = document.getElementById('theme-icon-dark');
    const themeText = document.getElementById('theme-text');
    
    if (themeToggle) {
      if (theme === 'dark') {
        if (sunIcon) sunIcon.style.display = 'inline-block';
        if (moonIcon) moonIcon.style.display = 'none';
        if (themeText) themeText.innerText = 'Light Mode';
      } else {
        if (sunIcon) sunIcon.style.display = 'none';
        if (moonIcon) moonIcon.style.display = 'inline-block';
        if (themeText) themeText.innerText = 'Dark Mode';
      }
    }
  };

  const currentTheme = localStorage.getItem('theme') || 'dark';
  syncThemeIcon(currentTheme);

  if (themeToggle) {
    themeToggle.addEventListener('click', () => {
      let activeTheme = document.documentElement.getAttribute('data-theme');
      let newTheme = activeTheme === 'dark' ? 'light' : 'dark';
      
      document.documentElement.setAttribute('data-theme', newTheme);
      localStorage.setItem('theme', newTheme);
      syncThemeIcon(newTheme);
      
      // Notify components if they are listening to theme shifts (like charts)
      window.dispatchEvent(new Event('themeChanged'));
    });
  }
});
