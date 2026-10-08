/**
 * Canvas core: perf RUM, deferred action scripts, lesson-plan asset gating.
 * Loaded before canvas_dashboard.js; controllers load on demand per action.
 */
(function() {
    'use strict';

    /**
     * Register Alpine.data for controllers loaded after alpine:init (deferred action scripts).
     * Calls factory immediately when Alpine is already on the page, and again on alpine:init if not yet.
     */
    window.canvasRegisterDeferredAlpineData = function canvasRegisterDeferredAlpineData(name, factory) {
        var registry = window.__canvasDeferredAlpineRegistered || (window.__canvasDeferredAlpineRegistered = Object.create(null));
        function register() {
            if (registry[name]) return;
            if (typeof Alpine === 'undefined' || typeof Alpine.data !== 'function') return;
            registry[name] = true;
            Alpine.data(name, factory);
        }
        document.addEventListener('alpine:init', register);
        register();
    };

    var PERF_SAMPLE_RATE = 0.03;
    var loadedScripts = Object.create(null);
    var scriptInflight = Object.create(null);

    /** Action -> controller script URLs (defer parse until tool opened). */
    var CANVAS_ACTION_SCRIPTS = {
        my_lessons: ['/static/js/canvas/my_lessons_controller.js?v=mylessons3'],
        lesson_plan: [
            '/static/js/canvas/lesson_plan_controller.js?v=perf1',
            '/static/js/vendor/marked.min.js?v=9.1.6',
            '/static/js/lesson_plan_markdown.js?v=5',
            '/static/js/lesson_plan_image_placeholders_controller.js?v=7'
        ],
        quiz: ['/static/js/canvas/quiz_controller.js?v=addquestionmodal1'],
        image_creator: ['/static/js/canvas/image_creator_controller.js?v=perf1'],
        eal_lesson: ['/static/js/canvas/eal_lesson_controller.js?v=topic1'],
        online_lesson: ['/static/js/canvas/online_lesson_controller.js?v=topic1'],
        lesson_slide_creator: ['/static/js/canvas/teacher_slide_lesson_controller.js?v=topic3'],
        alert_system: [],
        it_compliance: [],
        it_backup: [],
        it_cyber: [],
        it_filtering: [],
        email: ['/static/js/canvas/email_controller.js?v=perf1'],
        sen_planning: ['/static/js/canvas/sen_planning_controller.js?v=perf1'],
        student_passwords: ['/static/js/canvas/student_passwords_controller.js?v=perf1'],
        system_admin: ['/static/js/canvas/system_admin_controller.js?v=spdefer1'],
        classroom_teams: ['/static/js/canvas/classroom_teams_controller.js?v=perf1'],
        staff_management: ['/static/js/canvas/staff_management_controller.js?v=perf1'],
        notebook_admin: [],
        notebook_curriculum: [],
        notebook_marking_rubrics: [],
        notebook_staff: [],
        notebook_app_documents: [],
        notebook_trust_staff: [],
        student_work_marking: ['/static/js/canvas/student_work_marking_controller.js?v=perf1'],
        inventory: ['/static/js/canvas/inventory_controller.js?v=perf2'],
        teams_meetings: [],
        sod: ['/static/js/canvas/sod_controller.js?v=perf1'],
        notebook_agent_categories: [],
        persona_themes: []
    };

    function loadScriptOnce(src) {
        if (loadedScripts[src]) return Promise.resolve();
        if (scriptInflight[src]) return scriptInflight[src];
        scriptInflight[src] = new Promise(function(resolve, reject) {
            var s = document.createElement('script');
            s.src = src;
            s.defer = true;
            s.onload = function() {
                loadedScripts[src] = true;
                resolve();
            };
            s.onerror = function() { reject(new Error('Failed to load ' + src)); };
            document.head.appendChild(s);
        }).finally(function() { delete scriptInflight[src]; });
        return scriptInflight[src];
    }

    var curriculumListsPromise = null;
    window.canvasLoadCurriculumLists = function canvasLoadCurriculumLists() {
        if (curriculumListsPromise) return curriculumListsPromise;
        var cfg = readPerfConfig();
        var url = (cfg.canvasCurriculumListsUrl || '/api/canvas/curriculum_lists');
        curriculumListsPromise = fetch(url, { credentials: 'include' })
            .then(function(r) { return r.json(); })
            .then(function(data) {
                if (!data || data.error) return;
                function apply() {
                    if (typeof Alpine === 'undefined' || typeof Alpine.store !== 'function') return false;
                    var store = Alpine.store('canvas');
                    if (!store) return false;
                    if (Array.isArray(data.registration_groups)) store.registrationGroups = data.registration_groups;
                    if (Array.isArray(data.years)) store.canvasYearsList = data.years;
                    if (Array.isArray(data.subjects)) store.canvasSubjectsList = data.subjects;
                    if (Array.isArray(data.nc_years)) store.canvasNcYearsList = data.nc_years;
                    return true;
                }
                if (!apply()) {
                    document.addEventListener('alpine:initialized', function once() {
                        document.removeEventListener('alpine:initialized', once);
                        apply();
                    });
                }
            })
            .catch(function() { curriculumListsPromise = null; });
        return curriculumListsPromise;
    };

    window.canvasLoadActionScripts = function canvasLoadActionScripts(action) {
        var urls = CANVAS_ACTION_SCRIPTS[action] || [];
        if (!urls.length) return Promise.resolve();
        return Promise.all(urls.map(loadScriptOnce)).catch(function(err) {
            console.error('canvasLoadActionScripts failed:', action, err);
        });
    };

    function readPerfConfig() {
        var el = document.getElementById('canvas-app-config');
        if (!el || !el.textContent) return {};
        try { return JSON.parse(el.textContent); } catch (e) { return {}; }
    }

    function maybeSendPerfBeacon(payload) {
        if (Math.random() > PERF_SAMPLE_RATE) return;
        var cfg = readPerfConfig();
        var url = (cfg.perfBeaconUrl || '/api/perf_beacon').trim();
        try {
            var body = JSON.stringify(payload);
            if (navigator.sendBeacon) {
                navigator.sendBeacon(url, new Blob([body], { type: 'application/json' }));
            } else {
                fetch(url, { method: 'POST', credentials: 'include', headers: { 'Content-Type': 'application/json' }, body: body, keepalive: true });
            }
        } catch (e) { /* ignore */ }
    }

    window.canvasPerfMark = function canvasPerfMark(name) {
        try {
            if (typeof performance !== 'undefined' && performance.mark) performance.mark(name);
        } catch (e) { /* ignore */ }
    };

    window.canvasPerfMeasureAndBeacon = function canvasPerfMeasureAndBeacon(name, startMark, detail) {
        try {
            if (typeof performance !== 'undefined' && performance.measure) {
                performance.measure(name, startMark);
                var entries = performance.getEntriesByName(name);
                var ms = entries.length ? Math.round(entries[entries.length - 1].duration) : 0;
                maybeSendPerfBeacon({ event: 'canvas_rum', metric: name, duration_ms: ms, detail: detail || {} });
            }
        } catch (e) { /* ignore */ }
    };

    document.addEventListener('alpine:init', function() {
        window.canvasPerfMark('canvas-alpine-init-start');
    });

    document.addEventListener('alpine:initialized', function() {
        window.canvasPerfMark('canvas-alpine-init-end');
        window.canvasPerfMeasureAndBeacon('canvas_alpine_init', 'canvas-alpine-init-start', {});
    });

    var origLoadPartials = window.canvasLoadPartialsForAction;
    if (typeof origLoadPartials === 'function') {
        window.canvasLoadPartialsForAction = function(action) {
            window.canvasPerfMark('canvas-partial-load-start-' + action);
            return window.canvasLoadActionScripts(action)
                .then(function() { return origLoadPartials(action); })
                .then(function() {
                    window.canvasPerfMark('canvas-partial-load-end-' + action);
                    window.canvasPerfMeasureAndBeacon('canvas_partial_load', 'canvas-partial-load-start-' + action, { action: action });
                });
        };
    }
})();
