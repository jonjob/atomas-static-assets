(function() {
    'use strict';

    function resetImageCreatorState(store, context) {
        // Keep defaults aligned with the existing shell implementation.
        store.imageCreatorPrompt = '';
        store.imageCreatorStyle = (context && context.imageCreatorStyle) || 'Photorealistic';
        store.imageCreatorSize = (context && context.imageCreatorSize) || '512';
        store.imageCreatorModel = (context && context.imageCreatorModel) || 'runware:400@2';
        store.imageCreatorLoading = false;
        store.imageCreatorEnhancing = false;
        store.imageCreatorResult = null;
        store.imageCreatorTaskId = null;
    }

    window.CanvasFeatures = window.CanvasFeatures || {};
    window.CanvasFeatures.image_creator = {
        onSetActionImageCreator: function(store, context) {
            if (!store) return;
            resetImageCreatorState(store, context || {});
        }
    };
})();

