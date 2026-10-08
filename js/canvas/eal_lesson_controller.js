(function() {
    'use strict';

    function initialEalLessonState() {
        return {
            step: 5,
            wizardActive: true,
            wizardStep: 1,
            wizardError: '',
            wizardStudentsLoading: false,
            wizardStudentsError: '',
            enhanceAimsLoading: false,
            enhanceAimsError: '',
            aimsBeforeEnhance: null,
            lessonAimsEnhanceStyle: 'fuller',
            years: [],
            messages: [],
            taskId: null,
            lessonId: null,
            lessonUrl: null,
            loading: false,
            error: '',
            creationStatus: '',
            creationStepIndex: 0,
            ealStudents: [],
            data: {
                content_source: 'llm',
                lesson_type: 'single',
                registration_group: '',
                student_id: '',
                curriculum_year: '',
                subject: '',
                lesson_aims: '',
                topic: '',
                topics_text: '',
                topics: [],
                topic_aims: [],
                lesson_name: '',
                ai_model: '',
                image_model: 'runware:400@2',
                use_custom_images: false
            }
        };
    }

    function loadEalStudentsIntoStore(store, studentsUrl) {
        var url = studentsUrl || '/eal_interactive_lesson/students';
        fetch(url, { credentials: 'include' })
            .then(function(r) { return r.json(); })
            .then(function(data) {
                if (store && store.ealLesson) {
                    store.ealLesson.ealStudents = data.eal_students || [];
                    store.ealLesson.years = data.years || [];
                }
            })
            .catch(function() {
                if (store && store.ealLesson) {
                    store.ealLesson.ealStudents = [];
                    store.ealLesson.years = [];
                }
            });
    }

    window.CanvasFeatures = window.CanvasFeatures || {};
    window.CanvasFeatures.eal_lesson = {
        onSetActionEalLesson: function(store, context, deps) {
            // Reset to match existing shell state shape.
            store.ealLesson = initialEalLessonState();
            var regFromContext = context && context.targetType === 'reg_group' && context.targetLabel
                ? String(context.targetLabel).trim()
                : '';
            if (regFromContext) {
                store.ealLesson.data.registration_group = regFromContext;
            } else if (store.userRegistrationGroups && store.userRegistrationGroups.length === 1) {
                store.ealLesson.data.registration_group = String(store.userRegistrationGroups[0] || '').trim();
            }
            var topicHint = context && context.topicHint ? String(context.topicHint).trim() : '';
            if (topicHint) {
                store.ealLesson.data.topic = topicHint;
                store.ealLesson.data.lesson_aims = topicHint;
            }
            var url = deps && deps.ealStudentsUrl;
            loadEalStudentsIntoStore(store, url);
        }
    };
})();

