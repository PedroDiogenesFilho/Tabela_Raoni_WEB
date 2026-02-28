(function () {
  const STORAGE_KEY = 'trConsentV1';
  const CONSENT_VERSION = 1;
  const ADSENSE_SRC = 'https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=ca-pub-5754272579077136';
  const GTAG_SRC = 'https://www.googletagmanager.com/gtag/js?id=G-QLZDGBFWT3';
  const DENIED = 'denied';
  const GRANTED = 'granted';

  let currentConsent = null;
  let originalBodyOverflow = null;
  const adsAllowedOnPage = !document.querySelector('meta[name="tr-ads-policy"][content="disabled"]');

  const defaultConsent = {
    version: CONSENT_VERSION,
    decision: 'pending',
    analytics: false,
    ads: false,
    personalization: false,
    updatedAt: null
  };

  function normalizeConsentForPage(consent) {
    const normalized = { ...defaultConsent, ...consent };

    if (!adsAllowedOnPage) {
      normalized.ads = false;
      normalized.personalization = false;
    }

    if (!normalized.ads) {
      normalized.personalization = false;
    }

    return {
      decision: normalized.decision,
      analytics: normalized.analytics,
      ads: normalized.ads,
      personalization: normalized.personalization,
      version: normalized.version,
      updatedAt: normalized.updatedAt
    };
  }

  function readConsent() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return { ...defaultConsent };
      const parsed = JSON.parse(raw);
      if (!parsed || parsed.version !== CONSENT_VERSION) return { ...defaultConsent };
      return { ...defaultConsent, ...parsed };
    } catch (err) {
      return { ...defaultConsent };
    }
  }

  function saveConsent(nextConsent) {
    currentConsent = { ...defaultConsent, ...nextConsent, version: CONSENT_VERSION, updatedAt: new Date().toISOString() };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(currentConsent));
    applyConsent(currentConsent);
    if (currentConsent.decision !== 'pending') {
      hideBanner();
    }
  }

  function ensureScript(id, src, attrs) {
    if (document.getElementById(id)) return;
    const script = document.createElement('script');
    script.id = id;
    script.src = src;
    script.async = true;
    if (attrs) {
      Object.entries(attrs).forEach(([key, value]) => {
        script.setAttribute(key, value);
      });
    }
    document.head.appendChild(script);
  }

  function setupGtagStub() {
    if (!window.dataLayer) window.dataLayer = [];
    if (!window.gtag) {
      window.gtag = function gtag() {
        window.dataLayer.push(arguments);
      };
    }
  }

  function toConsentModePayload(consent) {
    return {
      ad_storage: consent.ads ? GRANTED : DENIED,
      analytics_storage: consent.analytics ? GRANTED : DENIED,
      ad_user_data: consent.ads ? GRANTED : DENIED,
      ad_personalization: consent.personalization ? GRANTED : DENIED
    };
  }

  function initConsentModeDefaults() {
    setupGtagStub();
    window.gtag('consent', 'default', {
      ad_storage: DENIED,
      analytics_storage: DENIED,
      ad_user_data: DENIED,
      ad_personalization: DENIED
    });
  }

  function updateConsentMode(consent) {
    setupGtagStub();
    window.gtag('consent', 'update', toConsentModePayload(consent));
  }

  function loadAnalytics() {
    setupGtagStub();
    ensureScript('tr-gtag-js', GTAG_SRC);
    window.gtag('js', new Date());
    window.gtag('config', 'G-QLZDGBFWT3');

  }

  function loadAds(consent) {
    window.adsbygoogle = window.adsbygoogle || [];
    if (!consent.personalization) {
      window.adsbygoogle.requestNonPersonalizedAds = 1;
    }
    ensureScript('tr-adsense-js', ADSENSE_SRC, { crossorigin: 'anonymous' });
  }

  function applyConsent(consent) {
    updateConsentMode(consent);
    if (consent.analytics) {
      loadAnalytics();
    }
    if (consent.ads && adsAllowedOnPage) {
      loadAds(consent);
    }
  }


  initConsentModeDefaults();

  function hideBanner() {
    const root = document.getElementById('consent-root');
    const backdrop = document.getElementById('consent-backdrop');
    if (root) root.hidden = true;
    if (backdrop) backdrop.hidden = true;
    if (originalBodyOverflow !== null) {
      document.body.style.overflow = originalBodyOverflow;
      originalBodyOverflow = null;
    }
  }

  function showBanner() {
    const root = document.getElementById('consent-root');
    const backdrop = document.getElementById('consent-backdrop');
    if (root) root.hidden = false;
    if (backdrop) backdrop.hidden = false;
    const panel = document.getElementById('consent-panel');
    if (panel) panel.hidden = true;
    if (originalBodyOverflow === null) {
      originalBodyOverflow = document.body.style.overflow;
    }
    document.body.style.overflow = 'hidden';
    const initialFocusButton = document.getElementById('consent-accept') || document.getElementById('consent-reject') || document.getElementById('consent-customize');
    if (initialFocusButton) {
      initialFocusButton.focus();
    }
  }

  function createUI() {
    const style = document.createElement('style');
    style.textContent = `
      .consent-backdrop{position:fixed;inset:0;background:rgba(3,7,20,.6);z-index:999}
      .consent-backdrop[hidden]{display:none !important}
      .consent-root{position:fixed;top:50%;left:50%;transform:translate(-50%,-50%);width:min(760px,calc(100vw - 32px));z-index:1000;background:#0c1330;color:#eef2ff;border:1px solid rgba(164,180,230,.35);border-radius:14px;padding:14px;box-shadow:0 18px 50px rgba(3,7,20,.55)}
      .consent-title{font-size:1rem;font-weight:800;margin:0 0 8px}
      .consent-text{margin:0;color:#cbd5ff;line-height:1.45;font-size:.92rem}
      .consent-actions{display:flex;flex-wrap:wrap;gap:8px;margin-top:12px}
      .consent-btn{border:1px solid rgba(164,180,230,.4);background:rgba(255,255,255,.06);color:#fff;padding:9px 12px;border-radius:999px;font-weight:700;cursor:pointer}
      .consent-btn.primary{background:linear-gradient(120deg, rgba(79,125,255,1) 0%, rgba(123,108,255,1) 45%, rgba(180,76,255,1) 100%);border:none}
      .consent-panel{margin-top:12px;border-top:1px solid rgba(164,180,230,.22);padding-top:12px;display:grid;gap:8px}
      .consent-panel[hidden]{display:none !important}
      .consent-option{display:flex;gap:8px;align-items:flex-start;color:#d8e0ff;font-size:.9rem}
      .consent-review-link{background:none;border:none;color:inherit;text-decoration:underline;cursor:pointer;padding:0;font:inherit;opacity:.9}
    `;
    document.head.appendChild(style);

    const backdrop = document.createElement('div');
    backdrop.className = 'consent-backdrop';
    backdrop.id = 'consent-backdrop';
    backdrop.hidden = true;
    backdrop.addEventListener('click', function (event) {
      event.preventDefault();
    });
    document.body.appendChild(backdrop);

    const root = document.createElement('section');
    root.className = 'consent-root';
    root.id = 'consent-root';
    root.setAttribute('role', 'dialog');
    root.setAttribute('aria-modal', 'true');
    root.setAttribute('aria-live', 'polite');
    root.hidden = true;
    root.innerHTML = `
      <h2 class="consent-title">Preferências de cookies e medição</h2>
      <p class="consent-text">Usamos cookies/identificadores para métricas (Google Analytics) e publicidade (Google AdSense). Você pode aceitar, rejeitar ou personalizar.</p>
      <div class="consent-actions">
        <button type="button" class="consent-btn primary" id="consent-accept">Aceitar tudo</button>
        <button type="button" class="consent-btn" id="consent-reject">Rejeitar não essenciais</button>
        <button type="button" class="consent-btn" id="consent-customize">Personalizar</button>
      </div>
      <div class="consent-panel" id="consent-panel" hidden>
        <label class="consent-option"><input type="checkbox" id="consent-analytics"> Permitir medição de uso (Google Analytics).</label>
        <label class="consent-option"><input type="checkbox" id="consent-ads"> Permitir carregamento de anúncios (Google AdSense).</label>
        <label class="consent-option"><input type="checkbox" id="consent-personalization"> Permitir personalização de anúncios (quando anúncios estiverem ativos).</label>
        <p class="consent-text" id="consent-ads-policy-note" hidden>Nesta página, anúncios estão desativados por política editorial.</p>
        <div class="consent-actions"><button type="button" class="consent-btn primary" id="consent-save">Salvar preferências</button></div>
      </div>
    `;

    document.body.appendChild(root);

    document.getElementById('consent-accept').addEventListener('click', function () {
      saveConsent(normalizeConsentForPage({ decision: 'accepted', analytics: true, ads: true, personalization: true }));
    });

    document.getElementById('consent-reject').addEventListener('click', function () {
      saveConsent({ decision: 'rejected', analytics: false, ads: false, personalization: false });
    });

    document.getElementById('consent-customize').addEventListener('click', function () {
      const panel = document.getElementById('consent-panel');
      panel.hidden = !panel.hidden;
      if (!panel.hidden) {
        document.getElementById('consent-analytics').checked = !!currentConsent.analytics;
        document.getElementById('consent-ads').checked = !!currentConsent.ads;
        document.getElementById('consent-personalization').checked = !!currentConsent.personalization;
      }
    });

    document.getElementById('consent-save').addEventListener('click', function () {
      const analytics = document.getElementById('consent-analytics').checked;
      const ads = document.getElementById('consent-ads').checked;
      const personalization = ads && document.getElementById('consent-personalization').checked;
      saveConsent(normalizeConsentForPage({
        decision: 'custom',
        analytics,
        ads,
        personalization
      }));
    });

  }

  function addReviewButton() {
    const linksContainer = document.querySelector('.small-links');
    if (!linksContainer || document.getElementById('consent-review')) return;
    const reviewBtn = document.createElement('button');
    reviewBtn.type = 'button';
    reviewBtn.id = 'consent-review';
    reviewBtn.className = 'consent-review-link';
    reviewBtn.textContent = 'Revisar consentimento';
    reviewBtn.addEventListener('click', function () {
      showBanner();
      const panel = document.getElementById('consent-panel');
      if (panel) panel.hidden = true;
    });
    linksContainer.appendChild(reviewBtn);
  }

  document.addEventListener('DOMContentLoaded', function () {
    currentConsent = normalizeConsentForPage(readConsent());
    createUI();
    addReviewButton();

    if (currentConsent.decision === 'pending') {
      showBanner();
    } else {
      applyConsent(currentConsent);
      hideBanner();
    }
  });
})();
