(function () {
  // Tema claro / escuro / sistema. O script inline do <head> já gravou html[data-theme] antes da folha de
  // estilo (sem flash de tema errado); aqui ficam o seletor do rodapé, a persistência da escolha e a reação
  // à preferência do sistema quando a escolha é "system". Padrão sem escolha: claro.
  const STORAGE_KEY = 'trTema';
  const THEME_COLOR = { light: '#FFFFFF', dark: '#171E27' };
  const root = document.documentElement;
  const media = window.matchMedia('(prefers-color-scheme: dark)');

  // Escolha guardada ('light' | 'dark' | 'system') ou null. localStorage bloqueado (modo privado) => null.
  function storedChoice() {
    try {
      const value = localStorage.getItem(STORAGE_KEY);
      return value === 'light' || value === 'dark' || value === 'system' ? value : null;
    } catch (err) {
      return null;
    }
  }

  function effective(choice) {
    if (choice === 'system') return media.matches ? 'dark' : 'light';
    return choice === 'dark' ? 'dark' : 'light';
  }

  function buttons() {
    return document.querySelectorAll('.tema button[data-tema]');
  }

  function apply(choice, animate) {
    const theme = effective(choice);
    if (animate) root.classList.add('tema-trans'); // transição curta só na troca, nunca no carregamento
    root.dataset.theme = theme;
    const meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.setAttribute('content', THEME_COLOR[theme]);
    buttons().forEach(function (button) {
      button.setAttribute('aria-pressed', button.getAttribute('data-tema') === choice ? 'true' : 'false');
    });
    if (animate) window.setTimeout(function () { root.classList.remove('tema-trans'); }, 200);
  }

  function save(choice) {
    try {
      localStorage.setItem(STORAGE_KEY, choice);
    } catch (err) {
      // sem armazenamento (modo privado/cota): a escolha vale só nesta página
    }
  }

  function init() {
    apply(storedChoice() || 'light', false);
    buttons().forEach(function (button) {
      button.addEventListener('click', function () {
        const choice = button.getAttribute('data-tema');
        apply(choice, true);
        save(choice);
      });
    });
  }

  // Mudança do tema do sistema: só importa quando a escolha é "system".
  function onSystemChange() {
    if (storedChoice() === 'system') apply('system', true);
  }
  if (media.addEventListener) media.addEventListener('change', onSystemChange);
  else if (media.addListener) media.addListener(onSystemChange);

  // Escolha feita em outra aba: acompanha.
  window.addEventListener('storage', function (event) {
    if (event.key === STORAGE_KEY) apply(storedChoice() || 'light', true);
  });

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
