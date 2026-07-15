/**
 * Xokoro — cart drawer, shipping calculator and checkout
 *
 * Reads/writes cart state through window.xokoroCart (assets/js/site.js),
 * which is what keeps the nav badge correct on every page. This file owns
 * the richer drawer UI: it fetches content/products.json itself so the
 * drawer works from any page (Info, About) not just the ones that already
 * loaded the catalogue for the feed or a product view, and it builds the
 * PayPal order once the shopper is ready to pay.
 */
(function () {
  'use strict';

  // Shipping is charged per item, banded by weight, using real published
  // Royal Mail prices rounded up to the next real band so a piece is never
  // posted at a loss. UK uses Special Delivery Guaranteed, which is the only
  // Royal Mail tier that actually covers loss/damage on valuables and
  // includes a real signature on delivery. Europe/Rest of World use Royal
  // Mail International Tracked — tracked to the door, but NOT a guaranteed
  // signature, no carrier offers that affordably for a boxed parcel
  // internationally. The Parcelforce "upgrade" swaps to their globalpriority
  // courier product for stronger tracking and much higher compensation
  // (£100 vs £50), priced at their published starting rate per item.
  var ZONES = {
    uk: {
      label: 'United Kingdom',
      bands: [{ max: 500, fee: 10.45 }, { max: 1000, fee: 11.45 }, { max: 2000, fee: 15.45 } ]
    },
    europe: {
      label: 'Europe',
      bands: [{ max: 500, fee: 11.00 }, { max: 1000, fee: 12.50 }, { max: 2000, fee: 14.00 } ],
      upgradeFee: 16.25,
      upgradeLabel: 'Parcelforce (stronger tracking & compensation)'
    },
    row: {
      label: 'Rest of World',
      bands: [{ max: 500, fee: 16.00 }, { max: 1000, fee: 20.00 }, { max: 2000, fee: 26.00 } ],
      upgradeFee: 28.80,
      upgradeLabel: 'Parcelforce (stronger tracking & compensation)'
    }
  };
  var EUROPE_COUNTRY_CODES = ['IE', 'FR', 'DE', 'ES', 'NL', 'CH', 'BE', 'SE', 'AT', 'LU', 'IT', 'PT', 'DK', 'FI', 'NO', 'PL', 'CZ', 'GR', 'HU', 'RO', 'BG', 'HR', 'SK', 'SI', 'EE', 'LV', 'LT', 'MT', 'CY', 'IS'];

  var DATA_URL = (function () {
    var depth = document.body.getAttribute('data-root') || '.';
    return depth.replace(/\/$/, '') + '/content/products.json';
  })();

  var productsCache = null;
  function loadProducts() {
    if (productsCache) return Promise.resolve(productsCache);
    return fetch(DATA_URL, { cache: 'no-store' })
      .then(function (r) { return r.json(); })
      .then(function (data) {
        productsCache = (data && data.products) || [];
        return productsCache;
      });
  }

  function money(n) {
    var s = n.toFixed(2);
    return '£' + (s.slice(-3) === '.00' ? s.slice(0, -3) : s);
  }

  function feeForWeight(zoneKey, grams) {
    var bands = ZONES[zoneKey].bands;
    for (var i = 0; i < bands.length; i++) {
      if (grams <= bands[i].max) return bands[i].fee;
    }
    return bands[bands.length - 1].fee; // heavier than our top band — charge the top rate rather than undercharge
  }

  var state = { zone: 'uk', upgrade: false };
  var overlay, linesEl, emptyEl, zoneButtonsEl, upgradeWrap, upgradeCheckbox;
  var itemTotalEl, shipTotalEl, grandTotalEl, paypalContainer, cartSuccess, cartError, checkoutNote, shipSection;
  var built = false;
  var locationChecked = false;

  function buildDrawer() {
    overlay = document.createElement('div');
    overlay.className = 'xok-modal-overlay xok-cart-overlay';
    overlay.innerHTML =
      '<div class="xok-modal xok-cart-modal">' +
      '<div class="xok-modal-kicker">Your cart</div>' +
      '<h3>Selected pieces</h3>' +
      '<div class="xok-cart-lines"></div>' +
      '<p class="xok-cart-empty" style="display:none;">Nothing in your cart yet.</p>' +
      '<div class="xok-cart-ship">' +
      '<div class="xok-cart-ship-label">Shipping to</div>' +
      '<div class="xok-contact-types xok-cart-zones">' +
      '<button type="button" class="xok-type-btn is-selected" data-zone="uk">United Kingdom</button>' +
      '<button type="button" class="xok-type-btn" data-zone="europe">Europe</button>' +
      '<button type="button" class="xok-type-btn" data-zone="row">Rest of World</button>' +
      '</div>' +
      '<label class="xok-cart-upgrade" style="display:none;">' +
      '<input type="checkbox" class="xok-cart-upgrade-check"> <span class="xok-cart-upgrade-text"></span>' +
      '</label>' +
      '</div>' +
      '<div class="xok-cart-totals">' +
      '<div class="xok-cart-totals-row"><span>Items</span><span class="xok-cart-item-total"></span></div>' +
      '<div class="xok-cart-totals-row"><span>Shipping</span><span class="xok-cart-ship-total"></span></div>' +
      '<div class="xok-cart-totals-row xok-cart-totals-grand"><span>Total</span><span class="xok-cart-grand-total"></span></div>' +
      '</div>' +
      '<div class="xok-cart-paypal"></div>' +
      '<div class="xok-form-success xok-cart-success" style="display:none;"></div>' +
      '<div class="xok-form-error xok-cart-error" style="display:none;"></div>' +
      '<p class="xok-modal-note xok-cart-note">Payments are processed securely by PayPal. You\'ll enter your delivery address as part of PayPal checkout. Shipping abroad is tracked with delivery confirmation — no carrier guarantees a signature internationally at this price, the UK does.</p>' +
      '<button class="xok-modal-close" data-cart-close aria-label="Close">✕</button>' +
      '</div>';
    document.body.appendChild(overlay);

    linesEl = overlay.querySelector('.xok-cart-lines');
    emptyEl = overlay.querySelector('.xok-cart-empty');
    zoneButtonsEl = overlay.querySelectorAll('[data-zone]');
    upgradeWrap = overlay.querySelector('.xok-cart-upgrade');
    upgradeCheckbox = overlay.querySelector('.xok-cart-upgrade-check');
    itemTotalEl = overlay.querySelector('.xok-cart-item-total');
    shipTotalEl = overlay.querySelector('.xok-cart-ship-total');
    grandTotalEl = overlay.querySelector('.xok-cart-grand-total');
    paypalContainer = overlay.querySelector('.xok-cart-paypal');
    cartSuccess = overlay.querySelector('.xok-cart-success');
    cartError = overlay.querySelector('.xok-cart-error');
    checkoutNote = overlay.querySelector('.xok-cart-note');
    shipSection = overlay.querySelector('.xok-cart-ship');

    overlay.addEventListener('click', function (e) { if (e.target === overlay) close(); });
    overlay.querySelectorAll('[data-cart-close]').forEach(function (b) { b.addEventListener('click', close); });

    zoneButtonsEl.forEach(function (b) {
      b.addEventListener('click', function () {
        state.zone = b.getAttribute('data-zone');
        state.upgrade = false;
        if (upgradeCheckbox) upgradeCheckbox.checked = false;
        syncZoneButtons();
        renderAll();
      });
    });

    if (upgradeCheckbox) {
      upgradeCheckbox.addEventListener('change', function () {
        state.upgrade = upgradeCheckbox.checked;
        renderAll();
      });
    }

    linesEl.addEventListener('click', function (e) {
      var line = e.target.closest && e.target.closest('.xok-cart-line');
      if (!line) return;
      var id = line.getAttribute('data-cart-id');
      var variantIndex = Number(line.getAttribute('data-cart-variant'));
      var product = (productsCache || []).find(function (p) { return p.id === id; });
      var stock = product ? (typeof product.stock === 'number' ? product.stock : 1) : 0;
      if (e.target.closest('[data-qty-inc]')) {
        var current = Number(line.getAttribute('data-cart-qty'));
        window.xokoroCart.setQty(id, variantIndex, current + 1, stock);
        renderAll();
      } else if (e.target.closest('[data-qty-dec]')) {
        var current2 = Number(line.getAttribute('data-cart-qty'));
        window.xokoroCart.setQty(id, variantIndex, current2 - 1, stock);
        renderAll();
      } else if (e.target.closest('[data-cart-remove]')) {
        window.xokoroCart.remove(id, variantIndex);
        renderAll();
      }
    });

    built = true;
  }

  function syncZoneButtons() {
    zoneButtonsEl.forEach(function (b) {
      b.classList.toggle('is-selected', b.getAttribute('data-zone') === state.zone);
    });
    var zone = ZONES[state.zone];
    if (zone.upgradeFee) {
      upgradeWrap.style.display = 'flex';
      upgradeWrap.querySelector('.xok-cart-upgrade-text').textContent =
        zone.upgradeLabel + ' — +' + money(zone.upgradeFee) + ' per item';
    } else {
      upgradeWrap.style.display = 'none';
      state.upgrade = false;
      if (upgradeCheckbox) upgradeCheckbox.checked = false;
    }
  }

  function cartLinesWithProducts() {
    var cart = window.xokoroCart.read();
    return cart.map(function (line) {
      var product = (productsCache || []).find(function (p) { return p.id === line.id; });
      return { line: line, product: product };
    });
  }

  function renderLines() {
    var rows = cartLinesWithProducts();
    linesEl.innerHTML = '';
    if (!rows.length) {
      emptyEl.style.display = 'block';
      shipSection.style.display = 'none';
      overlay.querySelector('.xok-cart-totals').style.display = 'none';
      paypalContainer.style.display = 'none';
      checkoutNote.style.display = 'none';
      return;
    }
    emptyEl.style.display = 'none';
    shipSection.style.display = 'block';
    overlay.querySelector('.xok-cart-totals').style.display = 'block';

    rows.forEach(function (row) {
      var product = row.product;
      var lineEl = document.createElement('div');
      lineEl.className = 'xok-cart-line';
      lineEl.setAttribute('data-cart-id', row.line.id);
      lineEl.setAttribute('data-cart-variant', row.line.variantIndex || 0);
      lineEl.setAttribute('data-cart-qty', row.line.qty);

      if (!product || product.tag === 'Sold') {
        lineEl.innerHTML =
          '<div class="xok-cart-line-info">' +
          '<div class="xok-cart-line-title">' + (product ? product.title : 'This piece') + '</div>' +
          '<div class="xok-cart-line-variant">No longer available — please remove it to check out.</div>' +
          '</div>' +
          '<button class="xok-cart-line-remove" data-cart-remove aria-label="Remove">✕</button>';
        linesEl.appendChild(lineEl);
        return;
      }

      var variant = product.variants && product.variants[row.line.variantIndex];
      var img = (variant && variant.images && variant.images[0]) || (product.images && product.images[0]);

      var imgWrap = document.createElement('div');
      imgWrap.className = 'xok-cart-line-img';
      if (img) {
        var imEl = document.createElement('img');
        imEl.src = img;
        imEl.alt = '';
        imgWrap.appendChild(imEl);
      }

      var info = document.createElement('div');
      info.className = 'xok-cart-line-info';
      info.innerHTML =
        '<div class="xok-cart-line-title">' + product.title + '</div>' +
        (variant ? '<div class="xok-cart-line-variant">' + variant.name + '</div>' : '') +
        '<div class="xok-cart-line-price">' + money(product.price) + '</div>' +
        '<div class="xok-cart-line-qty">' +
        '<button type="button" data-qty-dec aria-label="Decrease quantity">−</button>' +
        '<span>' + row.line.qty + '</span>' +
        '<button type="button" data-qty-inc aria-label="Increase quantity"' + (row.line.qty >= (product.stock || 1) ? ' disabled' : '') + '>+</button>' +
        '</div>';

      var removeBtn = document.createElement('button');
      removeBtn.className = 'xok-cart-line-remove';
      removeBtn.setAttribute('data-cart-remove', '');
      removeBtn.setAttribute('aria-label', 'Remove');
      removeBtn.textContent = '✕';

      lineEl.appendChild(imgWrap);
      lineEl.appendChild(info);
      lineEl.appendChild(removeBtn);
      linesEl.appendChild(lineEl);
    });
  }

  function sellableRows() {
    return cartLinesWithProducts().filter(function (row) { return row.product && row.product.tag !== 'Sold'; });
  }

  function computeTotals() {
    var rows = sellableRows();
    var itemTotal = 0;
    var shipTotal = 0;
    rows.forEach(function (row) {
      var qty = row.line.qty;
      itemTotal += row.product.price * qty;
      var weight = typeof row.product.weight === 'number' ? row.product.weight : 50;
      var zone = ZONES[state.zone];
      var perItemFee = (state.upgrade && zone.upgradeFee) ? zone.upgradeFee : feeForWeight(state.zone, weight);
      shipTotal += perItemFee * qty;
    });
    return { itemTotal: itemTotal, shipTotal: shipTotal, grandTotal: itemTotal + shipTotal, rows: rows };
  }

  function renderTotals() {
    var totals = computeTotals();
    itemTotalEl.textContent = money(totals.itemTotal);
    shipTotalEl.textContent = money(totals.shipTotal);
    grandTotalEl.textContent = money(totals.grandTotal);
    return totals;
  }

  function renderPaypalButtons(totals) {
    paypalContainer.innerHTML = '';
    if (!totals.rows.length) {
      paypalContainer.style.display = 'none';
      checkoutNote.style.display = 'none';
      return;
    }
    paypalContainer.style.display = 'block';
    checkoutNote.style.display = 'block';
    if (!window.paypal || !window.paypal.Buttons) {
      cartError.textContent = 'Payment isn\'t available right now — please try again in a moment.';
      cartError.style.display = 'block';
      return;
    }

    var items = totals.rows.map(function (row) {
      var variant = row.product.variants && row.product.variants[row.line.variantIndex];
      return {
        name: (row.product.title + (variant ? ' — ' + variant.name : '')).slice(0, 127),
        quantity: String(row.line.qty),
        unit_amount: { currency_code: 'GBP', value: row.product.price.toFixed(2) },
        category: 'PHYSICAL_GOODS'
      };
    });

    window.paypal.Buttons({
      style: { layout: 'vertical', color: 'black', shape: 'rect', label: 'paypal' },
      createOrder: function (data, actions) {
        return actions.order.create({
          purchase_units: [{
            description: ('Xokoro order — ' + totals.rows.length + ' piece' + (totals.rows.length > 1 ? 's' : '')).slice(0, 127),
            amount: {
              currency_code: 'GBP',
              value: totals.grandTotal.toFixed(2),
              breakdown: {
                item_total: { currency_code: 'GBP', value: totals.itemTotal.toFixed(2) },
                shipping: { currency_code: 'GBP', value: totals.shipTotal.toFixed(2) }
              }
            },
            items: items
          }]
        });
      },
      onApprove: function (data, actions) {
        return actions.order.capture().then(function (details) {
          var firstName = details.payer && details.payer.name && details.payer.name.given_name;
          linesEl.style.display = 'none';
          emptyEl.style.display = 'none';
          shipSection.style.display = 'none';
          overlay.querySelector('.xok-cart-totals').style.display = 'none';
          paypalContainer.style.display = 'none';
          checkoutNote.style.display = 'none';
          cartSuccess.textContent = 'Thank you' + (firstName ? ', ' + firstName : '') + ' — your payment is confirmed. I\'ll be in touch by email to arrange next steps.';
          cartSuccess.style.display = 'block';
          if (window.xokoroTrackEcommerce) {
            window.xokoroTrackEcommerce('purchase', {
              transaction_id: details.id,
              currency: 'GBP',
              value: totals.grandTotal,
              shipping: totals.shipTotal,
              items: totals.rows.map(function (row) {
                return { item_id: row.product.id, item_name: row.product.title, price: row.product.price, quantity: row.line.qty };
              })
            });
          }
          window.xokoroCart.clear();
        });
      },
      onError: function (err) {
        console.error(err);
        cartError.textContent = 'Something went wrong with that payment. Please try again, or get in touch if it keeps happening.';
        cartError.style.display = 'block';
      }
    }).render(paypalContainer);
  }

  function renderAll() {
    renderLines();
    var totals = renderTotals();
    renderPaypalButtons(totals);
  }

  function detectZoneOnce() {
    if (locationChecked) return;
    locationChecked = true;
    fetch('https://ipapi.co/json/').then(function (r) { return r.json(); }).then(function (data) {
      var cc = data && data.country_code;
      if (!cc) return;
      state.zone = cc === 'GB' ? 'uk' : (EUROPE_COUNTRY_CODES.indexOf(cc) > -1 ? 'europe' : 'row');
      syncZoneButtons();
      renderAll();
    }).catch(function () {});
  }

  function open() {
    if (!built) buildDrawer();
    cartSuccess.style.display = 'none';
    cartError.style.display = 'none';
    linesEl.style.display = 'flex';
    overlay.classList.add('is-open');
    loadProducts().then(function () {
      renderAll();
      detectZoneOnce();
    });
  }

  function close() {
    if (overlay) overlay.classList.remove('is-open');
  }

  document.addEventListener('click', function (e) {
    if (e.target.closest && e.target.closest('[data-cart-open]')) {
      e.preventDefault();
      open();
    }
  });

  window.xokoroOpenCart = open;
})();
