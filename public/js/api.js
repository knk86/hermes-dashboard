/**
 * Hermes Dashboard API Client
 * Clean fetch-based API client for interacting with the backend
 */

const api = {
  baseUrl: '/api',

  /**
   * Make a fetch request with error handling
   * @param {string} endpoint - API endpoint (will be appended to baseUrl)
   * @param {Object} options - Fetch options
   * @returns {Promise<any>} Parsed JSON response
   */
  async request(endpoint, options = {}) {
    const url = `${this.baseUrl}${endpoint}`;
    
    const defaultHeaders = {
      'Content-Type': 'application/json',
    };

    const config = {
      ...options,
      headers: {
        ...defaultHeaders,
        ...options.headers,
      },
    };

    try {
      const response = await fetch(url, config);
      
      if (!response.ok) {
        let errorMessage = `HTTP error! status: ${response.status}`;
        try {
          const errorData = await response.json();
          if (errorData.message) {
            errorMessage = errorData.message;
          } else if (errorData.error) {
            errorMessage = errorData.error;
          }
        } catch (e) {
          // If parsing error response fails, use default message
        }
        throw new Error(errorMessage);
      }

      // Handle empty responses
      const contentType = response.headers.get('content-type');
      if (contentType && contentType.includes('application/json')) {
        return await response.json();
      }
      return await response.text();
    } catch (error) {
      if (error instanceof TypeError && error.message.includes('fetch')) {
        throw new Error('Network error: Unable to connect to the server');
      }
      throw error;
    }
  },

  /**
   * Get all agents
   * @returns {Promise<Array>} List of agents
   */
  async getAgents() {
    const data = await this.request('/agents');
    // API returns {agents: [...], count: N} — return just the array
    return data.agents || [];
  },

  /**
   * Get a single agent by ID
   * @param {string|number} id - Agent ID
   * @returns {Promise<Object>} Agent data
   */
  async getAgent(id) {
    return this.request(`/agents/${encodeURIComponent(id)}`);
  },

  /**
   * Get messages for an agent
   * @param {string|number} agentId - Agent ID
   * @returns {Promise<Array>} List of messages
   */
  async getMessages(agentId) {
    const data = await this.request(`/agents/${encodeURIComponent(agentId)}/messages`);
    // API returns {messages: [...], count: N} — return just the array
    return data.messages || [];
  },

  /**
   * Send a message to an agent — calls /chat which invokes the real Hermes agent
   * and stores both user + assistant messages in the DB.
   * @param {string|number} agentId - Agent ID
   * @param {string} content - Message content
   * @returns {Promise<Object>} { userMessage, assistantMessage }
   */
  async sendMessage(agentId, content) {
    // POST to /chat (not /messages) — this calls the real Hermes agent
    return this.request(`/agents/${encodeURIComponent(agentId)}/chat`, {
      method: 'POST',
      body: JSON.stringify({ message: content }),
    });
  },

  /**
   * Get resources for an agent
   * @param {string|number} agentId - Agent ID
   * @returns {Promise<Array>} List of resources
   */
  async getResources(agentId) {
    return this.request(`/agents/${encodeURIComponent(agentId)}/resources`);
  },

  /**
   * Update global settings
   * @param {Object} settings - Settings object
   * @returns {Promise<Object>} Updated settings
   */
  async updateSettings(settings) {
    return this.request('/settings', {
      method: 'PUT',
      body: JSON.stringify(settings),
    });
  },

  /**
   * Reset an agent
   * @param {string|number} agentId - Agent ID
   * @returns {Promise<Object>} Reset result
   */
  async resetAgent(agentId) {
    return this.request(`/agents/${encodeURIComponent(agentId)}/reset`, {
      method: 'POST',
    });
  },
};

// Export for module systems
if (typeof module !== 'undefined' && module.exports) {
  module.exports = api;
}
