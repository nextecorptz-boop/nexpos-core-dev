-- =============================================================================
-- MIGRATION 018: Till Sessions (Phase G1.1)
-- Run order: AFTER 017
-- Rollback:
--   DROP FUNCTION IF EXISTS public.review_till_session(public.ulid, text, text);
--   DROP FUNCTION IF EXISTS public.close_till_session(public.ulid, numeric, text, text);
--   DROP FUNCTION IF EXISTS public.open_till_session(public.ulid, numeric);
--   DROP TABLE IF EXISTS public.till_sessions CASCADE;
-- =============================================================================
--
-- G1.1 LIMITATION (read before extending):
--   expected_cash is computed as opening_float only.
--   variance is therefore the UNRECONCILED DIFFERENCE between counted cash
--   and the opening float — NOT the true drawer variance.
--
-- G1.2 will link sales (cash payment_method) to a till_session via either
--   - sales.payment_meta.till_session_id (additive jsonb extension), or
--   - a dedicated sales.till_session_id column.
-- At that point expected_cash becomes: opening_float + linked cash_sales
--   - cash_expenses_out - cash_refunds_out + cash_repayments_received.
--
-- For now we DO NOT fake cash_sales. The UI must label this clearly.
-- =============================================================================


-- ─────────────────────────────────────────────────────────────────────────────
-- TILL_SESSIONS
-- One cashier shift / cash drawer session for one branch.
-- Mutations happen exclusively through SECURITY DEFINER RPCs below.
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE public.till_sessions (
  id                    public.ulid   PRIMARY KEY DEFAULT public.generate_ulid(),
  tenant_id             public.ulid   NOT NULL REFERENCES public.tenants(id)   ON DELETE RESTRICT,
  branch_id             public.ulid   NOT NULL REFERENCES public.branches(id)  ON DELETE RESTRICT,
  cashier_id            uuid          NOT NULL REFERENCES auth.users(id)       ON DELETE RESTRICT,

  opening_float         numeric(14,2) NOT NULL DEFAULT 0
                                      CHECK (opening_float >= 0),
  opened_at             timestamptz   NOT NULL DEFAULT now(),

  closed_at             timestamptz,
  actual_cash_counted   numeric(14,2)
                                      CHECK (actual_cash_counted IS NULL OR actual_cash_counted >= 0),
  expected_cash         numeric(14,2)
                                      CHECK (expected_cash IS NULL OR expected_cash >= 0),
  variance              numeric(14,2),

  status                text          NOT NULL DEFAULT 'open'
                                      CHECK (status IN ('open', 'closed', 'disputed')),

  close_mode            text
                                      CHECK (close_mode IS NULL OR close_mode IN ('normal', 'blind')),

  owner_reviewed_at     timestamptz,
  owner_reviewer_id     uuid          REFERENCES auth.users(id) ON DELETE SET NULL,

  notes                 text,         -- cashier close-time notes
  review_notes          text,         -- owner/manager review notes (kept distinct from `notes`)

  created_at            timestamptz   NOT NULL DEFAULT now(),

  -- closed sessions must have a closed_at + actual + expected
  CONSTRAINT till_sessions_close_consistency
    CHECK (
      status = 'open'
      OR (closed_at IS NOT NULL
          AND actual_cash_counted IS NOT NULL
          AND expected_cash IS NOT NULL)
    )
);

COMMENT ON TABLE public.till_sessions IS
  'One cash drawer shift per cashier per branch. '
  'G1.1: expected_cash = opening_float only; variance is unreconciled difference. '
  'G1.2 will roll linked cash sales/expenses/repayments into expected_cash. '
  'Mutations only via open_till_session / close_till_session / review_till_session RPCs.';

COMMENT ON COLUMN public.till_sessions.expected_cash IS
  'G1.1: equal to opening_float at close time. G1.2 will include linked cash flows.';

COMMENT ON COLUMN public.till_sessions.variance IS
  'G1.1: actual_cash_counted - opening_float (unreconciled difference). '
  'Non-zero variance forces status=disputed pending owner review.';

COMMENT ON COLUMN public.till_sessions.notes IS
  'Cashier close-time notes. Never overwritten by owner review.';

COMMENT ON COLUMN public.till_sessions.review_notes IS
  'Owner/manager notes recorded during review_till_session. Separate from cashier notes.';


-- ─────────────────────────────────────────────────────────────────────────────
-- INDEXES
-- ─────────────────────────────────────────────────────────────────────────────

-- At most one OPEN session per (branch, cashier).
CREATE UNIQUE INDEX till_sessions_one_open_per_cashier_idx
  ON public.till_sessions (branch_id, cashier_id)
  WHERE status = 'open';

-- Recent sessions per branch (primary read pattern).
CREATE INDEX till_sessions_branch_time_idx
  ON public.till_sessions (tenant_id, branch_id, opened_at DESC);

-- Branch-only lookup.
CREATE INDEX till_sessions_branch_idx
  ON public.till_sessions (branch_id);

-- Cashier's own history.
CREATE INDEX till_sessions_cashier_idx
  ON public.till_sessions (cashier_id, opened_at DESC);

-- Filter by status (open sessions surface, disputed review queue).
CREATE INDEX till_sessions_status_idx
  ON public.till_sessions (tenant_id, status)
  WHERE status IN ('open', 'disputed');


-- ─────────────────────────────────────────────────────────────────────────────
-- RLS
-- ─────────────────────────────────────────────────────────────────────────────

ALTER TABLE public.till_sessions ENABLE ROW LEVEL SECURITY;

-- Owner / manager: read all sessions in their tenant.
CREATE POLICY till_sessions_select_owner_manager ON public.till_sessions
  FOR SELECT
  USING (
    tenant_id = public.current_tenant()
    AND public.has_role('owner', 'manager')
  );

-- Cashier: read only their own sessions.
CREATE POLICY till_sessions_select_cashier ON public.till_sessions
  FOR SELECT
  USING (
    tenant_id = public.current_tenant()
    AND cashier_id = public.current_user_id()
  );

-- No direct INSERT / UPDATE / DELETE policies.
-- All mutations go through the SECURITY DEFINER RPCs below.


-- =============================================================================
-- RPC: open_till_session
-- =============================================================================

CREATE OR REPLACE FUNCTION public.open_till_session(
  p_branch_id     public.ulid,
  p_opening_float numeric(14,2)
)
  RETURNS public.till_sessions
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path = ''
AS $$
DECLARE
  v_tenant_id   public.ulid;
  v_actor_id    uuid;
  v_role        text;
  v_user_branch public.ulid;
  v_session     public.till_sessions;
BEGIN
  v_tenant_id := public.current_tenant();
  v_actor_id  := public.current_user_id();
  v_role      := public.current_role();

  IF v_tenant_id IS NULL OR v_actor_id IS NULL THEN
    RAISE EXCEPTION 'open_till_session: unauthenticated' USING ERRCODE = '28000';
  END IF;

  IF p_opening_float IS NULL OR p_opening_float < 0 THEN
    RAISE EXCEPTION 'open_till_session: opening_float must be >= 0' USING ERRCODE = '22023';
  END IF;

  -- Branch must belong to caller's tenant and be active.
  IF NOT EXISTS (
    SELECT 1 FROM public.branches
    WHERE id = p_branch_id
      AND tenant_id = v_tenant_id
      AND is_active = true
  ) THEN
    RAISE EXCEPTION 'open_till_session: branch % not found in tenant', p_branch_id
      USING ERRCODE = '23503';
  END IF;

  -- Cashier must operate within their assigned branch.
  IF v_role = 'cashier' THEN
    SELECT branch_id INTO v_user_branch
    FROM public.profiles
    WHERE id = v_actor_id;

    IF v_user_branch IS NULL OR v_user_branch <> p_branch_id THEN
      RAISE EXCEPTION 'open_till_session: cashier may only open till in own branch'
        USING ERRCODE = '42501';
    END IF;
  END IF;

  -- One open session per (branch, cashier).
  IF EXISTS (
    SELECT 1 FROM public.till_sessions
    WHERE branch_id = p_branch_id
      AND cashier_id = v_actor_id
      AND status = 'open'
  ) THEN
    RAISE EXCEPTION 'open_till_session: an open till session already exists for this cashier in this branch'
      USING ERRCODE = '23505';
  END IF;

  INSERT INTO public.till_sessions (
    tenant_id, branch_id, cashier_id, opening_float, status
  ) VALUES (
    v_tenant_id, p_branch_id, v_actor_id, p_opening_float, 'open'
  )
  RETURNING * INTO v_session;

  PERFORM public.write_audit_log(
    v_tenant_id,
    v_actor_id,
    'till.opened',
    'till_session',
    v_session.id::text,
    jsonb_build_object(
      'branch_id', p_branch_id,
      'opening_float', p_opening_float
    )
  );

  RETURN v_session;
END;
$$;

GRANT EXECUTE ON FUNCTION public.open_till_session(public.ulid, numeric) TO authenticated;

COMMENT ON FUNCTION public.open_till_session(public.ulid, numeric) IS
  'SECURITY DEFINER: opens a till session for the current user. '
  'Cashier restricted to their assigned branch. One open session per (branch, cashier).';


-- =============================================================================
-- RPC: close_till_session
-- =============================================================================

CREATE OR REPLACE FUNCTION public.close_till_session(
  p_session_id          public.ulid,
  p_actual_cash_counted numeric(14,2),
  p_close_mode          text,
  p_notes               text
)
  RETURNS public.till_sessions
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path = ''
AS $$
DECLARE
  v_tenant_id     public.ulid;
  v_actor_id      uuid;
  v_role          text;
  v_session       public.till_sessions;
  v_expected      numeric(14,2);
  v_variance      numeric(14,2);
  v_new_status    text;
BEGIN
  v_tenant_id := public.current_tenant();
  v_actor_id  := public.current_user_id();
  v_role      := public.current_role();

  IF v_tenant_id IS NULL OR v_actor_id IS NULL THEN
    RAISE EXCEPTION 'close_till_session: unauthenticated' USING ERRCODE = '28000';
  END IF;

  IF p_actual_cash_counted IS NULL OR p_actual_cash_counted < 0 THEN
    RAISE EXCEPTION 'close_till_session: actual_cash_counted must be >= 0' USING ERRCODE = '22023';
  END IF;

  IF p_close_mode IS NOT NULL AND p_close_mode NOT IN ('normal', 'blind') THEN
    RAISE EXCEPTION 'close_till_session: invalid close_mode %', p_close_mode USING ERRCODE = '22023';
  END IF;

  SELECT * INTO v_session
  FROM public.till_sessions
  WHERE id = p_session_id
    AND tenant_id = v_tenant_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'close_till_session: session % not found in tenant', p_session_id
      USING ERRCODE = '23503';
  END IF;

  IF v_session.status <> 'open' THEN
    RAISE EXCEPTION 'close_till_session: session % is not open (status=%)',
      p_session_id, v_session.status
      USING ERRCODE = '22023';
  END IF;

  -- Cashier may only close their own session.
  -- Owner / manager may close any session in their tenant.
  IF v_role = 'cashier' AND v_session.cashier_id <> v_actor_id THEN
    RAISE EXCEPTION 'close_till_session: cashier may only close own till session'
      USING ERRCODE = '42501';
  END IF;

  -- G1.1: expected_cash = opening_float (no linked cash sales yet).
  v_expected := v_session.opening_float;
  v_variance := p_actual_cash_counted - v_expected;

  IF v_variance = 0 THEN
    v_new_status := 'closed';
  ELSE
    v_new_status := 'disputed';
  END IF;

  UPDATE public.till_sessions
  SET actual_cash_counted = p_actual_cash_counted,
      expected_cash       = v_expected,
      variance            = v_variance,
      status              = v_new_status,
      close_mode          = COALESCE(p_close_mode, 'normal'),
      notes               = p_notes,
      closed_at           = now()
  WHERE id = p_session_id
  RETURNING * INTO v_session;

  PERFORM public.write_audit_log(
    v_tenant_id,
    v_actor_id,
    CASE WHEN v_new_status = 'disputed' THEN 'till.disputed' ELSE 'till.closed' END,
    'till_session',
    v_session.id::text,
    jsonb_build_object(
      'branch_id',           v_session.branch_id,
      'opening_float',       v_session.opening_float,
      'expected_cash',       v_expected,
      'actual_cash_counted', p_actual_cash_counted,
      'variance',            v_variance,
      'close_mode',          COALESCE(p_close_mode, 'normal'),
      'g1_1_unreconciled',   true
    )
  );

  RETURN v_session;
END;
$$;

GRANT EXECUTE ON FUNCTION public.close_till_session(public.ulid, numeric, text, text) TO authenticated;

COMMENT ON FUNCTION public.close_till_session(public.ulid, numeric, text, text) IS
  'SECURITY DEFINER: closes an open till session. '
  'G1.1: expected_cash = opening_float. Non-zero variance forces status=disputed.';


-- =============================================================================
-- RPC: review_till_session
-- =============================================================================

CREATE OR REPLACE FUNCTION public.review_till_session(
  p_session_id public.ulid,
  p_decision   text,
  p_notes      text
)
  RETURNS public.till_sessions
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path = ''
AS $$
DECLARE
  v_tenant_id public.ulid;
  v_actor_id  uuid;
  v_session   public.till_sessions;
BEGIN
  v_tenant_id := public.current_tenant();
  v_actor_id  := public.current_user_id();

  IF v_tenant_id IS NULL OR v_actor_id IS NULL THEN
    RAISE EXCEPTION 'review_till_session: unauthenticated' USING ERRCODE = '28000';
  END IF;

  IF NOT public.has_role('owner', 'manager') THEN
    RAISE EXCEPTION 'review_till_session: owner or manager only' USING ERRCODE = '42501';
  END IF;

  -- G1.1: only `accept` is supported. Reopen lands in G1.2.
  IF p_decision IS NULL OR p_decision <> 'accept' THEN
    RAISE EXCEPTION 'review_till_session: only decision=accept is supported in G1.1'
      USING ERRCODE = '22023';
  END IF;

  SELECT * INTO v_session
  FROM public.till_sessions
  WHERE id = p_session_id
    AND tenant_id = v_tenant_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'review_till_session: session % not found in tenant', p_session_id
      USING ERRCODE = '23503';
  END IF;

  IF v_session.status NOT IN ('closed', 'disputed') THEN
    RAISE EXCEPTION 'review_till_session: session % is not reviewable (status=%)',
      p_session_id, v_session.status
      USING ERRCODE = '22023';
  END IF;

  UPDATE public.till_sessions
  SET status            = 'closed',
      owner_reviewed_at = now(),
      owner_reviewer_id = v_actor_id,
      review_notes      = p_notes
  WHERE id = p_session_id
  RETURNING * INTO v_session;

  PERFORM public.write_audit_log(
    v_tenant_id,
    v_actor_id,
    'till.reviewed',
    'till_session',
    v_session.id::text,
    jsonb_build_object(
      'branch_id',     v_session.branch_id,
      'prior_variance', v_session.variance,
      'decision',      p_decision
    )
  );

  RETURN v_session;
END;
$$;

GRANT EXECUTE ON FUNCTION public.review_till_session(public.ulid, text, text) TO authenticated;

COMMENT ON FUNCTION public.review_till_session(public.ulid, text, text) IS
  'SECURITY DEFINER: owner/manager review of a closed/disputed till session. '
  'G1.1 supports only decision=accept. Reopen flow arrives in G1.2.';
