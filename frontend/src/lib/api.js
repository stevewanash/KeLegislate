const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:8000/api';

async function fetchJson(endpoint, options = {}) {
  const url = `${API_BASE_URL}${endpoint}`;
  
  // Set JSON headers
  const headers = {
    'Content-Type': 'application/json',
    ...(options.headers || {}),
  };

  const response = await fetch(url, {
    ...options,
    headers,
  });

  if (!response.ok) {
    let errorMessage = `HTTP error! Status: ${response.status}`;
    try {
      const errorData = await response.json();
      errorMessage = errorData.detail || errorMessage;
    } catch (e) {
      // Ignore json parsing error for non-json error pages
    }
    throw new Error(errorMessage);
  }

  // Handle empty responses
  if (response.status === 204) {
    return null;
  }

  return response.json();
}

export const api = {
  // Bills API
  async getBills(page = 1, limit = 20, industry = null) {
    let query = `?page=${page}&limit=${limit}&ai_status=all`;
    if (industry) query += `&industry=${encodeURIComponent(industry)}`;
    return fetchJson(`/bills${query}`);
  },

  async getBill(id) {
    return fetchJson(`/bills/${id}`);
  },

  // Pre-generated Impact Scenario API (v1.3)
  async getImpact(billId) {
    return fetchJson(`/impact/${billId}`);
  },

  // Legacy calculateImpact fallback
  async calculateImpact(billId, industry = 'ALL', tier = 'ALL', useCustomProfile = false, token = null) {
    return fetchJson(`/impact/${billId}`);
  },


  // Feedback API (Auth Required)
  async submitFeedback(billId, support, rating, concerns = null, token) {
    return fetchJson('/feedback', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        bill_id: billId,
        support,
        rating,
        concerns,
      }),
    });
  },

  // Subscription API
  async subscribe(phone, industries, language = 'en', channels = ['sms'], token = null) {
    const headers = token ? { Authorization: `Bearer ${token}` } : {};
    return fetchJson('/subscribe', {
      method: 'POST',
      headers,
      body: JSON.stringify({
        phone,
        industries,
        language,
        channels,
      }),
    });
  },

  async unsubscribe(token) {
    return fetchJson('/subscribe', {
      method: 'DELETE',
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });
  },

  async getSubscriptionStatus(token) {
    return fetchJson('/subscribe/status', {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });
  },

  // Custom User Profile API (Auth Required)
  async saveProfile(industry, tierLabel = null, customMetrics = {}, token) {
    return fetchJson('/profile', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        industry,
        tier_label: tierLabel,
        custom_metrics: customMetrics,
      }),
    });
  },

  async getProfile(token) {
    return fetchJson('/profile', {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });
  },

  async deleteProfile(token) {
    return fetchJson('/profile', {
      method: 'DELETE',
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });
  },

  // Dashboard API
  async getDashboardStats(billId = null) {
    const query = billId ? `?bill_id=${billId}` : '';
    return fetchJson(`/dashboard/stats${query}`);
  },
};
