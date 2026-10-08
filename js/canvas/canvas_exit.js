/**
 * Centralized canvas workspace exit: return to chat home via clearAction().
 * Listens for canvas-request-exit and legacy canvas-close-* events.
 */
(function() {
    'use strict';

    var CONFIRM_MESSAGES = {
        lesson_plan: 'The lesson plan will be deleted. Return to workspace?',
        quiz: 'Your quiz will be closed. Return to workspace?',
        eal_lesson: 'Leave interactive EAL lesson? Return to workspace?',
        online_lesson: 'Leave online curriculum lesson? Return to workspace?',
        lesson_slide_creator: 'Leave Lesson Slide Creator? Your work is autosaved. Return to workspace?'
    };

    function getStore() {
        if (typeof Alpine === 'undefined' || typeof Alpine.store !== 'function') return null;
        return Alpine.store('canvas');
    }

    function needsConfirm(action) {
        return Object.prototype.hasOwnProperty.call(CONFIRM_MESSAGES, action);
    }

    function finishExit(detail) {
        var store = getStore();
        if (!store || typeof store.clearAction !== 'function') return;
        store.clearAction();
        if (detail && detail.thenNewChat && typeof store.startNewChat === 'function') {
            store.startNewChat();
        } else if (detail && detail.thenNavigate) {
            window.location = detail.thenNavigate;
        }
    }

    window.canvasRequestExit = function canvasRequestExit(detail) {
        detail = detail || {};
        var store = getStore();
        if (!store) return;
        var action = store.currentAction;
        if (!action) {
            if (detail.thenNewChat && typeof store.startNewChat === 'function') {
                store.startNewChat();
            }
            return;
        }
        if (needsConfirm(action)) {
            var msg = CONFIRM_MESSAGES[action] || 'Return to workspace?';
            if (window.confirm(msg)) {
                finishExit(detail);
            }
            return;
        }
        finishExit(detail);
    };

    document.addEventListener('canvas-request-exit', function(ev) {
        window.canvasRequestExit((ev && ev.detail) || {});
    });

    document.addEventListener('canvas-close-action', function() {
        window.canvasRequestExit({});
    });

    document.addEventListener('canvas-close-lesson-plan-confirm', function(ev) {
        window.canvasRequestExit((ev && ev.detail) || {});
    });
})();
