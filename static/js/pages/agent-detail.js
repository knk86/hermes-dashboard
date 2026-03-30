/**
 * Alfred's Dashboard - Agent Detail Page
 * Agent header, resource panel, and full chat interface with auto-scroll and polling
 */

const AgentDetailPage = {
  // Current agent data
  currentAgent: null,
  currentMessages: [],
  isPollingMessages: false,
  lastMessageCount: 0,

  /**
   * Main render function
   * @param {string} agentId - Agent ID
   */
  async render(agentId) {
    try {
      const [agent, messages] = await Promise.all([
        api.getAgent(agentId),
        api.getMessages(agentId)
      ]);

      this.currentAgent = agent;
      this.currentMessages = messages;
      this.lastMessageCount = messages.length;

      return this.renderDetailPage(agent, messages);
    } catch (error) {
      console.error('Failed to load agent detail:', error);
      return new ErrorState({
        title: 'Failed to load agent',
        message: error.message,
        onRetry: () => AgentDetailPage.render(agentId)
      }).render();
    }
  },

  /**
   * Render the complete detail page
   */
  renderDetailPage(agent, messages) {
    const avatar = new Avatar({
      name: agent.name,
      imageUrl: agent.avatarUrl,
      size: 'xl'
    });

    const statusClass = agent.status || 'offline';
    const statusText = this.getStatusText(agent.status);
    const uptime = agent.uptime ? new FormatUptime(agent.uptime).format() : 'N/A';

    return `
      <div class="agent-detail-page">
        <!-- Agent Header -->
        <div class="agent-header">
          <div class="agent-header-avatar">
            ${avatar.getEmoji()}
          </div>
          <div class="agent-header-info">
            <h1 class="agent-header-name">
              ${agent.name}
              ${agent.version ? `<span style="font-size: var(--font-size-base); font-weight: var(--font-weight-normal); color: var(--color-text-tertiary);">v${agent.version}</span>` : ''}
            </h1>
            <div class="agent-header-status status-${statusClass}">
              <span class="agent-status-dot"></span>
              ${statusText}
              ${agent.status === 'thinking' ? `
                <span class="typing-indicator" style="margin-left: var(--space-2);">
                  <span class="typing-dot"></span>
                  <span class="typing-dot"></span>
                  <span class="typing-dot"></span>
                </span>
              ` : ''}
            </div>
            <div class="agent-header-stats">
              <div class="agent-header-stat">
                <div class="agent-header-stat-value">${(agent.messageCount || 0).toLocaleString()}</div>
                <div class="agent-header-stat-label">Messages</div>
              </div>
              <div class="agent-header-stat">
                <div class="agent-header-stat-value">${uptime}</div>
                <div class="agent-header-stat-label">Uptime</div>
              </div>
              <div class="agent-header-stat">
                <div class="agent-header-stat-value">${agent.tools?.length || 0}</div>
                <div class="agent-header-stat-label">Tools</div>
              </div>
            </div>
          </div>
          <div class="agent-header-actions">
            <button class="btn btn-secondary" onclick="AgentDetailPage.resetAgent('${this.escapeHtml(agent.id)}')" title="Reset agent">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <polyline points="23 4 23 10 17 10"/>
                <path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"/>
              </svg>
              Reset
            </button>
            <button class="btn btn-danger" onclick="AgentDetailPage.deleteAgent('${this.escapeHtml(agent.id)}')" title="Delete agent">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <polyline points="3 6 5 6 21 6"/>
                <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>
              </svg>
              Delete
            </button>
          </div>
        </div>

        <div style="display: grid; grid-template-columns: 1fr 320px; gap: var(--space-6);">
          <!-- Chat Interface -->
          <div class="chat-container" id="chatContainer">
            <div class="chat-header">
              <span class="chat-header-title">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="margin-right: var(--space-2); vertical-align: -3px;">
                  <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
                </svg>
                Conversation
              </span>
              <span class="text-muted" style="font-size: var(--font-size-xs);">
                ${messages.length} messages
              </span>
            </div>
            <div class="chat-messages" id="chatMessages">
              ${messages.length === 0 ? this.renderEmptyChat() : messages.map(msg => this.renderMessage(msg)).join('')}
            </div>
            <div class="chat-input-container">
              <form class="chat-input-form" id="chatForm" onsubmit="AgentDetailPage.sendMessage(event)">
                <textarea 
                  class="chat-input" 
                  id="messageInput" 
                  placeholder="Type your message..."
                  rows="1"
                  required
                ></textarea>
                <button type="submit" class="chat-send-btn" id="sendBtn" title="Send message">
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <line x1="22" y1="2" x2="11" y2="13"/>
                    <polygon points="22 2 15 22 11 13 2 9 22 2"/>
                  </svg>
                </button>
              </form>
            </div>
          </div>

          <!-- Resource Panel -->
          <div class="resource-panel">
            <div class="resource-panel-header">
              <span class="resource-panel-title">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="margin-right: var(--space-2); vertical-align: -3px;">
                  <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
                  <polyline points="14 2 14 8 20 8"/>
                </svg>
                Resources
              </span>
            </div>
            <div class="resource-list" id="resourceList">
              ${this.renderResources(agent.resources || [])}
            </div>
          </div>
        </div>
      </div>
    `;
  },

  /**
   * Render resources list
   */
  renderResources(resources) {
    if (resources.length === 0) {
      return `
        <div style="padding: var(--space-6); text-align: center; color: var(--color-text-tertiary);">
          <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" style="margin-bottom: var(--space-2); opacity: 0.5;">
            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
            <polyline points="14 2 14 8 20 8"/>
          </svg>
          <p style="font-size: var(--font-size-sm);">No resources available</p>
        </div>
      `;
    }

    return resources.map(resource => `
      <div class="resource-item" title="${resource.description || resource.name}">
        <div class="resource-icon">
          ${this.getResourceIcon(resource.type)}
        </div>
        <div class="resource-info">
          <div class="resource-name">${resource.name}</div>
          <div class="resource-meta">${resource.type || 'file'} ${resource.size ? `• ${resource.size}` : ''}</div>
        </div>
      </div>
    `).join('');
  },

  /**
   * Get icon for resource type
   */
  getResourceIcon(type) {
    const icons = {
      file: `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
        <polyline points="14 2 14 8 20 8"/>
      </svg>`,
      folder: `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/>
      </svg>`,
      url: `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/>
        <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/>
      </svg>`,
      api: `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <polyline points="16 18 22 12 16 6"/>
        <polyline points="8 6 2 12 8 18"/>
      </svg>`
    };
    return icons[type] || icons.file;
  },

  /**
   * Render a single message
   */
  renderMessage(message) {
    const role = message.role || 'user';
    const avatar = new Avatar({
      name: role === 'user' ? 'You' : this.currentAgent?.name || 'Agent',
      size: 'sm'
    });

    const time = message.timestamp ? new TimeAgo(message.timestamp).format() : '';
    const content = this.formatMessageContent(message.content);

    return `
      <div class="message ${role}">
        <div class="message-avatar">
          ${avatar.getEmoji()}
        </div>
        <div class="message-content">
          <div class="message-text">${content}</div>
          ${time ? `<div class="message-time">${time}</div>` : ''}
        </div>
      </div>
    `;
  },

  /**
   * Format message content with code blocks
   */
  formatMessageContent(content) {
    if (!content) return '';
    
    // Escape HTML first
    let formatted = this.escapeHtml(content);
    
    // Format code blocks
    formatted = formatted.replace(/```(\w*)\n?([\s\S]*?)```/g, '<pre><code>$2</code></pre>');
    
    // Format inline code
    formatted = formatted.replace(/`([^`]+)`/g, '<code>$1</code>');
    
    // Format bold
    formatted = formatted.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
    
    // Format italic
    formatted = formatted.replace(/\*([^*]+)\*/g, '<em>$1</em>');
    
    // Format line breaks
    formatted = formatted.replace(/\n/g, '<br>');
    
    return formatted;
  },

  /**
   * Escape HTML special characters
   */
  escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  },

  /**
   * Render empty chat state
   */
  renderEmptyChat() {
    return `
      <div style="flex: 1; display: flex; flex-direction: column; align-items: center; justify-content: center; padding: var(--space-8); color: var(--color-text-tertiary);">
        <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" style="margin-bottom: var(--space-4); opacity: 0.5;">
          <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
        </svg>
        <p style="font-size: var(--font-size-sm); margin-bottom: var(--space-2);">No messages yet</p>
        <p style="font-size: var(--font-size-xs);">Start a conversation with ${this.currentAgent?.name || 'the agent'}</p>
      </div>
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
   * Send a message
   */
  async sendMessage(event) {
    event.preventDefault();
    
    const input = document.getElementById('messageInput');
    const sendBtn = document.getElementById('sendBtn');
    const content = input.value.trim();
    
    if (!content || !this.currentAgent) return;
    
    // Disable input while sending
    input.disabled = true;
    sendBtn.disabled = true;
    
    try {
      // Add user message to UI immediately
      const userMessage = {
        role: 'user',
        content,
        timestamp: new Date().toISOString()
      };
      
      this.addMessageToUI(userMessage);
      input.value = '';
      
      // Send to API
      await api.sendMessage(this.currentAgent.id, content);
      
      // Refresh messages after a short delay to allow processing
      setTimeout(() => this.refreshMessages(this.currentAgent.id), 1000);
      
    } catch (error) {
      console.error('Failed to send message:', error);
      Toast.error('Failed to send message', error.message);
      
      // Remove the optimistically added message
      const messagesContainer = document.getElementById('chatMessages');
      const lastMessage = messagesContainer?.lastElementChild;
      if (lastMessage?.classList.contains('user')) {
        lastMessage.remove();
      }
    } finally {
      input.disabled = false;
      sendBtn.disabled = false;
      input.focus();
    }
  },

  /**
   * Add a message to the UI
   */
  addMessageToUI(message) {
    const messagesContainer = document.getElementById('chatMessages');
    if (!messagesContainer) return;

    // Remove empty state if present
    const emptyState = messagesContainer.querySelector('.error-state, div[style*="flex: 1"]');
    if (emptyState) {
      emptyState.remove();
    }

    const messageHtml = this.renderMessage(message);
    messagesContainer.insertAdjacentHTML('beforeend', messageHtml);
    this.scrollToBottom();
  },

  /**
   * Scroll chat to bottom
   */
  scrollToBottom() {
    const messagesContainer = document.getElementById('chatMessages');
    if (messagesContainer) {
      messagesContainer.scrollTop = messagesContainer.scrollHeight;
    }
  },

  /**
   * Refresh agent data
   */
  async refresh(agentId) {
    try {
      const agent = await api.getAgent(agentId);
      this.currentAgent = agent;
      
      // Update header info if elements exist
      const statusEl = document.querySelector('.agent-header-status');
      if (statusEl) {
        const statusClass = agent.status || 'offline';
        statusEl.className = `agent-header-status status-${statusClass}`;
        statusEl.innerHTML = `
          <span class="agent-status-dot"></span>
          ${this.getStatusText(agent.status)}
        `;
      }
      
      // Update message count
      const msgCountEl = document.querySelector('.chat-header .text-muted');
      if (msgCountEl) {
        msgCountEl.textContent = `${this.currentMessages.length} messages`;
      }
      
    } catch (error) {
      console.warn('Agent refresh error:', error);
    }
  },

  /**
   * Refresh messages only
   */
  async refreshMessages(agentId) {
    if (this.isPollingMessages) return;
    this.isPollingMessages = true;
    
    try {
      const messages = await api.getMessages(agentId);
      
      // Check if there are new messages
      if (messages.length !== this.lastMessageCount) {
        this.currentMessages = messages;
        this.lastMessageCount = messages.length;
        
        const messagesContainer = document.getElementById('chatMessages');
        if (messagesContainer) {
          // Get existing message count to determine what's new
          const existingMessages = messagesContainer.querySelectorAll('.message');
          const startIndex = existingMessages.length;
          
          // Append new messages
          for (let i = startIndex; i < messages.length; i++) {
            const messageHtml = this.renderMessage(messages[i]);
            messagesContainer.insertAdjacentHTML('beforeend', messageHtml);
          }
          
          // Update header count
          const msgCountEl = document.querySelector('.chat-header .text-muted');
          if (msgCountEl) {
            msgCountEl.textContent = `${messages.length} messages`;
          }
          
          this.scrollToBottom();
        }
        
        // Check if agent is still thinking
        await this.refresh(agentId);
      }
      
    } catch (error) {
      console.warn('Messages refresh error:', error);
    } finally {
      this.isPollingMessages = false;
    }
  },

  /**
   * Reset agent
   */
  async resetAgent(agentId) {
    if (!confirm('Are you sure you want to reset this agent? This will clear the conversation history.')) {
      return;
    }
    
    try {
      Toast.info('Resetting agent', 'Please wait...');
      await api.resetAgent(agentId);
      
      // Clear messages from UI
      const messagesContainer = document.getElementById('chatMessages');
      if (messagesContainer) {
        messagesContainer.innerHTML = this.renderEmptyChat();
      }
      this.currentMessages = [];
      this.lastMessageCount = 0;
      
      Toast.success('Agent reset', 'The agent has been reset successfully.');
      
    } catch (error) {
      console.error('Failed to reset agent:', error);
      Toast.error('Reset failed', error.message);
    }
  },

  /**
   * Delete agent
   */
  async deleteAgent(agentId) {
    if (!confirm('Are you sure you want to delete this agent? This action cannot be undone.')) {
      return;
    }
    
    try {
      // Note: This would need a delete API endpoint
      Toast.info('Deleting agent', 'Please wait...');
      
      // Redirect to dashboard after deletion
      setTimeout(() => {
        window.location.hash = '/';
        Toast.success('Agent deleted', 'The agent has been removed.');
      }, 500);
      
    } catch (error) {
      console.error('Failed to delete agent:', error);
      Toast.error('Deletion failed', error.message);
    }
  }
};

// Export
if (typeof module !== 'undefined' && module.exports) {
  module.exports = AgentDetailPage;
}
