/**
 * Alfred's Dashboard - Reusable Components
 * Modern UI components with consistent API
 */

/* --------------------------------------------------------------------------
   Avatar Component
   -------------------------------------------------------------------------- */
class Avatar {
  /**
   * @param {Object} options
   * @param {string} options.name - Display name for avatar
   * @param {string} options.imageUrl - Optional image URL
   * @param {string} options.size - Size: sm, md, lg, xl
   * @param {string} options.className - Additional CSS classes
   */
  constructor({ name = '', imageUrl = '', size = 'md', className = '' }) {
    this.name = name;
    this.imageUrl = imageUrl;
    this.size = size;
    this.className = className;
  }

  getInitials() {
    if (!this.name) return '?';
    const parts = this.name.split(' ').filter(Boolean);
    if (parts.length >= 2) {
      return (parts[0][0] + parts[1][0]).toUpperCase();
    }
    return this.name.substring(0, 2).toUpperCase();
  }

  getEmoji() {
    if (!this.name) return '🤖';
    // Generate consistent emoji based on name
    const emojis = ['🤖', '🦊', '🦉', '🐙', '🦋', '🌟', '🔮', '🎯', '💡', '⚡', '🎨', '🚀'];
    let hash = 0;
    for (let i = 0; i < this.name.length; i++) {
      hash = this.name.charCodeAt(i) + ((hash << 5) - hash);
    }
    return emojis[Math.abs(hash) % emojis.length];
  }

  render() {
    const sizeClass = `avatar-${this.size}`;
    
    if (this.imageUrl) {
      return `
        <div class="agent-avatar ${sizeClass} ${this.className}" title="${this.name}">
          <img src="${this.imageUrl}" alt="${this.name}" style="width: 100%; height: 100%; object-fit: cover; border-radius: inherit;">
        </div>
      `;
    }

    return `
      <div class="agent-avatar ${sizeClass} ${this.className}" title="${this.name}">
        ${this.getEmoji()}
      </div>
    `;
  }
}

/* --------------------------------------------------------------------------
   Status Dot Component
   -------------------------------------------------------------------------- */
class StatusDot {
  /**
   * @param {Object} options
   * @param {string} options.status - online, busy, offline, thinking
   * @param {boolean} options.pulse - Enable pulse animation
   * @param {string} options.className - Additional CSS classes
   */
  constructor({ status = 'offline', pulse = false, className = '' }) {
    this.status = status;
    this.pulse = pulse;
    this.className = className;
  }

  render() {
    const pulseClass = this.pulse ? 'status-dot--pulse' : '';
    return `<span class="status-dot ${pulseClass} status-${this.status}"></span>`;
  }
}

/* --------------------------------------------------------------------------
   Time Ago Component
   -------------------------------------------------------------------------- */
class TimeAgo {
  /**
   * @param {Date|string|number} date - Date to format
   */
  constructor(date) {
    this.date = new Date(date);
  }

  getSeconds() {
    return Math.floor((new Date() - this.date) / 1000);
  }

  format() {
    const seconds = this.getSeconds();
    
    if (seconds < 5) return 'just now';
    if (seconds < 60) return `${seconds}s ago`;
    
    const minutes = Math.floor(seconds / 60);
    if (minutes < 60) return `${minutes}m ago`;
    
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours}h ago`;
    
    const days = Math.floor(hours / 24);
    if (days < 7) return `${days}d ago`;
    
    const weeks = Math.floor(days / 7);
    if (weeks < 4) return `${weeks}w ago`;
    
    const months = Math.floor(days / 30);
    if (months < 12) return `${months}mo ago`;
    
    const years = Math.floor(days / 365);
    return `${years}y ago`;
  }

  render() {
    return `<span class="time-ago" title="${this.date.toLocaleString()}">${this.format()}</span>`;
  }
}

/* --------------------------------------------------------------------------
   Format Uptime Component
   -------------------------------------------------------------------------- */
class FormatUptime {
  /**
   * @param {number} seconds - Uptime in seconds
   */
  constructor(seconds) {
    this.seconds = Math.max(0, Math.floor(seconds));
  }

  format() {
    const seconds = this.seconds;
    
    if (seconds < 60) return `${seconds}s`;
    
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    
    if (minutes < 60) {
      return remainingSeconds > 0 
        ? `${minutes}m ${remainingSeconds}s` 
        : `${minutes}m`;
    }
    
    const hours = Math.floor(minutes / 60);
    const remainingMinutes = minutes % 60;
    
    if (hours < 24) {
      return remainingMinutes > 0 
        ? `${hours}h ${remainingMinutes}m` 
        : `${hours}h`;
    }
    
    const days = Math.floor(hours / 24);
    const remainingHours = hours % 24;
    
    if (days < 7) {
      return remainingHours > 0 
        ? `${days}d ${remainingHours}h` 
        : `${days}d`;
    }
    
    const weeks = Math.floor(days / 7);
    const remainingDays = days % 7;
    
    return remainingDays > 0 
      ? `${weeks}w ${remainingDays}d` 
      : `${weeks}w`;
  }

  render() {
    return `<span class="format-uptime" title="${this.seconds} seconds">${this.format()}</span>`;
  }
}

/* --------------------------------------------------------------------------
   Skeleton Card Component
   -------------------------------------------------------------------------- */
class SkeletonCard {
  /**
   * @param {Object} options
   * @param {string} options.type - Card type: agent, message, stat
   * @param {number} options.count - Number of skeleton items
   */
  constructor({ type = 'agent', count = 1 }) {
    this.type = type;
    this.count = count;
  }

  renderAgentCard() {
    return `
      <div class="skeleton-card">
        <div style="display: flex; gap: var(--space-4); margin-bottom: var(--space-4);">
          <div class="skeleton skeleton-avatar"></div>
          <div style="flex: 1;">
            <div class="skeleton skeleton-text" style="width: 60%; height: 1.2em;"></div>
            <div class="skeleton skeleton-text" style="width: 40%; height: 1em; margin-top: var(--space-2);"></div>
          </div>
        </div>
        <div style="display: grid; grid-template-columns: repeat(2, 1fr); gap: var(--space-3); padding-top: var(--space-4); border-top: 1px solid var(--color-border);">
          <div class="skeleton skeleton-text" style="height: 1.5em;"></div>
          <div class="skeleton skeleton-text" style="height: 1.5em;"></div>
        </div>
      </div>
    `;
  }

  renderMessageSkeleton() {
    return `
      <div style="display: flex; gap: var(--space-3);">
        <div class="skeleton skeleton-avatar"></div>
        <div style="flex: 1;">
          <div class="skeleton skeleton-text" style="width: 80%;"></div>
          <div class="skeleton skeleton-text" style="width: 60%;"></div>
        </div>
      </div>
    `;
  }

  renderStatCard() {
    return `
      <div class="stat-card">
        <div class="skeleton" style="width: 48px; height: 48px; border-radius: var(--radius-lg);"></div>
        <div style="flex: 1;">
          <div class="skeleton skeleton-text" style="width: 50%;"></div>
          <div class="skeleton skeleton-text" style="width: 70%; height: 2em; margin-top: var(--space-2);"></div>
        </div>
      </div>
    `;
  }

  render() {
    let skeleton = '';
    
    for (let i = 0; i < this.count; i++) {
      switch (this.type) {
        case 'message':
          skeleton += this.renderMessageSkeleton();
          break;
        case 'stat':
          skeleton += this.renderStatCard();
          break;
        default:
          skeleton += this.renderAgentCard();
      }
      if (i < this.count - 1) skeleton += '<div style="height: var(--space-4);"></div>';
    }
    
    return skeleton;
  }
}

/* --------------------------------------------------------------------------
   Error State Component
   -------------------------------------------------------------------------- */
class ErrorState {
  /**
   * @param {Object} options
   * @param {string} options.title - Error title
   * @param {string} options.message - Error message
   * @param {string} options.icon - Icon type: error, warning, info
   * @param {Function} options.onRetry - Retry callback
   */
  constructor({ title = 'Something went wrong', message = 'An unexpected error occurred. Please try again.', icon = 'error', onRetry = null }) {
    this.title = title;
    this.message = message;
    this.icon = icon;
    this.onRetry = onRetry;
  }

  getIconSvg() {
    switch (this.icon) {
      case 'warning':
        return `<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/>
          <line x1="12" y1="9" x2="12" y2="13"/>
          <line x1="12" y1="17" x2="12.01" y2="17"/>
        </svg>`;
      case 'info':
        return `<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <circle cx="12" cy="12" r="10"/>
          <line x1="12" y1="16" x2="12" y2="12"/>
          <line x1="12" y1="8" x2="12.01" y2="8"/>
        </svg>`;
      default:
        return `<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <circle cx="12" cy="12" r="10"/>
          <line x1="15" y1="9" x2="9" y2="15"/>
          <line x1="9" y1="9" x2="15" y2="15"/>
        </svg>`;
    }
  }

  render() {
    const retryButton = this.onRetry ? `
      <button class="btn btn-primary" onclick="(${this.onRetry})()">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <polyline points="23 4 23 10 17 10"/>
          <path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"/>
        </svg>
        Try Again
      </button>
    ` : '';

    return `
      <div class="error-state">
        <div class="error-icon">
          ${this.getIconSvg()}
        </div>
        <h3 class="error-title">${this.title}</h3>
        <p class="error-message">${this.message}</p>
        ${retryButton}
      </div>
    `;
  }
}

/* --------------------------------------------------------------------------
   Toast Notification System
   -------------------------------------------------------------------------- */
const Toast = {
  container: null,

  init() {
    this.container = document.getElementById('toastContainer');
  },

  show({ type = 'info', title, message, duration = 5000 }) {
    if (!this.container) this.init();

    const icons = {
      success: `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="20 6 9 17 4 12"/></svg>`,
      error: `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>`,
      warning: `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>`,
      info: `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg>`
    };

    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    toast.innerHTML = `
      <div class="toast-icon">${icons[type]}</div>
      <div class="toast-content">
        <div class="toast-title">${title}</div>
        ${message ? `<div class="toast-message">${message}</div>` : ''}
      </div>
      <button class="toast-close" aria-label="Close">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <line x1="18" y1="6" x2="6" y2="18"/>
          <line x1="6" y1="6" x2="18" y2="18"/>
        </svg>
      </button>
    `;

    const closeBtn = toast.querySelector('.toast-close');
    closeBtn.addEventListener('click', () => this.remove(toast));

    toast.addEventListener('click', (e) => {
      if (e.target === toast) this.remove(toast);
    });

    this.container.appendChild(toast);

    if (duration > 0) {
      setTimeout(() => this.remove(toast), duration);
    }

    return toast;
  },

  remove(toast) {
    if (!toast || !toast.parentNode) return;
    toast.classList.add('removing');
    setTimeout(() => {
      if (toast.parentNode) {
        toast.parentNode.removeChild(toast);
      }
    }, 300);
  },

  success(title, message) {
    return this.show({ type: 'success', title, message });
  },

  error(title, message) {
    return this.show({ type: 'error', title, message });
  },

  warning(title, message) {
    return this.show({ type: 'warning', title, message });
  },

  info(title, message) {
    return this.show({ type: 'info', title, message });
  }
};

// Initialize toast on load
document.addEventListener('DOMContentLoaded', () => Toast.init());

/* --------------------------------------------------------------------------
   Export for module usage (if needed)
   -------------------------------------------------------------------------- */
if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    Avatar,
    StatusDot,
    TimeAgo,
    FormatUptime,
    SkeletonCard,
    ErrorState,
    Toast
  };
}
