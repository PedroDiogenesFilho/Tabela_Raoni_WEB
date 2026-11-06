(function () {
  const STORAGE_KEY = 'trConsentV1';
  const CONSENT_VERSION = 1;
  const ADSENSE_SRC = 'https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=ca-pub-5754272579077136';
  const GTAG_SRC = 'https://www.googletagmanager.com/gtag/js?id=G-QLZDGBFWT3';
  const DENIED = 'denied';
  const GRANTED = 'granted';

  // Só nestes hosts o GA e o AdSense (via consentimento) são carregados. Em qualquer outro host
  // (HMG no github.io, hmg.tabelaraoni.com.br, localhost, file://) o modal de consentimento
  // funciona normalmente, mas analytics/ads viram no-op: nenhuma requisição ao Google.
  const PRODUCTION_HOSTS = ['tabelaraoni.com.br', 'www.tabelaraoni.com.br'];
  const isProductionHost = PRODUCTION_HOSTS.includes(window.location.hostname);

  let currentConsent = null;
  let analyticsConfigured = false;
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
    const safeConsent = consent && typeof consent === 'object' ? consent : {};
    const normalized = {
      ...defaultConsent,
      ...safeConsent,
      analytics: Boolean(safeConsent.analytics),
      ads: Boolean(safeConsent.ads),
      personalization: Boolean(safeConsent.personalization)
    };

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
    if (!isProductionHost) return; // fora de produção: nenhum hit para G-QLZDGBFWT3
    if (analyticsConfigured) return; // config só uma vez por carregamento: evita page_view duplicado
    analyticsConfigured = true;
    setupGtagStub();
    ensureScript('tr-gtag-js', GTAG_SRC);
    window.gtag('js', new Date());
    window.gtag('config', 'G-QLZDGBFWT3', { anonymize_ip: true });
  }

  function loadAds(consent) {
    if (!isProductionHost) return; // fora de produção: nunca injeta adsbygoogle.js
    window.adsbygoogle = window.adsbygoogle || [];
    if (!consent.personalization) {
      window.adsbygoogle.requestNonPersonalizedAds = 1;
    }
    const existingAdsenseScript = document.querySelector('script[src*="pagead2.googlesyndication.com/pagead/js/adsbygoogle.js"]');
    if (!existingAdsenseScript) {
      ensureScript('tr-adsense-js', ADSENSE_SRC, { crossorigin: 'anonymous' });
    }
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

  // Barra não bloqueante: sem backdrop e sem travar a rolagem. A classe em <html> abre espaço no fim
  // da página (padding/scroll-padding no styles.css) para o foco nunca ficar atrás da barra.
  function hideBanner() {
    const root = document.getElementById('consent-root');
    if (root) root.hidden = true;
    document.documentElement.classList.remove('consent-open');
  }

  // focusRoot: só quando a pessoa pediu (botão "Revisar consentimento"). No carregamento o foco não é movido.
  function showBanner(focusRoot) {
    const root = document.getElementById('consent-root');
    if (!root) return;
    root.hidden = false;
    const panel = document.getElementById('consent-panel');
    if (panel) panel.hidden = true;
    const customize = document.getElementById('consent-customize');
    if (customize) customize.setAttribute('aria-expanded', 'false');
    document.documentElement.classList.add('consent-open');
    if (focusRoot) {
      root.tabIndex = -1;
      root.focus();
    }
  }

  function createUI() {
    // Estilos na seção "Consentimento" de assets/styles.css (classes consent-*).
    const root = document.createElement('section');
    root.className = 'consent-root';
    root.id = 'consent-root';
    root.setAttribute('role', 'region');
    root.setAttribute('aria-labelledby', 'consent-title');
    root.hidden = true;
    root.innerHTML = `
      <div class="consent-inner">
        <div class="consent-copy">
          <h2 class="consent-title" id="consent-title">Cookies e medição</h2>
          <p class="consent-text">Usamos cookies/identificadores para métricas (Google Analytics) e publicidade (Google AdSense). Você pode aceitar, rejeitar ou personalizar.</p>
        </div>
        <div class="consent-actions">
          <button type="button" class="consent-btn primary" id="consent-accept">Aceitar tudo</button>
          <button type="button" class="consent-btn" id="consent-reject">Rejeitar não essenciais</button>
          <button type="button" class="consent-btn link" id="consent-customize" aria-expanded="false" aria-controls="consent-panel">Personalizar</button>
        </div>
        <div class="consent-panel" id="consent-panel" hidden>
          <label class="consent-option"><input type="checkbox" id="consent-analytics"> Permitir medição de uso (Google Analytics).</label>
          <label class="consent-option"><input type="checkbox" id="consent-ads"> Permitir carregamento de anúncios (Google AdSense).</label>
          <label class="consent-option"><input type="checkbox" id="consent-personalization"> Permitir personalização de anúncios (quando anúncios estiverem ativos).</label>
          <p class="consent-text" id="consent-ads-policy-note" hidden>Nesta página, anúncios estão desativados por política editorial.</p>
          <div class="consent-actions"><button type="button" class="consent-btn primary" id="consent-save">Salvar preferências</button></div>
        </div>
      </div>
    `;

    document.body.appendChild(root);

    if (!adsAllowedOnPage) {
      // Página sem anúncios por política (tr-ads-policy): mostra a nota e desliga as opções de anúncios.
      const note = document.getElementById('consent-ads-policy-note');
      if (note) note.hidden = false;
      ['consent-ads', 'consent-personalization'].forEach(function (id) {
        const box = document.getElementById(id);
        if (box) box.disabled = true;
      });
    }

    document.getElementById('consent-accept').addEventListener('click', function () {
      saveConsent(normalizeConsentForPage({ decision: 'accepted', analytics: true, ads: true, personalization: true }));
    });

    document.getElementById('consent-reject').addEventListener('click', function () {
      saveConsent({ decision: 'rejected', analytics: false, ads: false, personalization: false });
    });

    document.getElementById('consent-customize').addEventListener('click', function () {
      const panel = document.getElementById('consent-panel');
      panel.hidden = !panel.hidden;
      this.setAttribute('aria-expanded', String(!panel.hidden));
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
      showBanner(true);
    });
    linksContainer.appendChild(reviewBtn);
  }

  document.addEventListener('DOMContentLoaded', function () {
    currentConsent = normalizeConsentForPage(readConsent());
    createUI();
    addReviewButton();

    if (currentConsent.decision === 'pending') {
      showBanner(false);
    } else {
      applyConsent(currentConsent);
      hideBanner();
    }
  });
})();
