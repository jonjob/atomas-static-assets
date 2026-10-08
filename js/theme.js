(function () {
    var STORAGE_KEY = 'atomas-theme';
    /** Two modes: light and dark. Older stored values ("neon") resolve to dark. */
    var DEFAULT_THEME = 'dark';

    var MODES = ['light', 'dark'];

    function getStored() {
        try {
            return localStorage.getItem(STORAGE_KEY);
        } catch (e) {
            return null;
        }
    }

    function setStored(value) {
        try {
            localStorage.setItem(STORAGE_KEY, value);
        } catch (e) {}
    }

    function normalizeStoredExplicit() {
        var s = getStored();
        if (s === 'light' || s === 'dark') return s;
        setStored(DEFAULT_THEME);
        return DEFAULT_THEME;
    }

    function applyClasses(mode) {
        var root = document.documentElement;
        var isDark = mode === 'dark';
        root.classList.toggle('dark', isDark);
        root.classList.remove('neon');
        root.setAttribute('data-theme', mode);
        root.style.colorScheme = isDark ? 'dark' : 'light';
    }

    function applyFromStored() {
        applyClasses(normalizeStoredExplicit());
    }

    function getMode() {
        return normalizeStoredExplicit();
    }

    function refreshToggleUi() {
        var mode = getMode();
        var btn = document.getElementById('atomas-theme-switch');
        if (!btn) return;
        var isDark = mode === 'dark';
        btn.setAttribute('aria-checked', isDark.toString());
        btn.setAttribute('data-mode', mode);
        btn.setAttribute('title', isDark ? 'Switch to light mode' : 'Switch to dark mode');
    }

    function choose(mode) {
        if (MODES.indexOf(mode) < 0) return;
        setStored(mode);
        applyClasses(mode);
        refreshToggleUi();
        window.dispatchEvent(new CustomEvent('atomas-theme-change', { detail: { mode: mode } }));
    }

    function bindToggle() {
        var btn = document.getElementById('atomas-theme-switch');
        if (!btn) return;

        refreshToggleUi();

        btn.addEventListener('click', function () {
            choose(getMode() === 'dark' ? 'light' : 'dark');
        });

        btn.addEventListener('keydown', function (e) {
            if (e.key === 'ArrowLeft') {
                e.preventDefault();
                choose('light');
            } else if (e.key === 'ArrowRight') {
                e.preventDefault();
                choose('dark');
            }
        });
    }

    window.atomasTheme = {
        getMode: getMode,
        setMode: choose,
        apply: applyFromStored
    };

    applyFromStored();

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', bindToggle);
    } else {
        bindToggle();
    }
})();
