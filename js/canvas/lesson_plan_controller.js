(function() {
    'use strict';

    function initialLessonPlan() {
        return {
            step: 5,
            wizardStep: 1,
            wizardActive: true,
            wizardRegMode: 'school',
            wizardError: '',
            enhanceAimsLoading: false,
            enhanceAimsError: '',
            lessonAimsEnhanceStyle: 'fuller',
            aimsBeforeEnhance: null,
            wizardClassStudents: [],
            wizardClassStudentsLoading: false,
            wizardClassStudentsError: '',
            data: {},
            taskId: null,
            draftId: null,
            content: null,
            loading: false,
            error: '',
            chatMode: 'ask'
        };
    }

    function initialLessonPlanExport() {
        return {
            loading: false,
            error: '',
            successLink: '',
            sharePointSites: [],
            showSharePointPanel: false,
            selectedSharePointSiteId: '',
            format: 'word',
            filename: '',
            outlookDate: '',
            outlookTime: '',
            lastExportAddedToCalendar: false
        };
    }

    /**
     * @param {object} store Alpine canvas store
     * @param {{ targetLabel?: string, targetType?: string }} [actionContext]
     */
    function initLessonPlanWizard(store, actionContext) {
        var lp = store.lessonPlan;
        if (!lp) return;
        lp.wizardActive = true;
        lp.wizardError = '';
        lp.wizardStep = 1;
        lp.step = 5;
        lp.enhanceAimsLoading = false;
        lp.enhanceAimsError = '';
        lp.lessonAimsEnhanceStyle = lp.lessonAimsEnhanceStyle || 'fuller';
        lp.aimsBeforeEnhance = null;
        lp.wizardClassStudents = [];
        lp.wizardClassStudentsLoading = false;
        lp.wizardClassStudentsError = '';
        lp.data = Object.assign({}, lp.data || {});
        lp.data.include_sen_differentiation = false;
        lp.data.include_eal_differentiation = false;
        var ctx = actionContext || store.actionContext || {};
        if (ctx.targetType === 'reg_group' && ctx.targetLabel) {
            lp.data.registration_group = String(ctx.targetLabel).trim();
            lp.wizardRegMode = 'from_context';
        } else {
            var urg = store.userRegistrationGroups || [];
            if (urg.length === 1) {
                lp.data.registration_group = urg[0];
                lp.wizardRegMode = 'single';
            } else if (urg.length > 1) {
                lp.wizardRegMode = 'multiple';
                lp.data.registration_group = lp.data.registration_group || '';
            } else {
                lp.wizardRegMode = 'school';
                lp.data.registration_group = lp.data.registration_group || '';
            }
        }
        var topicHint = (store.lessonPlanTopicFromChat && String(store.lessonPlanTopicFromChat).trim()) || '';
        if (topicHint) {
            lp.data.lesson_aims = topicHint;
        }
    }

    window.CanvasFeatures = window.CanvasFeatures || {};
    window.CanvasFeatures.lesson_plan = {
        initialLessonPlan: initialLessonPlan,
        initialLessonPlanExport: initialLessonPlanExport,
        initLessonPlanWizard: initLessonPlanWizard,

        onSetActionLessonPlan: function(store) {
            store.lessonPlan = initialLessonPlan();
            store.lessonPlanExport = initialLessonPlanExport();
            initLessonPlanWizard(store, store.actionContext);
        }
    };
})();
