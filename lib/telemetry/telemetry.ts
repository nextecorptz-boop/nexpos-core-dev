import { db } from '@/lib/sync/db';

export type LogLevel = 'info' | 'warn' | 'error' | 'critical';
export type LogCategory = 'sync' | 'db' | 'network' | 'performance' | 'security';

const MAX_LOCAL_LOGS = 1000;

export class Telemetry {
  /**
   * Log a structured telemetry event locally
   */
  static async log(
    level: LogLevel,
    category: LogCategory,
    message: string,
    details?: any
  ): Promise<void> {
    if (typeof window === 'undefined') {
      console.log(`[Telemetry Server] [${level.toUpperCase()}] [${category.toUpperCase()}] ${message}`, details);
      return;
    }

    const timestamp = new Date().toISOString();
    const id = `${category}-${Date.now()}-${crypto.randomUUID()}`;

    // Structure log
    const logEntry = {
      id,
      timestamp,
      level,
      category,
      message,
      details: details ? JSON.parse(JSON.stringify(details)) : null,
    };

    try {
      // Safely check if db is open and telemetry_logs table exists
      if (db && db.isOpen() && db.telemetry_logs) {
        await db.telemetry_logs.put(logEntry);
        
        // Asynchronously prune older logs to prevent storage bloating
        this.pruneLogsAsync();
      } else {
        console.log(`[Telemetry Fallback] [${level.toUpperCase()}] [${category.toUpperCase()}] ${message}`, details);
      }
    } catch (err) {
      console.warn('Telemetry write failed:', err);
    }
  }

  static async info(category: LogCategory, message: string, details?: any): Promise<void> {
    await this.log('info', category, message, details);
  }

  static async warn(category: LogCategory, message: string, details?: any): Promise<void> {
    await this.log('warn', category, message, details);
  }

  static async error(category: LogCategory, message: string, details?: any): Promise<void> {
    await this.log('error', category, message, details);
  }

  static async critical(category: LogCategory, message: string, details?: any): Promise<void> {
    await this.log('critical', category, message, details);
  }

  /**
   * Track latency of network API calls and alert on high latency
   */
  static async trackApiLatency(url: string, durationMs: number): Promise<void> {
    const isSlow = durationMs > 1500; // SLA SLA threshold
    const level = isSlow ? 'warn' : 'info';
    const message = `API Request to ${url} completed in ${durationMs}ms${isSlow ? ' (SLOW)' : ''}`;
    
    await this.log(level, 'performance', message, { url, durationMs });
  }

  /**
   * Track client database hydration times and document load speeds
   */
  static async trackHydration(branchId: string, durationMs: number, variantsCount: number): Promise<void> {
    await this.log('info', 'performance', `IndexedDB catalog hydration completed in ${durationMs}ms`, {
      branchId,
      durationMs,
      variantsCount
    });
  }

  /**
   * Track database corruption, transaction rollbacks, or upgrade problems
   */
  static async trackDbCorruption(error: any): Promise<void> {
    const errorDetails = {
      name: error?.name || 'UnknownError',
      message: error?.message || String(error),
      stack: error?.stack || null
    };

    await this.log('critical', 'db', `IndexedDB Corruption/Unrecoverable Error detected: ${errorDetails.message}`, errorDetails);
  }

  /**
   * Track mutations synced and error ratios
   */
  static async trackSyncStats(successCount: number, errorCount: number, timeTakenMs: number): Promise<void> {
    const ratio = successCount + errorCount > 0 ? (successCount / (successCount + errorCount)) * 100 : 100;
    const level = ratio < 80 ? 'error' : ratio < 95 ? 'warn' : 'info';
    
    await this.log(level, 'sync', `Sync queue replay session finished: ${successCount} succeeded, ${errorCount} failed (${ratio.toFixed(1)}% success)`, {
      successCount,
      errorCount,
      ratio,
      timeTakenMs
    });
  }

  /**
   * Track projection rebuild duration and execution modes
   */
  static async trackProjectionRebuild(durationMs: number, mode: 'fast' | 'full' | 'audit', success: boolean, details?: any): Promise<void> {
    const level = success ? 'info' : 'error';
    const message = `Projection Rebuild [${mode.toUpperCase()}] finished in ${durationMs.toFixed(1)}ms. Success = ${success}`;
    await this.log(level, 'performance', message, { durationMs, mode, success, ...details });
  }

  /**
   * Track version conflicts, replay suppressions, and out-of-order quarantine escalations
   */
  static async trackConflict(eventType: string, aggregateId: string, action: 'suppress' | 'quarantine', reason: string): Promise<void> {
    const level = action === 'quarantine' ? 'error' : 'warn';
    const message = `Version Conflict on ${eventType} (Aggregate: ${aggregateId}): Action = ${action.toUpperCase()}. Reason: ${reason}`;
    await this.log(level, 'sync', message, { eventType, aggregateId, action, reason });
  }

  /**
   * Track telemetry warnings when ledger validation scans detect drift
   */
  static async trackRebuildDrift(driftCount: number, details?: string): Promise<void> {
    await this.log('error', 'security', `Ledger Audit drift detected: ${driftCount} variants out of sync with event ledger histories.`, {
      driftCount,
      details
    });
  }

  /**
   * Track trust enrollment success or failure
   */
  static async trackEnrollment(deviceId: string, success: boolean, reason?: string): Promise<void> {
    const level = success ? 'info' : 'error';
    const message = `Device trust enrollment ${success ? 'SUCCEEDED' : 'FAILED'}${reason ? `: ${reason}` : ''}`;
    await this.log(level, 'security', message, { deviceId, success, reason });
  }

  /**
   * Track key rotations
   */
  static async trackKeyRotation(deviceId: string, success: boolean, details?: any): Promise<void> {
    const level = success ? 'info' : 'error';
    const message = `Device cryptographic key rotation ${success ? 'SUCCEEDED' : 'FAILED'}`;
    await this.log(level, 'security', message, { deviceId, success, ...details });
  }

  /**
   * Track signature verification failures
   */
  static async trackSignatureFailure(deviceId: string, eventId: string, reason: string): Promise<void> {
    const message = `Cryptographic signature verification FAILED for device ${deviceId} on event ${eventId}: ${reason}`;
    await this.log('critical', 'security', message, { deviceId, eventId, reason });
  }

  /**
   * Track replay attack attempts
   */
  static async trackReplayAttempt(deviceId: string, eventId: string, nonce: number, lastNonce: number): Promise<void> {
    const message = `REPLAY ATTACK BLOCKED: Nonce reuse detected for device ${deviceId}. Event = ${eventId}, Nonce = ${nonce}, LastNonce = ${lastNonce}`;
    await this.log('critical', 'security', message, { deviceId, eventId, nonce, lastNonce });
  }

  /**
   * Track certificate expiration warnings/failures
   */
  static async trackCertificateExpiration(deviceId: string, expiresAt: string, daysLeft: number): Promise<void> {
    const isExpired = daysLeft <= 0;
    const level = isExpired ? 'error' : 'warn';
    const message = `Device certificate ${isExpired ? 'EXPIRED' : 'EXPIRES SOON'} (Expires: ${expiresAt}, ${daysLeft.toFixed(0)} days remaining)`;
    await this.log(level, 'security', message, { deviceId, expiresAt, daysLeft });
  }

  /**
   * Track mesh coordination leader election
   */
  static async trackMeshElection(deviceId: string, term: number, success: boolean): Promise<void> {
    const level = success ? 'info' : 'warn';
    const message = `Mesh Leader Election [Term ${term}]: ${success ? 'SUCCEEDED' : 'FAILED'} for device ${deviceId}`;
    await this.log(level, 'sync', message, { deviceId, term, success });
  }

  /**
   * Track mesh failover incidents
   */
  static async trackMeshFailover(oldLeaderId: string, newLeaderId: string, term: number): Promise<void> {
    const message = `Mesh Failover Detected: New Leader ${newLeaderId} elected (Term ${term}) replacing ${oldLeaderId}`;
    await this.log('warn', 'sync', message, { oldLeaderId, newLeaderId, term });
  }

  /**
   * Track mesh heartbeats and peer visibility
   */
  static async trackMeshHeartbeat(peerCount: number, leaderId: string, term: number): Promise<void> {
    await this.log('info', 'sync', `Mesh Heartbeat: ${peerCount} peers visible. Leader: ${leaderId} (Term ${term})`, {
      peerCount,
      leaderId,
      term
    });
  }

  /**
   * Track split-brain occurrences in the local mesh
   */
  static async trackMeshSplitBrain(competitorId: string, term: number): Promise<void> {
    const message = `MESH SPLIT-BRAIN DETECTED: Multiple leaders for term ${term}. Competitor: ${competitorId}`;
    await this.log('critical', 'sync', message, { competitorId, term });
  }

  /**
   * Track translation mismatches
   */
  static async trackTranslationMismatch(key: string, language: string): Promise<void> {
    const message = `Translation mismatch: key "${key}" not found in language "${language}"`;
    await this.log('warn', 'performance', message, { key, language });
  }

  /**
   * Track language configuration changes
   */
  static async trackLanguageChange(deviceId: string, prevLanguage: string, newLanguage: string): Promise<void> {
    const message = `User changed display language from "${prevLanguage}" to "${newLanguage}"`;
    await this.log('info', 'sync', message, { deviceId, prevLanguage, newLanguage });
  }

  /**
   * Asynchronously prune local telemetry log database to maintain memory constraints
   */
  private static async pruneLogsAsync(): Promise<void> {
    try {
      const count = await db.telemetry_logs.count();
      if (count > MAX_LOCAL_LOGS) {
        // Find the boundary timestamp to clear older records
        const logs = await db.telemetry_logs.orderBy('timestamp').limit(count - MAX_LOCAL_LOGS).toArray();
        if (logs.length > 0) {
          const ids = logs.map(l => l.id);
          await db.telemetry_logs.bulkDelete(ids);
        }
      }
    } catch (err) {
      console.warn('Pruning telemetry logs failed:', err);
    }
  }
}
