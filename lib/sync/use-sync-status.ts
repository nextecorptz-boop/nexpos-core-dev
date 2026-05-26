'use client'

import { useState, useEffect } from 'react'
import { processSyncQueue, ensureOnlineSyncListener } from './sync-engine'
import { db, type QueueItem } from './db'

export function useSyncStatus() {
  const [isOnline, setIsOnline] = useState(true)
  const [queue, setQueue] = useState<QueueItem[]>([])
  const [lastSynced, setLastSynced] = useState<string | null>(null)

  const refreshQueue = async () => {
    try {
      const q1 = await db.queue_tier_1.toArray()
      const q2 = await db.queue_tier_2.toArray()
      const q3 = await db.queue_tier_3.toArray()
      const fullQueue = [...q1, ...q2, ...q3]
      setQueue(fullQueue)
      if (fullQueue.length === 0) {
        setLastSynced(new Date().toISOString())
      }
    } catch (e) {
      console.error('Failed to read sync status from Dexie', e)
    }
  }

  useEffect(() => {
    if (typeof window === 'undefined') return

    // Initialize network state
    setIsOnline(navigator.onLine)
    refreshQueue()
    ensureOnlineSyncListener()

    // Network status change listeners
    const handleOnline = () => {
      setIsOnline(true)
      processSyncQueue()
    }
    const handleOffline = () => {
      setIsOnline(false)
    }

    // Listener for queue updates triggered by the sync-engine
    const handleQueueChange = () => {
      refreshQueue()
    }

    window.addEventListener('online', handleOnline)
    window.addEventListener('offline', handleOffline)
    window.addEventListener('nx-sync-queue-updated', handleQueueChange)

    return () => {
      window.removeEventListener('online', handleOnline)
      window.removeEventListener('offline', handleOffline)
      window.removeEventListener('nx-sync-queue-updated', handleQueueChange)
    }
  }, [])

  const pendingCount = queue.filter(item => item.status === 'pending').length
  const failedCount = queue.filter(item => item.status === 'failed').length

  return {
    isOnline,
    pendingCount,
    failedCount,
    queue,
    lastSynced,
    triggerSync: processSyncQueue
  }
}
export type { QueueItem }
