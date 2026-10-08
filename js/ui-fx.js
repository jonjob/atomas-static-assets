(function () {
    var SELECTOR = '.ui-card, .lp-sticker';
    var current = null;

    document.addEventListener('pointermove', function (e) {
        var el = e.target && e.target.closest ? e.target.closest(SELECTOR) : null;
        if (el !== current && current) {
            current.style.removeProperty('--mx');
            current.style.removeProperty('--my');
        }
        current = el;
        if (!el) return;
        var r = el.getBoundingClientRect();
        el.style.setProperty('--mx', (e.clientX - r.left) + 'px');
        el.style.setProperty('--my', (e.clientY - r.top) + 'px');
    }, { passive: true });
})();
