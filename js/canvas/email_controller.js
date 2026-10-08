(function() {
    'use strict';

    function initialEmailState(context) {
        return {
            emailSubMode: (context && context.emailSubMode) || 'manage_todays'
        };
    }

    function applyInitialUrlEmailPanel(store) {
        // Keep behavior: if ?email_panel=draft_chat, open draft chat panel.
        if (!store) return;
        try {
            var url = new URL(window.location.href);
            if (url.searchParams.get('email_panel') === 'draft_chat') {
                store.emailSubMode = 'draft_chat';
            }
        } catch (e) {}
    }

    window.CanvasFeatures = window.CanvasFeatures || {};
    window.CanvasFeatures.email = {
        initialEmailState: initialEmailState,
        applyInitialUrlEmailPanel: applyInitialUrlEmailPanel,
        onSetActionEmail: function(store, context) {
            var s = initialEmailState(context);
            store.emailSubMode = s.emailSubMode;
        }
    };
})();

