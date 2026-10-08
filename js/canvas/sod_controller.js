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
    var sodCanvasFragmentUrlTemplate = (canvasCfg.sodCanvasFragmentUrlTemplate || '/sod/canvas/SECTION_PLACEHOLDER').trim();

    function sodActionToSection(action) {
        var m = {
            sod_home: 'home',
            sod_seasons: 'seasons',
            sod_indicators: 'indicators',
            sod_data_entry: 'data_entry',
            sod_visualizations: 'visualizations'
        };
        return m[action] || 'home';
    }

    function buildSodFragmentUrl(section) {
        var path = sodCanvasFragmentUrlTemplate.replace('SECTION_PLACEHOLDER', section);
        var store = (typeof Alpine !== 'undefined' && Alpine.store) ? Alpine.store('canvas') : null;
        var params = new URLSearchParams();
        if (section === 'data_entry' && store && store.sodDataEntryParams) {
            var dep = store.sodDataEntryParams;
            if (dep.seasonId) params.set('season_id', String(dep.seasonId));
            if (dep.schoolId) params.set('school_id', String(dep.schoolId));
        }
        if (section === 'visualizations' && store && store.sodVizSeasonId) {
            params.set('season_id', String(store.sodVizSeasonId));
        }
        var qs = params.toString();
        return qs ? path + '?' + qs : path;
    }

    function ensureDomainToggleDelegation(root) {
        if (!root) return;
        if (root.dataset && root.dataset.sodDomainToggleDelegated === '1') return;

        // Use event delegation (one listener) so reinjection doesn't accumulate handlers.
        if (root.dataset) root.dataset.sodDomainToggleDelegated = '1';

        root.addEventListener('click', function(ev) {
            var target = ev.target;
            if (!target || !target.closest) return;

            var btn = target.closest('[data-sod-domain-toggle]');
            if (!btn) return;

            ev.preventDefault();
            ev.stopPropagation();

            var domain = btn.getAttribute('data-domain');
            if (!domain) return;

            var rows = root.querySelectorAll('tr[data-sod-domain-detail="' + domain + '"]');
            if (!rows || !rows.length) return;

            var icon = btn.querySelector('.sod-domain-chevron');
            var isHidden = rows[0].classList.contains('hidden');

            rows.forEach(function(row) {
                if (isHidden) row.classList.remove('hidden');
                else row.classList.add('hidden');
            });

            btn.setAttribute('aria-expanded', isHidden ? 'true' : 'false');
            if (icon) {
                if (isHidden) icon.classList.add('rotate-180');
                else icon.classList.remove('rotate-180');
            }
        });
    }

    window.CanvasFeatures = window.CanvasFeatures || {};
    window.CanvasFeatures.sod = {
        onFragmentInjected: function(payload) {
            // This is intentionally idempotent (event delegation + data-guard).
            var root = payload && payload.root ? payload.root : null;
            ensureDomainToggleDelegation(root);
        },

        loadFragmentForAction: function(action) {
            var section = sodActionToSection(action);
            var root = document.getElementById('sod-canvas-root');
            if (!root) return Promise.resolve();

            var url = buildSodFragmentUrl(section);
            root.innerHTML = '<p class="text-sm text-slate-500 p-4">Loading&hellip;</p>';

            return fetch(url, { credentials: 'include' })
                .then(function(r) {
                    return r.ok ? r.text() : Promise.reject(new Error(String(r.status)));
                })
                .then(function(html) {
                    var injector = window.CanvasInjectHtmlWithScripts;
                    if (typeof injector !== 'function') {
                        root.innerHTML = html;
                        return;
                    }

                    return injector(root, html).then(function() {
                        if (typeof window.CanvasFeaturesDispatch === 'function') {
                            window.CanvasFeaturesDispatch('sod', action, root, { section: section });
                        }
                    });
                })
                .catch(function() {
                    root.innerHTML = '<p class="text-sm text-red-600 p-4">Could not load School Overview content.</p>';
                });
        },

        loadSection: function(action) {
            var s = (typeof Alpine !== 'undefined' && Alpine.store) ? Alpine.store('canvas') : null;
            if (s && typeof s.setAction === 'function') s.setAction(action);
        },

        reloadCurrentSection: function() {
            var s = (typeof Alpine !== 'undefined' && Alpine.store) ? Alpine.store('canvas') : null;
            if (!s || !s.currentAction || String(s.currentAction).indexOf('sod_') !== 0) return;
            this.loadFragmentForAction(s.currentAction);
        },

        loadSectionWithParams: function(action, p) {
            var s = (typeof Alpine !== 'undefined' && Alpine.store) ? Alpine.store('canvas') : null;
            if (!s) return;

            if (action === 'sod_data_entry' && p) {
                s.sodDataEntryParams = { seasonId: p.seasonId || null, schoolId: p.schoolId || null };
                s.setAction(action, { seasonId: p.seasonId, schoolId: p.schoolId });
                return;
            }

            if (action === 'sod_visualizations') {
                var vizSeason = p && p.seasonId ? String(p.seasonId) : null;
                s.sodVizSeasonId = vizSeason;
                s.setAction(action, { seasonId: vizSeason });
                return;
            }

            s.setAction(action);
        }
    };
})();

