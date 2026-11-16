-- ============================================================
-- Minecraft Server Manager
-- Database-level payment idempotency
-- ============================================================

BEGIN;

-- 1. Idempotency request storage
CREATE TABLE IF NOT EXISTS public.payment_idempotency_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  request_id UUID NOT NULL,
  operation TEXT NOT NULL
    CHECK (operation IN ('wallet_spend', 'cash_payment')),
  request_payload JSONB NOT NULL,
  result JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT payment_idempotency_requests_owner_request_key
    UNIQUE (owner_id, request_id)
);

-- 2. Security
ALTER TABLE public.payment_idempotency_requests
  ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.payment_idempotency_requests
  NO FORCE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE public.payment_idempotency_requests
  FROM PUBLIC, anon, authenticated, service_role;

-- 3. Idempotent wallet spend RPC
CREATE OR REPLACE FUNCTION public.record_wallet_spend(
  p_player_id uuid,
  p_allocations jsonb,
  p_request_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_owner_id uuid := auth.uid();
  v_item jsonb;

  v_purpose text;
  v_description text;
  v_alloc_amount numeric;
  v_total_spent numeric := 0;

  v_monthly_fee numeric;
  v_month_count integer;
  v_month_index integer;

  v_balance_before numeric := 0;
  v_balance_after numeric;

  v_anchor_day smallint;
  v_period_start date;
  v_period_end date;
  v_next_month date;
  v_next_month_last_day date;
  v_next_period_start date;

  v_latest_period_end date;
  v_latest_anchor smallint;
  v_latest_payment_date date;

  v_wallet_transaction_id uuid;
  v_wallet_created_at timestamptz;

  v_result_allocations jsonb := '[]'::jsonb;
  v_canonical_allocations jsonb := '[]'::jsonb;
  v_request_payload jsonb;
  v_existing_operation text;
  v_existing_payload jsonb;
  v_existing_result jsonb;
  v_rows integer;
  v_result jsonb;
BEGIN
  -- Authentication and request validation.
  IF v_owner_id IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;

  IF p_request_id IS NULL THEN
    RAISE EXCEPTION 'Request ID is required';
  END IF;

  IF p_player_id IS NULL THEN
    RAISE EXCEPTION 'Player is required';
  END IF;

  IF jsonb_typeof(p_allocations) IS DISTINCT FROM 'array' THEN
    RAISE EXCEPTION 'Allocations must be a JSON array';
  END IF;

  IF jsonb_array_length(p_allocations) = 0 THEN
    RAISE EXCEPTION 'At least one allocation is required';
  END IF;

  -- Validate allocations and create a normalized payload.
  FOR v_item IN
    SELECT value
    FROM jsonb_array_elements(p_allocations)
  LOOP
    IF jsonb_typeof(v_item) IS DISTINCT FROM 'object' THEN
      RAISE EXCEPTION 'Each allocation must be an object';
    END IF;

    IF COALESCE(v_item->>'purpose', '') NOT IN (
      'membership',
      'custom_title',
      'other'
    )
    OR COALESCE(v_item->>'amount', '') = '' THEN
      RAISE EXCEPTION 'Invalid allocation details';
    END IF;

    v_alloc_amount := (v_item->>'amount')::numeric;

    IF v_alloc_amount IS NULL
       OR v_alloc_amount <= 0
       OR round(v_alloc_amount, 2) <> v_alloc_amount THEN
      RAISE EXCEPTION 'Invalid allocation amount';
    END IF;

    v_purpose := v_item->>'purpose';
    v_description := NULLIF(trim(v_item->>'description'), '');

    v_total_spent := v_total_spent + v_alloc_amount;

    v_canonical_allocations := v_canonical_allocations || jsonb_build_array(
      jsonb_build_object(
        'purpose', v_purpose,
        'amount', v_alloc_amount,
        'description', v_description
      )
    );
  END LOOP;

  v_request_payload := jsonb_build_object(
    'player_id', p_player_id,
    'allocations', v_canonical_allocations
  );

  -- Claim the request ID. A concurrent duplicate waits for the
  -- first transaction to commit or roll back.
  INSERT INTO public.payment_idempotency_requests (
    owner_id,
    request_id,
    operation,
    request_payload
  )
  VALUES (
    v_owner_id,
    p_request_id,
    'wallet_spend',
    v_request_payload
  )
  ON CONFLICT (owner_id, request_id) DO NOTHING;

  GET DIAGNOSTICS v_rows = ROW_COUNT;

  -- Lock and inspect the request, including concurrent retries.
  SELECT operation, request_payload, result
  INTO
    v_existing_operation,
    v_existing_payload,
    v_existing_result
  FROM public.payment_idempotency_requests
  WHERE owner_id = v_owner_id
    AND request_id = p_request_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Unable to register idempotency request';
  END IF;

  IF v_rows = 0 THEN
    IF v_existing_operation IS DISTINCT FROM 'wallet_spend'
       OR v_existing_payload IS DISTINCT FROM v_request_payload THEN
      RAISE EXCEPTION
        'Request ID has already been used with a different operation or payload';
    END IF;

    IF v_existing_result IS NULL THEN
      RAISE EXCEPTION 'Request exists without a completed result';
    END IF;

    RETURN v_existing_result;
  END IF;

  -- Lock the player before checking the wallet.
  PERFORM 1
  FROM public.players
  WHERE id = p_player_id
    AND owner_id = v_owner_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Player not found';
  END IF;

  -- Read authoritative wallet balance from ledger.
  SELECT COALESCE(SUM(amount), 0)
  INTO v_balance_before
  FROM public.wallet_transactions
  WHERE owner_id = v_owner_id
    AND player_id = p_player_id;

  IF v_total_spent > v_balance_before THEN
    RAISE EXCEPTION
      'Insufficient wallet balance. Available: %, Required: %',
      v_balance_before,
      v_total_spent;
  END IF;

  v_balance_after := v_balance_before - v_total_spent;

  SELECT monthly_fee
  INTO v_monthly_fee
  FROM public.players
  WHERE id = p_player_id
    AND owner_id = v_owner_id;

  -- Process allocations.
  FOR v_item IN
    SELECT value
    FROM jsonb_array_elements(p_allocations)
  LOOP
    v_purpose := v_item->>'purpose';
    v_alloc_amount := (v_item->>'amount')::numeric;
    v_description := NULLIF(trim(v_item->>'description'), '');

    INSERT INTO public.wallet_transactions (
      owner_id,
      player_id,
      transaction_type,
      amount,
      description
    )
    VALUES (
      v_owner_id,
      p_player_id,
      'wallet_spend',
      -v_alloc_amount,
      CASE
        WHEN v_description IS NOT NULL THEN
          initcap(replace(v_purpose, '_', ' ')) || ': ' || v_description
        ELSE
          CASE
            WHEN v_purpose = 'membership' THEN 'Membership payment'
            WHEN v_purpose = 'custom_title' THEN 'Custom Title purchase'
            ELSE 'Other purchase'
          END
      END
    )
    RETURNING id, created_at
    INTO v_wallet_transaction_id, v_wallet_created_at;

    -- Recognize income and link it to the wallet transaction.
    INSERT INTO public.income_transactions (
      owner_id,
      player_id,
      source_type,
      description,
      amount,
      income_date,
      wallet_transaction_id
    )
    VALUES (
      v_owner_id,
      p_player_id,
      v_purpose,
      COALESCE(
        v_description,
        CASE
          WHEN v_purpose = 'membership' THEN 'Membership Payment'
          WHEN v_purpose = 'custom_title' THEN 'Custom Title'
          ELSE 'Other'
        END
      ),
      v_alloc_amount,
      CURRENT_DATE,
      v_wallet_transaction_id
    );

    -- Preserve existing membership billing behavior.
    IF v_purpose = 'membership' THEN
      IF v_monthly_fee IS NULL OR v_monthly_fee <= 0 THEN
        RAISE EXCEPTION 'Invalid monthly fee';
      END IF;

      IF mod(v_alloc_amount, v_monthly_fee) <> 0 THEN
        RAISE EXCEPTION
          'Membership allocation must be a multiple of the monthly fee (%)',
          v_monthly_fee;
      END IF;

      v_month_count := (v_alloc_amount / v_monthly_fee)::integer;

      IF v_month_count < 1 THEN
        RAISE EXCEPTION 'At least one complete month is required';
      END IF;

      SELECT
        period_end,
        billing_anchor_day,
        payment_date
      INTO
        v_latest_period_end,
        v_latest_anchor,
        v_latest_payment_date
      FROM public.membership_periods
      WHERE owner_id = v_owner_id
        AND player_id = p_player_id
      ORDER BY period_end DESC, created_at DESC
      LIMIT 1;

      IF FOUND THEN
        IF CURRENT_DATE < v_latest_payment_date THEN
          RAISE EXCEPTION
            'Backdated membership payment rejected. Latest recorded payment date: %',
            v_latest_payment_date;
        END IF;

        v_period_start := v_latest_period_end + 1;
        v_anchor_day := v_latest_anchor;

        IF CURRENT_DATE > v_period_start + 3 THEN
          v_period_start := CURRENT_DATE;
          v_anchor_day := EXTRACT(DAY FROM CURRENT_DATE)::smallint;
        END IF;
      ELSE
        v_period_start := CURRENT_DATE;
        v_anchor_day := EXTRACT(DAY FROM CURRENT_DATE)::smallint;
      END IF;

      FOR v_month_index IN 1..v_month_count LOOP
        v_next_month := (
          date_trunc('month', v_period_start::timestamp)
          + interval '1 month'
        )::date;

        v_next_month_last_day := (
          v_next_month + interval '1 month - 1 day'
        )::date;

        v_next_period_start :=
          v_next_month
          + (
            LEAST(
              v_anchor_day,
              EXTRACT(DAY FROM v_next_month_last_day)::integer
            ) - 1
          );

        v_period_end := v_next_period_start - 1;

        INSERT INTO public.membership_periods (
          owner_id,
          player_id,
          period_start,
          period_end,
          amount,
          billing_anchor_day,
          payment_date,
          source_wallet_transaction_id
        )
        VALUES (
          v_owner_id,
          p_player_id,
          v_period_start,
          v_period_end,
          v_monthly_fee,
          v_anchor_day,
          CURRENT_DATE,
          v_wallet_transaction_id
        );

        v_period_start := v_next_period_start;
      END LOOP;
    END IF;

    v_result_allocations := v_result_allocations || jsonb_build_array(
      jsonb_build_object(
        'wallet_transaction_id', v_wallet_transaction_id,
        'created_at', v_wallet_created_at,
        'purpose', v_purpose,
        'description', v_description,
        'amount', v_alloc_amount
      )
    );
  END LOOP;

  -- Store the exact successful result in the same transaction.
  v_result := jsonb_build_object(
    'success', true,
    'player_id', p_player_id,
    'total_spent', v_total_spent,
    'balance_before', v_balance_before,
    'balance_after', v_balance_after,
    'allocations', v_result_allocations
  );

  UPDATE public.payment_idempotency_requests
  SET result = v_result
  WHERE owner_id = v_owner_id
    AND request_id = p_request_id;

  RETURN v_result;
END;
$function$;

-- 4. Idempotent cash payment RPC
CREATE OR REPLACE FUNCTION public.record_cash_payment(
  p_payer_player_id uuid,
  p_amount numeric,
  p_allocations jsonb,
  p_request_id uuid,
  p_payment_date date,
  p_notes text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_owner_id UUID;
  v_request_payload JSONB;
  v_existing_operation TEXT;
  v_existing_payload JSONB;
  v_existing_result JSONB;
  v_inserted_rows INTEGER;

  v_player_ids UUID[];
  v_locked_count INTEGER;

  v_payment_id UUID;
  v_allocation_id UUID;
  v_wallet_transaction_id UUID;

  v_item JSONB;
  v_player_id UUID;
  v_purpose TEXT;
  v_description TEXT;
  v_allocation_amount NUMERIC;
  v_total_allocated NUMERIC := 0;
  v_wallet_credited NUMERIC := 0;

  v_monthly_fee NUMERIC;
  v_month_count INTEGER;
  v_month_index INTEGER;
  v_period_start DATE;
  v_next_month_start DATE;
  v_next_period_start DATE;
  v_period_end DATE;
  v_last_day DATE;
  v_anchor_day SMALLINT;
  v_latest_period_end DATE;
  v_latest_payment_date DATE;
  v_latest_anchor_day SMALLINT;
  v_has_latest BOOLEAN;

  v_allocation_results JSONB := '[]'::JSONB;
  v_result JSONB;
BEGIN
  -- Authentication and basic request validation.
  v_owner_id := auth.uid();

  IF v_owner_id IS NULL THEN
    RAISE EXCEPTION 'You must be signed in to record a payment.';
  END IF;

  IF p_request_id IS NULL THEN
    RAISE EXCEPTION 'Payment request ID is required.';
  END IF;

  IF p_payer_player_id IS NULL THEN
    RAISE EXCEPTION 'Select the person who made the payment.';
  END IF;

  IF p_amount IS NULL
     OR p_amount <= 0
     OR p_amount <> ROUND(p_amount, 2) THEN
    RAISE EXCEPTION 'Payment amount must be positive and have at most two decimal places.';
  END IF;

  IF p_payment_date IS NULL THEN
    RAISE EXCEPTION 'Payment date is required.';
  END IF;

  IF jsonb_typeof(p_allocations) IS DISTINCT FROM 'array'
     OR jsonb_array_length(p_allocations) = 0 THEN
    RAISE EXCEPTION 'At least one payment allocation is required.';
  END IF;

  -- Build a normalized payload. Allocation order is intentionally preserved.
  SELECT jsonb_agg(
    jsonb_build_object(
      'player_id', (allocation.value ->> 'player_id')::UUID,
      'purpose', allocation.value ->> 'purpose',
      'amount', (allocation.value ->> 'amount')::NUMERIC,
      'description', NULLIF(BTRIM(allocation.value ->> 'description'), '')
    )
    ORDER BY allocation.ordinality
  )
  INTO v_request_payload
  FROM jsonb_array_elements(p_allocations)
       WITH ORDINALITY AS allocation(value, ordinality);

  v_request_payload := jsonb_build_object(
    'payer_player_id', p_payer_player_id,
    'amount', p_amount,
    'payment_date', p_payment_date,
    'notes', NULLIF(BTRIM(p_notes), ''),
    'allocations', v_request_payload
  );

  -- Claim the request ID. A concurrent duplicate waits for the first
  -- transaction to finish, then reads its stored result.
  INSERT INTO public.payment_idempotency_requests (
    owner_id,
    request_id,
    operation,
    request_payload
  )
  VALUES (
    v_owner_id,
    p_request_id,
    'cash_payment',
    v_request_payload
  )
  ON CONFLICT (owner_id, request_id) DO NOTHING;

  GET DIAGNOSTICS v_inserted_rows = ROW_COUNT;

  SELECT
    operation,
    request_payload,
    result
  INTO
    v_existing_operation,
    v_existing_payload,
    v_existing_result
  FROM public.payment_idempotency_requests
  WHERE owner_id = v_owner_id
    AND request_id = p_request_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Unable to claim payment request. Please try again.';
  END IF;

  IF v_inserted_rows = 0 THEN
    IF v_existing_operation <> 'cash_payment' THEN
      RAISE EXCEPTION 'Request ID has already been used for another operation.';
    END IF;

    IF v_existing_payload IS DISTINCT FROM v_request_payload THEN
      RAISE EXCEPTION 'Request ID reused with a different payload.';
    END IF;

    IF v_existing_result IS NULL THEN
      RAISE EXCEPTION 'Payment request has no stored result. Contact an administrator.';
    END IF;

    RETURN v_existing_result;
  END IF;

  -- Validate allocation fields and collect all involved players.
  SELECT ARRAY_AGG(DISTINCT (allocation.value ->> 'player_id')::UUID)
  INTO v_player_ids
  FROM jsonb_array_elements(p_allocations) AS allocation(value);

  FOR v_item IN
    SELECT value
    FROM jsonb_array_elements(p_allocations)
  LOOP
    v_player_id := (v_item ->> 'player_id')::UUID;
    v_purpose := v_item ->> 'purpose';
    v_allocation_amount := (v_item ->> 'amount')::NUMERIC;
    v_description := NULLIF(BTRIM(v_item ->> 'description'), '');

    IF v_player_id IS NULL THEN
      RAISE EXCEPTION 'Every allocation must have a player.';
    END IF;

    IF v_purpose NOT IN ('membership', 'custom_title', 'other') THEN
      RAISE EXCEPTION 'Invalid payment allocation purpose.';
    END IF;

    IF v_allocation_amount IS NULL
       OR v_allocation_amount <= 0
       OR v_allocation_amount <> ROUND(v_allocation_amount, 2) THEN
      RAISE EXCEPTION 'Allocation amounts must be positive and have at most two decimal places.';
    END IF;

    v_total_allocated := v_total_allocated + v_allocation_amount;
  END LOOP;

  IF v_total_allocated > p_amount THEN
    RAISE EXCEPTION 'Total allocations cannot exceed the payment received.';
  END IF;

  -- Lock the payer and all beneficiaries in a consistent order.
  PERFORM player.id
  FROM public.players AS player
  WHERE player.owner_id = v_owner_id
    AND player.id = ANY(v_player_ids || ARRAY[p_payer_player_id])
  ORDER BY player.id
  FOR UPDATE;

  SELECT COUNT(*)
  INTO v_locked_count
  FROM public.players AS player
  WHERE player.owner_id = v_owner_id
    AND player.id = ANY(v_player_ids || ARRAY[p_payer_player_id]);

  IF NOT EXISTS (
    SELECT 1
    FROM public.players
    WHERE id = p_payer_player_id
      AND owner_id = v_owner_id
  ) THEN
    RAISE EXCEPTION 'Payment payer not found.';
  END IF;

  IF v_locked_count <> (
    SELECT COUNT(DISTINCT player_id)
    FROM unnest(v_player_ids || ARRAY[p_payer_player_id]) AS player_id
  ) THEN
    RAISE EXCEPTION 'One or more selected players could not be found.';
  END IF;

  -- Record the full cash payment against the payer.
  INSERT INTO public.player_payments (
    owner_id,
    player_id,
    amount,
    payment_date,
    notes
  )
  VALUES (
    v_owner_id,
    p_payer_player_id,
    p_amount,
    p_payment_date,
    NULLIF(BTRIM(p_notes), '')
  )
  RETURNING id INTO v_payment_id;

  -- Process each allocation.
  FOR v_item IN
    SELECT value
    FROM jsonb_array_elements(p_allocations)
  LOOP
    v_player_id := (v_item ->> 'player_id')::UUID;
    v_purpose := v_item ->> 'purpose';
    v_allocation_amount := (v_item ->> 'amount')::NUMERIC;
    v_description := NULLIF(BTRIM(v_item ->> 'description'), '');

    INSERT INTO public.player_payment_allocations (
      owner_id,
      payment_id,
      player_id,
      amount,
      purpose,
      description
    )
    VALUES (
      v_owner_id,
      v_payment_id,
      v_player_id,
      v_allocation_amount,
      v_purpose,
      v_description
    )
    RETURNING id INTO v_allocation_id;

    -- Cash allocations create income for the beneficiary.
    INSERT INTO public.income_transactions (
      owner_id,
      player_id,
      source_type,
      description,
      amount,
      income_date
    )
    VALUES (
      v_owner_id,
      v_player_id,
      v_purpose,
      COALESCE(
        v_description,
        CASE v_purpose
          WHEN 'membership' THEN 'Membership payment'
          WHEN 'custom_title' THEN 'Custom title payment'
          ELSE 'Other payment'
        END
      ),
      v_allocation_amount,
      p_payment_date
    );

    -- Membership allocations create anniversary-based membership periods.
    IF v_purpose = 'membership' THEN
      SELECT monthly_fee
      INTO v_monthly_fee
      FROM public.players
      WHERE id = v_player_id
        AND owner_id = v_owner_id;

      IF v_monthly_fee IS NULL OR v_monthly_fee <= 0 THEN
        RAISE EXCEPTION 'This player does not have a valid monthly membership fee.';
      END IF;

      IF MOD(
        ROUND(v_allocation_amount * 100),
        ROUND(v_monthly_fee * 100)
      ) <> 0 THEN
        RAISE EXCEPTION 'Membership allocation must be a complete number of monthly fees.';
      END IF;

      v_month_count := ROUND(v_allocation_amount / v_monthly_fee)::INTEGER;

      IF v_monthly_fee * v_month_count <> v_allocation_amount THEN
        RAISE EXCEPTION 'Membership allocation does not match the monthly fee.';
      END IF;

      SELECT
        period_end,
        payment_date,
        billing_anchor_day
      INTO
        v_latest_period_end,
        v_latest_payment_date,
        v_latest_anchor_day
      FROM public.membership_periods
      WHERE owner_id = v_owner_id
        AND player_id = v_player_id
      ORDER BY period_end DESC, created_at DESC
      LIMIT 1;

      v_has_latest := FOUND;

      IF v_has_latest THEN
        IF p_payment_date < v_latest_payment_date THEN
          RAISE EXCEPTION 'Backdated membership payments are not allowed.';
        END IF;

        v_period_start := v_latest_period_end + 1;
        v_anchor_day := v_latest_anchor_day;

        -- Preserve the existing three-day grace rule.
        IF p_payment_date > v_period_start + 3 THEN
          v_period_start := p_payment_date;
          v_anchor_day := EXTRACT(DAY FROM p_payment_date)::SMALLINT;
        END IF;
      ELSE
        v_period_start := p_payment_date;
        v_anchor_day := EXTRACT(DAY FROM p_payment_date)::SMALLINT;
      END IF;

      FOR v_month_index IN 1..v_month_count
      LOOP
        v_next_month_start :=
          (DATE_TRUNC('month', v_period_start)::DATE + INTERVAL '1 month')::DATE;

        v_last_day :=
          (v_next_month_start + INTERVAL '1 month - 1 day')::DATE;

        v_next_period_start := MAKE_DATE(
          EXTRACT(YEAR FROM v_next_month_start)::INTEGER,
          EXTRACT(MONTH FROM v_next_month_start)::INTEGER,
          LEAST(
            v_anchor_day::INTEGER,
            EXTRACT(DAY FROM v_last_day)::INTEGER
          )
        );

        v_period_end := v_next_period_start - 1;

        INSERT INTO public.membership_periods (
          owner_id,
          player_id,
          period_start,
          period_end,
          amount,
          source_payment_allocation_id,
          source_wallet_transaction_id,
          billing_anchor_day,
          payment_date
        )
        VALUES (
          v_owner_id,
          v_player_id,
          v_period_start,
          v_period_end,
          v_monthly_fee,
          v_allocation_id,
          NULL,
          v_anchor_day,
          p_payment_date
        );

        v_period_start := v_next_period_start;
      END LOOP;
    END IF;

    v_allocation_results := v_allocation_results || jsonb_build_array(
      jsonb_build_object(
        'id', v_allocation_id,
        'player_id', v_player_id,
        'purpose', v_purpose,
        'description', v_description,
        'amount', v_allocation_amount
      )
    );
  END LOOP;

  -- Any unallocated cash belongs to the payer's wallet.
  v_wallet_credited := p_amount - v_total_allocated;

  IF v_wallet_credited > 0 THEN
    INSERT INTO public.wallet_transactions (
      owner_id,
      player_id,
      transaction_type,
      amount,
      description,
      payment_id
    )
    VALUES (
      v_owner_id,
      p_payer_player_id,
      'top_up',
      v_wallet_credited,
      'Unallocated change from cash payment',
      v_payment_id
    )
    RETURNING id INTO v_wallet_transaction_id;
  END IF;

  -- Persist the exact response for safe retries.
  v_result := jsonb_build_object(
    'success', TRUE,
    'payment_id', v_payment_id,
    'total_received', p_amount,
    'total_allocated', v_total_allocated,
    'wallet_credited', v_wallet_credited,
    'allocations', v_allocation_results
  );

  UPDATE public.payment_idempotency_requests
  SET result = v_result
  WHERE owner_id = v_owner_id
    AND request_id = p_request_id;

  RETURN v_result;
END;
$function$;

-- 5. Preserve the verified function permissions
REVOKE ALL ON FUNCTION public.record_wallet_spend(uuid, jsonb, uuid)
  FROM PUBLIC, anon;

GRANT EXECUTE ON FUNCTION public.record_wallet_spend(uuid, jsonb, uuid)
  TO authenticated, service_role;

REVOKE ALL ON FUNCTION public.record_cash_payment(uuid, numeric, jsonb, uuid, date, text)
  FROM PUBLIC, anon;

GRANT EXECUTE ON FUNCTION public.record_cash_payment(uuid, numeric, jsonb, uuid, date, text)
  TO authenticated, service_role;

-- 6. Remove obsolete RPC overloads
DROP FUNCTION IF EXISTS public.record_wallet_spend(uuid, jsonb);

DROP FUNCTION IF EXISTS public.record_cash_payment(
  uuid, numeric, jsonb, date, text
);

COMMIT;
