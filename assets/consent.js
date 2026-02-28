(function () {
  const STORAGE_KEY = 'trConsentV1';
  const CONSENT_VERSION = 1;
  const ADSENSE_SRC = 'https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=ca-pub-5754272579077136';
  const GTAG_SRC = 'https://www.googletagmanager.com/gtag/js?id=G-QLZDGBFWT3';
  const CLARITY_ID = 'vl0wxrq9o2';

  let currentConsent = null;

  const defaultConsent = {
    version: CONSENT_VERSION,
    decision: 'pending',
    analytics: false,
    ads: false,
    personalization: false,
    updatedAt: null
  };

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

  function loadAnalytics() {
    setupGtagStub();
    ensureScript('tr-gtag-js', GTAG_SRC);
    window.gtag('js', new Date());
    window.gtag('config', 'G-QLZDGBFWT3');

    if (!window.clarity) {
      (function (c, l, a, r, i, t, y) {
        c[a] = c[a] || function () {
          (c[a].q = c[a].q || []).push(arguments);
        };
        t = l.createElement(r);
        t.async = 1;
        t.src = 'https://www.clarity.ms/tag/' + i;
        y = l.getElementsByTagName(r)[0];
        y.parentNode.insertBefore(t, y);
      })(window, document, 'clarity', 'script', CLARITY_ID);
    }
  }

  function loadAds(consent) {
    window.adsbygoogle = window.adsbygoogle || [];
    if (!consent.personalization) {
      window.adsbygoogle.requestNonPersonalizedAds = 1;
    }
    ensureScript('tr-adsense-js', ADSENSE_SRC, { crossorigin: 'anonymous' });
  }

  function applyConsent(consent) {
    if (consent.analytics) {
      loadAnalytics();
    }
    if (consent.ads) {
      loadAds(consent);
    }
  }

  function hideBanner() {
    const root = document.getElementById('consent-root');
    if (root) root.hidden = true;
  }

  function showBanner() {
    const root = document.getElementById('consent-root');
    if (root) root.hidden = false;
  }

  function createUI() {
    const style = document.createElement('style');
    style.textContent = `
      .consent-root{position:fixed;inset:auto 16px 16px 16px;z-index:1000;background:#0c1330;color:#eef2ff;border:1px solid rgba(164,180,230,.35);border-radius:14px;padding:14px;box-shadow:0 18px 50px rgba(3,7,20,.55);max-width:760px;margin:0 auto}
      .consent-title{font-size:1rem;font-weight:800;margin:0 0 8px}
      .consent-text{margin:0;color:#cbd5ff;line-height:1.45;font-size:.92rem}
      .consent-actions{display:flex;flex-wrap:wrap;gap:8px;margin-top:12px}
      .consent-btn{border:1px solid rgba(164,180,230,.4);background:rgba(255,255,255,.06);color:#fff;padding:9px 12px;border-radius:999px;font-weight:700;cursor:pointer}
      .consent-btn.primary{background:linear-gradient(120deg, rgba(79,125,255,1) 0%, rgba(123,108,255,1) 45%, rgba(180,76,255,1) 100%);border:none}
      .consent-panel{margin-top:12px;border-top:1px solid rgba(164,180,230,.22);padding-top:12px;display:grid;gap:8px}
      .consent-option{display:flex;gap:8px;align-items:flex-start;color:#d8e0ff;font-size:.9rem}
      .consent-review-link{background:none;border:none;color:inherit;text-decoration:underline;cursor:pointer;padding:0;font:inherit;opacity:.9}
      @media (min-width:900px){.consent-root{left:50%;transform:translateX(-50%);right:auto;width:min(760px,calc(100vw - 32px));}}
    `;
    document.head.appendChild(style);

    const root = document.createElement('section');
    root.className = 'consent-root';
    root.id = 'consent-root';
    root.setAttribute('role', 'dialog');
    root.setAttribute('aria-live', 'polite');
    root.hidden = true;
    root.innerHTML = `
      <h2 class="consent-title">Preferências de cookies e medição</h2>
      <p class="consent-text">Usamos cookies/identificadores para métricas (Google Analytics e Microsoft Clarity) e publicidade (Google AdSense). Você pode aceitar, rejeitar ou personalizar.</p>
      <div class="consent-actions">
        <button type="button" class="consent-btn primary" id="consent-accept">Aceitar tudo</button>
        <button type="button" class="consent-btn" id="consent-reject">Rejeitar não essenciais</button>
        <button type="button" class="consent-btn" id="consent-customize">Personalizar</button>
      </div>
      <div class="consent-panel" id="consent-panel" hidden>
        <label class="consent-option"><input type="checkbox" id="consent-analytics"> Permitir medição de uso (Google Analytics e Microsoft Clarity).</label>
        <label class="consent-option"><input type="checkbox" id="consent-ads"> Permitir carregamento de anúncios (Google AdSense).</label>
        <label class="consent-option"><input type="checkbox" id="consent-personalization"> Permitir personalização de anúncios (quando anúncios estiverem ativos).</label>
        <div class="consent-actions"><button type="button" class="consent-btn primary" id="consent-save">Salvar preferências</button></div>
      </div>
    `;

    document.body.appendChild(root);

    document.getElementById('consent-accept').addEventListener('click', function () {
      saveConsent({ decision: 'accepted', analytics: true, ads: true, personalization: true });
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
      saveConsent({
        decision: 'custom',
        analytics,
        ads,
        personalization
      });
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
      if (panel) panel.hidden = false;
    });
    linksContainer.appendChild(reviewBtn);
  }

  document.addEventListener('DOMContentLoaded', function () {
    currentConsent = readConsent();
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
