/**
 * Precificação Regional — script do storefront.
 *
 * Responsabilidades (Etapas 6 e 7):
 *  - obrigar a escolha de região no primeiro acesso;
 *  - aplicar os preços da região em toda a navegação, sem flash do preço base;
 *  - trocar o variantId submetido no "adicionar ao carrinho";
 *  - trocar a região com carrinho populado sem perder quantidade nem cobrar
 *    o preço da região anterior.
 */
(function () {
  'use strict';

  var CONFIG = window.__REGIONAL_PRICING__ || {};
  var PROXY = (CONFIG.proxyBase || '/apps/regional-pricing').replace(/\/+$/, '');
  var STORAGE_KEY = 'regional_pricing_region';
  var PRICES_KEY = 'regional_pricing_prices';
  var COOKIE_NAME = 'regional_pricing_region';
  var PRICE_TTL_MS = 5 * 60 * 1000;
  var REVEAL_TIMEOUT = CONFIG.revealTimeoutMs || 2000;

  var DEFAULT_PRICE_SELECTORS = [
    '.price',
    '.price-item',
    '.price__regular',
    '.price__sale',
    '.product__price',
    '.money',
    '[data-rp-price]',
  ];

  var state = {
    region: null,
    settings: null,
    regions: [],
    prices: null,
    revealed: false,
  };

  // -------------------------------------------------------------------------
  // Utilitários
  // -------------------------------------------------------------------------

  function log() {
    if (!CONFIG.debug) return;
    var args = Array.prototype.slice.call(arguments);
    args.unshift('[regional-pricing]');
    console.log.apply(console, args);
  }

  function readJSON(storage, key) {
    try {
      var raw = storage.getItem(key);
      return raw ? JSON.parse(raw) : null;
    } catch (err) {
      return null;
    }
  }

  function writeJSON(storage, key, value) {
    try {
      storage.setItem(key, JSON.stringify(value));
    } catch (err) {
      /* modo privado / cota cheia: seguir sem cache */
    }
  }

  function setCookie(name, value, days) {
    var expires = new Date(Date.now() + (days || 180) * 864e5).toUTCString();
    document.cookie =
      name + '=' + encodeURIComponent(value) + '; expires=' + expires + '; path=/; SameSite=Lax';
  }

  function proxyUrl(path, params) {
    var url = PROXY + path;
    if (params) {
      var query = Object.keys(params)
        .filter(function (key) {
          return params[key] !== null && params[key] !== undefined;
        })
        .map(function (key) {
          return encodeURIComponent(key) + '=' + encodeURIComponent(params[key]);
        })
        .join('&');
      if (query) url += '?' + query;
    }
    return url;
  }

  function request(method, url, body) {
    var options = { method: method, headers: { Accept: 'application/json' } };
    if (body !== undefined) {
      options.headers['Content-Type'] = 'application/json';
      options.body = JSON.stringify(body);
    }
    return fetch(url, options).then(function (response) {
      return response.text().then(function (text) {
        var parsed = null;
        try {
          parsed = text ? JSON.parse(text) : null;
        } catch (err) {
          parsed = null;
        }
        if (!response.ok) {
          var error = new Error((parsed && parsed.error) || 'Erro ' + response.status);
          error.status = response.status;
          error.body = parsed;
          throw error;
        }
        return parsed;
      });
    });
  }

  /** Formata usando o money_format da loja, com fallback para pt-BR. */
  function formatMoney(amount) {
    var value = Number(amount);
    if (!isFinite(value)) return '';

    var format = CONFIG.moneyFormat || '';
    var match = format.match(/\{\{\s*(\w+)\s*\}\}/);

    if (!match) {
      return value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
    }

    var placeholder = match[1];
    var formatted;

    if (placeholder.indexOf('with_comma_separator') !== -1 || placeholder === 'amount') {
      // pt-BR: ponto no milhar, vírgula no centavo.
      var parts = value.toFixed(2).split('.');
      formatted = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, '.') + ',' + parts[1];
    } else {
      var dotParts = value.toFixed(2).split('.');
      formatted = dotParts[0].replace(/\B(?=(\d{3})+(?!\d))/g, ',') + '.' + dotParts[1];
    }

    if (placeholder.indexOf('no_decimals') !== -1) {
      formatted = formatted.split(/[.,]/)[0];
    }

    return format.replace(/\{\{\s*\w+\s*\}\}/, formatted);
  }

  function revealPrices() {
    if (state.revealed) return;
    state.revealed = true;
    document.documentElement.classList.remove('rp-prices-hidden');
    log('preços revelados');
  }

  // Nunca deixar a loja com preços invisíveis, mesmo se o app cair.
  window.setTimeout(revealPrices, REVEAL_TIMEOUT);

  // -------------------------------------------------------------------------
  // Estado da região
  // -------------------------------------------------------------------------

  function loadStoredRegion() {
    var stored = readJSON(window.localStorage, STORAGE_KEY);
    if (stored && stored.id && stored.name) return stored;
    return null;
  }

  function persistRegion(region) {
    writeJSON(window.localStorage, STORAGE_KEY, region);
    // Cookie: permite que trechos server-side (Liquid) leiam a região.
    setCookie(COOKIE_NAME, region.id, 180);
    state.region = region;
  }

  function clearStoredPrices() {
    try {
      window.sessionStorage.removeItem(PRICES_KEY);
    } catch (err) {
      /* noop */
    }
  }

  // -------------------------------------------------------------------------
  // Preços
  // -------------------------------------------------------------------------

  function fetchPrices(regionId, force) {
    var cached = readJSON(window.sessionStorage, PRICES_KEY);
    if (
      !force &&
      cached &&
      cached.regionId === regionId &&
      Date.now() - cached.fetchedAt < PRICE_TTL_MS
    ) {
      state.prices = cached.payload;
      return Promise.resolve(cached.payload);
    }

    return request('GET', proxyUrl('/prices', { regionId: regionId })).then(function (payload) {
      state.prices = payload;
      writeJSON(window.sessionStorage, PRICES_KEY, {
        regionId: regionId,
        fetchedAt: Date.now(),
        payload: payload,
      });
      return payload;
    });
  }

  function entryForHandle(handle) {
    if (!state.prices || !handle) return null;
    return state.prices.byHandle[handle] || null;
  }

  function entryForNumericId(id) {
    if (!state.prices || !id) return null;
    return state.prices.byNumericId[String(id)] || null;
  }

  function priceSelectors() {
    var extras = (CONFIG.priceSelectors || '')
      .split('\n')
      .map(function (line) {
        return line.trim();
      })
      .filter(Boolean);
    return DEFAULT_PRICE_SELECTORS.concat(extras).join(', ');
  }

  /** Handle do produto a partir de qualquer link /products/<handle> no card. */
  function handleFromScope(scope) {
    var link = scope.querySelector('a[href*="/products/"]');
    if (!link) return null;
    var match = link.getAttribute('href').match(/\/products\/([^/?#]+)/);
    return match ? match[1] : null;
  }

  function applyPriceToScope(scope, entry) {
    if (!entry) return;

    var nodes = scope.querySelectorAll(priceSelectors());
    var applied = false;

    for (var i = 0; i < nodes.length; i += 1) {
      var node = nodes[i];
      if (node.getAttribute('data-rp-applied') === entry.price) continue;

      // Só substitui folhas de texto: trocar o innerHTML de um container
      // apagaria markup do tema (ícones, labels de "a partir de", etc).
      if (node.children.length === 0) {
        node.textContent = formatMoney(entry.price);
        node.setAttribute('data-rp-applied', entry.price);
        applied = true;
      }
    }

    if (!entry.available) {
      scope.setAttribute('data-rp-unavailable', 'true');
    } else {
      scope.removeAttribute('data-rp-unavailable');
    }

    return applied;
  }

  function applyPrices() {
    if (!state.prices) return;

    // Página de produto: escopo é a página inteira.
    if (CONFIG.productHandle) {
      var entry = entryForHandle(CONFIG.productHandle);
      if (entry) applyPriceToScope(document.body, entry);
    }

    // Cards de coleção / carrosséis: um escopo por card.
    var cards = document.querySelectorAll(
      '.card, .card-wrapper, .grid__item, .product-card, li[class*="product"], [data-rp-card]',
    );

    for (var i = 0; i < cards.length; i += 1) {
      var card = cards[i];
      var handle = handleFromScope(card);
      if (!handle) continue;
      var cardEntry = entryForHandle(handle);
      if (cardEntry) applyPriceToScope(card, cardEntry);
    }

    applyVariantIds();
    revealPrices();
  }

  /**
   * Troca o variantId submetido nos formulários de "adicionar ao carrinho"
   * pelo da região ativa. Sem isso, o cliente compraria a variante base.
   */
  function applyVariantIds() {
    if (!state.prices) return;

    var forms = document.querySelectorAll('form[action*="/cart/add"]');

    for (var i = 0; i < forms.length; i += 1) {
      var form = forms[i];
      var handle = handleFromScope(form) || CONFIG.productHandle;
      var entry = handle ? entryForHandle(handle) : null;

      if (!entry) {
        var idInput = form.querySelector('input[name="id"], select[name="id"]');
        if (idInput && idInput.value) entry = entryForVariant(idInput.value);
      }

      if (!entry || !entry.variantIdNumeric) continue;

      var input = form.querySelector('input[name="id"]');

      if (!input) {
        var select = form.querySelector('select[name="id"]');
        if (select) {
          // Some com o select do tema e submete o id certo por um hidden.
          select.name = 'rp-original-id';
          select.style.display = 'none';
          input = document.createElement('input');
          input.type = 'hidden';
          input.name = 'id';
          form.appendChild(input);
        }
      }

      if (!input) {
        input = document.createElement('input');
        input.type = 'hidden';
        input.name = 'id';
        form.appendChild(input);
      }

      if (input.value !== entry.variantIdNumeric) {
        input.value = entry.variantIdNumeric;
        input.setAttribute('data-rp-variant', 'true');
      }

      if (!entry.available) {
        var buttons = form.querySelectorAll('[type="submit"], button[name="add"]');
        for (var b = 0; b < buttons.length; b += 1) {
          buttons[b].disabled = true;
          buttons[b].setAttribute('data-rp-unavailable', 'true');
        }
      }
    }
  }

  /** Dado um variantId numérico qualquer, acha a entrada do produto. */
  function entryForVariant(variantId) {
    if (!state.prices) return null;
    var byHandle = state.prices.byHandle;
    var keys = Object.keys(byHandle);
    for (var i = 0; i < keys.length; i += 1) {
      if (byHandle[keys[i]].variantIdNumeric === String(variantId)) return byHandle[keys[i]];
    }
    return null;
  }

  // -------------------------------------------------------------------------
  // Pop-up de seleção
  // -------------------------------------------------------------------------

  function buildModal(options) {
    var overlay = document.createElement('div');
    overlay.className = 'rp-overlay';
    overlay.setAttribute('role', 'dialog');
    overlay.setAttribute('aria-modal', 'true');

    var modal = document.createElement('div');
    modal.className = 'rp-modal';
    overlay.appendChild(modal);

    if (options.dismissible) {
      var close = document.createElement('button');
      close.type = 'button';
      close.className = 'rp-close';
      close.setAttribute('aria-label', 'Fechar');
      close.textContent = '×';
      close.addEventListener('click', function () {
        overlay.remove();
        if (options.onDismiss) options.onDismiss();
      });
      modal.appendChild(close);
    }

    return { overlay: overlay, modal: modal };
  }

  function showRegionPicker(options) {
    options = options || {};
    var settings = state.settings || {};
    var blocking = settings.blockNavigation !== false && !options.dismissible;

    var built = buildModal({ dismissible: !blocking, onDismiss: options.onDismiss });
    var modal = built.modal;

    var title = document.createElement('h2');
    title.className = 'rp-title';
    title.textContent = options.title || settings.title || 'Selecione sua região';
    modal.appendChild(title);

    if (settings.subtitle) {
      var subtitle = document.createElement('p');
      subtitle.className = 'rp-subtitle';
      subtitle.textContent = settings.subtitle;
      modal.appendChild(subtitle);
    }

    var message = document.createElement('p');
    message.className = 'rp-message';
    message.style.display = 'none';
    modal.appendChild(message);

    function showMessage(text, isError) {
      message.textContent = text;
      message.style.display = 'block';
      message.className = 'rp-message' + (isError ? ' rp-message--error' : '');
    }

    var mode = settings.mode || 'cep';
    var cepInput = null;
    var citySelect = null;

    if (mode === 'cep' || mode === 'ambos') {
      var cepLabel = document.createElement('label');
      cepLabel.className = 'rp-label';
      cepLabel.textContent = 'Seu CEP';
      modal.appendChild(cepLabel);

      cepInput = document.createElement('input');
      cepInput.type = 'tel';
      cepInput.className = 'rp-input';
      cepInput.placeholder = '00000-000';
      cepInput.setAttribute('inputmode', 'numeric');
      cepInput.setAttribute('autocomplete', 'postal-code');
      cepInput.addEventListener('input', function () {
        var digits = cepInput.value.replace(/\D/g, '').slice(0, 8);
        cepInput.value = digits.length > 5 ? digits.slice(0, 5) + '-' + digits.slice(5) : digits;
      });
      cepLabel.appendChild(cepInput);
    }

    if (mode === 'cidade' || mode === 'ambos') {
      var cityLabel = document.createElement('label');
      cityLabel.className = 'rp-label';
      cityLabel.textContent = 'Sua cidade';
      modal.appendChild(cityLabel);

      citySelect = document.createElement('select');
      citySelect.className = 'rp-input';

      var placeholder = document.createElement('option');
      placeholder.value = '';
      placeholder.textContent = 'Selecione…';
      citySelect.appendChild(placeholder);

      state.regions.forEach(function (region) {
        (region.cities || []).forEach(function (city) {
          var option = document.createElement('option');
          option.value = JSON.stringify({ city: city.city, state: city.state });
          option.textContent = city.city + (city.state ? '/' + city.state : '');
          citySelect.appendChild(option);
        });
      });

      cityLabel.appendChild(citySelect);
    }

    var confirm = document.createElement('button');
    confirm.type = 'button';
    confirm.className = 'rp-button';
    confirm.textContent = 'Confirmar';
    modal.appendChild(confirm);

    function submit() {
      var payload = {};

      if (cepInput && cepInput.value.replace(/\D/g, '').length === 8) {
        payload.cep = cepInput.value.replace(/\D/g, '');
      } else if (citySelect && citySelect.value) {
        var parsed = JSON.parse(citySelect.value);
        payload.city = parsed.city;
        payload.state = parsed.state;
      } else {
        showMessage(
          mode === 'cidade' ? 'Selecione sua cidade.' : 'Digite os 8 dígitos do CEP.',
          true,
        );
        return;
      }

      confirm.disabled = true;
      confirm.textContent = 'Verificando…';

      request('POST', proxyUrl('/resolve-region'), payload)
        .then(function (result) {
          if (!result.region) {
            showMessage(
              result.message || 'Ainda não entregamos nessa região. Tente outro CEP.',
              true,
            );
            return;
          }

          if (options.onSelect) {
            return options.onSelect(result.region, built.overlay);
          }

          persistRegion(result.region);
          clearStoredPrices();
          built.overlay.remove();
          window.location.reload();
        })
        .catch(function (err) {
          showMessage(err.message || 'Não foi possível verificar sua região.', true);
        })
        .finally(function () {
          confirm.disabled = false;
          confirm.textContent = 'Confirmar';
        });
    }

    confirm.addEventListener('click', submit);
    if (cepInput) {
      cepInput.addEventListener('keydown', function (event) {
        if (event.key === 'Enter') submit();
      });
    }

    document.body.appendChild(built.overlay);
    if (cepInput) cepInput.focus();
    else if (citySelect) citySelect.focus();

    return built;
  }

  // -------------------------------------------------------------------------
  // Badge da região ativa
  // -------------------------------------------------------------------------

  function renderBadge() {
    if (CONFIG.badgeEnabled === false || !state.region) return;

    var existing = document.querySelector('[data-rp-badge]');
    if (existing) existing.remove();

    var badge = document.createElement('button');
    badge.type = 'button';
    badge.className = 'rp-badge';
    badge.setAttribute('data-rp-badge', 'true');
    badge.innerHTML =
      '<span class="rp-badge__label">Entregar em</span>' +
      '<span class="rp-badge__region"></span>' +
      '<span class="rp-badge__action">trocar</span>';
    badge.querySelector('.rp-badge__region').textContent = state.region.name;

    badge.addEventListener('click', function () {
      startRegionChange();
    });

    var host = CONFIG.badgeSelector ? document.querySelector(CONFIG.badgeSelector) : null;
    if (host) {
      host.appendChild(badge);
    } else {
      badge.classList.add('rp-badge--floating');
      document.body.appendChild(badge);
    }
  }

  // -------------------------------------------------------------------------
  // Etapa 7 — troca de região com carrinho populado
  // -------------------------------------------------------------------------

  function getCart() {
    return fetch('/cart.js', { headers: { Accept: 'application/json' } }).then(function (r) {
      if (!r.ok) throw new Error('Não foi possível ler o carrinho.');
      return r.json();
    });
  }

  function cartPost(path, body) {
    return fetch(path, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify(body),
    }).then(function (response) {
      return response.text().then(function (text) {
        var parsed = null;
        try {
          parsed = text ? JSON.parse(text) : null;
        } catch (err) {
          parsed = null;
        }
        if (!response.ok) {
          throw new Error((parsed && (parsed.description || parsed.message)) || 'Erro no carrinho');
        }
        return parsed;
      });
    });
  }

  /** Monta o plano de troca: o que vira o quê, e o que será removido. */
  function planCartMigration(cart, newPrices) {
    var moves = [];
    var removals = [];
    var needsPerLine = false;

    cart.items.forEach(function (item) {
      var entry =
        newPrices.byHandle[item.handle] ||
        newPrices.byNumericId[String(item.product_id)] ||
        null;

      if (!entry || !entry.available || !entry.variantIdNumeric) {
        removals.push(item);
        return;
      }

      if (String(item.variant_id) === entry.variantIdNumeric) return;

      // Assinatura ou propriedades de linha não sobrevivem a update.js:
      // essas linhas precisam de remove + add individual.
      var hasSellingPlan = Boolean(item.selling_plan_allocation);
      var hasProperties = Boolean(item.properties) && Object.keys(item.properties).length > 0;

      if (hasSellingPlan || hasProperties) needsPerLine = true;

      moves.push({
        item: item,
        fromVariantId: String(item.variant_id),
        toVariantId: entry.variantIdNumeric,
        quantity: item.quantity,
        sellingPlanId: hasSellingPlan ? item.selling_plan_allocation.selling_plan.id : null,
        properties: item.properties || null,
      });
    });

    return { moves: moves, removals: removals, needsPerLine: needsPerLine };
  }

  function applyMigration(plan, region, attributeName) {
    var attributes = {};
    attributes[attributeName] = region.name;

    // Caminho preferido: uma única chamada zera as variantes antigas e cria as
    // novas já com a quantidade correta.
    if (!plan.needsPerLine) {
      var updates = {};
      plan.moves.forEach(function (move) {
        updates[move.fromVariantId] = 0;
        updates[move.toVariantId] = move.quantity;
      });
      plan.removals.forEach(function (item) {
        updates[String(item.variant_id)] = 0;
      });

      return cartPost('/cart/update.js', { updates: updates, attributes: attributes });
    }

    // Caminho por linha: preserva selling plan (Loop) e propriedades.
    var chain = Promise.resolve();

    plan.removals.forEach(function (item) {
      chain = chain.then(function () {
        return cartPost('/cart/change.js', { id: item.key, quantity: 0 });
      });
    });

    plan.moves.forEach(function (move) {
      chain = chain
        .then(function () {
          return cartPost('/cart/change.js', { id: move.item.key, quantity: 0 });
        })
        .then(function () {
          var line = { id: Number(move.toVariantId), quantity: move.quantity };
          if (move.sellingPlanId) line.selling_plan = move.sellingPlanId;
          if (move.properties && Object.keys(move.properties).length > 0) {
            line.properties = move.properties;
          }
          return cartPost('/cart/add.js', { items: [line] });
        });
    });

    return chain.then(function () {
      return cartPost('/cart/update.js', { attributes: attributes });
    });
  }

  /** Restaura o carrinho ao estado anterior quando a troca falha no meio. */
  function rollbackCart(snapshot) {
    var updates = {};
    snapshot.items.forEach(function (item) {
      updates[String(item.variant_id)] = item.quantity;
    });
    return cartPost('/cart/update.js', { updates: updates }).catch(function () {
      /* melhor esforço: o erro original já será exibido */
    });
  }

  function startRegionChange() {
    showRegionPicker({
      title: 'Trocar região',
      dismissible: true,
      onSelect: function (newRegion, overlay) {
        if (state.region && state.region.id === newRegion.id) {
          overlay.remove();
          return;
        }
        overlay.remove();
        return confirmAndMigrate(newRegion);
      },
    });
  }

  function confirmAndMigrate(newRegion) {
    var previousRegion = state.region;

    return getCart()
      .then(function (cart) {
        // Carrinho vazio: nada a migrar.
        if (!cart.items || cart.items.length === 0) {
          persistRegion(newRegion);
          clearStoredPrices();
          return cartPost('/cart/update.js', {
            attributes: buildAttributes(newRegion),
          })
            .catch(function () {
              /* atributo é auditoria; não bloqueia a troca */
            })
            .then(function () {
              window.location.reload();
            });
        }

        // Precisa do mapa da região nova antes de confirmar, para saber quais
        // itens seriam removidos.
        return request('GET', proxyUrl('/prices', { regionId: newRegion.id })).then(
          function (newPrices) {
            var plan = planCartMigration(cart, newPrices);
            return showMigrationConfirm(cart, plan, newRegion, previousRegion, newPrices);
          },
        );
      })
      .catch(function (err) {
        window.alert(err.message || 'Não foi possível trocar de região.');
      });
  }

  function buildAttributes(region) {
    var attributes = {};
    attributes[CONFIG.cartAttributeName || 'Região'] = region.name;
    return attributes;
  }

  function showMigrationConfirm(cart, plan, newRegion, previousRegion, newPrices) {
    return new Promise(function (resolve) {
      var built = buildModal({ dismissible: true, onDismiss: resolve });
      var modal = built.modal;

      var title = document.createElement('h2');
      title.className = 'rp-title';
      title.textContent = 'Trocar para ' + newRegion.name + '?';
      modal.appendChild(title);

      var text = document.createElement('p');
      text.className = 'rp-subtitle';
      text.textContent =
        'Ao mudar para ' +
        newRegion.name +
        ', os preços dos itens do seu carrinho serão atualizados.';
      modal.appendChild(text);

      if (plan.removals.length > 0) {
        var warning = document.createElement('div');
        warning.className = 'rp-warning';
        var names = plan.removals
          .map(function (item) {
            return item.product_title || item.title;
          })
          .join(', ');
        warning.textContent =
          plan.removals.length === 1
            ? 'O item "' + names + '" não é vendido nessa região e será removido do carrinho.'
            : 'Estes itens não são vendidos nessa região e serão removidos: ' + names + '.';
        modal.appendChild(warning);
      }

      var actions = document.createElement('div');
      actions.className = 'rp-actions';
      modal.appendChild(actions);

      var cancel = document.createElement('button');
      cancel.type = 'button';
      cancel.className = 'rp-button rp-button--secondary';
      cancel.textContent = 'Cancelar';
      cancel.addEventListener('click', function () {
        built.overlay.remove();
        resolve();
      });
      actions.appendChild(cancel);

      var confirm = document.createElement('button');
      confirm.type = 'button';
      confirm.className = 'rp-button';
      confirm.textContent = 'Continuar';
      actions.appendChild(confirm);

      var errorBox = document.createElement('p');
      errorBox.className = 'rp-message rp-message--error';
      errorBox.style.display = 'none';
      modal.appendChild(errorBox);

      confirm.addEventListener('click', function () {
        confirm.disabled = true;
        cancel.disabled = true;
        confirm.textContent = 'Atualizando carrinho…';

        applyMigration(plan, newRegion, CONFIG.cartAttributeName || 'Região')
          .then(function () {
            // A região só muda no cliente DEPOIS que o carrinho fechou certo.
            persistRegion(newRegion);
            clearStoredPrices();
            writeJSON(window.sessionStorage, PRICES_KEY, {
              regionId: newRegion.id,
              fetchedAt: Date.now(),
              payload: newPrices,
            });
            built.overlay.remove();
            window.location.reload();
            resolve();
          })
          .catch(function (err) {
            // Estado inconsistente é o pior desfecho: desfaz e mantém a região antiga.
            return rollbackCart(cart).then(function () {
              if (previousRegion) persistRegion(previousRegion);
              errorBox.textContent =
                (err.message || 'Falha ao atualizar o carrinho.') +
                ' Sua região continua sendo ' +
                (previousRegion ? previousRegion.name : 'a anterior') +
                '.';
              errorBox.style.display = 'block';
              confirm.disabled = false;
              cancel.disabled = false;
              confirm.textContent = 'Tentar novamente';
            });
          });
      });

      document.body.appendChild(built.overlay);
    });
  }

  // -------------------------------------------------------------------------
  // Boot
  // -------------------------------------------------------------------------

  function ensureCartAttribute() {
    if (!state.region) return;
    getCart()
      .then(function (cart) {
        var name = CONFIG.cartAttributeName || 'Região';
        if (!cart.items || cart.items.length === 0) return;
        if (cart.attributes && cart.attributes[name] === state.region.name) return;
        return cartPost('/cart/update.js', { attributes: buildAttributes(state.region) });
      })
      .catch(function () {
        /* auditoria: não bloqueia a navegação */
      });
  }

  function observeDom() {
    // Temas com carregamento assíncrono (quick view, paginação infinita,
    // seções recarregadas) reinjetam preços depois do load.
    var pending = null;
    var observer = new MutationObserver(function () {
      if (pending) window.clearTimeout(pending);
      pending = window.setTimeout(function () {
        applyPrices();
      }, 100);
    });

    observer.observe(document.body, { childList: true, subtree: true });
  }

  function boot() {
    request('GET', proxyUrl('/regions'))
      .then(function (data) {
        state.regions = data.regions || [];
        state.settings = data.settings || {};

        var stored = loadStoredRegion();

        // Região salva que não existe mais (foi excluída): pede de novo.
        var stillValid =
          stored &&
          state.regions.some(function (region) {
            return region.id === stored.id;
          });

        if (stillValid) {
          state.region = stored;
          return fetchPrices(stored.id)
            .then(function () {
              applyPrices();
              renderBadge();
              ensureCartAttribute();
            })
            .catch(function (err) {
              log('falha ao carregar preços', err);
              revealPrices();
            });
        }

        revealPrices();
        showRegionPicker({});
      })
      .catch(function (err) {
        // App fora do ar não pode derrubar a loja: mostra o preço base.
        log('falha ao carregar configuração', err);
        revealPrices();
      });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function () {
      boot();
      observeDom();
    });
  } else {
    boot();
    observeDom();
  }

  // API pública mínima, útil para o tema e para depuração.
  window.RegionalPricing = {
    getRegion: function () {
      return state.region;
    },
    changeRegion: startRegionChange,
    refresh: function () {
      if (!state.region) return Promise.resolve();
      return fetchPrices(state.region.id, true).then(applyPrices);
    },
  };
})();
