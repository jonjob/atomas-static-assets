(function() {
    'use strict';

    function initialSenPlanningState() {
        return {
            selectedStudentId: null,
            selectedStudent: null,
            students: [],
            subjects: [],
            years: [],
            step: 'form',
            chatId: null,
            messages: [],
            contentMarkdown: '',
            selectionMenu: null,
            amendingAt: null,
            loading: true,
            error: ''
        };
    }

    function loadContextIntoStore(store, url) {
        if (!store || !store.senPlanning) return;
        var self = store;
        fetch(url, { credentials: 'include' })
            .then(function(r) { return r.json(); })
            .then(function(data) {
                if (self.senPlanning) {
                    self.senPlanning.students = data.students || [];
                    self.senPlanning.subjects = data.subjects || [];
                    self.senPlanning.years = data.years || [];
                    self.senPlanning.loading = false;
                }
            })
            .catch(function() {
                if (self.senPlanning) {
                    self.senPlanning.students = [];
                    self.senPlanning.years = [];
                    self.senPlanning.loading = false;
                }
            });
    }

    window.CanvasFeatures = window.CanvasFeatures || {};
    window.CanvasFeatures.sen_planning = {
        initialSenPlanningState: initialSenPlanningState,
        loadContextIntoStore: loadContextIntoStore,
        onSetActionSenPlanning: function(store, context, deps) {
            store.senPlanning = initialSenPlanningState();
            var url =
                (deps && deps.senPlanningContextUrl)
                    ? deps.senPlanningContextUrl
                    : '/api/sen_planning/context';
            loadContextIntoStore(store, url);
        }
    };
})();

