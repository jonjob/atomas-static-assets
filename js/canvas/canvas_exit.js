/**
 * Centralized canvas workspace exit: return to chat home via clearAction(), or to the
 * screen that opened the tool when it was opened via canvasOpenWithReturn().
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

    function returnTargetFor(store) {
        if (!store || !store.exitReturnTo) return null;
        var actions = store.exitReturnActions || [];
        return actions.indexOf(store.currentAction) !== -1 ? store.exitReturnTo : null;
    }

    function clearReturnTarget(store) {
        store.exitReturnTo = null;
        store.exitReturnActions = [];
        store.exitReturnLabel = null;
    }

    /* Opens a tool so that exiting it (or its related sub-actions) goes back to returnTo. */
    window.canvasOpenWithReturn = function canvasOpenWithReturn(action, returnTo, returnLabel, relatedActions) {
        var store = getStore();
        if (!store || typeof store.setAction !== 'function') return;
        store.exitReturnTo = returnTo;
        store.exitReturnActions = [action].concat(relatedActions || []);
        store.exitReturnLabel = returnLabel || null;
        store.setAction(action);
    };

    function finishExit(detail) {
        var store = getStore();
        if (!store || typeof store.clearAction !== 'function') return;
        var returnTo = returnTargetFor(store);
        clearReturnTarget(store);
        if (returnTo && !detail.thenNewChat && !detail.thenNavigate) {
            store.setAction(returnTo);
            return;
        }
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

    document.addEventListener('alpine:initialized', function() {
        var store = getStore();
        if (!store || typeof Alpine.effect !== 'function') return;
        if (store.exitReturnTo === undefined) clearReturnTarget(store);
        Alpine.effect(function() {
            void store.currentAction;
            if (store.exitReturnTo && !returnTargetFor(store)) clearReturnTarget(store);
        });
    });

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
