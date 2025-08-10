class SessionRequestBlocker {
  private static instance: SessionRequestBlocker
  private pendingRequest: Promise<any> | null = null
  private lastResponse: any = null
  private lastFetchTime: number = 0
  private readonly CACHE_DURATION = 30000 // 30 seconds

  static getInstance() {
    if (!SessionRequestBlocker.instance) {
      SessionRequestBlocker.instance = new SessionRequestBlocker()
    }
    return SessionRequestBlocker.instance
  }

  async getSession(): Promise<any> {
    const now = Date.now()
    
    // Return cached response if still valid
    if (this.lastResponse && (now - this.lastFetchTime) < this.CACHE_DURATION) {
      console.log('🔄 Returning cached session')
      return this.lastResponse
    }

    // If there's already a pending request, wait for it
    if (this.pendingRequest) {
      console.log('⏳ Waiting for pending session request')
      return await this.pendingRequest
    }

    // Create new request
    console.log('🆕 Creating new session request')
    this.pendingRequest = this.fetchSession()
    
    try {
      const result = await this.pendingRequest
      this.lastResponse = result
      this.lastFetchTime = now
      return result
    } finally {
      this.pendingRequest = null
    }
  }

  private async fetchSession(): Promise<any> {
    const response = await fetch('/api/auth/get-session')
    return await response.json()
  }
}

export const sessionBlocker = SessionRequestBlocker.getInstance()