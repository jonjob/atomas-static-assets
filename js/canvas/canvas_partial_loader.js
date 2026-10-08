(function() {
    'use strict';

    function readCanvasAppConfig() {
        var el = document.getElementById('canvas-app-config');
        if (!el || !el.textContent) return {};
        try {
            return JSON.parse(el.textContent);
        } catch (e) {
            return {};
        }
    }

    var canvasCfg = readCanvasAppConfig();
    var partialUrlTemplate = (canvasCfg.canvasPartialUrlTemplate || '/canvasdashboard/partials/PARTIAL_PLACEHOLDER').trim();
    var partialCache = Object.create(null);
    var partialInflight = Object.create(null);

    function buildPartialUrl(key) {
        return partialUrlTemplate.replace('PARTIAL_PLACEHOLDER', key);
    }

    function injectHtmlWithScripts(container, html) {
        if (!container) return Promise.resolve();
        var d = document.createElement('div');
        d.innerHTML = html;
        var scripts = Array.prototype.slice.call(d.querySelectorAll('script'));
        for (var r = scripts.length - 1; r >= 0; r--) {
            scripts[r].parentNode.removeChild(scripts[r]);
        }
        container.innerHTML = d.innerHTML;
        return new Promise(function(resolve) {
            function appendNext(i) {
                if (i >= scripts.length) return resolve();
                var oldScript = scripts[i];
                var s = document.createElement('script');
                if (oldScript.src) {
                    s.src = oldScript.src;
                    s.onload = function() { appendNext(i + 1); };
                    s.onerror = function() { appendNext(i + 1); };
                    container.appendChild(s);
                } else {
                    s.textContent = oldScript.textContent;
                    container.appendChild(s);
                    appendNext(i + 1);
                }
            }
            appendNext(0);
        });
    }

    function afterPartialInjected(root, key) {
        if (typeof Alpine !== 'undefined' && typeof Alpine.initTree === 'function') {
            try {
                Alpine.initTree(root);
            } catch (e) {
                // eslint-disable-next-line no-console
                console.error('Alpine.initTree failed for partial', key, e);
            }
        }
        if (typeof window.CanvasFeaturesDispatch === 'function') {
            var featureKey = key.replace(/_center$/, '').replace(/_right$/, '').replace(/_wizard$/, '');
            window.CanvasFeaturesDispatch(featureKey, key, root, { partialKey: key });
        }
    }

    window.canvasLoadPartial = function canvasLoadPartial(key, options) {
        options = options || {};
        var root = document.getElementById('canvas-partial-root-' + key);
        if (!root) {
            var waitAttempt = options._waitAttempt || 0;
            if (waitAttempt < 48) {
                return new Promise(function(resolve) {
                    requestAnimationFrame(function() {
                        var nextOpts = Object.assign({}, options, { _waitAttempt: waitAttempt + 1 });
                        resolve(window.canvasLoadPartial(key, nextOpts));
                    });
                });
            }
            return Promise.resolve();
        }
        if (!options.force && root.dataset.canvasPartialLoaded === '1') {
            return Promise.resolve(partialCache[key]);
        }
        if (partialInflight[key]) return partialInflight[key];

        var url = buildPartialUrl(key);
        root.innerHTML = '<p class="text-sm text-slate-500 p-4">Loading&hellip;</p>';

        partialInflight[key] = fetch(url, { credentials: 'include' })
            .then(function(r) {
                return r.ok ? r.text() : Promise.reject(new Error(String(r.status)));
            })
            .then(function(html) {
                partialCache[key] = html;
                var injector = window.CanvasInjectHtmlWithScripts || injectHtmlWithScripts;
                return injector(root, html);
            })
            .then(function() {
                root.dataset.canvasPartialLoaded = '1';
                afterPartialInjected(root, key);
            })
            .catch(function(err) {
                // eslint-disable-next-line no-console
                console.error('canvasLoadPartial failed:', key, err);
                root.innerHTML = '<p class="text-sm text-red-600 p-4">Could not load this tool panel.</p>';
            })
            .finally(function() {
                delete partialInflight[key];
            });

        return partialInflight[key];
    };

    /** For roots created later by x-if: the action's controller scripts must load before the partial is initialised. */
    window.canvasEnsurePartial = function canvasEnsurePartial(key, action) {
        var scripts = action && typeof window.canvasLoadActionScripts === 'function'
            ? window.canvasLoadActionScripts(action)
            : Promise.resolve();
        return scripts.then(function() { return window.canvasLoadPartial(key); });
    };

    window.canvasLoadPartialsForAction = function canvasLoadPartialsForAction(action) {
        var map = canvasCfg.canvasActionPartials || {};
        var keys = map[action] || [];
        if (!keys.length) return Promise.resolve();
        return Promise.all(keys.map(function(k) { return window.canvasLoadPartial(k); }));
    };

    window.canvasInvalidatePartial = function canvasInvalidatePartial(key) {
        delete partialCache[key];
        var root = document.getElementById('canvas-partial-root-' + key);
        if (root) {
            delete root.dataset.canvasPartialLoaded;
            root.innerHTML = '';
        }
    };
})();
