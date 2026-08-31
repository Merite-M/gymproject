(function() {
  function escapeHtml(str) {
    if (!str) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  const currentScript = document.currentScript || (function() {
    const scripts = document.getElementsByTagName('script');
    return scripts[scripts.length - 1];
  })();

  const backendOrigin = currentScript ? (new URL(currentScript.src)).origin : (window.location.origin || 'https://gym-backend-core.onrender.com');
  const tenantSlug = currentScript ? (currentScript.getAttribute('data-tenant-slug') || currentScript.getAttribute('data-tenant-id')) : null;
  const primaryColor = currentScript ? (currentScript.getAttribute('data-primary-color') || '#2563eb') : '#2563eb';
  const targetId = currentScript ? (currentScript.getAttribute('data-target') || 'gympartner-schedule-widget') : 'gympartner-schedule-widget';

  if (!tenantSlug) {
    console.warn('[GymPartner Schedule Widget] Missing data-tenant-slug or data-tenant-id attribute.');
    return;
  }

  function initWidget() {
    let container = document.getElementById(targetId);
    if (!container) {
      container = document.createElement('div');
      container.id = targetId;
      document.body.appendChild(container);
    }

    const safeColor = escapeHtml(primaryColor);

    container.innerHTML = `
      <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; padding: 24px; border-radius: 12px; background: #ffffff; border: 1px solid #e2e8f0; box-shadow: 0 4px 12px rgba(0,0,0,0.05); max-width: 650px; margin: 0 auto; color: #0f172a;">
        <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 20px; border-bottom: 1px solid #f1f5f9; padding-bottom: 16px;">
          <div>
            <h3 id="gp-sched-gym-name" style="margin: 0; font-size: 20px; font-weight: 700; color: #0f172a;">Gym Timetable</h3>
            <p style="margin: 4px 0 0 0; font-size: 13px; color: #64748b;">Book a spot or view upcoming group classes</p>
          </div>
          <span style="font-size: 12px; font-weight: 600; padding: 4px 10px; border-radius: 999px; background: #eff6ff; color: ${safeColor};">Live Schedule</span>
        </div>

        <div id="gp-sched-loading" style="text-align: center; padding: 30px; color: #64748b; font-size: 14px;">
          Loading class schedule...
        </div>

        <div id="gp-sched-list" style="display: none; display: flex; flex-direction: column; gap: 12px;"></div>

        <div id="gp-sched-empty" style="display: none; text-align: center; padding: 30px; color: #64748b; font-size: 14px; border: 1px dashed #cbd5e1; border-radius: 8px;">
          No upcoming classes scheduled for this week.
        </div>

        <!-- Tour Booking Sub-form -->
        <div id="gp-tour-form" style="margin-top: 24px; padding-top: 20px; border-top: 1px solid #f1f5f9;">
          <h4 style="margin: 0 0 12px 0; font-size: 15px; font-weight: 600; color: #1e293b;">Book a Free Gym VIP Tour</h4>
          <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 10px; margin-bottom: 10px;">
            <input id="gp-tour-first" type="text" placeholder="First Name *" style="box-sizing: border-box; width: 100%; padding: 10px 12px; border: 1px solid #cbd5e1; border-radius: 6px; font-size: 13px;" />
            <input id="gp-tour-last" type="text" placeholder="Last Name *" style="box-sizing: border-box; width: 100%; padding: 10px 12px; border: 1px solid #cbd5e1; border-radius: 6px; font-size: 13px;" />
          </div>
          <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 10px; margin-bottom: 12px;">
            <input id="gp-tour-phone" type="tel" placeholder="Phone Number *" style="box-sizing: border-box; width: 100%; padding: 10px 12px; border: 1px solid #cbd5e1; border-radius: 6px; font-size: 13px;" />
            <input id="gp-tour-date" type="datetime-local" style="box-sizing: border-box; width: 100%; padding: 10px 12px; border: 1px solid #cbd5e1; border-radius: 6px; font-size: 13px;" />
          </div>
          <button id="gp-tour-submit" style="width: 100%; background: ${safeColor}; color: #ffffff; font-weight: 600; padding: 12px; border-radius: 8px; border: none; cursor: pointer; font-size: 14px;">Schedule Free VIP Tour</button>
          <div id="gp-tour-msg" style="margin-top: 10px; font-size: 13px; text-align: center; display: none;"></div>
        </div>
      </div>
    `;

    fetch(`${backendOrigin}/api/public/${encodeURIComponent(tenantSlug)}/schedule`)
      .then(r => r.json())
      .then(data => {
        const loading = document.getElementById('gp-sched-loading');
        const list = document.getElementById('gp-sched-list');
        const empty = document.getElementById('gp-sched-empty');

        if (loading) loading.style.display = 'none';

        if (data.gym) {
          const gymTitle = document.getElementById('gp-sched-gym-name');
          if (gymTitle) gymTitle.textContent = `${data.gym.name} — Class Schedule`;
        }

        const schedules = data.schedules || [];
        if (schedules.length === 0) {
          if (empty) empty.style.display = 'block';
        } else {
          if (list) {
            list.style.display = 'flex';
            list.innerHTML = '';

            schedules.forEach(item => {
              const startDate = new Date(item.start_time);
              const formattedTime = startDate.toLocaleDateString('en-US', {
                weekday: 'short', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit'
              });
              const categoryColor = (item.class_categories && item.class_categories.color) || primaryColor;
              const categoryName = (item.class_categories && item.class_categories.name) || 'Fitness Class';
              const classTitle = item.title || categoryName;

              const card = document.createElement('div');
              card.style.cssText = 'display: flex; align-items: center; justify-content: space-between; padding: 12px 16px; border: 1px solid #e2e8f0; border-radius: 8px; background: #f8fafc;';

              const info = document.createElement('div');
              info.innerHTML = `
                <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 4px;">
                  <span style="display: inline-block; width: 10px; height: 10px; border-radius: 50%; background: ${escapeHtml(categoryColor)};"></span>
                  <strong style="font-size: 15px; color: #0f172a;">${escapeHtml(classTitle)}</strong>
                </div>
                <div style="font-size: 13px; color: #64748b;">📅 ${escapeHtml(formattedTime)}</div>
              `;

              const btn = document.createElement('button');
              btn.textContent = 'Book Spot';
              btn.style.cssText = `background: transparent; border: 1px solid ${safeColor}; color: ${safeColor}; font-weight: 600; padding: 6px 14px; border-radius: 6px; cursor: pointer; font-size: 12px;`;
              btn.addEventListener('click', () => {
                const dateInput = document.getElementById('gp-tour-date');
                if (dateInput) dateInput.value = item.start_time.slice(0, 16);
                const firstInput = document.getElementById('gp-tour-first');
                if (firstInput) firstInput.focus();
              });

              card.appendChild(info);
              card.appendChild(btn);
              list.appendChild(card);
            });
          }
        }
      })
      .catch(err => {
        console.error('[GymPartner Schedule Widget] Fetch error:', err);
        const loading = document.getElementById('gp-sched-loading');
        if (loading) loading.textContent = 'Unable to load schedule. Please try again later.';
      });

    // Tour submit event handler POSTing to slug-aware schedule route
    const tourBtn = document.getElementById('gp-tour-submit');
    tourBtn.addEventListener('click', function() {
      const first = (document.getElementById('gp-tour-first').value || '').trim();
      const last = (document.getElementById('gp-tour-last').value || '').trim();
      const phone = (document.getElementById('gp-tour-phone').value || '').trim();
      const dateVal = document.getElementById('gp-tour-date').value;
      const msg = document.getElementById('gp-tour-msg');

      if (!first || !last || !phone) {
        msg.style.display = 'block';
        msg.style.color = '#dc2626';
        msg.textContent = 'Please fill in required fields (First Name, Last Name, Phone).';
        return;
      }

      tourBtn.disabled = true;
      tourBtn.textContent = 'Submitting...';
      msg.style.display = 'none';

      fetch(`${backendOrigin}/api/public/${encodeURIComponent(tenantSlug)}/schedule`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tenant_id: tenantSlug,
          first_name: first,
          last_name: last,
          phone: phone,
          tour_date: dateVal ? new Date(dateVal).toISOString() : new Date().toISOString()
        })
      })
      .then(r => r.json())
      .then(res => {
        tourBtn.disabled = false;
        tourBtn.textContent = 'Schedule Free VIP Tour';
        msg.style.display = 'block';
        if (res.success) {
          msg.style.color = '#16a34a';
          msg.textContent = '🎉 VIP Tour Confirmed! Check your phone for confirmation SMS.';
        } else {
          msg.style.color = '#dc2626';
          msg.textContent = res.error || 'Booking failed.';
        }
      })
      .catch(() => {
        tourBtn.disabled = false;
        tourBtn.textContent = 'Schedule Free VIP Tour';
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
