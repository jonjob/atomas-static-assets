/**
 * Bridge: mount React canvas tools in the center pane when setAction fires.
 * Loaded after canvas_core.js; does not live in canvas_dashboard.js.
 */
(function() {
    'use strict';

    var REACT_ACTIONS = ['notebook_agent_categories', 'persona_themes', 'sharepoint_favourites', 'alert_system'];
    var REACT_BUNDLE_URL = '/static/canvas-ui/canvas-tools.js?v=lovable1';
    var reactBundleLoaded = false;
    var reactBundleInflight = null;
    var activeReactAction = null;
    var mountGeneration = 0;

    function readCanvasAppConfig() {
        var el = document.getElementById('canvas-app-config');
        if (!el || !el.textContent) return {};
        try {
            return JSON.parse(el.textContent);
        } catch (e) {
            return {};
        }
    }

    function isReactAction(action) {
        return REACT_ACTIONS.indexOf(action) !== -1;
    }

    function isActionStillActive(action) {
        try {
            var store =
                typeof Alpine !== 'undefined' && Alpine.store ? Alpine.store('canvas') : null;
            return !!(store && store.currentAction === action);
        } catch (_) {
            return true;
        }
    }

    function waitForAlpinePaint() {
        return new Promise(function(resolve) {
            requestAnimationFrame(function() {
                requestAnimationFrame(resolve);
            });
        });
    }

    function loadReactBundle() {
        if (reactBundleLoaded && typeof window.mountCanvasTool === 'function') {
            return Promise.resolve();
        }
        if (reactBundleInflight) return reactBundleInflight;
        reactBundleInflight = import(REACT_BUNDLE_URL)
            .then(function() {
                reactBundleLoaded = true;
            })
            .catch(function(err) {
                console.error('Failed to load React canvas bundle', err);
                throw err;
            })
            .finally(function() {
                reactBundleInflight = null;
            });
        return reactBundleInflight;
    }

    function waitForMountRoot(action, attempt) {
        attempt = attempt || 0;
        var id = 'canvas-react-root-' + action;
        var el = document.getElementById(id);
        if (el) return Promise.resolve(el);
        if (attempt >= 72) return Promise.resolve(null);
        return new Promise(function(resolve) {
            requestAnimationFrame(function() {
                resolve(waitForMountRoot(action, attempt + 1));
            });
        });
    }

    function mountReactTool(action, cfg, generation, retryAttempt) {
        retryAttempt = retryAttempt || 0;
        if (generation !== mountGeneration || !isActionStillActive(action)) {
            return Promise.resolve();
        }

        return waitForAlpinePaint()
            .then(function() {
                if (generation !== mountGeneration || !isActionStillActive(action)) return null;
                return waitForMountRoot(action, 0);
            })
            .then(function(el) {
                if (generation !== mountGeneration || !isActionStillActive(action)) return;
                if (!el || typeof window.mountCanvasTool !== 'function') {
                    if (retryAttempt < 8) {
                        return new Promise(function(resolve) {
                            setTimeout(function() {
                                resolve(
                                    mountReactTool(action, cfg, generation, retryAttempt + 1),
                                );
                            }, 60 + retryAttempt * 50);
                        });
                    }
                    console.error('React mount root or mountCanvasTool missing for', action);
                    return;
                }
                if (activeReactAction && activeReactAction !== action &&
                    typeof window.unmountCanvasTool === 'function') {
                    window.unmountCanvasTool(activeReactAction);
                }
                activeReactAction = action;
                return window.mountCanvasTool(action, el, cfg);
            });
    }

    window.canvasMountReactForAction = function canvasMountReactForAction(action) {
        if (!isReactAction(action)) {
            mountGeneration += 1;
            if (activeReactAction && typeof window.unmountAllCanvasTools === 'function') {
                window.unmountAllCanvasTools();
            }
            activeReactAction = null;
            return Promise.resolve();
        }

        var generation = ++mountGeneration;
        var cfg = readCanvasAppConfig();
        return loadReactBundle().then(function() {
            return mountReactTool(action, cfg, generation, 0);
        });
    };

    /* Home/new-chat/restore paths set currentAction = null without calling setAction, so the
       React root (and any polling inside it) would outlive its x-if container. */
    document.addEventListener('alpine:initialized', function() {
        var store = Alpine.store('canvas');
        if (!store || typeof Alpine.effect !== 'function') return;
        Alpine.effect(function() {
            var action = store.currentAction;
            if (activeReactAction && action !== activeReactAction) {
                if (typeof window.unmountAllCanvasTools === 'function') {
                    window.unmountAllCanvasTools();
                }
                activeReactAction = null;
            }
        });
    });

    var origLoadPartials = window.canvasLoadPartialsForAction;
    window.canvasLoadPartialsForAction = function canvasLoadPartialsForAction(action) {
        var chain = origLoadPartials ? origLoadPartials(action) : Promise.resolve();
        return Promise.resolve(chain).then(function() {
            return window.canvasMountReactForAction(action);
        });
    };
})();
