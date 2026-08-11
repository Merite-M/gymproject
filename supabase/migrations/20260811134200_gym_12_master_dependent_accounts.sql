-- Function to validate membership on check-in, respecting master-dependent relationship
CREATE OR REPLACE FUNCTION public.validate_checkin_membership()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
DECLARE
    target_profile_id uuid;
    has_active_membership boolean;
BEGIN
    -- Only validate if status is not already something denied
    IF NEW.status = 'warning' OR NEW.status = 'approved' THEN
        -- Find if profile has a master account
        SELECT COALESCE(master_account_id, id) INTO target_profile_id
        FROM profiles
        WHERE id = NEW.profile_id AND tenant_id = NEW.tenant_id;

        -- Check for active membership on the target profile (master or self)
        SELECT EXISTS (
            SELECT 1 FROM memberships
            WHERE profile_id = target_profile_id
              AND tenant_id = NEW.tenant_id
              AND status = 'active'
              AND (end_date IS NULL OR end_date >= CURRENT_DATE)
              AND deleted_at IS NULL
        ) INTO has_active_membership;

        IF NOT has_active_membership THEN
            NEW.status := 'denied_expired';
        END IF;
    END IF;

    RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS trg_validate_checkin_membership ON check_ins;
CREATE TRIGGER trg_validate_checkin_membership
    BEFORE INSERT ON check_ins
    FOR EACH ROW
    EXECUTE FUNCTION validate_checkin_membership();

-- View to aggregate billing to the master account
CREATE OR REPLACE VIEW public.vw_tenant_billing_due AS
SELECT
    COALESCE(p.master_account_id, p.id) AS billing_account_id,
    m.tenant_id,
    COUNT(m.id) as active_memberships_count,
    SUM(m.price) as total_recurring_charge
FROM
    memberships m
JOIN
    profiles p ON m.profile_id = p.id
WHERE
    m.status = 'active'
    AND (m.end_date IS NULL OR m.end_date >= CURRENT_DATE)
    AND m.deleted_at IS NULL
GROUP BY
    COALESCE(p.master_account_id, p.id),
    m.tenant_id;
