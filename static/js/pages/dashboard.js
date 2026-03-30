/**
 * Alfred's Dashboard - Dashboard Page
 * Organization overview with agent cards grid, stats, and status indicators
 */

const DashboardPage = {
  // Cache DOM elements after render
  cachedElements: {},

  /**
   * Main render function
   */
  async render() {
    try {
      const agents = await api.getAgents();
      return this.renderDashboard(agents);
    } catch (error) {
      console.error('Failed to load dashboard:', error);
      return new ErrorState({
        title: 'Failed to load dashboard',
        message: error.message,
        onRetry: () => DashboardPage.refresh()
      }).render();
    }
  },

  /**
   * Render dashboard with agents data
   */
  renderDashboard(agents) {
    const stats = this.calculateStats(agents);
    
    return `
      <div class="dashboard-page">
        <div class="dashboard-header">
          <div>
            <h1 class="page-title">Dashboard</h1>
            <p class="page-subtitle">Monitor and manage your AI agents</p>
          </div>
        </div>

        <!-- Stats Grid -->
        <div class="stats-grid">
          ${this.renderStatCard({
            icon: 'agents',
            iconClass: 'stat-icon--primary',
            label: 'Total Agents',
            value: stats.totalAgents,
            change: null
          })}
          ${this.renderStatCard({
            icon: 'online',
            iconClass: 'stat-icon--success',
            label: 'Online',
            value: stats.onlineAgents,
            change: stats.onlinePercent
          })}
          ${this.renderStatCard({
            icon: 'busy',
            iconClass: 'stat-icon--warning',
            label: 'Busy',
            value: stats.busyAgents,
            change: null
          })}
          ${this.renderStatCard({
            icon: 'messages',
            iconClass: 'stat-icon--info',
            label: 'Total Messages',
            value: stats.totalMessages,
            change: null
          })}
        </div>

        <!-- Agents Section -->
        <div class="agents-section">
          <div class="section-header">
            <h2 class="section-title">Your Agents</h2>
          </div>
          
          ${agents.length === 0 ? this.renderEmptyState() : `
            <div class="agents-grid">
              ${agents.map(agent => this.renderAgentCard(agent)).join('')}
            </div>
          `}
        </div>
      </div>
    `;
  },

  /**
   * Calculate dashboard statistics
   */
  calculateStats(agents) {
    const online = agents.filter(a => a.status === 'online' || a.status === 'thinking').length;
    const busy = agents.filter(a => a.status === 'busy').length;
    const totalMessages = agents.reduce((sum, a) => sum + (a.messageCount || 0), 0);
    
    return {
      totalAgents: agents.length,
      onlineAgents: online,
      busyAgents: busy,
      totalMessages,
      onlinePercent: agents.length > 0 ? Math.round((online / agents.length) * 100) : 0
    };
  },

  /**
   * Render a stat card
   */
  renderStatCard({ icon, iconClass, label, value, change }) {
    const icons = {
      agents: `<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <path d="M12 2a2 2 0 0 1 2 2c0 .74-.4 1.39-1 1.73V7h1a7 7 0 0 1 7 7h1a1 1 0 0 1 1 1v3a1 1 0 0 1-1 1h-1v1a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-1H2a1 1 0 0 1-1-1v-3a1 1 0 0 1 1-1h1a7 7 0 0 1 7-7h1V5.73c-.6-.34-1-.99-1-1.73a2 2 0 0 1 2-2z"/>
        <circle cx="7.5" cy="14.5" r="1.5"/>
        <circle cx="16.5" cy="14.5" r="1.5"/>
      </svg>`,
      online: `<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/>
        <polyline points="22 4 12 14.01 9 11.01"/>
      </svg>`,
      busy: `<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <circle cx="12" cy="12" r="10"/>
        <polyline points="12 6 12 12 16 14"/>
      </svg>`,
      messages: `<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
      </svg>`
    };

    const changeHtml = change !== null ? `
      <div class="stat-change stat-change--positive">
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <polyline points="23 6 13.5 15.5 8.5 10.5 1 18"/>
          <polyline points="17 6 23 6 23 12"/>
        </svg>
        ${change}% online
      </div>
    ` : '';

    return `
      <div class="stat-card">
        <div class="stat-icon ${iconClass}">
          ${icons[icon]}
        </div>
        <div class="stat-content">
          <div class="stat-label">${label}</div>
          <div class="stat-value">${typeof value === 'number' ? value.toLocaleString() : value}</div>
          ${changeHtml}
        </div>
      </div>
    `;
  },

  /**
   * Render an agent card
   */
  renderAgentCard(agent) {
    const avatar = new Avatar({
      name: agent.name,
      imageUrl: agent.avatarUrl,
      size: 'md'
    });

    const statusClass = agent.status || 'offline';
    const statusText = this.getStatusText(agent.status);
    const uptime = agent.uptime ? new FormatUptime(agent.uptime).format() : 'N/A';

    return `
      <a href="#/agent/${encodeURIComponent(agent.id)}" class="agent-card">
        <div class="agent-card-header">
          ${avatar.render()}
          <div class="agent-info">
            <div class="agent-name">
              ${agent.name}
              ${agent.version ? `<span style="font-size: var(--font-size-xs); font-weight: var(--font-weight-normal); color: var(--color-text-tertiary);">v${agent.version}</span>` : ''}
            </div>
            <div class="agent-status status-${statusClass}">
              <span class="agent-status-dot"></span>
              ${statusText}
            </div>
          </div>
        </div>
        <div class="agent-card-stats">
          <div class="agent-stat">
            <div class="agent-stat-value">${(agent.messageCount || 0).toLocaleString()}</div>
            <div class="agent-stat-label">Messages</div>
          </div>
          <div class="agent-stat">
            <div class="agent-stat-value">${uptime}</div>
            <div class="agent-stat-label">Uptime</div>
          </div>
        </div>
      </a>
    `;
  },

  /**
   * Get status display text
   */
  getStatusText(status) {
    switch (status) {
      case 'online': return 'Online';
      case 'busy': return 'Processing';
      case 'thinking': return 'Thinking';
      case 'offline': return 'Offline';
      default: return status || 'Unknown';
    }
  },

  /**
   * Render empty state
   */
  renderEmptyState() {
    return `
      <div class="error-state" style="padding: var(--space-12);">
        <div class="error-icon" style="background: var(--color-accent-subtle); color: var(--color-accent);">
          <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M12 2a2 2 0 0 1 2 2c0 .74-.4 1.39-1 1.73V7h1a7 7 0 0 1 7 7h1a1 1 0 0 1 1 1v3a1 1 0 0 1-1 1h-1v1a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-1H2a1 1 0 0 1-1-1v-3a1 1 0 0 1 1-1h1a7 7 0 0 1 7-7h1V5.73c-.6-.34-1-.99-1-1.73a2 2 0 0 1 2-2z"/>
          </svg>
        </div>
        <h3 class="error-title">No agents yet</h3>
        <p class="error-message">Start a conversation with an agent to see it appear here.</p>
      </div>
    `;
  },

  /**
   * Refresh dashboard data
   */
  async refresh() {
    try {
      const agents = await api.getAgents();
      
      // Update stats
      const stats = this.calculateStats(agents);
      this.updateStats(stats);
      
      // Update agents grid if on dashboard
      const agentsGrid = document.querySelector('.agents-grid');
      if (agentsGrid) {
        if (agents.length === 0) {
          agentsGrid.innerHTML = this.renderEmptyState();
        } else {
          agentsGrid.innerHTML = agents.map(agent => this.renderAgentCard(agent)).join('');
        }
      }
    } catch (error) {
      console.warn('Dashboard refresh error:', error);
    }
  },

  /**
   * Update stats without full re-render
   */
  updateStats(stats) {
    const statCards = document.querySelectorAll('.stat-card');
    if (statCards.length >= 4) {
      statCards[0].querySelector('.stat-value').textContent = stats.totalAgents;
      statCards[1].querySelector('.stat-value').textContent = stats.onlineAgents;
      statCards[2].querySelector('.stat-value').textContent = stats.busyAgents;
      statCards[3].querySelector('.stat-value').textContent = stats.totalMessages.toLocaleString();
    }
  }
};

// Export
if (typeof module !== 'undefined' && module.exports) {
  module.exports = DashboardPage;
}
