import fetch from "node-fetch";

class RateLimiter {
  constructor(maxPerMinute = 50) {
    this.maxPerMinute = maxPerMinute;
    this.queue = [];
    this.timestamps = [];
  }

  async acquire() {
    this._prune();
    if (this.timestamps.length >= this.maxPerMinute) {
      const wait = this.timestamps[0] + 60000 - Date.now();
      if (wait > 0) {
        await new Promise((r) => setTimeout(r, wait));
      }
    }
    this.timestamps.push(Date.now());
  }

  _prune() {
    const cutoff = Date.now() - 60000;
    this.timestamps = this.timestamps.filter((t) => t > cutoff);
  }
}

class FreshdeskService {
  constructor() {
    this.domain = process.env.FRESHDESK_DOMAIN;
    this.apiKey = process.env.FRESHDESK_API_KEY;
    this.baseUrl = `https://${this.domain}/api/v2`;
    this.auth = Buffer.from(`${this.apiKey}:X`).toString("base64");
    this.rateLimiter = new RateLimiter(45);
  }

  authHeader() {
    return `Basic ${this.auth}`;
  }

  async request(endpoint, options = {}) {
    await this.rateLimiter.acquire();
    const url = `${this.baseUrl}${endpoint}`;
    const response = await fetch(url, {
      ...options,
      headers: {
        Authorization: `Basic ${this.auth}`,
        "Content-Type": "application/json",
        ...options.headers,
      },
    });

    if (response.status === 429) {
      const retryAfter = parseInt(response.headers.get("retry-after") || "60", 10);
      console.warn(`[rate-limit] 429, waiting ${retryAfter}s`);
      await new Promise((r) => setTimeout(r, retryAfter * 1000));
      return this.request(endpoint, options);
    }

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Freshdesk API error ${response.status}: ${error}`);
    }

    return response.json();
  }

  async getTickets(page = 1, perPage = 100) {
    const tickets = await this.request(
      `/tickets?page=${page}&per_page=${perPage}&order_by=created_at&order_type=desc`
    );
    return tickets;
  }

  async getRecentTickets(since) {
    const tickets = await this.request(
      `/tickets?order_by=updated_at&order_type=desc&per_page=50&updated_since=${since.toISOString()}`
    );
    return tickets;
  }

  async getTicket(ticketId) {
    return this.request(`/tickets/${ticketId}`);
  }

  async getConversations(ticketId) {
    return this.request(`/tickets/${ticketId}/conversations`);
  }

  async getActivities(ticketId) {
    return this.request(`/tickets/${ticketId}/activities`);
  }

  async searchTickets(query) {
    const encoded = encodeURIComponent(`"${query}"`);
    return this.request(`/search/tickets?query=${encoded}`);
  }

  async getContact(contactId) {
    return this.request(`/contacts/${contactId}`);
  }

  async getGroups() {
    let page = 1;
    let all = [];
    while (true) {
      const groups = await this.request(`/groups?page=${page}&per_page=100`);
      if (groups.length === 0) break;
      all = all.concat(groups);
      page++;
    }
    return all;
  }

  async *iterateTickets({ startDate, endDate } = {}) {
    let page = 1;
    let hasMore = true;

    while (hasMore) {
      const tickets = await this.getTickets(page);

      if (tickets.length === 0) {
        hasMore = false;
        break;
      }

      const filtered = tickets.filter((t) => {
        const created = new Date(t.created_at);
        if (startDate && created < new Date(startDate)) return false;
        if (endDate && created > new Date(endDate)) return false;
        return true;
      });

      if (filtered.length > 0) {
        yield filtered;
      }

      page++;
      if (tickets.length < 100) {
        hasMore = false;
      }
    }
  }
}

export default new FreshdeskService();
