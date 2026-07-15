/**
 * Xokoro — product catalogue
 * Loads /content/products.json (edited via the Decap CMS at /admin) and
 * renders either the home feed (index.html) or a single product page
 * (product.html?id=<slug>). No build step required — this runs entirely
 * in the browser against the static JSON file.
 */
(function () {
  'use strict';

  var DATA_URL = (function () {
    // resolve content/products.json relative to the site root regardless
    // of which page includes this script
    var depth = document.body.getAttribute('data-root') || '.';
    return depth.replace(/\/$/, '') + '/content/products.json';
  })();

  var PER_PAGE = 20;
  var state = { colour: 'All', category: 'All', material: 'All', sort: 'newest', page: 1 };

  function fetchProducts() {
    return fetch(DATA_URL, { cache: 'no-store' })
      .then(function (r) {
        if (!r.ok) throw new Error('Could not load product catalogue');
        return r.json();
      })
      .then(function (data) {
        var products = (data && data.products) || [];
        products.forEach(function (p, i) {
          p._no = 'No. ' + String(i + 1).padStart(3, '0');
          p._order = i;
        });
        return products;
      });
  }

  function tagClass(tag) {
    if (tag === 'Ready to ship') return 'tag-ready';
    if (tag === 'Made to order') return 'tag-order';
    if (tag === 'Sold') return 'tag-sold';
    return '';
  }

  function money(n) {
    return '£' + n;
  }

  function uniqueSorted(arr) {
    return Array.from(new Set(arr.filter(Boolean))).sort(function (a, b) { return a.localeCompare(b); });
  }

  function fillSelect(select, options, allLabel) {
    select.innerHTML = '';
    var allOpt = document.createElement('option');
    allOpt.value = 'All';
    allOpt.textContent = allLabel;
    select.appendChild(allOpt);
    options.forEach(function (o) {
      var opt = document.createElement('option');
      opt.value = o;
      opt.textContent = o;
      select.appendChild(opt);
    });
  }

  function setImage(container, src, fallbackLetter) {
    container.innerHTML = '';
    if (src) {
      var img = document.createElement('img');
      img.src = src;
      img.loading = 'lazy';
      img.alt = '';
      container.appendChild(img);
      container.classList.remove('xok-noimg');
    } else {
      container.classList.add('xok-noimg');
      var span = document.createElement('span');
      span.className = 'xok-noimg-letter';
      span.textContent = fallbackLetter || '';
      container.appendChild(span);
    }
  }

  /* ============================== HOME FEED ============================== */

  function initFeed(products) {
    var grid = document.getElementById('xok-grid');
    var empty = document.getElementById('xok-empty');
    var pagination = document.getElementById('xok-pagination');
    var resultCount = document.getElementById('xok-result-count');
    var colourSelect = document.getElementById('xok-filter-colour');
    var categorySelect = document.getElementById('xok-filter-category');
    var materialSelect = document.getElementById('xok-filter-material');
    var sortSelect = document.getElementById('xok-sort');
    var resetBtn = document.getElementById('xok-reset');

    fillSelect(colourSelect, uniqueSorted(products.map(function (p) { return p.colour; })), 'All colours');
    fillSelect(categorySelect, uniqueSorted(products.map(function (p) { return p.category; })), 'All types');
    fillSelect(materialSelect, uniqueSorted(products.map(function (p) { return p.material; })), 'All materials');

    function filteredSorted() {
      var list = products.slice();
      if (state.colour !== 'All') list = list.filter(function (p) { return p.colour === state.colour; });
      if (state.category !== 'All') list = list.filter(function (p) { return p.category === state.category; });
      if (state.material !== 'All') list = list.filter(function (p) { return p.material === state.material; });
      if (state.sort === 'price-asc') list.sort(function (a, b) { return a.price - b.price; });
      else if (state.sort === 'price-desc') list.sort(function (a, b) { return b.price - a.price; });
      else list.sort(function (a, b) { return a._order - b._order; });
      return list;
    }

    function card(p) {
      var a = document.createElement('a');
      a.className = 'xok-card' + (p.tag === 'Sold' ? ' is-sold' : '');
      a.href = 'product.html?id=' + encodeURIComponent(p.id);

      var imgWrap = document.createElement('div');
      imgWrap.className = 'xok-card-img';
      setImage(imgWrap, p.images && p.images[0], p.title ? p.title[0] : '');

      var no = document.createElement('span');
      no.className = 'xok-card-no';
      no.textContent = p._no;
      imgWrap.appendChild(no);

      var tag = document.createElement('span');
      tag.className = 'xok-tag ' + tagClass(p.tag);
      tag.textContent = p.tag || '';
      imgWrap.appendChild(tag);

      var shareBtn = document.createElement('button');
      shareBtn.className = 'xok-card-share';
      shareBtn.title = 'Share this piece';
      shareBtn.setAttribute('aria-label', 'Share this piece');
      shareBtn.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" width="15" height="15"><path d="M4 12v6a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-6"/><polyline points="16 6 12 2 8 6"/><line x1="12" y1="2" x2="12" y2="15"/></svg>';
      shareBtn.addEventListener('click', function (e) {
        e.preventDefault();
        e.stopPropagation();
        window.xokoroShare(p.title, p._no, p.id);
      });
      imgWrap.appendChild(shareBtn);

      if (p.tag !== 'Sold' && (typeof p.stock !== 'number' || p.stock > 0)) {
        var addBtn = document.createElement('button');
        addBtn.className = 'xok-card-add';
        addBtn.title = 'Add to cart';
        addBtn.setAttribute('aria-label', 'Add to cart');
        addBtn.textContent = '+';
        addBtn.addEventListener('click', function (e) {
          e.preventDefault();
          e.stopPropagation();
          window.xokoroCart.add(p.id, 0, 1, typeof p.stock === 'number' ? p.stock : 1);
          window.xokoroToast('Added to cart');
          if (window.xokoroTrackEcommerce) {
            window.xokoroTrackEcommerce('add_to_cart', {
              currency: 'GBP',
              value: p.price,
              items: [{ item_id: p.id, item_name: p.title, price: p.price, quantity: 1 }]
            });
          }
        });
        imgWrap.appendChild(addBtn);
      }

      var row = document.createElement('div');
      row.className = 'xok-card-row';
      var title = document.createElement('span');
      title.className = 'xok-card-title';
      title.textContent = p.title;
      var price = document.createElement('span');
      price.className = 'xok-card-price';
      price.textContent = money(p.price);
      row.appendChild(title);
      row.appendChild(price);

      var material = document.createElement('span');
      material.className = 'xok-card-material';
      material.textContent = p.material;

      a.addEventListener('click', function () {
        if (window.xokoroTrackEcommerce) {
          window.xokoroTrackEcommerce('select_item', {
            items: [{ item_id: p.id, item_name: p.title, price: p.price }]
          });
        }
      });

      a.appendChild(imgWrap);
      a.appendChild(row);
      a.appendChild(material);
      return a;
    }

    function render() {
      var list = filteredSorted();
      var total = list.length;
      var totalPages = Math.max(1, Math.ceil(total / PER_PAGE));
      var page = Math.min(state.page, totalPages);
      state.page = page;
      var start = (page - 1) * PER_PAGE;
      var slice = list.slice(start, start + PER_PAGE);

      resultCount.textContent = total + (total === 1 ? ' piece' : ' pieces');

      grid.innerHTML = '';
      if (total === 0) {
        grid.style.display = 'none';
        empty.style.display = 'block';
      } else {
        grid.style.display = 'grid';
        empty.style.display = 'none';
        slice.forEach(function (p) { grid.appendChild(card(p)); });
      }

      pagination.innerHTML = '';
      if (total > 0 && totalPages > 1) {
        var prev = document.createElement('button');
        prev.className = 'xok-page-nav';
        prev.textContent = '← Prev';
        prev.disabled = page <= 1;
        prev.addEventListener('click', function () { state.page = Math.max(1, page - 1); render(); window.scrollTo(0, 0); });
        pagination.appendChild(prev);

        for (var n = 1; n <= totalPages; n++) {
          (function (n) {
            var b = document.createElement('button');
            b.className = 'xok-page-btn' + (n === page ? ' is-active' : '');
            b.textContent = String(n);
            b.addEventListener('click', function () { state.page = n; render(); window.scrollTo(0, 0); });
            pagination.appendChild(b);
          })(n);
        }

        var next = document.createElement('button');
        next.className = 'xok-page-nav';
        next.textContent = 'Next →';
        next.disabled = page >= totalPages;
        next.addEventListener('click', function () { state.page = Math.min(totalPages, page + 1); render(); window.scrollTo(0, 0); });
        pagination.appendChild(next);
      }
    }

    colourSelect.addEventListener('change', function () { state.colour = colourSelect.value; state.page = 1; render(); });
    categorySelect.addEventListener('change', function () { state.category = categorySelect.value; state.page = 1; render(); });
    materialSelect.addEventListener('change', function () { state.material = materialSelect.value; state.page = 1; render(); });
    sortSelect.addEventListener('change', function () { state.sort = sortSelect.value; state.page = 1; render(); });
    if (resetBtn) {
      resetBtn.addEventListener('click', function () {
        state.colour = 'All'; state.category = 'All'; state.material = 'All'; state.page = 1;
        colourSelect.value = 'All'; categorySelect.value = 'All'; materialSelect.value = 'All';
        render();
      });
    }

    render();

    var feedLink = document.querySelector('[data-scroll-to-feed]');
    if (feedLink) {
      feedLink.addEventListener('click', function (e) {
        e.preventDefault();
        var el = document.getElementById('xok-feed');
        if (el) {
          var r = el.getBoundingClientRect();
          window.scrollTo({ top: window.scrollY + r.top - 56, behavior: 'smooth' });
        }
      });
    }
  }

  /* ============================ PRODUCT DETAIL ============================ */

  function initProductPage(products) {
    var params = new URLSearchParams(location.search);
    var id = params.get('id');
    var product = products.find(function (p) { return p.id === id; }) || products[0];
    if (!product) return;

    if (window.xokoroTrackEcommerce) {
      window.xokoroTrackEcommerce('view_item', {
        items: [{ item_id: product.id, item_name: product.title, price: product.price }]
      });
    }

    var variantIndex = 0;
    var imgIndex = 0;

    function currentImages() {
      var variant = product.variants && product.variants[variantIndex];
      if (variant && variant.images && variant.images.length) return variant.images;
      // Falls back to the product's own photos if the selected colourway
      // doesn't have its own set yet (e.g. a variant was added before
      // photos were uploaded for it).
      return product.images || [];
    }

    var imgBox = document.getElementById('xok-product-img');
    var noBadge = document.getElementById('xok-product-no');
    var thumbs = document.getElementById('xok-thumbs');
    var prevBtn = document.getElementById('xok-img-prev');
    var nextBtn = document.getElementById('xok-img-next');

    function renderGallery() {
      var imgs = currentImages();
      if (imgIndex >= imgs.length) imgIndex = 0;
      setImage(imgBox, imgs[imgIndex], product.title ? product.title[0] : '');
      // re-append the nav controls that setImage cleared out
      imgBox.appendChild(prevBtn);
      imgBox.appendChild(nextBtn);
      imgBox.appendChild(noBadge);

      thumbs.innerHTML = '';
      imgs.forEach(function (src, k) {
        var b = document.createElement('button');
        b.className = 'xok-thumb' + (k === imgIndex ? ' is-active' : '');
        var im = document.createElement('img');
        im.src = src;
        im.alt = '';
        b.appendChild(im);
        b.addEventListener('click', function () { imgIndex = k; renderGallery(); });
        thumbs.appendChild(b);
      });
    }

    noBadge.textContent = product._no;
    prevBtn.addEventListener('click', function () {
      var imgs = currentImages();
      imgIndex = (imgIndex - 1 + imgs.length) % imgs.length;
      renderGallery();
    });
    nextBtn.addEventListener('click', function () {
      var imgs = currentImages();
      imgIndex = (imgIndex + 1) % imgs.length;
      renderGallery();
    });

    document.getElementById('xok-product-tag').textContent = product.tag || '';
    document.getElementById('xok-product-tag').className = 'xok-tag ' + tagClass(product.tag);
    document.title = product.title + ' — Xokoro';
    document.getElementById('xok-product-title').textContent = product.title;
    document.getElementById('xok-product-price').textContent = money(product.price);
    document.getElementById('xok-product-desc').textContent = product.description || '';

    var variantsWrap = document.getElementById('xok-variants');
    var variantChips = document.getElementById('xok-variant-chips');
    if (product.variants && product.variants.length) {
      variantsWrap.style.display = 'block';
      function renderChips() {
        variantChips.innerHTML = '';
        product.variants.forEach(function (v, k) {
          var b = document.createElement('button');
          b.className = 'xok-variant-chip' + (k === variantIndex ? ' is-selected' : '');
          var dot = document.createElement('span');
          dot.className = 'xok-variant-dot';
          dot.style.background = v.swatch || '#999';
          b.appendChild(dot);
          b.appendChild(document.createTextNode(v.name));
          b.addEventListener('click', function () {
            variantIndex = k;
            imgIndex = 0;
            renderChips();
            renderGallery();
          });
          variantChips.appendChild(b);
        });
      }
      renderChips();
    } else {
      variantsWrap.style.display = 'none';
    }

    var materialsList = document.getElementById('xok-materials-list');
    materialsList.innerHTML = '';
    (product.materials || []).forEach(function (m) {
      var li = document.createElement('li');
      li.textContent = m;
      materialsList.appendChild(li);
    });

    renderGallery();

    var shareBtn = document.getElementById('xok-share-btn');
    if (shareBtn) shareBtn.addEventListener('click', function () { window.xokoroShare(product.title, product._no, product.id); });

    // checkout stub — skipped entirely for sold pieces, which get a notice instead
    var ctaGroup = document.querySelector('.xok-cta-group');
    if (product.tag === 'Sold' && ctaGroup) {
      ctaGroup.innerHTML = '';
      var soldNotice = document.createElement('div');
      soldNotice.className = 'xok-sold-notice';
      soldNotice.textContent = 'This piece has been sold. Its page stays up as a record of the work — get in touch if you\'d like something similar made.';
      ctaGroup.appendChild(soldNotice);
    }

    // Add to cart — actual checkout (shipping zone, PayPal) lives in the
    // shared cart drawer (assets/js/cart.js), reachable from the nav on
    // every page, since a cart can span more than this one product.
    var addBtn = document.getElementById('xok-add-to-cart');
    if (addBtn && product.tag !== 'Sold') {
      var qtyValueEl = document.getElementById('xok-add-qty-value');
      var qtyDecBtn = document.getElementById('xok-add-qty-dec');
      var qtyIncBtn = document.getElementById('xok-add-qty-inc');
      var addNote = document.getElementById('xok-add-note');
      var stock = typeof product.stock === 'number' ? product.stock : 1;
      var qty = 1;

      function syncQtyUI() {
        qtyValueEl.textContent = String(qty);
        qtyDecBtn.disabled = qty <= 1;
        qtyIncBtn.disabled = qty >= stock;
      }
      syncQtyUI();

      if (stock < 1) {
        addBtn.disabled = true;
        addBtn.textContent = 'Out of stock';
      } else {
        qtyDecBtn.addEventListener('click', function () { qty = Math.max(1, qty - 1); syncQtyUI(); });
        qtyIncBtn.addEventListener('click', function () { qty = Math.min(stock, qty + 1); syncQtyUI(); });
        addBtn.addEventListener('click', function () {
          window.xokoroCart.add(product.id, variantIndex, qty, stock);
          addNote.textContent = 'Added to cart — open the cart from the nav to check out.';
          addNote.style.display = 'block';
          if (window.xokoroTrackEcommerce) {
            window.xokoroTrackEcommerce('add_to_cart', {
              currency: 'GBP',
              value: product.price * qty,
              items: [{ item_id: product.id, item_name: product.title, price: product.price, quantity: qty }]
            });
          }
        });
      }
    }
  }

  /* ================================ BOOT ================================ */

  document.addEventListener('DOMContentLoaded', function () {
    fetchProducts().then(function (products) {
      if (document.getElementById('xok-grid')) initFeed(products);
      if (document.getElementById('xok-product-root')) initProductPage(products);
    }).catch(function (err) {
      console.error(err);
      var grid = document.getElementById('xok-grid');
      if (grid) grid.innerHTML = '<p style="font-family:var(--mono);font-size:13px;opacity:.6;">Could not load the catalogue right now.</p>';
    });
  });
})();
