/**
 * Alfred's Dashboard - Settings Page
 * Theme, polling, and thinking toggles with real-time updates
 */

const SettingsPage = {
  /**
   * Main render function
   */
  async render() {
    return this.renderSettings();
  },

  /**
   * Render settings page
   */
  renderSettings() {
    const preferences = this.getPreferences();

    return `
      <div class="settings-page">
        <div class="settings-header">
          <h1 class="page-title">Settings</h1>
          <p class="page-subtitle">Customize your dashboard experience</p>
        </div>

        <!-- Appearance Section -->
        <div class="settings-section">
          <div class="settings-section-header">
            <h2 class="settings-section-title">Appearance</h2>
            <p class="settings-section-description">Customize how Alfred's Dashboard looks</p>
          </div>
          <div class="settings-list">
            <div class="settings-item">
              <div class="settings-item-info">
                <div class="settings-item-label">Theme</div>
                <div class="settings-item-description">Choose your preferred color scheme</div>
              </div>
              <div class="select-wrapper">
                <select class="select" id="themeSelect" onchange="SettingsPage.updateTheme(this.value)">
                  <option value="light" ${preferences.theme === 'light' ? 'selected' : ''}>Light</option>
                  <option value="dark" ${preferences.theme === 'dark' ? 'selected' : ''}>Dark</option>
                  <option value="auto" ${preferences.theme === 'auto' ? 'selected' : ''}>System</option>
                </select>
                <svg class="select-arrow" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <polyline points="6 9 12 15 18 9"/>
                </svg>
              </div>
            </div>
          </div>
        </div>

        <!-- Data & Updates Section -->
        <div class="settings-section">
          <div class="settings-section-header">
            <h2 class="settings-section-title">Data & Updates</h2>
            <p class="settings-section-description">Control how data is refreshed and updated</p>
          </div>
          <div class="settings-list">
            <div class="settings-item">
              <div class="settings-item-info">
                <div class="settings-item-label">Live Updates</div>
                <div class="settings-item-description">Automatically refresh data every 3 seconds</div>
              </div>
              <label class="toggle">
                <input type="checkbox" id="pollingToggle" ${preferences.pollingEnabled ? 'checked' : ''} onchange="SettingsPage.togglePolling(this.checked)">
                <span class="toggle-slider"></span>
              </label>
            </div>
            <div class="settings-item">
              <div class="settings-item-info">
                <div class="settings-item-label">Update Interval</div>
                <div class="settings-item-description">How often to fetch new data</div>
              </div>
              <div class="select-wrapper">
                <select class="select" id="pollingIntervalSelect" onchange="SettingsPage.updatePollingInterval(this.value)">
                  <option value="1000" ${preferences.pollingInterval === 1000 ? 'selected' : ''}>1 second</option>
                  <option value="2000" ${preferences.pollingInterval === 2000 ? 'selected' : ''}>2 seconds</option>
                  <option value="3000" ${preferences.pollingInterval === 3000 ? 'selected' : ''}>3 seconds</option>
                  <option value="5000" ${preferences.pollingInterval === 5000 ? 'selected' : ''}>5 seconds</option>
                  <option value="10000" ${preferences.pollingInterval === 10000 ? 'selected' : ''}>10 seconds</option>
                </select>
                <svg class="select-arrow" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <polyline points="6 9 12 15 18 9"/>
                </svg>
              </div>
            </div>
          </div>
        </div>

        <!-- Agent Behavior Section -->
        <div class="settings-section">
          <div class="settings-section-header">
            <h2 class="settings-section-title">Agent Behavior</h2>
            <p class="settings-section-description">Configure how agents respond and behave</p>
          </div>
          <div class="settings-list">
            <div class="settings-item">
              <div class="settings-item-info">
                <div class="settings-item-label">Show Thinking Indicator</div>
                <div class="settings-item-description">Display animated dots while agent is processing</div>
              </div>
              <label class="toggle">
                <input type="checkbox" id="thinkingToggle" ${preferences.showThinking !== false ? 'checked' : ''} onchange="SettingsPage.toggleThinking(this.checked)">
                <span class="toggle-slider"></span>
              </label>
            </div>
            <div class="settings-item">
              <div class="settings-item-info">
                <div class="settings-item-label">Auto-scroll Chat</div>
                <div class="settings-item-description">Automatically scroll to new messages</div>
              </div>
              <label class="toggle">
                <input type="checkbox" id="autoScrollToggle" ${preferences.autoScroll !== false ? 'checked' : ''} onchange="SettingsPage.toggleAutoScroll(this.checked)">
                <span class="toggle-slider"></span>
              </label>
            </div>
          </div>
        </div>

        <!-- Notifications Section -->
        <div class="settings-section">
          <div class="settings-section-header">
            <h2 class="settings-section-title">Notifications</h2>
            <p class="settings-section-description">Manage alert and notification preferences</p>
          </div>
          <div class="settings-list">
            <div class="settings-item">
              <div class="settings-item-info">
                <div class="settings-item-label">Error Notifications</div>
                <div class="settings-item-description">Show toast when errors occur</div>
              </div>
              <label class="toggle">
                <input type="checkbox" id="errorNotificationsToggle" ${preferences.errorNotifications !== false ? 'checked' : ''} onchange="SettingsPage.toggleErrorNotifications(this.checked)">
                <span class="toggle-slider"></span>
              </label>
            </div>
            <div class="settings-item">
              <div class="settings-item-info">
                <div class="settings-item-label">Connection Alerts</div>
                <div class="settings-item-description">Notify when connection status changes</div>
              </div>
              <label class="toggle">
                <input type="checkbox" id="connectionAlertsToggle" ${preferences.connectionAlerts !== false ? 'checked' : ''} onchange="SettingsPage.toggleConnectionAlerts(this.checked)">
                <span class="toggle-slider"></span>
              </label>
            </div>
          </div>
        </div>

        <!-- About Section -->
        <div class="settings-section">
          <div class="settings-section-header">
            <h2 class="settings-section-title">About</h2>
            <p class="settings-section-description">Application information</p>
          </div>
          <div class="settings-list">
            <div class="settings-item">
              <div class="settings-item-info">
                <div class="settings-item-label">Version</div>
                <div class="settings-item-description">Alfred's Dashboard v1.0.0</div>
              </div>
            </div>
            <div class="settings-item">
              <div class="settings-item-info">
                <div class="settings-item-label">Built with</div>
                <div class="settings-item-description">Modern vanilla JavaScript, CSS3, and HTML5</div>
              </div>
            </div>
          </div>
        </div>

        <!-- Actions -->
        <div class="settings-section" style="background: var(--color-error-subtle); border-color: var(--color-error);">
          <div class="settings-section-header" style="border-color: var(--color-error);">
            <h2 class="settings-section-title" style="color: var(--color-error);">Danger Zone</h2>
            <p class="settings-section-description">Irreversible actions</p>
          </div>
          <div class="settings-list">
            <div class="settings-item">
              <div class="settings-item-info">
                <div class="settings-item-label">Reset All Settings</div>
                <div class="settings-item-description">Restore all settings to their default values</div>
              </div>
              <button class="btn btn-danger" onclick="SettingsPage.resetAllSettings()">
                Reset Settings
              </button>
            </div>
            <div class="settings-item">
              <div class="settings-item-info">
                <div class="settings-item-label">Clear Local Storage</div>
                <div class="settings-item-description">Remove all locally stored data</div>
              </div>
              <button class="btn btn-danger" onclick="SettingsPage.clearStorage()">
                Clear Storage
              </button>
            </div>
          </div>
        </div>
      </div>
    `;
  },

  /**
   * Get current preferences
   */
  getPreferences() {
    return {
      theme: App.state.theme,
      pollingEnabled: App.state.pollingEnabled,
      pollingInterval: App.state.pollingInterval,
      showThinking: this.getPreference('showThinking', true),
      autoScroll: this.getPreference('autoScroll', true),
      errorNotifications: this.getPreference('errorNotifications', true),
      connectionAlerts: this.getPreference('connectionAlerts', true),
    };
  },

  /**
   * Get a preference with default
   */
  getPreference(key, defaultValue) {
    try {
      const prefs = JSON.parse(localStorage.getItem('alfred_preferences') || '{}');
      return prefs[key] !== undefined ? prefs[key] : defaultValue;
    } catch {
      return defaultValue;
    }
  },

  /**
   * Save a preference
   */
  savePreference(key, value) {
    try {
      const prefs = JSON.parse(localStorage.getItem('alfred_preferences') || '{}');
      prefs[key] = value;
      localStorage.setItem('alfred_preferences', JSON.stringify(prefs));
    } catch (e) {
      console.warn('Failed to save preference:', e);
    }
  },

  /**
   * Update theme
   */
  updateTheme(theme) {
    App.state.theme = theme;
    App.applyTheme();
    App.savePreferences();
    Toast.success('Theme updated', `Switched to ${theme} mode`);
  },

  /**
   * Toggle polling
   */
  togglePolling(enabled) {
    App.state.pollingEnabled = enabled;
    App.updatePollingIndicator();
    App.savePreferences();
    Toast.info(
      enabled ? 'Live updates enabled' : 'Live updates paused'
    );
  },

  /**
   * Update polling interval
   */
  updatePollingInterval(interval) {
    App.state.pollingInterval = parseInt(interval, 10);
    App.savePreferences();
    
    // Restart polling with new interval
    if (App.state.pollingEnabled) {
      clearInterval(App.globalPollingTimer);
      App.startPolling();
    }
    
    Toast.success('Update interval changed', `Now fetching data every ${interval / 1000} seconds`);
  },

  /**
   * Toggle thinking indicator
   */
  toggleThinking(enabled) {
    this.savePreference('showThinking', enabled);
    Toast.info(
      enabled ? 'Thinking indicator enabled' : 'Thinking indicator disabled'
    );
  },

  /**
   * Toggle auto-scroll
   */
  toggleAutoScroll(enabled) {
    this.savePreference('autoScroll', enabled);
    Toast.info(
      enabled ? 'Auto-scroll enabled' : 'Auto-scroll disabled'
    );
  },

  /**
   * Toggle error notifications
   */
  toggleErrorNotifications(enabled) {
    this.savePreference('errorNotifications', enabled);
    Toast.info(
      enabled ? 'Error notifications enabled' : 'Error notifications disabled'
    );
  },

  /**
   * Toggle connection alerts
   */
  toggleConnectionAlerts(enabled) {
    this.savePreference('connectionAlerts', enabled);
    Toast.info(
      enabled ? 'Connection alerts enabled' : 'Connection alerts disabled'
    );
  },

  /**
   * Reset all settings
   */
  resetAllSettings() {
    if (!confirm('Are you sure you want to reset all settings to their defaults?')) {
      return;
    }
    
    // Reset App state
    App.state.theme = 'auto';
    App.state.pollingEnabled = true;
    App.state.pollingInterval = 3000;
    App.applyTheme();
    App.updatePollingIndicator();
    App.savePreferences();
    
    // Clear other preferences
    localStorage.removeItem('alfred_preferences');
    
    Toast.success('Settings reset', 'All settings have been restored to defaults');
    
    // Re-render settings page
    this.render().then(html => {
      document.getElementById('pageContent').innerHTML = html;
    });
  },

  /**
   * Clear local storage
   */
  clearStorage() {
    if (!confirm('Are you sure you want to clear all locally stored data? This will sign you out.')) {
      return;
    }
    
    localStorage.clear();
    
    Toast.success('Storage cleared', 'All local data has been removed');
    
    // Reload the app
    setTimeout(() => {
      window.location.reload();
    }, 1000);
  }
};

// Export
if (typeof module !== 'undefined' && module.exports) {
  module.exports = SettingsPage;
}
