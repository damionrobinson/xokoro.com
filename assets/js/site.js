/**
 * Xokoro — shared site behaviour
 * Sticky nav, footer year, the "studio list" newsletter popup,
 * and a small toast helper used by the product feed's share button.
 *
 * Both the newsletter popup and the About page contact form post JSON to
 * a single Google Apps Script web app (see google-apps-script/apps-script.gs),
 * which appends a row to the matching tab ("Subscribers" or "Requests") in
 * one shared Google Sheet.
 */
(function () {
  'use strict';

  // Deploying google-apps-script/apps-script.gs as a web app and paste its
  // /exec URL here (Deploy > New deployment > Web app > Execute as "Me",
  // access "Anyone").
  var SHEET_ENDPOINT = 'https://script.google.com/macros/s/AKfycbxRP5vUbiFXHPE1frplx1Gz9hqvytw4zRZU4n_kIVFRWdwFbcPfvJ0pnlP6dxj9ACiJRQ/exec';

  // reCAPTCHA v3 site key (public — the matching secret key lives only in
  // the Apps Script, which is where verification actually happens).
  var RECAPTCHA_SITE_KEY = '6Lf280QtAAAAAMzj6UFqKdcvyTGwpMXFpKMaigfT';

  // Fetches a fresh, action-scoped reCAPTCHA token. Resolves to null (rather
  // than rejecting) if the script hasn't loaded, so a slow/blocked network
  // request degrades to "no token" instead of breaking form submission.
  function getRecaptchaToken(action) {
    return new Promise(function (resolve) {
      if (!window.grecaptcha || !window.grecaptcha.ready) { resolve(null); return; }
      window.grecaptcha.ready(function () {
        window.grecaptcha.execute(RECAPTCHA_SITE_KEY, { action: action })
          .then(resolve)
          .catch(function () { resolve(null); });
      });
    });
  }
  window.xokoroGetRecaptchaToken = getRecaptchaToken;

  // Pushes an event to GTM's dataLayer (container GTM-WSL549VM, loaded from
  // each page's <head>). This doesn't call gtag directly — GTM owns the
  // dataLayer and any tag configured inside it (GA4, etc.) picks events up
  // from there, so nothing here needs to change when tags are added later.
  function track(eventName, params) {
    window.dataLayer = window.dataLayer || [];
    window.dataLayer.push(Object.assign({ event: eventName }, params || {}));
  }
  window.xokoroTrack = track;

  // Ecommerce events (view_item, select_item, begin_checkout) need their
  // item data nested under an "ecommerce" key for GTM's "Send Ecommerce
  // data" option to find it — a flat push won't populate GA4's Items
  // reports. Clearing ecommerce first stops a previous event's items from
  // bleeding into the next one (a well-known GA4/GTM gotcha).
  function trackEcommerce(eventName, ecommerceData) {
    window.dataLayer = window.dataLayer || [];
    window.dataLayer.push({ ecommerce: null });
    window.dataLayer.push({ event: eventName, ecommerce: ecommerceData });
  }
  window.xokoroTrackEcommerce = trackEcommerce;

  function getDeviceInfo() {
    var ua = navigator.userAgent;
    var m = ua.match(/\(([^)]+)\)/);
    return m ? m[1] : 'Unknown';
  }

  function getLocationInfo() {
    return fetch('https://ipapi.co/json/')
      .then(function (r) { return r.json(); })
      .then(function (data) {
        var loc = [data && data.city, data && data.country_name].filter(Boolean).join(', ');
        return loc || 'Unknown';
      })
      .catch(function () { return 'Unknown'; });
  }

  // Shared submit helper — posts as text/plain (no CORS preflight) with a
  // JSON string body; Apps Script reads the raw body regardless of the
  // declared content type. Used with mode:'no-cors' so we can't read the
  // response, but that also means it can't throw on a real network send.
  function submitToSheet(payload) {
    return fetch(SHEET_ENDPOINT, {
      method: 'POST',
      mode: 'no-cors',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify(payload)
    });
  }
  window.xokoroSubmitToSheet = submitToSheet;

  function submitSubscriber(name, email) {
    return Promise.all([getLocationInfo(), getRecaptchaToken('subscribe')]).then(function (results) {
      var location = results[0];
      var token = results[1];
      return submitToSheet({
        formType: 'subscribe',
        recaptchaToken: token,
        name: name,
        email: email,
        location: location,
        browser: navigator.userAgent,
        device: getDeviceInfo()
      });
    });
  }

  /* ---------------- Sticky nav ---------------- */
  function initNav() {
    var nav = document.querySelector('.xok-nav');
    if (!nav) return;
    var hasHero = document.body.classList.contains('has-hero');
    function onScroll() {
      var solid = !hasHero || window.scrollY > 40;
      nav.classList.toggle('is-solid', solid);
    }
    window.addEventListener('scroll', onScroll, { passive: true });
    onScroll();

    var toggle = document.querySelector('.xok-nav-toggle');
    var links = document.querySelector('.xok-nav-links');
    if (toggle && links) {
      toggle.addEventListener('click', function () {
        links.classList.toggle('is-open');
      });
    }
  }

  /* ---------------- Footer year ---------------- */
  function initFooterYear() {
    var el = document.querySelector('[data-year]');
    if (el) el.textContent = new Date().getFullYear();
  }

  /* ---------------- Toast ---------------- */
  var toastTimer;
  function showToast(msg) {
    var el = document.querySelector('.xok-toast');
    if (!el) return;
    el.textContent = msg;
    el.classList.add('is-open');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { el.classList.remove('is-open'); }, 2200);
  }
  window.xokoroToast = showToast;

  /* ---------------- Share helper ---------------- */
  function sharePiece(title, no, slug) {
    var origin = (location.origin && location.origin !== 'null') ? location.origin + location.pathname.replace(/[^/]*$/, '') : 'https://xokoro.com/';
    var url = origin + 'product.html?id=' + encodeURIComponent(slug);
    var data = { title: 'Xokoro — ' + title, text: title + ' · ' + no, url: url };
    track('share', { content_type: 'product', item_id: slug });
    if (navigator.share) {
      navigator.share(data).catch(function () {});
      showToast('Opening share…');
      return;
    }
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(url).then(function () { showToast('Link copied'); }).catch(function () { showToast('Link copied'); });
      return;
    }
    showToast('Link copied');
  }
  window.xokoroShare = sharePiece;

  /* ---------------- Newsletter popup ---------------- */
  function initSubscribe() {
    var overlay = document.querySelector('.xok-sub-overlay');
    if (!overlay) return;
    var modal = overlay.querySelector('.xok-sub-modal');
    var form = overlay.querySelector('.xok-sub-form');
    var success = overlay.querySelector('.xok-form-success');
    var errorEl = overlay.querySelector('.xok-form-error');
    var nameInput = overlay.querySelector('[name="sName"]');
    var emailInput = overlay.querySelector('[name="sEmail"]');
    var hpInput = overlay.querySelector('.xok-hp');
    var closeBtns = overlay.querySelectorAll('[data-sub-close]');
    var openBtns = document.querySelectorAll('[data-sub-open]');
    var openedAt = Date.now();

    function open() {
      openedAt = Date.now();
      overlay.classList.add('is-open');
    }
    function close() {
      overlay.classList.remove('is-open');
      try { localStorage.setItem('xokoro_sub_seen', '1'); } catch (e) {}
    }

    openBtns.forEach(function (b) { b.addEventListener('click', open); });
    closeBtns.forEach(function (b) { b.addEventListener('click', close); });
    overlay.addEventListener('click', function (e) { if (e.target === overlay) close(); });
    if (modal) modal.addEventListener('click', function (e) { e.stopPropagation(); });

    if (form) {
      form.addEventListener('submit', function (e) {
        e.preventDefault();
        var name = nameInput.value.trim();
        var email = emailInput.value.trim();
        if (!name || email.indexOf('@') === -1) {
          errorEl.textContent = 'Please add your name and a valid email.';
          errorEl.style.display = 'block';
          return;
        }
        errorEl.style.display = 'none';

        // Spam trap: a filled honeypot field, or a submit faster than any
        // human could plausibly fill the form, both mean a bot. Show the
        // normal success state without actually sending anything, so
        // automated scripts get no signal that they were caught.
        var looksLikeBot = (hpInput && hpInput.value) || (Date.now() - openedAt < 2500);
        if (looksLikeBot) {
          form.reset();
          form.style.display = 'none';
          if (success) success.style.display = 'block';
          return;
        }

        var btn = form.querySelector('button[type="submit"]');
        if (btn) btn.disabled = true;
        submitSubscriber(name, email).then(function () {
          try { localStorage.setItem('xokoro_sub_seen', '1'); } catch (e) {}
          form.style.display = 'none';
          if (success) success.style.display = 'block';
          track('generate_lead', { method: 'newsletter' });
        }).catch(function () {
          errorEl.textContent = 'Something went wrong. Please try again.';
          errorEl.style.display = 'block';
          if (btn) btn.disabled = false;
        });
      });
    }

    // auto-open once, after a delay, like the design comp
    try {
      if (!localStorage.getItem('xokoro_sub_seen')) {
        setTimeout(function () {
          if (!overlay.classList.contains('is-open')) open();
        }, 7000);
      }
    } catch (e) {}
  }

  /* ---------------- Cookie consent ---------------- */
  // Google Consent Mode v2. The <head> of every page sets a "denied" default
  // before GTM loads (see the inline script above the GTM snippet); this just
  // handles the banner UI and flips the signal to "granted" on Accept, or
  // reopens the choice via a "Cookie settings" footer link.
  function initCookieConsent() {
    var STORAGE_KEY = 'xokoro_consent';
    var banner;

    function updateConsent(granted) {
      var state = {
        ad_storage: granted ? 'granted' : 'denied',
        analytics_storage: granted ? 'granted' : 'denied',
        ad_user_data: granted ? 'granted' : 'denied',
        ad_personalization: granted ? 'granted' : 'denied'
      };
      if (window.gtag) {
        window.gtag('consent', 'update', state);
      } else {
        window.dataLayer = window.dataLayer || [];
        window.dataLayer.push(['consent', 'update', state]);
      }
    }

    function buildBanner() {
      var el = document.createElement('div');
      el.className = 'xok-cookie-banner';
      el.innerHTML =
        '<div class="xok-cookie-copy">This site uses cookies for basic analytics, to understand which pieces people look at. <a href="info.html#privacy">Privacy</a></div>' +
        '<div class="xok-cookie-actions">' +
        '<button type="button" class="btn btn-outline-dark" data-cookie-decline>Decline</button>' +
        '<button type="button" class="btn btn-accent" data-cookie-accept>Accept</button>' +
        '</div>';
      document.body.appendChild(el);
      return el;
    }

    function show() {
      if (!banner) banner = buildBanner();
      requestAnimationFrame(function () { banner.classList.add('is-open'); });
    }
    function hide() {
      if (banner) banner.classList.remove('is-open');
    }

    var stored;
    try { stored = localStorage.getItem(STORAGE_KEY); } catch (e) { stored = null; }

    if (stored === 'granted') {
      updateConsent(true);
    } else if (stored !== 'denied') {
      show();
    }

    document.body.addEventListener('click', function (e) {
      var t = e.target;
      if (t.closest && t.closest('[data-cookie-accept]')) {
        try { localStorage.setItem(STORAGE_KEY, 'granted'); } catch (err) {}
        updateConsent(true);
        hide();
      } else if (t.closest && t.closest('[data-cookie-decline]')) {
        try { localStorage.setItem(STORAGE_KEY, 'denied'); } catch (err) {}
        hide();
      } else if (t.closest && t.closest('[data-cookie-settings]')) {
        show();
      }
    });
  }

  /* ---------------- Mark current nav link ---------------- */
  function markCurrentNav() {
    var here = (location.pathname.split('/').pop() || 'index.html');
    document.querySelectorAll('.xok-nav-link[data-page], .xok-footer-link[data-page]').forEach(function (a) {
      if (a.getAttribute('data-page') === here) a.classList.add('is-current');
    });
  }

  /* ---------------- Cart storage ----------------
   * Persisted to localStorage so it survives page navigation (this is a
   * multi-page static site, not a single-page app). Lines are keyed by
   * product id + variant index. The richer cart drawer UI (assets/js/cart.js)
   * reads/writes through this same API so the badge count here always stays
   * correct no matter which page added or changed something.
   */
  var CART_KEY = 'xokoro_cart';

  function readCart() {
    try {
      var raw = localStorage.getItem(CART_KEY);
      var cart = raw ? JSON.parse(raw) : [];
      return Array.isArray(cart) ? cart : [];
    } catch (e) { return []; }
  }

  function writeCart(cart) {
    try { localStorage.setItem(CART_KEY, JSON.stringify(cart)); } catch (e) {}
    updateCartBadge(cart);
    return cart;
  }

  function findCartLine(cart, id, variantIndex) {
    variantIndex = variantIndex || 0;
    for (var i = 0; i < cart.length; i++) {
      if (cart[i].id === id && (cart[i].variantIndex || 0) === variantIndex) return i;
    }
    return -1;
  }

  function addToCart(id, variantIndex, qty, maxStock) {
    var cart = readCart();
    var idx = findCartLine(cart, id, variantIndex);
    var stock = typeof maxStock === 'number' ? maxStock : 99;
    if (idx > -1) {
      cart[idx].qty = Math.max(1, Math.min(stock, cart[idx].qty + (qty || 1)));
    } else if (stock > 0) {
      cart.push({ id: id, variantIndex: variantIndex || 0, qty: Math.max(1, Math.min(stock, qty || 1)) });
    }
    return writeCart(cart);
  }

  function setCartQty(id, variantIndex, qty, maxStock) {
    var cart = readCart();
    var idx = findCartLine(cart, id, variantIndex);
    var stock = typeof maxStock === 'number' ? maxStock : 99;
    if (idx > -1) {
      var q = Math.max(0, Math.min(stock, qty));
      if (q <= 0) cart.splice(idx, 1);
      else cart[idx].qty = q;
    }
    return writeCart(cart);
  }

  function removeFromCart(id, variantIndex) {
    var cart = readCart();
    var idx = findCartLine(cart, id, variantIndex);
    if (idx > -1) cart.splice(idx, 1);
    return writeCart(cart);
  }

  function clearCart() {
    return writeCart([]);
  }

  function cartCount(cart) {
    cart = cart || readCart();
    return cart.reduce(function (sum, line) { return sum + line.qty; }, 0);
  }

  function updateCartBadge(cart) {
    var count = cartCount(cart);
    document.querySelectorAll('.xok-cart-count').forEach(function (el) {
      el.textContent = String(count);
      el.style.display = count > 0 ? 'inline-flex' : 'none';
    });
  }

  window.xokoroCart = {
    read: readCart,
    add: addToCart,
    setQty: setCartQty,
    remove: removeFromCart,
    clear: clearCart,
    count: cartCount,
    updateBadge: updateCartBadge
  };

  document.addEventListener('DOMContentLoaded', function () {
    initNav();
    initFooterYear();
    initSubscribe();
    initCookieConsent();
    markCurrentNav();
    updateCartBadge();
  });
})();
