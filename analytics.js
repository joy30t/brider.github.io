/* Brider Employment Agency — GA4 Cookie Banner + Event Tracking
 * Pairs with the inline gtag.js + Consent Mode v2 snippet in each page <head>.
 * Persists user choice in localStorage under 'brider_consent' ('granted' | 'denied').
 */
(function () {
  'use strict';

  var STORAGE_KEY = 'brider_consent';

  // ---------- Consent helpers ----------
  function safeGet() {
    try { return localStorage.getItem(STORAGE_KEY); } catch (e) { return null; }
  }
  function safeSet(value) {
    try { localStorage.setItem(STORAGE_KEY, value); } catch (e) {}
  }
  function setConsent(value) {
    safeSet(value);
    if (typeof window.gtag === 'function') {
      var grant = value === 'granted';
      window.gtag('consent', 'update', {
        ad_storage: grant ? 'granted' : 'denied',
        ad_user_data: grant ? 'granted' : 'denied',
        ad_personalization: grant ? 'granted' : 'denied',
        analytics_storage: grant ? 'granted' : 'denied'
      });
    }
  }

  // ---------- Banner UI ----------
  function buildBanner() {
    if (safeGet() !== null) return; // user already decided
    var banner = document.createElement('div');
    banner.id = 'brider-cookie-banner';
    banner.setAttribute('role', 'dialog');
    banner.setAttribute('aria-live', 'polite');
    banner.innerHTML = [
      '<style>',
      '#brider-cookie-banner{position:fixed;left:16px;right:16px;bottom:16px;z-index:99999;background:#0f1633;color:#fff;border-radius:14px;box-shadow:0 20px 50px rgba(0,0,0,.35);padding:18px 22px;display:flex;flex-wrap:wrap;align-items:center;gap:14px;font-family:inherit;font-size:.92rem;line-height:1.5;max-width:980px;margin:0 auto;}',
      '#brider-cookie-banner p{margin:0;flex:1;min-width:240px;color:rgba(255,255,255,.85);}',
      '#brider-cookie-banner a{color:#c9a227;text-decoration:underline;}',
      '#brider-cookie-banner .bcb-actions{display:flex;gap:8px;flex-wrap:wrap;}',
      '#brider-cookie-banner button{padding:10px 18px;border-radius:9px;border:0;font-weight:700;font-size:.88rem;cursor:pointer;font-family:inherit;}',
      '#brider-cookie-banner .bcb-accept{background:#c9a227;color:#0f1633;}',
      '#brider-cookie-banner .bcb-reject{background:transparent;color:#fff;border:1px solid rgba(255,255,255,.25);}',
      '#brider-cookie-banner .bcb-accept:hover{filter:brightness(1.08);}',
      '#brider-cookie-banner .bcb-reject:hover{background:rgba(255,255,255,.08);}',
      '@media(max-width:520px){#brider-cookie-banner{flex-direction:column;align-items:stretch;}#brider-cookie-banner .bcb-actions{justify-content:flex-end;}}',
      '</style>',
      '<p>We use cookies (including Google Analytics) to understand how visitors use our site and improve your experience. You can accept or reject analytics cookies. Questions? <a href="contact.html">Contact us</a>.</p>',
      '<div class="bcb-actions">',
      '  <button class="bcb-reject" type="button">Reject</button>',
      '  <button class="bcb-accept" type="button">Accept</button>',
      '</div>'
    ].join('');
    document.body.appendChild(banner);
    banner.querySelector('.bcb-accept').addEventListener('click', function () {
      setConsent('granted');
      banner.remove();
    });
    banner.querySelector('.bcb-reject').addEventListener('click', function () {
      setConsent('denied');
      banner.remove();
    });
  }

  // Public helper to re-open the banner from a privacy/footer link if desired.
  // Usage: <a href="#" onclick="briderResetConsent(); return false;">Cookie preferences</a>
  window.briderResetConsent = function () {
    try { localStorage.removeItem(STORAGE_KEY); } catch (e) {}
    var existing = document.getElementById('brider-cookie-banner');
    if (existing) existing.remove();
    buildBanner();
  };

  // ---------- Event tracking ----------
  function track(name, params) {
    if (typeof window.gtag === 'function') {
      try { window.gtag('event', name, params || {}); } catch (e) {}
    }
  }

  function attachLinkTracking() {
    document.addEventListener('click', function (e) {
      var a = e.target.closest && e.target.closest('a[href]');
      if (a) {
        var href = (a.getAttribute('href') || '').trim();
        if (href.indexOf('mailto:') === 0) {
          track('email_click', { email: href.replace('mailto:', '') });
        } else if (href.indexOf('tel:') === 0) {
          track('phone_click', { phone: href.replace('tel:', '') });
        } else if (/wa\.me|whatsapp\.com/i.test(href)) {
          track('social_click', { network: 'whatsapp', url: href });
        } else if (/facebook\.com/i.test(href)) {
          track('social_click', { network: 'facebook', url: href });
        } else if (/linkedin\.com/i.test(href)) {
          track('social_click', { network: 'linkedin', url: href });
        } else if (/instagram\.com/i.test(href)) {
          track('social_click', { network: 'instagram', url: href });
        }
      }
      // Footer .social-btn divs (currently not links)
      var btn = e.target.closest && e.target.closest('.social-btn');
      if (btn) {
        var label = (btn.getAttribute('title') || btn.textContent || '').toLowerCase().trim();
        var network = label.indexOf('whatsapp') >= 0 ? 'whatsapp'
                    : label.indexOf('facebook') >= 0 ? 'facebook'
                    : label.indexOf('linkedin') >= 0 ? 'linkedin'
                    : label.indexOf('instagram') >= 0 ? 'instagram'
                    : label;
        track('social_click', { network: network, source: 'footer' });
      }
    }, true); // capture phase so we still fire if a child handler stops propagation
  }

  // Wrap a global function (e.g., sendContactMessage, openApply, submitApplication)
  // to fire a GA event before delegating to the original.
  function wrapFunction(name, eventName, paramFn) {
    var attempts = 0;
    var maxAttempts = 60; // ~3s
    var intervalMs = 50;
    var timer = setInterval(function () {
      attempts++;
      var fn = window[name];
      if (typeof fn === 'function' && !fn.__briderWrapped) {
        var original = fn;
        var wrapped = function () {
          try {
            var params = paramFn ? paramFn(arguments) : {};
            track(eventName, params);
          } catch (err) { /* swallow */ }
          return original.apply(this, arguments);
        };
        wrapped.__briderWrapped = true;
        window[name] = wrapped;
        clearInterval(timer);
      } else if (attempts >= maxAttempts) {
        clearInterval(timer);
      }
    }, intervalMs);
  }

  function attachFormTracking() {
    // Contact form submission (contact.html, also defined on jobs/home for shared modals)
    wrapFunction('sendContactMessage', 'generate_lead', function () {
      return { form: 'contact', page: location.pathname };
    });
    // Apply modal open — fires when a job's "Apply" button is clicked
    wrapFunction('openApply', 'apply_click', function (args) {
      var title = (args && args[0]) ? String(args[0]) : 'unknown';
      return { job_title: title, page: location.pathname };
    });
    // Application submitted from the apply modal
    wrapFunction('submitApplication', 'submit_application', function () {
      var title = '';
      try {
        var el = document.getElementById('app-job-title');
        if (el) title = (el.textContent || '').trim();
      } catch (e) {}
      return { job_title: title || 'unknown', page: location.pathname };
    });
  }

  // ---------- Init ----------
  function init() {
    buildBanner();
    attachLinkTracking();
    attachFormTracking();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
