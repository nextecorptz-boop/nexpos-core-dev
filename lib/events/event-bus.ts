
export type EventType = 
  | 'sale.completed' 
  | 'inventory.updated' 
  | 'purchase.received' 
  | 'repayment.logged' 
  | 'till.closed' 
  | 'expense.created'

type EventCallback<T = any> = (payload: T) => void

class EventBus {
  private listeners: Record<string, EventCallback[]> = {}

  // Subscribe to an event
  subscribe<T = any>(event: EventType, callback: EventCallback<T>): () => void {
    if (!this.listeners[event]) {
      this.listeners[event] = []
    }
    this.listeners[event].push(callback)

    // Return unsubscribe function
    return () => {
      this.listeners[event] = this.listeners[event].filter(cb => cb !== callback)
    }
  }

  // Publish/Emit an event
  publish<T = any>(event: EventType, payload?: T) {
    if (this.listeners[event]) {
      this.listeners[event].forEach(callback => {
        try {
          callback(payload)
        } catch (e) {
          console.error(`Error in event callback for ${event}:`, e)
        }
      })
    }

    // Also dispatch as custom window event for broader browser compatibility
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('nx-event-bus', {
        detail: { event, payload }
      }))
    }
  }
}

export const eventBus = new EventBus()
export default eventBus
