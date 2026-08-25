(function() {
  const currentScript = document.currentScript || (function() {
    const scripts = document.getElementsByTagName('script');
    return scripts[scripts.length - 1];
  })();

  const backendOrigin = currentScript ? (new URL(currentScript.src)).origin : (window.location.origin || 'https://gym-backend-core.onrender.com');
  const tenantSlug = currentScript ? (currentScript.getAttribute('data-tenant-slug') || currentScript.getAttribute('data-tenant-id')) : null;
  const primaryColor = currentScript ? (currentScript.getAttribute('data-primary-color') || '#2563eb') : '#2563eb';
  const targetId = currentScript ? (currentScript.getAttribute('data-target') || 'gympartner-join-widget') : 'gympartner-join-widget';

  if (!tenantSlug) {
    console.warn('[GymPartner Join Widget] Missing data-tenant-slug or data-tenant-id attribute.');
    return;
  }

  function initWidget() {
    let container = document.getElementById(targetId);
    if (!container) {
      container = document.createElement('div');
      container.id = targetId;
      document.body.appendChild(container);
    }

    container.innerHTML = `
      <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; padding: 24px; border-radius: 12px; background: #ffffff; border: 1px solid #e2e8f0; box-shadow: 0 4px 12px rgba(0,0,0,0.05); max-width: 460px; margin: 0 auto; color: #0f172a;">
        <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 20px;">
          <h3 id="gp-join-gym-name" style="margin: 0; font-size: 18px; font-weight: 700; color: #0f172a;">Online Registration</h3>
          <span style="font-size: 11px; font-weight: 600; padding: 4px 10px; border-radius: 999px; background: #dcfce7; color: #15803d;">Instant Access</span>
        </div>

        <div id="gp-join-form-body">
          <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 10px; margin-bottom: 12px;">
            <div>
              <label style="display: block; font-size: 12px; font-weight: 600; color: #475569; margin-bottom: 4px;">First Name *</label>
              <input id="gp-join-first" type="text" placeholder="John" style="box-sizing: border-box; width: 100%; padding: 10px 12px; border: 1px solid #cbd5e1; border-radius: 6px; font-size: 13px;" />
            </div>
            <div>
              <label style="display: block; font-size: 12px; font-weight: 600; color: #475569; margin-bottom: 4px;">Last Name *</label>
              <input id="gp-join-last" type="text" placeholder="Doe" style="box-sizing: border-box; width: 100%; padding: 10px 12px; border: 1px solid #cbd5e1; border-radius: 6px; font-size: 13px;" />
            </div>
          </div>

          <div style="margin-bottom: 12px;">
            <label style="display: block; font-size: 12px; font-weight: 600; color: #475569; margin-bottom: 4px;">Phone Number (WhatsApp) *</label>
            <input id="gp-join-phone" type="tel" placeholder="+250 788 123 456" style="box-sizing: border-box; width: 100%; padding: 10px 12px; border: 1px solid #cbd5e1; border-radius: 6px; font-size: 13px;" />
          </div>

          <div style="margin-bottom: 12px;">
            <label style="display: block; font-size: 12px; font-weight: 600; color: #475569; margin-bottom: 4px;">Email (Optional)</label>
            <input id="gp-join-email" type="email" placeholder="john@example.com" style="box-sizing: border-box; width: 100%; padding: 10px 12px; border: 1px solid #cbd5e1; border-radius: 6px; font-size: 13px;" />
          </div>

          <div style="margin-bottom: 12px;">
            <label style="display: block; font-size: 12px; font-weight: 600; color: #475569; margin-bottom: 4px;">Select Plan Option</label>
            <select id="gp-join-plan" style="box-sizing: border-box; width: 100%; padding: 10px 12px; border: 1px solid #cbd5e1; border-radius: 6px; font-size: 13px; background: #ffffff;">
              <option value="trial">7-Day Free VIP Trial Pass (Free)</option>
              <option value="standard">Standard Monthly Membership (RWF 30,000/mo)</option>
              <option value="premium">Premium All-Access (RWF 50,000/mo)</option>
              <option value="vip">VIP Executive (RWF 80,000/mo)</option>
            </select>
          </div>

          <div style="margin-bottom: 16px;">
            <label style="display: block; font-size: 12px; font-weight: 600; color: #475569; margin-bottom: 4px;">Friend Referral Code (Optional)</label>
            <input id="gp-join-ref" type="text" placeholder="e.g. GP-ALICE88" style="box-sizing: border-box; width: 100%; padding: 10px 12px; border: 1px solid #cbd5e1; border-radius: 6px; font-size: 13px; text-transform: uppercase;" />
          </div>

          <button id="gp-join-submit" style="width: 100%; background: ${primaryColor}; color: #ffffff; font-weight: 600; padding: 12px; border-radius: 8px; border: none; cursor: pointer; font-size: 15px; transition: background 0.2s;">Complete Online Registration</button>
          <div id="gp-join-msg" style="margin-top: 12px; font-size: 13px; text-align: center; display: none;"></div>
        </div>
      </div>
    `;

    // Optionally update gym info
    fetch(`${backendOrigin}/api/public/${tenantSlug}/schedule`)
      .then(r => r.json())
      .then(data => {
        if (data.gym) {
          const gymTitle = document.getElementById('gp-join-gym-name');
          if (gymTitle) gymTitle.textContent = `${data.gym.name} — Sign Up`;
        }
      })
      .catch(() => {});

    // Handle Join submit
    const submitBtn = document.getElementById('gp-join-submit');
    submitBtn.addEventListener('click', function() {
      const first = (document.getElementById('gp-join-first').value || '').trim();
      const last = (document.getElementById('gp-join-last').value || '').trim();
      const phone = (document.getElementById('gp-join-phone').value || '').trim();
      const email = (document.getElementById('gp-join-email').value || '').trim();
      const plan = document.getElementById('gp-join-plan').value;
      const refCode = (document.getElementById('gp-join-ref').value || '').trim();
      const msg = document.getElementById('gp-join-msg');

      if (!first || !last || !phone) {
        msg.style.display = 'block';
        msg.style.color = '#dc2626';
        msg.textContent = 'Please fill in required fields (First Name, Last Name, Phone).';
        return;
      }

      submitBtn.disabled = true;
      submitBtn.textContent = 'Processing...';
      msg.style.display = 'none';

      const isTrial = plan === 'trial';
      const payload = {
        first_name: first,
        last_name: last,
        phone: phone,
        email: email || null,
        membership_type: isTrial ? 'standard' : plan,
        is_free_trial: isTrial,
        referral_code: refCode || null
      };

      fetch(`${backendOrigin}/api/public/${tenantSlug}/join`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      })
      .then(r => r.json())
      .then(res => {
        submitBtn.disabled = false;
        submitBtn.textContent = 'Complete Online Registration';
        msg.style.display = 'block';

        if (res.success) {
          msg.style.color = '#16a34a';
          msg.textContent = `🎉 Success! ${res.message || 'Registration complete. Check your phone for confirmation SMS.'}`;
        } else {
          msg.style.color = '#dc2626';
          msg.textContent = res.error || 'Registration failed.';
        }
      })
      .catch(() => {
        submitBtn.disabled = false;
        submitBtn.textContent = 'Complete Online Registration';
        msg.style.display = 'block';
        msg.style.color = '#dc2626';
        msg.textContent = 'Network error. Please try again.';
      });
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initWidget);
  } else {
    initWidget();
  }
})();
