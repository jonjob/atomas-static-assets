(function() {
    'use strict';

    function initialOnlineLessonState() {
        return {
            step: 4,
            wizardActive: true,
            wizardStep: 1,
            wizardError: '',
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
            data: {
                content_source: 'llm',
                lesson_type: 'single',
                registration_group: '',
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

    window.CanvasFeatures = window.CanvasFeatures || {};
    window.CanvasFeatures.online_lesson = {
        onSetActionOnlineLesson: function(store, context) {
            store.onlineLesson = initialOnlineLessonState();
            var regFromContext =
                context && context.targetType === 'reg_group' && context.targetLabel
                    ? String(context.targetLabel).trim()
                    : '';
            if (regFromContext) {
                store.onlineLesson.data.registration_group = regFromContext;
            } else if (store.userRegistrationGroups && store.userRegistrationGroups.length === 1) {
                store.onlineLesson.data.registration_group = String(store.userRegistrationGroups[0] || '').trim();
            }
            var topicHint = context && context.topicHint ? String(context.topicHint).trim() : '';
            if (topicHint) {
                store.onlineLesson.data.topic = topicHint;
                store.onlineLesson.data.lesson_aims = topicHint;
            }
            fetch('/eal_interactive_lesson/students', { credentials: 'include' })
                .then(function(r) {
                    return r.json();
                })
                .then(function(data) {
                    if (store.onlineLesson) store.onlineLesson.years = data.years || [];
                })
                .catch(function() {});
        }
    };
})();
