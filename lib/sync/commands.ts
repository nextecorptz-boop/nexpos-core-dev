import { db } from './db';
import { Telemetry } from '../telemetry/telemetry';

export interface CommandResult {
  success: boolean;
  error?: string;
  events?: any[];
}

export interface DomainEvent {
  id: string;
  tenant_id: string;
  branch_id?: string;
  aggregate_type: string;
  aggregate_id: string;
  event_type: string;
  event_version: number;
  schema_version: number;
  payload: any;
  metadata?: any;
  actor_id?: string;
  correlation_id?: string;
  causation_id?: string;
  device_id?: string;
  idempotency_key?: string;
  occurred_at: string;
}

/**
 * COMMAND: CreateSaleCommand
 * Handles checkout operations.
 * INVARIANT: Negative stock is prohibited; payment amount must be non-negative.
 */
export class CreateSaleCommand {
  constructor(
    public saleId: string,
    public tenantId: string,
    public branchId: string,
    public cashierId: string,
    public payload: {
      receipt_number: string;
      subtotal: number;
      discount_amount: number;
      total_amount: number;
      sale_items: Array<{ variant_id: string; quantity: number; unit_price: number; cost_price: number }>;
      payments: Array<{ payment_method: string; amount: number; reference_code?: string }>;
    }
  ) {}

  async execute(): Promise<CommandResult> {
    // 1. Basic Validations
    if (!this.payload.sale_items || this.payload.sale_items.length === 0) {
      return { success: false, error: 'Checkout must contain at least one item.' };
    }
    if (this.payload.total_amount < 0) {
      return { success: false, error: 'Total amount cannot be negative.' };
    }

    // 2. Invariant Check: Verify stock quantities locally
    for (const item of this.payload.sale_items) {
      const localVariant = await db.variants.get(item.variant_id);
      const stockAvailable = localVariant ? localVariant.quantity : 0;
      if (stockAvailable < item.quantity) {
        return {
          success: false,
          error: `Insufficient stock for ${localVariant?.name || item.variant_id}. Available: ${stockAvailable}, Requested: ${item.quantity}`
        };
      }
    }

    // 3. Invariant Check: Duplicate Payment Reference
    for (const p of this.payload.payments) {
      if (p.reference_code) {
        // Simple mock search in local settings/orders to assert uniqueness
        const duplicateRef = await db.settings.get(`payment_ref_${p.reference_code}`);
        if (duplicateRef) {
          return { success: false, error: `Duplicate payment reference code: ${p.reference_code}` };
        }
      }
    }

    // 4. Generate Events
    const correlationId = crypto.randomUUID();
    const events: DomainEvent[] = [];

    // sale.created event
    events.push({
      id: crypto.randomUUID(),
      tenant_id: this.tenantId,
      branch_id: this.branchId,
      aggregate_type: 'sale',
      aggregate_id: this.saleId,
      event_type: 'sale.created',
      event_version: 1,
      schema_version: 1,
      payload: {
        receipt_number: this.payload.receipt_number,
        subtotal: this.payload.subtotal,
        discount_amount: this.payload.discount_amount,
        total_amount: this.payload.total_amount
      },
      actor_id: this.cashierId,
      correlation_id: correlationId,
      occurred_at: new Date().toISOString()
    });

    // sale.item_added events
    this.payload.sale_items.forEach((item, index) => {
      events.push({
        id: crypto.randomUUID(),
        tenant_id: this.tenantId,
        branch_id: this.branchId,
        aggregate_type: 'sale',
        aggregate_id: this.saleId,
        event_type: 'sale.item_added',
        event_version: 2 + index,
        schema_version: 1,
        payload: {
          variant_id: item.variant_id,
          quantity: item.quantity,
          unit_price: item.unit_price,
          cost_price: item.cost_price
        },
        actor_id: this.cashierId,
        correlation_id: correlationId,
        occurred_at: new Date().toISOString()
      });
    });

    // payment.recorded events
    this.payload.payments.forEach((pay, index) => {
      events.push({
        id: crypto.randomUUID(),
        tenant_id: this.tenantId,
        branch_id: this.branchId,
        aggregate_type: 'payment',
        aggregate_id: crypto.randomUUID(),
        event_type: 'payment.recorded',
        event_version: 1,
        schema_version: 1,
        payload: {
          sale_id: this.saleId,
          payment_method: pay.payment_method,
          amount: pay.amount,
          reference_code: pay.reference_code || null
        },
        actor_id: this.cashierId,
        correlation_id: correlationId,
        occurred_at: new Date().toISOString()
      });
    });

    return { success: true, events };
  }
}

/**
 * COMMAND: DispatchTransferCommand
 * Dispatches branch inventory transfers.
 * INVARIANT: Available stock must exceed requested dispatch quantities.
 */
export class DispatchTransferCommand {
  constructor(
    public transferId: string,
    public tenantId: string,
    public fromBranchId: string,
    public toBranchId: string,
    public actorId: string,
    public items: Array<{ variant_id: string; quantity: number }>
  ) {}

  async execute(): Promise<CommandResult> {
    // Invariant check: Stock validation
    for (const item of this.items) {
      const localVariant = await db.variants.get(item.variant_id);
      const stock = localVariant ? localVariant.quantity : 0;
      if (stock < item.quantity) {
        return {
          success: false,
          error: `Cannot dispatch transfer: insufficient stock for variant ${item.variant_id}. Available: ${stock}`
        };
      }
    }

    const correlationId = crypto.randomUUID();
    const events: DomainEvent[] = [
      {
        id: crypto.randomUUID(),
        tenant_id: this.tenantId,
        branch_id: this.fromBranchId,
        aggregate_type: 'transfer',
        aggregate_id: this.transferId,
        event_type: 'transfer.dispatched',
        event_version: 1,
        schema_version: 1,
        payload: {
          from_branch_id: this.fromBranchId,
          to_branch_id: this.toBranchId,
          items: this.items
        },
        actor_id: this.actorId,
        correlation_id: correlationId,
        occurred_at: new Date().toISOString()
      }
    ];

    return { success: true, events };
  }
}

/**
 * COMMAND: CloseCashSessionCommand
 * Closes till sessions.
 * INVARIANT: Cash sessions cannot be closed twice.
 */
export class CloseCashSessionCommand {
  constructor(
    public sessionId: string,
    public tenantId: string,
    public branchId: string,
    public actorId: string,
    public closingFloat: number,
    public expectedCash: number
  ) {}

  async execute(): Promise<CommandResult> {
    // 1. Invariant: Check if session is already closed locally
    const sessionClosedKey = `session_closed_${this.sessionId}`;
    const alreadyClosed = await db.settings.get(sessionClosedKey);
    if (alreadyClosed && alreadyClosed.value === 'true') {
      return { success: false, error: 'Till session is already closed.' };
    }

    const variance = this.closingFloat - this.expectedCash;
    const correlationId = crypto.randomUUID();
    const events: DomainEvent[] = [
      {
        id: crypto.randomUUID(),
        tenant_id: this.tenantId,
        branch_id: this.branchId,
        aggregate_type: 'cash_session',
        aggregate_id: this.sessionId,
        event_type: 'cash_session.closed',
        event_version: 2,
        schema_version: 1,
        payload: {
          closing_float: this.closingFloat,
          expected_cash: this.expectedCash,
          variance
        },
        actor_id: this.actorId,
        correlation_id: correlationId,
        occurred_at: new Date().toISOString()
      }
    ];

    // Trigger variance tracking if present
    if (variance !== 0) {
      events.push({
        id: crypto.randomUUID(),
        tenant_id: this.tenantId,
        branch_id: this.branchId,
        aggregate_type: 'cash_session',
        aggregate_id: this.sessionId,
        event_type: 'cash_session.variance_detected',
        event_version: 3,
        schema_version: 1,
        payload: {
          variance
        },
        actor_id: this.actorId,
        correlation_id: correlationId,
        occurred_at: new Date().toISOString()
      });
    }

    return { success: true, events };
  }
}
