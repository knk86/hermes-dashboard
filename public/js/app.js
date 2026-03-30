/**
 * Alfred's Dashboard - Main Application
 * Hash-based router, theme management, and polling loop
 */

const App = {
  // Application state
  state: {
    currentRoute: null,
    theme: 'auto',
    pollingEnabled: true,
    pollingInterval: 3000,
    isLoading: false,
  },

  // Polling timers
  pollingTimers: new Map(),

  // Route definitions
  routes: {
    '/': { title: 'Dashboard', render: () => DashboardPage.render() },
    '/agent/:id': { title: 'Agent Detail', render: (params) => AgentDetailPage.render(params.id) },
    '/settings': { title: 'Settings', render: () => SettingsPage.render() },
  },

  /**
   * Initialize the application
   */
  init() {
    // Load saved preferences
    this.loadPreferences();

    // Apply theme
    this.applyTheme();

    // Initialize sidebar
    this.initSidebar();

    // Set up routing
    this.setupRouter();

    // Set up theme toggle
    this.setupThemeToggle();

    // Set up polling indicator
    this.updatePollingIndicator();

    // Initial route
    this.handleRoute();

    // Start global polling
    this.startPolling();

    console.log('Alfred Dashboard initialized');
  },

  /**
   * Load user preferences from localStorage
   */
  loadPreferences() {
    try {
      const saved = localStorage.getItem('alfred_preferences');
      if (saved) {
        const prefs = JSON.parse(saved);
        this.state.theme = prefs.theme || 'auto';
        this.state.pollingEnabled = prefs.pollingEnabled !== false;
        this.state.pollingInterval = prefs.pollingInterval || 3000;
      }
    } catch (e) {
      console.warn('Failed to load preferences:', e);
    }
  },

  /**
   * Save preferences to localStorage
   */
  savePreferences() {
    try {
      localStorage.setItem('alfred_preferences', JSON.stringify({
        theme: this.state.theme,
        pollingEnabled: this.state.pollingEnabled,
        pollingInterval: this.state.pollingInterval,
      }));
    } catch (e) {
      console.warn('Failed to save preferences:', e);
    }
  },

  /**
   * Apply theme based on current setting
   */
  applyTheme() {
    let effectiveTheme = this.state.theme;

    if (effectiveTheme === 'auto') {
      effectiveTheme = window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
    }

    document.documentElement.setAttribute('data-theme', effectiveTheme);
  },

  /**
   * Initialize sidebar functionality
   */
  initSidebar() {
    const sidebar = document.getElementById('sidebar');
    const sidebarToggle = document.getElementById('sidebarToggle');
    const mobileMenuBtn = document.getElementById('mobileMenuBtn');
    const sidebarOverlay = document.getElementById('sidebarOverlay');

    // Toggle sidebar on mobile
    const toggleSidebar = () => {
      sidebar.classList.toggle('open');
      sidebarOverlay.classList.toggle('active');
    };

    if (sidebarToggle) {
      sidebarToggle.addEventListener('click', toggleSidebar);
    }

    if (mobileMenuBtn) {
      mobileMenuBtn.addEventListener('click', toggleSidebar);
    }

    // Close sidebar on overlay click
    if (sidebarOverlay) {
      sidebarOverlay.addEventListener('click', toggleSidebar);
    }

    // Close sidebar on route change (mobile)
    window.addEventListener('hashchange', () => {
      if (window.innerWidth <= 1024 && sidebar.classList.contains('open')) {
        toggleSidebar();
      }
    });
  },

  /**
   * Set up hash-based routing
   */
  setupRouter() {
    window.addEventListener('hashchange', () => this.handleRoute());
  },

  /**
   * Handle route changes
   */
  handleRoute() {
    const hash = window.location.hash.slice(1) || '/';
    const { route, params } = this.matchRoute(hash);

    if (!route) {
      // 404 - redirect to dashboard
      window.location.hash = '/';
      return;
    }

    // Update active nav item
    this.updateActiveNav(route);

    // Update breadcrumb
    this.updateBreadcrumb(route, params);

    // Update page title
    this.updatePageTitle(route);

    // Stop current page polling
    this.stopPagePolling();

    // Show loading state
    this.showLoading();

    // Render page
    this.state.currentRoute = route;
    route.render(params)
      .then(html => {
        this.hideLoading();
        this.renderPage(html);
        this.startPagePolling(route, params);
      })
      .catch(error => {
        console.error('Route render error:', error);
        this.hideLoading();
        this.renderPage(new ErrorState({
          title: 'Failed to load page',
          message: error.message,
          onRetry: () => this.handleRoute()
        }).render());
      });
  },

  /**
   * Match hash to route
   */
  matchRoute(hash) {
    // Exact match
    if (this.routes[hash]) {
      return { route: this.routes[hash], params: {} };
    }

    // Pattern matching for parameterized routes
    for (const [pattern, route] of Object.entries(this.routes)) {
      if (pattern.includes(':')) {
        const patternParts = pattern.split('/');
        const hashParts = hash.split('/');

        if (patternParts.length === hashParts.length) {
          const params = {};
          let match = true;

          for (let i = 0; i < patternParts.length; i++) {
            if (patternParts[i].startsWith(':')) {
              params[patternParts[i].slice(1)] = hashParts[i];
            } else if (patternParts[i] !== hashParts[i]) {
              match = false;
              break;
            }
          }

          if (match) {
            return { route, params };
          }
        }
      }
    }

    return { route: null, params: {} };
  },

  /**
   * Update active navigation item
   */
  updateActiveNav(route) {
    document.querySelectorAll('.nav-item').forEach(item => {
      item.classList.remove('active');
    });

    const routePath = route === this.routes['/'] ? '/' : 
                      route === this.routes['/settings'] ? '/settings' : '/';

    const activeItem = document.querySelector(`[data-route="${routePath === '/' ? 'dashboard' : routePath.slice(1)}"]`);
    if (activeItem) {
      activeItem.classList.add('active');
    }
  },

  /**
   * Update breadcrumb
   */
  updateBreadcrumb(route, params) {
    const breadcrumb = document.getElementById('breadcrumb');
    if (!breadcrumb) return;

    let html = `<a href="#/" class="breadcrumb-item">Dashboard</a>`;

    if (route === this.routes['/agent/:id']) {
      html += `
        <span class="breadcrumb-separator">/</span>
        <span class="breadcrumb-item">Agents</span>
        <span class="breadcrumb-separator">/</span>
        <span class="breadcrumb-item">${params.id}</span>
      `;
    } else if (route === this.routes['/settings']) {
      html += `
        <span class="breadcrumb-separator">/</span>
        <span class="breadcrumb-item">Settings</span>
      `;
    }

    breadcrumb.innerHTML = html;
  },

  /**
   * Update page title
   */
  updatePageTitle(route) {
    document.title = `${route.title} - Alfred's Dashboard`;
  },

  /**
   * Render page content
   */
  renderPage(html) {
    const pageContent = document.getElementById('pageContent');
    if (pageContent) {
      pageContent.innerHTML = html;
      // Scroll to top on route change
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  },

  /**
   * Show loading state
   */
  showLoading() {
    const loadingScreen = document.getElementById('loadingScreen');
    if (loadingScreen) {
      loadingScreen.style.display = 'flex';
    }
  },

  /**
   * Hide loading state
   */
  hideLoading() {
    const loadingScreen = document.getElementById('loadingScreen');
    if (loadingScreen) {
      loadingScreen.style.display = 'none';
    }
  },

  /**
   * Set up theme toggle
   */
  setupThemeToggle() {
    const themeToggle = document.getElementById('themeToggle');
    if (themeToggle) {
      themeToggle.addEventListener('click', () => {
        thiscycleTheme();
      });
    }

    // Listen for system theme changes
    window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => {
      if (this.state.theme === 'auto') {
        this.applyTheme();
      }
    });
  },

  /**
   * Cycle through themes
   */
  cycleTheme() {
    const themes = ['light', 'dark', 'auto'];
    const currentIndex = themes.indexOf(this.state.theme);
    this.state.theme = themes[(currentIndex + 1) % themes.length];
    this.applyTheme();
    this.savePreferences();
    
    Toast.info('Theme updated', `Switched to ${this.state.theme} mode`);
  },

  /**
   * Update polling indicator
   */
  updatePollingIndicator() {
    const indicator = document.getElementById('pollingIndicator');
    if (!indicator) return;

    if (this.state.pollingEnabled) {
      indicator.classList.remove('inactive');
      indicator.querySelector('span').textContent = 'Live';
    } else {
      indicator.classList.add('inactive');
      indicator.querySelector('span').textContent = 'Paused';
    }
  },

  /**
   * Start global polling
   */
  startPolling() {
    // This runs every 3 seconds regardless of page
    // Individual pages manage their own specific polling
    this.globalPollingTimer = setInterval(() => {
      if (this.state.pollingEnabled) {
        this.checkConnection();
      }
    }, this.state.pollingInterval);
  },

  /**
   * Check connection status
   */
  async checkConnection() {
    try {
      await api.getAgents();
      this.updateConnectionStatus(true);
    } catch (error) {
      this.updateConnectionStatus(false);
    }
  },

  /**
   * Update connection status indicator
   */
  updateConnectionStatus(connected) {
    const statusEl = document.getElementById('connectionStatus');
    if (!statusEl) return;

    const dot = statusEl.querySelector('.status-dot');
    const text = statusEl.querySelector('span');

    if (connected) {
      dot.style.background = 'var(--color-success)';
      dot.classList.add('status-dot--pulse');
      text.textContent = 'Connected';
    } else {
      dot.style.background = 'var(--color-error)';
      dot.classList.remove('status-dot--pulse');
      text.textContent = 'Disconnected';
    }
  },

  /**
   * Start page-specific polling
   */
  startPagePolling(route, params) {
    // Dashboard polling
    if (route === this.routes['/']) {
      this.startDashboardPolling();
    }
    // Agent detail polling
    else if (route === this.routes['/agent/:id']) {
      this.startAgentPolling(params.id);
    }
  },

  /**
   * Start dashboard polling
   */
  startDashboardPolling() {
    this.pollingTimers.set('dashboard', setInterval(async () => {
      if (!this.state.pollingEnabled) return;
      
      try {
        await DashboardPage.refresh();
      } catch (error) {
        console.warn('Dashboard refresh failed:', error);
      }
    }, this.state.pollingInterval));
  },

  /**
   * Start agent polling
   */
  startAgentPolling(agentId) {
    // Agent data polling
    this.pollingTimers.set('agent', setInterval(async () => {
      if (!this.state.pollingEnabled) return;
      
      try {
        await AgentDetailPage.refresh(agentId);
      } catch (error) {
        console.warn('Agent refresh failed:', error);
      }
    }, this.state.pollingInterval));

    // Messages polling (faster for responses)
    this.pollingTimers.set('messages', setInterval(async () => {
      if (!this.state.pollingEnabled) return;
      
      try {
        await AgentDetailPage.refreshMessages(agentId);
      } catch (error) {
        console.warn('Messages refresh failed:', error);
      }
    }, 2000));
  },

  /**
   * Stop current page polling
   */
  stopPagePolling() {
    this.pollingTimers.forEach((timer, key) => {
      clearInterval(timer);
      this.pollingTimers.delete(key);
    });
  },

  /**
   * Toggle polling globally
   */
  togglePolling() {
    this.state.pollingEnabled = !this.state.pollingEnabled;
    this.updatePollingIndicator();
    this.savePreferences();
    
    Toast.info(
      this.state.pollingEnabled ? 'Live updates enabled' : 'Live updates paused'
    );
  },

  /**
   * Navigate to a route
   */
  navigate(path) {
    window.location.hash = path;
  },
};

// Initialize app when DOM is ready
document.addEventListener('DOMContentLoaded', () => App.init());

// Export for module usage
if (typeof module !== 'undefined' && module.exports) {
  module.exports = App;
}
