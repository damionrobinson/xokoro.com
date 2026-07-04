/**
 * Xokoro — shared site behaviour
 * Sticky nav, footer year, the "studio list" newsletter popup,
 * and a small toast helper used by the product feed's share button.
 *
 * The newsletter popup posts to the same Google Form used by the
 * previous coming-soon page (see GOOGLE_FORM_CONFIG below) so
 * sign-ups keep landing in the same spreadsheet.
 */
(function () {
  'use strict';

  var GOOGLE_FORM_CONFIG = {
    url: 'https://docs.google.com/forms/d/e/1FAIpQLSd7Rn_UfGTsGdTNvLpMAZMH_cNqPFaQtnHOmadRP0h7KYlnyA/formResponse',
    fields: {
      name: 'entry.1776671031',
      email: 'entry.556623961',
      location: 'entry.1358020764',
      browser: 'entry.1026458690',
      device: 'entry.709745366'
    }
  };

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

  function submitToGoogleForm(name, email) {
    return getLocationInfo().then(function (location) {
      var fd = new FormData();
      fd.append(GOOGLE_FORM_CONFIG.fields.name, name);
      fd.append(GOOGLE_FORM_CONFIG.fields.email, email);
      fd.append(GOOGLE_FORM_CONFIG.fields.location, location);
      fd.append(GOOGLE_FORM_CONFIG.fields.browser, navigator.userAgent);
      fd.append(GOOGLE_FORM_CONFIG.fields.device, getDeviceInfo());
      return fetch(GOOGLE_FORM_CONFIG.url, { method: 'POST', mode: 'no-cors', body: fd });
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
        submitToGoogleForm(name, email).then(function () {
          try { localStorage.setItem('xokoro_sub_seen', '1'); } catch (e) {}
          form.style.display = 'none';
          if (success) success.style.display = 'block';
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

  /* ---------------- Mark current nav link ---------------- */
  function markCurrentNav() {
    var here = (location.pathname.split('/').pop() || 'index.html');
    document.querySelectorAll('.xok-nav-link[data-page], .xok-footer-link[data-page]').forEach(function (a) {
      if (a.getAttribute('data-page') === here) a.classList.add('is-current');
    });
  }

  document.addEventListener('DOMContentLoaded', function () {
    initNav();
    initFooterYear();
    initSubscribe();
    markCurrentNav();
  });
})();
