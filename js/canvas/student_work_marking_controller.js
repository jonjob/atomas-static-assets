(function() {
    'use strict';

    function initialSwmParamsFromUrl() {
        var schemeIdInit = '';
        var showGroupInit = '';
        var swmErrInit = '';
        try {
            var uSwm = new URL(window.location.href);
            if (uSwm.searchParams.get('canvas_action') === 'student_work_marking') {
                schemeIdInit = (uSwm.searchParams.get('scheme_id') || '').trim();
                showGroupInit = (uSwm.searchParams.get('show_group') || '').trim();
                swmErrInit = (uSwm.searchParams.get('swm_error') || '').trim();
            }
        } catch (eSwm) {}
        return { schemeIdInit: schemeIdInit, showGroupInit: showGroupInit, swmErrInit: swmErrInit };
    }

    function initialStudentWorkMarkingState(context) {
        // context currently unused; left for future parity with others
        var p = initialSwmParamsFromUrl();
        return {
            wizardStep: 1,
            schemeId: p.schemeIdInit,
            showGroup: p.showGroupInit,
            data: null,
            loading: true,
            error: '',
            swmError: p.swmErrInit,
            spSetupError: '',
            groupSyncErrors: {},
            createForm: { scheme_name: '', site_id: '', marking_agent_id: '', curriculum_year: '' },
            pickMyScheme: '',
            pickOtherScheme: '',
            pendingAddGroup: '',
            creating: false,
            createError: '',
            feedbackOpen: false,
            feedbackTitle: '',
            feedbackHtml: '',
            feedbackLoading: false,
            markAllModel: '',
            markAllRunning: false,
            markAllDone: false,
            studentMark: {},
            schemePollTimer: null,
            studentPollTimer: null
        };
    }

    window.CanvasFeatures = window.CanvasFeatures || {};
    window.CanvasFeatures.student_work_marking = {
        initialStudentWorkMarkingState: initialStudentWorkMarkingState,
        onSetActionStudentWorkMarking: function(store, context) {
            store.studentWorkMarking = initialStudentWorkMarkingState(context || {});
            // Keep behavior: shell store method does the fetch.
            if (typeof store.refreshStudentWorkMarkingContext === 'function') {
                store.refreshStudentWorkMarkingContext();
            }
        }
    };
})();

