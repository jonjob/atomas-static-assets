document.addEventListener('alpine:init', function() {
    /** Staff is mandatory in Entra; job title options list always leads with Staff (disabled in UI). */
    function mergeJobTitleOptionsWithStaff(options) {
        var rest = (options || []).filter(function(t) { return String(t).toLowerCase() !== 'staff'; });
        return ['Staff'].concat(rest);
    }

    // --- Sources helper (URLs) ---
    var CANVAS_MAX_SOURCES_PER_MSG = 5;
    function canvasNormalizeUrlCandidate(u) {
        var raw = String(u || '').trim();
        if (!raw) return '';
        // Trim common trailing punctuation introduced by prose/markdown.
        raw = raw.replace(/[)\],.?!;:'"”’]+$/g, '');
        // Trim leading punctuation occasionally produced by markdown lists.
        raw = raw.replace(/^[(\["']+/g, '');
        return raw.trim();
    }
    function canvasExtractUrlsFromText(text) {
        var t = String(text || '');
        if (!t) return [];
        var m = t.match(/https?:\/\/[^\s<]+/g) || [];
        var out = [];
        var seen = new Set();
        for (var i = 0; i < m.length; i++) {
            var url = canvasNormalizeUrlCandidate(m[i]);
            if (!url) continue;
            if (seen.has(url)) continue;
            seen.add(url);
            out.push(url);
            if (out.length >= CANVAS_MAX_SOURCES_PER_MSG) break;
        }
        return out;
    }
    function canvasSourcesForMessageText(text) {
        var urls = canvasExtractUrlsFromText(text);
        if (!urls.length) return null;
        return urls.map(function(url) {
            var label = url;
            try {
                var u = new URL(url);
                label = u.hostname || url;
            } catch (_) {
                label = url.replace(/^https?:\/\//, '').split('/')[0] || url;
            }
            return { url: url, label: label };
        });
    }

    function canvasMarkedParseFn() {
        if (typeof marked === 'undefined') return null;
        if (typeof marked.parse === 'function') return marked.parse.bind(marked);
        if (marked.marked && typeof marked.marked.parse === 'function') return marked.marked.parse.bind(marked.marked);
        return null;
    }

    /** Render assistant markdown for main canvas chat (GFM tables, headings, bold). */
    function canvasRenderAssistantMarkdown(raw) {
        if (!raw) return '';
        if (typeof window.LessonPlanMarkdown !== 'undefined' && typeof window.LessonPlanMarkdown.renderLessonPlanMarkdown === 'function') {
            return window.LessonPlanMarkdown.renderLessonPlanMarkdown(raw);
        }
        var parseFn = canvasMarkedParseFn();
        if (parseFn) {
            if (typeof marked.setOptions === 'function') marked.setOptions({ gfm: true, breaks: true });
            return parseFn(String(raw));
        }
        return String(raw).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/\n/g, '<br>');
    }

    function canvasFinalizeAssistantMessageAtIndex(store, index) {
        if (!store || !Array.isArray(store.messages)) return;
        var msg = store.messages[index];
        if (!msg || msg.role !== 'assistant' || !(msg.content || '').trim()) return;
        var html = canvasRenderAssistantMarkdown(msg.content);
        store.messages[index] = Object.assign({}, msg, {
            contentHtml: html,
            sources: canvasSourcesForMessageText(msg.content)
        });
    }

    function canvasApplyMarkdownToAssistantMessages(messages) {
        if (!Array.isArray(messages)) return;
        messages.forEach(function(msg, i) {
            if (msg && msg.role === 'assistant' && msg.content && !msg.contentHtml) {
                msg.contentHtml = canvasRenderAssistantMarkdown(msg.content);
            }
        });
    }

    // Global helper: type an assistant message into the main dashboard chat
    window.pushAssistantMessageWithTyping = function(fullText) {
        try {
            const s = Alpine.store('canvas');
            if (!s) return;
            s.messages.push({ role: 'assistant', content: '', typingFull: fullText });
            const msg = s.messages[s.messages.length - 1];
            let idx = 0;
            const tick = setInterval(() => {
                if (idx < msg.typingFull.length) {
                    msg.content += msg.typingFull[idx];
                    idx++;
                } else {
                    clearInterval(tick);
                    delete msg.typingFull;
                    if (msg.content) msg.contentHtml = canvasRenderAssistantMarkdown(msg.content);
                    msg.sources = canvasSourcesForMessageText(msg.content);
                }
            }, 28);
        } catch (e) {
            // Fallback: push full message without typing if anything goes wrong
            try {
                const s = Alpine.store('canvas');
                if (s) {
                    var m = { role: 'assistant', content: fullText };
                    if (fullText) m.contentHtml = canvasRenderAssistantMarkdown(fullText);
                    m.sources = canvasSourcesForMessageText(fullText);
                    s.messages.push(m);
                }
            } catch (_) {}
        }
    };
    var _canvasCfgEl = document.getElementById('canvas-app-config');
    var C = {};
    try {
        C = _canvasCfgEl && _canvasCfgEl.textContent ? JSON.parse(_canvasCfgEl.textContent) : {};
    } catch (_cfgErr) {}
    const streamUrl = C.streamUrl || '';
    const initialNotebookAction = (C.initialNotebookAction || '').trim();
    const taskStatusUrl = C.taskStatusUrl || '';
    const studentWorkMarkingContextUrl = C.studentWorkMarkingContextUrl || '';
    const studentWorkMarkingCreateSchemeUrl = C.studentWorkMarkingCreateSchemeUrl || '';
    const markWorkUrl = C.markWorkUrl || '';
    const addAttachmentUrl = C.addAttachmentUrl || '';
    const getStudentFeedbackUrl = C.getStudentFeedbackUrl || '';
    const draftContentUrl = C.draftContentUrl || '';
    const updateLessonPlanContentUrl = C.updateLessonPlanContentUrl || '';
    const enhanceLessonPlanUrl = C.enhanceLessonPlanUrl || '';
    const lessonPlanUploadImageUrl = C.lessonPlanUploadImageUrl || '';
    const lessonPlanWelcomeTipsUrl = C.lessonPlanWelcomeTipsUrl || '';
    const lessonPlanStreamUrl = C.lessonPlanStreamUrl || '';
    const createLessonPlanUrl = C.createLessonPlanUrl || '';
    const enhanceLessonPlanAimsUrl = C.enhanceLessonPlanAimsUrl || '';
    const lessonPlanWizardClassUrl = C.lessonPlanWizardClassUrl || '';
    const quizExtractTextUrl = C.quizExtractTextUrl || '';
    const quizExtractUrlUrl = C.quizExtractUrlUrl || '';
    const createQuizUrl = C.createQuizUrl || '';
    const quizContentUrl = C.quizContentUrl || '';
    const quizAmendUrl = C.quizAmendUrl || '';
    const quizUpdateUrl = C.quizUpdateUrl || '';
    const quizGenerateQuestionUrl = C.quizGenerateQuestionUrl || '';
    const quizRegenerateHtmlUrl = C.quizRegenerateHtmlUrl || '';
    const quizPreviewUrlTemplate = C.quizPreviewUrlTemplate || '';
    const quizHtmlTemplates = Array.isArray(C.quizHtmlTemplates) ? C.quizHtmlTemplates : [];
    const notebookCurriculumUploadUrl = C.notebookCurriculumUploadUrl || '';
    const notebookCurriculumDocumentsUrl = C.notebookCurriculumDocumentsUrl || '';
    const notebookCurriculumDeleteBaseUrl = C.notebookCurriculumDeleteBaseUrl || '';
    const notebookMarkingUploadUrl = C.notebookMarkingUploadUrl || '';
    const notebookMarkingDocumentsUrl = C.notebookMarkingDocumentsUrl || '';
    const notebookMarkingDeleteBaseUrl = C.notebookMarkingDeleteBaseUrl || '';
    const notebookStaffUploadUrl = C.notebookStaffUploadUrl || '';
    const notebookStaffDocumentsUrl = C.notebookStaffDocumentsUrl || '';
    const notebookStaffDeleteBaseUrl = C.notebookStaffDeleteBaseUrl || '';
    const notebookStaffSharepointDrivesUrl = C.notebookStaffSharepointDrivesUrl || '';
    const notebookStaffSharepointFoldersUrl = C.notebookStaffSharepointFoldersUrl || '';
    const notebookStaffSyncSharepointUrl = C.notebookStaffSyncSharepointUrl || '';
    const notebookStaffReviewEndDateBaseUrl = C.notebookStaffReviewEndDateBaseUrl || '';
    const notebookAppUploadUrl = C.notebookAppUploadUrl || '';
    const notebookAppDocumentsUrl = C.notebookAppDocumentsUrl || '';
    const notebookAppDeleteBaseUrl = C.notebookAppDeleteBaseUrl || '';
    const notebookTrustStaffUploadUrl = C.notebookTrustStaffUploadUrl || '';
    const notebookTrustStaffDocumentsUrl = C.notebookTrustStaffDocumentsUrl || '';
    const notebookTrustStaffDeleteBaseUrl = C.notebookTrustStaffDeleteBaseUrl || '';
    const notebookRegistryCategoriesUrl = C.notebookRegistryCategoriesUrl || '';
    const notebookDocumentNotebookVisibilityUrlTemplate = (C.notebookDocumentNotebookVisibilityUrlTemplate || '').trim();
    const notebookDocumentCategoriesPatchUrlTemplate = (C.notebookDocumentCategoriesPatchUrlTemplate || '').trim();
    const personaDocumentsUrl = (C.personaDocumentsUrl || '').trim();
    const canvasThreadsRecentUrl = (C.canvasThreadsRecentUrl || '/canvasdashboard/chats/recent').trim();
    const canvasThreadsNewUrl = (C.canvasThreadsNewUrl || '/canvasdashboard/chats/new').trim();
    const canvasThreadsActiveUrl = (C.canvasThreadsActiveUrl || '/canvasdashboard/chats/active').trim();
    const canvasThreadsGetBaseUrl = (C.canvasThreadsGetBaseUrl || '/canvasdashboard/chats/').trim();
    const canvasThreadsPutBaseUrl = (C.canvasThreadsPutBaseUrl || '/canvasdashboard/chats/').trim();
    const personaDocumentsUrlResolved = (personaDocumentsUrl && personaDocumentsUrl.indexOf('persona_documents') !== -1) ? personaDocumentsUrl : '/canvasdashboard/persona_documents';
    const canvasChatUploadTempFileUrl = C.canvasChatUploadTempFileUrl || '/canvasdashboard/chat/upload_temp_file';
    const canvasPersonaDocumentsTreeUrl = C.canvasPersonaDocumentsTreeUrl || '/canvasdashboard/persona_documents_tree';
    const imageCreatorSubmitUrl = C.imageCreatorSubmitUrl || '';
    const imageCreatorEnhancePromptUrl = C.imageCreatorEnhancePromptUrl || '';
    const imageCreatorResultBaseUrl = "/image-creator/result/";
    const emailReviewListUrl = C.emailReviewListUrl || '';
    const emailDraftChatStateUrl = C.emailDraftChatStateUrl || '';
    const emailCategoryLabelsUrl = C.emailCategoryLabelsUrl || '';
    const converseEmailDraftUrl = C.converseEmailDraftUrl || '';
    const emailDraftChatPostUrl = C.emailDraftChatPostUrl || '';
    const createOutlookDraftFromChatUrl = C.createOutlookDraftFromChatUrl || '';
    const manageTodaysEmailFetchUrl = C.manageTodaysEmailFetchUrl || '';
    const manageTodaysEmailApplyUrl = C.manageTodaysEmailApplyUrl || '';
    const priorityEmailAnalyzeUrl = C.priorityEmailAnalyzeUrl || '';
    const priorityEmailConfirmDraftUrl = C.priorityEmailConfirmDraftUrl || '';
    const teamsMeetingsListUrl = C.teamsMeetingsListUrl || '';
    const teamsMeetingsSummariseUrl = C.teamsMeetingsSummariseUrl || '';
    const senPlanningContextUrl = C.senPlanningContextUrl || '';
    const senPlanningGenerateUrl = "/sen_planning/generate";
    const senPlanningChatUrl = "/sen_planning/chat";
    const senPlanningExportUrl = "/sen_planning/export";
    const senPlanningEnhanceUrl = C.senPlanningEnhanceUrl || '';
    const senPlanningGetStrandsUrl = "/sen_planning/get_strands";
    const senPlanningGetProgressionStepsUrl = "/sen_planning/get_progression_steps";
    const ealStudentsUrl = C.ealStudentsUrl || '';
    const ealStudentsByRegGroupUrl = C.ealStudentsByRegGroupUrl || ealStudentsUrl || '';
    const ealCreateFromCanvasUrl = C.ealCreateFromCanvasUrl || '';
    const onlineCreateFromCanvasUrl = C.onlineCreateFromCanvasUrl || '';
    const teacherSlideLessonsBaseUrl = C.teacherSlideLessonsBaseUrl || '/teacher_slide_lessons';
    const teacherSlideComponentsUrl = C.teacherSlideComponentsUrl || '/teacher_slide_lessons/components/definitions';
    const teacherSlideLessonUploadImageUrlTemplate = C.teacherSlideLessonUploadImageUrlTemplate || '/teacher_slide_lessons/__LESSON_ID__/upload_image';
    const teacherSlideGenerateImageUrlTemplate = C.teacherSlideGenerateImageUrlTemplate || '/teacher_slide_lessons/__LESSON_ID__/generate_image';
    const teacherSlideGenerateImageResultUrlTemplate = C.teacherSlideGenerateImageResultUrlTemplate || '/teacher_slide_lessons/__LESSON_ID__/generate_image/result/__TASK_ID__';
    const teacherSlideEnhanceImagePromptUrlTemplate = C.teacherSlideEnhanceImagePromptUrlTemplate || '/teacher_slide_lessons/__LESSON_ID__/enhance_image_prompt';
    const teacherSlideImageModels = Array.isArray(C.teacherSlideImageModels) ? C.teacherSlideImageModels : [];
    const teacherSlideImageStyles = Array.isArray(C.teacherSlideImageStyles) && C.teacherSlideImageStyles.length
        ? C.teacherSlideImageStyles
        : ['Photorealistic', 'Illustration', 'Watercolour', 'Diagram', 'Cartoon', 'Pixel art', 'Whiteboard sketch'];
    const ealStatusUrlBase = "/eal_interactive_lesson/status/";
    const studentPasswordsContextUrl = C.studentPasswordsContextUrl || '';
    const staffManagementContextUrl = C.staffManagementContextUrl || '';
    const staffManagementGetStaffDetailsUrl = C.staffManagementGetStaffDetailsUrl || '';
    const staffManagementRequestUserUrl = C.staffManagementRequestUserUrl || '';
    const staffManagementUpdateStaffDetailsUrl = C.staffManagementUpdateStaffDetailsUrl || '';
    const staffManagementBulkJobTitlesUrl = C.staffManagementBulkJobTitlesUrl || '';
    const staffManagementBulkRegistrationGroupsUrl = C.staffManagementBulkRegistrationGroupsUrl || '';
    const staffManagementBulkYearsUrl = C.staffManagementBulkYearsUrl || '';
    const staffManagementBulkSubjectAreasUrl = C.staffManagementBulkSubjectAreasUrl || '';
    const staffManagementRequestAccountDisableUrl = C.staffManagementRequestAccountDisableUrl || '';
    const staffManagementToggleAdminUrl = C.staffManagementToggleAdminUrl || '';
    const taskStatusUrlBase = C.taskStatusUrlBase || '';
    const defaultModel = C.defaultModel || 'gemini-2.5-flash';
    const defaultAzureCanvasModelId = (C.defaultAzureCanvasModelId || '').trim();
    /** Homepage dashboard chat stream: GPT-6 Luna when Azure is configured, else Gemini Flash Lite. */
    const mainCanvasChatModel = defaultAzureCanvasModelId || 'gemini-3.1-flash-lite-preview';
    const ealDefaultAzureModelId = 'azure/gpt-6-luna';
    /** SEN Planning canvas: fixed model (no picker in UI). */
    const senPlanningFixedAiModelId = 'azure/gpt-6-luna';
    const lessonPlanDefaultAiModelId = (C.lessonPlanDefaultAiModelId || '').trim();
    const defaultPersonaId = C.defaultPersonaId || '';
    const aiAgentsList = C.aiAgentsList || [];
    const aiModelsList = C.aiModelsList || [];
    const yearsList = C.yearsList || [];
    const subjectsList = C.subjectsList || [];
    const ncYearsList = C.ncYearsList || [];
    const registrationGroupsList = C.registrationGroupsList || [];
    const userFirstname = C.userFirstname || 'Teacher';
    const userRegistrationGroupsList = C.userRegistrationGroupsList || [];
    const userGreetingRole = C.userGreetingRole || 'other';
    const schoolGoogleAiEnabled = Boolean(C.schoolGoogleAiEnabled);
    const personasListFromServer = C.personasListFromServer || [];
    /** Trim, lowercase, collapse whitespace — for comparing canonical persona display names. */
    function normalizePersonaName(name) {
        return String(name || '')
            .trim()
            .toLowerCase()
            .replace(/\s+/g, ' ');
    }
    /** Canonical normalized name; also see matchesHeadteacherSltPersonaName() for minor wording variants. */
    var SLT_AGENT_DISPLAY_NAME_NORMALIZED = 'headteacher and slt chat';
    var DEFAULT_WORKSPACE_THEME = {
        workspace_theme_key: 'atomas',
        workspace_core_color: '#c2410c',
        workspace_accent_color: '#64748b',
        workspace_surface_tint: '#F7F9FB',
        workspace_badge_style: 'solid'
    };
    var WORKSPACE_THEMES_BY_KEY = {
        headteacher_slt: {
            workspace_theme_key: 'headteacher_slt',
            workspace_core_color: '#1e3a8a',
            workspace_accent_color: '#c9a227',
            workspace_surface_tint: '#eef2ff',
            workspace_badge_style: 'solid'
        },
        hr: {
            workspace_theme_key: 'hr',
            workspace_core_color: '#0f766e',
            workspace_accent_color: '#94a3b8',
            workspace_surface_tint: '#ecfeff',
            workspace_badge_style: 'solid'
        },
        atomas: DEFAULT_WORKSPACE_THEME,
        literacy: {
            workspace_theme_key: 'literacy',
            workspace_core_color: '#7f1d1d',
            workspace_accent_color: '#f5e6c8',
            workspace_surface_tint: '#fff7f7',
            workspace_badge_style: 'solid'
        },
        computing: {
            workspace_theme_key: 'computing',
            workspace_core_color: '#7f1d1d',
            workspace_accent_color: '#a855f7',
            workspace_surface_tint: '#fdf4ff',
            workspace_badge_style: 'solid'
        },
        spag: {
            workspace_theme_key: 'spag',
            workspace_core_color: '#7f1d1d',
            workspace_accent_color: '#64748b',
            workspace_surface_tint: '#F7F9FB',
            workspace_badge_style: 'solid'
        }
    };
    function inferThemeKeyFromPersonaName(name) {
        var n = normalizePersonaName(name);
        if (!n) return 'atomas';
        if (matchesHeadteacherSltPersonaName(n)) return 'headteacher_slt';
        if (n.indexOf('hr') !== -1 || n.indexOf('human resources') !== -1) return 'hr';
        if (n.indexOf('computing') !== -1) return 'computing';
        if (n.indexOf('spag') !== -1 || (n.indexOf('spelling') !== -1 && n.indexOf('grammar') !== -1)) return 'spag';
        if (n.indexOf('literacy') !== -1) return 'literacy';
        if (n.indexOf('atomas') !== -1 || (n.indexOf('atom') !== -1 && n.indexOf('it') !== -1)) return 'atomas';
        return 'atomas';
    }
    function resolveWorkspaceTheme(persona) {
        var fallback = Object.assign({}, DEFAULT_WORKSPACE_THEME);
        if (!persona || typeof persona !== 'object') return fallback;
        var explicitKey = String(persona.workspace_theme_key || '').trim().toLowerCase();
        var inferredKey = explicitKey || inferThemeKeyFromPersonaName(persona.name || '');
        var keyed = WORKSPACE_THEMES_BY_KEY[inferredKey] || fallback;
        return {
            workspace_theme_key: inferredKey || keyed.workspace_theme_key || fallback.workspace_theme_key,
            workspace_core_color: String(persona.workspace_core_color || keyed.workspace_core_color || fallback.workspace_core_color),
            workspace_accent_color: String(persona.workspace_accent_color || keyed.workspace_accent_color || fallback.workspace_accent_color),
            workspace_surface_tint: String(persona.workspace_surface_tint || keyed.workspace_surface_tint || fallback.workspace_surface_tint),
            workspace_badge_style: String(persona.workspace_badge_style || keyed.workspace_badge_style || fallback.workspace_badge_style)
        };
    }
    function matchesHeadteacherSltPersonaName(name) {
        var n = normalizePersonaName(name);
        if (!n) return false;
        if (n === SLT_AGENT_DISPLAY_NAME_NORMALIZED) return true;
        var hasHead = n.indexOf('headteacher') !== -1 || n.indexOf('head teacher') !== -1;
        return hasHead && /\bslt\b/.test(n);
    }
    function pickPersonaSwitchIntro(lines) {
        if (!lines || !lines.length) return '';
        return lines[Math.floor(Math.random() * lines.length)];
    }
    const initialCanvasChatId = C.initialCanvasChatId || '';
    (function() {
        var cid = typeof initialCanvasChatId !== 'undefined' && initialCanvasChatId;
        if (!cid) return;
        try {
            var url = new URL(window.location.href);
            if (url.searchParams.get('canvas_chat_id') === cid) return;
            url.searchParams.set('canvas_chat_id', cid);
            history.replaceState(null, '', url.toString());
        } catch (e) {}
    })();
    const canvasStateGetUrl = C.canvasStateGetUrl || '';
    const canvasStatePutUrl = C.canvasStatePutUrl || '';
    const canvasStateClearUrl = C.canvasStateClearUrl || '';
    function safeAppUrl(url, fallbackUrl) {
        var u = String(url || '').trim();
        if (!u || u === '/' || !u.startsWith('/') || u.indexOf('/#') === 0) return String(fallbackUrl || '');
        return u;
    }
    var __endpointWarned = {};
    function safeAppUrlWithWarn(url, fallbackUrl, key) {
        var resolved = safeAppUrl(url, fallbackUrl);
        var provided = String(url || '').trim();
        if (resolved === String(fallbackUrl || '') && provided !== resolved && !__endpointWarned[key]) {
            __endpointWarned[key] = true;
            try { console.warn('[canvas] invalid endpoint config for ' + key + '; using fallback', { provided: provided, fallback: resolved }); } catch (_) {}
        }
        return resolved;
    }
    const streamUrlSafe = safeAppUrlWithWarn(streamUrl, '/canvasdashboard/chat/stream', 'streamUrl');
    const canvasThreadsRecentUrlSafe = safeAppUrlWithWarn(canvasThreadsRecentUrl, '/canvasdashboard/chats/recent', 'canvasThreadsRecentUrl');
    const canvasThreadsNewUrlSafe = safeAppUrlWithWarn(canvasThreadsNewUrl, '/canvasdashboard/chats/new', 'canvasThreadsNewUrl');
    const canvasThreadsActiveUrlSafe = safeAppUrlWithWarn(canvasThreadsActiveUrl, '/canvasdashboard/chats/active', 'canvasThreadsActiveUrl');
    const canvasThreadsGetBaseUrlSafe = safeAppUrlWithWarn(canvasThreadsGetBaseUrl, '/canvasdashboard/chats/', 'canvasThreadsGetBaseUrl');
    const canvasThreadsPutBaseUrlSafe = safeAppUrlWithWarn(canvasThreadsPutBaseUrl, '/canvasdashboard/chats/', 'canvasThreadsPutBaseUrl');
    const canvasStateGetUrlSafe = safeAppUrlWithWarn(canvasStateGetUrl, '/api/canvas_state', 'canvasStateGetUrl');
    const canvasStatePutUrlSafe = safeAppUrlWithWarn(canvasStatePutUrl, '/api/canvas_state', 'canvasStatePutUrl');
    const canvasStateClearUrlSafe = safeAppUrlWithWarn(canvasStateClearUrl, '/api/canvas_state/clear', 'canvasStateClearUrl');
    const onlineCreateFromCanvasUrlSafe = safeAppUrlWithWarn(
        onlineCreateFromCanvasUrl,
        '/online_interactive_lesson/create_from_canvas',
        'onlineCreateFromCanvasUrl'
    );
    const teacherSlideLessonsBaseUrlSafe = safeAppUrlWithWarn(
        teacherSlideLessonsBaseUrl,
        '/teacher_slide_lessons',
        'teacherSlideLessonsBaseUrl'
    );
    const teacherSlideComponentsUrlSafe = safeAppUrlWithWarn(
        teacherSlideComponentsUrl,
        '/teacher_slide_lessons/components/definitions',
        'teacherSlideComponentsUrl'
    );
    const teacherSlideLessonUploadImageUrlTemplateSafe = safeAppUrlWithWarn(
        teacherSlideLessonUploadImageUrlTemplate,
        '/teacher_slide_lessons/__LESSON_ID__/upload_image',
        'teacherSlideLessonUploadImageUrlTemplate'
    );
    const teacherSlideGenerateImageUrlTemplateSafe = safeAppUrlWithWarn(
        teacherSlideGenerateImageUrlTemplate,
        '/teacher_slide_lessons/__LESSON_ID__/generate_image',
        'teacherSlideGenerateImageUrlTemplate'
    );
    const teacherSlideGenerateImageResultUrlTemplateSafe = safeAppUrlWithWarn(
        teacherSlideGenerateImageResultUrlTemplate,
        '/teacher_slide_lessons/__LESSON_ID__/generate_image/result/__TASK_ID__',
        'teacherSlideGenerateImageResultUrlTemplate'
    );
    const teacherSlideEnhanceImagePromptUrlTemplateSafe = safeAppUrlWithWarn(
        teacherSlideEnhanceImagePromptUrlTemplate,
        '/teacher_slide_lessons/__LESSON_ID__/enhance_image_prompt',
        'teacherSlideEnhanceImagePromptUrlTemplate'
    );
    var __invalidWriteUrlWarned = {};
    function safeWriteFetch(url, options, warnKey) {
        var target = String(url || '').trim();
        if (!target || target === '/' || !target.startsWith('/')) {
            if (!__invalidWriteUrlWarned[warnKey || target]) {
                __invalidWriteUrlWarned[warnKey || target] = true;
                try { console.warn('[canvas] blocked unsafe write URL', { url: target, key: warnKey || '' }); } catch (_) {}
            }
            return Promise.resolve({ ok: false, blocked: true });
        }
        return fetch(target, options || {});
    }
    function installCanvasSubmitGuard() {
        if (typeof document === 'undefined') return;
        if (window.__canvasSubmitGuardInstalled) return;
        window.__canvasSubmitGuardInstalled = true;
        /* Bubble phase so handlers on the form (e.g. Alpine @submit.prevent) run first.
           Capture + stopPropagation previously prevented the event from reaching the form,
           breaking SEN planning and other in-page submits with no action attribute. */
        document.addEventListener('submit', function(evt) {
            var form = evt && evt.target;
            if (!form || !form.getAttribute) return;
            var rawAction = String(form.getAttribute('action') || '').trim();
            var action = rawAction;
            if (!action) action = window.location.pathname || '/';
            if (action.indexOf('http://') === 0 || action.indexOf('https://') === 0) {
                try {
                    action = new URL(action).pathname || '/';
                } catch (_) {}
            }
            var isUnsafe = (
                action === '/' ||
                action === window.location.pathname ||
                action === window.location.href ||
                action === '#'
            );
            if (isUnsafe && !evt.defaultPrevented) {
                evt.preventDefault();
                try {
                    console.warn('[canvas] blocked unsafe form submit', { action: rawAction || action });
                } catch (_) {}
            }
        }, false);
    }
    installCanvasSubmitGuard();
    function installCanvasFetchWriteGuard() {
        if (typeof window === 'undefined' || typeof window.fetch !== 'function') return;
        if (window.__canvasFetchWriteGuardInstalled) return;
        window.__canvasFetchWriteGuardInstalled = true;
        var originalFetch = window.fetch.bind(window);
        window.fetch = function(input, init) {
            var requestMethod = (input && typeof input === 'object' && typeof input.method === 'string') ? input.method : '';
            var method = String((init && init.method) || requestMethod || 'GET').toUpperCase();
            var urlRaw = '';
            if (typeof input === 'string') {
                urlRaw = input;
            } else if (input && typeof input.url === 'string') {
                urlRaw = input.url;
            }
            var normalized = String(urlRaw || '').trim();
            if (normalized.indexOf('http://') === 0 || normalized.indexOf('https://') === 0) {
                try { normalized = new URL(normalized).pathname || '/'; } catch (_) {}
            }
            var isWrite = method === 'POST' || method === 'PUT' || method === 'PATCH' || method === 'DELETE';
            var isUnsafe = !normalized || normalized === '/' || normalized === '#';
            if (isWrite && isUnsafe) {
                try {
                    console.warn('[canvas] blocked unsafe fetch write', { method: method, url: urlRaw || normalized });
                    if (typeof console.trace === 'function') console.trace('[canvas] unsafe fetch write trace');
                } catch (_) {}
                return Promise.resolve(new Response('{}', { status: 204, headers: { 'Content-Type': 'application/json' } }));
            }
            return originalFetch(input, init);
        };
    }
    installCanvasFetchWriteGuard();
    function installCanvasXhrWriteGuard() {
        if (typeof window === 'undefined' || typeof window.XMLHttpRequest === 'undefined') return;
        if (window.__canvasXhrWriteGuardInstalled) return;
        window.__canvasXhrWriteGuardInstalled = true;
        var origOpen = window.XMLHttpRequest.prototype.open;
        var origSend = window.XMLHttpRequest.prototype.send;
        window.XMLHttpRequest.prototype.open = function(method, url) {
            this.__canvasGuardMethod = String(method || 'GET').toUpperCase();
            this.__canvasGuardUrl = String(url || '').trim();
            return origOpen.apply(this, arguments);
        };
        window.XMLHttpRequest.prototype.send = function(body) {
            var method = String(this.__canvasGuardMethod || 'GET').toUpperCase();
            var target = String(this.__canvasGuardUrl || '').trim();
            if (target.indexOf('http://') === 0 || target.indexOf('https://') === 0) {
                try { target = new URL(target).pathname || '/'; } catch (_) {}
            }
            var isWrite = method === 'POST' || method === 'PUT' || method === 'PATCH' || method === 'DELETE';
            var isUnsafe = !target || target === '/' || target === '#';
            if (isWrite && isUnsafe) {
                try {
                    console.warn('[canvas] blocked unsafe XHR write', { method: method, url: this.__canvasGuardUrl || target });
                    if (typeof console.trace === 'function') console.trace('[canvas] unsafe XHR write trace');
                } catch (_) {}
                try {
                    this.abort();
                } catch (_) {}
                return;
            }
            return origSend.call(this, body);
        };
    }
    installCanvasXhrWriteGuard();
    const redstorBackupSummaryUrl = (C.redstorBackupSummaryUrl || '').trim() || '/api/it_compliance/redstor_backup_summary';
    const cynetCyberStatusUrl = (C.cynetCyberStatusUrl || '').trim() || '/api/it_compliance/cynet_cyber_status';
    const sharepointSitesUrl = C.sharepointSitesUrl || '';
    const resetConversationalChatUrl = C.resetConversationalChatUrl || '';
    const emailStudentPasswordsUrl = C.emailStudentPasswordsUrl || '';
    const canvasActionBoot = (C.canvasAction || '').trim();
    const isAlertOnlySchoolBoot = !!C.isAlertOnlySchool;
    const isSuperadminBoot = !!C.isSuperadmin;
    const isTrustNotebookAdminBoot = !!C.isTrustNotebookAdmin;
    var NOTEBOOK_CANVAS_ACTIONS = [
        'notebook_admin',
        'notebook_curriculum',
        'notebook_marking_rubrics',
        'notebook_staff',
        'notebook_app_documents',
        'notebook_trust_staff'
    ];
    var REACT_CANVAS_ACTIONS = ['notebook_agent_categories', 'persona_themes', 'sharepoint_favourites', 'alert_system'];
    const sodCanvasFragmentUrlTemplate = (C.sodCanvasFragmentUrlTemplate || '/sod/canvas/SECTION_PLACEHOLDER').trim();
    const initialSodSeasonIdBoot = (C.initialSodSeasonId || '').trim();
    const initialSodSchoolIdBoot = (C.initialSodSchoolId || '').trim();

    function sodActionToSection(action) {
        var m = {
            sod_home: 'home',
            sod_seasons: 'seasons',
            sod_indicators: 'indicators',
            sod_data_entry: 'data_entry',
            sod_visualizations: 'visualizations'
        };
        return m[action] || 'home';
    }

    function buildSodFragmentUrl(section) {
        var path = sodCanvasFragmentUrlTemplate.replace('SECTION_PLACEHOLDER', section);
        var store =
            typeof Alpine !== 'undefined' && Alpine.store ? Alpine.store('canvas') : null;
        var params = new URLSearchParams();
        if (section === 'data_entry' && store && store.sodDataEntryParams) {
            var dep = store.sodDataEntryParams;
            if (dep.seasonId) params.set('season_id', String(dep.seasonId));
            if (dep.schoolId) params.set('school_id', String(dep.schoolId));
        }
        if (section === 'visualizations' && store && store.sodVizSeasonId) {
            params.set('season_id', String(store.sodVizSeasonId));
        }
        var qs = params.toString();
        return qs ? path + '?' + qs : path;
    }

    function injectHtmlWithScripts(container, html) {
        if (!container) return Promise.resolve();
        var d = document.createElement('div');
        d.innerHTML = html;
        var scripts = Array.prototype.slice.call(d.querySelectorAll('script'));
        for (var r = scripts.length - 1; r >= 0; r--) {
            scripts[r].parentNode.removeChild(scripts[r]);
        }
        container.innerHTML = d.innerHTML;
        return new Promise(function(resolve) {
            function appendNext(i) {
                if (i >= scripts.length) return resolve();
                var oldScript = scripts[i];
                var s = document.createElement('script');
                if (oldScript.src) {
                    s.src = oldScript.src;
                    s.onload = function() {
                        appendNext(i + 1);
                    };
                    s.onerror = function() {
                        appendNext(i + 1);
                    };
                    container.appendChild(s);
                } else {
                    s.textContent = oldScript.textContent;
                    container.appendChild(s);
                    appendNext(i + 1);
                }
            }
            appendNext(0);
        });
    }

    // Export injector so feature controllers can hook after scripts load.
    window.CanvasInjectHtmlWithScripts = injectHtmlWithScripts;

    // Minimal feature registry/dispatcher for injected fragments.
    window.CanvasFeatures = window.CanvasFeatures || {};
    window.CanvasFeaturesDispatch = function(featureKey, action, root, context) {
        var feature = window.CanvasFeatures && window.CanvasFeatures[featureKey];
        if (!feature || typeof feature.onFragmentInjected !== 'function') return;
        try {
            feature.onFragmentInjected({ root: root, action: action, context: context || {} });
        } catch (e) {
            // eslint-disable-next-line no-console
            console.error('CanvasFeaturesDispatch error:', e);
        }
    };

    window.sodLoadFragmentForAction = function(action) {
        var sod = window.CanvasFeatures && window.CanvasFeatures.sod;
        if (sod && typeof sod.loadFragmentForAction === 'function') return sod.loadFragmentForAction(action);

        // Fallback: keep existing behavior if the feature module did not load.
        var section = sodActionToSection(action);
        var root = document.getElementById('sod-canvas-root');
        if (!root) return;
        var url = buildSodFragmentUrl(section);
        root.innerHTML = '<p class="text-sm text-slate-500 p-4">Loading&hellip;</p>';
        return fetch(url, { credentials: 'include' })
            .then(function(r) {
                return r.ok ? r.text() : Promise.reject(new Error(String(r.status)));
            })
            .then(function(html) {
                injectHtmlWithScripts(root, html);
            })
            .catch(function() {
                root.innerHTML =
                    '<p class="text-sm text-red-600 p-4">Could not load School Overview content.</p>';
            });
    };

    window.sodLoadSection = function(action) {
        var sod = window.CanvasFeatures && window.CanvasFeatures.sod;
        if (sod && typeof sod.loadSection === 'function') return sod.loadSection(action);
        var s = Alpine.store('canvas');
        if (s && typeof s.setAction === 'function') s.setAction(action);
    };

    window.sodReloadCurrentSection = function() {
        var sod = window.CanvasFeatures && window.CanvasFeatures.sod;
        if (sod && typeof sod.reloadCurrentSection === 'function') return sod.reloadCurrentSection();
        var s = Alpine.store('canvas');
        if (!s || !s.currentAction || String(s.currentAction).indexOf('sod_') !== 0) return;
        window.sodLoadFragmentForAction(s.currentAction);
    };

    window.sodLoadSectionWithParams = function(action, p) {
        var sod = window.CanvasFeatures && window.CanvasFeatures.sod;
        if (sod && typeof sod.loadSectionWithParams === 'function') return sod.loadSectionWithParams(action, p);
        var s = Alpine.store('canvas');
        if (!s) return;
        if (action === 'sod_data_entry' && p) {
            s.sodDataEntryParams = { seasonId: p.seasonId || null, schoolId: p.schoolId || null };
            s.setAction(action, { seasonId: p.seasonId, schoolId: p.schoolId });
            return;
        }
        if (action === 'sod_visualizations') {
            var vizSeason = p && p.seasonId ? String(p.seasonId) : null;
            s.sodVizSeasonId = vizSeason;
            s.setAction(action, { seasonId: vizSeason });
            return;
        }
        s.setAction(action);
    };

    const initialLessonPlan = () => {
        var lp = window.CanvasFeatures && window.CanvasFeatures.lesson_plan;
        if (lp && typeof lp.initialLessonPlan === 'function') return lp.initialLessonPlan();
        return {
            step: 5,
            wizardStep: 1,
            wizardActive: true,
            wizardRegMode: 'school',
            wizardError: '',
            data: {},
            taskId: null,
            draftId: null,
            content: null,
            loading: false,
            error: '',
            chatMode: 'ask'
        };
    };
    const initialLessonPlanExport = () => {
        var lp = window.CanvasFeatures && window.CanvasFeatures.lesson_plan;
        if (lp && typeof lp.initialLessonPlanExport === 'function') return lp.initialLessonPlanExport();
        return { loading: false, error: '', successLink: '', sharePointSites: [], showSharePointPanel: false, selectedSharePointSiteId: '', format: 'word', filename: '', outlookDate: '', outlookTime: '', lastExportAddedToCalendar: false };
    };
    const initialQuiz = () => {
        var q = window.CanvasFeatures && window.CanvasFeatures.quiz;
        if (q && typeof q.initialQuiz === 'function') return q.initialQuiz();
        return {
            wizardActive: true,
            wizardStep: 1,
            wizardRegMode: 'school',
            wizardError: '',
            htmlTemplateId: 'classic',
            quizPreviewNonce: 0,
            outputFormat: 'interactive_html',
            step: 1,
            messages: [],
            taskId: null,
            quizId: null,
            quizPublicUrl: null,
            outputMode: 'interactive_html',
            quizPanelExpanded: false,
            quizSaveLoading: false,
            quizRegenerateLoading: false,
            content: null,
            questions: null,
            data: { num_questions: 5, include_answers: true, topic: '' },
            contentSource: 'paste',
            uploadedContentText: '',
            sourceUrl: '',
            sourceUrlLoading: false,
            sourceUrlError: '',
            difficulty: 'standard',
            questionTypeMix: { mc: true, fib: true, tf: true },
            loading: false,
            error: '',
            selectionMenu: null,
            amendingAt: null
        };
    };

    function normalizeCanvasQuizQuestionsFromServer(questions) {
        var q = window.CanvasFeatures && window.CanvasFeatures.quiz;
        if (q && typeof q.normalizeCanvasQuizQuestionsFromServer === 'function')
            return q.normalizeCanvasQuizQuestionsFromServer(questions);
        if (!questions || !questions.length) return [];
        return questions;
    }

    function normalizeQuizQuestionsForSave(questions) {
        if (!questions || !questions.length) return [];
        return questions.map(function(q) {
            if (!q || typeof q !== 'object') return q;
            var t = q.type;
            var base = { type: t, question: (q.question || '').trim() };
            if (q.id) base.id = String(q.id);
            if ((q.image_url || '').trim()) {
                base.image_url = String(q.image_url).trim();
                base.image_alt = String(q.image_alt || q.image_prompt || 'Quiz image').trim();
            }
            if (t === 'mc') {
                var opts = (q.options || []).map(function(x) { return String(x !== undefined && x !== null ? x : ''); });
                while (opts.length < 4) opts.push('');
                opts = opts.slice(0, 4);
                var c = q.correct;
                var correctNum = parseInt(c, 10);
                if (!isNaN(correctNum) && correctNum >= 1 && correctNum <= 4) {
                    return Object.assign(base, { options: opts, correct: correctNum });
                }
                if (typeof c === 'string' && c.length) {
                    var idx = opts.findIndex(function(o) { return o.trim() === c.trim(); });
                    if (idx >= 0) return Object.assign(base, { options: opts, correct: idx + 1 });
                    return Object.assign(base, { options: opts, correct: c });
                }
                return Object.assign(base, { options: opts, correct: 1 });
            }
            if (t === 'fib') {
                return Object.assign(base, {
                    answer: q.answer !== undefined ? q.answer : (q.correct || ''),
                    hint: q.hint || ''
                });
            }
            if (t === 'tf') {
                var a = q.answer;
                if (typeof a !== 'boolean') a = a === 'true' || a === true || (typeof q.correct === 'string' && q.correct.toLowerCase() === 'true');
                return Object.assign(base, { answer: !!a, explanation: q.explanation || '' });
            }
            return q;
        }).filter(function(q) {
            return q && String(q.question || '').trim().length > 0;
        });
    }

    /** Celery /api/task_status may return result as an object, JSON string, or [dict] depending on broker/serializer. */
    function parseCanvasCeleryTaskResult(raw) {
        var r = raw;
        if (r == null) return {};
        if (typeof r === 'string') {
            try {
                r = JSON.parse(r);
            } catch (e) {
                return {};
            }
        }
        if (Array.isArray(r) && r.length === 1) r = r[0];
        if (!r || typeof r !== 'object') return {};
        return r;
    }

    /** Sync canvas quiz.outputMode from GET /quiz/{id}/content (saved Celery output_format). */
    function applyQuizOutputFormatFromApi(store, qData) {
        var q = window.CanvasFeatures && window.CanvasFeatures.quiz;
        if (q && typeof q.applyQuizOutputFormatFromApi === 'function')
            return q.applyQuizOutputFormatFromApi(store, qData);
        if (!store || !store.quiz || !qData) return;
    }

    function sanitizeLessonPlanDataForUi(data) {
        var next = (data && typeof data === 'object') ? Object.assign({}, data) : {};
        // This is a transient UI loading flag and should never survive restores.
        next.workspace_image_prompt_enhancing = false;
        return next;
    }

    function sanitizeLessonPlanDataForPersist(data) {
        var next = sanitizeLessonPlanDataForUi(data);
        delete next.workspace_image_prompt_enhancing;
        return next;
    }

    const initialOnlineLesson = () => ({
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
    });

    const initialEalLesson = () => ({
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
    });

    /** True after restoreLessonPlanOnLoad applied a draft_id-based lesson editor (draft wins over server canvas_state). */
    var canvasLessonPlanRestoredFromDraft = false;

    function buildCanvasStatePayload(store) {
        if (!store) return {};
        var chatContext = {
            thread_id: store.canvasChatId || '',
            chat_history: store.messages || [],
            ai_persona_id: (store.aiPersonaId !== null && store.aiPersonaId !== undefined && store.aiPersonaId !== '') ? String(store.aiPersonaId) : '',
            selected_document_ids: (store.sessionNotebookSelections || []).map(function(x) { return String(x.id); }),
            selected_document_titles: (store.sessionNotebookSelections || []).reduce(function(acc, x) {
                var key = String((x && x.id) || '').trim();
                var val = String((x && x.title) || '').trim();
                if (key && val) acc[key] = val;
                return acc;
            }, {}),
            lesson_plan_data: (store.lessonPlan && store.lessonPlan.data) ? sanitizeLessonPlanDataForPersist(store.lessonPlan.data) : {},
            currentAction: store.currentAction,
            actionContext: Object.assign({ targetLabel: '', targetType: '' }, store.actionContext || {}),
            chatOnRight: store.currentAction === 'lesson_plan' || store.currentAction === 'quiz' ? false : !!store.chatOnRight,
            lessonPlan: store.lessonPlan ? {
                step: store.lessonPlan.step,
                draftId: store.lessonPlan.draftId,
                taskId: store.lessonPlan.taskId,
                wizardActive: !!store.lessonPlan.wizardActive,
                wizardStep: store.lessonPlan.wizardStep
            } : null,
            canvas_quiz: null,
            canvas_eal: null,
            canvas_online_lesson: null,
            canvas_teacher_slide_lesson: null,
            canvas_swm: null,
            canvas_image_creator: null,
            canvas_email: null
        };
        if (store.quiz) {
            var qz = store.quiz;
            chatContext.canvas_quiz = {
                wizardActive: !!qz.wizardActive,
                wizardStep: qz.wizardStep,
                wizardRegMode: qz.wizardRegMode,
                wizardError: qz.wizardError || '',
                outputFormat: qz.outputFormat || '',
                difficulty: qz.difficulty || 'standard',
                questionTypeMix: Object.assign({ mc: true, fib: true, tf: true }, qz.questionTypeMix || {}),
                answerDocumentMode: qz.answerDocumentMode || 'teacher',
                notebookSelections: (qz.notebookSelections || []).slice(),
                sourceUrl: qz.sourceUrl || '',
                sourcePreview: Object.assign({}, qz.sourcePreview || {}),
                quizExport: Object.assign({}, qz.quizExport || {}),
                step: qz.step,
                messages: qz.messages || [],
                taskId: qz.taskId,
                quizId: qz.quizId,
                quizPublicUrl: qz.quizPublicUrl || null,
                outputMode: qz.outputMode || 'interactive_html',
                quizPanelExpanded: !!qz.quizPanelExpanded,
                content: qz.content,
                questions: qz.questions,
                contentSource: qz.contentSource || 'scratch',
                uploadedContentText: qz.uploadedContentText || '',
                htmlTemplateId: qz.htmlTemplateId || 'classic',
                quizPreviewNonce: qz.quizPreviewNonce || 0,
                data: Object.assign({}, qz.data || {}),
                loading: !!qz.loading,
                error: qz.error || ''
            };
        }
        if (store.currentAction === 'online_lesson' && store.onlineLesson) {
            var ol = store.onlineLesson;
            chatContext.canvas_online_lesson = {
                step: ol.step,
                wizardActive: !!ol.wizardActive,
                wizardStep: ol.wizardStep,
                messages: ol.messages || [],
                taskId: ol.taskId,
                lessonId: ol.lessonId,
                lessonUrl: ol.lessonUrl,
                loading: !!ol.loading,
                error: ol.error || '',
                wizardError: ol.wizardError || '',
                enhanceAimsLoading: !!ol.enhanceAimsLoading,
                enhanceAimsError: ol.enhanceAimsError || '',
                creationStatus: ol.creationStatus || '',
                creationStepIndex: ol.creationStepIndex,
                data: Object.assign({}, ol.data || {})
            };
        }
        if (store.currentAction === 'lesson_slide_creator' && store.teacherSlideLesson) {
            var tsl = store.teacherSlideLesson;
            chatContext.canvas_teacher_slide_lesson = {
                lessonId: tsl.lessonId || null,
                publishedUrl: tsl.publishedUrl || '',
                activeStep: tsl.activeStep || 'setup',
                selectedSlideIndex: tsl.selectedSlideIndex || 0,
                viewMode: tsl.viewMode || 'edit',
                data: Object.assign({}, tsl.data || {})
            };
        }
        if (store.currentAction === 'eal_lesson' && store.ealLesson) {
            var el = store.ealLesson;
            chatContext.canvas_eal = {
                step: el.step,
                wizardActive: !!el.wizardActive,
                wizardStep: el.wizardStep,
                messages: el.messages || [],
                taskId: el.taskId,
                lessonId: el.lessonId,
                lessonUrl: el.lessonUrl,
                loading: !!el.loading,
                error: el.error || '',
                wizardError: el.wizardError || '',
                wizardStudentsLoading: !!el.wizardStudentsLoading,
                wizardStudentsError: el.wizardStudentsError || '',
                enhanceAimsLoading: !!el.enhanceAimsLoading,
                enhanceAimsError: el.enhanceAimsError || '',
                creationStatus: el.creationStatus || '',
                creationStepIndex: el.creationStepIndex,
                data: Object.assign({}, el.data || {})
            };
        }
        if (store.studentWorkMarking) {
            var swm = store.studentWorkMarking;
            chatContext.canvas_swm = {
                schemeId: (swm.schemeId || '').toString(),
                showGroup: (swm.showGroup || '').toString(),
                swmError: swm.swmError || ''
            };
        }
        if (store.currentAction === 'image_creator') {
            chatContext.canvas_image_creator = {
                imageCreatorPrompt: store.imageCreatorPrompt || '',
                imageCreatorStyle: store.imageCreatorStyle || 'Photorealistic',
                imageCreatorSize: store.imageCreatorSize || '512',
                imageCreatorModel: store.imageCreatorModel || 'runware:400@2',
                imageCreatorLoading: !!store.imageCreatorLoading,
                imageCreatorEnhancing: !!store.imageCreatorEnhancing,
                imageCreatorResult: store.imageCreatorResult,
                imageCreatorTaskId: store.imageCreatorTaskId,
                imageCreatorFromChat: !!store.imageCreatorFromChat
            };
        }
        if (store.currentAction === 'email') {
            chatContext.canvas_email = { emailSubMode: store.emailSubMode || 'manage_todays' };
        }
        return chatContext;
    }

    function syncCanvasUrlParams(store) {
        if (!store || typeof window === 'undefined') return;
        try {
            var url = new URL(window.location.href);
            if (store.canvasChatId) url.searchParams.set('canvas_chat_id', store.canvasChatId);
            var act = store.currentAction;
            if (!act) {
                url.searchParams.delete('canvas_action');
                url.searchParams.delete('scheme_id');
                url.searchParams.delete('show_group');
                url.searchParams.delete('draft_id');
                url.searchParams.delete('email_panel');
                url.searchParams.delete('staff_subview');
                url.searchParams.delete('sod_season_id');
                url.searchParams.delete('sod_school_id');
                url.searchParams.delete('eal_lesson_id');
                url.searchParams.delete('online_lesson_id');
                url.searchParams.delete('teacher_slide_lesson_id');
            } else {
                url.searchParams.set('canvas_action', act);
                if (act === 'student_work_marking') {
                    var swm = store.studentWorkMarking;
                    if (swm && swm.schemeId) url.searchParams.set('scheme_id', String(swm.schemeId));
                    else url.searchParams.delete('scheme_id');
                    if (swm && swm.showGroup) url.searchParams.set('show_group', String(swm.showGroup));
                    else url.searchParams.delete('show_group');
                } else {
                    url.searchParams.delete('scheme_id');
                    url.searchParams.delete('show_group');
                }
                var lp = store.lessonPlan;
                if (act === 'lesson_plan' && lp && lp.draftId)
                    url.searchParams.set('draft_id', String(lp.draftId));
                else url.searchParams.delete('draft_id');
                if (act === 'email' && store.emailSubMode === 'draft_chat') url.searchParams.set('email_panel', 'draft_chat');
                else url.searchParams.delete('email_panel');
                if (act === 'staff_management' && store.staffManagement && store.staffManagement.activeSubView) {
                    var sv = store.staffManagement.activeSubView;
                    if (['job_titles', 'registration_groups', 'years', 'subject_areas'].indexOf(sv) >= 0) url.searchParams.set('staff_subview', sv);
                    else url.searchParams.delete('staff_subview');
                } else url.searchParams.delete('staff_subview');
                if (act && String(act).indexOf('sod_') === 0) {
                    if (act === 'sod_data_entry' && store.sodDataEntryParams) {
                        if (store.sodDataEntryParams.seasonId)
                            url.searchParams.set('sod_season_id', String(store.sodDataEntryParams.seasonId));
                        else url.searchParams.delete('sod_season_id');
                        if (store.sodDataEntryParams.schoolId)
                            url.searchParams.set('sod_school_id', String(store.sodDataEntryParams.schoolId));
                        else url.searchParams.delete('sod_school_id');
                    } else if (act === 'sod_visualizations' && store.sodVizSeasonId) {
                        url.searchParams.set('sod_season_id', String(store.sodVizSeasonId));
                        url.searchParams.delete('sod_school_id');
                    } else {
                        url.searchParams.delete('sod_season_id');
                        url.searchParams.delete('sod_school_id');
                    }
                } else {
                    url.searchParams.delete('sod_season_id');
                    url.searchParams.delete('sod_school_id');
                }
                if (act === 'eal_lesson' && store.ealLesson && store.ealLesson.lessonId)
                    url.searchParams.set('eal_lesson_id', String(store.ealLesson.lessonId));
                else url.searchParams.delete('eal_lesson_id');
                if (act === 'online_lesson' && store.onlineLesson && store.onlineLesson.lessonId)
                    url.searchParams.set('online_lesson_id', String(store.onlineLesson.lessonId));
                else url.searchParams.delete('online_lesson_id');
                if (act === 'lesson_slide_creator' && store.teacherSlideLesson && store.teacherSlideLesson.lessonId)
                    url.searchParams.set('teacher_slide_lesson_id', String(store.teacherSlideLesson.lessonId));
                else url.searchParams.delete('teacher_slide_lesson_id');
            }
            history.replaceState(null, '', url.toString());
        } catch (eSync) {}
    }

    function ealLessonEditor() {
        const store = Alpine.store('canvas');
        function getLessonId() {
            if (!store) return null;
            if (store.currentAction === 'online_lesson' && store.onlineLesson && store.onlineLesson.lessonId)
                return store.onlineLesson.lessonId;
            return store.ealLesson && store.ealLesson.lessonId;
        }
        function getPartId() { return window._ealEditorPartData && window._ealEditorPartData.part_id; }
        function getPartNumber() { return window._ealEditorPartNumber || 1; }
        function getContentText() { return window._ealEditorContentText || ''; }
        function setContentText(t) { window._ealEditorContentText = t; }
        function extractLearningSection(contentText) {
            if (!contentText) return '';
            var startMarker = '<!-- LEARNING_START -->';
            var endMarker = '<!-- LEARNING_END -->';
            var startIndex = contentText.indexOf(startMarker);
            var endIndex = contentText.indexOf(endMarker);
            if (startIndex === -1 || endIndex === -1 || endIndex <= startIndex) return '';
            var markerEnd = contentText.indexOf('-->', startIndex) + 3;
            var extracted = contentText.substring(markerEnd, endIndex).trim();
            var firstHash = extracted.indexOf('#');
            if (firstHash !== -1 && firstHash < 5) extracted = extracted.substring(firstHash);
            extracted = extracted.replace(/^#*\s*💡\s*Learning\s+About[^\n]*\n*/i, '');
            extracted = extracted.replace(/\[QUIZ_MC:\s*[^\]]+\]/gi, '').replace(/\[QUIZ_FIB:\s*[^\]]+\]/gi, '').replace(/\[QUIZ_TF:\s*[^\]]+\]/gi, '');
            extracted = extracted.replace(/\[QUESTION:\s*[^\]]+\]/gi, '').replace(/\[ANSWER:\s*[^\]]+\]/gi, '');
            extracted = extracted.replace(/##\s*🎮\s*Test\s+Your\s+Understanding[^\n]*/gi, '').replace(/\n{3,}/g, '\n\n');
            return extracted.trim();
        }
        function updateLearningSectionInContent(contentText, newLearning) {
            var startMarker = '<!-- LEARNING_START -->';
            var endMarker = '<!-- LEARNING_END -->';
            var startIndex = contentText.indexOf(startMarker);
            var endIndex = contentText.indexOf(endMarker);
            if (startIndex !== -1 && endIndex !== -1) {
                var sectionContent = contentText.substring(startIndex, endIndex);
                var headerMatch = sectionContent.match(/#+\s*💡\s*Learning\s+About[^\n]*/i);
                var header = headerMatch ? headerMatch[0].trim() : '## 💡 Learning About';
                var before = contentText.substring(0, startIndex + startMarker.length);
                var after = contentText.substring(endIndex);
                return (before + '\n' + header + '\n\n' + (newLearning || '').trim() + '\n\n' + after).trim();
            }
            return startMarker + '\n## 💡 Learning About\n\n' + (newLearning || '').trim() + '\n' + endMarker;
        }
        return {
            ealLessonEditorMeta: null,
            ealLessonEditorCurrentPartNumber: 1,
            ealLessonEditorMainTab: 'edit',
            ealLessonEditorActiveTab: 'content',
            ealLessonEditorCopyStatus: '',
            ealLessonEditorPreviewDirty: false,
            ealLessonEditorSaveStatus: 'Saved',
            ealLessonEditorSaveStatusType: 'saved',
            ealLessonEditorContentEditMode: false,
            ealLessonEditorLearningSection: '',
            ealLessonEditorLearningHtml: '',
            ealLessonEditorEnhancementPrompt: '',
            ealLessonEditorContentSaving: false,
            ealLessonEditorStatusMessage: '',
            ealLessonEditorStatusType: '',
            ealLessonEditorVocab: [],
            ealLessonEditorVocabSaving: false,
            ealLessonEditorVocabStatus: '',
            ealLessonEditorVocabStatusType: '',
            ealLessonEditorImages: [],
            ealLessonEditorImagesStatus: '',
            ealLessonEditorImagesStatusType: '',
            ealLessonEditorQuizQuestions: [],
            ealLessonEditorQuizSaving: false,
            ealLessonEditorQuizStatus: '',
            ealLessonEditorQuizStatusType: '',
            ealLessonEditorComponents: [],
            ealLessonEditorComponentStatus: '',
            ealLessonEditorComponentStatusType: '',
            ealLessonEditorComponentLoading: false,
            ealLessonEditorComponentSaving: false,
            ealLessonEditorComponentGenerating: false,
            ealLessonEditorTimelineDraft: { title: 'Timeline', orientation: 'horizontal', events: [] },
            ealLessonEditorSorterDraft: { title: 'Sorting activity', instructions: '', categories: [] },
            ealLessonEditorRegenLoading: false,
            ealLessonEditorImageModalOpen: false,
            ealLessonEditorImageModalWord: '',
            ealLessonEditorImageModalReplaceKey: '',
            ealLessonEditorImageModalPrompt: '',
            ealLessonEditorImageModalPreviewUrl: '',
            ealLessonEditorImageModalGenerating: false,
            ealLessonEditorImageModalFile: null,
            ealLessonEditorImageModalStatus: '',
            ealLessonEditorImageModalStatusType: '',
            ealLessonEditorSelectionMenu: null,
            ealLessonEditorAmendingAt: null,
            get ealLessonEditorIsCurriculumOnly() {
                return !!(store && store.currentAction === 'online_lesson');
            },
            get ealLessonEditorDisplayUrl() {
                var url =
                    (store &&
                        store.currentAction === 'online_lesson' &&
                        store.onlineLesson &&
                        store.onlineLesson.lessonUrl) ||
                    (store && store.ealLesson && store.ealLesson.lessonUrl) ||
                    (this.ealLessonEditorMeta && this.ealLessonEditorMeta.lesson_url) ||
                    '';
                if (this.ealLessonEditorMeta && this.ealLessonEditorMeta.is_multipart && this.ealLessonEditorCurrentPartNumber) {
                    return url.split('#')[0] + '#part-' + this.ealLessonEditorCurrentPartNumber;
                }
                return url;
            },
            get ealLessonEditorPreviewUrl() { return this.ealLessonEditorDisplayUrl || 'about:blank'; },
            ealLessonEditorLessonTitle: function() {
                var meta = this.ealLessonEditorMeta || {};
                if (meta.topic) return meta.topic;
                if (meta.lesson_name) return meta.lesson_name;
                return this.ealLessonEditorIsCurriculumOnly ? 'Online curriculum lesson' : 'Interactive lesson';
            },
            ealLessonEditorWorkflowSection: function() {
                if (this.ealLessonEditorMainTab === 'preview') return 'preview';
                if (this.ealLessonEditorActiveTab === 'vocabulary') return 'vocabulary';
                if (this.ealLessonEditorActiveTab === 'images') return 'images';
                if (this.ealLessonEditorActiveTab === 'components') return 'activities';
                return 'lesson';
            },
            ealLessonEditorSetWorkflowSection: function(section) {
                if (section === 'preview') {
                    this.ealLessonEditorMainTab = 'preview';
                    return;
                }
                this.ealLessonEditorMainTab = 'edit';
                if (section === 'vocabulary') this.ealLessonEditorActiveTab = 'vocabulary';
                else if (section === 'images') this.ealLessonEditorActiveTab = 'images';
                else if (section === 'activities') this.ealLessonEditorActiveTab = 'components';
                else this.ealLessonEditorActiveTab = 'content';
            },
            ealLessonEditorWorkflowButtonClass: function(section) {
                var active = this.ealLessonEditorWorkflowSection() === section;
                return active
                    ? 'border-orange-500 bg-orange-50 text-orange-900 shadow-sm dark:bg-orange-950/35 dark:text-orange-200 dark:border-orange-700'
                    : 'border-app-border bg-app-surface text-app-fg hover:bg-app-page';
            },
            ealLessonEditorSetSaveStatus: function(message, type) {
                this.ealLessonEditorSaveStatus = message || 'Saved';
                this.ealLessonEditorSaveStatusType = type || 'saved';
            },
            ealLessonEditorSaveStatusClass: function() {
                if (this.ealLessonEditorSaveStatusType === 'error') return 'border-red-200 bg-red-50 text-red-700 dark:border-red-900 dark:bg-red-950/30 dark:text-red-300';
                if (this.ealLessonEditorSaveStatusType === 'working') return 'border-amber-200 bg-amber-50 text-amber-800 dark:border-amber-900 dark:bg-amber-950/30 dark:text-amber-300';
                if (this.ealLessonEditorSaveStatusType === 'dirty') return 'border-blue-200 bg-blue-50 text-blue-700 dark:border-blue-900 dark:bg-blue-950/30 dark:text-blue-300';
                return 'border-orange-200 bg-orange-50 text-orange-800 dark:border-orange-900 dark:bg-orange-950/30 dark:text-orange-200';
            },
            ealLessonEditorMarkPreviewDirty: function(message) {
                this.ealLessonEditorPreviewDirty = true;
                this.ealLessonEditorSetSaveStatus(message || 'Saved. Preview needs update.', 'dirty');
            },
            ealLessonEditorSelectPart: function(partNumber) {
                if (!partNumber || partNumber === this.ealLessonEditorCurrentPartNumber) return;
                if (this.ealLessonEditorContentEditMode && !confirm('You are editing text. Switch lesson part and discard unsaved text edits?')) return;
                this.ealLessonEditorContentEditMode = false;
                this.ealLessonEditorCurrentPartNumber = partNumber;
                this.ealLessonEditorSetSaveStatus('Loading part...', 'working');
                this.ealLessonEditorLoadPartData();
            },
            init: function() {
                var self = this;
                this.$watch(function() { return getLessonId(); }, function(id) { if (id) self.ealLessonEditorLoadMeta(); });
                if (getLessonId()) this.ealLessonEditorLoadMeta();
            },
            ealLessonEditorLoadMeta: async function() {
                var lid = getLessonId();
                if (!lid) return;
                try {
                    var r = await fetch('/eal_interactive_lesson/meta/' + lid, { credentials: 'include' });
                    var data = await r.json();
                    if (data.success) {
                        this.ealLessonEditorMeta = data;
                        this.ealLessonEditorCurrentPartNumber = (data.parts && data.parts[0] && data.parts[0].part_number) || 1;
                        await this.ealLessonEditorLoadPartData();
                    }
                } catch (e) { console.error(e); }
            },
            ealLessonEditorLoadPartData: async function() {
                var lid = getLessonId();
                if (!lid) return;
                var partNum = this.ealLessonEditorCurrentPartNumber;
                var isMultipart = this.ealLessonEditorMeta && this.ealLessonEditorMeta.is_multipart;
                var url = '/eal_interactive_lesson/get_data/' + lid + (isMultipart ? '/' + partNum : '');
                try {
                    var r = await fetch(url, { credentials: 'include' });
                    var data = await r.json();
                    if (data.success) {
                        window._ealEditorPartData = data;
                        window._ealEditorPartNumber = partNum;
                        setContentText(data.content_text || '');
                        this.ealLessonEditorLearningSection = extractLearningSection(data.content_text || '');
                        this.ealLessonEditorLearningHtml = (typeof marked !== 'undefined' && this.ealLessonEditorLearningSection) ? marked.parse(this.ealLessonEditorLearningSection) : '<p class="text-slate-500 italic">No learning content.</p>';
                        this.ealLessonEditorVocab = (data.vocabulary || []).map(function(v) { return { word: v.word || '', translation: v.translation || '', example_sentence: v.example_sentence || '', pre_teach: !!v.pre_teach }; });
                        this.ealLessonEditorImages = (data.images || []).map(function(i) { return { word: i.word, image_url: i.image_url, image_key: i.image_key || '' }; });
                        var qt = data.quiz_text || '';
                        try {
                            this.ealLessonEditorQuizQuestions = JSON.parse(qt);
                        } catch (e) {
                            this.ealLessonEditorQuizQuestions = [];
                            var mcP = /\[QUIZ_MC:\s*(.+?)\|(.+?)\|(.+?)\|(.+?)\|(.+?)\|(.+?)\]/g;
                            var fibP = /\[QUIZ_FIB:\s*(.+?)\|(.+?)\|(.+?)\]/g;
                            var tfP = /\[QUIZ_TF:\s*(.+?)\|(.+?)\|(.+?)\]/g;
                            var m; while ((m = mcP.exec(qt)) !== null) {
                                this.ealLessonEditorQuizQuestions.push({ type: 'mc', question: m[1].trim(), options: [m[2].trim(), m[3].trim(), m[4].trim(), m[5].trim()], correct: [m[2],m[3],m[4],m[5]].indexOf(m[6].trim()) + 1 });
                            }
                            while ((m = fibP.exec(qt)) !== null) { this.ealLessonEditorQuizQuestions.push({ type: 'fib', question: m[1].trim(), answer: m[2].trim(), hint: (m[3] || '').trim() }); }
                            while ((m = tfP.exec(qt)) !== null) { this.ealLessonEditorQuizQuestions.push({ type: 'tf', question: m[1].trim(), answer: (m[2] || '').toLowerCase() === 'true', explanation: (m[3] || '').trim() }); }
                        }
                        if (this.ealLessonEditorQuizQuestions && this.ealLessonEditorQuizQuestions.length) {
                            this.ealLessonEditorQuizQuestions.forEach(function(q) {
                                if (q.type === 'mc' && (!q.options || !Array.isArray(q.options))) q.options = ['','','',''];
                            });
                        }
                        await this.ealLessonEditorLoadComponents();
                        this.ealLessonEditorPreviewDirty = false;
                        this.ealLessonEditorSetSaveStatus('Saved', 'saved');
                    }
                } catch (e) { console.error(e); }
            },
            ealLessonEditorEnhanceLearning: async function() {
                var prompt = this.ealLessonEditorEnhancementPrompt || '';
                if (!prompt.trim()) { alert('Please enter an enhancement prompt.'); return; }
                var partId = getPartId();
                if (!partId) { this.ealLessonEditorStatusMessage = 'Part not loaded.'; this.ealLessonEditorStatusType = 'error'; return; }
                var current = this.ealLessonEditorLearningSection || extractLearningSection(getContentText());
                if (!current.trim()) { this.ealLessonEditorStatusMessage = 'No learning content to enhance.'; this.ealLessonEditorStatusType = 'error'; return; }
                this.ealLessonEditorContentSaving = true;
                this.ealLessonEditorSetSaveStatus('Improving lesson text...', 'working');
                this.ealLessonEditorStatusMessage = 'Enhancing...';
                this.ealLessonEditorStatusType = '';
                try {
                    var r = await fetch('/eal_interactive_lesson/enhance_learning_section', {
                        method: 'POST', headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ lesson_id: getLessonId(), part_id: partId, enhancement_prompt: prompt, current_learning_content: current })
                    });
                    var data = await r.json();
                    if (data.success && data.enhanced_content) {
                        setContentText(updateLearningSectionInContent(getContentText(), data.enhanced_content));
                        this.ealLessonEditorLearningSection = data.enhanced_content;
                        this.ealLessonEditorLearningHtml = (typeof marked !== 'undefined' ? marked.parse(data.enhanced_content) : data.enhanced_content);
                        this.ealLessonEditorEnhancementPrompt = '';
                        this.ealLessonEditorStatusMessage = 'Content enhanced.'; this.ealLessonEditorStatusType = 'success';
                        this.ealLessonEditorRegenerateHtml();
                    } else { this.ealLessonEditorStatusMessage = data.error || 'Enhance failed.'; this.ealLessonEditorStatusType = 'error'; this.ealLessonEditorSetSaveStatus('Enhance failed.', 'error'); }
                } catch (e) { this.ealLessonEditorStatusMessage = 'Error.'; this.ealLessonEditorStatusType = 'error'; this.ealLessonEditorSetSaveStatus('Enhance failed.', 'error'); }
                this.ealLessonEditorContentSaving = false;
            },
            ealLessonEditorSaveContent: async function() {
                var partId = getPartId();
                if (!partId) return;
                var updated = updateLearningSectionInContent(getContentText(), this.ealLessonEditorLearningSection);
                setContentText(updated);
                this.ealLessonEditorContentSaving = true;
                this.ealLessonEditorSetSaveStatus('Saving lesson text...', 'working');
                try {
                    var r = await fetch('/eal_interactive_lesson/update_content', {
                        method: 'POST', headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ lesson_id: getLessonId(), part_id: partId, content_text: updated })
                    });
                    var data = await r.json();
                    if (data.success) {
                        this.ealLessonEditorContentEditMode = false;
                        this.ealLessonEditorLearningHtml = (typeof marked !== 'undefined' && this.ealLessonEditorLearningSection ? marked.parse(this.ealLessonEditorLearningSection) : '');
                        this.ealLessonEditorStatusMessage = 'Saved.'; this.ealLessonEditorStatusType = 'success';
                        this.ealLessonEditorRegenerateHtml();
                    } else { this.ealLessonEditorStatusMessage = data.detail || data.error || 'Save failed.'; this.ealLessonEditorStatusType = 'error'; this.ealLessonEditorSetSaveStatus('Save failed.', 'error'); }
                } catch (e) { this.ealLessonEditorStatusMessage = 'Error.'; this.ealLessonEditorStatusType = 'error'; this.ealLessonEditorSetSaveStatus('Save failed.', 'error'); }
                this.ealLessonEditorContentSaving = false;
            },
            handleEalLessonMouseUp: function(ev) {
                if (this.ealLessonEditorContentEditMode || this.ealLessonEditorActiveTab !== 'content') return;
                var sel = window.getSelection();
                var text = (sel && sel.toString()) ? sel.toString().trim() : '';
                var container = document.getElementById('canvas-eal-lesson-content');
                if (!text || !container || !container.contains(sel.anchorNode)) {
                    this.ealLessonEditorSelectionMenu = null;
                    return;
                }
                var x = 0, y = 0;
                if (sel.rangeCount) {
                    var rect = sel.getRangeAt(0).getBoundingClientRect();
                    x = rect.left;
                    y = rect.bottom + 4;
                }
                this.ealLessonEditorSelectionMenu = { text: text, x: x, y: y };
            },
            wrapEalSelectionForAmend: function() {
                var container = document.getElementById('canvas-eal-lesson-content');
                if (!container) return;
                var sel = window.getSelection();
                if (!sel || !sel.rangeCount) return;
                var range = sel.getRangeAt(0);
                if (!container.contains(range.startContainer) || range.collapsed) return;
                try {
                    var span = document.createElement('span');
                    span.className = 'lesson-plan-editing-delete';
                    range.surroundContents(span);
                } catch (e) {}
            },
            applyEalSelectionAction: async function(actionLabel) {
                var self = this;
                if (!this.ealLessonEditorSelectionMenu) return;
                var selectedText = this.ealLessonEditorSelectionMenu.text;
                var menuX = this.ealLessonEditorSelectionMenu.x, menuY = this.ealLessonEditorSelectionMenu.y;
                this.ealLessonEditorSelectionMenu = null;
                this.ealLessonEditorAmendingAt = { x: menuX, y: menuY };
                this.ealLessonEditorContentSaving = true;
                this.ealLessonEditorSetSaveStatus('Applying quick edit...', 'working');
                this.ealLessonEditorStatusMessage = 'Amending selection…';
                this.ealLessonEditorStatusType = '';
                var current = this.ealLessonEditorLearningSection || extractLearningSection(getContentText());
                if (!current.trim()) {
                    this.ealLessonEditorContentSaving = false;
                    this.ealLessonEditorAmendingAt = null;
                    return;
                }
                var prompt = 'Change the selected excerpt to ' + actionLabel.toLowerCase() + '. Return only the revised selected excerpt.';
                try {
                    var r = await fetch('/eal_interactive_lesson/enhance_learning_section', {
                        method: 'POST', headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ lesson_id: getLessonId(), part_id: getPartId(), enhancement_prompt: prompt, current_learning_content: current, selected_text: selectedText })
                    });
                    var data = await r.json();
                    if (data.success && data.enhanced_content) {
                        setContentText(updateLearningSectionInContent(getContentText(), data.enhanced_content));
                        self.ealLessonEditorLearningSection = data.enhanced_content;
                        self.ealLessonEditorLearningHtml = (typeof marked !== 'undefined' ? marked.parse(data.enhanced_content) : data.enhanced_content);
                        self.ealLessonEditorStatusMessage = 'Selection updated.'; self.ealLessonEditorStatusType = 'success';
                        self.ealLessonEditorRegenerateHtml();
                    } else {
                        self.ealLessonEditorStatusMessage = data.error || data.detail || 'Enhance failed.'; self.ealLessonEditorStatusType = 'error';
                        self.ealLessonEditorSetSaveStatus('Quick edit failed.', 'error');
                    }
                } catch (e) {
                    self.ealLessonEditorStatusMessage = 'Error.'; self.ealLessonEditorStatusType = 'error';
                    self.ealLessonEditorSetSaveStatus('Quick edit failed.', 'error');
                }
                self.ealLessonEditorContentSaving = false;
                self.ealLessonEditorAmendingAt = null;
            },
            createEalImageFromSelection: async function() {
                var self = this;
                if (!this.ealLessonEditorSelectionMenu) return;
                var selectedText = this.ealLessonEditorSelectionMenu.text;
                this.ealLessonEditorSelectionMenu = null;
                this.ealLessonEditorContentSaving = true;
                this.ealLessonEditorStatusMessage = 'Creating image…';
                var submitUrl = typeof imageCreatorSubmitUrl !== 'undefined' ? imageCreatorSubmitUrl : '/image-creator';
                var resultBaseUrl = typeof imageCreatorResultBaseUrl !== 'undefined' ? imageCreatorResultBaseUrl : '/image-creator/result/';
                var store = Alpine.store('canvas');
                this.ealLessonEditorSetSaveStatus('Creating image...', 'working');
                var formData = new FormData();
                formData.append('prompt', 'Illustration for lesson: ' + selectedText);
                formData.append('style', (store && store.imageCreatorStyle) || 'Photorealistic');
                formData.append('size', (store && store.imageCreatorSize) || '512');
                formData.append('model', (store && store.imageCreatorModel) || 'runware:400@2');
                try {
                    var submitRes = await fetch(submitUrl, { method: 'POST', body: formData, credentials: 'include' });
                    var submitData = await submitRes.json();
                    if (submitRes.status !== 202 || !submitData.task_id) {
                        self.ealLessonEditorContentSaving = false;
                        self.ealLessonEditorStatusMessage = 'Failed to start image creation.'; self.ealLessonEditorStatusType = 'error';
                        self.ealLessonEditorSetSaveStatus('Image creation failed.', 'error');
                        return;
                    }
                    var imageUrl = null;
                    for (var i = 0; i < 60; i++) {
                        await new Promise(function(r) { setTimeout(r, 1500); });
                        var res = await fetch(resultBaseUrl + submitData.task_id, { credentials: 'include' });
                        var data = await res.json();
                        if (data.status === 'SUCCESS' && data.image_url) { imageUrl = data.image_url; break; }
                        if (data.status === 'FAILURE') break;
                    }
                    self.ealLessonEditorContentSaving = false;
                    if (!imageUrl) {
                        self.ealLessonEditorStatusMessage = 'Image creation failed or timed out.'; self.ealLessonEditorStatusType = 'error';
                        self.ealLessonEditorSetSaveStatus('Image creation failed.', 'error');
                        return;
                    }
                    var current = self.ealLessonEditorLearningSection || extractLearningSection(getContentText());
                    var idx = current.indexOf(selectedText);
                    var newLearning = idx >= 0
                        ? current.slice(0, idx + selectedText.length) + '\n\n![' + selectedText.slice(0, 40) + '](' + imageUrl + ')\n\n' + current.slice(idx + selectedText.length)
                        : current + '\n\n![' + selectedText.slice(0, 40) + '](' + imageUrl + ')\n\n';
                    var updated = updateLearningSectionInContent(getContentText(), newLearning);
                    setContentText(updated);
                    self.ealLessonEditorLearningSection = newLearning;
                    self.ealLessonEditorLearningHtml = (typeof marked !== 'undefined' ? marked.parse(newLearning) : newLearning);
                    var partId = getPartId();
                    if (partId) {
                        var r = await fetch('/eal_interactive_lesson/update_content', {
                            method: 'POST', headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({ lesson_id: getLessonId(), part_id: partId, content_text: updated })
                        });
                        var data = await r.json();
                        if (data.success) self.ealLessonEditorRegenerateHtml();
                    }
                    self.ealLessonEditorStatusMessage = 'Image added.'; self.ealLessonEditorStatusType = 'success';
                } catch (e) {
                    self.ealLessonEditorContentSaving = false;
                    self.ealLessonEditorStatusMessage = 'Error.'; self.ealLessonEditorStatusType = 'error';
                    self.ealLessonEditorSetSaveStatus('Image creation failed.', 'error');
                }
            },
            ealLessonEditorAddVocabRow: function() { this.ealLessonEditorVocab.push({ word: '', translation: '', example_sentence: '', pre_teach: false }); },
            ealLessonEditorSaveVocabulary: async function() {
                var partId = getPartId();
                if (!partId) return;
                var vocabulary = this.ealLessonEditorVocab.filter(function(r) { return (r.word || '').trim(); }).map(function(r) {
                    return { word: r.word.trim(), translation: (r.translation || '').trim(), example_sentence: (r.example_sentence || '').trim(), pre_teach: !!r.pre_teach };
                });
                this.ealLessonEditorVocabSaving = true;
                this.ealLessonEditorSetSaveStatus('Saving vocabulary...', 'working');
                try {
                    var r = await fetch('/eal_interactive_lesson/update_vocabulary', {
                        method: 'POST', headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ lesson_id: getLessonId(), part_id: partId, part_number: getPartNumber(), vocabulary: vocabulary })
                    });
                    var data = await r.json();
                    if (data.success) { this.ealLessonEditorVocabStatus = 'Saved.'; this.ealLessonEditorVocabStatusType = 'success'; this.ealLessonEditorRegenerateHtml(); }
                    else { this.ealLessonEditorVocabStatus = data.detail || data.error || 'Save failed.'; this.ealLessonEditorVocabStatusType = 'error'; this.ealLessonEditorSetSaveStatus('Save failed.', 'error'); }
                } catch (e) { this.ealLessonEditorVocabStatus = 'Error.'; this.ealLessonEditorVocabStatusType = 'error'; this.ealLessonEditorSetSaveStatus('Save failed.', 'error'); }
                this.ealLessonEditorVocabSaving = false;
            },
            ealLessonEditorAutoTranslate: async function(row) {
                if (!(row.word || '').trim()) return;
                try {
                    var r = await fetch('/eal_interactive_lesson/auto_translate', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ lesson_id: getLessonId(), word: row.word.trim() }) });
                    var data = await r.json();
                    if (data.success && data.translation) row.translation = data.translation;
                } catch (e) {}
            },
            ealLessonEditorAutoExample: async function(row) {
                if (!(row.word || '').trim()) return;
                try {
                    var r = await fetch('/eal_interactive_lesson/auto_example', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ lesson_id: getLessonId(), part_id: getPartId(), word: row.word.trim(), definition: '' }) });
                    var data = await r.json();
                    if (data.success && data.example) row.example_sentence = data.example;
                } catch (e) {}
            },
            ealLessonEditorExtractVocabulary: async function() {
                var content = this.ealLessonEditorLearningSection || extractLearningSection(getContentText());
                if (!content.trim()) { alert('Add content first.'); return; }
                try {
                    var r = await fetch('/eal_interactive_lesson/extract_vocabulary', {
                        method: 'POST', headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ lesson_id: getLessonId(), part_id: getPartId(), content_text: content })
                    });
                    var data = await r.json();
                    if (data.success && data.vocabulary) {
                        this.ealLessonEditorVocab = data.vocabulary.map(function(v) { return { word: v.word || '', translation: v.translation || '', example_sentence: v.example_sentence || '', pre_teach: !!v.pre_teach }; });
                        this.ealLessonEditorVocabStatus = 'Extracted.'; this.ealLessonEditorVocabStatusType = 'success';
                    } else { this.ealLessonEditorVocabStatus = data.error || 'Extract failed.'; this.ealLessonEditorVocabStatusType = 'error'; }
                } catch (e) { this.ealLessonEditorVocabStatus = 'Error.'; this.ealLessonEditorVocabStatusType = 'error'; }
            },
            ealLessonEditorDeleteImage: async function(word) {
                if (!confirm('Delete image for "' + word + '"?')) return;
                var partId = getPartId();
                if (!partId) return;
                this.ealLessonEditorSetSaveStatus('Deleting image...', 'working');
                try {
                    var r = await fetch('/eal_interactive_lesson/delete_image', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ lesson_id: getLessonId(), part_id: partId, word: word }) });
                    var data = await r.json();
                    if (data.success) { this.ealLessonEditorImages = this.ealLessonEditorImages.filter(function(i) { return i.word !== word; }); this.ealLessonEditorImagesStatus = 'Deleted.'; this.ealLessonEditorImagesStatusType = 'success'; this.ealLessonEditorRegenerateHtml(); }
                    else { this.ealLessonEditorImagesStatus = data.error || 'Delete failed.'; this.ealLessonEditorImagesStatusType = 'error'; this.ealLessonEditorSetSaveStatus('Delete failed.', 'error'); }
                } catch (e) { this.ealLessonEditorImagesStatus = 'Error.'; this.ealLessonEditorImagesStatusType = 'error'; this.ealLessonEditorSetSaveStatus('Delete failed.', 'error'); }
            },
            ealLessonEditorRegenerateHtml: async function() {
                var partId = getPartId();
                if (!partId) return;
                this.ealLessonEditorRegenLoading = true;
                this.ealLessonEditorSetSaveStatus('Updating preview...', 'working');
                try {
                    var r = await fetch('/eal_interactive_lesson/regenerate_html', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ lesson_id: getLessonId(), part_id: partId }) });
                    var data = await r.json();
                    if (data.success && data.task_id) {
                        var self = this;
                        var poll = function() {
                            fetch('/eal_interactive_lesson/regenerate_html_status/' + data.task_id, { credentials: 'include' }).then(function(res) { return res.json(); }).then(function(st) {
                                if (st.state === 'SUCCESS' && st.result) {
                                    if (st.result.status === 'error') { self.ealLessonEditorRegenLoading = false; self.ealLessonEditorSetSaveStatus('Preview update failed.', 'error'); return; }
                                    if (st.result.lesson_url) {
                                        if (store.currentAction === 'online_lesson' && store.onlineLesson)
                                            store.onlineLesson.lessonUrl = st.result.lesson_url;
                                        else if (store.ealLesson) store.ealLesson.lessonUrl = st.result.lesson_url;
                                    }
                                    self.ealLessonEditorRegenLoading = false;
                                    self.ealLessonEditorPreviewDirty = false;
                                    self.ealLessonEditorSetSaveStatus('Saved and preview updated.', 'saved');
                                } else if (st.state === 'FAILURE') { self.ealLessonEditorRegenLoading = false; self.ealLessonEditorSetSaveStatus('Preview update failed.', 'error'); } else { setTimeout(poll, 1000); }
                            });
                        };
                        poll();
                    } else { this.ealLessonEditorRegenLoading = false; this.ealLessonEditorSetSaveStatus('Preview update failed.', 'error'); }
                } catch (e) { this.ealLessonEditorRegenLoading = false; this.ealLessonEditorSetSaveStatus('Preview update failed.', 'error'); }
            },
            ealLessonEditorCopyLink: function() {
                var url = this.ealLessonEditorDisplayUrl;
                if (!url || url === 'about:blank') return;
                var self = this;
                navigator.clipboard.writeText(url).then(function() {
                    self.ealLessonEditorCopyStatus = 'Link copied.';
                    window.setTimeout(function() { self.ealLessonEditorCopyStatus = ''; }, 2500);
                }).catch(function() {
                    self.ealLessonEditorCopyStatus = 'Could not copy link.';
                });
            },
            ealLessonEditorGenerateImage: async function() {
                var word = (this.ealLessonEditorImageModalWord || '').trim();
                var prompt = (this.ealLessonEditorImageModalPrompt || '').trim();
                if (!word || !prompt) { this.ealLessonEditorImageModalStatus = 'Enter word and prompt.'; this.ealLessonEditorImageModalStatusType = 'error'; return; }
                this.ealLessonEditorImageModalGenerating = true;
                this.ealLessonEditorImageModalStatus = '';
                this.ealLessonEditorSetSaveStatus('Generating image...', 'working');
                try {
                    var r = await fetch('/eal_interactive_lesson/generate_image', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ lesson_id: getLessonId(), part_id: getPartId(), word: word, prompt: prompt }) });
                    var data = await r.json();
                    if (data.success && data.image_url) { this.ealLessonEditorImageModalPreviewUrl = data.image_url; this.ealLessonEditorImageModalStatus = 'Generated. Click Use This Image.'; this.ealLessonEditorImageModalStatusType = 'success'; this.ealLessonEditorSetSaveStatus('Image ready to use.', 'dirty'); }
                    else { this.ealLessonEditorImageModalStatus = data.error || 'Generate failed.'; this.ealLessonEditorImageModalStatusType = 'error'; this.ealLessonEditorSetSaveStatus('Image generation failed.', 'error'); }
                } catch (e) { this.ealLessonEditorImageModalStatus = 'Error.'; this.ealLessonEditorImageModalStatusType = 'error'; this.ealLessonEditorSetSaveStatus('Image generation failed.', 'error'); }
                this.ealLessonEditorImageModalGenerating = false;
            },
            ealLessonEditorUseGeneratedImage: async function() {
                var word = (this.ealLessonEditorImageModalWord || '').trim();
                var imageUrl = this.ealLessonEditorImageModalPreviewUrl;
                if (!word || !imageUrl) return;
                var self = this;
                this.ealLessonEditorSetSaveStatus('Saving image...', 'working');
                try {
                    var r = await fetch('/eal_interactive_lesson/save_image', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ lesson_id: getLessonId(), part_id: getPartId(), word: word, image_url: imageUrl }) });
                    var data = await r.json();
                    if (data.success) {
                        var idx = self.ealLessonEditorImages.findIndex(function(i) { return i.word === word; });
                        if (idx >= 0) self.ealLessonEditorImages[idx] = { word: word, image_url: imageUrl, image_key: self.ealLessonEditorImages[idx].image_key || '' };
                        else self.ealLessonEditorImages.push({ word: word, image_url: imageUrl, image_key: '' });
                        self.ealLessonEditorImageModalOpen = false;
                        self.ealLessonEditorImageModalPreviewUrl = ''; self.ealLessonEditorImageModalWord = ''; self.ealLessonEditorImageModalReplaceKey = ''; self.ealLessonEditorImageModalPrompt = '';
                        self.ealLessonEditorImagesStatus = 'Saved.'; self.ealLessonEditorImagesStatusType = 'success';
                        self.ealLessonEditorRegenerateHtml();
                    } else { self.ealLessonEditorImageModalStatus = data.error || 'Save failed.'; self.ealLessonEditorImageModalStatusType = 'error'; self.ealLessonEditorSetSaveStatus('Save failed.', 'error'); }
                } catch (e) { self.ealLessonEditorImageModalStatus = 'Error.'; self.ealLessonEditorImageModalStatusType = 'error'; self.ealLessonEditorSetSaveStatus('Save failed.', 'error'); }
            },
            ealLessonEditorUploadImage: async function() {
                var word = (this.ealLessonEditorImageModalWord || '').trim();
                var file = this.ealLessonEditorImageModalFile;
                if (!word || !file) { this.ealLessonEditorImageModalStatus = 'Enter word and choose file.'; this.ealLessonEditorImageModalStatusType = 'error'; return; }
                var fd = new FormData();
                fd.append('lesson_id', getLessonId());
                fd.append('part_id', getPartId());
                fd.append('word', word);
                fd.append('image', file);
                var self = this;
                this.ealLessonEditorSetSaveStatus('Uploading image...', 'working');
                try {
                    var r = await fetch('/eal_interactive_lesson/upload_image', { method: 'POST', body: fd, credentials: 'include' });
                    var data = await r.json();
                    if (data.success && data.image_url) {
                        var saveRes = await fetch('/eal_interactive_lesson/save_image', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ lesson_id: getLessonId(), part_id: getPartId(), word: word, image_url: data.image_url }) });
                        var saveData = await saveRes.json();
                        if (saveData.success) {
                            self.ealLessonEditorImages.push({ word: word, image_url: data.image_url, image_key: '' });
                            self.ealLessonEditorImageModalOpen = false;
                            self.ealLessonEditorImageModalPreviewUrl = ''; self.ealLessonEditorImageModalWord = ''; self.ealLessonEditorImageModalReplaceKey = ''; self.ealLessonEditorImageModalPrompt = ''; self.ealLessonEditorImageModalFile = null;
                            self.ealLessonEditorImagesStatus = 'Saved.'; self.ealLessonEditorImagesStatusType = 'success';
                            self.ealLessonEditorRegenerateHtml();
                        } else { self.ealLessonEditorImageModalStatus = saveData.error || 'Save failed.'; self.ealLessonEditorImageModalStatusType = 'error'; self.ealLessonEditorSetSaveStatus('Upload failed.', 'error'); }
                    } else { self.ealLessonEditorImageModalStatus = data.error || 'Upload failed.'; self.ealLessonEditorImageModalStatusType = 'error'; self.ealLessonEditorSetSaveStatus('Upload failed.', 'error'); }
                } catch (e) { self.ealLessonEditorImageModalStatus = 'Error.'; self.ealLessonEditorImageModalStatusType = 'error'; self.ealLessonEditorSetSaveStatus('Upload failed.', 'error'); }
            },
            ealLessonEditorGetComponent: function(type) {
                return (this.ealLessonEditorComponents || []).find(function(c) {
                    return c && c.component_type === type;
                }) || null;
            },
            ealLessonEditorNormalizeComponentDrafts: function() {
                var quiz = this.ealLessonEditorGetComponent('quiz');
                var quizPayload = (quiz && quiz.payload) || {};
                this.ealLessonEditorQuizQuestions = Array.isArray(quizPayload.questions) ? quizPayload.questions : [];
                this.ealLessonEditorQuizQuestions.forEach(function(q) {
                    if (q.type === 'mc' && (!q.options || !Array.isArray(q.options))) q.options = ['', '', '', ''];
                });

                var timeline = this.ealLessonEditorGetComponent('timeline');
                var timelinePayload = (timeline && timeline.payload) || {};
                this.ealLessonEditorTimelineDraft = {
                    title: timelinePayload.title || (timeline && timeline.title) || 'Timeline',
                    orientation: timelinePayload.orientation === 'vertical' ? 'vertical' : 'horizontal',
                    events: Array.isArray(timelinePayload.events) ? timelinePayload.events : []
                };

                var sorter = this.ealLessonEditorGetComponent('sorter');
                var sorterPayload = (sorter && sorter.payload) || {};
                this.ealLessonEditorSorterDraft = {
                    title: sorterPayload.title || (sorter && sorter.title) || 'Sorting activity',
                    instructions: sorterPayload.instructions || 'Sort each item into the correct group.',
                    categories: Array.isArray(sorterPayload.categories) ? sorterPayload.categories : []
                };
            },
            ealLessonEditorLoadComponents: async function() {
                var lid = getLessonId();
                var partId = getPartId();
                if (!lid || !partId) return;
                this.ealLessonEditorComponentLoading = true;
                try {
                    var r = await fetch('/eal_interactive_lesson/components/' + encodeURIComponent(lid) + '/' + encodeURIComponent(partId), { credentials: 'include' });
                    var data = await r.json();
                    if (data.success) {
                        this.ealLessonEditorComponents = data.components || [];
                        this.ealLessonEditorNormalizeComponentDrafts();
                    } else {
                        this.ealLessonEditorComponentStatus = data.error || 'Could not load components.';
                        this.ealLessonEditorComponentStatusType = 'error';
                    }
                } catch (e) {
                    this.ealLessonEditorComponentStatus = 'Could not load components.';
                    this.ealLessonEditorComponentStatusType = 'error';
                }
                this.ealLessonEditorComponentLoading = false;
            },
            ealLessonEditorGenerateComponent: async function(type) {
                var content = this.ealLessonEditorLearningSection || extractLearningSection(getContentText());
                if (!content.trim()) { alert('Add content first.'); return; }
                var existing = this.ealLessonEditorGetComponent(type);
                if (existing && !confirm('Replace the existing ' + type + ' component for this stage?')) return;
                this.ealLessonEditorComponentGenerating = true;
                this.ealLessonEditorComponentStatus = 'Generating ' + type + '...';
                this.ealLessonEditorComponentStatusType = '';
                try {
                    var r = await fetch('/eal_interactive_lesson/components/generate', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ lesson_id: getLessonId(), part_id: getPartId(), component_type: type, content_text: content })
                    });
                    var data = await r.json();
                    if (!data.success || !data.payload) {
                        this.ealLessonEditorComponentStatus = data.error || data.detail || 'Generate failed.';
                        this.ealLessonEditorComponentStatusType = 'error';
                        return;
                    }
                    if (type === 'timeline') {
                        data.payload.orientation = this.ealLessonEditorTimelineDraft.orientation === 'vertical' ? 'vertical' : 'horizontal';
                    }
                    await this.ealLessonEditorSaveComponent(type, data.payload, data.title || '', existing && existing.id);
                    this.ealLessonEditorActiveTab = 'components';
                } catch (e) {
                    this.ealLessonEditorComponentStatus = 'Generate failed.';
                    this.ealLessonEditorComponentStatusType = 'error';
                } finally {
                    this.ealLessonEditorComponentGenerating = false;
                }
            },
            ealLessonEditorSaveComponent: async function(type, payloadOverride, titleOverride, componentIdOverride) {
                var existing = this.ealLessonEditorGetComponent(type);
                var payload = payloadOverride;
                var title = titleOverride || '';
                if (!payload) {
                    if (type === 'quiz') {
                        payload = { questions: this.ealLessonEditorCollectQuizQuestions() };
                        title = title || 'Quiz';
                    } else if (type === 'timeline') {
                        payload = this.ealLessonEditorTimelineDraft;
                        title = title || payload.title || 'Timeline';
                    } else if (type === 'sorter') {
                        payload = this.ealLessonEditorSorterDraft;
                        title = title || payload.title || 'Sorting activity';
                    }
                }
                this.ealLessonEditorComponentSaving = true;
                this.ealLessonEditorSetSaveStatus('Saving activity...', 'working');
                try {
                    var r = await fetch('/eal_interactive_lesson/components/save', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                            lesson_id: getLessonId(),
                            part_id: getPartId(),
                            component_id: componentIdOverride || (existing && existing.id) || null,
                            component_type: type,
                            title: title,
                            payload: payload || {},
                            sort_order: existing ? (existing.sort_order || 0) : this.ealLessonEditorComponents.length
                        })
                    });
                    var data = await r.json();
                    if (data.success) {
                        this.ealLessonEditorComponentStatus = 'Component saved.';
                        this.ealLessonEditorComponentStatusType = 'success';
                        await this.ealLessonEditorLoadComponents();
                        this.ealLessonEditorRegenerateHtml();
                    } else {
                        this.ealLessonEditorComponentStatus = data.detail || data.error || 'Save failed.';
                        this.ealLessonEditorComponentStatusType = 'error';
                        this.ealLessonEditorSetSaveStatus('Save failed.', 'error');
                    }
                } catch (e) {
                    this.ealLessonEditorComponentStatus = 'Save failed.';
                    this.ealLessonEditorComponentStatusType = 'error';
                    this.ealLessonEditorSetSaveStatus('Save failed.', 'error');
                }
                this.ealLessonEditorComponentSaving = false;
            },
            ealLessonEditorDeleteComponent: async function(type) {
                var existing = this.ealLessonEditorGetComponent(type);
                if (!existing || !existing.id) return;
                if (!confirm('Remove this ' + type + ' component from this stage?')) return;
                this.ealLessonEditorSetSaveStatus('Removing activity...', 'working');
                try {
                    var r = await fetch('/eal_interactive_lesson/components/' + encodeURIComponent(getLessonId()) + '/' + encodeURIComponent(existing.id), {
                        method: 'DELETE',
                        credentials: 'include'
                    });
                    var data = await r.json();
                    if (data.success) {
                        await this.ealLessonEditorLoadComponents();
                        this.ealLessonEditorComponentStatus = 'Component removed.';
                        this.ealLessonEditorComponentStatusType = 'success';
                        this.ealLessonEditorRegenerateHtml();
                    } else {
                        this.ealLessonEditorComponentStatus = data.error || 'Remove failed.';
                        this.ealLessonEditorComponentStatusType = 'error';
                        this.ealLessonEditorSetSaveStatus('Remove failed.', 'error');
                    }
                } catch (e) {
                    this.ealLessonEditorComponentStatus = 'Remove failed.';
                    this.ealLessonEditorComponentStatusType = 'error';
                    this.ealLessonEditorSetSaveStatus('Remove failed.', 'error');
                }
            },
            ealLessonEditorCollectQuizQuestions: function() {
                var questions = [];
                this.ealLessonEditorQuizQuestions.forEach(function(q) {
                    if (!(q.question || '').trim()) return;
                    if (q.type === 'mc') {
                        var opts = (q.options || []).slice(0, 4).filter(function(o) { return (o || '').trim(); });
                        if (opts.length >= 2) questions.push({ type: 'mc', question: q.question.trim(), options: opts.length >= 4 ? opts : opts.concat(['','','',''].slice(0, 4 - opts.length)), correct: Math.max(1, Math.min(q.correct || 1, opts.length)) });
                    } else if (q.type === 'fib') questions.push({ type: 'fib', question: q.question.trim(), answer: (q.answer || '').trim(), hint: (q.hint || '').trim() });
                    else if (q.type === 'tf') questions.push({ type: 'tf', question: q.question.trim(), answer: !!q.answer, explanation: (q.explanation || '').trim() });
                });
                return questions;
            },
            ealLessonEditorAddTimelineEvent: function() {
                if (!this.ealLessonEditorTimelineDraft.events) this.ealLessonEditorTimelineDraft.events = [];
                this.ealLessonEditorTimelineDraft.events.push({ date: '', label: '', description: '' });
            },
            ealLessonEditorAddSorterCategory: function() {
                if (!this.ealLessonEditorSorterDraft.categories) this.ealLessonEditorSorterDraft.categories = [];
                this.ealLessonEditorSorterDraft.categories.push({ name: '', items: [''] });
            },
            ealLessonEditorAddSorterItem: function(category) {
                if (!category.items) category.items = [];
                category.items.push('');
            },
            ealLessonEditorAddQuizQuestion: function() {
                var q = { type: 'mc', question: '', options: ['','','',''], correct: 1 };
                this.ealLessonEditorQuizQuestions.push(q);
            },
            ealLessonEditorSaveQuiz: async function() {
                this.ealLessonEditorQuizSaving = true;
                await this.ealLessonEditorSaveComponent('quiz');
                this.ealLessonEditorQuizStatus = this.ealLessonEditorComponentStatus;
                this.ealLessonEditorQuizStatusType = this.ealLessonEditorComponentStatusType;
                this.ealLessonEditorQuizSaving = false;
            },
            ealLessonEditorGenerateQuiz: async function() {
                await this.ealLessonEditorGenerateComponent('quiz');
                this.ealLessonEditorQuizStatus = this.ealLessonEditorComponentStatus;
                this.ealLessonEditorQuizStatusType = this.ealLessonEditorComponentStatusType;
            }
        };
    }
    Alpine.data('ealLessonEditor', ealLessonEditor);

    const CANVAS_DRAFT_KEY = 'canvas_lesson_plan_draft_id';
    const CANVAS_RECENT_CHATS_KEY = 'canvas_recent_dashboard_chats_v1';
    const MAX_RECENT_CHATS = 5;
    const ONENOTE_LEARN_URL = 'https://learn.microsoft.com/en-us/training/paths/onenote-teacher-academy/';
    function lessonPlanTipToMessage(text) {
        if (text.indexOf(ONENOTE_LEARN_URL) === -1) return { role: 'assistant', content: text };
        var div = document.createElement('div');
        div.textContent = text;
        var escaped = div.innerHTML;
        var link = '<a href="' + ONENOTE_LEARN_URL + '" target="_blank" rel="noopener noreferrer" class="text-indigo-600 hover:text-indigo-800 underline">' + ONENOTE_LEARN_URL + '</a>';
        return { role: 'assistant', content: text, contentHtml: escaped.replace(ONENOTE_LEARN_URL, link) };
    }
    function fetchLessonPlanWelcomeTips(store) {
        if (!store || !store.lessonPlanMessages) return;
        const fallbackTips = [
            "Highlight text in the lesson plan to make AI adjustments like simplifying text or expanding the topic.",
            "You can choose the Manual edit link at the top to make changes, but honestly, just export it to Word or, even better, OneNote and make manual changes to text and images there.",
            "For the best formatting and note management, we recommend exporting to OneNote (use the export option at the bottom of the lesson plan). To learn more about OneNote, visit: https://learn.microsoft.com/en-us/training/paths/onenote-teacher-academy/",
            "Export options (Word, PDF, OneNote, etc.) are at the bottom of the lesson plan."
        ];
        function addTipsInSequence(tips) {
            var list = tips.map(function(t) { var text = typeof t === 'string' ? t : (t && (t.content || t.text || '')); return lessonPlanTipToMessage(text); });
            var i = 0;
            function next() {
                if (i >= list.length) return;
                var msgObj = list[i];
                i++;
                var fn = store.pushLessonPlanAssistantMessageWithTypingRef;
                if (typeof fn === 'function') {
                    fn(msgObj.content, next, msgObj.contentHtml);
                } else {
                    store.lessonPlanMessages.push(msgObj);
                    next();
                }
            }
            next();
        }
        fetch(lessonPlanWelcomeTipsUrl, { credentials: 'include' })
            .then(function(r) { return r.ok ? r.json() : null; })
            .then(function(data) {
                var messages = (data && data.messages && Array.isArray(data.messages) && data.messages.length) ? data.messages : fallbackTips;
                addTipsInSequence(messages);
            })
            .catch(function() {
                addTipsInSequence(fallbackTips);
            });
    }
    
    function persistLessonPlanDraft(draftId) {
        if (!draftId) return;
        try { localStorage.setItem(CANVAS_DRAFT_KEY, draftId); } catch (e) {}
        const url = new URL(window.location.href);
        url.searchParams.set('draft_id', draftId);
        window.history.replaceState(null, '', url.toString());
    }
    function clearPersistedLessonPlanDraft() {
        try { localStorage.removeItem(CANVAS_DRAFT_KEY); } catch (e) {}
        const url = new URL(window.location.href);
        url.searchParams.delete('draft_id');
        window.history.replaceState(null, '', url.toString());
    }

    function readRecentChatsFromStorage() { return []; }

    function writeRecentChatsToStorage() {}

    function buildRecentChatSnapshot(messages, aiPersonaId) {
        var safeMessages = (messages || []).map(function(m) {
            return {
                role: m.role || 'assistant',
                content: m.content || '',
                contentHtml: m.contentHtml || null
            };
        });
        var firstUser = safeMessages.find(function(m) { return m.role === 'user' && (m.content || '').trim(); });
        var title = firstUser ? firstUser.content.trim() : ((safeMessages[0] && safeMessages[0].content) ? safeMessages[0].content.trim() : 'Untitled chat');
        if (title.length > 60) title = title.slice(0, 57) + '...';
        return {
            id: String(Date.now()) + '_' + Math.random().toString(36).slice(2, 8),
            title: title,
            messageCount: safeMessages.length,
            savedAt: new Date().toISOString(),
            signature: chatSignatureFromMessages(safeMessages),
            messages: safeMessages,
            aiPersonaId: (aiPersonaId !== null && aiPersonaId !== undefined && aiPersonaId !== '') ? String(aiPersonaId) : ''
        };
    }

    function chatSignatureFromMessages(messages) {
        try {
            return JSON.stringify((messages || []).map(function(m) {
                return { role: m.role || '', content: m.content || '' };
            }));
        } catch (e) {
            return '';
        }
    }

    var canvasStateSaveTimeout = null;
    function clearDashboardChatHistory() {
        var s = typeof Alpine !== 'undefined' && Alpine.store && Alpine.store('canvas');
        if (!s) return;
        s.messages = [];
        s.initialChatStarted = false;
        s.initialChatDone = false;
        s.chatPromptEngaged = false;
        s.initialChatPart1 = '';
        s.initialChatPart2 = '';
        s.initialChatShowRegGroups = false;
        window.dispatchEvent(new CustomEvent('canvas-run-greeting'));
        if (!s.canvasChatId || typeof canvasStateClearUrl === 'undefined') return;
        var putUrl = canvasStatePutUrlSafe;
        safeWriteFetch(canvasStateClearUrlSafe, { method: 'POST', headers: { 'Content-Type': 'application/json' }, credentials: 'include', body: JSON.stringify({ canvas_chat_id: s.canvasChatId }) }, 'canvasStateClear')
            .then(function(res) {
                if (!res.ok) {
                    s.errorMsg = 'Cleared here; syncing to server…';
                    setTimeout(function() { s.errorMsg = ''; }, 4000);
                }
                var chatContext = buildCanvasStatePayload(s);
                chatContext.chat_history = [];
                if (!putUrl) return Promise.resolve();
                return safeWriteFetch(putUrl, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, credentials: 'include', body: JSON.stringify({ canvas_chat_id: s.canvasChatId, chat_context: chatContext }) }, 'canvasStatePutAfterClear');
            })
            .then(function() { if (s && s.errorMsg) s.errorMsg = ''; })
            .catch(function() {
                s.errorMsg = 'Cleared here; could not sync to server.';
                setTimeout(function() { if (s) s.errorMsg = ''; }, 4000);
            });
    }
    window.clearDashboardChatHistory = clearDashboardChatHistory;
    function scheduleSaveCanvasState() {
        var store = typeof Alpine !== 'undefined' && Alpine.store && Alpine.store('canvas');
        var cid = (store && store.canvasChatId) || initialCanvasChatId;
        if (!cid) return;
        if (canvasStateSaveTimeout) clearTimeout(canvasStateSaveTimeout);
        canvasStateSaveTimeout = setTimeout(function() {
            canvasStateSaveTimeout = null;
            var s = Alpine.store('canvas');
            if (!s || !s.canvasChatId) return;
            var chatContext = buildCanvasStatePayload(s);
            var threadPutBase = canvasThreadsPutBaseUrlSafe;
            var threadPutUrl = threadPutBase + encodeURIComponent(String(s.canvasChatId));
            safeWriteFetch(threadPutUrl, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include',
                body: JSON.stringify({ chat_context: chatContext })
            }, 'canvasThreadPut').catch(function() {
                var putUrl = canvasStatePutUrlSafe;
                if (!putUrl) return;
                safeWriteFetch(putUrl, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, credentials: 'include', body: JSON.stringify({ canvas_chat_id: s.canvasChatId, chat_context: chatContext }) }, 'canvasStatePutFallback').catch(function() {});
            });
            if (typeof syncCanvasUrlParams === 'function') syncCanvasUrlParams(s);
        }, 600);
    }

    function swmEscapeHtml(str) {
        if (str == null || str === '') return '';
        var d = document.createElement('div');
        d.textContent = String(str);
        return d.innerHTML;
    }
    function swmLinkifyEscaped(escaped) {
        return String(escaped).replace(/(https?:\/\/[^\s<]+)/g, function(m) {
            return '<a href="' + m + '" target="_blank" rel="noopener noreferrer" class="text-blue-600 underline">' + m + '</a>';
        });
    }
    window.swmStopPolling = function(store) {
        var swm = store && store.studentWorkMarking;
        if (!swm) return;
        if (swm.schemePollTimer) { clearInterval(swm.schemePollTimer); swm.schemePollTimer = null; }
        if (swm.studentPollTimer) { clearInterval(swm.studentPollTimer); swm.studentPollTimer = null; }
    };
    window.swmSchedulePolling = function(store) {
        window.swmStopPolling(store);
        var swm = store && store.studentWorkMarking;
        if (!swm || !swm.data) return;
        var d = swm.data;
        var scheme = d.selected_scheme;
        var grp = swm.showGroup || d.selected_group;
        var maxAttempts = 60;
        if (scheme && scheme.id && !scheme.sharepoint_list_ready) {
            swm.spSetupError = '';
            var attempts = 0;
            swm.schemePollTimer = setInterval(function() {
                attempts += 1;
                if (attempts > maxAttempts) {
                    clearInterval(swm.schemePollTimer);
                    swm.schemePollTimer = null;
                    swm.spSetupError = 'SharePoint list setup timed out. Please refresh the page.';
                    return;
                }
                fetch('/scheme_status/' + encodeURIComponent(String(scheme.id)), { credentials: 'include' })
                    .then(function(r) { return r.json(); })
                    .then(function(st) {
                        if (st && st.sharepoint_list_ready && store.refreshStudentWorkMarkingContext) {
                            clearInterval(swm.schemePollTimer);
                            swm.schemePollTimer = null;
                            swm.spSetupError = '';
                            store.refreshStudentWorkMarkingContext();
                        } else if (st && st.error) {
                            clearInterval(swm.schemePollTimer);
                            swm.schemePollTimer = null;
                            swm.spSetupError = st.error;
                        }
                    })
                    .catch(function() {});
            }, 5000);
        }
        var syncingGroups = (d.group_sync_status && scheme && scheme.id)
            ? Object.keys(d.group_sync_status).filter(function(g) { return d.group_sync_status[g]; })
            : [];
        if (syncingGroups.length > 0) {
            if (!swm.groupSyncErrors) swm.groupSyncErrors = {};
            syncingGroups.forEach(function(g) { if (!swm.groupSyncErrors[g]) swm.groupSyncErrors[g] = ''; });
            var remaining = syncingGroups.slice();
            var attempts2 = 0;
            swm.studentPollTimer = setInterval(function() {
                attempts2 += 1;
                if (attempts2 > maxAttempts) {
                    clearInterval(swm.studentPollTimer);
                    swm.studentPollTimer = null;
                    remaining.forEach(function(g) {
                        swm.groupSyncErrors[g] = 'Student sync timed out. Please refresh.';
                    });
                    return;
                }
                remaining.slice().forEach(function(g) {
                    fetch('/student_sync_status/' + encodeURIComponent(String(scheme.id)) + '/' + encodeURIComponent(String(g)), { credentials: 'include' })
                        .then(function(r) { return r.json(); })
                        .then(function(st) {
                            if (st && st.syncing_students === false) {
                                swm.groupSyncErrors[g] = '';
                                remaining = remaining.filter(function(x) { return x !== g; });
                                if (remaining.length === 0 && store.refreshStudentWorkMarkingContext) {
                                    clearInterval(swm.studentPollTimer);
                                    swm.studentPollTimer = null;
                                    store.refreshStudentWorkMarkingContext();
                                }
                            }
                        })
                        .catch(function() {});
                });
            }, 5000);
        }
    };

    /**
     * Fix LLM output like "📅 ## Monday: …" so ## starts the line and marked emits <h2>.
     * Leaves lines unchanged if non-emoji text appears before ##.
     */
    function normalizeSenPlanningWeekHeadings(raw) {
        if (!raw || typeof raw !== 'string') return raw || '';
        var lineRe = /^(\s*)([\s\S]*?)(##\s+(Monday|Tuesday|Wednesday|Thursday|Friday)\b.*)$/i;
        var onlyEmojiOrWhitespace = /^[\s\p{Extended_Pictographic}\uFE0F\u200D]+$/u;
        return raw.split('\n').map(function(line) {
            var m = line.match(lineRe);
            if (!m) return line;
            var indent = m[1];
            var beforeHash = m[2];
            var heading = m[3];
            var trimmedBefore = beforeHash.trim();
            if (trimmedBefore === '' || onlyEmojiOrWhitespace.test(trimmedBefore)) {
                // Marked/CommonMark require `##` at (or near) the start of the line.
                // If the original line is indented (e.g. inside a list/blockquote), preserving
                // indentation can prevent it from becoming an <h2>.
                return heading;
            }
            return line;
        }).join('\n');
    }

    Alpine.store('canvas', {
        leftExpanded: false,
        rightOpen: false,
        chatOnRight: false,
        /** User's first name for greeting */
        userFirstname: userFirstname,
        /** Registration groups associated with the current user (from Entra) */
        userRegistrationGroups: userRegistrationGroupsList,
        /** Greeting role: teacher | admin | slt | other (from job titles) */
        greetingRole: userGreetingRole,
        schoolGoogleAiEnabled: schoolGoogleAiEnabled,
        /** Which reg group has actions expanded (group name or null) */
        expandedRegGroup: null,
        /** Greeting typewriter: displayed portion and whether typing is done */
        greetingTyped: '',
        greetingComplete: false,
        /** Initial chat block (AI types reg groups prompt into chat) */
        initialChatPart1: '',
        initialChatShowRegGroups: false,
        initialChatPart2: '',
        initialChatPart2Done: false,
        initialChatDone: false,
        initialChatStarted: false,
        /** When false and no messages, chat prompt is centered with welcome; becomes true on focus so prompt moves to bottom */
        chatPromptEngaged: false,
        /** When user selects a reg group from the chat, show action buttons; value is group name or null */
        selectedRegGroupFromChat: null,
        /** Pending "Confirm lesson plan for class X?" – set when user types "lesson plan Apollo" and Apollo is a reg group; cleared on Yes/No */
        pendingLessonPlanConfirmRegGroup: null,
        /** Typing effect for confirm message: displayed text and whether typing is done */
        confirmMessageTyped: '',
        confirmMessageComplete: false,
        /** When starting lesson plan via "lesson plan Apollo" and Apollo is not a class, use this as default topic (e.g. "Apollo") */
        lessonPlanTopicFromChat: '',
        /** Lesson plan: only agents from system_messages (chat_function = 'agent') are listed for subject choice */
        aiAgentsList: aiAgentsList,
        aiModelsList: aiModelsList,
        registrationGroups: registrationGroupsList,
        /** Boot lists for lesson plan wizard (subjects table + NC Years + keystage) */
        canvasNcYearsList: ncYearsList,
        canvasYearsList: yearsList,
        canvasSubjectsList: subjectsList,
        showLessonPlanRegGroupChoice: false,
        filterRegistrationGroup: '',
        filterYear: '',
        filterSEN: 'all',
        filterEAL: 'all',
        filterStudentId: '',
        students: [],
        studentsLoading: false,
        studentsError: '',
        currentAction: null,
        isAlertOnlySchool: isAlertOnlySchoolBoot,
        isNavActionAllowed(action) {
            return !this.isAlertOnlySchool || action === 'alert_system';
        },
        /** 'class' | 'admin' | null — drives dark-mode chrome link colors in canvas workspace */
        canvasChromeLinkTone: null,
        actionContext: { targetLabel: '', targetType: '' },
        messages: [],
        recentChats: [],
        personaSwitchRequestId: 0,
        personaSwitchPending: false,
        /** Lesson-plan panel only; not persisted; cleared when returning to dashboard */
        lessonPlanMessages: [],
        inputText: '',
        composerFilesMenuOpen: false,
        composerToolsMenuOpen: false,
        notebookTreeOpen: false,
        notebookTreeTarget: 'chat',
        notebookTreeLoading: false,
        notebookTreeError: '',
        notebookTreeData: [],
        notebookTreeExpanded: {},
        notebookDocTitleById: {},
        sessionUploadFiles: [],
        sessionNotebookSelections: [],
        tempFileUploadBusy: false,
        loading: false,
        errorMsg: '',
        aiModel: defaultModel,
        aiPersonaId: null,
        /** Used to avoid re-announcing persona when re-selecting the same one */
        lastAnnouncedPersonaId: null,
        personaPrompt: '',
        activePersonaTheme: Object.assign({}, DEFAULT_WORKSPACE_THEME),
        activePersonaThemeKey: 'atomas',
        lessonPlan: initialLessonPlan(),
        lessonPlanExport: initialLessonPlanExport(),
        /** When user selects text in the lesson plan: { text, x, y } for the action menu; null when hidden */
        lessonPlanSelectionMenu: null,
        /** When user clicks an image in generated lesson preview: { url, x, y } for delete prompt */
        lessonPlanImageDeleteMenu: null,
        lessonPlanManualEditMode: false,
        /** Canvas chat id for persistence (from dashboard start or session); empty if none */
        canvasChatId: initialCanvasChatId || '',
        /** Set true briefly when content is replaced after selection amend (for fade-in) */
        lessonPlanJustUpdated: false,
        /** When amending selection: { x, y } to show banner near selection; null when not amending */
        lessonPlanAmendingAt: null,
        chatScrollAtBottom: true,
        dashboardChatScrollAtBottom: true,
        /** True when entering lesson plan so right panel animates from center; cleared after transition */
        chatPanelEntering: false,
        /** Allow right column overflow during chat slide-in so panel is visible while moving */
        chatPanelOverflowVisible: false,
        /** Dashboard chat mode: null (default), 'one_to_one' (show persona box), 'persona_rag' (notebook docs by agent categories) */
        dashboardChatMode: null,
        /** When true, the collapsible row below the header shows AI model/persona/subject dropdowns */
        showAiModelInfo: false,
        personasList: personasListFromServer,
        quiz: null,  /* set to initialQuiz() when setAction('quiz') */
        ealLesson: null,  /* set to initialEalLesson() when setAction('eal_lesson') */
        onlineLesson: null,  /* set to initialOnlineLesson() when setAction('online_lesson') */
        teacherSlideLesson: null,  /* set to initial state when setAction('lesson_slide_creator') */
        /** When true, EAL right panel is slid away and lesson editor uses full width (columns 2+3) */
        /** Interval id for EAL creation step rotation; cleared on SUCCESS/FAILURE */
        ealLessonCreationStepTimer: null,
        /** Same for online curriculum lesson wizard */
        onlineLessonCreationStepTimer: null,
        image: null,
        /** Image creator (canvas): prompt, options, loading, result */
        imageCreatorPrompt: '',
        imageCreatorStyle: 'Photorealistic',
        imageCreatorSize: '512',
        imageCreatorModel: 'runware:400@2',
        lessonPlanImageStyle: 'childrens_storybook',
        imageCreatorLoading: false,
        imageCreatorEnhancing: false,
        imageCreatorResult: null,
        imageCreatorTaskId: null,
        /** True when Create Images was opened from the general chat, so the user can return with the picture. */
        imageCreatorFromChat: false,
        /** Email canvas: null | 'draft_responses' | 'manage_todays' | 'priority_emails' | 'draft_chat' */
        emailSubMode: null,
        /** Right rail: which email tool row has its description expanded (null | same string as emailSubMode keys) */
        emailToolDetailOpen: null,
        email: null,
        /** SEN Planning canvas: pupils list, selection, step (form | activity_list), chatId, messages, contentMarkdown, selectionMenu, amendingAt */
        senPlanning: {
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
            loading: false,
            error: ''
        },
        studentPasswords: {
            students: [],
            registrationGroups: [],
            selectedGroup: '',
            senListExists: false,
            ealListExists: false,
            directoryType: '',
            apiSource: '',
            loading: false,
            error: '',
            searchQuery: '',
            searchActive: false,
            accountInfoOpen: false,
            senModalStudent: null,
            ealModalStudent: null,
            emailTaskId: null,
            emailStatus: ''
        },
        staffManagement: {
            staffAccounts: [],
            trustUsers: [],
            jobTitleOptions: [],
            registrationGroups: [],
            subjectAreas: [],
            pendingRequests: [],
            userDomain: '',
            isTrustAdmin: false,
            trust: {},
            credentialsError: false,
            loading: false,
            error: '',
            activeTab: 'school',
            viewMode: 'list',
            searchQuery: '',
            trustSort: 'school-email',
            trustPage: 1,
            trustPageSize: 20,
            detailsModalStaffId: null,
            requestUserModalOpen: false,
            activeSubView: 'staff',
            bulkTaskId: null,
            bulkTaskStatus: '',
            bulkTaskSuccessCount: 0,
            bulkTaskErrorCount: 0,
            bulkTaskCurrent: 0,
            bulkTaskTotal: 0
        },
        sen: null,
        eal: null,
        admin: null,
        notebook: null,
        studentWorkMarking: null,
        isNotebookCanvasAction: false,
        isReactCanvasAction: false,
        notebookActiveSection: null,
        isSodCanvasAction: false,
        sodDataEntryParams: null,
        sodVizSeasonId: null,
        /** Any lesson plan session: hide left sidebar, top nav bar, full-width edge-to-edge split (chat | preview). */
        lessonPlanPreviewFullscreen() {
            return this.currentAction === 'lesson_plan';
        },
        /** Quiz builder + editor: same full-width centre column as lesson plan. */
        quizCanvasFullscreen() {
            return this.currentAction === 'quiz';
        },
        /** School alerts: hide the tools sidebar and use the full workspace width. */
        alertCanvasFullscreen() {
            return this.currentAction === 'alert_system';
        },
        /** Title for the active tool (center shell bar and right rail). */
        currentToolTitle() {
            const a = this.currentAction;
            if (a === 'inventory') return 'Inventory';
            if (a === 'teams_meetings') return 'Teams Meetings';
            if (a === 'it_backup') return 'Backup status';
            if (a === 'it_cyber') return 'Cyber status';
            if (a === 'it_filtering') return 'Filtering and monitoring';
            if (a === 'it_compliance') return 'IT Compliance';
            if (a === 'alert_system') return 'School alerts';
            if (a === 'email') return 'Email';
            if (a === 'sen_planning') return 'SEN Planning';
            if (a === 'student_passwords') return 'Student Details';
            if (a === 'staff_management') return 'Staff Account Management';
            if (a === 'system_admin') return 'System administration';
            if (a === 'classroom_teams') return 'Teams Classrooms';
            if (a === 'student_work_marking') return 'Schoolwork Marker';
            if (a === 'image_creator') return 'Create image';
            if (a === 'quiz') return 'Create quiz';
            if (a === 'eal_lesson') return 'Create interactive EAL lesson';
            if (a === 'online_lesson') return 'Online curriculum lesson';
            if (a === 'lesson_slide_creator') return 'Lesson Slide Creator';
            if (a === 'lesson_plan') return 'Create lesson plan';
            if (a === 'my_lessons') return 'My lessons';
            if (a === 'notebook_admin') return 'Atomas Notebook';
            if (a === 'notebook_curriculum') return 'Notebook — Curriculum';
            if (a === 'notebook_marking_rubrics') return 'Notebook — Marking rubrics';
            if (a === 'notebook_staff') return 'Notebook — Staff documents';
            if (a === 'notebook_app_documents') return 'Notebook — App documents';
            if (a === 'notebook_trust_staff') return 'Notebook — Trust staff';
            if (a === 'notebook_agent_categories') return 'Notebook agent categories';
            if (a === 'persona_themes') return 'Persona themes';
            if (a === 'sharepoint_favourites') return 'SharePoint Favourites';
            if (a === 'sod_home' || a === 'sod_seasons' || a === 'sod_indicators' ||
                a === 'sod_data_entry' || a === 'sod_visualizations') {
                return 'School Overview DB';
            }
            return 'Tool';
        },
        rightChatPanelActionTitle() {
            return this.currentToolTitle();
        },
        openToolSuggestion(action, topic) {
            var hint = String(topic || '').trim();
            if (action === 'atomas_support') {
                this.selectQuickPersona('atomas_support');
                return;
            }
            if (action === 'lesson_plan') {
                this.lessonPlanTopicFromChat = hint;
                this.showLessonPlanRegGroupChoiceFromMenu();
                if (hint && this.lessonPlan && this.lessonPlan.data) {
                    this.lessonPlan.data.lesson_aims = hint;
                }
                return;
            }
            this.setAction(action, hint ? { targetLabel: '', targetType: '', topicHint: hint } : undefined);
            if (action === 'image_creator') this.imageCreatorFromChat = true;
            this.applySuggestionTopic(action, hint);
        },
        editChatImage(msg) {
            var prompt = String((msg && msg.image_prompt) || '').trim();
            var imageUrl = this.safeChatImageUrl(msg && msg.image_url);
            this.setAction('image_creator');
            this.imageCreatorFromChat = true;
            this.imageCreatorUsedPrompt = prompt;
            if (prompt) this.imageCreatorPrompt = prompt;
            if (imageUrl) this.imageCreatorResult = { image_url: imageUrl, prompt: prompt };
        },
        createLessonFromChatImage(msg) {
            var topic = this.lessonTopicFromImagePrompt(msg && msg.image_prompt);
            this.openToolSuggestion('lesson_plan', topic);
        },
        safeChatImageUrl(url) {
            var u = String(url || '').trim();
            if (/^https?:\/\//i.test(u) || u.indexOf('/') === 0) return u;
            return '';
        },
        lessonTopicFromImagePrompt(prompt) {
            var text = String(prompt || '').trim();
            if (!text) return '';
            text = text.replace(/^(?:please\s+)?(?:create|generate|make|draw|show)\s+(?:me\s+)?(?:an?\s+)?(?:image|picture|photo|illustration|drawing)\s+(?:of\s+)?/i, '');
            text = text.replace(/^(?:an?\s+)?(?:photorealistic|realistic|cartoon|illustration|watercolour|watercolor|oil painting|sketch)\s+(?:image\s+)?(?:of\s+)?/i, '');
            text = text.split(/[.\n;]/)[0].split(',')[0].trim();
            text = text.replace(/^(?:the|a|an)\s+/i, '').replace(/[\s.!?]+$/g, '').trim();
            if (text.length > 80) text = text.slice(0, 80).replace(/\s+\S*$/, '').trim();
            if (text.length < 2) return '';
            if (text === text.toLowerCase()) text = text.charAt(0).toUpperCase() + text.slice(1);
            return text;
        },
        chatAlreadyHasImage(url) {
            var target = this.safeChatImageUrl(url);
            if (!target) return false;
            var messages = this.messages || [];
            for (var i = 0; i < messages.length; i++) {
                if (this.safeChatImageUrl(messages[i] && messages[i].image_url) === target) return true;
            }
            return false;
        },
        returnImageCreatorToChat() {
            var imageUrl = this.safeChatImageUrl(this.imageCreatorResult && this.imageCreatorResult.image_url);
            var prompt = String(
                (this.imageCreatorResult && this.imageCreatorResult.prompt) ||
                this.imageCreatorUsedPrompt ||
                this.imageCreatorPrompt ||
                ''
            ).trim();
            this.clearAction();
            if (imageUrl && !this.chatAlreadyHasImage(imageUrl)) {
                this.messages.push({
                    role: 'assistant',
                    content: "Here's the image.",
                    image_url: imageUrl,
                    image_prompt: prompt
                });
                if (typeof scheduleSaveCanvasState === 'function') scheduleSaveCanvasState();
            }
            var self = this;
            requestAnimationFrame(function() {
                if (typeof self.ensureDashboardChatScrolled === 'function') self.ensureDashboardChatScrolled();
            });
        },
        currentSavedWorkLink() {
            var a = this.currentAction;
            function pack(kind, id, title, label) {
                var workId = String(id || '').trim();
                if (!workId) return null;
                var name = String(title || '').trim() || label;
                return { kind: kind, id: workId, title: name.slice(0, 120), label: label };
            }
            if (a === 'lesson_plan' && this.lessonPlan && this.lessonPlan.draftId) {
                var lpTopic = (this.lessonPlan.content && this.lessonPlan.content.topic) ||
                    (this.lessonPlan.data && this.lessonPlan.data.lesson_aims) || '';
                return pack('plan', this.lessonPlan.draftId, lpTopic, 'Lesson plan');
            }
            if (a === 'quiz' && this.quiz && this.quiz.quizId) {
                var qTopic = (this.quiz.data && this.quiz.data.topic) || '';
                return pack('quiz', this.quiz.quizId, qTopic, 'Quiz');
            }
            if (a === 'lesson_slide_creator' && this.teacherSlideLesson && this.teacherSlideLesson.lessonId) {
                var slideTitle = (this.teacherSlideLesson.data && this.teacherSlideLesson.data.title) || '';
                return pack('slides', this.teacherSlideLesson.lessonId, slideTitle, 'Slides');
            }
            if (a === 'eal_lesson' && this.ealLesson && this.ealLesson.lessonId) {
                var ealTopic = (this.ealLesson.data && (this.ealLesson.data.topic || this.ealLesson.data.lesson_name)) || '';
                return pack('eal', this.ealLesson.lessonId, ealTopic, 'EAL lesson');
            }
            if (a === 'online_lesson' && this.onlineLesson && this.onlineLesson.lessonId) {
                var onlineTopic = (this.onlineLesson.data && (this.onlineLesson.data.topic || this.onlineLesson.data.lesson_name)) || '';
                return pack('online', this.onlineLesson.lessonId, onlineTopic, 'Online lesson');
            }
            if (a === 'sen_planning' && this.senPlanning && this.senPlanning.activityId && (this.senPlanning.contentMarkdown || '').trim()) {
                return pack('sen', this.senPlanning.activityId, this.senPlanning.activityTitle || '', 'SEN activity');
            }
            return null;
        },
        persistSenActivity() {
            var s = this.senPlanning;
            if (!s || !(s.contentMarkdown || '').trim()) return Promise.resolve('');
            var self = this;
            return fetch('/api/canvas/sen_activities', {
                method: 'POST',
                credentials: 'include',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    id: s.activityId || '',
                    chat_id: s.chatId || '',
                    title: s.activityTitle || '',
                    markdown: s.contentMarkdown,
                    student_id: (s.selectedStudentId && s.selectedStudentId !== 'saved') ? s.selectedStudentId : '',
                    student_name: s.activityTitle || '',
                    subject: s.activitySubject || ''
                })
            }).then(function(r) { return r.json(); }).then(function(data) {
                if (data && data.id && self.senPlanning) self.senPlanning.activityId = data.id;
                return (data && data.id) || '';
            }).catch(function() { return ''; });
        },
        savedWorkLinkAlreadyLatest(link) {
            var messages = this.messages || [];
            var last = messages.length ? messages[messages.length - 1] : null;
            var prev = last && last.work_link;
            if (!prev || !link) return false;
            if (prev.kind !== link.kind || String(prev.id) !== String(link.id)) return false;
            if (prev.title !== link.title || prev.label !== link.label) {
                last.work_link = link;
                if (typeof scheduleSaveCanvasState === 'function') scheduleSaveCanvasState();
            }
            return true;
        },
        async returnSavedWorkToChat() {
            if (this.currentAction === 'sen_planning') await this.persistSenActivity();
            var link = this.currentSavedWorkLink();
            this.clearAction();
            if (link && !this.savedWorkLinkAlreadyLatest(link)) {
                this.messages.push({
                    role: 'assistant',
                    content: 'Saved. You can carry on with this later.',
                    work_link: link
                });
                if (typeof scheduleSaveCanvasState === 'function') scheduleSaveCanvasState();
            }
            var self = this;
            requestAnimationFrame(function() {
                if (typeof self.ensureDashboardChatScrolled === 'function') self.ensureDashboardChatScrolled();
            });
        },
        openSavedWork(kind, id) {
            var workId = String(id || '').trim();
            var workKind = String(kind || '').trim();
            if (!workId) return;
            if (workKind === 'plan') {
                this.setAction('lesson_plan');
                if (!this.lessonPlan) return;
                this.lessonPlan.draftId = workId;
                this.lessonPlan.wizardActive = false;
                this.lessonPlan.step = 5;
                this.lessonPlan.content = null;
                this.lessonPlan.loading = true;
                if (typeof persistLessonPlanDraft === 'function') persistLessonPlanDraft(workId);
                if (typeof maybeFetchLessonPlanContentAfterRestore === 'function') maybeFetchLessonPlanContentAfterRestore(this);
                return;
            }
            if (workKind === 'quiz') {
                this.setAction('quiz');
                if (!this.quiz) return;
                this.quiz.quizId = workId;
                this.quiz.wizardActive = false;
                this.quiz.loading = false;
                this.quiz.taskId = null;
                this.quiz.questions = null;
                this.quiz.content = null;
                this.quiz.quizPanelExpanded = true;
                if (typeof maybeFetchQuizContentAfterRestore === 'function') maybeFetchQuizContentAfterRestore(this);
                return;
            }
            if (workKind === 'slides') {
                this.setAction('lesson_slide_creator', { lessonId: workId, targetLabel: '', targetType: '' });
                return;
            }
            if (workKind === 'eal' || workKind === 'online') {
                var action = workKind === 'online' ? 'online_lesson' : 'eal_lesson';
                this.setAction(action);
                var bucket = workKind === 'online' ? this.onlineLesson : this.ealLesson;
                if (bucket) {
                    bucket.lessonId = workId;
                    bucket.wizardActive = false;
                    bucket.taskId = null;
                    bucket.creationStatus = '';
                }
                if (typeof syncCanvasUrlParams === 'function') syncCanvasUrlParams(this);
                return;
            }
            if (workKind === 'sen') {
                this.setAction('sen_planning');
                var self = this;
                fetch('/api/canvas/sen_activities/' + encodeURIComponent(workId), { credentials: 'include' })
                    .then(function(r) { return r.ok ? r.json() : null; })
                    .then(function(data) {
                        if (!data || !self.senPlanning) return;
                        self.senPlanning.activityId = data.id;
                        self.senPlanning.chatId = data.chat_id || null;
                        self.senPlanning.contentMarkdown = data.markdown || '';
                        self.senPlanning.activityTitle = data.title || '';
                        self.senPlanning.activitySubject = data.subject || '';
                        self.senPlanning.selectedStudentId = data.student_id || 'saved';
                        self.senPlanning.step = 'activity_list';
                        self.senPlanning.loading = false;
                    })
                    .catch(function() {});
            }
        },
        applySuggestionTopic(action, hint) {
            if (!hint) return;
            if (action === 'lesson_slide_creator' && this.teacherSlideLesson && this.teacherSlideLesson.data) {
                this.teacherSlideLesson.data.title = hint;
                this.teacherSlideLesson.data.lesson_goal = hint;
            }
            if (action === 'online_lesson' && this.onlineLesson && this.onlineLesson.data) {
                this.onlineLesson.data.topic = hint;
                this.onlineLesson.data.lesson_aims = hint;
            }
            if (action === 'eal_lesson' && this.ealLesson && this.ealLesson.data) {
                this.ealLesson.data.topic = hint;
                this.ealLesson.data.lesson_aims = hint;
            }
            if (action === 'quiz' && this.quiz && this.quiz.data) {
                this.quiz.data.topic = hint;
            }
            if (action === 'image_creator') {
                this.imageCreatorPrompt = hint;
            }
        },
        setAction(action, context) {
            if (!this.isNavActionAllowed(action)) return;
            this.imageCreatorFromChat = false;
            if (typeof window.canvasLoadCurriculumLists === 'function') window.canvasLoadCurriculumLists();
            if (action === 'notebook_app_documents' && !isSuperadminBoot) action = 'notebook_admin';
            if (action === 'notebook_trust_staff' && !isTrustNotebookAdminBoot) action = 'notebook_admin';
            this.currentAction = action;
            this.actionContext = context || { targetLabel: '', targetType: '' };
            this.chatOnRight =
                action !== 'inventory' &&
                action !== 'teams_meetings' &&
                action !== 'lesson_plan' &&
                action !== 'quiz' &&
                action !== 'eal_lesson' &&
                action !== 'online_lesson' &&
                action !== 'lesson_slide_creator' &&
                action !== 'my_lessons' &&
                action !== 'notebook_agent_categories' &&
                action !== 'persona_themes' &&
                action !== 'sharepoint_favourites' &&
                action !== 'alert_system';
            this.isNotebookCanvasAction = NOTEBOOK_CANVAS_ACTIONS.indexOf(action) !== -1;
            this.isReactCanvasAction = REACT_CANVAS_ACTIONS.indexOf(action) !== -1;
            this.notebookActiveSection = this.isNotebookCanvasAction ? notebookSectionFromAction(action) : null;
            this.isSodCanvasAction =
                ['sod_home', 'sod_seasons', 'sod_indicators', 'sod_data_entry', 'sod_visualizations'].indexOf(action) !== -1;
            if (this.isSodCanvasAction) {
                if (['sod_home', 'sod_seasons', 'sod_indicators'].indexOf(action) !== -1) {
                    this.sodDataEntryParams = null;
                    this.sodVizSeasonId = null;
                }
                if (action === 'sod_data_entry' && context) {
                    this.sodDataEntryParams = {
                        seasonId: context.seasonId || null,
                        schoolId: context.schoolId || null
                    };
                }
                if (action === 'sod_visualizations') {
                    if (context && context.seasonId !== undefined) {
                        this.sodVizSeasonId =
                            context.seasonId === null || context.seasonId === ''
                                ? null
                                : String(context.seasonId);
                    } else if (!context) {
                        this.sodVizSeasonId = null;
                    }
                }
                setTimeout(function() {
                    if (window.sodLoadFragmentForAction) window.sodLoadFragmentForAction(action);
                }, 0);
            } else {
                this.sodDataEntryParams = null;
                this.sodVizSeasonId = null;
            }
            if (action === 'lesson_plan') {
                var lp = window.CanvasFeatures && window.CanvasFeatures.lesson_plan;
                if (lp && typeof lp.onSetActionLessonPlan === 'function') lp.onSetActionLessonPlan(this);
                else {
                    this.lessonPlan = initialLessonPlan();
                    this.lessonPlanExport = initialLessonPlanExport();
                    if (lp && typeof lp.initLessonPlanWizard === 'function') lp.initLessonPlanWizard(this, this.actionContext);
                }
                if (lessonPlanDefaultAiModelId) {
                    var lpModels = this.aiModelsList || [];
                    for (var lpi = 0; lpi < lpModels.length; lpi++) {
                        if (lpModels[lpi] && lpModels[lpi].id === lessonPlanDefaultAiModelId) {
                            this.aiModel = lessonPlanDefaultAiModelId;
                            break;
                        }
                    }
                }
            }
            if (action === 'quiz') {
                var q = window.CanvasFeatures && window.CanvasFeatures.quiz;
                if (q && typeof q.onSetActionQuiz === 'function') q.onSetActionQuiz(this);
                else {
                    this.quiz = initialQuiz();
                    if (q && typeof q.initQuizWizard === 'function') q.initQuizWizard(this, this.actionContext);
                }
            }
            if (action === 'image_creator') {
                var ic = window.CanvasFeatures && window.CanvasFeatures.image_creator;
                if (ic && typeof ic.onSetActionImageCreator === 'function') ic.onSetActionImageCreator(this, context || {});
                else {
                    this.imageCreatorPrompt = '';
                    this.imageCreatorStyle = 'Photorealistic';
                    this.imageCreatorSize = '512';
                    this.imageCreatorModel = 'runware:400@2';
                    this.imageCreatorLoading = false;
                    this.imageCreatorEnhancing = false;
                    this.imageCreatorResult = null;
                    this.imageCreatorTaskId = null;
                }
            }
            if (action === 'eal_lesson') {
                this.onlineLesson = null;
                if (this.onlineLessonCreationStepTimer) {
                    clearInterval(this.onlineLessonCreationStepTimer);
                    this.onlineLessonCreationStepTimer = null;
                }
                var ealPreferredModelId = ealDefaultAzureModelId || defaultAzureCanvasModelId;
                if (ealPreferredModelId) {
                    var ealModels = this.aiModelsList || [];
                    for (var emi = 0; emi < ealModels.length; emi++) {
                        if (ealModels[emi] && ealModels[emi].id === ealPreferredModelId) {
                            this.aiModel = ealPreferredModelId;
                            break;
                        }
                    }
                }
                var el = window.CanvasFeatures && window.CanvasFeatures.eal_lesson;
                if (el && typeof el.onSetActionEalLesson === 'function') {
                    el.onSetActionEalLesson(
                        this,
                        context || {},
                        { ealStudentsUrl: (typeof ealStudentsUrl !== 'undefined' ? ealStudentsUrl : undefined) }
                    );
                } else {
                    this.ealLesson = initialEalLesson();
                    var self = this;
                    fetch(typeof ealStudentsUrl !== 'undefined' ? ealStudentsUrl : '/eal_interactive_lesson/students', { credentials: 'include' })
                        .then(function(r) { return r.json(); })
                        .then(function(data) {
                            if (self.ealLesson) self.ealLesson.ealStudents = data.eal_students || [];
                        })
                        .catch(function() { if (self.ealLesson) self.ealLesson.ealStudents = []; });
                }
            }
            if (action === 'online_lesson') {
                this.ealLesson = null;
                if (this.ealLessonCreationStepTimer) {
                    clearInterval(this.ealLessonCreationStepTimer);
                    this.ealLessonCreationStepTimer = null;
                }
                var onlinePreferredModelId = ealDefaultAzureModelId || defaultAzureCanvasModelId;
                if (onlinePreferredModelId) {
                    var onlineModels = this.aiModelsList || [];
                    for (var omi = 0; omi < onlineModels.length; omi++) {
                        if (onlineModels[omi] && onlineModels[omi].id === onlinePreferredModelId) {
                            this.aiModel = onlinePreferredModelId;
                            break;
                        }
                    }
                }
                var olf = window.CanvasFeatures && window.CanvasFeatures.online_lesson;
                if (olf && typeof olf.onSetActionOnlineLesson === 'function') {
                    olf.onSetActionOnlineLesson(this, context || {});
                } else {
                    this.onlineLesson = initialOnlineLesson();
                    var regFromCtx =
                        context && context.targetType === 'reg_group' && context.targetLabel
                            ? String(context.targetLabel).trim()
                            : '';
                    if (regFromCtx) this.onlineLesson.data.registration_group = regFromCtx;
                    else if (this.userRegistrationGroups && this.userRegistrationGroups.length === 1) {
                        this.onlineLesson.data.registration_group = String(this.userRegistrationGroups[0] || '').trim();
                    }
                    var selfOl = this;
                    fetch(typeof ealStudentsUrl !== 'undefined' ? ealStudentsUrl : '/eal_interactive_lesson/students', { credentials: 'include' })
                        .then(function(r) { return r.json(); })
                        .then(function(data) {
                            if (selfOl.onlineLesson) selfOl.onlineLesson.years = data.years || [];
                        })
                        .catch(function() {});
                }
            }
            if (action === 'lesson_slide_creator') {
                this.ealLesson = null;
                this.onlineLesson = null;
                var tsl = window.CanvasFeatures && window.CanvasFeatures.lesson_slide_creator;
                if (tsl && typeof tsl.onSetActionLessonSlideCreator === 'function') {
                    tsl.onSetActionLessonSlideCreator(this, context || {}, {
                        baseUrl: teacherSlideLessonsBaseUrlSafe,
                        componentsUrl: teacherSlideComponentsUrlSafe,
                        uploadImageUrlTemplate: teacherSlideLessonUploadImageUrlTemplateSafe,
                        generateImageUrlTemplate: teacherSlideGenerateImageUrlTemplateSafe,
                        generateImageResultUrlTemplate: teacherSlideGenerateImageResultUrlTemplateSafe,
                        enhanceImagePromptUrlTemplate: teacherSlideEnhanceImagePromptUrlTemplateSafe,
                        imageModels: teacherSlideImageModels,
                        imageStyles: teacherSlideImageStyles
                    });
                }
            }
            if (action === 'alert_system') {
                /* No extra state; center panel holds Lockdown / Custom Alert UI */
            }
            if (action === 'it_compliance') {
                /* Hub: static cards open it_backup / it_cyber / it_filtering */
            }
            if (action === 'it_backup' || action === 'it_cyber' || action === 'it_filtering') {
                /* Dedicated IT Compliance sub-pages: backup uses redstorBackupCard, cyber uses cynetCyberCard */
            }
            if (action === 'email') {
                var em = window.CanvasFeatures && window.CanvasFeatures.email;
                if (em && typeof em.onSetActionEmail === 'function') em.onSetActionEmail(this, context || {});
                else this.emailSubMode = (context && context.emailSubMode) || 'manage_todays';
            }
            if (action === 'teams_meetings') {
                /* Center panel: teamsMeetingsPanel calendar */
            }
            if ((action === 'email' || action === 'teams_meetings') && defaultAzureCanvasModelId) {
                var mlist = this.aiModelsList || [];
                for (var mi = 0; mi < mlist.length; mi++) {
                    if (mlist[mi] && mlist[mi].id === defaultAzureCanvasModelId) {
                        this.aiModel = defaultAzureCanvasModelId;
                        break;
                    }
                }
            }
            if (action === 'sen_planning') {
                var sen = window.CanvasFeatures && window.CanvasFeatures.sen_planning;
                if (sen && typeof sen.onSetActionSenPlanning === 'function') {
                    sen.onSetActionSenPlanning(this, context || {}, {
                        senPlanningContextUrl:
                            (typeof senPlanningContextUrl !== 'undefined' ? senPlanningContextUrl : '')
                    });
                } else {
                    this.senPlanning = {
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
                    var self = this;
                    var url = typeof senPlanningContextUrl !== 'undefined' ? senPlanningContextUrl : '/api/sen_planning/context';
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
                        .catch(function() { if (self.senPlanning) { self.senPlanning.students = []; self.senPlanning.years = []; self.senPlanning.loading = false; } });
                }
                this.aiModel = senPlanningFixedAiModelId;
            }
            if (action === 'student_passwords') {
                var sp = window.CanvasFeatures && window.CanvasFeatures.student_passwords;
                if (sp && typeof sp.onSetActionStudentPasswords === 'function') {
                    sp.onSetActionStudentPasswords(this, context || {}, {
                        studentPasswordsContextUrl:
                            (typeof studentPasswordsContextUrl !== 'undefined' ? studentPasswordsContextUrl : '')
                    });
                } else {
                    this.studentPasswords = {
                        students: [],
                        registrationGroups: [],
                        selectedGroup: '',
                        page: 1,
                        page_size: 30,
                        has_prev: false,
                        has_next: false,
                        senListExists: false,
                        ealListExists: false,
                        directoryType: '',
                        apiSource: '',
                        loading: true,
                        error: '',
                        searchQuery: '',
                        searchActive: false,
                        accountInfoOpen: false,
                        senModalStudent: null,
                        ealModalStudent: null,
                        emailTaskId: null,
                        emailStatus: ''
                    };
                    var self = this;
                    var url = typeof studentPasswordsContextUrl !== 'undefined' ? studentPasswordsContextUrl : '/api/student_passwords/context';
                    fetch(url, { credentials: 'include' })
                        .then(function(r) { return r.json(); })
                        .then(function(data) {
                            if (self.studentPasswords) {
                                self.studentPasswords.students = data.students || [];
                                self.studentPasswords.registrationGroups = data.registration_groups || [];
                                self.studentPasswords.selectedGroup = data.selected_group || '';
                                self.studentPasswords.page = data.page || 1;
                                self.studentPasswords.page_size = 30;
                                self.studentPasswords.has_prev = !!data.has_prev;
                                self.studentPasswords.has_next = !!data.has_next;
                                self.studentPasswords.senListExists = !!data.sen_list_exists;
                                self.studentPasswords.ealListExists = !!data.eal_list_exists;
                                self.studentPasswords.directoryType = data.directory_type || '';
                                self.studentPasswords.apiSource = data.api_source || '';
                                self.studentPasswords.searchActive = !!data.search_active;
                                self.studentPasswords.loading = false;
                                self.studentPasswords.error = '';
                            }
                        })
                        .catch(function() {
                            if (self.studentPasswords) {
                                self.studentPasswords.students = [];
                                self.studentPasswords.registrationGroups = [];
                                self.studentPasswords.loading = false;
                                self.studentPasswords.error = 'Failed to load student details.';
                            }
                        });
                }
            }
            if (action === 'staff_management') {
                var sm = window.CanvasFeatures && window.CanvasFeatures.staff_management;
                if (sm && typeof sm.onSetActionStaffManagement === 'function') {
                    sm.onSetActionStaffManagement(this, context || {}, {
                        staffManagementContextUrl:
                            (typeof staffManagementContextUrl !== 'undefined' ? staffManagementContextUrl : '')
                    });
                } else {
                    var staffSubView = (context && context.subView) || 'staff';
                    if (['job_titles', 'registration_groups', 'years', 'subject_areas'].indexOf(staffSubView) < 0) staffSubView = 'staff';
                    this.staffManagement = {
                        staffAccounts: [],
                        trustUsers: [],
                        jobTitleOptions: [],
                        registrationGroups: [],
                        subjectAreas: [],
                        pendingRequests: [],
                        directoryType: '',
                        userDomain: '',
                        isTrustAdmin: false,
                        trust: {},
                        credentialsError: false,
                        loading: true,
                        error: '',
                        activeTab: 'school',
                        viewMode: 'list',
                        searchQuery: '',
                        trustSort: 'school-email',
                        trustPage: 1,
                        trustPageSize: 20,
                        detailsModalStaffId: null,
                        requestUserModalOpen: false,
                        activeSubView: staffSubView,
                        bulkTaskId: null,
                        bulkTaskStatus: '',
                        bulkTaskSuccessCount: 0,
                        bulkTaskErrorCount: 0,
                        bulkTaskCurrent: 0,
                        bulkTaskTotal: 0
                    };
                    var self = this;
                    var url = typeof staffManagementContextUrl !== 'undefined' ? staffManagementContextUrl : '/api/staff_management/context';
                    fetch(url, { credentials: 'include' })
                        .then(function(r) { return r.json(); })
                        .then(function(data) {
                            if (self.staffManagement && !data.error) {
                                self.staffManagement.staffAccounts = data.staff_accounts || [];
                                self.staffManagement.trustUsers = data.trust_users || [];
                                self.staffManagement.jobTitleOptions = mergeJobTitleOptionsWithStaff(data.job_title_options || []);
                                self.staffManagement.registrationGroups = data.registration_groups || [];
                                self.staffManagement.yearGroups = data.year_groups || [];
                                self.staffManagement.subjectAreas = data.subject_areas || [];
                                self.staffManagement.pendingRequests = data.pending_requests || [];
                                self.staffManagement.directoryType = data.directory_type || '';
                                self.staffManagement.userDomain = data.user_domain || '';
                                self.staffManagement.isTrustAdmin = !!data.is_trust_admin;
                                self.staffManagement.trust = data.trust || {};
                                self.staffManagement.credentialsError = !!data.credentials_error;
                                self.staffManagement.loading = false;
                            } else if (self.staffManagement) {
                                self.staffManagement.loading = false;
                                self.staffManagement.error = data.error || 'Failed to load.';
                            }
                        })
                        .catch(function() {
                            if (self.staffManagement) {
                                self.staffManagement.staffAccounts = [];
                                self.staffManagement.trustUsers = [];
                                self.staffManagement.loading = false;
                                self.staffManagement.error = 'Failed to load staff management.';
                            }
                        });
                }
            }
            if (action === 'student_work_marking') {
                var swmF = window.CanvasFeatures && window.CanvasFeatures.student_work_marking;
                if (swmF && typeof swmF.onSetActionStudentWorkMarking === 'function') {
                    swmF.onSetActionStudentWorkMarking(this, context || {});
                } else {
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
                    this.studentWorkMarking = {
                        wizardStep: 1,
                        schemeId: schemeIdInit,
                        showGroup: showGroupInit,
                        data: null,
                        loading: true,
                        error: '',
                        swmError: swmErrInit,
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
                    this.refreshStudentWorkMarkingContext();
                }
            }
            if (this.isNotebookCanvasAction) {
                if (!this.notebook) {
                    this.notebook = {
                        upload: {
                            curriculum: { source_type: 'document', title: '', subject: '', topics: '', years: [], url: '', file: null, status: '' },
                            marking: { source_type: 'document', title: '', subject: '', topics: '', years: [], url: '', file: null, status: '' },
                            staff: { source_type: 'document', title: '', description: '', url: '', file: null, status: '' },
                            app: { source_type: 'document', title: '', description: '', category: '', url: '', file: null, status: '' }
                        },
                        docs: { curriculum: [], marking: [], staff: [], app: [], trust_staff: [] },
                        loading: { curriculum: false, marking: false, staff: false, app: false, trust_staff: false },
                        error: { curriculum: '', marking: '', staff: '', app: '', trust_staff: '' },
                        sharepoint: { site_id: '', drive_id: '', folder_id: '', drives: [], folders: [], syncing: false, status: '' }
                    };
                }
                loadNotebookDocuments(action);
                if (action !== 'notebook_admin') {
                    ensureNotebookCategories({ maxRetries: 8, retryDelay: 120 });
                    setTimeout(function() {
                        ensureNotebookCategories({ maxRetries: 4, retryDelay: 160 });
                        var sectionInput = document.querySelector('form input[name="notebook_section"]');
                        var uploadForm = sectionInput ? sectionInput.closest('form') : null;
                        if (uploadForm) updateNotebookUploadSubmitState(uploadForm);
                    }, 0);
                }
                if (action === 'notebook_staff') setTimeout(initNotebookStaffSyncUi, 0);
            }
            if (typeof applyInteractiveLessonIdsFromUrl === 'function') applyInteractiveLessonIdsFromUrl(this);
            if (typeof syncCanvasUrlParams === 'function') syncCanvasUrlParams(this);
            if (typeof scheduleSaveCanvasState === 'function') scheduleSaveCanvasState();
            setTimeout(function() {
                if (typeof window.canvasLoadPartialsForAction === 'function') {
                    window.canvasLoadPartialsForAction(action);
                }
            }, 0);
            if (REACT_CANVAS_ACTIONS.indexOf(action) !== -1) {
                setTimeout(function() {
                    var s = typeof Alpine !== 'undefined' && Alpine.store ? Alpine.store('canvas') : null;
                    if (s && s.currentAction === action &&
                        typeof window.canvasMountReactForAction === 'function') {
                        window.canvasMountReactForAction(action);
                    }
                }, 180);
            }
            syncCanvasChromeLinkTone(this);
        },
        fetchStaffManagementContext() {
            var sm = this.staffManagement;
            if (!sm) return;
            sm.loading = true;
            sm.error = '';
            var self = this;
            var url = typeof staffManagementContextUrl !== 'undefined' ? staffManagementContextUrl : '/api/staff_management/context';
            fetch(url, { credentials: 'include' })
                .then(function(r) { return r.json(); })
                .then(function(data) {
                    if (self.staffManagement && !data.error) {
                        self.staffManagement.staffAccounts = data.staff_accounts || [];
                        self.staffManagement.trustUsers = data.trust_users || [];
                        self.staffManagement.jobTitleOptions = mergeJobTitleOptionsWithStaff(data.job_title_options || []);
                        self.staffManagement.registrationGroups = data.registration_groups || [];
                        self.staffManagement.yearGroups = data.year_groups || [];
                        self.staffManagement.subjectAreas = data.subject_areas || [];
                        self.staffManagement.pendingRequests = data.pending_requests || [];
                        self.staffManagement.directoryType = data.directory_type || '';
                        self.staffManagement.userDomain = data.user_domain || '';
                        self.staffManagement.isTrustAdmin = !!data.is_trust_admin;
                        self.staffManagement.trust = data.trust || {};
                        self.staffManagement.credentialsError = !!data.credentials_error;
                        self.staffManagement.loading = false;
                    } else if (self.staffManagement) {
                        self.staffManagement.loading = false;
                        self.staffManagement.error = data.error || 'Failed to load.';
                    }
                })
                .catch(function() {
                    if (self.staffManagement) {
                        self.staffManagement.loading = false;
                        self.staffManagement.error = 'Failed to load staff management.';
                    }
                });
        },
        fetchStudentPasswordsContext(selectedGroup, page) {
            var sp = this.studentPasswords;
            if (!sp) return;
            sp.loading = true;
            sp.error = '';
            var listPageSize = 30;
            var searchQ = (sp.searchQuery || '').trim();
            var targetPage = searchQ ? 1 : (page || sp.page || 1);
            sp.page = targetPage;
            sp.page_size = listPageSize;

            var baseUrl = (typeof studentPasswordsContextUrl !== 'undefined' ? studentPasswordsContextUrl : '/api/student_passwords/context');
            var url = baseUrl + '?page=' + encodeURIComponent(targetPage) + '&page_size=' + encodeURIComponent(listPageSize) + (selectedGroup ? '&registration_group=' + encodeURIComponent(selectedGroup) : '');
            if (searchQ) {
                url += '&search=' + encodeURIComponent(searchQ);
            }
            var self = this;
            fetch(url, { credentials: 'include' })
                .then(function(r) { return r.json(); })
                .then(function(data) {
                    if (self.studentPasswords) {
                        self.studentPasswords.students = data.students || [];
                        self.studentPasswords.registrationGroups = data.registration_groups || [];
                        self.studentPasswords.selectedGroup = data.selected_group || '';
                        self.studentPasswords.page = data.page || targetPage;
                        self.studentPasswords.page_size = listPageSize;
                        self.studentPasswords.has_prev = !!data.has_prev;
                        self.studentPasswords.has_next = !!data.has_next;
                        self.studentPasswords.senListExists = !!data.sen_list_exists;
                        self.studentPasswords.ealListExists = !!data.eal_list_exists;
                        self.studentPasswords.directoryType = data.directory_type || '';
                        self.studentPasswords.apiSource = data.api_source || '';
                        self.studentPasswords.searchActive = !!data.search_active;
                        self.studentPasswords.loading = false;
                    }
                })
                .catch(function() {
                    if (self.studentPasswords) {
                        self.studentPasswords.students = [];
                        self.studentPasswords.loading = false;
                        self.studentPasswords.error = 'Failed to load student details.';
                    }
                });
        },
        refreshStudentWorkMarkingContext(addGroup) {
            var swm = this.studentWorkMarking;
            if (!swm) return;
            swm.loading = true;
            swm.error = '';
            if (typeof window.swmStopPolling === 'function') window.swmStopPolling(this);
            var p = new URLSearchParams();
            if (swm.schemeId) p.set('scheme_id', swm.schemeId);
            if (swm.showGroup) p.set('show_group', swm.showGroup);
            if (addGroup) p.set('add_group', addGroup);
            var qs = p.toString();
            var base = typeof studentWorkMarkingContextUrl !== 'undefined' ? studentWorkMarkingContextUrl : '/api/student_work_marking/context';
            var url = base + (qs ? ('?' + qs) : '');
            var self = this;
            fetch(url, { credentials: 'include' })
                .then(function(r) { return r.json(); })
                .then(function(data) {
                    if (!self.studentWorkMarking) return;
                    swm.data = data;
                    swm.loading = false;
                    if (addGroup) swm.pendingAddGroup = '';
                    if (data && !data.error && swm.swmError) swm.swmError = '';
                    if (data && data.error) swm.error = data.error;
                    if (data && data.selected_scheme && data.selected_scheme.id) {
                        swm.schemeId = String(data.selected_scheme.id);
                        if (swm.wizardStep < 2) swm.wizardStep = 2;
                    }
                    if (data && data.selected_group)
                        swm.showGroup = data.selected_group;
                    swm.markAllModel = 'azure/gpt-6-luna';
                    if (typeof window.swmSchedulePolling === 'function') window.swmSchedulePolling(self);
                    if (typeof scheduleSaveCanvasState === 'function') scheduleSaveCanvasState();
                })
                .catch(function(e) {
                    if (!self.studentWorkMarking) return;
                    swm.loading = false;
                    swm.error = (e && e.message) ? e.message : 'Failed to load';
                });
        },
        studentWorkMarkingPickScheme() {
            var swm = this.studentWorkMarking;
            if (!swm) return;
            var id = (swm.pickMyScheme || swm.pickOtherScheme || '').toString().trim();
            if (!id) return;
            swm.schemeId = id;
            swm.showGroup = '';
            swm.wizardStep = 2;
            swm.spSetupError = '';
            swm.pickMyScheme = '';
            swm.pickOtherScheme = '';
            this.refreshStudentWorkMarkingContext();
        },
        studentWorkMarkingClearScheme() {
            var swm = this.studentWorkMarking;
            if (!swm) return;
            swm.schemeId = '';
            swm.showGroup = '';
            swm.wizardStep = 1;
            swm.feedbackOpen = false;
            this.refreshStudentWorkMarkingContext();
        },
        studentWorkMarkingOpenGroup(group) {
            var swm = this.studentWorkMarking;
            if (!swm || !group) return;
            swm.showGroup = group;
            swm.feedbackOpen = false;
            swm.wizardStep = 3;
            this.refreshStudentWorkMarkingContext();
        },
        studentWorkMarkingWizardBack() {
            var swm = this.studentWorkMarking;
            if (!swm) return;
            if (swm.wizardStep === 3) {
                swm.wizardStep = 2;
                swm.showGroup = '';
                swm.feedbackOpen = false;
                swm.markAllRunning = false;
                swm.markAllDone = false;
            } else if (swm.wizardStep === 2) {
                swm.wizardStep = 1;
                swm.schemeId = '';
                swm.showGroup = '';
                swm.feedbackOpen = false;
                swm.spSetupError = '';
                this.refreshStudentWorkMarkingContext();
            }
        },
        studentWorkMarkingAddGroup() {
            var swm = this.studentWorkMarking;
            if (!swm || !swm.pendingAddGroup) return;
            this.refreshStudentWorkMarkingContext(swm.pendingAddGroup);
        },
        studentWorkMarkingSpItem(studentId) {
            var swm = this.studentWorkMarking;
            if (!swm || !swm.data || !swm.data.sharepoint_item_map) return null;
            return swm.data.sharepoint_item_map[String(studentId)] || null;
        },
        studentWorkMarkingGroupsToAdd() {
            var swm = this.studentWorkMarking;
            if (!swm || !swm.data) return [];
            var all = swm.data.all_registration_groups || [];
            var assoc = swm.data.associated_groups || [];
            return all.filter(function(g) { return assoc.indexOf(g) === -1; });
        },
        studentWorkMarkingStudentMarking(studentId) {
            var swm = this.studentWorkMarking;
            if (!swm || !swm.studentMark) return false;
            var x = swm.studentMark[String(studentId)];
            return !!(x && x.running);
        },
        studentWorkMarkingStudentDone(studentId) {
            var swm = this.studentWorkMarking;
            if (!swm || !swm.studentMark) return false;
            var x = swm.studentMark[String(studentId)];
            return !!(x && x.done);
        },
        studentWorkMarkingSubmitCreate() {
            var swm = this.studentWorkMarking;
            if (!swm || swm.creating) return;
            var f = swm.createForm || {};
            swm.createError = '';
            var body = {
                scheme_name: (f.scheme_name || '').trim(),
                site_id: (f.site_id || '').trim(),
                marking_agent_id: (f.marking_agent_id || '').trim(),
                curriculum_year: (f.curriculum_year || '').trim()
            };
            if (!body.scheme_name || !body.site_id || !body.marking_agent_id || !body.curriculum_year) {
                swm.createError = 'Please fill in all required fields.';
                return;
            }
            swm.creating = true;
            var self = this;
            var createUrl = typeof studentWorkMarkingCreateSchemeUrl !== 'undefined' ? studentWorkMarkingCreateSchemeUrl : '/api/student_work_marking/create_scheme';
            fetch(createUrl, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
                credentials: 'include',
                body: JSON.stringify(body)
            })
                .then(function(r) { return r.json().then(function(j) { return { ok: r.ok, j: j }; }); })
                .then(function(o) {
                    swm.creating = false;
                    if (o.j && o.j.success && o.j.scheme_id) {
                        swm.schemeId = String(o.j.scheme_id);
                        swm.showGroup = '';
                        swm.wizardStep = 2;
                        swm.spSetupError = '';
                        swm.createForm = { scheme_name: '', site_id: '', marking_agent_id: '', curriculum_year: '' };
                        self.refreshStudentWorkMarkingContext();
                    } else {
                        swm.createError = (o.j && o.j.error) ? o.j.error : 'Failed to create scheme.';
                    }
                })
                .catch(function() {
                    swm.creating = false;
                    swm.createError = 'Failed to create scheme.';
                });
        },
        /**
         * Build multipart upload from store + file input (not <form submit>) so:
         * - Alpine store methods keep correct behaviour without relying on `this` from template
         * - No dependency on submit event.target being the <form> (often the button in some browsers)
         */
        studentWorkMarkingUploadFile(card, file, student) {
            var store = typeof getCanvasStore === 'function' ? getCanvasStore() : (typeof Alpine !== 'undefined' && Alpine.store ? Alpine.store('canvas') : null);
            if (!store || !store.studentWorkMarking || !student) {
                alert('Upload failed: not ready. Refresh the page and try again.');
                return;
            }
            if (!file) {
                alert('No file provided.');
                return;
            }
            var swm = store.studentWorkMarking;
            var sch = swm.data && swm.data.selected_scheme;
            var sp = store.studentWorkMarkingSpItem(student.id);
            if (!sch || !sp || sp.id == null || sp.id === '') {
                alert('SharePoint row not ready yet. Wait for student sync to finish, then refresh.');
                return;
            }
            if (!sch.sharepoint_site_id || !sch.sharepoint_list_id) {
                alert('SharePoint list is not ready yet. Wait until setup completes.');
                return;
            }
            var uploadFilename = file.name || 'upload.jpg';
            var cardScope = null;
            try {
                if (typeof Alpine !== 'undefined' && card && Alpine.$data) cardScope = Alpine.$data(card);
            } catch (eSc) {}
            if (cardScope) { cardScope.uploading = true; cardScope.uploadDone = false; cardScope.uploadFilename = uploadFilename; }
            var fd = new FormData();
            fd.append('scheme_id', String(sch.id));
            fd.append('site_id', String(sch.sharepoint_site_id));
            fd.append('list_id', String(sch.sharepoint_list_id));
            fd.append('item_id', String(sp.id));
            fd.append('selected_group', String(swm.showGroup || ''));
            fd.append('student_id', String(student.id));
            fd.append('response_format', 'json');
            fd.append('student_work_file', file, uploadFilename);
            var url = typeof addAttachmentUrl !== 'undefined' ? addAttachmentUrl : '/add_attachment';
            fetch(url, {
                method: 'POST',
                body: fd,
                credentials: 'include',
                headers: { 'Accept': 'application/json' }
            })
                .then(function(r) {
                    return r.text().then(function(t) {
                        var j = {};
                        try {
                            j = t ? JSON.parse(t) : {};
                        } catch (e) {
                            j = { error: t ? t.slice(0, 200) : 'Non-JSON response' };
                        }
                        return { ok: r.ok, status: r.status, j: j };
                    });
                })
                .then(function(o) {
                    if (cardScope) cardScope.uploading = false;
                    if (o.ok && o.j && o.j.success) {
                        var fileInput = card ? card.querySelector('input[name="student_work_file"]') : null;
                        if (fileInput) fileInput.value = '';
                        if (cardScope) { cardScope.uploadDone = true; }
                        setTimeout(function() {
                            store.refreshStudentWorkMarkingContext();
                        }, 1500);
                    } else {
                        if (cardScope) cardScope.uploadDone = false;
                        alert((o.j && o.j.error) ? o.j.error : ('Upload failed' + (o.status ? ' (' + o.status + ')' : '')));
                    }
                })
                .catch(function(err) {
                    if (cardScope) { cardScope.uploading = false; cardScope.uploadDone = false; }
                    console.error('studentWorkMarkingUploadFile', err);
                    alert('Upload failed (network error).');
                });
        },
        studentWorkMarkingMarkOne(studentId, itemId) {
            var swm = this.studentWorkMarking;
            if (!swm || !swm.data || !swm.data.selected_scheme) return;
            var sch = swm.data.selected_scheme;
            if (!swm.studentMark) swm.studentMark = {};
            var sid = String(studentId);
            swm.studentMark[sid] = { running: true, done: false, error: false };
            var fd = new FormData();
            fd.append('scheme_id', sch.id);
            fd.append('site_id', sch.sharepoint_site_id);
            fd.append('list_id', sch.sharepoint_list_id);
            fd.append('group', swm.showGroup);
            fd.append('action', 'mark_one');
            fd.append('ai_model', swm.markAllModel || '');
            fd.append('student_id', sid);
            fd.append('item_id', String(itemId));
            var self = this;
            var mw = typeof markWorkUrl !== 'undefined' ? markWorkUrl : '/mark_work';
            fetch(mw, { method: 'POST', body: fd, credentials: 'include' })
                .then(function(r) { return r.json().then(function(j) { return { status: r.status, j: j }; }); })
                .then(function(o) {
                    if (o.status === 202 && o.j && o.j.task_id) {
                        self.studentWorkMarkingPollTask(o.j.task_id, function() {
                            if (swm.studentMark && swm.studentMark[sid]) {
                                swm.studentMark[sid].running = false;
                                swm.studentMark[sid].done = true;
                            }
                        }, function() {
                            if (swm.studentMark && swm.studentMark[sid]) {
                                swm.studentMark[sid].running = false;
                                swm.studentMark[sid].error = true;
                            }
                            alert('Marking failed.');
                        });
                    } else {
                        if (swm.studentMark && swm.studentMark[sid]) {
                            swm.studentMark[sid].running = false;
                            swm.studentMark[sid].error = true;
                        }
                        alert((o.j && o.j.error) ? o.j.error : 'Could not start marking.');
                    }
                })
                .catch(function() {
                    if (swm.studentMark && swm.studentMark[sid]) {
                        swm.studentMark[sid].running = false;
                        swm.studentMark[sid].error = true;
                    }
                    alert('Error submitting marking request.');
                });
        },
        studentWorkMarkingMarkAll() {
            var swm = this.studentWorkMarking;
            if (!swm || !swm.data || !swm.data.selected_scheme) return;
            var sch = swm.data.selected_scheme;
            swm.markAllRunning = true;
            swm.markAllDone = false;
            var fd = new FormData();
            fd.append('scheme_id', sch.id);
            fd.append('site_id', sch.sharepoint_site_id);
            fd.append('list_id', sch.sharepoint_list_id);
            fd.append('group', swm.showGroup);
            fd.append('action', 'mark_all');
            fd.append('ai_model', swm.markAllModel || '');
            var self = this;
            var mw = typeof markWorkUrl !== 'undefined' ? markWorkUrl : '/mark_work';
            fetch(mw, { method: 'POST', body: fd, credentials: 'include' })
                .then(function(r) { return r.json().then(function(j) { return { status: r.status, j: j }; }); })
                .then(function(o) {
                    if (o.status === 202 && o.j && o.j.task_id) {
                        self.studentWorkMarkingPollTask(o.j.task_id, function() {
                            swm.markAllRunning = false;
                            swm.markAllDone = true;
                        }, function() {
                            swm.markAllRunning = false;
                            alert('Mark all failed.');
                        });
                    } else {
                        swm.markAllRunning = false;
                        alert((o.j && o.j.error) ? o.j.error : 'Could not start mark all.');
                    }
                })
                .catch(function() {
                    swm.markAllRunning = false;
                    alert('Error submitting mark all request.');
                });
        },
        studentWorkMarkingPollTask(taskId, onOk, onFail) {
            var self = this;
            var url = (typeof taskStatusUrl !== 'undefined' ? taskStatusUrl : '/task_status/__TASK_ID__').replace('__TASK_ID__', taskId);
            fetch(url, { credentials: 'include' })
                .then(function(r) { return r.json(); })
                .then(function(data) {
                    if (data.state === 'SUCCESS') { if (onOk) onOk(); }
                    else if (data.state === 'FAILURE') { if (onFail) onFail(); }
                    else { setTimeout(function() { self.studentWorkMarkingPollTask(taskId, onOk, onFail); }, 1200); }
                })
                .catch(function() { if (onFail) onFail(); });
        },
        buildStudentWorkMarkingFeedbackHtml(fd) {
            if (!fd) return '<p class="text-slate-500">No data.</p>';
            var status = fd.marking_status || 'Pending';
            var statusClass = 'text-slate-600';
            if (status === 'Complete') statusClass = 'text-orange-700';
            else if (status === 'Error') statusClass = 'text-red-600';
            else if (status === 'In Progress') statusClass = 'text-amber-600';
            var parts = [];
            parts.push('<div class="rounded-lg bg-slate-50 p-3 mb-3"><h5 class="font-semibold text-slate-800 text-xs mb-1">Marking status</h5><p class="' + statusClass + ' font-medium text-sm">' + swmEscapeHtml(status) + '</p>');
            if (fd.curriculum_year) parts.push('<p class="text-xs text-slate-600 mt-1">Year: ' + swmEscapeHtml(String(fd.curriculum_year)) + '</p>');
            parts.push('</div>');
            if (fd.grade) parts.push('<div class="rounded-lg bg-sky-50 p-3 mb-3"><h5 class="font-semibold text-sky-900 text-xs mb-1">Grade</h5><p class="text-sky-950 text-sm font-medium">' + swmEscapeHtml(String(fd.grade)) + '</p></div>');
            if (fd.feedback) {
                var feedbackMd = (typeof marked !== 'undefined') ? marked.parse(String(fd.feedback)) : '<p>' + swmLinkifyEscaped(swmEscapeHtml(String(fd.feedback))) + '</p>';
                parts.push('<div class="rounded-lg bg-orange-50 p-3 mb-3"><h5 class="font-semibold text-orange-900 text-xs mb-2">Feedback</h5><div class="prose prose-sm max-w-none text-orange-950 [&_h3]:text-orange-900 [&_h3]:text-sm [&_h3]:font-semibold [&_h3]:mt-3 [&_h3]:mb-1 [&_ul]:mt-1 [&_li]:text-sm [&_strong]:font-semibold">' + feedbackMd + '</div></div>');
            }
            if (fd.learning_resources) {
                var resourcesMd = (typeof marked !== 'undefined') ? marked.parse(String(fd.learning_resources)) : '<p>' + swmLinkifyEscaped(swmEscapeHtml(String(fd.learning_resources))) + '</p>';
                parts.push('<div class="rounded-lg bg-violet-50 p-3 mb-3"><h5 class="font-semibold text-violet-900 text-xs mb-2">Learning resources</h5><div class="prose prose-sm max-w-none text-violet-950 [&_a]:text-violet-700 [&_a]:underline [&_ul]:mt-1 [&_li]:text-sm [&_strong]:font-semibold">' + resourcesMd + '</div></div>');
            }
            if (fd.error_details) parts.push('<div class="rounded-lg bg-red-50 p-3 mb-3"><h5 class="font-semibold text-red-900 text-xs mb-1">Error details</h5><p class="text-red-900 text-sm">' + swmEscapeHtml(String(fd.error_details)) + '</p></div>');
            if (!fd.grade && !fd.feedback && !fd.learning_resources && !fd.error_details) parts.push('<p class="text-slate-500 text-sm text-center py-4">No feedback available for this student.</p>');
            return parts.join('');
        },
        studentWorkMarkingOpenFeedback(studentId, studentName) {
            var swm = this.studentWorkMarking;
            if (!swm || !swm.schemeId) return;
            swm.feedbackOpen = true;
            swm.feedbackLoading = true;
            swm.feedbackTitle = 'Loading…';
            swm.feedbackHtml = '<p class="text-slate-500 text-sm">Loading feedback…</p>';
            var url = (typeof getStudentFeedbackUrl !== 'undefined' ? getStudentFeedbackUrl : '/get_student_feedback') + '?scheme_id=' + encodeURIComponent(String(swm.schemeId)) + '&student_id=' + encodeURIComponent(String(studentId));
            var self = this;
            fetch(url, { credentials: 'include' })
                .then(function(r) { return r.json(); })
                .then(function(data) {
                    if (!self.studentWorkMarking) return;
                    self.studentWorkMarking.feedbackLoading = false;
                    if (data.success && data.data) {
                        self.studentWorkMarking.feedbackTitle = 'Feedback for ' + (studentName || 'Student');
                        self.studentWorkMarking.feedbackHtml = self.buildStudentWorkMarkingFeedbackHtml(data.data);
                    } else {
                        self.studentWorkMarking.feedbackTitle = 'Feedback for ' + (studentName || 'Student');
                        self.studentWorkMarking.feedbackHtml = '<p class="text-slate-500">No feedback found.</p>';
                    }
                })
                .catch(function() {
                    if (!self.studentWorkMarking) return;
                    self.studentWorkMarking.feedbackLoading = false;
                    self.studentWorkMarking.feedbackHtml = '<p class="text-red-600">Error loading feedback.</p>';
                });
        },
        /** Open lesson_plan layout; wizard handles registration group selection. */
        openLessonPlanRegGroupFlow(promptText) {
            this.setAction('lesson_plan', { targetLabel: '', targetType: '' });
            this.lessonPlanMessages = [];
            this.showLessonPlanRegGroupChoice = false;
            if (typeof scheduleSaveCanvasState === 'function') scheduleSaveCanvasState();
        },
        showLessonPlanRegGroupChoiceFromMenu() {
            if (!this.isNavActionAllowed('lesson_plan')) return;
            this.openLessonPlanRegGroupFlow();
        },
        /** Legacy: reg-group chips — sync wizard when used. */
        chooseLessonPlanRegGroup(group) {
            this.showLessonPlanRegGroupChoice = false;
            if (!this.lessonPlan) return;
            this.lessonPlan.data.registration_group = group;
            this.lessonPlan.wizardStep = 1;
            this.lessonPlan.wizardRegMode = 'from_context';
        },
        async saveCanvasQuiz() {
            await saveCanvasQuizForStore(this);
        },
        async regenerateQuizHtmlCanvas() {
            await regenerateQuizHtmlCanvasForStore(this);
        },
        setDashboardChatMode(mode) {
            this.dashboardChatMode = mode;
            if (mode === 'one_to_one') this.rightOpen = true;
            else this.rightOpen = false;
        },
        async loadRecentChats() {
            var url = canvasThreadsRecentUrlSafe || '/canvasdashboard/chats/recent';
            if (this.aiPersonaId) {
                url += '?persona_id=' + encodeURIComponent(String(this.aiPersonaId));
            }
            try {
                var res = await fetch(url, { credentials: 'include' });
                var data = await res.json().catch(function() { return {}; });
                if (!res.ok) throw new Error((data && data.error) || 'Failed to load recent chats');
                this.recentChats = (data && Array.isArray(data.threads)) ? data.threads : [];
            } catch (e) {
                this.recentChats = [];
            }
        },
        saveCurrentChatToRecent() {
            /* Server-backed recent chats; retained as compatibility no-op. */
        },
        async startNewChat() {
            if (!this.isNavActionAllowed('new_chat')) return;
            this.sessionUploadFiles = [];
            this.sessionNotebookSelections = [];
            this.messages = [];
            this.initialChatStarted = false;
            this.initialChatDone = false;
            this.chatPromptEngaged = false;
            try {
                var payload = {
                    ai_persona_id: (this.aiPersonaId !== null && this.aiPersonaId !== undefined) ? String(this.aiPersonaId || '') : ''
                };
                var r = await fetch(canvasThreadsNewUrlSafe || '/canvasdashboard/chats/new', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    credentials: 'include',
                    body: JSON.stringify(payload)
                });
                var data = await r.json().catch(function() { return {}; });
                if (r.ok && data && data.thread_id) {
                    this.canvasChatId = String(data.thread_id);
                }
            } catch (_) {}
            if (typeof syncCanvasUrlParams === 'function') syncCanvasUrlParams(this);
            if (typeof this.loadRecentChats === 'function') this.loadRecentChats();
            window.dispatchEvent(new CustomEvent('canvas-run-greeting'));
        },
        async restoreRecentChat(chatId) {
            if (!this.isNavActionAllowed('recent_chat')) return;
            if (!chatId) return;
            var ctx = null;
            try {
                var endpoint = (canvasThreadsGetBaseUrlSafe || '/canvasdashboard/chats/') + encodeURIComponent(String(chatId));
                var res = await fetch(endpoint, { credentials: 'include' });
                ctx = await res.json().catch(function() { return null; });
                if (!res.ok || !ctx) return;
                this.messages = Array.isArray(ctx.chat_history) ? ctx.chat_history : [];
                canvasApplyMarkdownToAssistantMessages(this.messages);
                var selectedDocIds = Array.isArray(ctx.selected_document_ids) ? ctx.selected_document_ids : [];
                var selectedDocTitles = (ctx && typeof ctx.selected_document_titles === 'object' && ctx.selected_document_titles)
                    ? ctx.selected_document_titles
                    : {};
                var titleMap = Object.assign({}, this.notebookDocTitleById || {});
                (this.sessionNotebookSelections || []).forEach(function(sel) {
                    if (sel && sel.id && sel.title) titleMap[String(sel.id)] = String(sel.title);
                });
                Object.keys(selectedDocTitles).forEach(function(id) {
                    var idStr = String(id || '').trim();
                    var titleStr = String(selectedDocTitles[id] || '').trim();
                    if (idStr && titleStr) titleMap[idStr] = titleStr;
                });
                this.sessionNotebookSelections = selectedDocIds.map(function(id) {
                    var idStr = String(id);
                    var knownTitle = titleMap[idStr] || ('Document ' + idStr);
                    return { id: idStr, title: knownTitle, source: 'notebook' };
                });
                this.notebookDocTitleById = titleMap;
                this.sessionUploadFiles = [];
                this.canvasChatId = String(chatId);
            } catch (_) {
                return;
            }
            var restoredPersonaId = String((ctx && ctx.ai_persona_id) || '').trim();
            restoredPersonaId = restoredPersonaId || String((this.recentChats.find(function(c) { return String(c.id) === String(chatId); }) || {}).ai_persona_id || '').trim();
            this.aiPersonaId = restoredPersonaId || null;
            var plist = (this.personasList || []);
            var matchedPersona = plist.find(function(x) { return String(x.id) === String(restoredPersonaId); });
            this.personaPrompt = (matchedPersona && matchedPersona.prompt_text) || '';
            this.applyWorkspaceThemeForPersona(matchedPersona || null);
            this.initialChatStarted = this.messages.length > 0;
            this.initialChatDone = this.messages.length > 0;
            this.chatPromptEngaged = this.messages.length > 0;
            this.initialChatPart1 = '';
            this.initialChatPart2 = '';
            this.initialChatShowRegGroups = false;
            this.showLessonPlanRegGroupChoice = false;
            this.currentAction = null;
            syncCanvasChromeLinkTone(this);
            this.chatOnRight = false;
            if (typeof syncCanvasUrlParams === 'function') syncCanvasUrlParams(this);
            setTimeout(function() { window.dispatchEvent(new CustomEvent('canvas-ensure-dashboard-scrolled')); }, 0);
        },
        formatRecentChatTime(iso) {
            if (!iso) return '';
            try {
                return new Date(iso).toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
            } catch (e) {
                return '';
            }
        },
        findPersonaIdByExactNormalizedDisplayName(normalizedTarget) {
            const s = getCanvasStore();
            const list = (s && Array.isArray(s.personasList) ? s.personasList : []).filter(function(p) { return p && p.id !== undefined && p.id !== null; });
            if (!list.length || !normalizedTarget) return null;
            var found = list.find(function(p) { return normalizePersonaName(p.name) === normalizedTarget; });
            return found ? found.id : null;
        },
        findPersonaByExactName(displayName) {
            const s = getCanvasStore();
            const wanted = normalizePersonaName(displayName);
            const list = (s && Array.isArray(s.personasList) ? s.personasList : []).filter(function(p) { return p && p.id !== undefined && p.id !== null; });
            if (!list.length || !wanted) return null;
            var found = list.find(function(p) { return normalizePersonaName(p.name) === wanted; });
            return found || null;
        },
        getPersonaById(personaId) {
            var nextId = String(personaId || '').trim();
            if (!nextId) return null;
            var list = (this.personasList && Array.isArray(this.personasList)) ? this.personasList : [];
            return list.find(function(x) { return String(x.id) === nextId; }) || null;
        },
        applyWorkspaceThemeForPersona(persona) {
            var theme = resolveWorkspaceTheme(persona);
            this.activePersonaTheme = theme;
            this.activePersonaThemeKey = theme.workspace_theme_key || 'atomas';
        },
        applyWorkspaceThemeForPersonaId(personaId) {
            var p = this.getPersonaById(personaId);
            this.applyWorkspaceThemeForPersona(p);
        },
        findPersonaIdForSltHeadteacherChat() {
            const s = getCanvasStore();
            const list = (s && Array.isArray(s.personasList) ? s.personasList : []).filter(function(p) { return p && p.id !== undefined && p.id !== null; });
            if (!list.length) return null;
            var found = list.find(function(p) { return matchesHeadteacherSltPersonaName(p.name); });
            return found ? found.id : null;
        },
        findPersonaIdByNameHints(hints) {
            const s = getCanvasStore();
            const list = (s && Array.isArray(s.personasList) ? s.personasList : []).filter(function(p) { return p && p.id !== undefined && p.id !== null; });
            if (!list.length || !Array.isArray(hints) || !hints.length) return null;

            var normalizedHints = hints
                .map(function(h) { return String(h || '').toLowerCase().trim(); })
                .filter(function(h) { return !!h; });
            if (!normalizedHints.length) return null;

            // Prefer specific phrase matches first (e.g. "hr agent" before "hr").
            for (var i = 0; i < normalizedHints.length; i++) {
                var phrase = normalizedHints[i];
                var exactish = list.find(function(p) {
                    var name = String((p && p.name) || '').toLowerCase();
                    return name.indexOf(phrase) !== -1;
                });
                if (exactish) return exactish.id;
            }

            return null;
        },
        chatModeLabel() {
            var id = this.aiPersonaId;
            if (id === null || id === undefined || String(id).trim() === '') return 'Atomas';
            var p = this.getPersonaById(id);
            if (!p || !p.name) return 'Atomas';
            var name = String(p.name).trim();
            var lower = normalizePersonaName(name);
            if (lower === 'atomas') return 'Atomas';
            if (lower === 'atomas support') return 'Help';
            if (lower === 'hr ai' || lower.indexOf('hr agent') !== -1) return 'HR';
            if (lower === 'slt ai' || matchesHeadteacherSltPersonaName(name)) return 'SLT';
            return name;
        },
        selectQuickPersona(kind, draftText) {
            const s = getCanvasStore();
            var k = String(kind || '').toLowerCase();
            var label = '';
            var wantedName = '';
            if (k === 'atomas') {
                s.errorMsg = '';
                this.handlePersonaSelectFromBar(null);
                if (draftText) s.inputText = String(draftText);
                return;
            } else if (k === 'atomas_support') {
                wantedName = 'Atomas Support';
                label = 'Atomas Support';
            } else if (k === 'hr') {
                wantedName = 'HR AI';
                label = 'HR Agent';
            } else if (k === 'slt') {
                wantedName = 'SLT AI';
                label = 'SLT Agent';
            } else {
                return;
            }

            var persona = this.findPersonaByExactName(wantedName);
            if (!persona || persona.id === undefined || persona.id === null) {
                s.errorMsg = label + ' is not available for your account right now.';
                return;
            }

            s.errorMsg = '';
            this.handlePersonaSelectFromBar(persona.id);
            if (draftText) s.inputText = String(draftText);

            // HR already engages prompt in handlePersonaSelectFromBar.
            if (k === 'slt') {
                s.chatPromptEngaged = true;
            }
        },
        async handlePersonaSelectFromBar(personaId) {
            const s = getCanvasStore();
            const nextId = personaId || null;
            const prevId = s.aiPersonaId || null;
            const switchRequestId = (Number(s.personaSwitchRequestId || 0) + 1);
            s.personaSwitchRequestId = switchRequestId;
            s.personaSwitchPending = true;
            s.aiPersonaId = nextId;
            const serverList = (typeof personasListFromServer !== 'undefined' && personasListFromServer) || [];
            var p = serverList.find(function(x) { return String(x.id) === String(nextId); });
            if (!p && s.personasList && Array.isArray(s.personasList)) {
                p = s.personasList.find(function(x) { return String(x.id) === String(nextId); });
            }
            s.personaPrompt = (p && p.prompt_text) || '';
            s.applyWorkspaceThemeForPersona(p || null);
            const nameLower = (p && p.name) ? (p.name + '').toLowerCase() : '';
            const isHrAgent = nameLower.indexOf('hr agent') !== -1;

            // Short announcement when persona changes (or when clearing to Atomas).
            // - We announce on change only (prevents spam if user re-clicks the same persona).
            // - HR keeps its richer greeting; we still allow the generic announcement when switching away/to HR,
            //   but skip if HR greeting will be shown for this selection.
            const changed = String(prevId || '') !== String(nextId || '');
            const alreadyAnnounced = String(s.lastAnnouncedPersonaId || '') === String(nextId || '');
            const shouldAnnounce = changed && !alreadyAnnounced;
            let pendingAnnouncement = '';
            if (shouldAnnounce) {
                if (!nextId) {
                    pendingAnnouncement = pickPersonaSwitchIntro([
                        'Back on Atomas (General). Quick questions, drafting, and help finding your way around the tools.',
                        'Atomas (General) again — ask about drafting, day-to-day questions, or how to use a tool.',
                        'General mode. I can help with quick questions, drafting, and navigating the workspace.'
                    ]);
                } else if (p && matchesHeadteacherSltPersonaName(p.name)) {
                    pendingAnnouncement = pickPersonaSwitchIntro([
                        'Headteacher and SLT — policy-aligned guidance, communications, and leadership-level decisions.',
                        'Switched to Headteacher and SLT. I can help with policy, communications, and leadership guidance.',
                        'Leadership mode. Ask about policy-aligned guidance, communications, or decisions at SLT level.'
                    ]);
                } else if (p && isHrAgent) {
                    // HR has its own detailed greeting below.
                    pendingAnnouncement = '';
                } else if (p && nameLower === 'atomas support') {
                    pendingAnnouncement = pickPersonaSwitchIntro([
                        'Atomas Support. Ask how to use a tool and I will give you the steps.',
                        'Atomas Support is on. Tell me what you want to do in Atomas and I will walk you through it.',
                        'Support mode. Ask for a walkthrough and I will name the screen and the control.'
                    ]);
                } else if (p && (nameLower.indexOf('atom it') !== -1 || (nameLower.indexOf('atom') !== -1 && nameLower.indexOf('it') !== -1))) {
                    pendingAnnouncement = pickPersonaSwitchIntro([
                        'Atom IT Support. Tell me what\'s blocking you — access, troubleshooting, or step-by-step fixes.',
                        'IT support is active. Describe the issue and I\'ll walk you through clear next steps.',
                        'Atom IT Support — share what you need access to or what\'s gone wrong, and I\'ll guide you through it.'
                    ]);
                } else if (p && (nameLower.indexOf('literacy') !== -1 || nameLower.indexOf('spag') !== -1 || (nameLower.indexOf('spelling') !== -1 && nameLower.indexOf('grammar') !== -1))) {
                    pendingAnnouncement = pickPersonaSwitchIntro([
                        'Curriculum support — lesson ideas, explanations, scaffolds, and resources aligned to your curriculum.',
                        'Curriculum agent ready. I can help with lesson ideas, explanations, scaffolds, and aligned resources.',
                        'Curriculum mode. Ask for lesson ideas, explanations, scaffolds, or curriculum-aligned resources.'
                    ]);
                } else if (p && nameLower.indexOf('computing') !== -1) {
                    pendingAnnouncement = pickPersonaSwitchIntro([
                        'Computing curriculum — lesson content, activities, and assessment ideas.',
                        'Computing support is on. Ask for lesson content, activities, or assessment ideas.',
                        'Computing mode. I can help with lesson content, classroom activities, and assessment ideas.'
                    ]);
                } else if (p && p.name) {
                    pendingAnnouncement = pickPersonaSwitchIntro([
                        p.name + ' — tell me what you need and I\'ll stay aligned to this agent\'s role.',
                        'Switched to ' + p.name + '. What would you like help with?',
                        p.name + ' is active. I\'ll keep answers focused on this agent\'s brief.'
                    ]);
                }
            }

            let pendingHrGreeting = '';
            if (p && isHrAgent) {
                pendingHrGreeting = "Hi, I'm the Atomas HR agent. I have access to your HR policies and procedures and can also search the internet for answers if I can't find answers in your policy documents. What do you need today?";
                if (!s.chatPromptEngaged) s.chatPromptEngaged = true;
            }
            // Deterministically switch to persona-owned active thread.
            try {
                var activeRes = await fetch(canvasThreadsActiveUrlSafe, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    credentials: 'include',
                    body: JSON.stringify({
                        ai_persona_id: (s.aiPersonaId !== null && s.aiPersonaId !== undefined) ? String(s.aiPersonaId || '') : ''
                    })
                });
                var activeData = await activeRes.json().catch(function() { return {}; });
                if (switchRequestId !== s.personaSwitchRequestId) return;
                if (activeRes.ok && activeData && activeData.thread_id) {
                    await s.restoreRecentChat(String(activeData.thread_id));
                } else if (String(prevId || '') !== String(nextId || '')) {
                    s.messages = [];
                }
            } catch (_) {}
            finally {
                if (switchRequestId === s.personaSwitchRequestId) s.personaSwitchPending = false;
            }
            // Only show greeting on a fresh destination thread.
            if (switchRequestId === s.personaSwitchRequestId && changed && (s.messages || []).length === 0) {
                if (pendingHrGreeting) {
                    if (typeof window.pushAssistantMessageWithTyping === 'function') {
                        window.pushAssistantMessageWithTyping(pendingHrGreeting);
                    } else {
                        s.messages.push({ role: 'assistant', content: pendingHrGreeting });
                    }
                    s.lastAnnouncedPersonaId = nextId;
                } else if (pendingAnnouncement) {
                    s.messages.push({ role: 'assistant', content: pendingAnnouncement });
                    s.lastAnnouncedPersonaId = nextId;
                }
            }
            if (typeof s.loadRecentChats === 'function') s.loadRecentChats();
        },
        /**
         * Composer chat-mode menu: HR and SLT only when those personas exist.
         * Curriculum agents stay in Lesson Planning, not this menu.
         */
        buildPersonaMenuTree() {
            const slt = this.findPersonaByExactName('SLT AI');
            const hr = this.findPersonaByExactName('HR AI');
            const rows = [];
            if (hr) rows.push({ t: 'item', key: 'hr', label: 'HR', icon: 'users', p: hr });
            if (slt) rows.push({ t: 'item', key: 'slt', label: 'Headteacher and SLT', icon: 'graduation-cap', p: slt });
            return rows;
        },
        clearAction() {
            const prev = this.currentAction;
            this.currentAction = null;
            syncCanvasChromeLinkTone(this);
            this.actionContext = { targetLabel: '', targetType: '' };
            this.isNotebookCanvasAction = false;
            this.isReactCanvasAction = false;
            this.notebookActiveSection = null;
            this.isSodCanvasAction = false;
            this.sodDataEntryParams = null;
            this.sodVizSeasonId = null;
            this.chatOnRight = false;
            this.chatPanelEntering = false;
            this.chatPanelOverflowVisible = false;
            /* Do not clear messages – preserve main dashboard chat history when returning from lesson plan / image creator */
            this.inputText = '';
            this.showLessonPlanRegGroupChoice = false;
            this.pendingLessonPlanConfirmRegGroup = null;
            this.confirmMessageTyped = '';
            this.confirmMessageComplete = false;
            this.lessonPlanTopicFromChat = '';
            if (prev === 'lesson_plan') {
                this.lessonPlanMessages = [];
                this.lessonPlan = initialLessonPlan();
                this.lessonPlanExport = initialLessonPlanExport();
                clearPersistedLessonPlanDraft();
                this.lessonPlanSelectionMenu = null;
                this.lessonPlanImageDeleteMenu = null;
                this.lessonPlanManualEditMode = false;
                this.lessonPlanAmendingAt = null;
            }
            if (prev === 'eal_lesson') {
                this.ealLesson = null;
                if (this.ealLessonCreationStepTimer) {
                    clearInterval(this.ealLessonCreationStepTimer);
                    this.ealLessonCreationStepTimer = null;
                }
            }
            if (prev === 'online_lesson') {
                this.onlineLesson = null;
                if (this.onlineLessonCreationStepTimer) {
                    clearInterval(this.onlineLessonCreationStepTimer);
                    this.onlineLessonCreationStepTimer = null;
                }
            }
            if (prev === 'lesson_slide_creator') {
                this.teacherSlideLesson = null;
            }
            if (prev === 'image_creator') {
                this.imageCreatorFromChat = false;
                this.imageCreatorPrompt = '';
                this.imageCreatorStyle = 'Photorealistic';
                this.imageCreatorSize = '512';
                this.imageCreatorModel = 'runware:400@2';
                this.imageCreatorLoading = false;
                this.imageCreatorEnhancing = false;
                this.imageCreatorResult = null;
                this.imageCreatorTaskId = null;
            }
            if (prev === 'quiz') {
                this.quiz = null;
            }
            if (prev === 'alert_system') {
                /* No cleanup required */
            }
            if (prev === 'it_compliance') {
                /* No cleanup required */
            }
            if (prev === 'it_backup' || prev === 'it_cyber' || prev === 'it_filtering') {
                /* No cleanup required */
            }
            if (prev === 'email') {
                this.emailSubMode = null;
                this.emailToolDetailOpen = null;
            }
            if (prev === 'sen_planning') {
                this.senPlanning = {
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
                    loading: false,
                    error: ''
                };
            }
            if (prev === 'student_work_marking') {
                if (typeof window.swmStopPolling === 'function') window.swmStopPolling(this);
                this.studentWorkMarking = null;
            }
            if (typeof syncCanvasUrlParams === 'function') syncCanvasUrlParams(this);
            if (typeof scheduleSaveCanvasState === 'function') scheduleSaveCanvasState();
        }
    });

    var CANVAS_CLASS_TOOL_ACTIONS = {
        my_lessons: 1,
        lesson_plan: 1,
        quiz: 1,
        sen_planning: 1,
        eal_lesson: 1,
        online_lesson: 1,
        lesson_slide_creator: 1,
        student_work_marking: 1,
        image_creator: 1
    };
    var CANVAS_ADMIN_TOOL_ACTIONS = {
        email: 1,
        teams_meetings: 1,
        it_compliance: 1,
        it_backup: 1,
        it_cyber: 1,
        it_filtering: 1,
        student_passwords: 1,
        system_admin: 1,
        staff_management: 1,
        classroom_teams: 1,
        inventory: 1,
        notebook_agent_categories: 1,
        persona_themes: 1,
        sharepoint_favourites: 1
    };

    function syncCanvasChromeLinkTone(store) {
        if (!store) return;
        var a = store.currentAction;
        if (CANVAS_CLASS_TOOL_ACTIONS[a]) store.canvasChromeLinkTone = 'class';
        else if (CANVAS_ADMIN_TOOL_ACTIONS[a]) store.canvasChromeLinkTone = 'admin';
        else store.canvasChromeLinkTone = null;
    }

    function notebookSectionFromAction(action) {
        if (action === 'notebook_curriculum') return 'curriculum';
        if (action === 'notebook_marking_rubrics') return 'marking';
        if (action === 'notebook_staff') return 'staff';
        if (action === 'notebook_app_documents') return 'app';
        if (action === 'notebook_trust_staff') return 'trust_staff';
        return 'admin';
    }

    function applyCanvasNavigationChrome(store, action, actionCtx) {
        store.currentAction = action;
        var ac = actionCtx && typeof actionCtx === 'object' ? actionCtx : {};
        store.actionContext = Object.assign({ targetLabel: '', targetType: '' }, ac);
        store.isNotebookCanvasAction = NOTEBOOK_CANVAS_ACTIONS.indexOf(action) !== -1;
        store.isReactCanvasAction = REACT_CANVAS_ACTIONS.indexOf(action) !== -1;
        store.notebookActiveSection = store.isNotebookCanvasAction ? notebookSectionFromAction(action) : null;
        store.isSodCanvasAction =
            ['sod_home', 'sod_seasons', 'sod_indicators', 'sod_data_entry', 'sod_visualizations'].indexOf(action) !== -1;
        syncCanvasChromeLinkTone(store);
    }

    function mergeQuizFromSnapshot(store, snap) {
        if (!snap || !store.quiz) return;
        if (snap.wizardActive !== undefined) store.quiz.wizardActive = !!snap.wizardActive;
        if (snap.wizardStep != null) store.quiz.wizardStep = snap.wizardStep;
        if (snap.wizardRegMode) store.quiz.wizardRegMode = snap.wizardRegMode;
        if (snap.wizardError !== undefined) store.quiz.wizardError = snap.wizardError;
        if (snap.outputFormat !== undefined) store.quiz.outputFormat = snap.outputFormat;
        if (snap.difficulty) store.quiz.difficulty = snap.difficulty;
        if (snap.questionTypeMix) store.quiz.questionTypeMix = Object.assign({}, store.quiz.questionTypeMix || {}, snap.questionTypeMix);
        if (snap.answerDocumentMode) store.quiz.answerDocumentMode = snap.answerDocumentMode;
        if (snap.notebookSelections) store.quiz.notebookSelections = snap.notebookSelections;
        if (snap.sourceUrl !== undefined) store.quiz.sourceUrl = snap.sourceUrl;
        store.quiz.sourceUrlLoading = false;
        store.quiz.sourceUrlError = '';
        if (snap.sourcePreview) store.quiz.sourcePreview = Object.assign({}, snap.sourcePreview);
        if (snap.quizExport) store.quiz.quizExport = Object.assign({}, store.quiz.quizExport || {}, snap.quizExport);
        if (snap.step != null) store.quiz.step = snap.step;
        if (snap.messages) store.quiz.messages = snap.messages;
        if (snap.taskId !== undefined) store.quiz.taskId = snap.taskId;
        if (snap.quizId !== undefined) store.quiz.quizId = snap.quizId;
        if (snap.quizPublicUrl !== undefined) store.quiz.quizPublicUrl = snap.quizPublicUrl;
        if (snap.content !== undefined) store.quiz.content = snap.content;
        if (snap.questions !== undefined) store.quiz.questions = normalizeCanvasQuizQuestionsFromServer(snap.questions);
        if (snap.contentSource) store.quiz.contentSource = snap.contentSource;
        if (snap.uploadedContentText !== undefined) store.quiz.uploadedContentText = snap.uploadedContentText;
        if (snap.htmlTemplateId) store.quiz.htmlTemplateId = snap.htmlTemplateId;
        if (snap.quizPreviewNonce != null) store.quiz.quizPreviewNonce = snap.quizPreviewNonce;
        if (snap.data && typeof snap.data === 'object') store.quiz.data = Object.assign({}, store.quiz.data || {}, snap.data);
        if (snap.loading !== undefined) store.quiz.loading = !!snap.loading;
        if (snap.error !== undefined) store.quiz.error = snap.error;
        if (snap.outputMode !== undefined && snap.outputMode !== null && snap.outputMode !== '')
            store.quiz.outputMode = snap.outputMode;
        else if (snap.quizId && !String(snap.quizPublicUrl || '').trim())
            store.quiz.outputMode = 'question_list';
        if (snap.quizPanelExpanded !== undefined) store.quiz.quizPanelExpanded = !!snap.quizPanelExpanded;
        if (!store.quiz.quizId && !store.quiz.quizPublicUrl && !store.quiz.loading && !store.quiz.wizardActive) {
            store.quiz.wizardActive = true;
            if (!store.quiz.wizardStep) store.quiz.wizardStep = 1;
        }
        var qfeat = window.CanvasFeatures && window.CanvasFeatures.quiz;
        if (qfeat && typeof qfeat.updateQuizSourcePreview === 'function') qfeat.updateQuizSourcePreview(store.quiz);
        if (qfeat && typeof qfeat.syncQuizOutputMode === 'function') qfeat.syncQuizOutputMode(store.quiz);
    }

    /**
     * Restore EAL / online curriculum lesson editor from URL (?eal_lesson_id= / ?online_lesson_id=)
     * so refresh returns to the editing panel instead of the create wizard.
     */
    function applyInteractiveLessonIdsFromUrl(store) {
        if (!store || typeof window === 'undefined') return;
        try {
            var url = new URL(window.location.href);
            var act = store.currentAction;
            var ealId = (url.searchParams.get('eal_lesson_id') || '').trim();
            var onlineId = (url.searchParams.get('online_lesson_id') || '').trim();
            var teacherSlideId = (url.searchParams.get('teacher_slide_lesson_id') || '').trim();
            if (act === 'eal_lesson' && ealId && store.ealLesson) {
                store.ealLesson.lessonId = ealId;
                store.ealLesson.wizardActive = false;
                store.ealLesson.taskId = null;
                store.ealLesson.creationStatus = '';
                store.ealLesson.creationStepIndex = 0;
            }
            if (act === 'online_lesson' && onlineId && store.onlineLesson) {
                store.onlineLesson.lessonId = onlineId;
                store.onlineLesson.wizardActive = false;
                store.onlineLesson.taskId = null;
                store.onlineLesson.creationStatus = '';
                store.onlineLesson.creationStepIndex = 0;
            }
            if (act === 'lesson_slide_creator' && teacherSlideId && store.teacherSlideLesson) {
                store.teacherSlideLesson.lessonId = teacherSlideId;
                store.teacherSlideLesson.activeStep = 'editor';
                var feature = window.CanvasFeatures && window.CanvasFeatures.lesson_slide_creator;
                if (feature && typeof feature.loadLesson === 'function') {
                    setTimeout(function() { feature.loadLesson(store, teacherSlideId); }, 0);
                }
            }
        } catch (eUrlLesson) {}
    }

    function mergeEalFromSnapshot(store, snap) {
        if (!snap || !store.ealLesson) return;
        if (snap.step != null) store.ealLesson.step = snap.step;
        if (snap.wizardActive !== undefined) store.ealLesson.wizardActive = !!snap.wizardActive;
        if (snap.wizardStep != null) store.ealLesson.wizardStep = snap.wizardStep;
        if (snap.messages) store.ealLesson.messages = snap.messages;
        if (snap.taskId !== undefined) store.ealLesson.taskId = snap.taskId;
        if (snap.lessonId !== undefined) store.ealLesson.lessonId = snap.lessonId;
        if (snap.lessonUrl !== undefined) store.ealLesson.lessonUrl = snap.lessonUrl;
        if (snap.loading !== undefined) store.ealLesson.loading = !!snap.loading;
        if (snap.error !== undefined) store.ealLesson.error = snap.error;
        if (snap.wizardError !== undefined) store.ealLesson.wizardError = snap.wizardError;
        if (snap.wizardStudentsLoading !== undefined) store.ealLesson.wizardStudentsLoading = !!snap.wizardStudentsLoading;
        if (snap.wizardStudentsError !== undefined) store.ealLesson.wizardStudentsError = snap.wizardStudentsError;
        if (snap.enhanceAimsLoading !== undefined) store.ealLesson.enhanceAimsLoading = !!snap.enhanceAimsLoading;
        if (snap.enhanceAimsError !== undefined) store.ealLesson.enhanceAimsError = snap.enhanceAimsError;
        if (snap.creationStatus !== undefined) store.ealLesson.creationStatus = snap.creationStatus;
        if (snap.creationStepIndex != null) store.ealLesson.creationStepIndex = snap.creationStepIndex;
        if (snap.data && typeof snap.data === 'object') store.ealLesson.data = Object.assign({}, store.ealLesson.data || {}, snap.data);
        if (store.ealLesson.lessonId) store.ealLesson.wizardActive = false;
    }

    function mergeOnlineFromSnapshot(store, snap) {
        if (!snap || !store.onlineLesson) return;
        if (snap.step != null) store.onlineLesson.step = snap.step;
        if (snap.wizardActive !== undefined) store.onlineLesson.wizardActive = !!snap.wizardActive;
        if (snap.wizardStep != null) store.onlineLesson.wizardStep = snap.wizardStep;
        if (snap.messages) store.onlineLesson.messages = snap.messages;
        if (snap.taskId !== undefined) store.onlineLesson.taskId = snap.taskId;
        if (snap.lessonId !== undefined) store.onlineLesson.lessonId = snap.lessonId;
        if (snap.lessonUrl !== undefined) store.onlineLesson.lessonUrl = snap.lessonUrl;
        if (snap.loading !== undefined) store.onlineLesson.loading = !!snap.loading;
        if (snap.error !== undefined) store.onlineLesson.error = snap.error;
        if (snap.wizardError !== undefined) store.onlineLesson.wizardError = snap.wizardError;
        if (snap.enhanceAimsLoading !== undefined) store.onlineLesson.enhanceAimsLoading = !!snap.enhanceAimsLoading;
        if (snap.enhanceAimsError !== undefined) store.onlineLesson.enhanceAimsError = snap.enhanceAimsError;
        if (snap.creationStatus !== undefined) store.onlineLesson.creationStatus = snap.creationStatus;
        if (snap.creationStepIndex != null) store.onlineLesson.creationStepIndex = snap.creationStepIndex;
        if (snap.data && typeof snap.data === 'object')
            store.onlineLesson.data = Object.assign({}, store.onlineLesson.data || {}, snap.data);
        if (store.onlineLesson.lessonId) store.onlineLesson.wizardActive = false;
    }

    function mergeImageCreatorFromSnapshot(store, snap) {
        if (!snap) return;
        if (snap.imageCreatorPrompt !== undefined) store.imageCreatorPrompt = snap.imageCreatorPrompt;
        if (snap.imageCreatorStyle !== undefined) store.imageCreatorStyle = snap.imageCreatorStyle;
        if (snap.imageCreatorSize !== undefined) store.imageCreatorSize = snap.imageCreatorSize;
        if (snap.imageCreatorModel !== undefined) store.imageCreatorModel = snap.imageCreatorModel;
        if (snap.imageCreatorLoading !== undefined) store.imageCreatorLoading = !!snap.imageCreatorLoading;
        if (snap.imageCreatorEnhancing !== undefined) store.imageCreatorEnhancing = !!snap.imageCreatorEnhancing;
        if (snap.imageCreatorResult !== undefined) store.imageCreatorResult = snap.imageCreatorResult;
        if (snap.imageCreatorTaskId !== undefined) store.imageCreatorTaskId = snap.imageCreatorTaskId;
        if (snap.imageCreatorFromChat !== undefined) store.imageCreatorFromChat = !!snap.imageCreatorFromChat;
    }

    function maybeFetchQuizContentAfterRestore(store) {
        var qz = store.quiz;
        if (!qz || store.currentAction !== 'quiz') return;
        if (qz.taskId && qz.loading) {
            pollQuizTaskForStore(store);
            return;
        }
        if (!qz.quizId) return;
        if (qz.questions && qz.questions.length) return;
        var qid = String(qz.quizId);
        var contentUrl = quizContentUrl.replace('__QUIZ_ID__', qid);
        fetch(contentUrl, { credentials: 'include' })
            .then(function(r) { return r.ok ? r.json() : null; })
            .then(function(data) {
                if (!data || !store.quiz || String(store.quiz.quizId) !== qid) return;
                store.quiz.content = data.quiz_content;
                applyQuizOutputFormatFromApi(store, data);
                store.quiz.questions = normalizeCanvasQuizQuestionsFromServer(data.quiz_questions || []);
                if (store.quiz.outputMode === 'question_list') store.quiz.quizPublicUrl = null;
                else if (data.quiz_url) store.quiz.quizPublicUrl = data.quiz_url;
            })
            .catch(function() {});
    }

    function maybeFetchLessonPlanContentAfterRestore(store) {
        var lp = store.lessonPlan;
        if (!lp || store.currentAction !== 'lesson_plan') return;
        if (lp.step !== 5 || !lp.draftId || lp.content != null) return;
        lp.loading = true;
        var draftId = lp.draftId;
        var contentUrl = draftContentUrl.replace('__DRAFT_ID__', draftId);
        fetch(contentUrl, { credentials: 'include' })
            .then(function(r) { return r.ok ? r.json() : null; })
            .then(function(content) {
                if (content && store.lessonPlan && store.lessonPlan.draftId === draftId) {
                    store.lessonPlan.content = content;
                    store.lessonPlan.loading = false;
                    if (typeof fetchLessonPlanWelcomeTips === 'function') fetchLessonPlanWelcomeTips(store);
                }
            })
            .catch(function() { if (store.lessonPlan && store.lessonPlan.draftId === draftId) store.lessonPlan.loading = false; });
    }

    function applyPersistedCanvasView(store, ctx) {
        if (!store || !ctx) return;
        if (canvasLessonPlanRestoredFromDraft) {
            if (ctx.chat_history && Array.isArray(ctx.chat_history)) {
                store.messages = ctx.chat_history;
                canvasApplyMarkdownToAssistantMessages(store.messages);
            }
            if (ctx.ai_persona_id !== undefined && ctx.ai_persona_id !== null) {
                var restoredPersonaIdFromDraft = String(ctx.ai_persona_id || '').trim();
                store.aiPersonaId = restoredPersonaIdFromDraft || null;
                var draftList = (store.personasList || []);
                var draftPersona = draftList.find(function(x) { return String(x.id) === String(restoredPersonaIdFromDraft); });
                store.personaPrompt = (draftPersona && draftPersona.prompt_text) || '';
                if (typeof store.applyWorkspaceThemeForPersona === 'function') {
                    store.applyWorkspaceThemeForPersona(draftPersona || null);
                }
            }
            if (ctx.lesson_plan_data && typeof ctx.lesson_plan_data === 'object' && store.lessonPlan) {
                store.lessonPlan.data = Object.assign({}, store.lessonPlan.data, sanitizeLessonPlanDataForUi(ctx.lesson_plan_data));
            }
            store.chatOnRight = false;
            store.canvasChatId = initialCanvasChatId || store.canvasChatId;
            return;
        }
        if (ctx.chat_history && Array.isArray(ctx.chat_history)) {
            store.messages = ctx.chat_history;
            canvasApplyMarkdownToAssistantMessages(store.messages);
        }
        store.sessionUploadFiles = [];
        if (Array.isArray(ctx.selected_document_ids)) {
            var selectedDocTitles = (ctx && typeof ctx.selected_document_titles === 'object' && ctx.selected_document_titles)
                ? ctx.selected_document_titles
                : {};
            var titleMap = Object.assign({}, store.notebookDocTitleById || {});
            Object.keys(selectedDocTitles).forEach(function(id) {
                var idStr = String(id || '').trim();
                var titleStr = String(selectedDocTitles[id] || '').trim();
                if (idStr && titleStr) titleMap[idStr] = titleStr;
            });
            store.sessionNotebookSelections = ctx.selected_document_ids.map(function(id) {
                var idStr = String(id);
                return { id: idStr, title: titleMap[idStr] || ('Document ' + idStr), source: 'notebook' };
            });
            store.notebookDocTitleById = titleMap;
        }
        if (ctx.ai_persona_id !== undefined && ctx.ai_persona_id !== null) {
            var restoredPersonaId = String(ctx.ai_persona_id || '').trim();
            store.aiPersonaId = restoredPersonaId || null;
            var list = (store.personasList || []);
            var persona = list.find(function(x) { return String(x.id) === String(restoredPersonaId); });
            store.personaPrompt = (persona && persona.prompt_text) || '';
            if (typeof store.applyWorkspaceThemeForPersona === 'function') {
                store.applyWorkspaceThemeForPersona(persona || null);
            }
        }
        if (ctx.lesson_plan_data && typeof ctx.lesson_plan_data === 'object' && store.lessonPlan) {
            store.lessonPlan.data = Object.assign({}, store.lessonPlan.data, sanitizeLessonPlanDataForUi(ctx.lesson_plan_data));
        }
        if (ctx.lessonPlan && store.lessonPlan) {
            if (ctx.lessonPlan.step != null) store.lessonPlan.step = ctx.lessonPlan.step;
            if (ctx.lessonPlan.draftId !== undefined) store.lessonPlan.draftId = ctx.lessonPlan.draftId;
            if (ctx.lessonPlan.taskId !== undefined) store.lessonPlan.taskId = ctx.lessonPlan.taskId;
            if (ctx.lessonPlan.wizardActive !== undefined) store.lessonPlan.wizardActive = !!ctx.lessonPlan.wizardActive;
            if (ctx.lessonPlan.wizardStep != null) store.lessonPlan.wizardStep = ctx.lessonPlan.wizardStep;
            if (store.lessonPlan.draftId) store.lessonPlan.wizardActive = false;
        }
        if (ctx.actionContext && typeof ctx.actionContext === 'object') {
            store.actionContext = Object.assign({ targetLabel: '', targetType: '' }, ctx.actionContext);
        }
        store.canvasChatId = initialCanvasChatId || store.canvasChatId;
        if (ctx.chatOnRight !== undefined && ctx.chatOnRight !== null) store.chatOnRight = !!ctx.chatOnRight;

        var action = ctx.currentAction;
        if (!action) {
            /* Persona thread rows often omit currentAction until a debounced save; streaming updates
               also merge partial patches. Clearing here at ~100ms would wipe setAction() from T=0
               (e.g. SEN planning from URL) and hide the generate form. */
            if (String(ctx.thread_type || '').trim() === 'persona_chat') {
                return;
            }
            store.currentAction = null;
            store.isNotebookCanvasAction = false;
            store.isReactCanvasAction = false;
            store.notebookActiveSection = null;
            store.isSodCanvasAction = false;
            syncCanvasChromeLinkTone(store);
            return;
        }

        var restoreWithoutSetAction = ['quiz', 'eal_lesson', 'online_lesson', 'lesson_slide_creator', 'lesson_plan', 'student_work_marking', 'image_creator'];
        if (restoreWithoutSetAction.indexOf(action) >= 0) {
            store.chatOnRight =
                action === 'lesson_plan' || action === 'quiz' || action === 'eal_lesson' || action === 'online_lesson' || action === 'lesson_slide_creator'
                    ? false
                    : ctx.chatOnRight !== false;
            applyCanvasNavigationChrome(store, action, ctx.actionContext);
        }

        if (action === 'lesson_plan') {
            store.lessonPlanExport = initialLessonPlanExport();
            maybeFetchLessonPlanContentAfterRestore(store);
        } else if (action === 'quiz') {
            store.quiz = initialQuiz();
            mergeQuizFromSnapshot(store, ctx.canvas_quiz);
            maybeFetchQuizContentAfterRestore(store);
        } else if (action === 'eal_lesson') {
            store.ealLesson = initialEalLesson();
            mergeEalFromSnapshot(store, ctx.canvas_eal);
            var selfEal = store;
            fetch(typeof ealStudentsUrl !== 'undefined' ? ealStudentsUrl : '/eal_interactive_lesson/students', { credentials: 'include' })
                .then(function(r) { return r.json(); })
                .then(function(data) {
                    if (selfEal.ealLesson) {
                        selfEal.ealLesson.ealStudents = data.eal_students || [];
                        selfEal.ealLesson.years = data.years || [];
                    }
                })
                .catch(function() {
                    if (selfEal.ealLesson) {
                        selfEal.ealLesson.ealStudents = [];
                        selfEal.ealLesson.years = [];
                    }
                });
        } else if (action === 'online_lesson') {
            store.onlineLesson = initialOnlineLesson();
            mergeOnlineFromSnapshot(store, ctx.canvas_online_lesson);
            var selfOl = store;
            fetch(typeof ealStudentsUrl !== 'undefined' ? ealStudentsUrl : '/eal_interactive_lesson/students', { credentials: 'include' })
                .then(function(r) { return r.json(); })
                .then(function(data) {
                    if (selfOl.onlineLesson) selfOl.onlineLesson.years = data.years || [];
                })
                .catch(function() {});
            if (store.onlineLesson && store.onlineLesson.taskId) {
                setTimeout(function() { pollOnlineLessonTaskForStore(store); }, 500);
            }
        } else if (action === 'lesson_slide_creator') {
            applyCanvasNavigationChrome(store, action, ctx.actionContext);
            var tslFeature = window.CanvasFeatures && window.CanvasFeatures.lesson_slide_creator;
            if (tslFeature && typeof tslFeature.initialLessonSlideCreatorState === 'function') {
                store.teacherSlideLesson = tslFeature.initialLessonSlideCreatorState();
                var snapTsl = ctx.canvas_teacher_slide_lesson || {};
                if (snapTsl.data && typeof snapTsl.data === 'object') {
                    store.teacherSlideLesson.data = Object.assign({}, store.teacherSlideLesson.data || {}, snapTsl.data);
                }
                store.teacherSlideLesson.lessonId = snapTsl.lessonId || null;
                store.teacherSlideLesson.publishedUrl = snapTsl.publishedUrl || '';
                store.teacherSlideLesson.activeStep = snapTsl.activeStep || 'setup';
                store.teacherSlideLesson.selectedSlideIndex = snapTsl.selectedSlideIndex || 0;
                store.teacherSlideLesson.viewMode = snapTsl.viewMode || 'edit';
                if (store.teacherSlideLesson.lessonId && typeof tslFeature.loadLesson === 'function') {
                    setTimeout(function() { tslFeature.loadLesson(store, store.teacherSlideLesson.lessonId); }, 0);
                }
            }
        } else if (action === 'student_work_marking') {
            var sw = ctx.canvas_swm || {};
            var schemeIdInit = (sw.schemeId || '').toString().trim();
            var showGroupInit = (sw.showGroup || '').toString().trim();
            var swmErrInit = (sw.swmError || '').toString().trim();
            if (!schemeIdInit) {
                try {
                    var uSwm2 = new URL(window.location.href);
                    if (uSwm2.searchParams.get('canvas_action') === 'student_work_marking') {
                        schemeIdInit = (uSwm2.searchParams.get('scheme_id') || '').trim();
                        showGroupInit = (uSwm2.searchParams.get('show_group') || '').trim();
                    }
                } catch (eU2) {}
            }
            store.studentWorkMarking = {
                wizardStep: 1,
                schemeId: schemeIdInit,
                showGroup: showGroupInit,
                data: null,
                loading: true,
                error: '',
                swmError: swmErrInit,
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
            store.refreshStudentWorkMarkingContext();
        } else if (action === 'image_creator') {
            store.imageCreatorPrompt = '';
            store.imageCreatorStyle = 'Photorealistic';
            store.imageCreatorSize = '512';
            store.imageCreatorModel = 'runware:400@2';
            store.imageCreatorLoading = false;
            store.imageCreatorEnhancing = false;
            store.imageCreatorResult = null;
            store.imageCreatorTaskId = null;
            mergeImageCreatorFromSnapshot(store, ctx.canvas_image_creator);
        } else {
            store.setAction(action, ctx.actionContext);
            if (action === 'email' && ctx.canvas_email && ctx.canvas_email.emailSubMode)
                store.emailSubMode = ctx.canvas_email.emailSubMode;
        }
        if (store.currentAction === 'eal_lesson' || store.currentAction === 'online_lesson')
            applyInteractiveLessonIdsFromUrl(store);
    }

    function notebookEnsureStore() {
        var s = Alpine.store('canvas');
        if (!s) return null;
        if (!s.notebook) s.notebook = { upload: {}, docs: {}, loading: {}, error: {}, sharepoint: {} };
        return s;
    }

    var _notebookCategoriesLoaded = false;
    var _notebookCategoriesLoading = false;
    var _notebookCategoriesCache = [];
    var _notebookCategoryHostRetryTimer = null;
    function renderNotebookCategoriesHost(host) {
        if (!host) return;
        if (!_notebookCategoriesCache.length) {
            host.innerHTML = '<p class="text-xs text-app-fg-muted">No categories available.</p>';
            return;
        }
        host.innerHTML = '';
        _notebookCategoriesCache.forEach(function(c) {
            var lab = document.createElement('label');
            lab.className = 'inline-flex items-center gap-1 text-xs text-app-fg mr-3 mb-1';
            var cb = document.createElement('input');
            cb.type = 'checkbox';
            cb.className = 'notebook-cat-cb rounded';
            cb.value = c.id || '';
            lab.appendChild(cb);
            lab.appendChild(document.createTextNode(' ' + (c.display_name || c.slug || '')));
            host.appendChild(lab);
        });
    }
    function scheduleNotebookCategoryRetry(opts) {
        if (_notebookCategoryHostRetryTimer) return;
        var delayMs = Math.max(40, Number(opts.retryDelay) || 120);
        _notebookCategoryHostRetryTimer = setTimeout(function() {
            _notebookCategoryHostRetryTimer = null;
            ensureNotebookCategories(opts);
        }, delayMs);
    }
    function ensureNotebookCategories(opts) {
        opts = opts || {};
        var force = !!opts.force;
        var retriesLeft = Math.max(0, Number(opts.maxRetries) || 0);
        if (!notebookRegistryCategoriesUrl) return;

        var host = document.getElementById('notebook-categories-checkboxes');
        if (!host) {
            if (retriesLeft > 0) {
                var next = Object.assign({}, opts, { maxRetries: retriesLeft - 1 });
                scheduleNotebookCategoryRetry(next);
            }
            return;
        }

        if (_notebookCategoriesLoaded && _notebookCategoriesCache.length && !force) {
            renderNotebookCategoriesHost(host);
            return;
        }
        if (_notebookCategoriesLoading) {
            if (retriesLeft > 0) {
                var wait = Object.assign({}, opts, { maxRetries: retriesLeft - 1 });
                scheduleNotebookCategoryRetry(wait);
            }
            return;
        }

        _notebookCategoriesLoading = true;
        host.innerHTML = '<p class="text-xs text-app-fg-muted">Loading categories...</p>';
        fetch(notebookRegistryCategoriesUrl, { credentials: 'include' })
            .then(function(res) {
                return res.json().then(function(data) {
                    return { res: res, data: data };
                });
            })
            .then(function(o) {
                if (!o.res.ok) throw new Error((o.data && o.data.error) || 'Failed to load categories');
                _notebookCategoriesCache = (o.data && o.data.categories) || [];
                _notebookCategoriesLoaded = true;
                renderNotebookCategoriesHost(host);
                // Re-render doc cards so "Edit categories" panels get real checkboxes
                // instead of stale "Categories are loading" placeholders.
                renderNotebookDocuments();
                var form = host.closest('form');
                if (form) updateNotebookUploadSubmitState(form);
            })
            .catch(function() {
                host.innerHTML = '<p class="text-xs text-amber-600">Failed to load categories. Retry by switching section or refreshing.</p>';
            })
            .finally(function() {
                _notebookCategoriesLoading = false;
            });
    }

    function syncNotebookCategoryIdsInForm(form) {
        if (!form) return;
        var hidden = form.querySelector('input[name="notebook_category_ids"]');
        if (!hidden) return [];
        var ids = [];
        form.querySelectorAll('.notebook-cat-cb').forEach(function(cb) {
            if (cb.checked && cb.value) ids.push(cb.value);
        });
        hidden.value = ids.join(',');
        return ids;
    }

    function updateNotebookUploadSubmitState(form) {
        if (!form) return;
        var submitBtn = form.querySelector('.notebook-upload-submit');
        var helper = form.querySelector('.notebook-categories-required-msg');
        if (!submitBtn) return;
        var section = form.querySelector('input[name="notebook_section"]')
            ? form.querySelector('input[name="notebook_section"]').value
            : '';
        var ids = syncNotebookCategoryIdsInForm(form);
        var requiresCategory = section === 'staff';
        var hasCategory = !!(ids && ids.length);
        var disable = requiresCategory && !hasCategory;
        submitBtn.disabled = disable;
        submitBtn.classList.toggle('opacity-50', disable);
        submitBtn.classList.toggle('cursor-not-allowed', disable);
        if (helper) helper.classList.toggle('hidden', !disable);
    }

    function notebookDocVisibilitySummary(doc, section) {
        if (doc.notebook_is_private) return 'Chat visibility: only uploader';
        if (section === 'app') {
            var ds = (doc.document_scope || '').toLowerCase();
            if (ds === 'app') return 'Chat visibility: entire app';
            return 'Chat visibility: everyone at this school';
        }
        if (section === 'trust_staff') {
            if ((doc.document_scope || '').toLowerCase() === 'trust') return 'Chat visibility: whole trust';
            return 'Chat visibility: everyone at this school';
        }
        return doc.released_to_staff ? 'Chat visibility: everyone at this school' : 'Chat visibility: school admins only';
    }

    function notebookAudienceSelectHtml(doc, section) {
        var opt = function(val, label, cur) {
            return '<option value="' + val + '"' + (cur === val ? ' selected' : '') + '>' + label + '</option>';
        };
        var cur;
        if (section === 'app') {
            cur = (doc.document_scope || '').toLowerCase() === 'app' ? 'app_whole' : 'app_school';
            return opt('app_whole', 'Entire app', cur) + opt('app_school', 'This school (all users)', cur);
        }
        if (section === 'trust_staff') {
            cur = (doc.document_scope || '').toLowerCase() === 'trust' ? 'trust_whole' : 'trust_school_session';
            return opt('trust_whole', 'Whole trust', cur) + opt('trust_school_session', 'This school (all users)', cur);
        }
        cur = doc.released_to_staff ? 'school_everyone' : 'school_admins';
        return opt('school_admins', 'Admins only', cur) + opt('school_everyone', 'Everyone at school', cur);
    }

    async function loadNotebookDocuments(action) {
        var s = notebookEnsureStore();
        if (!s || !s.notebook) return;
        var section = notebookSectionFromAction(action);
        if (section === 'admin') return;
        var urls = {
            curriculum: notebookCurriculumDocumentsUrl,
            marking: notebookMarkingDocumentsUrl,
            staff: notebookStaffDocumentsUrl,
            app: notebookAppDocumentsUrl,
            trust_staff: notebookTrustStaffDocumentsUrl
        };
        var url = urls[section];
        if (!url) return;
        s.notebook.loading[section] = true;
        s.notebook.error[section] = '';
        try {
            var res = await fetch(url, { credentials: 'include' });
            var data = await res.json();
            if (!res.ok) throw new Error((data && data.error) || 'Failed to load documents');
            s.notebook.docs[section] = data.documents || [];
        } catch (e) {
            s.notebook.error[section] = e.message || 'Failed to load documents';
            s.notebook.docs[section] = [];
        } finally {
            s.notebook.loading[section] = false;
            renderNotebookDocuments();
        }
    }

    function getNotebookSectionFromCurrentAction() {
        var s = Alpine.store('canvas');
        return notebookSectionFromAction((s && s.currentAction) || '');
    }
    window.getNotebookSectionFromCurrentAction = getNotebookSectionFromCurrentAction;

    function renderNotebookDocuments() {
        var s = Alpine.store('canvas');
        var host = document.getElementById('notebook-docs-list');
        if (!s || !host || !s.notebook) return;
        var section = getNotebookSectionFromCurrentAction();
        if (section === 'admin') {
            host.innerHTML = '<p class="text-sm text-app-fg-muted">Choose a notebook section to manage documents.</p>';
            return;
        }
        var docs = s.notebook.docs[section] || [];
        if (!docs.length) {
            var emptyMap = {
                curriculum: 'No curriculum documents yet. Upload your first curriculum source above.',
                marking: 'No marking rubric documents yet. Upload rubrics to support marking quality.',
                staff: 'No staff documents yet. Upload HR/policy files or run SharePoint sync.',
                app: 'No app-level documents yet. Superadmins can upload shared DFE/IT references.',
                trust_staff: 'No trust-level staff documents yet. Upload trust-wide HR/policy references above.'
            };
            host.innerHTML = '<div class="rounded-lg border border-dashed border-app-border bg-app-surface/80 px-4 py-5 text-sm text-app-fg-muted">' + (emptyMap[section] || 'No documents uploaded yet.') + '</div>';
            return;
        }
        host.innerHTML = docs.map(function(doc) {
            var description = '';
            if (section === 'staff' || section === 'trust_staff') description = (doc.topics && doc.topics[0]) || '';
            if (section === 'app') description = (doc.topics && doc.topics.join(', ')) || '';
            var years = (doc.curriculum_years || []).join(', ');
            var categoryIds = Array.isArray(doc.category_ids) ? doc.category_ids : [];
            var categoryNames = Array.isArray(doc.category_names) ? doc.category_names : [];
            var status = (doc.status || 'unknown').toLowerCase();
            var statusClass = 'bg-app-surface text-app-fg-muted border border-app-border dark:bg-white/10 dark:text-neutral-200';
            if (status === 'ready') statusClass = 'bg-orange-100 text-orange-800 dark:bg-orange-950/60 dark:text-orange-200 dark:border-orange-700 border border-orange-200';
            if (status === 'processing') statusClass = 'bg-amber-100 text-amber-800 dark:bg-amber-950/50 dark:text-amber-200 dark:border-amber-700 border border-amber-200';
            if (status === 'error') statusClass = 'bg-red-100 text-red-800 dark:bg-red-950/60 dark:text-red-200 dark:border-red-700 border border-red-200';
            var statusBadge = '<span class="px-2 py-0.5 rounded text-xs ' + statusClass + '">' + (doc.status || 'unknown') + '</span>';
            var reviewInput = section === 'staff'
                ? '<label class="text-xs text-app-fg-muted mt-2 inline-flex items-center gap-2">Review end date <input type="date" data-doc-id="' + doc.id + '" class="notebook-review-end-date border border-app-border bg-app-surface text-app-fg rounded px-2 py-1 text-xs" value="' + (doc.review_end_date || '') + '"></label>'
                : '';
            var visLine = '<p class="text-[10px] text-app-fg-muted mt-1">' + notebookDocVisibilitySummary(doc, section) + '</p>';
            var patch = '';
            if (notebookDocumentNotebookVisibilityUrlTemplate) {
                patch = '<div class="notebook-vis-patch mt-2 pt-2 border-t border-app-border text-app-fg text-xs space-y-1" data-doc-id="' + String(doc.id) + '" data-section="' + section + '">'
                    + '<label class="flex items-center gap-1"><input type="checkbox" class="notebook-vis-private rounded"' + (doc.notebook_is_private ? ' checked' : '') + '> Private</label>'
                    + '<select class="notebook-vis-audience border border-app-border bg-app-surface text-app-fg rounded px-2 py-1 text-xs w-full max-w-xs">' + notebookAudienceSelectHtml(doc, section) + '</select>'
                    + '<button type="button" class="notebook-vis-save px-2 py-1 rounded bg-app-page hover:bg-app-surface border border-app-border text-app-fg dark:hover:bg-white/10">Save visibility</button></div>';
            }
            var categoryPills = categoryNames.map(function(name) {
                return '<span class="inline-flex items-center px-2 py-0.5 rounded-full border border-app-border bg-app-page text-[10px] text-app-fg-muted dark:bg-white/10">' + name + '</span>';
            }).join('');
            var uncategorizedBadge = (section === 'staff' && !categoryIds.length)
                ? '<span class="inline-flex items-center px-2 py-0.5 rounded-full border border-amber-300 bg-amber-50 text-[10px] text-amber-800 dark:bg-amber-950/50 dark:text-amber-200 dark:border-amber-700">Uncategorized</span>'
                : '';
            var editCategoriesPanel = '';
            if (section === 'staff') {
                var categoryEditorBody = '';
                if (_notebookCategoriesCache.length) {
                    categoryEditorBody = _notebookCategoriesCache.map(function(cat) {
                        var cid = String((cat && cat.id) || '');
                        var checked = categoryIds.indexOf(cid) !== -1 ? ' checked' : '';
                        var label = (cat && (cat.display_name || cat.slug)) || '';
                        return '<label class="inline-flex items-center gap-1 text-xs text-app-fg mr-3 mb-1">'
                            + '<input type="checkbox" class="notebook-doc-cat-cb rounded" data-doc-id="' + String(doc.id) + '" value="' + cid + '"' + checked + '>'
                            + ' ' + label + '</label>';
                    }).join('');
                } else {
                    categoryEditorBody = '<p class="text-xs text-app-fg-muted">Categories are loading. Try again in a moment.</p>';
                }
                editCategoriesPanel = '<div class="mt-2 pt-2 border-t border-app-border">'
                    + '<button type="button" class="notebook-edit-cats-toggle canvas-chrome-link text-xs font-medium text-indigo-600 hover:text-indigo-800" data-doc-id="' + String(doc.id) + '">Edit categories</button>'
                    + '<div class="notebook-cats-editor hidden mt-2 rounded-lg border border-app-border bg-app-page p-2.5 dark:bg-white/5" data-doc-id="' + String(doc.id) + '">'
                    + '<div class="flex flex-wrap gap-y-1">' + categoryEditorBody + '</div>'
                    + '<div class="mt-2 flex items-center gap-2">'
                    + '<button type="button" class="notebook-cats-save px-2 py-1 rounded bg-indigo-600 hover:bg-indigo-700 text-white text-xs" data-doc-id="' + String(doc.id) + '">Save categories</button>'
                    + '<span class="notebook-cats-status text-[11px] text-app-fg-muted"></span>'
                    + '</div></div></div>';
            }
            return '<div class="notebook-doc-card border border-app-border rounded-lg p-3 bg-app-page dark:bg-white/5">'
                + '<div class="flex items-start justify-between gap-3">'
                + '<div class="min-w-0"><p class="text-sm font-medium text-app-fg break-words">' + (doc.title || 'Untitled') + '</p>'
                + (doc.subject ? '<p class="text-xs text-app-fg-muted mt-1">Subject: ' + doc.subject + '</p>' : '')
                + (years ? '<p class="text-xs text-app-fg-muted mt-1">Years: ' + years + '</p>' : '')
                + (description ? '<p class="text-xs text-app-fg-muted mt-1">' + description + '</p>' : '')
                + (doc.error_message ? '<p class="text-xs text-red-600 dark:text-red-400 mt-1">' + doc.error_message + '</p>' : '')
                + ((categoryPills || uncategorizedBadge) ? '<div class="mt-2 flex flex-wrap items-center gap-1.5">' + categoryPills + uncategorizedBadge + '</div>' : '')
                + visLine
                + patch
                + reviewInput
                + editCategoriesPanel
                + '</div>'
                + '<div class="flex items-center gap-2">' + statusBadge
                + '<button type="button" class="inline-flex items-center px-2 py-1 rounded border border-red-200 bg-red-50 text-xs text-red-700 hover:bg-red-100 dark:border-red-800 dark:bg-red-950/50 dark:text-red-200 dark:hover:bg-red-950/70 notebook-delete-doc" data-doc-id="' + doc.id + '">Delete</button></div>'
                + '</div></div>';
        }).join('');
    }

    window.refreshNotebookDocs = function(action) {
        return loadNotebookDocuments(action || (Alpine.store('canvas') || {}).currentAction || 'notebook_admin');
    };

    window.submitNotebookUpload = async function(event) {
        var form = event && event.target;
        if (!form) return;
        var selectedCategoryIds = syncNotebookCategoryIdsInForm(form);
        var section = form.querySelector('input[name="notebook_section"]') ? form.querySelector('input[name="notebook_section"]').value : '';
        var formData = new FormData(form);
        formData.delete('notebook_section');
        var uploadUrlMap = {
            curriculum: notebookCurriculumUploadUrl,
            marking: notebookMarkingUploadUrl,
            staff: notebookStaffUploadUrl,
            app: notebookAppUploadUrl,
            trust_staff: notebookTrustStaffUploadUrl
        };
        var uploadUrl = uploadUrlMap[section];
        var statusEl = document.getElementById('notebook-upload-status');
        if (!uploadUrl || !statusEl) return;
        if (section === 'staff' && (!selectedCategoryIds || !selectedCategoryIds.length)) {
            statusEl.textContent = 'Select at least one notebook category for staff documents.';
            updateNotebookUploadSubmitState(form);
            return;
        }
        statusEl.textContent = 'Uploading and processing...';
        try {
            var res = await fetch(uploadUrl, { method: 'POST', body: formData, credentials: 'include' });
            var data = await res.json();
            if (!res.ok) throw new Error((data && data.error) || 'Upload failed');
            var priv = !!(form.querySelector('input[name="notebook_is_private"]') && form.querySelector('input[name="notebook_is_private"]').checked);
            var audSel = form.querySelector('select[name="notebook_audience"]');
            var audLabel = '';
            if (audSel && audSel.selectedOptions && audSel.selectedOptions[0]) {
                audLabel = audSel.selectedOptions[0].text || '';
            }
            statusEl.textContent = priv
                ? 'Document uploaded. Chat visibility: only you.'
                : ('Document uploaded. Chat visibility: ' + (audLabel || 'per audience selection') + '.');
            form.reset();
            updateNotebookUploadSubmitState(form);
            await loadNotebookDocuments((Alpine.store('canvas') || {}).currentAction || 'notebook_admin');
        } catch (e) {
            statusEl.textContent = e.message || 'Upload failed';
        }
    };

    document.addEventListener('change', function(e) {
        var target = e.target;
        if (!target || target.name !== 'source_type') return;
        var form = target.closest('form');
        if (!form) return;
        var docInput = form.querySelector('.notebook-document-input');
        var urlInput = form.querySelector('.notebook-url-input');
        if (!docInput || !urlInput) return;
        if (target.value === 'url') {
            docInput.classList.add('hidden');
            urlInput.classList.remove('hidden');
            urlInput.required = true;
            docInput.required = false;
        } else {
            docInput.classList.remove('hidden');
            urlInput.classList.add('hidden');
            urlInput.required = false;
            docInput.required = true;
        }
        updateNotebookUploadSubmitState(form);
    });

    document.addEventListener('click', async function(e) {
        var target = e.target;
        if (!target) return;
        if (target.classList.contains('notebook-edit-cats-toggle')) {
            ensureNotebookCategories({ maxRetries: 0, force: false });
            var docCard = target.closest('.notebook-doc-card');
            if (!docCard) return;
            var editor = docCard.querySelector('.notebook-cats-editor');
            if (!editor) return;
            editor.classList.toggle('hidden');
            return;
        }
        if (target.classList.contains('notebook-cats-save')) {
            if (!notebookDocumentCategoriesPatchUrlTemplate) return;
            var docIdCats = target.getAttribute('data-doc-id');
            if (!docIdCats) return;
            var editorWrap = target.closest('.notebook-cats-editor');
            if (!editorWrap) return;
            var selected = [];
            editorWrap.querySelectorAll('.notebook-doc-cat-cb').forEach(function(cb) {
                if (cb.checked && cb.value) selected.push(cb.value);
            });
            if (!selected.length) {
                var noneStatus = editorWrap.querySelector('.notebook-cats-status');
                if (noneStatus) noneStatus.textContent = 'Pick at least one category.';
                return;
            }
            var statusEl = editorWrap.querySelector('.notebook-cats-status');
            if (statusEl) statusEl.textContent = 'Saving...';
            target.disabled = true;
            var patchUrl = notebookDocumentCategoriesPatchUrlTemplate.replace('__NOTEBOOK_DOC_ID__', docIdCats);
            try {
                var resCats = await fetch(patchUrl, {
                    method: 'PATCH',
                    headers: { 'Content-Type': 'application/json' },
                    credentials: 'include',
                    body: JSON.stringify({ category_ids: selected })
                });
                var dataCats = await resCats.json().catch(function() { return {}; });
                if (!resCats.ok) throw new Error((dataCats && dataCats.error) || 'Failed to save categories');
                if (statusEl) statusEl.textContent = 'Saved.';
                await loadNotebookDocuments((Alpine.store('canvas') || {}).currentAction || 'notebook_admin');
            } catch (errCats) {
                if (statusEl) statusEl.textContent = errCats.message || 'Save failed';
            } finally {
                target.disabled = false;
            }
            return;
        }
        if (target.classList.contains('notebook-delete-doc')) {
            var docId = target.getAttribute('data-doc-id');
            if (!docId) return;
            if (!window.confirm('Delete this document and its chunks?')) return;
            var section = getNotebookSectionFromCurrentAction();
            var deleteBaseMap = {
                curriculum: notebookCurriculumDeleteBaseUrl,
                marking: notebookMarkingDeleteBaseUrl,
                staff: notebookStaffDeleteBaseUrl,
                app: notebookAppDeleteBaseUrl,
                trust_staff: notebookTrustStaffDeleteBaseUrl
            };
            var delUrl = (deleteBaseMap[section] || '') + docId;
            if (!delUrl) return;
            var res = await fetch(delUrl, { method: 'DELETE', credentials: 'include' });
            if (res.ok) await loadNotebookDocuments((Alpine.store('canvas') || {}).currentAction || 'notebook_admin');
            return;
        }
        if (target.classList.contains('notebook-vis-save')) {
            var wrap = target.closest('.notebook-vis-patch');
            if (!wrap || !notebookDocumentNotebookVisibilityUrlTemplate) return;
            var docId = wrap.getAttribute('data-doc-id');
            if (!docId) return;
            var priv = !!(wrap.querySelector('.notebook-vis-private') && wrap.querySelector('.notebook-vis-private').checked);
            var audEl = wrap.querySelector('.notebook-vis-audience');
            var aud = audEl ? audEl.value : '';
            var url = notebookDocumentNotebookVisibilityUrlTemplate.replace('__NOTEBOOK_DOC_ID__', docId);
            var body = { notebook_is_private: priv };
            if (!priv) body.notebook_audience = aud;
            try {
                var res = await fetch(url, {
                    method: 'PATCH',
                    headers: { 'Content-Type': 'application/json' },
                    credentials: 'include',
                    body: JSON.stringify(body)
                });
                var data = await res.json().catch(function() { return {}; });
                if (!res.ok) throw new Error((data && data.error) || 'Update failed');
                await loadNotebookDocuments((Alpine.store('canvas') || {}).currentAction || 'notebook_admin');
            } catch (err) {
                window.alert(err.message || 'Visibility update failed');
            }
            return;
        }
        if (target.classList.contains('notebook-review-end-date')) {
            return;
        }
    });

    document.addEventListener('change', async function(e) {
        var target = e.target;
        if (target && target.classList && target.classList.contains('notebook-cat-cb')) {
            var uploadForm = target.closest('form');
            if (uploadForm) updateNotebookUploadSubmitState(uploadForm);
        }
        if (!target || !target.classList.contains('notebook-review-end-date')) return;
        var docId = target.getAttribute('data-doc-id');
        if (!docId) return;
        var url = notebookStaffReviewEndDateBaseUrl + docId;
        await fetch(url, {
            method: 'PATCH',
            credentials: 'include',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ review_end_date: target.value || null })
        });
    });

    async function initNotebookStaffSyncUi() {
        var siteEl = document.getElementById('notebook-sharepoint-site');
        var driveEl = document.getElementById('notebook-sharepoint-drive');
        var folderEl = document.getElementById('notebook-sharepoint-folder');
        if (!siteEl || !driveEl || !folderEl) return;
        try {
            var sitesRes = await fetch(sharepointSitesUrl, { credentials: 'include' });
            var sitesData = await sitesRes.json();
            var sites = Array.isArray(sitesData) ? sitesData : (sitesData.sites || []);
            siteEl.innerHTML = '<option value="">Select site...</option>' + sites.map(function(site) {
                var id = site.id || site.webUrl || '';
                var name = site.displayName || site.name || site.webUrl || id;
                return '<option value="' + id + '">' + name + '</option>';
            }).join('');
            driveEl.innerHTML = '<option value="">Default document library</option>';
            folderEl.innerHTML = '<option value="">Entire library</option>';
        } catch (e) {
            siteEl.innerHTML = '<option value="">Error loading sites</option>';
        }
    }

    document.addEventListener('change', async function(e) {
        var target = e.target;
        if (!target) return;
        if (target.id === 'notebook-sharepoint-site') {
            var driveEl = document.getElementById('notebook-sharepoint-drive');
            var folderEl = document.getElementById('notebook-sharepoint-folder');
            var siteId = (target.value || '').trim();
            if (!siteId || !driveEl || !folderEl) return;
            var drivesRes = await fetch(notebookStaffSharepointDrivesUrl + '?site_id=' + encodeURIComponent(siteId), { credentials: 'include' });
            var drivesData = await drivesRes.json();
            var drives = drivesData.drives || [];
            driveEl.innerHTML = '<option value="">Default document library</option>' + drives.map(function(d) { return '<option value="' + (d.id || '') + '">' + (d.name || 'Document library') + '</option>'; }).join('');
            folderEl.innerHTML = '<option value="">Entire library</option>';
        }
        if (target.id === 'notebook-sharepoint-drive') {
            var siteEl = document.getElementById('notebook-sharepoint-site');
            var folderEl2 = document.getElementById('notebook-sharepoint-folder');
            var siteId2 = siteEl ? (siteEl.value || '').trim() : '';
            var driveId = (target.value || '').trim();
            if (!siteId2 || !driveId || !folderEl2) return;
            var foldersRes = await fetch(notebookStaffSharepointFoldersUrl + '?site_id=' + encodeURIComponent(siteId2) + '&drive_id=' + encodeURIComponent(driveId), { credentials: 'include' });
            var foldersData = await foldersRes.json();
            var folders = foldersData.folders || [];
            folderEl2.innerHTML = '<option value="">Entire library</option>' + folders.map(function(f) { return '<option value="' + (f.id || '') + '">' + (f.name || 'Folder') + '</option>'; }).join('');
        }
    });

    window.startNotebookStaffSync = async function() {
        var siteEl = document.getElementById('notebook-sharepoint-site');
        var driveEl = document.getElementById('notebook-sharepoint-drive');
        var folderEl = document.getElementById('notebook-sharepoint-folder');
        var statusEl = document.getElementById('notebook-sync-status');
        if (!siteEl || !statusEl) return;
        var siteId = (siteEl.value || '').trim();
        if (!siteId) { statusEl.textContent = 'Select a SharePoint site first.'; return; }
        statusEl.textContent = 'Starting sync...';
        var res = await fetch(notebookStaffSyncSharepointUrl, {
            method: 'POST',
            credentials: 'include',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                site_id: siteId,
                drive_id: driveEl && driveEl.value ? driveEl.value.trim() : null,
                folder_id: folderEl && folderEl.value ? folderEl.value.trim() : null
            })
        });
        var data = await res.json();
        if (!res.ok || !data.task_id) { statusEl.textContent = (data && data.error) || 'Sync failed'; return; }
        var polls = 0;
        var pollTimer = setInterval(async function() {
            polls += 1;
            var t = await fetch(taskStatusUrl.replace('__TASK_ID__', data.task_id), { credentials: 'include' });
            var td = await t.json();
            if (td.state === 'PENDING' || td.state === 'PROGRESS') {
                statusEl.textContent = td.status || 'Syncing...';
                if (polls < 180) return;
            }
            clearInterval(pollTimer);
            statusEl.textContent = td.state === 'SUCCESS' ? 'Sync complete.' : (td.error || td.status || 'Sync finished');
            loadNotebookDocuments('notebook_staff');
        }, 2000);
    };

    setTimeout(function() {
        if (!initialNotebookAction) return;
        if (NOTEBOOK_CANVAS_ACTIONS.indexOf(initialNotebookAction) === -1) return;
        var s = Alpine.store('canvas');
        if (!s) return;
        if (initialNotebookAction === 'notebook_app_documents' && !isSuperadminBoot) {
            s.setAction('notebook_admin');
            return;
        }
        if (initialNotebookAction === 'notebook_trust_staff' && !isTrustNotebookAdminBoot) {
            s.setAction('notebook_admin');
            return;
        }
        s.setAction(initialNotebookAction);
    }, 0);

    setTimeout(function() {
        try {
            var params = new URLSearchParams(window.location.search);
            var act = (params.get('canvas_action') || canvasActionBoot || '').trim();
            if (!act && isAlertOnlySchoolBoot) act = 'alert_system';
            if (!act) return;
            var s = Alpine.store('canvas');
            if (!s || typeof s.setAction !== 'function') return;
            if (act === 'student_work_marking') s.setAction('student_work_marking');
            else if (act === 'sen_planning') s.setAction('sen_planning');
            else if (act === 'eal_lesson') s.setAction('eal_lesson');
            else if (act === 'online_lesson') s.setAction('online_lesson');
            else if (act === 'lesson_slide_creator') s.setAction('lesson_slide_creator');
            else if (act === 'system_admin') s.setAction('system_admin');
            else if (act === 'classroom_teams') s.setAction('classroom_teams');
            else if (act === 'alert_system') s.setAction('alert_system');
            else if (s.isNavActionAllowed(act)) s.setAction(act);
        } catch (eBootCanvas) {}
    }, 0);

    setTimeout(function() {
        var act = canvasActionBoot;
        if (!act || act.indexOf('sod_') !== 0) return;
        var s = Alpine.store('canvas');
        if (!s || typeof s.setAction !== 'function') return;
        var params = new URLSearchParams(window.location.search);
        var sid = params.get('sod_season_id') || initialSodSeasonIdBoot;
        var scid = params.get('sod_school_id') || initialSodSchoolIdBoot;
        var ctx = null;
        if (act === 'sod_data_entry' && sid && scid) {
            ctx = { seasonId: sid, schoolId: scid };
        } else if (act === 'sod_visualizations' && sid) {
            ctx = { seasonId: sid };
        }
        s.setAction(act, ctx);
    }, 0);

    (function() {
        try {
            var url = new URL(window.location.href);
            var s = Alpine.store('canvas');
            if (url.searchParams.get('email_panel') === 'draft_chat' && s) {
                s.currentAction = 'email';
                syncCanvasChromeLinkTone(s);
                s.emailSubMode = 'draft_chat';
                s.chatOnRight = true;
            }
            var staffSub = url.searchParams.get('staff_subview');
            if (staffSub && ['job_titles', 'registration_groups', 'years', 'subject_areas'].indexOf(staffSub) >= 0 && s) {
                s.setAction('staff_management', { subView: staffSub });
            }
        } catch (e) {}
    })();

    function getCanvasStore() { return Alpine.store('canvas'); }

    function quizStudentPreviewSrcForStore(s) {
        if (!s || !s.quiz || !s.quiz.quizId || !quizPreviewUrlTemplate) return '';
        var tpl = s.quiz.htmlTemplateId || 'classic';
        var base = quizPreviewUrlTemplate.replace('__QUIZ_ID__', String(s.quiz.quizId));
        var sep = base.indexOf('?') >= 0 ? '&' : '?';
        return base + sep + 'template_id=' + encodeURIComponent(tpl) + '&t=' + (s.quiz.quizPreviewNonce || 0);
    }

    function bumpQuizPreviewNonce(s) {
        if (!s || !s.quiz) return;
        s.quiz.quizPreviewNonce = (s.quiz.quizPreviewNonce || 0) + 1;
    }

    async function saveCanvasQuizForStore(s) {
        if (!s || !s.quiz || !s.quiz.quizId || s.quiz.quizSaveLoading) return;
        s.quiz.quizSaveLoading = true;
        s.quiz.error = '';
        try {
            var payload = {
                quiz_id: s.quiz.quizId,
                questions: normalizeQuizQuestionsForSave(s.quiz.questions || []),
                html_template_id: s.quiz.htmlTemplateId || 'classic'
            };
            var res = await fetch(quizUpdateUrl, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload),
                credentials: 'include'
            });
            var data = await res.json().catch(function() { return {}; });
            if (data.success) {
                if (data.html_template_id) s.quiz.htmlTemplateId = data.html_template_id;
                bumpQuizPreviewNonce(s);
                if (typeof scheduleSaveCanvasState === 'function') scheduleSaveCanvasState();
            } else {
                s.quiz.error = data.error || 'Save failed';
            }
        } catch (e) {
            s.quiz.error = e.message || 'Save failed';
        }
        s.quiz.quizSaveLoading = false;
    }

    async function regenerateQuizHtmlCanvasForStore(s) {
        if (!s || !s.quiz || !s.quiz.quizId || s.quiz.quizRegenerateLoading) return;
        s.quiz.quizRegenerateLoading = true;
        s.quiz.error = '';
        try {
            var questions = normalizeQuizQuestionsForSave(s.quiz.questions || []);
            var up = await fetch(quizUpdateUrl, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ quiz_id: s.quiz.quizId, questions: questions }),
                credentials: 'include'
            });
            var upData = await up.json().catch(function() { return {}; });
            if (!upData.success) {
                s.quiz.error = upData.error || 'Could not save questions before regenerating HTML';
                s.quiz.quizRegenerateLoading = false;
                return;
            }
            var res = await fetch(quizRegenerateHtmlUrl, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ quiz_id: s.quiz.quizId, html_template_id: s.quiz.htmlTemplateId || 'classic' }),
                credentials: 'include'
            });
            var data = await res.json().catch(function() { return {}; });
            if (data.success && data.quiz_url) {
                var u = data.quiz_url;
                s.quiz.quizPublicUrl = u + (u.indexOf('?') >= 0 ? '&' : '?') + 't=' + Date.now();
                if (data.html_template_id) s.quiz.htmlTemplateId = data.html_template_id;
                bumpQuizPreviewNonce(s);
                if (typeof scheduleSaveCanvasState === 'function') scheduleSaveCanvasState();
            } else {
                s.quiz.error = data.error || 'Regenerate failed';
            }
        } catch (e) {
            s.quiz.error = e.message || 'Regenerate failed';
        }
        s.quiz.quizRegenerateLoading = false;
    }

    async function submitQuizCreateForStore(s) {
        if (!s || !s.quiz || s.quiz.loading) return;
        var qz = s.quiz;
        var outputFormat = 'interactive_html';
        qz.outputFormat = 'interactive_html';
        qz.outputMode = 'interactive_html';
        var mix = qz.questionTypeMix || {};
        var formData = {
            ai_agent: qz.data.ai_agent_id || qz.data.ai_agent,
            subject: qz.data.subject || 'General',
            curriculum_year: qz.data.curriculum_year || 'Year 7',
            registration_group: qz.data.registration_group || (s.filterRegistrationGroup || ''),
            num_questions: qz.data.num_questions || 5,
            include_answers: qz.data.include_answers !== false,
            output_format: outputFormat,
            difficulty: qz.difficulty || 'standard',
            question_type_mix: mix,
            answer_document_mode: qz.answerDocumentMode || 'teacher',
            quiz_details: (qz.data.topic && String(qz.data.topic).trim()) || undefined,
            topic: (qz.data.topic && String(qz.data.topic).trim()) || undefined,
            filename: (qz.data.filename && String(qz.data.filename).trim()) || undefined,
            html_template_id: qz.htmlTemplateId || 'classic',
            ai_model: s.aiModel || undefined
        };
        if ((qz.uploadedContentText || '').trim()) formData.uploaded_content_text = qz.uploadedContentText.trim();
        if (qz.sourceUrl && String(qz.sourceUrl).trim()) formData.source_url = String(qz.sourceUrl).trim();
        var nbIds = (qz.notebookSelections || []).map(function(x) { return String(x.id || ''); }).filter(Boolean);
        if (nbIds.length) formData.selected_document_ids = nbIds;

        qz.loading = true;
        qz.error = '';
        if (!qz.wizardActive) qz.messages.push({ role: 'assistant', content: 'Generating quiz…' });
        try {
            var res = await fetch(createQuizUrl, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(formData),
                credentials: 'include'
            });
            var data = await res.json();
            if (res.status === 202 && data.task_id) {
                qz.taskId = data.task_id;
                await pollQuizTaskForStore(s);
            } else {
                qz.error = data.error || 'Request failed';
                if (!qz.wizardActive) qz.messages.push({ role: 'assistant', content: 'Error: ' + qz.error });
                else qz.wizardError = qz.error;
                qz.loading = false;
            }
        } catch (e) {
            qz.error = e.message || 'Network error';
            if (!qz.wizardActive) qz.messages.push({ role: 'assistant', content: 'Error: ' + qz.error });
            else qz.wizardError = qz.error;
            qz.loading = false;
        }
    }

    async function pollQuizTaskForStore(s) {
        if (!s || !s.quiz || !s.quiz.taskId) return;
        var qz = s.quiz;
        var url = taskStatusUrl.replace('__TASK_ID__', qz.taskId);
        try {
            var res = await fetch(url, { credentials: 'include' });
            var data = await res.json();
            var r = parseCanvasCeleryTaskResult(data && data.result);
            var qidRaw = r.quiz_id != null ? r.quiz_id : r.quizId;
            var qid = qidRaw != null && String(qidRaw).trim() !== '' ? String(qidRaw).trim() : null;
            var fileLink = r.file_link || r.fileLink || null;
            var teacherLink = r.teacher_file_link || r.teacherFileLink || null;
            var contentType = (r.content_type || r.contentType || '').toString();
            var ctLower = contentType.toLowerCase();
            var exportFmt = ['word', 'pdf', 'onenote'].indexOf(qz.outputFormat) >= 0;
            var isQuestionList = qz.outputFormat === 'question_list' || qz.outputMode === 'question_list' || ctLower.indexOf('question list') >= 0;
            var st = r.status != null ? String(r.status).toLowerCase() : '';
            var celeryOk = st === 'success' || !!qid || !!fileLink;

            if (data.state === 'SUCCESS' && celeryOk) {
                qz.loading = false;
                qz.taskId = null;
                qz.wizardActive = false;
                qz.messages = (qz.messages || []).filter(function(m) { return m.content !== 'Generating quiz…'; });
                if (!qz.quizExport) qz.quizExport = { loading: false, error: '', successLink: '', pupilLink: '', teacherLink: '' };

                if (exportFmt && fileLink) {
                    qz.quizId = null;
                    qz.questions = [];
                    qz.quizPublicUrl = null;
                    qz.quizExport.successLink = fileLink;
                    qz.quizExport.pupilLink = '';
                    qz.quizExport.teacherLink = '';
                    if (qz.answerDocumentMode === 'both' && teacherLink) {
                        qz.quizExport.pupilLink = fileLink;
                        qz.quizExport.teacherLink = teacherLink;
                    } else if (qz.answerDocumentMode === 'pupil') {
                        qz.quizExport.pupilLink = fileLink;
                    } else {
                        qz.quizExport.teacherLink = fileLink;
                    }
                    if (typeof scheduleSaveCanvasState === 'function') scheduleSaveCanvasState();
                    return;
                }

                if (fileLink && !isQuestionList) {
                    qz.quizPublicUrl = fileLink + (fileLink.indexOf('?') >= 0 ? '&' : '?') + 't=' + Date.now();
                }
                if (isQuestionList) qz.quizPublicUrl = null;

                if (qid) {
                    var contentUrl = quizContentUrl.replace('__QUIZ_ID__', String(qid));
                    var cr = await fetch(contentUrl, { credentials: 'include' });
                    if (cr.ok) {
                        var qData = await cr.json();
                        qz.quizId = qData.quiz_id || qid;
                        qz.content = qData.quiz_content;
                        qz.outputFormat = 'interactive_html';
                        qz.outputMode = 'interactive_html';
                        qz.questions = normalizeCanvasQuizQuestionsFromServer(qData.quiz_questions || []);
                        var qfeat = window.CanvasFeatures && window.CanvasFeatures.quiz;
                        if (qfeat && typeof qfeat.applyQuizOutputFormatFromApi === 'function') {
                            qfeat.applyQuizOutputFormatFromApi(s, qData);
                        } else if (qData.html_template_id) {
                            qz.htmlTemplateId = qData.html_template_id;
                        }
                        if (qData.quiz_url) {
                            qz.quizPublicUrl = qData.quiz_url + (qData.quiz_url.indexOf('?') >= 0 ? '&' : '?') + 't=' + Date.now();
                        }
                        bumpQuizPreviewNonce(s);
                        qz.quizPanelExpanded = true;
                    } else {
                        qz.quizId = qid;
                        if (!isQuestionList && fileLink) qz.quizPublicUrl = fileLink;
                    }
                } else if (fileLink) {
                    qz.quizId = null;
                    qz.questions = [];
                }
                if (typeof scheduleSaveCanvasState === 'function') scheduleSaveCanvasState();
            } else if (data.state === 'FAILURE') {
                var failR = parseCanvasCeleryTaskResult(data.result);
                qz.error = (failR && failR.message) || (typeof data.result === 'string' ? data.result : '') || 'Quiz generation failed';
                if (qz.wizardActive) qz.wizardError = qz.error;
                else qz.messages.push({ role: 'assistant', content: 'Error: ' + qz.error });
                qz.loading = false;
                qz.taskId = null;
            } else {
                setTimeout(function() { pollQuizTaskForStore(s); }, 1500);
            }
        } catch (e) {
            qz.error = e.message || 'Poll failed';
            qz.loading = false;
            qz.taskId = null;
        }
    }

    async function pollEalTaskForStore(s) {
        if (!s || !s.ealLesson || !s.ealLesson.taskId) return;
        var url = (typeof ealStatusUrlBase !== 'undefined' ? ealStatusUrlBase : '/eal_interactive_lesson/status/') + s.ealLesson.taskId;
        try {
            var res = await fetch(url, { credentials: 'include' });
            var data = await res.json();
            if (data.state === 'SUCCESS' && data.result) {
                var r = data.result;
                s.ealLesson.lessonId = r.lesson_id;
                s.ealLesson.lessonUrl = r.lesson_url;
                s.ealLesson.loading = false;
                s.ealLesson.taskId = null;
                s.ealLesson.creationStatus = '';
                s.ealLesson.creationStepIndex = 0;
                if (s.ealLessonCreationStepTimer) { clearInterval(s.ealLessonCreationStepTimer); s.ealLessonCreationStepTimer = null; }
                s.ealLesson.messages = s.ealLesson.messages.filter(function(m) { return m.content !== 'Generating interactive EAL lesson…'; });
                s.ealLesson.messages.push({ role: 'assistant', content: 'Your interactive EAL lesson is ready. Edit and export to HTML from the canvas.' });
                window.dispatchEvent(new CustomEvent('canvas-ensure-lesson-plan-chat-scrolled'));
                if (typeof syncCanvasUrlParams === 'function') syncCanvasUrlParams(s);
                if (typeof scheduleSaveCanvasState === 'function') scheduleSaveCanvasState();
                return;
            }
            if (data.state === 'FAILURE') {
                s.ealLesson.error = (data.result && data.result.error) || data.error || 'Lesson generation failed';
                s.ealLesson.messages.push({ role: 'assistant', content: 'Error: ' + s.ealLesson.error });
                s.ealLesson.loading = false;
                s.ealLesson.taskId = null;
                s.ealLesson.creationStatus = '';
                s.ealLesson.creationStepIndex = 0;
                if (s.ealLessonCreationStepTimer) { clearInterval(s.ealLessonCreationStepTimer); s.ealLessonCreationStepTimer = null; }
                return;
            }
            s.ealLesson.creationStatus = data.status || 'Processing...';
            setTimeout(function() { pollEalTaskForStore(s); }, 2000);
        } catch (e) {
            s.ealLesson.error = e.message || 'Poll failed';
            s.ealLesson.loading = false;
            s.ealLesson.taskId = null;
            s.ealLesson.creationStatus = '';
            s.ealLesson.creationStepIndex = 0;
            if (s.ealLessonCreationStepTimer) { clearInterval(s.ealLessonCreationStepTimer); s.ealLessonCreationStepTimer = null; }
        }
    }

    async function submitEalCreateForStore(s) {
        if (!s || !s.ealLesson || s.ealLesson.loading) return;
        s.ealLesson.loading = true;
        s.ealLesson.messages.push({ role: 'assistant', content: 'Generating interactive EAL lesson…' });
        window.dispatchEvent(new CustomEvent('canvas-ensure-lesson-plan-chat-scrolled'));
        var d = s.ealLesson.data;
        var body = {
            content_source: d.content_source || 'llm',
            lesson_type: d.lesson_type || 'single',
            registration_group: d.registration_group || '',
            student_id: d.student_id,
            curriculum_year: d.curriculum_year || '',
            subject: d.subject || '',
            lesson_aims: d.lesson_aims || '',
            topic: d.topic || '',
            topics: d.topics || [],
            topic_aims: d.topic_aims || [],
            lesson_name: d.lesson_name || '',
            ai_model: s.aiModel || '',
            image_model: d.image_model || 'runware:400@2'
        };
        var createUrl = typeof ealCreateFromCanvasUrl !== 'undefined' ? ealCreateFromCanvasUrl : '/eal_interactive_lesson/create_from_canvas';
        try {
            var res = await fetch(createUrl, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body), credentials: 'include' });
            var data = await res.json();
            if (res.status === 202 && data.task_id) {
                s.ealLesson.taskId = data.task_id;
                s.ealLesson.creationStepIndex = 0;
                s.ealLesson.creationStatus = 'Starting...';
                s.ealLesson.messages = s.ealLesson.messages.filter(function(m) { return m.content !== 'Generating interactive EAL lesson…'; });
                s.ealLesson.messages.push({ role: 'assistant', content: 'Generating interactive EAL lesson…' });
                if (s.ealLessonCreationStepTimer) clearInterval(s.ealLessonCreationStepTimer);
                s.ealLessonCreationStepTimer = setInterval(function() {
                    if (!s.ealLesson || !s.ealLesson.taskId) return;
                    s.ealLesson.creationStepIndex = (s.ealLesson.creationStepIndex + 1) % 5;
                }, 2200);
                await pollEalTaskForStore(s);
            } else {
                s.ealLesson.error = data.error || 'Request failed';
                s.ealLesson.messages.push({ role: 'assistant', content: 'Error: ' + s.ealLesson.error });
                s.ealLesson.loading = false;
            }
        } catch (e) {
            s.ealLesson.error = e.message || 'Network error';
            s.ealLesson.messages.push({ role: 'assistant', content: 'Error: ' + s.ealLesson.error });
            s.ealLesson.loading = false;
        }
    }

    async function pollOnlineLessonTaskForStore(s) {
        if (!s || !s.onlineLesson || !s.onlineLesson.taskId) return;
        var url =
            (typeof ealStatusUrlBase !== 'undefined' ? ealStatusUrlBase : '/eal_interactive_lesson/status/') +
            s.onlineLesson.taskId;
        try {
            var res = await fetch(url, { credentials: 'include' });
            var data = await res.json();
            if (data.state === 'SUCCESS' && data.result) {
                var r = data.result;
                s.onlineLesson.lessonId = r.lesson_id;
                s.onlineLesson.lessonUrl = r.lesson_url;
                s.onlineLesson.loading = false;
                s.onlineLesson.taskId = null;
                s.onlineLesson.creationStatus = '';
                s.onlineLesson.creationStepIndex = 0;
                if (s.onlineLessonCreationStepTimer) {
                    clearInterval(s.onlineLessonCreationStepTimer);
                    s.onlineLessonCreationStepTimer = null;
                }
                s.onlineLesson.messages = s.onlineLesson.messages.filter(function(m) {
                    return m.content !== 'Generating interactive lesson…';
                });
                s.onlineLesson.messages.push({
                    role: 'assistant',
                    content: 'Your curriculum lesson is ready. Edit and export to HTML from the canvas.'
                });
                window.dispatchEvent(new CustomEvent('canvas-ensure-lesson-plan-chat-scrolled'));
                if (typeof syncCanvasUrlParams === 'function') syncCanvasUrlParams(s);
                if (typeof scheduleSaveCanvasState === 'function') scheduleSaveCanvasState();
                return;
            }
            if (data.state === 'FAILURE') {
                s.onlineLesson.error = (data.result && data.result.error) || data.error || 'Lesson generation failed';
                s.onlineLesson.wizardError = s.onlineLesson.error;
                s.onlineLesson.wizardActive = true;
                s.onlineLesson.messages.push({ role: 'assistant', content: 'Error: ' + s.onlineLesson.error });
                s.onlineLesson.loading = false;
                s.onlineLesson.taskId = null;
                s.onlineLesson.creationStatus = '';
                s.onlineLesson.creationStepIndex = 0;
                if (s.onlineLessonCreationStepTimer) {
                    clearInterval(s.onlineLessonCreationStepTimer);
                    s.onlineLessonCreationStepTimer = null;
                }
                return;
            }
            s.onlineLesson.creationStatus = data.status || 'Processing...';
            setTimeout(function() {
                pollOnlineLessonTaskForStore(s);
            }, 2000);
        } catch (e) {
            s.onlineLesson.error = e.message || 'Poll failed';
            s.onlineLesson.loading = false;
            s.onlineLesson.taskId = null;
            s.onlineLesson.creationStatus = '';
            s.onlineLesson.creationStepIndex = 0;
            if (s.onlineLessonCreationStepTimer) {
                clearInterval(s.onlineLessonCreationStepTimer);
                s.onlineLessonCreationStepTimer = null;
            }
        }
    }

    async function submitOnlineCreateForStore(s) {
        if (!s || !s.onlineLesson || s.onlineLesson.loading) return;
        s.onlineLesson.loading = true;
        s.onlineLesson.messages.push({ role: 'assistant', content: 'Generating interactive lesson…' });
        window.dispatchEvent(new CustomEvent('canvas-ensure-lesson-plan-chat-scrolled'));
        var d = s.onlineLesson.data;
        var body = {
            content_source: d.content_source || 'llm',
            lesson_type: d.lesson_type || 'single',
            registration_group: d.registration_group || '',
            curriculum_year: d.curriculum_year || '',
            subject: d.subject || '',
            lesson_aims: d.lesson_aims || '',
            topic: d.topic || '',
            topics: d.topics || [],
            topic_aims: d.topic_aims || [],
            lesson_name: d.lesson_name || '',
            ai_model: s.aiModel || '',
            image_model: d.image_model || 'runware:400@2'
        };
        var createUrl =
            typeof onlineCreateFromCanvasUrlSafe !== 'undefined'
                ? onlineCreateFromCanvasUrlSafe
                : '/online_interactive_lesson/create_from_canvas';
        try {
            var res = await fetch(createUrl, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(body),
                credentials: 'include'
            });
            var data = await res.json();
            if (res.status === 202 && data.task_id) {
                s.onlineLesson.taskId = data.task_id;
                s.onlineLesson.creationStepIndex = 0;
                s.onlineLesson.creationStatus = 'Starting...';
                s.onlineLesson.messages = s.onlineLesson.messages.filter(function(m) {
                    return m.content !== 'Generating interactive lesson…';
                });
                s.onlineLesson.messages.push({ role: 'assistant', content: 'Generating interactive lesson…' });
                if (s.onlineLessonCreationStepTimer) clearInterval(s.onlineLessonCreationStepTimer);
                s.onlineLessonCreationStepTimer = setInterval(function() {
                    if (!s.onlineLesson || !s.onlineLesson.taskId) return;
                    s.onlineLesson.creationStepIndex = (s.onlineLesson.creationStepIndex + 1) % 5;
                }, 2200);
                await pollOnlineLessonTaskForStore(s);
            } else {
                s.onlineLesson.error = data.error || 'Request failed';
                s.onlineLesson.messages.push({ role: 'assistant', content: 'Error: ' + s.onlineLesson.error });
                s.onlineLesson.loading = false;
            }
        } catch (e) {
            s.onlineLesson.error = e.message || 'Network error';
            s.onlineLesson.messages.push({ role: 'assistant', content: 'Error: ' + s.onlineLesson.error });
            s.onlineLesson.loading = false;
        }
    }

    Alpine.data('quizPanel', function() {
        const store = () => getCanvasStore();
        return {
            quizUrlDraft: '',
            quizImageUploadTarget: null,
            quizPanelMcCorrectIndex(q) {
                if (!q || q.type !== 'mc') return 1;
                const opts = q.options || [];
                let c = q.correct;
                if (typeof c === 'number' && c >= 1 && c <= 4) return Math.round(c);
                if (typeof c === 'string' && /^[1-4]$/.test(c.trim())) return parseInt(c.trim(), 10);
                if (c !== undefined && c !== null && String(c).length) {
                    const ix = opts.findIndex(x => (x || '').trim() === String(c).trim());
                    if (ix >= 0) return ix + 1;
                }
                return 1;
            },
            quizPanelSetMcCorrectFromIndex(q, val) {
                if (!q || q.type !== 'mc') return;
                const n = parseInt(val, 10);
                const idx = !isNaN(n) ? Math.min(4, Math.max(1, n)) : 1;
                q.correct = idx;
            },
            quizPanelNormalizeQuestionType(q) {
                if (!q) return;
                var qfeat = window.CanvasFeatures && window.CanvasFeatures.quiz;
                if (qfeat && typeof qfeat.normalizeQuestionForEditor === 'function') {
                    var normalized = qfeat.normalizeQuestionForEditor(q);
                    Object.keys(normalized).forEach(function(k) { q[k] = normalized[k]; });
                }
            },
            addQuizQuestion() {
                var qfeat = window.CanvasFeatures && window.CanvasFeatures.quiz;
                if (qfeat && typeof qfeat.openAddQuestionChoice === 'function') qfeat.openAddQuestionChoice(store());
            },
            openAddQuestionChoice() {
                var qfeat = window.CanvasFeatures && window.CanvasFeatures.quiz;
                if (qfeat && typeof qfeat.openAddQuestionChoice === 'function') qfeat.openAddQuestionChoice(store());
            },
            closeAddQuestionChoice() {
                var qfeat = window.CanvasFeatures && window.CanvasFeatures.quiz;
                if (qfeat && typeof qfeat.closeAddQuestionChoice === 'function') qfeat.closeAddQuestionChoice(store());
            },
            addManualQuizQuestion() {
                var qfeat = window.CanvasFeatures && window.CanvasFeatures.quiz;
                if (qfeat && typeof qfeat.addManualQuizQuestion === 'function') qfeat.addManualQuizQuestion(store());
            },
            quizHasSourceMaterial() {
                var qfeat = window.CanvasFeatures && window.CanvasFeatures.quiz;
                if (qfeat && typeof qfeat.quizHasSourceMaterial === 'function') {
                    return qfeat.quizHasSourceMaterial(store().quiz);
                }
                return false;
            },
            addQuizQuestionFromSource() {
                var qfeat = window.CanvasFeatures && window.CanvasFeatures.quiz;
                if (qfeat && typeof qfeat.generateQuizQuestionFromSource === 'function') {
                    return qfeat.generateQuizQuestionFromSource(store());
                }
            },
            removeQuizQuestion(idx) {
                var qfeat = window.CanvasFeatures && window.CanvasFeatures.quiz;
                if (qfeat && typeof qfeat.removeQuizQuestion === 'function') qfeat.removeQuizQuestion(store(), idx);
            },
            moveQuizQuestionUp(idx) {
                var qfeat = window.CanvasFeatures && window.CanvasFeatures.quiz;
                if (qfeat && typeof qfeat.moveQuizQuestion === 'function') qfeat.moveQuizQuestion(store(), idx, -1);
            },
            moveQuizQuestionDown(idx) {
                var qfeat = window.CanvasFeatures && window.CanvasFeatures.quiz;
                if (qfeat && typeof qfeat.moveQuizQuestion === 'function') qfeat.moveQuizQuestion(store(), idx, 1);
            },
            enhanceQuizQuestionImagePrompt(q) {
                var qfeat = window.CanvasFeatures && window.CanvasFeatures.quiz;
                if (qfeat && typeof qfeat.enhanceQuizQuestionImagePrompt === 'function') {
                    return qfeat.enhanceQuizQuestionImagePrompt(store(), q);
                }
            },
            generateQuizQuestionImage(q) {
                var qfeat = window.CanvasFeatures && window.CanvasFeatures.quiz;
                if (qfeat && typeof qfeat.generateQuizQuestionImage === 'function') {
                    return qfeat.generateQuizQuestionImage(store(), q);
                }
            },
            handleQuizQuestionImageUpload(q, ev) {
                var file = ev && ev.target && ev.target.files && ev.target.files[0];
                if (ev && ev.target) ev.target.value = '';
                if (!file) return;
                var qfeat = window.CanvasFeatures && window.CanvasFeatures.quiz;
                if (qfeat && typeof qfeat.uploadQuizQuestionImage === 'function') {
                    return qfeat.uploadQuizQuestionImage(store(), q, file);
                }
            },
            clearQuizQuestionImage(q) {
                var qfeat = window.CanvasFeatures && window.CanvasFeatures.quiz;
                if (qfeat && typeof qfeat.clearQuizQuestionImage === 'function') qfeat.clearQuizQuestionImage(q);
            },
            openQuizQuestionImageUpload(q) {
                this.quizImageUploadTarget = q;
                if (this.$refs.quizQuestionImageInput) this.$refs.quizQuestionImageInput.click();
            },
            handleQuizQuestionImageFileSelect(ev) {
                var q = this.quizImageUploadTarget;
                this.quizImageUploadTarget = null;
                if (!q) return;
                this.handleQuizQuestionImageUpload(q, ev);
            },
            groupedNcYearsForWizard() {
                const s = store();
                const rows = s.canvasNcYearsList || [];
                const buckets = {};
                const order = [];
                rows.forEach(function(row) {
                    var y = (row && row.ncYear) || '';
                    if (!y) return;
                    var ksRaw = (row && row.keystage) && String(row.keystage).trim() ? String(row.keystage).trim() : 'Years';
                    if (!buckets[ksRaw]) { buckets[ksRaw] = []; order.push(ksRaw); }
                    if (buckets[ksRaw].indexOf(y) < 0) buckets[ksRaw].push(y);
                });
                if (order.length) return order.map(function(k) { return { keystage: k, years: buckets[k] }; });
                const flat = s.canvasYearsList || [];
                if (flat.length) return [{ keystage: 'Years', years: flat.slice() }];
                return [];
            },
            quizWizardRegGroupsForStep1() {
                const s = store();
                var mode = s.quiz && s.quiz.wizardRegMode;
                if (mode === 'multiple') return s.userRegistrationGroups || [];
                if (mode === 'school') return s.registrationGroups || [];
                return [];
            },
            quizWizardKeystage() {
                const s = store();
                const y = (s.quiz && s.quiz.data && s.quiz.data.curriculum_year) || '';
                const rows = s.canvasNcYearsList || [];
                for (var i = 0; i < rows.length; i++) {
                    if (rows[i] && rows[i].ncYear === y) return rows[i].keystage || '';
                }
                return '';
            },
            quizHtmlTemplatesList() {
                return typeof quizHtmlTemplates !== 'undefined' ? quizHtmlTemplates : [];
            },
            quizHtmlTemplatesByCategory(category) {
                return this.quizHtmlTemplatesList().filter(function(t) {
                    return t && t.category === category;
                });
            },
            quizWizardSuggestedTemplateId() {
                const s = store();
                const qz = s.quiz;
                if (!qz) return 'classic';
                var qfeat = window.CanvasFeatures && window.CanvasFeatures.quiz;
                if (qfeat && typeof qfeat.suggestQuizHtmlTemplateId === 'function') {
                    return qfeat.suggestQuizHtmlTemplateId(
                        qz.data && qz.data.subject,
                        qz.data && qz.data.topic,
                        this.quizHtmlTemplatesList()
                    );
                }
                return 'classic';
            },
            quizTemplateIsSuggested(tplId) {
                return String(tplId || '') === String(this.quizWizardSuggestedTemplateId());
            },
            quizTemplateById(tplId) {
                var id = String(tplId || '');
                return this.quizHtmlTemplatesList().find(function(t) { return t && String(t.id) === id; }) || null;
            },
            quizStudentPreviewSrc() {
                return quizStudentPreviewSrcForStore(store());
            },
            onQuizTemplateChange() {
                const s = store();
                if (!s || !s.quiz) return;
                bumpQuizPreviewNonce(s);
                if (typeof scheduleSaveCanvasState === 'function') scheduleSaveCanvasState();
            },
            quizWizardNext() {
                const s = store();
                const qz = s.quiz;
                if (!qz || !qz.wizardActive) return;
                qz.wizardError = '';
                const st = qz.wizardStep;
                if (st === 1) {
                    if (!(qz.data.registration_group && String(qz.data.registration_group).trim())) {
                        qz.wizardError = 'Please select a registration group.';
                        return;
                    }
                    if (!(qz.data.curriculum_year && String(qz.data.curriculum_year).trim())) {
                        qz.wizardError = 'Please select a curriculum year.';
                        return;
                    }
                    if (!(qz.data.ai_agent_id && String(qz.data.ai_agent_id).trim())) {
                        qz.wizardError = 'Please select a subject.';
                        return;
                    }
                    var mix = qz.questionTypeMix || {};
                    if (!mix.mc && !mix.fib && !mix.tf) {
                        qz.wizardError = 'Select at least one question type.';
                        return;
                    }
                }
                if (st === 2) {
                    var hasText = (qz.uploadedContentText || '').trim().length > 0;
                    var hasNb = (qz.notebookSelections || []).length > 0;
                    if (!hasText && !hasNb) {
                        qz.wizardError = 'Add source text or select Notebook documents.';
                        return;
                    }
                    var suggested = this.quizWizardSuggestedTemplateId();
                    if (!qz.htmlTemplateId || qz.htmlTemplateId === 'classic') {
                        qz.htmlTemplateId = suggested;
                    }
                }
                if (st < 3) qz.wizardStep = st + 1;
            },
            quizWizardBack() {
                const s = store();
                const qz = s.quiz;
                if (!qz || !qz.wizardActive || qz.wizardStep <= 1) return;
                qz.wizardError = '';
                qz.wizardStep -= 1;
            },
            async quizWizardSubmit() {
                const s = store();
                const qz = s.quiz;
                if (!qz || !qz.wizardActive || qz.loading || qz.wizardStep !== 3) return;
                qz.wizardError = '';
                if (!qz.htmlTemplateId) qz.htmlTemplateId = 'classic';
                await submitQuizCreateForStore(s);
            },
            async openNotebookTreeForQuiz() {
                const s = store();
                if (!s.quiz || !s.quiz.data.ai_agent_id) {
                    if (s.quiz) s.quiz.wizardError = 'Select a subject first (Step 1).';
                    return;
                }
                s.notebookTreeTarget = 'quiz';
                s.notebookTreeOpen = true;
                s.notebookTreeLoading = true;
                s.notebookTreeError = '';
                try {
                    const base = canvasPersonaDocumentsTreeUrl || '/canvasdashboard/persona_documents_tree';
                    const res = await fetch(base + '?persona_id=' + encodeURIComponent(String(s.quiz.data.ai_agent_id)), { credentials: 'include' });
                    const data = await res.json().catch(function() { return {}; });
                    if (!res.ok) throw new Error((data && data.error) || 'Failed to load notebook tree');
                    s.notebookTreeData = (data && data.categories) || [];
                    const expanded = {};
                    (s.notebookTreeData || []).forEach(function(c) { expanded[String(c.id)] = true; });
                    s.notebookTreeExpanded = expanded;
                    var qfeat = window.CanvasFeatures && window.CanvasFeatures.quiz;
                    if (qfeat && typeof qfeat.updateQuizSourcePreview === 'function') qfeat.updateQuizSourcePreview(s.quiz);
                } catch (e) {
                    s.notebookTreeError = e.message || 'Failed to load notebook tree';
                } finally {
                    s.notebookTreeLoading = false;
                }
            },
            removeQuizNotebookDoc(docId) {
                const s = store();
                if (!s.quiz) return;
                var idStr = String(docId || '');
                s.quiz.notebookSelections = (s.quiz.notebookSelections || []).filter(function(x) {
                    return String(x.id) !== idStr;
                });
                var qfeat = window.CanvasFeatures && window.CanvasFeatures.quiz;
                if (qfeat && typeof qfeat.updateQuizSourcePreview === 'function') qfeat.updateQuizSourcePreview(s.quiz);
            },
            selectQuizContentSource(mode) {
                const s = store();
                if (!s.quiz) return;
                s.quiz.contentSource = mode;
                s.quiz.sourceUrlLoading = false;
                s.quiz.sourceUrlError = '';
                if (mode === 'url') {
                    this.quizUrlDraft = String(s.quiz.sourceUrl || '');
                }
            },
            syncQuizUrlDraft(value) {
                this.quizUrlDraft = String(value || '');
                const s = store();
                if (!s.quiz) return;
                s.quiz.sourceUrl = this.quizUrlDraft;
                s.quiz.sourceUrlError = '';
            },
            normalizeQuizSourceUrl(raw) {
                var url = String(raw || '').trim();
                if (!url) return '';
                if (!/^https?:\/\//i.test(url)) url = 'https://' + url.replace(/^\/+/, '');
                return url;
            },
            quizUrlInputValue() {
                const s = store();
                var raw = this.quizUrlDraft;
                if (!raw && this.$refs.quizUrlInput && typeof this.$refs.quizUrlInput.value === 'string') {
                    raw = this.$refs.quizUrlInput.value;
                }
                if (!raw && s.quiz) raw = s.quiz.sourceUrl || '';
                return this.normalizeQuizSourceUrl(raw);
            },
            async handleQuizUrlFetch() {
                const s = store();
                if (!s.quiz) return;
                if (!quizExtractUrlUrl) {
                    s.quiz.sourceUrlError = 'URL fetch is unavailable. Refresh the page and try again.';
                    return;
                }
                var url = this.quizUrlInputValue();
                if (!url) {
                    s.quiz.sourceUrlError = 'Enter a URL.';
                    return;
                }
                s.quiz.sourceUrl = url;
                this.quizUrlDraft = url;
                if (this.$refs.quizUrlInput) this.$refs.quizUrlInput.value = url;
                s.quiz.sourceUrlLoading = true;
                s.quiz.sourceUrlError = '';
                var ctrl = typeof AbortController !== 'undefined' ? new AbortController() : null;
                var timer = ctrl ? setTimeout(function() { ctrl.abort(); }, 30000) : null;
                try {
                    var res = await fetch(quizExtractUrlUrl, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ url: url }),
                        credentials: 'include',
                        signal: ctrl ? ctrl.signal : undefined
                    });
                    var data = await res.json().catch(function() { return {}; });
                    if (!res.ok || !data.text) throw new Error((data && data.error) || 'Fetch failed');
                    s.quiz.uploadedContentText = data.text;
                    s.quiz.contentSource = 'url';
                    var qfeat = window.CanvasFeatures && window.CanvasFeatures.quiz;
                    if (qfeat && typeof qfeat.updateQuizSourcePreview === 'function') qfeat.updateQuizSourcePreview(s.quiz);
                } catch (e) {
                    if (e && e.name === 'AbortError') {
                        s.quiz.sourceUrlError = 'Fetch timed out. Try again or paste the text instead.';
                    } else {
                        s.quiz.sourceUrlError = (e && e.message) || 'Could not fetch URL';
                    }
                } finally {
                    if (timer) clearTimeout(timer);
                    s.quiz.sourceUrlLoading = false;
                }
            },
            handleQuizFileDrop(ev) {
                const files = ev.dataTransfer && ev.dataTransfer.files;
                if (!files || !files.length) return;
                this.handleQuizFile(files[0]);
            },
            handleQuizFileSelect(ev) {
                const files = ev.target && ev.target.files;
                if (!files || !files.length) return;
                this.handleQuizFile(files[0]);
                ev.target.value = '';
            },
            handleQuizFile(file) {
                const s = store();
                if (!s.quiz) return;
                const formData = new FormData();
                formData.append('content_file', file);
                fetch(quizExtractTextUrl, { method: 'POST', body: formData, credentials: 'include' })
                    .then(r => r.json())
                    .then(data => {
                        if (data.text) {
                            s.quiz.contentSource = 'file';
                            s.quiz.uploadedContentText = data.text;
                            var qfeat = window.CanvasFeatures && window.CanvasFeatures.quiz;
                            if (qfeat && typeof qfeat.updateQuizSourcePreview === 'function') qfeat.updateQuizSourcePreview(s.quiz);
                        } else if (data.error) s.quiz.error = data.error;
                    })
                    .catch(() => { if (s.quiz) s.quiz.error = 'Failed to extract text'; });
            },
            handleQuizPasteUse() {
                const s = store();
                const input = this.$refs.quizPasteInput;
                if (!s.quiz || !input) return;
                const text = (input.value || '').trim();
                if (!text) return;
                s.quiz.contentSource = 'paste';
                s.quiz.uploadedContentText = text;
                var qfeat = window.CanvasFeatures && window.CanvasFeatures.quiz;
                if (qfeat && typeof qfeat.updateQuizSourcePreview === 'function') qfeat.updateQuizSourcePreview(s.quiz);
                input.value = '';
            },
            handleQuizMouseUp(ev) {
                const s = store();
                if (!s.quiz || !s.quiz.quizId || s.quiz.loading) return;
                const sel = window.getSelection();
                if (!sel || !sel.toString().trim()) { s.quiz.selectionMenu = null; return; }
                s.quiz.selectionMenu = { text: sel.toString(), x: ev.clientX, y: ev.clientY };
            },
            async applyQuizSelectionAction(prompt) {
                const s = store();
                if (!s.quiz || !s.quiz.quizId || !s.quiz.selectionMenu || s.quiz.loading) return;
                const selectedText = s.quiz.selectionMenu.text;
                const pos = { x: s.quiz.selectionMenu.x, y: s.quiz.selectionMenu.y };
                s.quiz.selectionMenu = null;
                s.quiz.amendingAt = pos;
                s.quiz.loading = true;
                const url = quizAmendUrl.replace('__QUIZ_ID__', s.quiz.quizId);
                try {
                    const res = await fetch(url, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ prompt: prompt, selection_only: true, selected_text: selectedText }),
                        credentials: 'include'
                    });
                    const data = await res.json();
                    if (res.ok && data.quiz_content) {
                        s.quiz.content = data.quiz_content;
                        s.quiz.questions = normalizeCanvasQuizQuestionsFromServer(data.quiz_questions || []);
                    } else {
                        s.quiz.error = data.error || 'Amend failed';
                    }
                } catch (e) {
                    s.quiz.error = e.message || 'Request failed';
                }
                s.quiz.loading = false;
                s.quiz.amendingAt = null;
            }
        };
    });

    Alpine.data('ealLessonPanel', function() {
        const store = getCanvasStore;
        return {
            groupedNcYearsForWizard() {
                const s = store();
                const rows = s.canvasNcYearsList || [];
                const buckets = {};
                const order = [];
                rows.forEach(function(row) {
                    var y = (row && row.ncYear) || '';
                    if (!y) return;
                    var ksRaw = (row && row.keystage) && String(row.keystage).trim() ? String(row.keystage).trim() : 'Years';
                    if (!buckets[ksRaw]) { buckets[ksRaw] = []; order.push(ksRaw); }
                    if (buckets[ksRaw].indexOf(y) < 0) buckets[ksRaw].push(y);
                });
                if (order.length) return order.map(function(k) { return { keystage: k, years: buckets[k] }; });
                const flat = s.canvasYearsList || [];
                if (flat.length) return [{ keystage: 'Years', years: flat.slice() }];
                return [];
            },
            ealWizardRegGroupsForStep1() {
                const s = store();
                if (s.userRegistrationGroups && s.userRegistrationGroups.length > 1) return s.userRegistrationGroups;
                return s.registrationGroups || [];
            },
            async loadEalWizardStudents() {
                const s = store();
                const el = s.ealLesson;
                if (!el) return;
                const rg = (el.data.registration_group && String(el.data.registration_group).trim()) || '';
                if (!rg) {
                    el.ealStudents = [];
                    el.wizardStudentsError = '';
                    return;
                }
                el.wizardStudentsLoading = true;
                el.wizardStudentsError = '';
                try {
                    const base = (typeof ealStudentsByRegGroupUrl !== 'undefined' && ealStudentsByRegGroupUrl)
                        ? ealStudentsByRegGroupUrl
                        : ((typeof ealStudentsUrl !== 'undefined' && ealStudentsUrl) ? ealStudentsUrl : '/eal_interactive_lesson/students');
                    const url = base + '?registration_group=' + encodeURIComponent(rg);
                    const res = await fetch(url, { credentials: 'include' });
                    const data = await res.json().catch(function() { return {}; });
                    if (!res.ok) {
                        el.ealStudents = [];
                        el.wizardStudentsError = (data && data.error) || ('Request failed (' + res.status + ')');
                        return;
                    }
                    el.ealStudents = data.eal_students || [];
                    if (!el.ealStudents.length) {
                        el.wizardStudentsError = 'No EAL students found for this registration group.';
                    }
                } catch (e) {
                    el.ealStudents = [];
                    el.wizardStudentsError = (e && e.message) ? e.message : 'Network error';
                } finally {
                    el.wizardStudentsLoading = false;
                }
            },
            ealWizardNext() {
                const s = store();
                const el = s.ealLesson;
                if (!el || !el.wizardActive) return;
                el.wizardError = '';
                const st = el.wizardStep;
                if (st === 1) {
                    if (!(el.data.registration_group && String(el.data.registration_group).trim())) {
                        el.wizardError = 'Please select a registration group.';
                        return;
                    }
                    if (!(el.data.curriculum_year && String(el.data.curriculum_year).trim())) {
                        el.wizardError = 'Please select a curriculum year.';
                        return;
                    }
                    el.wizardStep = 2;
                    this.loadEalWizardStudents();
                    return;
                }
                if (st === 2) {
                    if (!(el.data.student_id && String(el.data.student_id).trim())) {
                        el.wizardError = 'Please select one EAL student.';
                        return;
                    }
                    el.wizardStep = 3;
                    return;
                }
                if (st === 3) {
                    if (!(el.data.subject && String(el.data.subject).trim())) {
                        el.wizardError = 'Please select a subject.';
                        return;
                    }
                    el.wizardStep = 4;
                    return;
                }
                if (st === 4) {
                    if (!(el.data.lesson_aims && String(el.data.lesson_aims).trim())) {
                        el.wizardError = 'Please enter lesson aims.';
                        return;
                    }
                    el.wizardStep = 5;
                }
            },
            ealWizardBack() {
                const s = store();
                const el = s.ealLesson;
                if (!el || !el.wizardActive || el.wizardStep <= 1) return;
                el.wizardError = '';
                el.wizardStep -= 1;
            },
            selectEalWizardStudent(studentId) {
                const s = store();
                const el = s.ealLesson;
                if (!el || !el.wizardActive) return;
                el.data.student_id = String(studentId || '').trim();
                el.wizardError = '';
            },
            lessonPlanWizardKeystage() {
                const s = store();
                const cy = (s.ealLesson && s.ealLesson.data && s.ealLesson.data.curriculum_year)
                    ? String(s.ealLesson.data.curriculum_year).trim() : '';
                if (!cy) return '';
                const rows = s.canvasNcYearsList || [];
                for (let i = 0; i < rows.length; i++) {
                    const row = rows[i];
                    var ny = (row && row.ncYear) ? String(row.ncYear).trim() : '';
                    if (ny === cy) {
                        return (row.keystage && String(row.keystage).trim()) || '';
                    }
                }
                return '';
            },
            undoEalWizardAimsEnhance() {
                const s = store();
                const el = s.ealLesson;
                if (!el || el.aimsBeforeEnhance == null) return;
                el.data.lesson_aims = el.aimsBeforeEnhance;
                el.aimsBeforeEnhance = null;
                el.enhanceAimsError = '';
            },
            async enhanceEalWizardAims() {
                const s = store();
                const el = s.ealLesson;
                if (!el || !el.wizardActive || !enhanceLessonPlanAimsUrl) return;
                const aims = (el.data.lesson_aims && String(el.data.lesson_aims).trim()) || '';
                if (!aims) {
                    el.enhanceAimsError = 'Add some lesson aims first.';
                    return;
                }
                const subj = (el.data.subject && String(el.data.subject).trim()) || '';
                const year = (el.data.curriculum_year && String(el.data.curriculum_year).trim()) || '';
                const regGroup = (el.data.registration_group && String(el.data.registration_group).trim()) || '';
                if (!subj || !year || !regGroup) {
                    el.enhanceAimsError = 'Select registration group, curriculum year, and subject first.';
                    return;
                }
                el.enhanceAimsError = '';
                el.enhanceAimsLoading = true;
                el.aimsBeforeEnhance = aims;
                const keystage = this.lessonPlanWizardKeystage();
                const style = (el.lessonAimsEnhanceStyle === 'concise') ? 'concise' : 'fuller';
                try {
                    const res = await fetch(enhanceLessonPlanAimsUrl, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        credentials: 'include',
                        body: JSON.stringify({
                            lesson_aims: aims,
                            subject: subj,
                            curriculum_year: year,
                            keystage: keystage,
                            registration_group: regGroup,
                            style: style
                        })
                    });
                    const data = await res.json().catch(function() { return {}; });
                    if (!res.ok) {
                        el.enhanceAimsError = (data && data.error) || ('Request failed (' + res.status + ')');
                        el.aimsBeforeEnhance = null;
                        return;
                    }
                    if (data.enhanced_aims) {
                        el.data.lesson_aims = data.enhanced_aims;
                    } else {
                        el.enhanceAimsError = 'No enhanced text returned.';
                        el.aimsBeforeEnhance = null;
                    }
                } catch (e) {
                    el.enhanceAimsError = (e && e.message) ? e.message : 'Network error';
                    el.aimsBeforeEnhance = null;
                } finally {
                    el.enhanceAimsLoading = false;
                }
            },
            async ealWizardSubmit() {
                const s = store();
                const el = s.ealLesson;
                if (!el || el.loading) return;
                el.wizardError = '';
                const d = el.data || {};
                d.lesson_type = (d.lesson_type === 'multipart') ? 'multipart' : 'single';
                d.content_source = (d.content_source === 'rag') ? 'rag' : 'llm';
                if (!(d.registration_group && String(d.registration_group).trim())) { el.wizardError = 'Please select a registration group.'; return; }
                if (!(d.curriculum_year && String(d.curriculum_year).trim())) { el.wizardError = 'Please select a curriculum year.'; return; }
                if (!(d.student_id && String(d.student_id).trim())) { el.wizardError = 'Please select one EAL student.'; return; }
                if (!(d.subject && String(d.subject).trim())) { el.wizardError = 'Please select a subject.'; return; }
                if (!(d.lesson_aims && String(d.lesson_aims).trim())) { el.wizardError = 'Please enter lesson aims.'; return; }
                if (d.lesson_type === 'multipart') {
                    if (!(d.lesson_name && String(d.lesson_name).trim())) {
                        el.wizardError = 'Please add a lesson name for the multi-part series.';
                        return;
                    }
                    const parts = String(d.topics_text || '').split(',').map(function(t) { return t.trim(); }).filter(Boolean);
                    if (parts.length < 2) {
                        el.wizardError = 'Please enter at least two comma-separated topics.';
                        return;
                    }
                    d.topics = parts;
                    d.topic_aims = parts.map(function() { return ''; });
                    d.topic = '';
                } else {
                    if (!(d.topic && String(d.topic).trim())) {
                        el.wizardError = 'Please enter a topic for this lesson.';
                        return;
                    }
                    d.topic = String(d.topic).trim();
                    d.topics = [];
                    d.topic_aims = [];
                    d.lesson_name = '';
                }
                el.wizardActive = false;
                el.step = 5;
                await submitEalCreateForStore(s);
            }
        };
    });

    Alpine.data('onlineLessonPanel', function() {
        const store = getCanvasStore;
        return {
            groupedNcYearsForWizard() {
                const s = store();
                const rows = s.canvasNcYearsList || [];
                const buckets = {};
                const order = [];
                rows.forEach(function(row) {
                    var y = (row && row.ncYear) || '';
                    if (!y) return;
                    var ksRaw = (row && row.keystage) && String(row.keystage).trim() ? String(row.keystage).trim() : 'Years';
                    if (!buckets[ksRaw]) {
                        buckets[ksRaw] = [];
                        order.push(ksRaw);
                    }
                    if (buckets[ksRaw].indexOf(y) < 0) buckets[ksRaw].push(y);
                });
                if (order.length) return order.map(function(k) { return { keystage: k, years: buckets[k] }; });
                const flat = s.canvasYearsList || [];
                if (flat.length) return [{ keystage: 'Years', years: flat.slice() }];
                return [];
            },
            onlineWizardRegGroupsForStep1() {
                const s = store();
                if (s.userRegistrationGroups && s.userRegistrationGroups.length > 1) return s.userRegistrationGroups;
                return s.registrationGroups || [];
            },
            onlineWizardNext() {
                const s = store();
                const el = s.onlineLesson;
                if (!el || !el.wizardActive) return;
                el.wizardError = '';
                const st = el.wizardStep;
                if (st === 1) {
                    if (!(el.data.registration_group && String(el.data.registration_group).trim())) {
                        el.wizardError = 'Please select a registration group.';
                        return;
                    }
                    if (!(el.data.curriculum_year && String(el.data.curriculum_year).trim())) {
                        el.wizardError = 'Please select a curriculum year.';
                        return;
                    }
                    el.wizardStep = 2;
                    return;
                }
                if (st === 2) {
                    if (!(el.data.subject && String(el.data.subject).trim())) {
                        el.wizardError = 'Please select a subject.';
                        return;
                    }
                    el.wizardStep = 3;
                    return;
                }
                if (st === 3) {
                    if (!(el.data.lesson_aims && String(el.data.lesson_aims).trim())) {
                        el.wizardError = 'Please enter lesson aims.';
                        return;
                    }
                    el.wizardStep = 4;
                }
            },
            onlineWizardBack() {
                const s = store();
                const el = s.onlineLesson;
                if (!el || !el.wizardActive || el.wizardStep <= 1) return;
                el.wizardError = '';
                el.wizardStep -= 1;
            },
            lessonPlanWizardKeystageOnline() {
                const s = store();
                var cy =
                    s.onlineLesson && s.onlineLesson.data && s.onlineLesson.data.curriculum_year
                        ? String(s.onlineLesson.data.curriculum_year).trim()
                        : '';
                if (!cy) return '';
                const rows = s.canvasNcYearsList || [];
                for (let i = 0; i < rows.length; i++) {
                    const row = rows[i];
                    var ny = (row && row.ncYear) ? String(row.ncYear).trim() : '';
                    if (ny === cy) {
                        return (row.keystage && String(row.keystage).trim()) || '';
                    }
                }
                return '';
            },
            undoOnlineWizardAimsEnhance() {
                const s = store();
                const el = s.onlineLesson;
                if (!el || el.aimsBeforeEnhance == null) return;
                el.data.lesson_aims = el.aimsBeforeEnhance;
                el.aimsBeforeEnhance = null;
                el.enhanceAimsError = '';
            },
            async enhanceOnlineWizardAims() {
                const s = store();
                const el = s.onlineLesson;
                if (!el || !el.wizardActive || !enhanceLessonPlanAimsUrl) return;
                const aims = (el.data.lesson_aims && String(el.data.lesson_aims).trim()) || '';
                if (!aims) {
                    el.enhanceAimsError = 'Add some lesson aims first.';
                    return;
                }
                const subj = (el.data.subject && String(el.data.subject).trim()) || '';
                const year = (el.data.curriculum_year && String(el.data.curriculum_year).trim()) || '';
                const regGroup = (el.data.registration_group && String(el.data.registration_group).trim()) || '';
                if (!subj || !year || !regGroup) {
                    el.enhanceAimsError = 'Select registration group, curriculum year, and subject first.';
                    return;
                }
                el.enhanceAimsError = '';
                el.enhanceAimsLoading = true;
                el.aimsBeforeEnhance = aims;
                const keystage = this.lessonPlanWizardKeystageOnline();
                const style = el.lessonAimsEnhanceStyle === 'concise' ? 'concise' : 'fuller';
                try {
                    const res = await fetch(enhanceLessonPlanAimsUrl, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        credentials: 'include',
                        body: JSON.stringify({
                            lesson_aims: aims,
                            subject: subj,
                            curriculum_year: year,
                            keystage: keystage,
                            registration_group: regGroup,
                            style: style
                        })
                    });
                    const data = await res.json().catch(function() { return {}; });
                    if (!res.ok) {
                        el.enhanceAimsError = (data && data.error) || ('Request failed (' + res.status + ')');
                        el.aimsBeforeEnhance = null;
                        return;
                    }
                    if (data.enhanced_aims) {
                        el.data.lesson_aims = data.enhanced_aims;
                    } else {
                        el.enhanceAimsError = 'No enhanced text returned.';
                        el.aimsBeforeEnhance = null;
                    }
                } catch (e) {
                    el.enhanceAimsError = (e && e.message) ? e.message : 'Network error';
                    el.aimsBeforeEnhance = null;
                } finally {
                    el.enhanceAimsLoading = false;
                }
            },
            async onlineWizardSubmit() {
                const s = store();
                const el = s.onlineLesson;
                if (!el || el.loading) return;
                el.wizardError = '';
                const d = el.data || {};
                d.lesson_type = d.lesson_type === 'multipart' ? 'multipart' : 'single';
                d.content_source = d.content_source === 'rag' ? 'rag' : 'llm';
                if (!(d.registration_group && String(d.registration_group).trim())) {
                    el.wizardError = 'Please select a registration group.';
                    return;
                }
                if (!(d.curriculum_year && String(d.curriculum_year).trim())) {
                    el.wizardError = 'Please select a curriculum year.';
                    return;
                }
                if (!(d.subject && String(d.subject).trim())) {
                    el.wizardError = 'Please select a subject.';
                    return;
                }
                if (!(d.lesson_aims && String(d.lesson_aims).trim())) {
                    el.wizardError = 'Please enter lesson aims.';
                    return;
                }
                if (d.lesson_type === 'multipart') {
                    if (!(d.lesson_name && String(d.lesson_name).trim())) {
                        el.wizardError = 'Please add a lesson name for the multi-part series.';
                        return;
                    }
                    const parts = String(d.topics_text || '')
                        .split(',')
                        .map(function(t) { return t.trim(); })
                        .filter(Boolean);
                    if (parts.length < 2) {
                        el.wizardError = 'Please enter at least two comma-separated topics.';
                        return;
                    }
                    d.topics = parts;
                    d.topic_aims = parts.map(function() { return ''; });
                    d.topic = '';
                } else {
                    if (!(d.topic && String(d.topic).trim())) {
                        el.wizardError = 'Please enter a topic for this lesson.';
                        return;
                    }
                    d.topic = String(d.topic).trim();
                    d.topics = [];
                    d.topic_aims = [];
                    d.lesson_name = '';
                }
                el.wizardActive = false;
                el.step = 4;
                await submitOnlineCreateForStore(s);
            }
        };
    });

    Alpine.data('imageCreatorPanel', function() {
        const store = getCanvasStore;
        return {
            enhanceImageCreatorPrompt() {
                const s = getCanvasStore();
                const prompt = (s.imageCreatorPrompt || '').trim();
                if (!prompt) return;
                const url = typeof imageCreatorEnhancePromptUrl !== 'undefined' && imageCreatorEnhancePromptUrl
                    ? imageCreatorEnhancePromptUrl
                    : '/image_creator/enhance_prompt';
                s.imageCreatorEnhancing = true;
                fetch(url, {
                    method: 'POST',
                    credentials: 'include',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        prompt: prompt,
                        style: s.imageCreatorStyle || 'Photorealistic',
                        size: s.imageCreatorSize || '512'
                    })
                })
                    .then(function(r) { return r.json().then(function(data) { return { ok: r.ok, data: data }; }); })
                    .then(function(res) {
                        s.imageCreatorEnhancing = false;
                        if (res.ok && res.data && res.data.enhanced_prompt) {
                            s.imageCreatorPrompt = res.data.enhanced_prompt;
                        } else {
                            window.alert((res.data && res.data.error) || 'Could not enhance prompt.');
                        }
                    })
                    .catch(function() {
                        s.imageCreatorEnhancing = false;
                        window.alert('Network error while enhancing prompt.');
                    });
            },
            generateImageCreator() {
                const s = getCanvasStore();
                const prompt = (s.imageCreatorPrompt || '').trim();
                if (!prompt) return;
                s.imageCreatorUsedPrompt = prompt;
                s.imageCreatorResult = null;
                s.imageCreatorLoading = true;
                const formData = new FormData();
                formData.append('prompt', prompt);
                formData.append('style', s.imageCreatorStyle || 'Photorealistic');
                formData.append('size', s.imageCreatorSize || '512');
                formData.append('model', s.imageCreatorModel || 'runware:400@2');
                fetch(imageCreatorSubmitUrl, { method: 'POST', body: formData, credentials: 'include' })
                    .then(res => res.json().then(data => ({ status: res.status, data })))
                    .then(({ status, data }) => {
                        if (status === 202 && data.task_id) {
                            s.imageCreatorTaskId = data.task_id;
                            this.pollImageCreatorResult(data.task_id);
                        } else {
                            s.imageCreatorLoading = false;
                            s.imageCreatorResult = { error: data.error || 'Failed to start image generation' };
                        }
                    })
                    .catch(e => {
                        s.imageCreatorLoading = false;
                        s.imageCreatorResult = { error: (e && e.data && e.data.error) || (e && e.message) || 'Network error' };
                    });
            },
            pollImageCreatorResult(taskId) {
                const s = getCanvasStore();
                fetch(imageCreatorResultBaseUrl + taskId, { credentials: 'include' })
                    .then(r => r.json())
                    .then(data => {
                        if (data.status === 'PENDING') {
                            setTimeout(() => this.pollImageCreatorResult(taskId), 1500);
                            return;
                        }
                        s.imageCreatorLoading = false;
                        if (data.status === 'SUCCESS' && data.image_url) {
                            s.imageCreatorResult = { image_url: data.image_url, prompt: s.imageCreatorUsedPrompt || '' };
                        }
                        else s.imageCreatorResult = { error: data.error || 'Image generation failed' };
                    })
                    .catch(() => {
                        s.imageCreatorLoading = false;
                        s.imageCreatorResult = { error: 'An error occurred while checking the result' };
                    });
            }
        };
    });

    Alpine.data('redstorBackupCard', function() {
        return {
            loading: false,
            hasLoaded: false,
            error: '',
            payload: null,
            rawJson: '',
            companySummaryRows() {
                var p = this.payload;
                if (!p || !p.summary || !Array.isArray(p.summary.companySummary)) return [];
                return p.summary.companySummary;
            },
            customerSummaryRows() {
                var p = this.payload;
                if (!p || !p.summary || !Array.isArray(p.summary.customerSummary)) return [];
                return p.summary.customerSummary;
            },
            /**
             * Redstor often reports unprovisioned OneDrive users as "completed with errors" for M365/GWS;
             * we hide that metric and exclude it from attention for these products only.
             */
            productNameIsGsuiteOrO365(row) {
                var raw = String((row && row.productName) || '').trim().toLowerCase();
                var compact = raw.replace(/\s+/g, '');
                if (compact.indexOf('gsuite') !== -1 || raw.indexOf('g suite') !== -1) return true;
                if (compact.indexOf('googleworkspace') !== -1) return true;
                if (compact.indexOf('o365') !== -1 || compact.indexOf('office365') !== -1) return true;
                if (compact.indexOf('microsoft365') !== -1 || raw.indexOf('office 365') !== -1) return true;
                return false;
            },
            showCompletedWithErrorsMetric(row) {
                return !this.productNameIsGsuiteOrO365(row);
            },
            isGoogleWorkspaceBackupProduct(row) {
                if (!row || typeof row !== 'object') return false;
                if (Number(row.productId) === 5) return true;
                var raw = String(row.productName || '').trim().toLowerCase();
                var compact = raw.replace(/\s+/g, '');
                return compact === 'gsuite' || raw.indexOf('g suite') !== -1 || compact.indexOf('googleworkspace') !== -1;
            },
            isMicrosoft365BackupProduct(row) {
                if (!row || typeof row !== 'object') return false;
                if (Number(row.productId) === 4) return true;
                var raw = String(row.productName || '').trim().toLowerCase();
                var compact = raw.replace(/\s+/g, '');
                return compact === 'o365' || compact.indexOf('office365') !== -1 || compact.indexOf('microsoft365') !== -1 || raw.indexOf('office 365') !== -1;
            },
            /** User-facing label; Redstor uses e.g. GSUITE / O365 — show as Google Workspace / Microsoft 365. */
            displayProductName(row, emptyFallback) {
                var fb = emptyFallback !== undefined ? emptyFallback : 'Product';
                var raw = String((row && row.productName) || '').trim();
                if (!raw) return fb;
                var lower = raw.toLowerCase();
                var compact = lower.replace(/\s+/g, '');
                if (compact === 'gsuite' || lower.indexOf('g suite') !== -1 || compact.indexOf('googleworkspace') !== -1) {
                    return 'Google Workspace';
                }
                if (compact === 'o365' || compact.indexOf('office365') !== -1 || compact.indexOf('microsoft365') !== -1 || lower.indexOf('office 365') !== -1) {
                    return 'Microsoft 365';
                }
                return raw;
            },
            /**
             * Card hero image: workspace.png / m365.png / server.png under /static/images/, else placeholder.
             */
            productCardImageSrc(row) {
                var ph = '/static/images/backup-product-placeholder.svg';
                if (!row || typeof row !== 'object') return ph;
                var base = '/static/images/';
                var id = row.productId;
                var byId = { 4: base + 'm365.png', 5: base + 'workspace.png', 130: base + 'server.png' };
                if (id != null && id !== '' && byId[id]) {
                    return byId[id];
                }
                var raw = String(row.productName || '').trim().toLowerCase();
                var compact = raw.replace(/\s+/g, '');
                if (compact === 'gsuite' || raw.indexOf('g suite') !== -1 || compact.indexOf('googleworkspace') !== -1) {
                    return base + 'workspace.png';
                }
                if (compact === 'o365' || compact.indexOf('office365') !== -1 || compact.indexOf('microsoft365') !== -1 || raw.indexOf('office 365') !== -1) {
                    return base + 'm365.png';
                }
                if (compact.indexOf('machine') !== -1) {
                    return base + 'server.png';
                }
                return ph;
            },
            productNeedsAttention(row) {
                if (!row || typeof row !== 'object') return false;
                var ignoreErr = this.productNameIsGsuiteOrO365(row);
                var err = ignoreErr ? 0 : (Number(row.completedWithErrors) || 0);
                var warn = Number(row.completedWithWarnings) || 0;
                var fail = Number(row.failed) || 0;
                var miss = Number(row.missed) || 0;
                return err + warn + fail + miss > 0;
            },
            customerRowLooksLikeProduct(row) {
                return !!(row && typeof row === 'object' && !Array.isArray(row) && ('productName' in row || 'productId' in row));
            },
            load() {
                const self = this;
                if (self.loading) return;
                const url = (typeof redstorBackupSummaryUrl !== 'undefined' && redstorBackupSummaryUrl)
                    ? redstorBackupSummaryUrl
                    : '/api/it_compliance/redstor_backup_summary';
                self.loading = true;
                self.error = '';
                self.payload = null;
                self.rawJson = '';
                fetch(url, { credentials: 'include' })
                    .then(function(r) {
                        return r.json().then(function(data) {
                            return { ok: r.ok, status: r.status, data: data };
                        });
                    })
                    .then(function(res) {
                        self.payload = res.data;
                        if (res.status === 403) {
                            var d = res.data && res.data.detail;
                            self.error = typeof d === 'string' ? d : (d ? JSON.stringify(d) : 'Access denied.');
                            return;
                        }
                        if (res.status === 401) {
                            self.error = 'Not signed in or session expired.';
                            return;
                        }
                        if (res.data && res.data.error) {
                            self.error = String(res.data.error) + (res.data.message ? (' — ' + res.data.message) : '');
                        }
                        if (res.data && res.data.summary !== undefined && res.data.summary !== null) {
                            try {
                                self.rawJson = JSON.stringify(res.data.summary, null, 2);
                            } catch (e) {
                                self.rawJson = String(res.data.summary);
                            }
                        } else if (res.data && res.data.configured === true && !res.data.error) {
                            try {
                                self.rawJson = JSON.stringify(res.data, null, 2);
                            } catch (e2) {
                                self.rawJson = '';
                            }
                        }
                    })
                    .catch(function() {
                        self.error = 'Network error or server unreachable.';
                    })
                    .finally(function() {
                        self.loading = false;
                        self.hasLoaded = true;
                    });
            }
        };
    });

    Alpine.data('cynetCyberCard', function() {
        return {
            loading: false,
            hasLoaded: false,
            error: '',
            payload: null,
            rawJson: '',
            sectionJson(key) {
                var d = this.payload && this.payload.data;
                if (!d || d[key] === undefined || d[key] === null) return '';
                try {
                    return JSON.stringify(d[key], null, 2);
                } catch (e) {
                    return String(d[key]);
                }
            },
            sectionError(key) {
                var d = this.payload && this.payload.data;
                if (!d || !d.errors) return '';
                return d.errors[key] || '';
            },
            load() {
                const self = this;
                if (self.loading) return;
                const url = (typeof cynetCyberStatusUrl !== 'undefined' && cynetCyberStatusUrl)
                    ? cynetCyberStatusUrl
                    : '/api/it_compliance/cynet_cyber_status';
                self.loading = true;
                self.error = '';
                self.payload = null;
                self.rawJson = '';
                fetch(url, { credentials: 'include' })
                    .then(function(r) {
                        return r.json().then(function(data) {
                            return { ok: r.ok, status: r.status, data: data };
                        });
                    })
                    .then(function(res) {
                        self.payload = res.data;
                        if (res.status === 403) {
                            var d = res.data && res.data.detail;
                            self.error = typeof d === 'string' ? d : (d ? JSON.stringify(d) : 'Access denied.');
                            return;
                        }
                        if (res.status === 401) {
                            self.error = 'Not signed in or session expired.';
                            return;
                        }
                        if (res.data && res.data.error) {
                            self.error = String(res.data.error) + (res.data.message ? (' — ' + res.data.message) : '');
                        }
                        if (res.data && res.data.data !== undefined && res.data.data !== null) {
                            try {
                                self.rawJson = JSON.stringify(res.data.data, null, 2);
                            } catch (e) {
                                self.rawJson = String(res.data.data);
                            }
                        } else if (res.data && res.data.configured === true && !res.data.error) {
                            try {
                                self.rawJson = JSON.stringify(res.data, null, 2);
                            } catch (e2) {
                                self.rawJson = '';
                            }
                        }
                    })
                    .catch(function() {
                        self.error = 'Network error or server unreachable.';
                    })
                    .finally(function() {
                        self.loading = false;
                        self.hasLoaded = true;
                    });
            }
        };
    });

    Alpine.data('emailDraftResponsesPanel', function() {
        return {
            emails: [],
            message: '',
            lookBackWeek: false,
            loading: false,
            load() {
                const self = this;
                self.loading = true;
                self.message = '';
                const url = (typeof emailReviewListUrl !== 'undefined' ? emailReviewListUrl : '/api/email_review_list') + '?look_back_week=' + (self.lookBackWeek ? 'true' : 'false');
                fetch(url, { credentials: 'include' })
                    .then(function(r) { return r.json(); })
                    .then(function(data) {
                        self.emails = data.emails || [];
                        self.message = data.message || '';
                    })
                    .catch(function() { self.emails = []; self.message = 'Failed to load emails.'; })
                    .finally(function() { self.loading = false; });
            }
        };
    });

    Alpine.data('emailPriorityPanel', function() {
        const analyzeUrl = priorityEmailAnalyzeUrl || '/api/email/priority/analyze';
        const confirmUrl = priorityEmailConfirmDraftUrl || '/api/email/priority/confirm_draft';
        const tsBase = (typeof taskStatusUrl !== 'undefined' && taskStatusUrl) ? taskStatusUrl.replace('/__TASK_ID__', '') : '/task_status';
        return {
            emails: [],
            message: '',
            loading: false,
            fetchError: '',
            analyze() {
                const self = this;
                self.loading = true;
                self.fetchError = '';
                self.message = '';
                self.emails = [];
                fetch(analyzeUrl, { method: 'POST', credentials: 'include', headers: { 'Content-Type': 'application/json' } })
                    .then(function(r) { return r.json(); })
                    .then(function(data) {
                        if (!data.task_id) {
                            self.fetchError = data.detail || data.message || 'Could not start analysis.';
                            self.loading = false;
                            return;
                        }
                        function poll(tid) {
                            fetch((tsBase + '/' + tid).replace('//', '/'), { credentials: 'include' })
                                .then(function(r) { return r.json(); })
                                .then(function(sdata) {
                                    if (sdata.state === 'SUCCESS' && sdata.result) {
                                        var res = sdata.result;
                                        if (res.status === 'error') {
                                            self.fetchError = res.message || 'Analysis failed.';
                                        } else {
                                            self.emails = res.emails || [];
                                            self.message = res.message || '';
                                        }
                                        self.loading = false;
                                    } else if (sdata.state === 'FAILURE') {
                                        self.fetchError = 'Task failed.';
                                        self.loading = false;
                                    } else {
                                        setTimeout(function() { poll(tid); }, 1500);
                                    }
                                })
                                .catch(function() {
                                    self.fetchError = 'Status polling failed.';
                                    self.loading = false;
                                });
                        }
                        poll(data.task_id);
                    })
                    .catch(function() {
                        self.fetchError = 'Network error.';
                        self.loading = false;
                    });
            },
            confirmDraft(em) {
                const self = this;
                var addr = (em.sender && em.sender.emailAddress && em.sender.emailAddress.address) || '';
                em.confirmStatus = '';
                fetch(confirmUrl, {
                    method: 'POST',
                    credentials: 'include',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        email_id: em.id,
                        content: em.suggested_reply || '',
                        sender_email: addr,
                        subject: em.subject || ''
                    })
                })
                    .then(function(r) { return r.json(); })
                    .then(function(data) {
                        em.confirmStatus = data.task_id ? 'Draft queued.' : (data.detail || 'Failed.');
                    })
                    .catch(function() { em.confirmStatus = 'Request failed.'; });
            },
            formatDate(iso) {
                if (!iso) return '';
                try { return new Date(iso).toLocaleString(undefined, { dateStyle: 'short', timeStyle: 'short' }); } catch (_) { return iso; }
            }
        };
    });

    Alpine.data('teamsMeetingsPanel', function() {
        const listUrl = teamsMeetingsListUrl || '/api/teams/meetings';
        const sumUrl = teamsMeetingsSummariseUrl || '/api/teams/meetings/summarise';
        const tsBase = (typeof taskStatusUrl !== 'undefined' && taskStatusUrl) ? taskStatusUrl.replace('/__TASK_ID__', '') : '/task_status';
        function sundayStartMsLocal() {
            var d = new Date();
            d.setHours(0, 0, 0, 0);
            d.setDate(d.getDate() - d.getDay());
            return d.getTime();
        }
        return {
            /** Midnight local time of the Sunday starting the visible week (matches Sun–Sat grid). */
            weekStartMs: sundayStartMsLocal(),
            meetings: [],
            loading: false,
            error: '',
            summarisingId: null,
            successMsg: '',
            requestSeq: 0,
            activeAbortController: null,
            weekMeetingsCache: {},
            weekRangeLabel() {
                var s = new Date(this.weekStartMs);
                var e = new Date(this.weekStartMs);
                e.setDate(e.getDate() + 6);
                var opts = { month: 'short', day: 'numeric' };
                var a = s.toLocaleDateString(undefined, opts);
                var b = e.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
                return a + ' – ' + b;
            },
            meetingDateKey(iso) {
                if (!iso) return 'unknown';
                try {
                    var text = String(iso).trim();
                    if (!/Z|[+-]\d{2}:\d{2}$/.test(text)) {
                        text = text.replace(/(\.\d{3})\d*/, '$1') + 'Z';
                    }
                    var d = new Date(text);
                    if (isNaN(d.getTime())) {
                        return (String(iso).split('T')[0] || 'unknown');
                    }
                    return (
                        d.getFullYear() +
                        '-' +
                        String(d.getMonth() + 1).padStart(2, '0') +
                        '-' +
                        String(d.getDate()).padStart(2, '0')
                    );
                } catch (_) {
                    return (String(iso).split('T')[0] || 'unknown');
                }
            },
            loadMeetings(forceRefresh) {
                const self = this;
                self.requestSeq += 1;
                const thisReq = self.requestSeq;
                self.loading = true;
                self.error = '';
                if (!forceRefresh) {
                    self.successMsg = '';
                }
                var start = new Date(self.weekStartMs);
                var end = new Date(self.weekStartMs);
                end.setDate(end.getDate() + 6);
                end.setHours(23, 59, 59, 999);
                var qs = '?start=' + encodeURIComponent(start.toISOString()) + '&end=' + encodeURIComponent(end.toISOString());
                if (!forceRefresh && self.weekMeetingsCache[qs]) {
                    self.meetings = self.weekMeetingsCache[qs];
                    self.loading = false;
                    return;
                }
                if (forceRefresh) {
                    delete self.weekMeetingsCache[qs];
                }
                if (self.activeAbortController) {
                    try { self.activeAbortController.abort(); } catch (_) {}
                }
                var controller = new AbortController();
                self.activeAbortController = controller;
                var timeoutId = setTimeout(function() { controller.abort(); }, 30000);
                fetch(listUrl + qs, { credentials: 'include', signal: controller.signal })
                    .then(function(r) {
                        if (!r.ok) {
                            return r.json().catch(function() { return {}; }).then(function(data) {
                                var detail = (data && (data.detail || data.error)) || ('HTTP ' + r.status);
                                throw new Error(typeof detail === 'string' ? detail : JSON.stringify(detail));
                            });
                        }
                        return r.json();
                    })
                    .then(function(data) {
                        if (thisReq !== self.requestSeq) return;
                        if (!data || !Array.isArray(data.meetings)) {
                            throw new Error('Invalid meetings response.');
                        }
                        self.meetings = data.meetings || [];
                        self.weekMeetingsCache[qs] = self.meetings;
                    })
                    .catch(function(err) {
                        if (thisReq !== self.requestSeq) return;
                        self.error = (err && err.name === 'AbortError')
                            ? 'Loading meetings timed out. Please try again.'
                            : ((err && err.message) || 'Failed to load meetings.');
                        self.meetings = [];
                    })
                    .finally(function() {
                        if (thisReq !== self.requestSeq) return;
                        clearTimeout(timeoutId);
                        self.activeAbortController = null;
                        self.loading = false;
                    });
            },
            prevWeek() {
                this.weekStartMs -= 7 * 86400000;
                this.loadMeetings();
            },
            nextWeek() {
                this.weekStartMs += 7 * 86400000;
                this.loadMeetings();
            },
            byDay() {
                var m = {};
                var self = this;
                (this.meetings || []).forEach(function(mt) {
                    var d = self.meetingDateKey(mt.start);
                    if (!m[d]) m[d] = [];
                    m[d].push(mt);
                });
                return m;
            },
            dayKeys() {
                return Object.keys(this.byDay()).sort();
            },
            dayMeetings(day) {
                return this.byDay()[day] || [];
            },
            calendarWeeks() {
                var bd = this.byDay();
                var row = [];
                for (var i = 0; i < 7; i++) {
                    var d = new Date(this.weekStartMs);
                    d.setDate(d.getDate() + i);
                    var y = d.getFullYear();
                    var mo = d.getMonth();
                    var dayNum = d.getDate();
                    var dk =
                        y +
                        '-' +
                        String(mo + 1).padStart(2, '0') +
                        '-' +
                        String(dayNum).padStart(2, '0');
                    row.push({
                        inWeek: true,
                        dayNum: dayNum,
                        dateKey: dk,
                        count: (bd[dk] || []).length
                    });
                }
                return [row];
            },
            formatTime(iso) {
                if (!iso) return '';
                try {
                    var text = String(iso).trim();
                    if (!/Z|[+-]\d{2}:\d{2}$/.test(text)) {
                        text = text.replace(/(\.\d{3})\d*/, '$1') + 'Z';
                    }
                    var d = new Date(text);
                    if (isNaN(d.getTime())) {
                        var t = text.split('T')[1] || '';
                        return t ? t.slice(0, 5) : '';
                    }
                    return d.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit', hour12: false });
                } catch (_) {
                    return '';
                }
            },
            formatWhenDisplay(startIso, endIso) {
                if (!startIso) return '';
                try {
                    var sd = String(startIso || '').split('T')[0] || '';
                    var st = this.formatTime(startIso);
                    var et = this.formatTime(endIso);
                    var sDate = new Date(sd + 'T00:00:00');
                    var dTxt = isNaN(sDate.getTime()) ? sd : sDate.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
                    if (!et) return dTxt + ' ' + st;
                    return dTxt + ' ' + st + ' - ' + et;
                } catch (_) {
                    return '';
                }
            },
            summarise(mt) {
                const self = this;
                if (!mt.hasTranscript || !mt.onlineMeetingId) return;
                self.summarisingId = mt.onlineMeetingId;
                self.successMsg = '';
                self.error = '';
                fetch(sumUrl, {
                    method: 'POST',
                    credentials: 'include',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        online_meeting_id: mt.onlineMeetingId,
                        meeting_subject: mt.subject || '',
                        meeting_start: mt.start || '',
                        meeting_end: mt.end || '',
                        meeting_when_display: self.formatWhenDisplay(mt.start, mt.end)
                    })
                })
                    .then(function(r) { return r.json(); })
                    .then(function(data) {
                        if (!data.task_id) {
                            self.error = data.detail || 'Could not start.';
                            self.summarisingId = null;
                            return;
                        }
                        function poll(tid) {
                            fetch((tsBase + '/' + tid).replace('//', '/'), { credentials: 'include' })
                                .then(function(r) { return r.json(); })
                                .then(function(sdata) {
                                    if (sdata.state === 'SUCCESS' && sdata.result) {
                                        var res = sdata.result;
                                        if (res.status === 'error') {
                                            self.error = res.message || 'Failed.';
                                        } else {
                                            self.successMsg = res.message || 'Done.';
                                        }
                                        self.summarisingId = null;
                                    } else if (sdata.state === 'FAILURE') {
                                        self.error = 'Task failed.';
                                        self.summarisingId = null;
                                    } else {
                                        setTimeout(function() { poll(tid); }, 1500);
                                    }
                                })
                                .catch(function() {
                                    self.error = 'Polling failed.';
                                    self.summarisingId = null;
                                });
                        }
                        poll(data.task_id);
                    })
                    .catch(function() {
                        self.error = 'Request failed.';
                        self.summarisingId = null;
                    });
            },
            init() {
                this.loadMeetings(true);
            }
        };
    });

    var CATEGORY_ORDER_EMAIL = ['high_priority_response_needed', 'high_priority_information', 'medium_priority', 'low_priority', 'probably_sales_spam', 'pointless_slop'];

    Alpine.data('emailManageTodaysPanel', function() {
        const fetchUrl = typeof manageTodaysEmailFetchUrl !== 'undefined' ? manageTodaysEmailFetchUrl : '/manage_todays_email/fetch';
        const applyUrl = typeof manageTodaysEmailApplyUrl !== 'undefined' ? manageTodaysEmailApplyUrl : '/manage_todays_email/apply';
        const taskStatusBase = (typeof taskStatusUrl !== 'undefined' && taskStatusUrl) ? taskStatusUrl.replace('/__TASK_ID__', '') : '/task_status';
        return {
            categoryOrder: CATEGORY_ORDER_EMAIL,
            categoryLabels: {},
            emailsById: {},
            classifications: {},
            currentTab: CATEGORY_ORDER_EMAIL[0],
            tabsShown: false,
            emptyMessage: '',
            fetching: false,
            fetchError: '',
            applyMessage: '',
            applySuccess: false,
            createDraftsForResponseNeeded: false,
            draftTaskPolling: false,
            get byCategory() {
                const by = {};
                CATEGORY_ORDER_EMAIL.forEach(function(k) { by[k] = []; });
                Object.keys(this.classifications).forEach(function(emailId) {
                    const cat = this.classifications[emailId];
                    if (by[cat] && this.emailsById[emailId]) by[cat].push(emailId);
                }.bind(this));
                return by;
            },
            formatDate(iso) {
                if (!iso) return '';
                try { return new Date(iso).toLocaleString(undefined, { dateStyle: 'short', timeStyle: 'short' }); } catch (_) { return iso; }
            },
            init() {
                const self = this;
                fetch(typeof emailCategoryLabelsUrl !== 'undefined' ? emailCategoryLabelsUrl : '/api/email_category_labels', { credentials: 'include' })
                    .then(function(r) { return r.json(); })
                    .then(function(data) { self.categoryLabels = data || {}; })
                    .catch(function() {});
            },
            moveEmail(emailId, toCategory) {
                if (toCategory) this.classifications[emailId] = toCategory;
            },
            fetchAndCategorise() {
                const self = this;
                self.fetchError = '';
                self.fetching = true;
                self.tabsShown = false;
                self.emptyMessage = '';
                fetch(fetchUrl, { method: 'POST', headers: { 'Content-Type': 'application/json' }, credentials: 'include' })
                    .then(function(r) { return r.json(); })
                    .then(function(data) {
                        if (data.emails && data.emails.length === 0) {
                            self.emptyMessage = data.message || 'No unread emails today.';
                            self.fetching = false;
                            return;
                        }
                        if (!data.task_id) {
                            self.fetchError = data.detail || data.error || 'Failed to start categorisation.';
                            self.fetching = false;
                            return;
                        }
                        const taskId = data.task_id;
                        function poll() {
                            fetch((taskStatusBase + '/' + taskId).replace('//', '/'), { credentials: 'include' })
                                .then(function(r) { return r.json(); })
                                .then(function(sdata) {
                                    if (sdata.state === 'SUCCESS' && sdata.result) {
                                        const r = sdata.result;
                                        if (r.status === 'error') {
                                            self.fetchError = r.message || 'Classification failed.';
                                        } else if (r.status === 'success') {
                                            self.emailsById = {};
                                            (r.emails || []).forEach(function(em) { self.emailsById[em.id] = em; });
                                            self.classifications = r.classifications || {};
                                            self.tabsShown = true;
                                        } else {
                                            self.fetchError = 'Unexpected result from server.';
                                        }
                                        self.fetching = false;
                                    } else if (sdata.state === 'FAILURE') {
                                        self.fetchError = sdata.error || sdata.status || 'Task failed.';
                                        self.fetching = false;
                                    } else {
                                        setTimeout(poll, 1500);
                                    }
                                })
                                .catch(function() { self.fetchError = 'Network error.'; self.fetching = false; });
                        }
                        poll();
                    })
                    .catch(function(err) { self.fetchError = err.message || 'Network error.'; self.fetching = false; });
            },
            applyMoves() {
                const self = this;
                const moves = Object.keys(this.classifications).map(function(emailId) { return { email_id: emailId, category: self.classifications[emailId] }; });
                if (!moves.length) {
                    self.applyMessage = 'No emails to move.';
                    self.applySuccess = false;
                    return;
                }
                self.applyMessage = '';
                self.draftTaskPolling = false;
                const body = {
                    moves: moves,
                    create_drafts_for_high_priority_response_needed: !!self.createDraftsForResponseNeeded
                };
                fetch(applyUrl, { method: 'POST', headers: { 'Content-Type': 'application/json' }, credentials: 'include', body: JSON.stringify(body) })
                    .then(function(r) { return r.json(); })
                    .then(function(data) {
                        if (data.success) {
                            self.applyMessage = 'Moved ' + (data.moved || 0) + ' email(s) to folders.' + (data.failed && data.failed.length ? ' Some failed: ' + data.failed.length : '');
                            self.applySuccess = true;
                            if ((data.moved || 0) > 0) {
                                const failedIds = (data.failed || []).map(function(f) { return f.email_id; });
                                Object.keys(self.classifications).forEach(function(id) {
                                    if (failedIds.indexOf(id) >= 0) return;
                                    delete self.emailsById[id];
                                    delete self.classifications[id];
                                });
                            }
                            if (data.draft_task_id && (data.drafts_queued || 0) > 0) {
                                self.applyMessage += ' AI is creating reply drafts for ' + (data.drafts_queued || 0) + ' message(s) in High Priority - Response Needed…';
                                self.pollDraftTask(data.draft_task_id);
                            }
                        } else {
                            self.applyMessage = data.detail || data.error || 'Failed to move emails.';
                            self.applySuccess = false;
                        }
                    })
                    .catch(function(err) { self.applyMessage = err.message || 'Network error.'; self.applySuccess = false; });
            },
            pollDraftTask(taskId) {
                const self = this;
                self.draftTaskPolling = true;
                function poll() {
                    fetch((taskStatusBase + '/' + taskId).replace('//', '/'), { credentials: 'include' })
                        .then(function(r) { return r.json(); })
                        .then(function(sdata) {
                            if (sdata.state === 'SUCCESS' && sdata.result) {
                                self.draftTaskPolling = false;
                                const res = sdata.result;
                                if (res.status === 'error' && res.message) {
                                    self.applyMessage += ' Draft step: ' + res.message;
                                } else if (res.status === 'success' && typeof res.created === 'number') {
                                    self.applyMessage += ' Drafts: ' + res.created + ' created in Outlook.';
                                    if (res.failed && res.failed.length) {
                                        self.applyMessage += ' ' + res.failed.length + ' could not be drafted.';
                                    }
                                } else if (res.message) {
                                    self.applyMessage += ' Draft step: ' + res.message;
                                }
                            } else if (sdata.state === 'FAILURE') {
                                self.draftTaskPolling = false;
                                self.applyMessage += ' Draft task failed.';
                            } else {
                                setTimeout(poll, 2000);
                            }
                        })
                        .catch(function() { self.draftTaskPolling = false; });
                }
                poll();
            }
        };
    });

    Alpine.data('emailDraftChatPanel', function() {
        const stateUrl = typeof emailDraftChatStateUrl !== 'undefined' ? emailDraftChatStateUrl : '/api/email_draft_chat_state';
        const postUrl = typeof emailDraftChatPostUrl !== 'undefined' ? emailDraftChatPostUrl : '/email_draft_chat';
        const draftUrl = typeof createOutlookDraftFromChatUrl !== 'undefined' ? createOutlookDraftFromChatUrl : '/create_outlook_draft_from_chat';
        const taskBase = (typeof taskStatusUrl !== 'undefined' && taskStatusUrl) ? taskStatusUrl.replace('/__TASK_ID__', '') : '/task_status';
        const resetUrl = resetConversationalChatUrl;
        return {
            emailContext: null,
            aiModel: (typeof aiModelsList !== 'undefined' && aiModelsList && aiModelsList[0]) ? aiModelsList[0].id : 'gemini-2.5-flash',
            userMessage: '',
            chatError: '',
            messages: [],
            loadingDraft: false,
            conversationalChatId: null,
            initialTaskId: null,
            get canCreateDraft() {
                const last = this.messages.slice().reverse().find(function(m) { return m.role === 'assistant'; });
                return !!(last && (last.content || last.contentHtml));
            },
            init() {
                const self = this;
                fetch(stateUrl, { credentials: 'include' })
                    .then(function(r) { return r.json(); })
                    .then(function(data) {
                        self.emailContext = data.email_draft_context || null;
                        self.conversationalChatId = data.conversational_chat_id || null;
                        self.initialTaskId = data.initial_task_id || null;
                        if (self.initialTaskId) self.pollTask(self.initialTaskId, function(result) {
                            const html = result && result.html_content;
                            if (html) {
                                self.messages.push({ role: 'assistant', content: html, contentHtml: (typeof marked !== 'undefined' ? marked.parse(html) : html) });
                            }
                        });
                    })
                    .catch(function() {});
            },
            pollTask(taskId, onSuccess) {
                const self = this;
                self.loadingDraft = true;
                function poll() {
                    fetch((taskBase + '/' + taskId).replace('//', '/'), { credentials: 'include' })
                        .then(function(r) { return r.json(); })
                        .then(function(sdata) {
                            if (sdata.state === 'SUCCESS') {
                                self.loadingDraft = false;
                                if (onSuccess && sdata.result) onSuccess(sdata.result);
                            } else if (sdata.state === 'FAILURE') {
                                self.loadingDraft = false;
                                self.chatError = sdata.error || 'Task failed.';
                            } else {
                                setTimeout(poll, 2000);
                            }
                        })
                        .catch(function() { self.loadingDraft = false; });
                }
                poll();
            },
            sendMessage() {
                const self = this;
                const msg = (this.userMessage || '').trim();
                if (!msg || !this.conversationalChatId) return;
                this.messages.push({ role: 'user', content: msg });
                this.userMessage = '';
                this.chatError = '';
                this.loadingDraft = true;
                fetch(postUrl, { method: 'POST', headers: { 'Content-Type': 'application/json' }, credentials: 'include', body: JSON.stringify({ message: msg, ai_model: this.aiModel }) })
                    .then(function(r) { return r.json(); })
                    .then(function(data) {
                        if (data.task_id) self.pollTask(data.task_id, function(result) {
                            const html = result && result.html_content;
                            if (html) self.messages.push({ role: 'assistant', content: html, contentHtml: (typeof marked !== 'undefined' ? marked.parse(html) : html) });
                        });
                    })
                    .catch(function(err) { self.chatError = err.message || 'Send failed.'; self.loadingDraft = false; });
            },
            createOutlookDraft() {
                const self = this;
                const last = this.messages.slice().reverse().find(function(m) { return m.role === 'assistant'; });
                const content = (last && (last.content || last.contentHtml || '')).replace(/\n/g, '<br>');
                if (!content) return;
                this.chatError = '';
                fetch(draftUrl, { method: 'POST', headers: { 'Content-Type': 'application/json' }, credentials: 'include', body: JSON.stringify({ content: content }) })
                    .then(function(r) { return r.json(); })
                    .then(function(data) {
                        if (data.task_id) {
                            self.pollTask(data.task_id, function() {
                                if (typeof window.alert === 'function') window.alert('Outlook draft creation task started. Check your Outlook drafts.');
                            });
                        }
                    })
                    .catch(function(err) { self.chatError = err.message || 'Failed to create draft.'; });
            },
            startOver() {
                const store = getCanvasStore();
                fetch(resetUrl, { method: 'POST', credentials: 'include' })
                    .then(function() {
                        store.emailSubMode = 'manage_todays';
                        try { var u = new URL(window.location.href); u.searchParams.delete('email_panel'); history.replaceState(null, '', u.toString()); } catch (e) {}
                    })
                    .catch(function() {});
            }
        };
    });

    Alpine.data('studentPasswordsPanel', function() {
        const store = getCanvasStore();
        const taskBase = (typeof taskStatusUrl !== 'undefined' && taskStatusUrl) ? taskStatusUrl.replace('/__TASK_ID__', '') : '/task_status';
        return {
            recipientEmail: '',
            emailSending: false,
            senForm: { areas_of_need: '', strengths: '', challenges: '', key_supports: '', motivators: '' },
            ealForm: { home_language: '', eal_status: '' },
            filteredStudentPasswordsStudents() {
                const sp = store.studentPasswords;
                if (!sp || !sp.students) return [];
                return sp.students;
            },
            openSenModal(student) {
                if (!store.studentPasswords.senListExists) {
                    alert('SEN SharePoint list has not been created yet. Please contact your school administrator to create the SEN SharePoint list in System Administration before adding SEN details to students.');
                    return;
                }
                store.studentPasswords.senModalStudent = student;
                this.senForm = {
                    areas_of_need: student.sen_areas_of_need || '',
                    strengths: student.sen_strengths || '',
                    challenges: student.sen_challenges || '',
                    key_supports: student.sen_key_supports || '',
                    motivators: student.sen_motivators || ''
                };
            },
            openEalModal(student) {
                store.studentPasswords.ealModalStudent = student;
                this.ealForm = {
                    home_language: student.home_language || '',
                    eal_status: student.eal_status_value || student.eal_status || ''
                };
            },
            submitSenProfile() {
                const student = store.studentPasswords.senModalStudent;
                if (!student) return;
                const self = this;
                fetch('/update_student_sen_profile', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    credentials: 'include',
                    body: JSON.stringify({
                        student_id: student.id,
                        areas_of_need: this.senForm.areas_of_need,
                        strengths: this.senForm.strengths,
                        challenges: this.senForm.challenges,
                        key_supports: this.senForm.key_supports,
                        motivators: this.senForm.motivators
                    })
                }).then(function(r) { return r.json(); }).then(function(data) {
                    store.studentPasswords.senModalStudent = null;
                    store.fetchStudentPasswordsContext(store.studentPasswords.selectedGroup);
                }).catch(function() {
                    alert('Failed to save SEN profile.');
                });
            },
            deleteSenProfile(student) {
                if (!confirm('Delete SEN profile for ' + (student.firstname || '') + ' ' + (student.lastname || '') + '?')) return;
                const self = this;
                fetch('/delete_student_sen_profile', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    credentials: 'include',
                    body: JSON.stringify({ student_id: student.id })
                }).then(function(r) { return r.json(); }).then(function() {
                    store.fetchStudentPasswordsContext(store.studentPasswords.selectedGroup);
                }).catch(function() { alert('Failed to delete.'); });
            },
            submitEalProfile() {
                const student = store.studentPasswords.ealModalStudent;
                if (!student) return;
                const self = this;
                fetch('/update_student_eal_profile', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    credentials: 'include',
                    body: JSON.stringify({
                        student_id: student.id,
                        home_language: this.ealForm.home_language,
                        eal_status: this.ealForm.eal_status
                    })
                }).then(function(r) { return r.json(); }).then(function() {
                    store.studentPasswords.ealModalStudent = null;
                    store.fetchStudentPasswordsContext(store.studentPasswords.selectedGroup);
                }).catch(function() {
                    alert('Failed to save EAL profile.');
                });
            },
            deleteEalProfile(student) {
                if (!confirm('Delete EAL profile for ' + (student.firstname || '') + ' ' + (student.lastname || '') + '?')) return;
                fetch('/delete_student_eal_profile', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    credentials: 'include',
                    body: JSON.stringify({ student_id: student.id })
                }).then(function(r) { return r.json(); }).then(function() {
                    store.fetchStudentPasswordsContext(store.studentPasswords.selectedGroup);
                }).catch(function() { alert('Failed to delete.'); });
            },
            sendEmailList() {
                const sp = store.studentPasswords;
                const recipient = (this.recipientEmail || '').trim();
                if (!recipient) {
                    sp.emailStatus = 'Please enter a recipient email address.';
                    return;
                }
                const selectedGroup = (sp.selectedGroup || '');
                sp.emailStatus = '';
                this.emailSending = true;
                sp.emailTaskId = 'pending';
                const self = this;
                fetch(emailStudentPasswordsUrl, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    credentials: 'include',
                    body: JSON.stringify({ recipient_email: recipient, registration_group: selectedGroup })
                }).then(function(r) { return r.json(); }).then(function(data) {
                    const taskId = (data && data.task_id) ? data.task_id : null;
                    if (!taskId) {
                        self.emailSending = false;
                        sp.emailTaskId = null;
                        sp.emailStatus = 'Error: ' + (data && data.error ? data.error : 'No task ID returned.');
                        return;
                    }
                    sp.emailTaskId = taskId;
                    function poll() {
                        fetch((taskBase + '/' + taskId).replace('//', '/'), { credentials: 'include' })
                            .then(function(r) { return r.json(); })
                            .then(function(sdata) {
                                if (sdata.state === 'SUCCESS') {
                                    self.emailSending = false;
                                    sp.emailTaskId = null;
                                    sp.emailStatus = (sdata.result && sdata.result.message) ? sdata.result.message : 'Email sent successfully.';
                                } else if (sdata.state === 'FAILURE') {
                                    self.emailSending = false;
                                    sp.emailTaskId = null;
                                    sp.emailStatus = 'Email task failed: ' + (sdata.error || sdata.result || 'Unknown error');
                                } else {
                                    setTimeout(poll, 2000);
                                }
                            })
                            .catch(function() {
                                self.emailSending = false;
                                sp.emailTaskId = null;
                                sp.emailStatus = 'Failed to check task status.';
                            });
                    }
                    poll();
                }).catch(function(err) {
                    self.emailSending = false;
                    sp.emailTaskId = null;
                    sp.emailStatus = 'Error: ' + (err.message || 'Request failed.');
                });
            },
            accountInfoHtml() {
                const sp = store.studentPasswords;
                const apiSource = (sp.apiSource || '').toLowerCase();
                const dirType = (sp.directoryType || '').toLowerCase();
                let apiLabel = sp.apiSource || 'Not configured';
                if (apiSource === 'arbor') apiLabel = 'Arbor';
                else if (apiSource === 'scholarpack') apiLabel = 'ScholarPack';
                else if (apiSource === 'sims') apiLabel = 'SIMS';
                var html = '<div><h3 class="text-base font-semibold text-blue-700 dark:text-blue-300 mb-2">Where Your Student Data Comes From</h3><p class="mb-3 text-app-fg">Your school\'s student data is automatically synced from your Management Information System (MIS):</p><div class="bg-blue-50 dark:bg-blue-950/40 border-l-4 border-blue-400 dark:border-blue-600 p-4"><p class="font-semibold text-blue-900 dark:text-blue-100">' + apiLabel + '</p></div><p class="text-sm text-app-fg-muted mt-2">Student information (names, registration groups, etc.) is regularly updated from your MIS to ensure accuracy.</p></div>';
                html += '<div><h3 class="text-base font-semibold text-blue-700 dark:text-blue-300 mb-2">How Student Accounts Are Created</h3>';
                if (dirType === 'cloud') {
                    html += '<div class="bg-orange-50 dark:bg-orange-950/35 border-l-4 border-orange-400 dark:border-orange-600 p-4"><p class="font-semibold text-orange-900 dark:text-orange-100 mb-2">Cloud School - Direct Entra Creation</p><p class="text-sm mb-2 text-app-fg">Your school uses cloud-based account management. Student accounts are created directly into Microsoft Entra (formerly Azure AD) in real-time.</p><ul class="text-sm list-disc list-inside space-y-1 text-app-fg"><li>Accounts are created immediately when student data is synced</li><li>No overnight processing required</li><li>Students can access their accounts as soon as they appear in the system</li></ul></div>';
                } else if (dirType === 'local') {
                    html += '<div class="bg-yellow-50 dark:bg-yellow-950/30 border-l-4 border-yellow-400 dark:border-yellow-600 p-4"><p class="font-semibold text-yellow-900 dark:text-yellow-100 mb-2">Local School - Overnight Processing</p><p class="text-sm mb-2 text-app-fg">Your school uses local server-based account management. Student accounts are created through an overnight process.</p><ul class="text-sm list-disc list-inside space-y-1 text-app-fg"><li>Student data is synced from your MIS during the day</li><li>An overnight process transfers student account information to your local server</li><li>Accounts are then created in Microsoft Entra (formerly Azure AD) overnight</li><li>New accounts typically appear the next morning</li></ul></div>';
                } else {
                    html += '<div class="bg-app-page dark:bg-white/5 border-l-4 border-app-border p-4"><p class="font-semibold text-app-fg mb-2">Account Creation Process</p><p class="text-sm text-app-fg-muted">Your school\'s account creation method is being configured. Please contact your administrator for details about when student accounts will be available.</p></div>';
                }
                html += '</div><div class="bg-yellow-50 dark:bg-yellow-950/25 border border-yellow-200 dark:border-yellow-800 rounded p-4 mt-4"><p class="text-sm text-yellow-800 dark:text-yellow-200"><strong>Note:</strong> If you notice any discrepancies in student account information, please contact your school administrator.</p></div>';
                return html;
            }
        };
    });

    Alpine.data('staffManagementPanel', function() {
        const store = getCanvasStore();
        const getDetailsUrl = typeof staffManagementGetStaffDetailsUrl !== 'undefined' ? staffManagementGetStaffDetailsUrl : '/staff_management/get_staff_details';
        const requestUserUrl = typeof staffManagementRequestUserUrl !== 'undefined' ? staffManagementRequestUserUrl : '/staff_management/request_user';
        const updateDetailsUrl = typeof staffManagementUpdateStaffDetailsUrl !== 'undefined' ? staffManagementUpdateStaffDetailsUrl : '/staff_management/update_staff_details';
        const requestDisableUrl = typeof staffManagementRequestAccountDisableUrl !== 'undefined' ? staffManagementRequestAccountDisableUrl : '/staff_management/request_account_disable';
        const toggleAdminUrl = typeof staffManagementToggleAdminUrl !== 'undefined' ? staffManagementToggleAdminUrl : '/staff_management/toggle_admin';
        const bulkJobTitlesUrl = typeof staffManagementBulkJobTitlesUrl !== 'undefined' ? staffManagementBulkJobTitlesUrl : '/staff_management/bulk_update_job_titles';
        const bulkRegGroupsUrl = typeof staffManagementBulkRegistrationGroupsUrl !== 'undefined' ? staffManagementBulkRegistrationGroupsUrl : '/staff_management/bulk_update_registration_groups';
        const bulkYearsUrl = typeof staffManagementBulkYearsUrl !== 'undefined' ? staffManagementBulkYearsUrl : '/staff_management/bulk_update_years';
        const bulkSubjectAreasUrl = typeof staffManagementBulkSubjectAreasUrl !== 'undefined' ? staffManagementBulkSubjectAreasUrl : '/staff_management/bulk_update_subject_areas';
        const taskStatusBase = typeof taskStatusUrlBase !== 'undefined' ? taskStatusUrlBase : '/task_status/';
        var bulkPollInterval = null;
        return {
            requestUserForm: { firstname: '', lastname: '', job_titles: [], registration_groups: [], years: [], subject_areas: [], uses_laptop_over_hour: false },
            requestUserMessage: '',
            detailsForm: { job_titles: [], registration_groups: [], years: [], subject_areas: [], uses_laptop_over_hour: false, atom_contact: false },
            detailsLoading: false,
            detailsMessage: '',
            detailsModalStaffName: '',
            gridEdits: {},
            gridRowFeedback: {},
            gridSaveAllMessage: '',
            bulkJobTitlesSelectedStaff: [],
            bulkJobTitlesSelected: [],
            bulkLaptopUsage: '',
            bulkRegGroupsSelectedStaff: [],
            bulkRegGroupsSelected: [],
            bulkYearsSelectedStaff: [],
            bulkYearsSelected: [],
            bulkSubjectAreasSelectedStaff: [],
            bulkSubjectAreasSelected: [],
            getGridRow(s) {
                const id = String(s.id);
                if (!this.gridEdits[id]) {
                    this.gridEdits[id] = {
                        job_titles: ['Staff'],
                        registration_groups: [],
                        years: [],
                        subject_areas: [],
                        uses_laptop_over_hour: false,
                        atom_contact: false
                    };
                }
                return this.gridEdits[id];
            },
            selectableJobTitleOptions() {
                var o = (store.staffManagement && store.staffManagement.jobTitleOptions) ? store.staffManagement.jobTitleOptions : [];
                return o.filter(function(t) { return String(t).toLowerCase() !== 'staff'; });
            },
            ensureStaffInGridJobTitles(row) {
                if (!row || !row.job_titles) return;
                var jt = row.job_titles;
                var has = jt.some(function(t) { return String(t).toLowerCase() === 'staff'; });
                if (!has) row.job_titles = ['Staff'].concat(jt.filter(function(t) { return String(t).toLowerCase() !== 'staff'; }));
            },
            /**
             * Patch the in-memory staff list immediately after a successful save.
             * Graph list reads are eventually consistent and often return the old
             * streetAddress if we refresh too soon — that made assigns look like they failed.
             */
            applyOptimisticStaffDetails(staffId, opts) {
                var sm = store.staffManagement;
                if (!sm || !Array.isArray(sm.staffAccounts)) return;
                opts = opts || {};
                var id = String(staffId);
                var groups = Array.isArray(opts.registration_groups)
                    ? opts.registration_groups.map(function(g) { return String(g).trim(); }).filter(Boolean)
                    : null;
                var years = Array.isArray(opts.years)
                    ? opts.years.map(function(y) { return String(y).trim(); }).filter(Boolean)
                    : null;
                var titles = Array.isArray(opts.job_titles)
                    ? opts.job_titles.map(function(t) { return String(t).trim(); }).filter(function(t) {
                        return t && t.toLowerCase() !== 'staff';
                    })
                    : null;
                var subjects = Array.isArray(opts.subject_areas)
                    ? opts.subject_areas.map(function(s) { return String(s).trim(); }).filter(Boolean)
                    : null;
                var accounts = sm.staffAccounts.slice();
                for (var i = 0; i < accounts.length; i++) {
                    if (String(accounts[i].id) !== id) continue;
                    var row = Object.assign({}, accounts[i]);
                    if (groups !== null) row.registration_groups = groups.slice();
                    if (years !== null) row.years = years.slice();
                    if (groups !== null || years !== null) {
                        var keepGroups = groups !== null ? groups : (row.registration_groups || []);
                        var keepYears = years !== null ? years : (row.years || []);
                        var merged = keepGroups.concat(keepYears.filter(function(y) {
                            return keepGroups.map(function(g) { return String(g).toLowerCase(); }).indexOf(String(y).toLowerCase()) < 0;
                        }));
                        row.streetAddress = merged.length ? merged.join(', ') : null;
                    }
                    if (titles !== null) row.jobTitle = ['Staff'].concat(titles).join(', ');
                    if (subjects !== null) row.state = subjects.length ? subjects.join(', ') : ' ';
                    if (opts.uses_laptop_over_hour !== undefined) {
                        row.city = opts.uses_laptop_over_hour ? 'Yes' : 'No';
                    }
                    if (opts.atom_contact !== undefined) {
                        row.employeeType = opts.atom_contact ? 'Yes' : 'No';
                    }
                    accounts[i] = row;
                    break;
                }
                sm.staffAccounts = accounts;
                if (this.gridEdits && this.gridEdits[id]) {
                    var ge = Object.assign({}, this.gridEdits[id]);
                    if (groups !== null) ge.registration_groups = groups.slice();
                    if (years !== null) ge.years = years.slice();
                    if (titles !== null) ge.job_titles = ['Staff'].concat(titles);
                    if (subjects !== null) ge.subject_areas = subjects.slice();
                    if (opts.uses_laptop_over_hour !== undefined) {
                        ge.uses_laptop_over_hour = !!opts.uses_laptop_over_hour;
                    }
                    if (opts.atom_contact !== undefined) ge.atom_contact = !!opts.atom_contact;
                    this.gridEdits[id] = ge;
                }
            },
            refreshStaffManagementSoon() {
                setTimeout(function() {
                    if (store && typeof store.fetchStaffManagementContext === 'function') {
                        store.fetchStaffManagementContext();
                    }
                }, 2500);
            },
            initGridEdits() {
                const self = this;
                const sm = store.staffManagement;
                const parseList = function(str) { return (str || '').split(',').map(function(x) { return x.trim(); }).filter(Boolean); };
                self.gridEdits = {};
                self.gridRowFeedback = {};
                var opts = sm.jobTitleOptions || [];
                var allowed = {};
                opts.forEach(function(t) { allowed[String(t).toLowerCase()] = t; });
                (sm.staffAccounts || []).forEach(function(s) {
                    const id = String(s.id);
                    var parts = parseList(s.jobTitle);
                    var nonStaff = parts.filter(function(t) { return t.toLowerCase() !== 'staff'; });
                    var filtered = [];
                    nonStaff.forEach(function(t) {
                        var c = allowed[t.toLowerCase()];
                        if (c && filtered.indexOf(c) === -1) filtered.push(c);
                    });
                    self.gridEdits[id] = {
                        job_titles: ['Staff'].concat(filtered),
                        registration_groups: Array.isArray(s.registration_groups) ? s.registration_groups.slice() : [],
                        years: Array.isArray(s.years) ? s.years.slice() : [],
                        subject_areas: parseList(s.state),
                        uses_laptop_over_hour: (s.city || '').toString().toLowerCase() === 'yes',
                        atom_contact: (s.employeeType || '').toString().toLowerCase() === 'yes'
                    };
                });
            },
            saveGridRow(s) {
                const id = String(s.id);
                const row = this.getGridRow(s);
                this.gridRowFeedback[id] = '';
                this.ensureStaffInGridJobTitles(row);
                const jobTitles = (row.job_titles || []).filter(function(t) { return String(t).toLowerCase() !== 'staff'; });
                const self = this;
                fetch(updateDetailsUrl, { method: 'POST', headers: { 'Content-Type': 'application/json' }, credentials: 'include', body: JSON.stringify({ staff_id: s.id, job_titles: jobTitles, registration_groups: row.registration_groups || [], years: row.years || [], subject_areas: row.subject_areas || [], uses_laptop_over_hour: !!row.uses_laptop_over_hour, atom_contact: !!row.atom_contact }) })
                    .then(function(r) { return r.json(); })
                    .then(function(data) {
                        if (data.success) {
                            self.gridRowFeedback[id] = 'Saved';
                            self.applyOptimisticStaffDetails(s.id, {
                                job_titles: jobTitles,
                                registration_groups: row.registration_groups || [],
                                years: row.years || [],
                                subject_areas: row.subject_areas || [],
                                uses_laptop_over_hour: !!row.uses_laptop_over_hour,
                                atom_contact: !!row.atom_contact
                            });
                            self.refreshStaffManagementSoon();
                        } else self.gridRowFeedback[id] = 'Error: ' + (data.error || 'Failed');
                    })
                    .catch(function() { self.gridRowFeedback[id] = 'Error'; });
            },
            saveAllGrid() {
                const self = this;
                const accounts = store.staffManagement.staffAccounts || [];
                self.gridSaveAllMessage = 'Saving ' + accounts.length + ' row(s)...';
                let done = 0;
                let failed = 0;
                accounts.forEach(function(s) {
                    const id = String(s.id);
                    const row = self.getGridRow(s);
                    self.ensureStaffInGridJobTitles(row);
                    const jobTitles = (row.job_titles || []).filter(function(t) { return String(t).toLowerCase() !== 'staff'; });
                    fetch(updateDetailsUrl, { method: 'POST', headers: { 'Content-Type': 'application/json' }, credentials: 'include', body: JSON.stringify({ staff_id: s.id, job_titles: jobTitles, registration_groups: row.registration_groups || [], years: row.years || [], subject_areas: row.subject_areas || [], uses_laptop_over_hour: !!row.uses_laptop_over_hour, atom_contact: !!row.atom_contact }) })
                        .then(function(r) { return r.json(); })
                        .then(function(data) {
                            done++;
                            if (!data.success) failed++;
                            if (done === accounts.length) {
                                self.gridSaveAllMessage = failed === 0 ? 'All saved.' : failed + ' failed.';
                                self.refreshStaffManagementSoon();
                            }
                        })
                        .catch(function() { done++; failed++; if (done === accounts.length) { self.gridSaveAllMessage = failed + ' failed.'; } });
                });
                if (accounts.length === 0) self.gridSaveAllMessage = '';
            },
            filteredTrustUsers() {
                const sm = store.staffManagement;
                if (!sm || !sm.trustUsers) return [];
                let list = sm.trustUsers.slice();
                const q = (sm.searchQuery || '').toLowerCase().trim();
                if (q) list = list.filter(function(u) { return (u.email || '').toLowerCase().indexOf(q) !== -1; });
                const sort = sm.trustSort || 'school-email';
                if (sort === 'email') list.sort(function(a, b) { return (a.email || '').localeCompare(b.email || ''); });
                else if (sort === 'latest') list.sort(function(a, b) { return (b.created_at || '').localeCompare(a.created_at || ''); });
                else if (sort === 'oldest') list.sort(function(a, b) { return (a.created_at || '').localeCompare(b.created_at || ''); });
                else list.sort(function(a, b) { const sa = (a.school_name || '').localeCompare(b.school_name || ''); return sa !== 0 ? sa : (a.email || '').localeCompare(b.email || ''); });
                return list;
            },
            trustTotalPages() {
                const sm = store.staffManagement;
                const size = sm.trustPageSize || 20;
                const total = this.filteredTrustUsers().length;
                return Math.max(1, Math.ceil(total / size));
            },
            paginatedTrustUsers() {
                const sm = store.staffManagement;
                const list = this.filteredTrustUsers();
                const page = sm.trustPage || 1;
                const size = sm.trustPageSize || 20;
                const start = (page - 1) * size;
                return list.slice(start, start + size);
            },
            toggleAdmin(u) {
                if (!confirm('Are you sure you want to ' + (u.role === 'admin' ? 'remove admin privileges from' : 'grant admin privileges to') + ' ' + (u.email || '') + '?')) return;
                const self = this;
                fetch(toggleAdminUrl, { method: 'POST', headers: { 'Content-Type': 'application/json' }, credentials: 'include', body: JSON.stringify({ user_id: u.user_id, school_id: u.school_id, is_admin: u.role !== 'admin' }) })
                    .then(function(r) { return r.json(); })
                    .then(function(data) {
                        if (data.success) store.fetchStaffManagementContext();
                        else alert('Error: ' + (data.error || 'Failed to update.'));
                    })
                    .catch(function() { alert('Request failed.'); });
            },
            openStaffDetails(staffId, displayName) {
                store.staffManagement.detailsModalStaffId = staffId;
                this.detailsModalStaffName = displayName || '';
                this.detailsMessage = '';
                this.detailsLoading = true;
                const self = this;
                fetch(getDetailsUrl + '?staff_id=' + encodeURIComponent(staffId), { credentials: 'include' })
                    .then(function(r) { return r.json(); })
                    .then(function(data) {
                        self.detailsLoading = false;
                        if (data.success && data.data) {
                            const d = data.data;
                            self.detailsForm = {
                                job_titles: (d.job_titles || []).filter(function(t) { return (t || '').toLowerCase() !== 'staff'; }),
                                registration_groups: d.registration_groups || [],
                                years: d.years || [],
                                subject_areas: d.subject_areas || [],
                                uses_laptop_over_hour: !!d.uses_laptop_over_hour,
                                atom_contact: !!d.atom_contact
                            };
                        } else self.detailsMessage = 'Failed to load details.';
                    })
                    .catch(function() { self.detailsLoading = false; self.detailsMessage = 'Request failed.'; });
            },
            submitStaffDetails() {
                const staffId = store.staffManagement.detailsModalStaffId;
                if (!staffId) return;
                const self = this;
                const jobTitles = (this.detailsForm.job_titles || []).filter(function(t) { return String(t).toLowerCase() !== 'staff'; });
                fetch(updateDetailsUrl, { method: 'POST', headers: { 'Content-Type': 'application/json' }, credentials: 'include', body: JSON.stringify({ staff_id: staffId, job_titles: jobTitles, registration_groups: this.detailsForm.registration_groups || [], years: this.detailsForm.years || [], subject_areas: this.detailsForm.subject_areas || [], uses_laptop_over_hour: this.detailsForm.uses_laptop_over_hour, atom_contact: this.detailsForm.atom_contact }) })
                    .then(function(r) { return r.json(); })
                    .then(function(data) {
                        if (data.success) {
                            self.detailsMessage = 'Saved successfully.';
                            self.applyOptimisticStaffDetails(staffId, {
                                job_titles: jobTitles,
                                registration_groups: self.detailsForm.registration_groups || [],
                                years: self.detailsForm.years || [],
                                subject_areas: self.detailsForm.subject_areas || [],
                                uses_laptop_over_hour: !!self.detailsForm.uses_laptop_over_hour,
                                atom_contact: !!self.detailsForm.atom_contact
                            });
                            self.refreshStaffManagementSoon();
                            setTimeout(function() { store.staffManagement.detailsModalStaffId = null; }, 800);
                        } else self.detailsMessage = data.error || 'Failed to save.';
                    })
                    .catch(function() { self.detailsMessage = 'Request failed.'; });
            },
            requestDisable(s) {
                if (!confirm('Request to disable account for ' + (s.displayName || '') + '? This will send a notification to IT for approval.')) return;
                const self = this;
                fetch(requestDisableUrl, { method: 'POST', headers: { 'Content-Type': 'application/json' }, credentials: 'include', body: JSON.stringify({ staff_id: s.id, staff_name: s.displayName || '', staff_email: s.mail || s.userPrincipalName || '' }) })
                    .then(function(r) { return r.json(); })
                    .then(function(data) {
                        if (data.success) {
                            alert('Disable request submitted successfully. IT will be notified.');
                            store.fetchStaffManagementContext();
                        } else alert('Error: ' + (data.error || 'Failed.'));
                    })
                    .catch(function() { alert('Request failed.'); });
            },
            requestEnable(s) {
                alert('Account enable request for ' + (s.displayName || '') + ' will be sent to IT for approval.');
            },
            startBulkPoll() {
                var self = this;
                if (bulkPollInterval) clearInterval(bulkPollInterval);
                bulkPollInterval = setInterval(function() {
                    var sm = store.staffManagement;
                    if (!sm || !sm.bulkTaskId) { clearInterval(bulkPollInterval); bulkPollInterval = null; return; }
                    fetch(taskStatusBase + sm.bulkTaskId, { credentials: 'include' })
                        .then(function(r) { return r.json(); })
                        .then(function(data) {
                            if (data.state === 'PROGRESS') {
                                sm.bulkTaskStatus = data.status || 'Processing...';
                                if (data.current !== undefined) sm.bulkTaskCurrent = data.current;
                                if (data.total !== undefined) sm.bulkTaskTotal = data.total;
                            } else if (data.state === 'SUCCESS') {
                                if (bulkPollInterval) { clearInterval(bulkPollInterval); bulkPollInterval = null; }
                                var res = data.result || {};
                                sm.bulkTaskSuccessCount = res.success_count || 0;
                                sm.bulkTaskErrorCount = res.error_count || 0;
                                sm.bulkTaskStatus = 'Complete';
                                sm.bulkTaskCurrent = sm.bulkTaskTotal || 0;
                                // Optimistic list update so reg groups show before Graph catches up
                                try {
                                    var panel = self;
                                    var selectedIds = (panel.bulkRegGroupsSelectedStaff || []).slice();
                                    var groups = (panel.bulkRegGroupsSelected || []).slice();
                                    if (selectedIds.length && groups.length && typeof panel.applyOptimisticStaffDetails === 'function') {
                                        selectedIds.forEach(function(sid) {
                                            panel.applyOptimisticStaffDetails(sid, { registration_groups: groups });
                                        });
                                    }
                                    var yearIds = (panel.bulkYearsSelectedStaff || []).slice();
                                    var yearVals = (panel.bulkYearsSelected || []).slice();
                                    if (yearIds.length && yearVals.length && typeof panel.applyOptimisticStaffDetails === 'function') {
                                        yearIds.forEach(function(sid) {
                                            panel.applyOptimisticStaffDetails(sid, { years: yearVals });
                                        });
                                    }
                                    var subjIds = (panel.bulkSubjectAreasSelectedStaff || []).slice();
                                    var areas = (panel.bulkSubjectAreasSelected || []).slice();
                                    if (subjIds.length && typeof panel.applyOptimisticStaffDetails === 'function') {
                                        subjIds.forEach(function(sid) {
                                            panel.applyOptimisticStaffDetails(sid, { subject_areas: areas });
                                        });
                                    }
                                    var jobIds = (panel.bulkJobTitlesSelectedStaff || []).slice();
                                    var titles = (panel.bulkJobTitlesSelected || []).slice();
                                    if (jobIds.length && typeof panel.applyOptimisticStaffDetails === 'function') {
                                        var laptop = panel.bulkLaptopUsage;
                                        jobIds.forEach(function(sid) {
                                            var opts = { job_titles: titles };
                                            if (laptop === 'yes' || laptop === 'no') {
                                                opts.uses_laptop_over_hour = laptop === 'yes';
                                            }
                                            panel.applyOptimisticStaffDetails(sid, opts);
                                        });
                                    }
                                } catch (e) {}
                                if (typeof self.refreshStaffManagementSoon === 'function') self.refreshStaffManagementSoon();
                                else store.fetchStaffManagementContext();
                                setTimeout(function() { sm.bulkTaskId = null; sm.bulkTaskStatus = ''; sm.bulkTaskSuccessCount = 0; sm.bulkTaskErrorCount = 0; sm.bulkTaskCurrent = 0; sm.bulkTaskTotal = 0; }, 3000);
                            } else if (data.state === 'FAILURE' || data.state === 'FAILED') {
                                if (bulkPollInterval) { clearInterval(bulkPollInterval); bulkPollInterval = null; }
                                sm.bulkTaskStatus = 'Error: ' + (data.error || 'Task failed');
                                setTimeout(function() { sm.bulkTaskId = null; sm.bulkTaskStatus = ''; }, 4000);
                            }
                        })
                        .catch(function() {
                            if (bulkPollInterval) { clearInterval(bulkPollInterval); bulkPollInterval = null; }
                            var s = store.staffManagement;
                            if (s) s.bulkTaskStatus = 'Error checking status';
                        });
                }, 2000);
            },
            submitBulkJobTitles() {
                var sm = store.staffManagement;
                var selected = (this.bulkJobTitlesSelectedStaff || []).map(function(id) { return String(id); });
                var titles = (this.bulkJobTitlesSelected || []).slice();
                if (!selected.length) { alert('Select at least one staff member.'); return; }
                var self = this;
                fetch(bulkJobTitlesUrl, { method: 'POST', headers: { 'Content-Type': 'application/json' }, credentials: 'include', body: JSON.stringify({ selected_staff: selected, job_titles: titles, laptop_usage: this.bulkLaptopUsage || undefined }) })
                    .then(function(r) { return r.json(); })
                    .then(function(data) {
                        if (data.task_id) {
                            sm.bulkTaskId = data.task_id;
                            sm.bulkTaskStatus = 'Processing...';
                            sm.bulkTaskCurrent = 0;
                            sm.bulkTaskTotal = selected.length;
                            self.startBulkPoll();
                        } else alert('Error: ' + (data.error || 'No task_id returned'));
                    })
                    .catch(function() { alert('Request failed.'); });
            },
            submitBulkRegistrationGroups() {
                var sm = store.staffManagement;
                var selected = (this.bulkRegGroupsSelectedStaff || []).map(function(id) { return String(id); });
                var groups = (this.bulkRegGroupsSelected || []).slice();
                if (!selected.length) { alert('Select at least one staff member.'); return; }
                if (!groups.length) {
                    alert('Select at least one registration group. Clearing all groups for multiple staff is not allowed from bulk update.');
                    return;
                }
                var self = this;
                fetch(bulkRegGroupsUrl, { method: 'POST', headers: { 'Content-Type': 'application/json' }, credentials: 'include', body: JSON.stringify({ selected_staff: selected, registration_groups: groups }) })
                    .then(function(r) { return r.json(); })
                    .then(function(data) {
                        if (data.task_id) {
                            sm.bulkTaskId = data.task_id;
                            sm.bulkTaskStatus = 'Processing...';
                            sm.bulkTaskCurrent = 0;
                            sm.bulkTaskTotal = selected.length;
                            self.startBulkPoll();
                        } else alert('Error: ' + (data.error || 'No task_id returned'));
                    })
                    .catch(function() { alert('Request failed.'); });
            },
            submitBulkYears() {
                var sm = store.staffManagement;
                var selected = (this.bulkYearsSelectedStaff || []).map(function(id) { return String(id); });
                var years = (this.bulkYearsSelected || []).slice();
                if (!selected.length) { alert('Select at least one staff member.'); return; }
                if (!years.length) {
                    alert('Select at least one year. Clearing all years for multiple staff is not allowed from bulk update.');
                    return;
                }
                var self = this;
                fetch(bulkYearsUrl, { method: 'POST', headers: { 'Content-Type': 'application/json' }, credentials: 'include', body: JSON.stringify({ selected_staff: selected, years: years }) })
                    .then(function(r) { return r.json(); })
                    .then(function(data) {
                        if (data.task_id) {
                            sm.bulkTaskId = data.task_id;
                            sm.bulkTaskStatus = 'Processing...';
                            sm.bulkTaskCurrent = 0;
                            sm.bulkTaskTotal = selected.length;
                            self.startBulkPoll();
                        } else alert('Error: ' + (data.error || 'No task_id returned'));
                    })
                    .catch(function() { alert('Request failed.'); });
            },
            submitBulkSubjectAreas() {
                var sm = store.staffManagement;
                var selected = (this.bulkSubjectAreasSelectedStaff || []).map(function(id) { return String(id); });
                var areas = (this.bulkSubjectAreasSelected || []).slice();
                if (!selected.length) { alert('Select at least one staff member.'); return; }
                var self = this;
                fetch(bulkSubjectAreasUrl, { method: 'POST', headers: { 'Content-Type': 'application/json' }, credentials: 'include', body: JSON.stringify({ selected_staff: selected, subject_areas: areas }) })
                    .then(function(r) { return r.json(); })
                    .then(function(data) {
                        if (data.task_id) {
                            sm.bulkTaskId = data.task_id;
                            sm.bulkTaskStatus = 'Processing...';
                            sm.bulkTaskCurrent = 0;
                            sm.bulkTaskTotal = selected.length;
                            self.startBulkPoll();
                        } else alert('Error: ' + (data.error || 'No task_id returned'));
                    })
                    .catch(function() { alert('Request failed.'); });
            },
            submitRequestUser() {
                const self = this;
                const form = this.requestUserForm;
                if (!(form.firstname || '').trim() || !(form.lastname || '').trim()) {
                    this.requestUserMessage = 'First name and last name are required.';
                    return;
                }
                if (!(form.job_titles || []).length) {
                    this.requestUserMessage = 'Select at least one job title.';
                    return;
                }
                this.requestUserMessage = '';
                const formData = new FormData();
                formData.append('firstname', (form.firstname || '').trim());
                formData.append('lastname', (form.lastname || '').trim());
                (form.job_titles || []).forEach(function(t) { formData.append('job_titles', t); });
                (form.registration_groups || []).forEach(function(g) { formData.append('registration_groups', g); });
                (form.years || []).forEach(function(y) { formData.append('years', y); });
                (form.subject_areas || []).forEach(function(s) { formData.append('subject_areas', s); });
                formData.append('uses_laptop_over_hour', form.uses_laptop_over_hour ? 'on' : '');
                fetch(requestUserUrl, { method: 'POST', credentials: 'include', body: formData })
                    .then(function(r) { return r.json(); })
                    .then(function(data) {
                        if (data.success) {
                            self.requestUserMessage = data.message || 'User request submitted successfully.';
                            store.staffManagement.requestUserModalOpen = false;
                            store.fetchStaffManagementContext();
                            self.requestUserForm = { firstname: '', lastname: '', job_titles: [], registration_groups: [], years: [], subject_areas: [], uses_laptop_over_hour: false };
                        } else self.requestUserMessage = data.error || 'Failed to submit request.';
                    })
                    .catch(function() { self.requestUserMessage = 'Request failed.'; });
            }
        };
    });

    Alpine.data('senPlanningPanel', function() {
        const taskBase = (typeof taskStatusUrl !== 'undefined' && taskStatusUrl) ? taskStatusUrl.replace('/__TASK_ID__', '') : '/task_status';
        const generateUrl = typeof senPlanningGenerateUrl !== 'undefined' ? senPlanningGenerateUrl : '/sen_planning/generate';
        const chatUrl = typeof senPlanningChatUrl !== 'undefined' ? senPlanningChatUrl : '/sen_planning/chat';
        const exportUrl = typeof senPlanningExportUrl !== 'undefined' ? senPlanningExportUrl : '/sen_planning/export';
        const strandsUrl = typeof senPlanningGetStrandsUrl !== 'undefined' ? senPlanningGetStrandsUrl : '/sen_planning/get_strands';
        const stepsUrl = typeof senPlanningGetProgressionStepsUrl !== 'undefined' ? senPlanningGetProgressionStepsUrl : '/sen_planning/get_progression_steps';
        return {
            formYear: '',
            formSubject: '',
            formStrand: '',
            formProgressionStep: '',
            formOutputFormat: 'text',
            formSaveLocation: 'onedrive',
            formFilename: '',
            strands: [],
            progressionSteps: [],
            generating: false,
            generateError: '',
            chatMessage: '',
            chatError: '',
            exporting: false,
            exportMessage: '',
            exportSuccess: false,
            loadStrands() {
                const store = getCanvasStore();
                const year = this.formYear;
                const subject = this.formSubject;
                this.progressionSteps = [];
                if (!year || !subject) { this.strands = []; return; }
                const self = this;
                fetch(strandsUrl, { method: 'POST', headers: { 'Content-Type': 'application/json' }, credentials: 'include', body: JSON.stringify({ year: year, subject: subject }) })
                    .then(function(r) { return r.json(); })
                    .then(function(data) { self.strands = data.strands || []; })
                    .catch(function() { self.strands = []; });
            },
            loadProgressionSteps() {
                const year = this.formYear;
                const subject = this.formSubject;
                const strand = this.formStrand;
                if (!year || !subject || !strand) { this.progressionSteps = []; return; }
                const self = this;
                fetch(stepsUrl, { method: 'POST', headers: { 'Content-Type': 'application/json' }, credentials: 'include', body: JSON.stringify({ year: year, subject: subject, strand: strand }) })
                    .then(function(r) { return r.json(); })
                    .then(function(data) { self.progressionSteps = data.progression_steps || []; })
                    .catch(function() { self.progressionSteps = []; });
            },
            submitGenerate() {
                const store = getCanvasStore();
                this.generateError = '';
                if (!store || !store.senPlanning || !store.senPlanning.selectedStudentId) {
                    this.generateError = 'Select a pupil from the list on the right first.';
                    return;
                }
                var fy = String(this.formYear || '').trim();
                var fsj = String(this.formSubject || '').trim();
                var fst = String(this.formStrand || '').trim();
                var fsp = String(this.formProgressionStep || '').trim();
                if (!fy || !fsj || !fst || !fsp) {
                    this.generateError = 'Choose year, subject, strand, and progression step.';
                    return;
                }
                this.generating = true;
                const self = this;
                const data = {
                    student_id: store.senPlanning.selectedStudentId,
                    year: this.formYear,
                    registration_group: (store.senPlanning.selectedStudent && store.senPlanning.selectedStudent.registration_group) || '',
                    subject: this.formSubject,
                    strand: this.formStrand,
                    progression_step: this.formProgressionStep,
                    ai_persona_id: 'sen_planning_support',
                    content_type: 'lesson_plan',
                    output_format: this.formOutputFormat,
                    save_location: this.formSaveLocation,
                    filename: this.formFilename || undefined,
                    ai_model: getCanvasStore().aiModel
                };
                fetch(generateUrl, { method: 'POST', headers: { 'Content-Type': 'application/json' }, credentials: 'include', body: JSON.stringify(data) })
                    .then(function(r) { return r.json(); })
                    .then(function(result) {
                        if (result.status !== 'success' || !result.chat_id || !result.task_id) {
                            self.generating = false;
                            self.generateError = result.error || result.message || 'Generate failed.';
                            return;
                        }
                        store.senPlanning.chatId = result.chat_id;
                        function poll() {
                            fetch((taskBase + '/' + result.task_id).replace('//', '/'), { credentials: 'include' })
                                .then(function(r) { return r.json(); })
                                .then(function(sdata) {
                                    if (sdata.state === 'SUCCESS') {
                                        self.generating = false;
                                        store.senPlanning.step = 'activity_list';
                                        store.senPlanning.error = '';
                                        const raw = (sdata.result && sdata.result.html_content) || '';
                                        store.senPlanning.contentMarkdown = raw;
                                        var pupil = store.senPlanning.selectedStudent || {};
                                        var pupilName = ((pupil.firstname || '') + ' ' + (pupil.lastname || '')).trim();
                                        store.senPlanning.activitySubject = self.formSubject || '';
                                        store.senPlanning.activityTitle = pupilName || store.senPlanning.activitySubject || 'SEN activity';
                                        if (typeof store.persistSenActivity === 'function') store.persistSenActivity();
                                    } else if (sdata.state === 'FAILURE') {
                                        self.generating = false;
                                        store.senPlanning.error = sdata.error || 'Task failed.';
                                    } else {
                                        setTimeout(poll, 2000);
                                    }
                                })
                                .catch(function() { self.generating = false; });
                        }
                        poll();
                    })
                    .catch(function(err) { self.generating = false; self.generateError = err.message || 'Request failed.'; });
            },
            sendChat() {
                const store = getCanvasStore();
                const msg = (this.chatMessage || '').trim();
                if (!msg || !store.senPlanning || !store.senPlanning.chatId) return;
                store.senPlanning.messages.push({ role: 'user', content: msg });
                this.chatMessage = '';
                this.chatError = '';
                const self = this;
                fetch(chatUrl, { method: 'POST', headers: { 'Content-Type': 'application/json' }, credentials: 'include', body: JSON.stringify({ chat_id: store.senPlanning.chatId, message: msg }) })
                    .then(function(r) { return r.json(); })
                    .then(function(result) {
                        if (!result.task_id) {
                            self.chatError = result.error || 'Send failed.';
                            return;
                        }
                        function poll() {
                            fetch((taskBase + '/' + result.task_id).replace('//', '/'), { credentials: 'include' })
                                .then(function(r) { return r.json(); })
                                .then(function(sdata) {
                                    if (sdata.state === 'SUCCESS' && sdata.result && sdata.result.html_content) {
                                        const raw = sdata.result.html_content;
                                        store.senPlanning.contentMarkdown = raw;
                                        if (typeof store.persistSenActivity === 'function') store.persistSenActivity();
                                        store.senPlanning.messages.push({ role: 'assistant', content: raw, contentHtml: (typeof marked !== 'undefined' ? marked.parse(raw) : raw) });
                                    } else if (sdata.state === 'FAILURE') {
                                        self.chatError = sdata.error || 'Task failed.';
                                    } else {
                                        setTimeout(poll, 2000);
                                    }
                                })
                                .catch(function() { self.chatError = 'Poll failed.'; });
                        }
                        poll();
                    })
                    .catch(function(err) { self.chatError = err.message || 'Request failed.'; });
            },
            exportChat() {
                const store = getCanvasStore();
                if (!store.senPlanning || !store.senPlanning.chatId) return;
                this.exportMessage = '';
                this.exporting = true;
                const self = this;
                const data = {
                    chat_id: store.senPlanning.chatId,
                    content_type: 'SEN Activities',
                    output_format: this.formOutputFormat,
                    save_location: this.formSaveLocation,
                    filename: this.formFilename || undefined,
                    subject: 'SEN Planning Support',
                    year: this.formYear,
                    registration_group: (store.senPlanning.selectedStudent && store.senPlanning.selectedStudent.registration_group) || ''
                };
                fetch(exportUrl, { method: 'POST', headers: { 'Content-Type': 'application/json' }, credentials: 'include', body: JSON.stringify(data) })
                    .then(function(r) { return r.json(); })
                    .then(function(result) {
                        if (!result.task_id) {
                            self.exporting = false;
                            self.exportMessage = result.error || 'Export failed.';
                            self.exportSuccess = false;
                            return;
                        }
                        function poll() {
                            fetch((taskBase + '/' + result.task_id).replace('//', '/'), { credentials: 'include' })
                                .then(function(r) { return r.json(); })
                                .then(function(sdata) {
                                    if (sdata.state === 'SUCCESS') {
                                        self.exporting = false;
                                        self.exportMessage = 'Export completed successfully.';
                                        self.exportSuccess = true;
                                    } else if (sdata.state === 'FAILURE') {
                                        self.exporting = false;
                                        self.exportMessage = sdata.error || 'Export failed.';
                                        self.exportSuccess = false;
                                    } else {
                                        setTimeout(poll, 2000);
                                    }
                                })
                                .catch(function() { self.exporting = false; self.exportMessage = 'Export request failed.'; self.exportSuccess = false; });
                        }
                        poll();
                    })
                    .catch(function(err) { self.exporting = false; self.exportMessage = err.message || 'Request failed.'; self.exportSuccess = false; });
            },
            renderSenPlanningMarkdown() {
                const s = getCanvasStore();
                const raw = (s && s.senPlanning && s.senPlanning.contentMarkdown) ? s.senPlanning.contentMarkdown : '';
                const normalized = normalizeSenPlanningWeekHeadings(raw);
                var html = '';
                if (typeof marked !== 'undefined') html = marked.parse(normalized); else html = normalized.replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/\n/g, '<br>');
                if (!html) return '';
                var parts = html.split(/(?=<h2\b)/i);
                var out = '<div class="sen-activity-plan-content">';
                var dayNames = ['monday','tuesday','wednesday','thursday','friday'];
                for (var i = 0; i < parts.length; i++) {
                    var part = parts[i].trim();
                    if (!part) continue;
                    if (/^<h2\b/i.test(part)) {
                        var dayMatch = part.match(/<h2[^>]*>([\s\S]*?)<\/h2>/i);
                        var dayInner = dayMatch ? dayMatch[1] : '';
                        var dayLabel = dayInner.replace(/<[^>]+>/g, '').toLowerCase();
                        var dataDay = dayNames.find(function(d) { return dayLabel.indexOf(d) !== -1; }) || '';
                        out += '<div class="sen-activity-day" data-day="' + (dataDay || '') + '">' + part + '</div>';
                    } else {
                        out += part;
                    }
                }
                out += '</div>';
                return out;
            },
            wrapSenPlanningSelection() {
                const container = document.getElementById('canvas-sen-planning-content');
                if (!container) return;
                const sel = window.getSelection();
                if (!sel || !sel.rangeCount) return;
                const range = sel.getRangeAt(0);
                if (!container.contains(range.startContainer) || range.collapsed) return;
                try {
                    const span = document.createElement('span');
                    span.className = 'lesson-plan-editing-delete';
                    range.surroundContents(span);
                } catch (_) {}
            }
        };
    });

    Alpine.data('personasPanel', function() {
        return {
            selectPersona(personaId, prompt, personaName) {
                const s = getCanvasStore();
                if (s && typeof s.handlePersonaSelectFromBar === 'function') {
                    s.handlePersonaSelectFromBar(personaId);
                    return;
                }
                s.aiPersonaId = personaId;
                s.personaPrompt = prompt || '';
            }
        };
    });

    Alpine.data('lessonPlanPanel', function() {
        const store = () => getCanvasStore();
        return {
            openLessonPlanStream(taskId) {
                const s = store();
                const url = lessonPlanStreamUrl.replace('__TASK_ID__', taskId);
                fetch(url, { credentials: 'include' }).then(res => {
                    if (!res.ok || !res.body) return;
                    const reader = res.body.getReader();
                    const decoder = new TextDecoder();
                    let buf = '';
                    const read = () => {
                        reader.read().then(({ value, done }) => {
                            if (done) return;
                            buf += decoder.decode(value, { stream: true });
                            const lines = buf.split('\n');
                            buf = lines.pop() || '';
                            for (const line of lines) {
                                if (line.startsWith('data: ')) {
                                    try {
                                        const data = JSON.parse(line.slice(6));
                                        if (data.done) return;
                                        if (data.text && s.lessonPlan && s.lessonPlan.content) s.lessonPlan.content.main_content += data.text;
                                    } catch (_) {}
                                }
                            }
                            read();
                        }).catch(() => {});
                    };
                    read();
                }).catch(() => {});
            },
            groupedNcYearsForWizard() {
                const s = store();
                const rows = s.canvasNcYearsList || [];
                const buckets = {};
                const order = [];
                rows.forEach(function(row) {
                    var y = (row && row.ncYear) || '';
                    if (!y) return;
                    var ksRaw = (row && row.keystage) && String(row.keystage).trim() ? String(row.keystage).trim() : 'Years';
                    if (!buckets[ksRaw]) { buckets[ksRaw] = []; order.push(ksRaw); }
                    if (buckets[ksRaw].indexOf(y) < 0) buckets[ksRaw].push(y);
                });
                if (order.length) return order.map(function(k) { return { keystage: k, years: buckets[k] }; });
                const flat = s.canvasYearsList || [];
                if (flat.length) return [{ keystage: 'Years', years: flat.slice() }];
                return [];
            },
            lessonPlanWizardRegGroupsForStep1() {
                const s = store();
                var mode = s.lessonPlan.wizardRegMode;
                if (mode === 'multiple') return s.userRegistrationGroups || [];
                if (mode === 'school') return s.registrationGroups || [];
                return [];
            },
            lessonPlanWizardNext() {
                const s = store();
                const lp = s.lessonPlan;
                if (!lp || !lp.wizardActive) return;
                lp.wizardError = '';
                const st = lp.wizardStep;
                if (st === 1) {
                    if (!(lp.data.registration_group && String(lp.data.registration_group).trim())) {
                        lp.wizardError = 'Please select a registration group.';
                        return;
                    }
                    if (!(lp.data.curriculum_year && String(lp.data.curriculum_year).trim())) {
                        lp.wizardError = 'Please select a curriculum year.';
                        return;
                    }
                }
                if (st === 2) {
                    const subj = (lp.data.subject && String(lp.data.subject).trim()) || '';
                    if (!subj) { lp.wizardError = 'Please select a subject.'; return; }
                    const subjl = subj.toLowerCase();
                    const agents = s.aiAgentsList || [];
                    const agent = agents.find(function(a) {
                        const su = (a.subject && String(a.subject).trim()) || '';
                        return su.toLowerCase() === subjl;
                    });
                    if (!agent) {
                        lp.wizardError = 'No curriculum persona for this subject. Add or align a curric agent in System Messages.';
                        return;
                    }
                    lp.data.ai_agent_id = agent.id;
                }
                if (st === 4) {
                    const aims = (lp.data.lesson_aims && String(lp.data.lesson_aims).trim()) || '';
                    if (!aims) { lp.wizardError = 'Please describe the lesson aims.'; return; }
                }
                if (st < 5) lp.wizardStep = st + 1;
                if (lp.wizardStep === 3) {
                    this.loadLessonPlanWizardClassProfile();
                }
            },
            async loadLessonPlanWizardClassProfile() {
                const s = store();
                const lp = s.lessonPlan;
                if (!lp || !lessonPlanWizardClassUrl) return;
                var rg = (lp.data.registration_group && String(lp.data.registration_group).trim()) || '';
                if (!rg && s.actionContext && s.actionContext.targetType === 'reg_group' && s.actionContext.targetLabel) {
                    rg = String(s.actionContext.targetLabel).trim();
                }
                if (!rg) {
                    lp.wizardClassStudents = [];
                    lp.wizardClassStudentsError = '';
                    return;
                }
                lp.wizardClassStudentsLoading = true;
                lp.wizardClassStudentsError = '';
                try {
                    const u = lessonPlanWizardClassUrl + '?registration_group=' + encodeURIComponent(rg);
                    const res = await fetch(u, { credentials: 'include' });
                    const data = await res.json().catch(function() { return {}; });
                    if (!res.ok) {
                        lp.wizardClassStudents = [];
                        lp.wizardClassStudentsError = (data && data.error) || ('Request failed (' + res.status + ')');
                        return;
                    }
                    lp.wizardClassStudents = data.students || [];
                } catch (e) {
                    lp.wizardClassStudents = [];
                    lp.wizardClassStudentsError = (e && e.message) ? e.message : 'Network error';
                } finally {
                    lp.wizardClassStudentsLoading = false;
                }
            },
            lessonPlanWizardBack() {
                const s = store();
                const lp = s.lessonPlan;
                if (!lp || !lp.wizardActive || lp.wizardStep <= 1) return;
                lp.wizardError = '';
                lp.wizardStep -= 1;
            },
            lessonPlanWizardKeystage() {
                const s = store();
                const cy = (s.lessonPlan && s.lessonPlan.data && s.lessonPlan.data.curriculum_year)
                    ? String(s.lessonPlan.data.curriculum_year).trim() : '';
                if (!cy) return '';
                const rows = s.canvasNcYearsList || [];
                for (let i = 0; i < rows.length; i++) {
                    const row = rows[i];
                    var ny = (row && row.ncYear) ? String(row.ncYear).trim() : '';
                    if (ny === cy) {
                        return (row.keystage && String(row.keystage).trim()) || '';
                    }
                }
                return '';
            },
            undoLessonPlanAimsEnhance() {
                const s = store();
                const lp = s.lessonPlan;
                if (!lp || lp.aimsBeforeEnhance == null) return;
                if (!lp.data) lp.data = {};
                lp.data.lesson_aims = lp.aimsBeforeEnhance;
                lp.aimsBeforeEnhance = null;
                lp.enhanceAimsError = '';
            },
            async enhanceLessonPlanWizardAims() {
                const s = store();
                const lp = s.lessonPlan;
                if (!lp || !lp.wizardActive || !enhanceLessonPlanAimsUrl) return;
                const aims = (lp.data && lp.data.lesson_aims && String(lp.data.lesson_aims).trim()) || '';
                if (!aims) {
                    lp.enhanceAimsError = 'Add some lesson aims first.';
                    return;
                }
                const subj = (lp.data.subject && String(lp.data.subject).trim()) || '';
                const year = (lp.data.curriculum_year && String(lp.data.curriculum_year).trim()) || '';
                if (!subj || !year) {
                    lp.enhanceAimsError = 'Select curriculum year and subject first (steps 1–2).';
                    return;
                }
                lp.enhanceAimsError = '';
                lp.enhanceAimsLoading = true;
                lp.aimsBeforeEnhance = aims;
                var regGroup = (lp.data.registration_group && String(lp.data.registration_group).trim()) || '';
                if (!regGroup && s.actionContext && s.actionContext.targetType === 'reg_group' && s.actionContext.targetLabel) {
                    regGroup = String(s.actionContext.targetLabel).trim();
                }
                const keystage = this.lessonPlanWizardKeystage();
                const style = (lp.lessonAimsEnhanceStyle === 'concise') ? 'concise' : 'fuller';
                try {
                    const res = await fetch(enhanceLessonPlanAimsUrl, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        credentials: 'include',
                        body: JSON.stringify({
                            lesson_aims: aims,
                            subject: subj,
                            curriculum_year: year,
                            keystage: keystage,
                            registration_group: regGroup,
                            style: style
                        })
                    });
                    const data = await res.json().catch(function() { return {}; });
                    if (!res.ok) {
                        lp.enhanceAimsError = (data && data.error) || ('Request failed (' + res.status + ')');
                        lp.aimsBeforeEnhance = null;
                        return;
                    }
                    if (data.enhanced_aims) {
                        lp.data.lesson_aims = data.enhanced_aims;
                    } else {
                        lp.enhanceAimsError = 'No enhanced text returned.';
                        lp.aimsBeforeEnhance = null;
                    }
                } catch (e) {
                    lp.enhanceAimsError = (e && e.message) ? e.message : 'Network error';
                    lp.aimsBeforeEnhance = null;
                } finally {
                    lp.enhanceAimsLoading = false;
                }
            },
            deriveLessonPlanTopicFromWizard() {
                const s = store();
                const d = s.lessonPlan.data || {};
                const aims = (d.lesson_aims && String(d.lesson_aims).trim()) || '';
                if (aims) {
                    var first = this.normalizeLessonFilenameText(aims.split(/\n/)[0]);
                    if (first.length > 120) first = first.slice(0, 117) + '...';
                    return first || ((d.subject || '') + ' – ' + (d.curriculum_year || '')).trim();
                }
                return ((d.subject || 'Lesson') + ' – ' + (d.curriculum_year || '')).trim();
            },
            normalizeLessonFilenameText(raw) {
                var text = (raw === undefined || raw === null) ? '' : String(raw).trim();
                if (!text) return '';
                text = text.split(/\r?\n/)[0].trim();
                text = text.replace(/^#{1,6}\s+/, '');
                text = text.replace(/^>\s+/, '');
                text = text.replace(/^[-*+]\s+/, '');
                text = text.replace(/^\d+[.)]\s+/, '');
                text = text.replace(/\[([^\]]+)\]\([^)]+\)/g, '$1');
                text = text.replace(/[*_`~[\]()]/g, '');
                text = text.replace(/\s+/g, ' ').trim();
                return text;
            },
            buildLessonExportBaseName(rawName, fallbackTopic, stripExtRe) {
                var candidate = (rawName && String(rawName).trim()) ? String(rawName).trim() : String(fallbackTopic || 'lesson_plan');
                candidate = this.normalizeLessonFilenameText(candidate);
                if (!candidate) candidate = 'lesson_plan';
                candidate = candidate.replace(/\s+/g, '_');
                candidate = candidate.replace(/[<>:"/\\|?*#%\x00-\x1f]/g, '_');
                candidate = candidate.replace(/_+/g, '_').replace(/^[_\.]+|[_\.]+$/g, '');
                if (stripExtRe) candidate = candidate.replace(stripExtRe, '');
                return candidate || 'lesson_plan';
            },
            lessonFilenameDateStamp() {
                const now = new Date();
                const y = String(now.getFullYear());
                const m = String(now.getMonth() + 1).padStart(2, '0');
                const d = String(now.getDate()).padStart(2, '0');
                return d + m + y;
            },
            buildLessonExportFallbackName() {
                const s = store();
                const content = (s.lessonPlan && s.lessonPlan.content && s.lessonPlan.content.main_content)
                    ? String(s.lessonPlan.content.main_content)
                    : '';
                let title = '';
                if (content) {
                    const lines = content.split(/\r?\n/);
                    for (let i = 0; i < lines.length; i++) {
                        const line = String(lines[i] || '').trim();
                        if (!line) continue;
                        const lpMatch = line.match(/^lesson\s*plan\s*:\s*(.+)$/i);
                        if (lpMatch && lpMatch[1]) {
                            title = this.normalizeLessonFilenameText(lpMatch[1]);
                            break;
                        }
                        const headingMatch = line.match(/^#{1,6}\s+(.+)$/);
                        if (headingMatch && headingMatch[1]) {
                            title = this.normalizeLessonFilenameText(headingMatch[1]);
                            break;
                        }
                        const boldOnlyMatch = line.match(/^\*\*([^*\n]+)\*\*\s*$/);
                        if (boldOnlyMatch && boldOnlyMatch[1]) {
                            title = this.normalizeLessonFilenameText(boldOnlyMatch[1]);
                            break;
                        }
                    }
                }
                if (!title) {
                    const topic = (s.lessonPlan && s.lessonPlan.content && s.lessonPlan.content.topic) || 'lesson_plan';
                    title = this.normalizeLessonFilenameText(topic) || 'lesson_plan';
                }
                title = title.replace(/^lesson\s*plan\s*:\s*/i, '').trim();
                title = title.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/_+/g, '_').replace(/^_+|_+$/g, '');
                if (!title) title = 'lesson_plan';
                return title + '_' + this.lessonFilenameDateStamp();
            },
            async lessonPlanWizardSubmit() {
                const self = this;
                const s = store();
                const lp = s.lessonPlan;
                if (!lp || !lp.wizardActive) return;
                lp.wizardError = '';
                const aims = (lp.data.lesson_aims && String(lp.data.lesson_aims).trim()) || '';
                if (!aims) { lp.wizardError = 'Please describe the lesson aims.'; return; }
                const equipment = (lp.data.equipment && String(lp.data.equipment).trim()) || '';
                const topic = self.deriveLessonPlanTopicFromWizard();
                const activities = 'Whole-class and group activities aligned to the lesson aims, differentiated as needed. Use the equipment and resources noted under Materials.';
                var regGroup = (lp.data.registration_group && String(lp.data.registration_group).trim()) || '';
                if (!regGroup && s.actionContext && s.actionContext.targetType === 'reg_group' && s.actionContext.targetLabel) {
                    regGroup = String(s.actionContext.targetLabel).trim();
                }
                const aiAgentId = lp.data.ai_agent_id;
                if (!aiAgentId) {
                    lp.wizardError = 'Could not resolve curriculum agent for the selected subject.';
                    return;
                }
                lp.wizardActive = false;
                lp.loading = true;
                lp.data.topic = topic;
                const formData = {
                    ai_agent: aiAgentId,
                    curriculum_year: lp.data.curriculum_year,
                    registration_group: regGroup,
                    topic: topic,
                    subject: (lp.data.subject && String(lp.data.subject).trim()) || '',
                    objectives: aims,
                    activities: activities,
                    materials: equipment,
                    duration: '60',
                    ai_model: s.aiModel,
                    image_model: (s.imageCreatorModel || 'runware:400@2'),
                    image_style: (s.lessonPlanImageStyle || 'childrens_storybook'),
                    create_sen_addendums: !!(lp.data && lp.data.include_sen_differentiation),
                    create_eal_addendums: !!(lp.data && lp.data.include_eal_differentiation)
                };
                try {
                    const res = await fetch(createLessonPlanUrl, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(formData), credentials: 'include' });
                    const data = await res.json();
                    if (res.status === 202 && data.task_id) {
                        lp.taskId = data.task_id;
                        if (!lp.content) lp.content = {};
                        lp.content.main_content = '';
                        self.openLessonPlanStream(data.task_id);
                        self.pollLessonPlanTask();
                        if (typeof scheduleSaveCanvasState === 'function') scheduleSaveCanvasState();
                    } else {
                        lp.wizardError = (data && data.error) || 'Request failed';
                        lp.wizardActive = true;
                        lp.loading = false;
                    }
                } catch (e) {
                    lp.wizardError = e.message || 'Network error';
                    lp.wizardActive = true;
                    lp.loading = false;
                }
            },
            selectLessonPlanAgent(agent) {
                const s = store();
                if (!agent || !agent.id || s.currentAction !== 'lesson_plan' || s.lessonPlan.wizardActive || s.lessonPlan.step !== 2) return;
                s.lessonPlan.data.ai_agent_id = agent.id;
                s.lessonPlan.data.subject = (agent.subject && String(agent.subject).trim()) || agent.name || '';
                s.lessonPlan.step = 3;
                s.lessonPlanMessages.push({ role: 'user', content: agent.name || agent.subject || 'Subject' });
                window.dispatchEvent(new CustomEvent('canvas-push-lesson-plan-typing', { detail: { text: 'What resources are available?' } }));
                if (typeof scheduleSaveCanvasState === 'function') scheduleSaveCanvasState();
            },
            async pollLessonPlanTask() {
                const s = store();
                if (!s.lessonPlan.taskId) return;
                const url = taskStatusUrl.replace('__TASK_ID__', s.lessonPlan.taskId);
                try {
                    const res = await fetch(url);
                    const data = await res.json();
                    if (data.state === 'SUCCESS' && data.result && data.result.draft_id) {
                        s.lessonPlan.draftId = data.result.draft_id;
                        s.lessonPlan.step = 5;
                        s.lessonPlan.wizardActive = false;
                        s.lessonPlan.chatMode = 'ask';
                        persistLessonPlanDraft(data.result.draft_id);
                        const contentUrl = draftContentUrl.replace('__DRAFT_ID__', data.result.draft_id);
                        const cr = await fetch(contentUrl);
                        if (cr.ok) {
                            s.lessonPlan.content = await cr.json();
                            s.lessonPlanMessages = [];
                            window.dispatchEvent(new CustomEvent('canvas-push-lesson-plan-typing', { detail: { text: 'Lesson plan created. It\'s shown in the canvas.' } }));
                            fetchLessonPlanWelcomeTips(s);
                        }
                        s.lessonPlan.loading = false;
                        s.lessonPlan.taskId = null;
                        return;
                    }
                    if (data.state === 'SUCCESS' && data.result && (data.result.status === 'error' || !data.result.draft_id)) {
                        s.lessonPlan.error = data.result.message || 'Task completed with an error.';
                        window.dispatchEvent(new CustomEvent('canvas-push-lesson-plan-typing', { detail: { text: 'Error: ' + (s.lessonPlan.error) } }));
                        s.lessonPlan.loading = false;
                        s.lessonPlan.taskId = null;
                        if (!s.lessonPlan.draftId) { s.lessonPlan.wizardActive = true; s.lessonPlan.wizardStep = 5; }
                        return;
                    }
                    if (data.state === 'FAILURE') {
                        s.lessonPlan.error = data.error || 'Task failed';
                        window.dispatchEvent(new CustomEvent('canvas-push-lesson-plan-typing', { detail: { text: 'Error: ' + (s.lessonPlan.error) } }));
                        s.lessonPlan.loading = false;
                        s.lessonPlan.taskId = null;
                        if (!s.lessonPlan.draftId) { s.lessonPlan.wizardActive = true; s.lessonPlan.wizardStep = 5; }
                        return;
                    }
                } catch (e) {
                    s.lessonPlan.error = e.message || 'Poll failed';
                    s.lessonPlan.loading = false;
                    s.lessonPlan.taskId = null;
                    if (!s.lessonPlan.draftId) { s.lessonPlan.wizardActive = true; s.lessonPlan.wizardStep = 5; }
                    return;
                }
                setTimeout(() => this.pollLessonPlanTask(), 1500);
            },
            async pollEnhanceTask(taskId) {
                const s = store();
                const url = taskStatusUrl.replace('__TASK_ID__', taskId);
                try {
                    const res = await fetch(url);
                    const data = await res.json();
                    if (data.state === 'SUCCESS' && data.result) {
                        if (data.result.content != null && s.lessonPlan && s.lessonPlan.content) {
                            s.lessonPlan.content.main_content = data.result.content;
                            s.lessonPlanJustUpdated = true;
                            setTimeout(() => { s.lessonPlanJustUpdated = false; }, 600);
                            var promptText = (s.lessonPlan.lastEnhancePrompt || '').replace(/"/g, '\u201c');
                            window.dispatchEvent(new CustomEvent('canvas-type-last-lesson-plan-message', { detail: { text: promptText ? "I've updated the lesson plan based on your request: \"" + promptText + "\". The changes are shown in the canvas." : "I've updated the lesson plan. It's shown in the canvas." } }));
                            s.lessonPlan.lastEnhancePrompt = '';
                        }
                        s.lessonPlan.loading = false;
                        s.lessonPlanAmendingAt = null;
                        return;
                    }
                    if (data.state === 'FAILURE') {
                        window.dispatchEvent(new CustomEvent('canvas-type-last-lesson-plan-message', { detail: { text: 'Error: ' + (data.error || 'Failed to update lesson plan') } }));
                        s.lessonPlan.loading = false;
                        s.lessonPlanAmendingAt = null;
                        return;
                    }
                } catch (e) {
                    window.dispatchEvent(new CustomEvent('canvas-type-last-lesson-plan-message', { detail: { text: 'Error: ' + (e.message || 'Network error') } }));
                    s.lessonPlan.loading = false;
                    s.lessonPlanAmendingAt = null;
                    return;
                }
                setTimeout(() => this.pollEnhanceTask(taskId), 1500);
            },
            async applyAdvice(content) {
                const s = store();
                if (!s.lessonPlan.draftId || !content || !String(content).trim()) return;
                s.lessonPlan.loading = true;
                window.dispatchEvent(new CustomEvent('canvas-push-lesson-plan-typing', { detail: { text: 'Applying to the lesson plan…' } }));
                try {
                    const enhanceUrl = enhanceLessonPlanUrl.replace('__DRAFT_ID__', s.lessonPlan.draftId);
                    const history = s.lessonPlanMessages.slice(0, -1).slice(-10).map(m => ({ role: m.role, content: m.content }));
                    const res = await fetch(enhanceUrl, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ section: 'main', prompt: String(content).trim(), conversation_history: history, ai_model: s.aiModel }),
                        credentials: 'include'
                    });
                    const data = await res.json();
                    if (res.status === 202 && data.task_id) this.pollEnhanceTask(data.task_id);
                    else if (res.ok && data.status === 'success' && data.content) {
                        if (!s.lessonPlan.content) s.lessonPlan.content = {};
                        s.lessonPlan.content.main_content = data.content;
                        window.dispatchEvent(new CustomEvent('canvas-type-last-lesson-plan-message', { detail: { text: 'Applied to the lesson plan.' } }));
                        s.lessonPlan.loading = false;
                    } else {
                        window.dispatchEvent(new CustomEvent('canvas-type-last-lesson-plan-message', { detail: { text: 'Error: ' + (data.error || 'Failed to update lesson plan') } }));
                        s.lessonPlan.loading = false;
                    }
                } catch (e) {
                    window.dispatchEvent(new CustomEvent('canvas-type-last-lesson-plan-message', { detail: { text: 'Error: ' + (e.message || 'Network error') } }));
                    s.lessonPlan.loading = false;
                }
            },
            wrapSelectionForAmend() {
                const container = document.getElementById('canvas-lesson-plan-content');
                if (!container) return;
                const sel = window.getSelection();
                if (!sel || !sel.rangeCount) return;
                const range = sel.getRangeAt(0);
                if (!container.contains(range.startContainer) || range.collapsed) return;
                try {
                    const span = document.createElement('span');
                    span.className = 'lesson-plan-editing-delete';
                    range.surroundContents(span);
                } catch (_) {}
            },
            handleLessonPlanMouseUp(ev) {
                const s = store();
                if (s.currentAction !== 'lesson_plan' || !s.lessonPlan.draftId || s.lessonPlan.loading) return;
                const sel = window.getSelection();
                const text = (sel && sel.toString()) ? sel.toString().trim() : '';
                const container = document.getElementById('canvas-lesson-plan-content');
                if (!text || !container || !container.contains(sel.anchorNode)) {
                    s.lessonPlanSelectionMenu = null;
                    return;
                }
                s.lessonPlanImageDeleteMenu = null;
                let x = 0, y = 0;
                if (sel.rangeCount) {
                    const rect = sel.getRangeAt(0).getBoundingClientRect();
                    x = rect.left;
                    y = rect.bottom + 4;
                }
                s.lessonPlanSelectionMenu = { text: text, x: x, y: y };
            },
            handleLessonPlanPreviewClick(ev) {
                const s = store();
                if (s.currentAction !== 'lesson_plan' || !s.lessonPlan.draftId || s.lessonPlan.loading || s.lessonPlanManualEditMode) return;
                const container = document.getElementById('canvas-lesson-plan-content');
                if (!container) return;
                const target = ev && ev.target ? ev.target : null;
                if (!target || !container.contains(target)) {
                    s.lessonPlanImageDeleteMenu = null;
                    return;
                }
                const clickedImage = target.closest('.lesson-plan-prose img');
                if (!clickedImage) {
                    if (!target.closest('.lesson-plan-image-delete-menu')) s.lessonPlanImageDeleteMenu = null;
                    return;
                }
                const src = String(clickedImage.getAttribute('src') || '').trim();
                if (!src) return;
                const rect = clickedImage.getBoundingClientRect();
                s.lessonPlanSelectionMenu = null;
                s.lessonPlanImageDeleteMenu = {
                    url: src,
                    x: Math.max(8, rect.left + (window.scrollX || 0)),
                    y: Math.max(8, rect.bottom + (window.scrollY || 0) + 6)
                };
                try {
                    const sel = window.getSelection();
                    if (sel) sel.removeAllRanges();
                } catch (_) {}
            },
            async applySelectionAction(actionLabel) {
                const s = store();
                if (!s.lessonPlanSelectionMenu || !s.lessonPlan.draftId || !s.lessonPlan.content || !s.lessonPlan.content.main_content) return;
                const selectedText = s.lessonPlanSelectionMenu.text;
                const menuX = s.lessonPlanSelectionMenu.x, menuY = s.lessonPlanSelectionMenu.y;
                s.lessonPlanSelectionMenu = null;
                s.lessonPlanImageDeleteMenu = null;
                s.lessonPlanAmendingAt = { x: menuX, y: menuY };
                s.lessonPlan.loading = true;
                const prompt = 'Change ONLY the following selected excerpt. Do not modify any other part of the lesson plan. Selected excerpt to ' + actionLabel.toLowerCase() + ':\n\n"""\n' + selectedText + '\n"""';
                try {
                    const enhanceUrl = enhanceLessonPlanUrl.replace('__DRAFT_ID__', s.lessonPlan.draftId);
                    const res = await fetch(enhanceUrl, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ section: 'main', prompt, conversation_history: [], ai_model: s.aiModel, selection_only: true }),
                        credentials: 'include'
                    });
                    const data = await res.json();
                    if (res.status === 202 && data.task_id) this.pollEnhanceTask(data.task_id);
                    else if (res.ok && data.status === 'success' && data.content) {
                        if (!s.lessonPlan.content) s.lessonPlan.content = {};
                        s.lessonPlan.content.main_content = data.content;
                        s.lessonPlanJustUpdated = true;
                        setTimeout(() => { s.lessonPlanJustUpdated = false; }, 600);
                        s.lessonPlan.loading = false;
                        s.lessonPlanAmendingAt = null;
                    } else {
                        s.lessonPlan.loading = false;
                        s.lessonPlanAmendingAt = null;
                    }
                } catch (e) {
                    s.lessonPlan.loading = false;
                    s.lessonPlanAmendingAt = null;
                }
            },
            handleSenPlanningMouseUp(ev) {
                const s = store();
                if (s.currentAction !== 'sen_planning' || !s.senPlanning.chatId || s.senPlanning.loading) return;
                const sel = window.getSelection();
                const text = (sel && sel.toString()) ? sel.toString().trim() : '';
                const container = document.getElementById('canvas-sen-planning-content');
                if (!text || !container || !container.contains(sel.anchorNode)) {
                    s.senPlanning.selectionMenu = null;
                    return;
                }
                let x = 0, y = 0;
                if (sel.rangeCount) {
                    const rect = sel.getRangeAt(0).getBoundingClientRect();
                    x = rect.left;
                    y = rect.bottom + 4;
                }
                s.senPlanning.selectionMenu = { text: text, x: x, y: y };
            },
            async applySenPlanningSelectionAction(actionLabel) {
                const s = store();
                if (!s.senPlanning.selectionMenu || !s.senPlanning.chatId || !s.senPlanning.contentMarkdown || s.senPlanning.loading) return;
                const selectedText = s.senPlanning.selectionMenu.text;
                const menuX = s.senPlanning.selectionMenu.x, menuY = s.senPlanning.selectionMenu.y;
                s.senPlanning.selectionMenu = null;
                s.senPlanning.amendingAt = { x: menuX, y: menuY };
                s.senPlanning.loading = true;
                const prompt = 'Change ONLY the following selected excerpt. Do not modify any other part of the document. Selected excerpt to ' + actionLabel.toLowerCase() + ':\n\n"""\n' + selectedText + '\n"""';
                try {
                    const enhanceUrl = typeof senPlanningEnhanceUrl !== 'undefined' ? senPlanningEnhanceUrl : '/sen_planning/enhance';
                    const res = await fetch(enhanceUrl, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ chat_id: s.senPlanning.chatId, prompt: prompt, selection_only: true, selected_text: selectedText, ai_model: s.aiModel }),
                        credentials: 'include'
                    });
                    const data = await res.json();
                    if (res.status === 202 && data.task_id) this.pollSenPlanningEnhanceTask(data.task_id);
                    else if (res.ok && data.status === 'success' && data.content != null) {
                        s.senPlanning.contentMarkdown = data.content;
                        s.senPlanning.loading = false;
                        s.senPlanning.amendingAt = null;
                        if (typeof s.persistSenActivity === 'function') s.persistSenActivity();
                    } else {
                        s.senPlanning.loading = false;
                        s.senPlanning.amendingAt = null;
                    }
                } catch (e) {
                    s.senPlanning.loading = false;
                    s.senPlanning.amendingAt = null;
                }
            },
            async pollSenPlanningEnhanceTask(taskId) {
                const s = store();
                const url = (typeof taskStatusUrl !== 'undefined' ? taskStatusUrl : '/task_status/__TASK_ID__').replace('__TASK_ID__', taskId);
                try {
                    const res = await fetch(url);
                    const data = await res.json();
                    if (data.state === 'SUCCESS' && data.result && data.result.content != null && s.senPlanning) {
                        s.senPlanning.contentMarkdown = data.result.content;
                        s.senPlanning.loading = false;
                        s.senPlanning.amendingAt = null;
                        if (typeof s.persistSenActivity === 'function') s.persistSenActivity();
                        return;
                    }
                    if (data.state === 'FAILURE') {
                        s.senPlanning.loading = false;
                        s.senPlanning.amendingAt = null;
                        return;
                    }
                } catch (e) {
                    if (s.senPlanning) { s.senPlanning.loading = false; s.senPlanning.amendingAt = null; }
                    return;
                }
                setTimeout(() => this.pollSenPlanningEnhanceTask(taskId), 1500);
            },
            renderLessonPlanMarkdown() {
                const s = store();
                if (!s.lessonPlan.content || !s.lessonPlan.content.main_content) return '';
                const raw = s.lessonPlan.content.main_content;
                if (typeof LessonPlanMarkdown !== 'undefined' && typeof LessonPlanMarkdown.renderLessonPlanMarkdown === 'function') {
                    return LessonPlanMarkdown.renderLessonPlanMarkdown(raw);
                }
                if (typeof marked !== 'undefined') return marked.parse(raw);
                return raw.replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/\n/g, '<br>');
            },
            async saveLessonPlanManualEdit() {
                const s = store();
                if (!s.lessonPlan.draftId || !s.lessonPlan.content || s.lessonPlan.content.main_content == null) return;
                const url = updateLessonPlanContentUrl.replace('__DRAFT_ID__', s.lessonPlan.draftId);
                try {
                    const res = await fetch(url, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ section: 'main', content: s.lessonPlan.content.main_content }),
                        credentials: 'include'
                    });
                    if (res.ok) {
                        s.lessonPlanManualEditMode = false;
                        s.lessonPlanJustUpdated = true;
                        setTimeout(() => { s.lessonPlanJustUpdated = false; }, 600);
                    }
                } catch (e) {}
            },
            async createImageFromSelection() {
                const s = store();
                if (!s.lessonPlanSelectionMenu || !s.lessonPlan.draftId || !s.lessonPlan.content || !s.lessonPlan.content.main_content) return;
                const selectedText = s.lessonPlanSelectionMenu.text;
                s.lessonPlanSelectionMenu = null;
                s.lessonPlanImageDeleteMenu = null;
                s.lessonPlan.loading = true;
                const formData = new FormData();
                formData.append('prompt', 'Illustration for lesson plan: ' + selectedText);
                formData.append('style', (s.imageCreatorStyle || 'Photorealistic'));
                formData.append('size', (s.imageCreatorSize || '512'));
                formData.append('model', (s.imageCreatorModel || 'runware:400@2'));
                try {
                    const submitRes = await fetch(imageCreatorSubmitUrl, { method: 'POST', body: formData, credentials: 'include' });
                    const submitData = await submitRes.json();
                    if (submitRes.status !== 202 || !submitData.task_id) {
                        s.lessonPlan.loading = false;
                        return;
                    }
                    const imageUrl = await this.pollImageCreatorForLessonPlan(submitData.task_id);
                    s.lessonPlan.loading = false;
                    if (!imageUrl) return;
                    const main = s.lessonPlan.content.main_content;
                    const imageMarkdown = '![Generated image](' + imageUrl + ')';
                    const newContent = this.insertImageAfterSentence(main, selectedText, imageMarkdown);
                    s.lessonPlan.content.main_content = newContent;
                    const updateUrl = updateLessonPlanContentUrl.replace('__DRAFT_ID__', s.lessonPlan.draftId);
                    await fetch(updateUrl, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ section: 'main', content: newContent }),
                        credentials: 'include'
                    });
                    s.lessonPlanJustUpdated = true;
                    setTimeout(() => { s.lessonPlanJustUpdated = false; }, 600);
                } catch (e) {
                    s.lessonPlan.loading = false;
                }
            },
            pollImageCreatorForLessonPlan(taskId) {
                const self = this;
                return new Promise((resolve) => {
                    function poll() {
                        fetch(imageCreatorResultBaseUrl + taskId, { credentials: 'include' })
                            .then(r => r.json())
                            .then(data => {
                                if (data.status === 'PENDING') {
                                    setTimeout(poll, 1500);
                                    return;
                                }
                                if (data.status === 'SUCCESS' && data.image_url) resolve(data.image_url);
                                else resolve(null);
                            })
                            .catch(() => resolve(null));
                    }
                    poll();
                });
            },
            async handleLessonPlanUploadImage(ev) {
                const s = store();
                const file = ev.target && ev.target.files && ev.target.files[0];
                ev.target.value = '';
                if (!file || !s.lessonPlan.draftId || !s.lessonPlan.content) return;
                const formData = new FormData();
                formData.append('image', file);
                formData.append('draft_id', s.lessonPlan.draftId);
                try {
                    const res = await fetch(lessonPlanUploadImageUrl, { method: 'POST', body: formData, credentials: 'include' });
                    const data = await res.json();
                    if (!data.success || !data.image_url) return;
                    const main = s.lessonPlan.content.main_content || '';
                    const selectedText = s.lessonPlanSelectionMenu && s.lessonPlanSelectionMenu.text;
                    const imageMarkdown = '![' + (file.name || 'image') + '](' + data.image_url + ')';
                    const newContent = this.insertImageAfterSentence(main, selectedText, imageMarkdown);
                    s.lessonPlanSelectionMenu = null;
                    s.lessonPlanImageDeleteMenu = null;
                    s.lessonPlan.content.main_content = newContent;
                    const updateUrl = updateLessonPlanContentUrl.replace('__DRAFT_ID__', s.lessonPlan.draftId);
                    await fetch(updateUrl, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ section: 'main', content: newContent }),
                        credentials: 'include'
                    });
                    s.lessonPlanJustUpdated = true;
                    setTimeout(() => { s.lessonPlanJustUpdated = false; }, 600);
                } catch (e) {}
            },
            async deleteLessonPlanImage(targetUrl) {
                const s = store();
                const imageUrl = String(targetUrl || '').trim();
                if (!imageUrl || !s.lessonPlan.draftId || !s.lessonPlan.content || !s.lessonPlan.content.main_content) return;
                const escapeRegExp = (value) => String(value || '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
                const escapedUrl = escapeRegExp(imageUrl);
                const imagePattern = new RegExp('!\\[[^\\]]*\\]\\(\\s*<?' + escapedUrl + '>?(?:\\s+["\'][^"\']*["\'])?\\s*\\)');
                const currentContent = String(s.lessonPlan.content.main_content || '');
                if (!imagePattern.test(currentContent)) {
                    s.lessonPlanImageDeleteMenu = null;
                    return;
                }
                const updatedContent = currentContent
                    .replace(imagePattern, '')
                    .replace(/[ \t]+\n/g, '\n')
                    .replace(/\n{3,}/g, '\n\n')
                    .replace(/^\n+/, '');
                s.lessonPlan.loading = true;
                s.lessonPlanImageDeleteMenu = null;
                try {
                    const updateUrl = updateLessonPlanContentUrl.replace('__DRAFT_ID__', s.lessonPlan.draftId);
                    const res = await fetch(updateUrl, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ section: 'main', content: updatedContent }),
                        credentials: 'include'
                    });
                    if (!res.ok) {
                        s.lessonPlan.loading = false;
                        return;
                    }
                    s.lessonPlan.content.main_content = updatedContent;
                    s.lessonPlanJustUpdated = true;
                    setTimeout(() => { s.lessonPlanJustUpdated = false; }, 600);
                    s.lessonPlan.loading = false;
                } catch (e) {
                    s.lessonPlan.loading = false;
                }
            },
            insertImageAfterSentence(content, anchorText, imageMarkdown) {
                const src = String(content || '');
                const block = String(imageMarkdown || '').trim();
                if (!block) return src;
                const anchor = String(anchorText || '').trim();
                if (!anchor) {
                    return src + (/\n$/.test(src) ? '\n' : '\n\n') + block + '\n';
                }
                const normalizeWs = (s) => String(s || '').replace(/\u00a0/g, ' ').replace(/\s+/g, ' ').trim();
                const normalizedWithMap = (text) => {
                    const t = String(text || '');
                    let out = '';
                    const map = [];
                    let prevWs = false;
                    for (let i = 0; i < t.length; i++) {
                        const ch = t.charAt(i);
                        const isWs = /\s/.test(ch);
                        if (isWs) {
                            if (!prevWs) {
                                out += ' ';
                                map.push(i);
                                prevWs = true;
                            }
                        } else {
                            out += ch;
                            map.push(i);
                            prevWs = false;
                        }
                    }
                    return { text: out, map };
                };

                let anchorStart = src.indexOf(anchor);
                let anchorEnd = anchorStart >= 0 ? anchorStart + anchor.length : -1;
                if (anchorStart < 0) {
                    const normAnchor = normalizeWs(anchor);
                    const norm = normalizedWithMap(src);
                    const pos = norm.text.indexOf(normAnchor);
                    if (pos >= 0) {
                        anchorStart = norm.map[pos];
                        const endNorm = pos + normAnchor.length - 1;
                        anchorEnd = (endNorm >= 0 && endNorm < norm.map.length) ? (norm.map[endNorm] + 1) : anchorStart + normAnchor.length;
                    }
                }

                if (anchorStart < 0 || anchorEnd < 0) {
                    return src + (/\n$/.test(src) ? '\n' : '\n\n') + block + '\n';
                }
                let sentenceEnd = -1;
                for (let i = anchorEnd; i < src.length; i++) {
                    const ch = src.charAt(i);
                    if (ch === '.' || ch === '!' || ch === '?') {
                        sentenceEnd = i + 1;
                        break;
                    }
                    if (ch === '\n') break;
                }
                const insertAt = sentenceEnd > 0 ? sentenceEnd : anchorEnd;
                return src.slice(0, insertAt) + '\n\n' + block + '\n\n' + src.slice(insertAt);
            },
            async createWorkspaceLessonImage() {
                const s = store();
                if (!s.lessonPlan || !s.lessonPlan.draftId) return;
                const prompt = String((s.lessonPlan.data && s.lessonPlan.data.workspace_image_prompt) || '').trim();
                if (!prompt) return;
                const formData = new FormData();
                formData.append('prompt', 'Illustration for lesson plan: ' + prompt);
                formData.append('style', (s.imageCreatorStyle || 'Photorealistic'));
                formData.append('size', (s.imageCreatorSize || '512'));
                formData.append('model', (s.imageCreatorModel || 'runware:400@2'));
                try {
                    const submitRes = await fetch(imageCreatorSubmitUrl, { method: 'POST', body: formData, credentials: 'include' });
                    const submitData = await submitRes.json();
                    if (submitRes.status !== 202 || !submitData.task_id) return;
                    const imageUrl = await this.pollImageCreatorForLessonPlan(submitData.task_id);
                    if (!imageUrl) return;
                    if (!s.lessonPlan.data) s.lessonPlan.data = {};
                    s.lessonPlan.data.workspace_image_url = imageUrl;
                    s.lessonPlan.data.workspace_image_alt = prompt || 'Generated image';
                } catch (e) {}
            },
            async enhanceWorkspaceLessonImagePrompt() {
                const s = store();
                if (!s.lessonPlan || !s.lessonPlan.data) return;
                if (s.lessonPlan.data.workspace_image_prompt_enhancing) return;
                const prompt = String(s.lessonPlan.data.workspace_image_prompt || '').trim();
                if (!prompt) return;
                const url = typeof imageCreatorEnhancePromptUrl !== 'undefined' && imageCreatorEnhancePromptUrl
                    ? imageCreatorEnhancePromptUrl
                    : '/image_creator/enhance_prompt';
                s.lessonPlan.data.workspace_image_prompt_enhancing = true;
                try {
                    const res = await fetch(url, {
                        method: 'POST',
                        credentials: 'include',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                            prompt: prompt,
                            style: s.imageCreatorStyle || 'Photorealistic',
                            size: s.imageCreatorSize || '512'
                        })
                    });
                    const data = await res.json().catch(() => ({}));
                    if (res.ok && data && data.enhanced_prompt) {
                        s.lessonPlan.data.workspace_image_prompt = data.enhanced_prompt;
                    } else {
                        window.alert((data && data.error) || 'Could not enhance image prompt.');
                    }
                } catch (e) {
                    window.alert('Network error while enhancing image prompt.');
                } finally {
                    s.lessonPlan.data.workspace_image_prompt_enhancing = false;
                }
            },
            async handleWorkspaceLessonImageUpload(ev) {
                const s = store();
                const file = ev.target && ev.target.files && ev.target.files[0];
                ev.target.value = '';
                if (!file || !s.lessonPlan || !s.lessonPlan.draftId) return;
                const formData = new FormData();
                formData.append('image', file);
                formData.append('draft_id', s.lessonPlan.draftId);
                try {
                    const res = await fetch(lessonPlanUploadImageUrl, { method: 'POST', body: formData, credentials: 'include' });
                    const data = await res.json();
                    if (!data.success || !data.image_url) return;
                    if (!s.lessonPlan.data) s.lessonPlan.data = {};
                    s.lessonPlan.data.workspace_image_url = data.image_url;
                    s.lessonPlan.data.workspace_image_alt = (file.name || 'Uploaded image');
                } catch (e) {}
            },
            async insertWorkspaceLessonImage() {
                const s = store();
                if (!s.lessonPlan || !s.lessonPlan.draftId || !s.lessonPlan.data || !s.lessonPlan.data.workspace_image_url) return;
                if (!window.LessonPlanPlaceholderWorkspace || typeof window.LessonPlanPlaceholderWorkspace.insertImage !== 'function') return;
                const alt = s.lessonPlan.data.workspace_image_alt || 'Lesson image';
                const url = s.lessonPlan.data.workspace_image_url;
                const anchor = s.lessonPlanSelectionMenu && s.lessonPlanSelectionMenu.text ? s.lessonPlanSelectionMenu.text : '';
                try {
                    await window.LessonPlanPlaceholderWorkspace.insertImage('main', alt, url, { anchorText: anchor });
                } catch (e) {}
            },
            async loadSharePointSites() {
                const s = store();
                if (s.lessonPlanExport.sharePointSites.length > 0) return;
                try {
                    const res = await fetch('/sharepoint_sites');
                    if (res.ok) s.lessonPlanExport.sharePointSites = await res.json();
                } catch (e) { s.lessonPlanExport.error = e.message || 'Failed to load SharePoint sites'; }
            },
            async exportToOneDrive() {
                const s = store();
                if (!s.lessonPlan.draftId) return;
                s.lessonPlanExport.loading = true;
                s.lessonPlanExport.error = '';
                s.lessonPlanExport.successLink = '';
                s.lessonPlanExport.lastExportAddedToCalendar = false;
                const fallbackName = this.buildLessonExportFallbackName();
                const filename = this.buildLessonExportBaseName(s.lessonPlanExport.filename, fallbackName, /\.docx$/i);
                const outlookDate = (s.lessonPlanExport.outlookDate && s.lessonPlanExport.outlookDate.trim()) ? s.lessonPlanExport.outlookDate.trim() : null;
                const outlookTime = (s.lessonPlanExport.outlookTime && s.lessonPlanExport.outlookTime.trim()) ? s.lessonPlanExport.outlookTime.trim() : null;
                s.lessonPlanExport.lastExportAddedToCalendar = !!(outlookDate && outlookTime);
                try {
                    const res = await fetch(`/lesson_plan/export/${s.lessonPlan.draftId}`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ output_format: 'word', save_location: 'onedrive', filename, outlook_date: outlookDate, outlook_time: outlookTime, image_style: (s.lessonPlanImageStyle || 'childrens_storybook') }),
                    });
                    if (!res.ok) { const data = await res.json().catch(() => ({})); s.lessonPlanExport.error = data.error || 'Failed to start export'; s.lessonPlanExport.loading = false; return; }
                    const data = await res.json();
                    if (data.task_id) this.pollExportTask(data.task_id);
                    else { s.lessonPlanExport.error = 'No task_id returned'; s.lessonPlanExport.loading = false; }
                } catch (e) { s.lessonPlanExport.error = e.message || 'Network error'; s.lessonPlanExport.loading = false; }
            },
            async exportAsPdf() {
                const s = store();
                if (!s.lessonPlan.draftId) return;
                s.lessonPlanExport.loading = true;
                s.lessonPlanExport.error = '';
                s.lessonPlanExport.successLink = '';
                s.lessonPlanExport.lastExportAddedToCalendar = false;
                const fallbackName = this.buildLessonExportFallbackName();
                const filename = this.buildLessonExportBaseName(s.lessonPlanExport.filename, fallbackName, /\.pdf$/i);
                const outlookDate = (s.lessonPlanExport.outlookDate && s.lessonPlanExport.outlookDate.trim()) ? s.lessonPlanExport.outlookDate.trim() : null;
                const outlookTime = (s.lessonPlanExport.outlookTime && s.lessonPlanExport.outlookTime.trim()) ? s.lessonPlanExport.outlookTime.trim() : null;
                s.lessonPlanExport.lastExportAddedToCalendar = !!(outlookDate && outlookTime);
                try {
                    const res = await fetch(`/lesson_plan/export/${s.lessonPlan.draftId}`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ output_format: 'pdf', save_location: 'onedrive', filename, outlook_date: outlookDate, outlook_time: outlookTime, image_style: (s.lessonPlanImageStyle || 'childrens_storybook') }),
                    });
                    if (!res.ok) { const data = await res.json().catch(() => ({})); s.lessonPlanExport.error = data.error || 'Failed to start export'; s.lessonPlanExport.loading = false; return; }
                    const data = await res.json();
                    if (data.task_id) this.pollExportTask(data.task_id);
                    else { s.lessonPlanExport.error = 'No task_id returned'; s.lessonPlanExport.loading = false; }
                } catch (e) { s.lessonPlanExport.error = e.message || 'Network error'; s.lessonPlanExport.loading = false; }
            },
            async exportToOneNote() {
                const s = store();
                if (!s.lessonPlan.draftId) return;
                s.lessonPlanExport.loading = true;
                s.lessonPlanExport.error = '';
                s.lessonPlanExport.successLink = '';
                s.lessonPlanExport.lastExportAddedToCalendar = false;
                const fallbackName = this.buildLessonExportFallbackName();
                const filename = this.buildLessonExportBaseName(s.lessonPlanExport.filename, fallbackName, null);
                const outlookDate = (s.lessonPlanExport.outlookDate && s.lessonPlanExport.outlookDate.trim()) ? s.lessonPlanExport.outlookDate.trim() : null;
                const outlookTime = (s.lessonPlanExport.outlookTime && s.lessonPlanExport.outlookTime.trim()) ? s.lessonPlanExport.outlookTime.trim() : null;
                s.lessonPlanExport.lastExportAddedToCalendar = !!(outlookDate && outlookTime);
                try {
                    const res = await fetch(`/lesson_plan/export/${s.lessonPlan.draftId}`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ output_format: 'onenote', save_location: 'onedrive', filename, outlook_date: outlookDate, outlook_time: outlookTime, image_style: (s.lessonPlanImageStyle || 'childrens_storybook') }),
                    });
                    if (!res.ok) { const data = await res.json().catch(() => ({})); s.lessonPlanExport.error = data.error || 'Failed to start export'; s.lessonPlanExport.loading = false; return; }
                    const data = await res.json();
                    if (data.task_id) this.pollExportTask(data.task_id);
                    else { s.lessonPlanExport.error = 'No task_id returned'; s.lessonPlanExport.loading = false; }
                } catch (e) { s.lessonPlanExport.error = e.message || 'Network error'; s.lessonPlanExport.loading = false; }
            },
            async exportToSharePoint() {
                const s = store();
                if (!s.lessonPlan.draftId || !s.lessonPlanExport.selectedSharePointSiteId) {
                    s.lessonPlanExport.error = 'Please select a SharePoint site.';
                    return;
                }
                s.lessonPlanExport.loading = true;
                s.lessonPlanExport.error = '';
                s.lessonPlanExport.successLink = '';
                s.lessonPlanExport.lastExportAddedToCalendar = false;
                const fallbackName = this.buildLessonExportFallbackName();
                const filename = this.buildLessonExportBaseName(s.lessonPlanExport.filename, fallbackName, null);
                const outputFormat = s.lessonPlanExport.format || 'word';
                try {
                    const res = await fetch(`/lesson_plan/export/${s.lessonPlan.draftId}`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ output_format: outputFormat, save_location: 'sharepoint', site_id: s.lessonPlanExport.selectedSharePointSiteId, filename, outlook_date: null, outlook_time: null, image_style: (s.lessonPlanImageStyle || 'childrens_storybook') }),
                    });
                    if (!res.ok) { const data = await res.json().catch(() => ({})); s.lessonPlanExport.error = data.error || 'Failed to start export'; s.lessonPlanExport.loading = false; return; }
                    const data = await res.json();
                    if (data.task_id) this.pollExportTask(data.task_id);
                    else { s.lessonPlanExport.error = 'No task_id returned'; s.lessonPlanExport.loading = false; }
                } catch (e) { s.lessonPlanExport.error = e.message || 'Network error'; s.lessonPlanExport.loading = false; }
            },
            async pollExportTask(taskId) {
                const s = store();
                try {
                    const res = await fetch(taskStatusUrl.replace('__TASK_ID__', taskId));
                    const data = await res.json();
                    if (data.state === 'PENDING' || data.state === 'PROGRESS') {
                        setTimeout(() => this.pollExportTask(taskId), 2000);
                        return;
                    }
                    if (data.state === 'SUCCESS') {
                        s.lessonPlanExport.successLink = (data.result || {}).file_link || '';
                        s.lessonPlanExport.loading = false;
                        return;
                    }
                    s.lessonPlanExport.error = data.error || 'Export failed';
                } catch (e) { s.lessonPlanExport.error = e.message || 'Export status check failed'; }
                s.lessonPlanExport.loading = false;
            }
        };
    });

    function restoreLessonPlanOnLoad() {
        var params = new URLSearchParams(window.location.search);
        var draftIdFromUrl = params.get('draft_id');
        var draftIdFromStorage = '';
        try { draftIdFromStorage = localStorage.getItem(CANVAS_DRAFT_KEY) || ''; } catch (e) {}
        var draftId = (draftIdFromUrl || draftIdFromStorage).trim();
        if (!draftId) return;
        var store = Alpine.store('canvas');
        if (!store) return;
        canvasLessonPlanRestoredFromDraft = true;
        store.currentAction = 'lesson_plan';
        syncCanvasChromeLinkTone(store);
        store.chatOnRight = true;
        store.chatPanelEntering = false;
        /* Mutate existing lessonPlan so Alpine reactivity keeps working */
        store.lessonPlan.step = 5;
        store.lessonPlan.wizardActive = false;
        store.lessonPlan.wizardStep = 1;
        store.lessonPlan.draftId = draftId;
        store.lessonPlan.content = null;
        store.lessonPlan.loading = true;
        store.lessonPlan.error = '';
        store.lessonPlan.chatMode = 'ask';
        store.lessonPlan.taskId = null;
        store.lessonPlan.data = {};
        store.lessonPlanMessages = [{ role: 'assistant', content: 'Lesson plan loaded. You can refine it in the chat or export it.' }];
        if (!draftIdFromUrl) persistLessonPlanDraft(draftId);
        var contentUrl = draftContentUrl.replace('__DRAFT_ID__', draftId);
        fetch(contentUrl, { credentials: 'include' })
            .then(function(r) { return r.ok ? r.json() : null; })
            .then(function(content) {
                if (content && store.lessonPlan && store.lessonPlan.draftId === draftId) {
                    store.lessonPlan.content = content;
                    store.lessonPlan.loading = false;
                    fetchLessonPlanWelcomeTips(store);
                }
            })
            .catch(function() { if (store.lessonPlan && store.lessonPlan.draftId === draftId) store.lessonPlan.loading = false; });
        if (typeof syncCanvasUrlParams === 'function') syncCanvasUrlParams(store);
    }

    /* Run restore after Alpine has initialized the DOM so the lesson plan view stays open on refresh */
    setTimeout(restoreLessonPlanOnLoad, 0);

    if (initialCanvasChatId) {
        setTimeout(function() {
            var threadGetBase = canvasThreadsGetBaseUrlSafe || '/canvasdashboard/chats/';
            fetch(threadGetBase + encodeURIComponent(initialCanvasChatId), { credentials: 'include' })
                .then(function(r) { return r.ok ? r.json() : null; })
                .then(function(ctx) {
                    if (!ctx) {
                        var base = canvasStateGetUrlSafe || '/api/canvas_state';
                        return fetch(base + '?canvas_chat_id=' + encodeURIComponent(initialCanvasChatId), { credentials: 'include' })
                            .then(function(r2) { return r2.ok ? r2.json() : null; })
                            .then(function(ctx2) { return ctx2; });
                    }
                    return ctx;
                })
                .then(function(ctx) {
                    if (!ctx) return;
                    var store = Alpine.store('canvas');
                    if (!store) return;
                    applyPersistedCanvasView(store, ctx);
                    if (store.currentAction || (store.messages && store.messages.length > 0)) {
                        store.initialChatStarted = true;
                        store.initialChatDone = true;
                        store.chatPromptEngaged = true;
                    } else {
                        window.dispatchEvent(new CustomEvent('canvas-run-greeting'));
                    }
                    if (typeof syncCanvasUrlParams === 'function') syncCanvasUrlParams(store);
                })
                .catch(function() {
                    window.dispatchEvent(new CustomEvent('canvas-run-greeting'));
                });
        }, 100);
    }

    Alpine.data('canvasApp', function() {
        const store = () => this.$store.canvas;
        return {
            streamUrl: streamUrl,

            getGreeting() {
                const h = new Date().getHours();
                if (h < 12) return 'Good morning';
                if (h < 18) return 'Good afternoon';
                return 'Good evening';
            },

            toggleComposerFilesMenu() {
                const s = this.$store.canvas;
                s.composerToolsMenuOpen = false;
                s.composerFilesMenuOpen = !s.composerFilesMenuOpen;
            },

            toggleComposerToolsMenu() {
                const s = this.$store.canvas;
                s.composerFilesMenuOpen = false;
                s.composerToolsMenuOpen = !s.composerToolsMenuOpen;
            },

            openUploadFilePicker() {
                const s = this.$store.canvas;
                s.composerFilesMenuOpen = false;
                const input = document.getElementById('canvas-temp-file-input');
                if (input) input.click();
            },

            async onTempFilePicked(ev) {
                const s = this.$store.canvas;
                const input = ev && ev.target;
                const file = input && input.files && input.files[0] ? input.files[0] : null;
                if (!file) return;
                s.tempFileUploadBusy = true;
                s.errorMsg = '';
                try {
                    const formData = new FormData();
                    formData.append('file', file);
                    const res = await fetch(canvasChatUploadTempFileUrl, {
                        method: 'POST',
                        credentials: 'include',
                        body: formData
                    });
                    const data = await res.json().catch(function() { return {}; });
                    if (!res.ok) throw new Error((data && data.error) || 'Upload failed');
                    if (data && data.upload && data.upload.ref) {
                        const keep = (s.sessionUploadFiles || []).filter(function(x) { return String(x.ref || '') !== String(data.upload.ref); });
                        keep.push({ ref: String(data.upload.ref), name: data.upload.name || file.name, source: 'upload' });
                        s.sessionUploadFiles = keep;
                    }
                } catch (e) {
                    s.errorMsg = e.message || 'Upload failed';
                } finally {
                    s.tempFileUploadBusy = false;
                    if (input) input.value = '';
                }
            },

            async openNotebookTreePicker() {
                const s = this.$store.canvas;
                s.composerFilesMenuOpen = false;
                if (!s.aiPersonaId) {
                    s.errorMsg = 'Select an agent first';
                    return;
                }
                s.notebookTreeOpen = true;
                s.notebookTreeLoading = true;
                s.notebookTreeError = '';
                try {
                    const base = canvasPersonaDocumentsTreeUrl || '/canvasdashboard/persona_documents_tree';
                    const res = await fetch(base + '?persona_id=' + encodeURIComponent(String(s.aiPersonaId)), { credentials: 'include' });
                    const data = await res.json().catch(function() { return {}; });
                    if (!res.ok) throw new Error((data && data.error) || 'Failed to load notebook tree');
                    s.notebookTreeData = (data && data.categories) || [];
                    var titleMap = Object.assign({}, s.notebookDocTitleById || {});
                    (s.notebookTreeData || []).forEach(function(cat) {
                        ((cat && cat.documents) || []).forEach(function(doc) {
                            var did = String((doc && doc.id) || '');
                            var dtitle = String((doc && doc.title) || '').trim();
                            if (did && dtitle) titleMap[did] = dtitle;
                        });
                    });
                    s.notebookDocTitleById = titleMap;
                    const expanded = {};
                    (s.notebookTreeData || []).forEach(function(c) { expanded[String(c.id)] = true; });
                    s.notebookTreeExpanded = expanded;
                } catch (e) {
                    s.notebookTreeError = e.message || 'Failed to load notebook tree';
                } finally {
                    s.notebookTreeLoading = false;
                }
            },

            toggleNotebookTreeCategory(catId) {
                const s = this.$store.canvas;
                const k = String(catId || '');
                s.notebookTreeExpanded[k] = !s.notebookTreeExpanded[k];
            },

            toggleNotebookSelection(docId, title) {
                const s = this.$store.canvas;
                const idStr = String(docId || '');
                if (!idStr) return;
                const arr = [...(s.sessionNotebookSelections || [])];
                const idx = arr.findIndex(function(x) { return String(x.id) === idStr; });
                if (idx >= 0) arr.splice(idx, 1);
                else arr.push({ id: idStr, title: title || ('Document ' + idStr), source: 'notebook' });
                s.sessionNotebookSelections = arr;
                var titleMap = Object.assign({}, s.notebookDocTitleById || {});
                titleMap[idStr] = title || ('Document ' + idStr);
                s.notebookDocTitleById = titleMap;
            },

            isNotebookSelected(docId) {
                const s = this.$store.canvas;
                const idStr = String(docId || '');
                return (s.sessionNotebookSelections || []).some(function(x) { return String(x.id) === idStr; });
            },

            closeNotebookTreePicker() {
                this.$store.canvas.notebookTreeOpen = false;
            },

            openComposerTool(toolName) {
                const s = this.$store.canvas;
                s.composerToolsMenuOpen = false;
                if (toolName === 'image') {
                    s.setAction('image_creator');
                    return;
                }
                if (toolName === 'lesson_plan') {
                    s.setAction('lesson_plan');
                    return;
                }
                if (toolName === 'quiz') {
                    s.setAction('quiz');
                }
            },

            removeSessionUploadFile(ref) {
                const s = this.$store.canvas;
                s.sessionUploadFiles = (s.sessionUploadFiles || []).filter(function(x) { return String(x.ref || '') !== String(ref || ''); });
            },

            removeSessionNotebookFile(docId) {
                const s = this.$store.canvas;
                s.sessionNotebookSelections = (s.sessionNotebookSelections || []).filter(function(x) { return String(x.id || '') !== String(docId || ''); });
            },

            initGreeting() {
                var canvasStore = Alpine.store('canvas');
                if (canvasStore) canvasStore.pushLessonPlanAssistantMessageWithTypingRef = this.pushLessonPlanAssistantMessageWithTyping.bind(this);
                if (canvasStore) canvasStore.startLessonPlanActionRef = this.startLessonPlanAction.bind(this);
                if (canvasStore && typeof canvasStore.loadRecentChats === 'function') canvasStore.loadRecentChats();
                if (canvasStore && typeof canvasStore.applyWorkspaceThemeForPersonaId === 'function') {
                    canvasStore.applyWorkspaceThemeForPersonaId(canvasStore.aiPersonaId || defaultPersonaId || '');
                }
                var self = this;
                if (typeof window.canvasLoadCurriculumLists === 'function') window.canvasLoadCurriculumLists();
                var ctxUrl = (C && C.canvasUserContextUrl) ? C.canvasUserContextUrl : '/api/canvas/user_context';
                var greetingStarted = false;
                function beginGreeting() {
                    if (greetingStarted) return;
                    greetingStarted = true;
                    if (typeof initialCanvasChatId === 'undefined' || !initialCanvasChatId) {
                        self.startGreetingTyping();
                        return;
                    }
                    window.addEventListener('canvas-run-greeting', function handler() {
                        window.removeEventListener('canvas-run-greeting', handler);
                        self.startGreetingTyping();
                    });
                }
                fetch(ctxUrl, { credentials: 'include' })
                    .then(function(r) { return r.json(); })
                    .then(function(data) {
                        var s = Alpine.store('canvas');
                        if (s && data && !data.error) {
                            if (data.user_greeting_role) s.greetingRole = data.user_greeting_role;
                            if (data.user_registration_groups) s.userRegistrationGroups = data.user_registration_groups;
                        }
                    })
                    .catch(function() {})
                    .finally(beginGreeting);
                setTimeout(beginGreeting, 1500);
            },

            startGreetingTyping() {
                this.startInitialChatTyping();
            },

            startInitialChatTyping() {
                const s = store.call(this);
                if (s.messages.length > 0) {
                    s.initialChatStarted = true;
                    s.initialChatDone = true;
                    return;
                }
                if (s.initialChatStarted) return;
                s.initialChatStarted = true;
                const blinkMs = 1000;
                const delayMs = 3 * blinkMs;

                if (s.greetingRole === 'teacher') {
                    const full = this.getGreeting() + ' ' + s.userFirstname + ', here are your registration groups if you wish to work on them..';
                    let i = 0;
                    setTimeout(() => {
                        const tick = setInterval(() => {
                            if (i < full.length) {
                                s.initialChatPart1 += full[i];
                                i++;
                            } else {
                                clearInterval(tick);
                                s.initialChatShowRegGroups = true;
                                s.initialChatDone = true;
                                this.startInitialChatPart2Typing();
                            }
                        }, 40);
                    }, delayMs);
                    return;
                }

                /* Admin / SLT / Other: single-line greeting */
                let suffix = '';
                if (s.greetingRole === 'admin') suffix = 'you can access admin on the left menu.';
                else if (s.greetingRole === 'slt') suffix = 'you can access senior leadership tools down the left.';
                else suffix = 'Atomas is at your command.';
                const full = this.getGreeting() + ' ' + s.userFirstname + ', ' + suffix;
                let j = 0;
                setTimeout(() => {
                    const tick = setInterval(() => {
                        if (j < full.length) {
                            s.initialChatPart1 += full[j];
                            j++;
                        } else {
                            clearInterval(tick);
                            s.initialChatShowRegGroups = true;
                            s.initialChatDone = true;
                        }
                    }, 40);
                }, delayMs);
            },

            startInitialChatPart2Typing() {
                const s = store.call(this);
                const hasRegGroups = s.userRegistrationGroups && s.userRegistrationGroups.length;
                const regLabel = hasRegGroups ? s.userRegistrationGroups[0] : 'your reg group';
                const full = hasRegGroups
                    ? ('Or choose one of the chat prompts above the chat input below. You can also choose from the menu on the left to get started. Or even just type "lesson plan for ' + regLabel + '" (or any of your reg groups).')
                    : 'Use the menu on the left to get started.';
                let i = 0;
                s.initialChatPart2 = '';
                s.initialChatPart2Done = false;
                const tick = setInterval(() => {
                    if (i < full.length) {
                        s.initialChatPart2 += full[i];
                        i++;
                    } else {
                        clearInterval(tick);
                        s.initialChatPart2Done = true;
                    }
                }, 25);
            },

            startConfirmMessageTyping(label) {
                const s = store.call(this);
                const full = 'Confirm you want a lesson plan for the class ' + label + '.';
                s.confirmMessageTyped = '';
                s.confirmMessageComplete = false;
                let i = 0;
                const t = setInterval(() => {
                    if (i < full.length) {
                        s.confirmMessageTyped += full[i];
                        i++;
                    } else {
                        s.confirmMessageComplete = true;
                        clearInterval(t);
                    }
                }, 35);
            },

            /** Type fullText into the last dashboard chat message (replaces content with typed effect). */
            typeLastDashboardMessage(fullText) {
                const s = store.call(this);
                if (!s.messages.length) return;
                const msg = s.messages[s.messages.length - 1];
                msg.content = '';
                msg.typingFull = fullText;
                this.ensureDashboardChatScrolled();
                let idx = 0;
                const tick = setInterval(() => {
                    if (idx < msg.typingFull.length) {
                        msg.content += msg.typingFull[idx];
                        idx++;
                    } else {
                        clearInterval(tick);
                        delete msg.typingFull;
                        if (msg.content) {
                            var idx = s.messages.length - 1;
                            canvasFinalizeAssistantMessageAtIndex(s, idx);
                        }
                        this.ensureDashboardChatScrolled();
                    }
                }, 28);
            },

            /** Push an assistant message and type it character-by-character into the chat. onDone optional callback when typing finishes. */
            pushAssistantMessageWithTyping(fullText, onDone) {
                const s = store.call(this);
                s.messages.push({ role: 'assistant', content: '', typingFull: fullText });
                this.ensureDashboardChatScrolled();
                const msg = s.messages[s.messages.length - 1];
                let idx = 0;
                const tick = setInterval(() => {
                    if (idx < msg.typingFull.length) {
                        msg.content += msg.typingFull[idx];
                        idx++;
                    } else {
                        clearInterval(tick);
                        delete msg.typingFull;
                        if (msg.content) {
                            var idxDone = s.messages.length - 1;
                            canvasFinalizeAssistantMessageAtIndex(s, idxDone);
                        }
                        this.ensureDashboardChatScrolled();
                        if (typeof onDone === 'function') onDone();
                    }
                }, 28);
            },

            /** Push an assistant message in the lesson-plan chat and type it character-by-character. onDone optional; contentHtml optional, set on message when typing finishes. */
            pushLessonPlanAssistantMessageWithTyping(fullText, onDone, contentHtml) {
                const s = store.call(this);
                s.lessonPlanMessages.push({ role: 'assistant', content: '', typingFull: fullText });
                this.ensureLessonPlanChatScrolled();
                const msg = s.lessonPlanMessages[s.lessonPlanMessages.length - 1];
                let idx = 0;
                const tick = setInterval(() => {
                    if (idx < msg.typingFull.length) {
                        msg.content += msg.typingFull[idx];
                        idx++;
                    } else {
                        clearInterval(tick);
                        delete msg.typingFull;
                        if (contentHtml) msg.contentHtml = contentHtml;
                        this.ensureLessonPlanChatScrolled();
                        if (typeof onDone === 'function') onDone();
                    }
                }, 28);
            },

            /** Type fullText into the last lesson-plan message (replaces current content with typed effect). */
            typeLastLessonPlanMessage(fullText) {
                const s = store.call(this);
                if (!s.lessonPlanMessages.length) return;
                const msg = s.lessonPlanMessages[s.lessonPlanMessages.length - 1];
                msg.content = '';
                msg.typingFull = fullText;
                this.ensureLessonPlanChatScrolled();
                let idx = 0;
                const tick = setInterval(() => {
                    if (idx < msg.typingFull.length) {
                        msg.content += msg.typingFull[idx];
                        idx++;
                    } else {
                        clearInterval(tick);
                        delete msg.typingFull;
                        this.ensureLessonPlanChatScrolled();
                    }
                }, 28);
            },

            openLessonPlanStream(taskId) {
                const s = store.call(this);
                const url = lessonPlanStreamUrl.replace('__TASK_ID__', taskId);
                fetch(url, { credentials: 'include' }).then(res => {
                    if (!res.ok || !res.body) return;
                    const reader = res.body.getReader();
                    const decoder = new TextDecoder();
                    let buf = '';
                    function read() {
                        reader.read().then(({ value, done }) => {
                            if (done) return;
                            buf += decoder.decode(value, { stream: true });
                            const lines = buf.split('\n');
                            buf = lines.pop() || '';
                            for (const line of lines) {
                                if (line.startsWith('data: ')) {
                                    try {
                                        const data = JSON.parse(line.slice(6));
                                        if (data.done) return;
                                        if (data.text && s.lessonPlan && s.lessonPlan.content) s.lessonPlan.content.main_content += data.text;
                                    } catch (_) {}
                                }
                            }
                            read();
                        }).catch(() => {});
                    }
                    read();
                }).catch(() => {});
            },

            async loadStudents() {
                const s = store.call(this);
                s.studentsError = '';
                s.studentsLoading = true;
                try {
                    const params = new URLSearchParams();
                    if (s.filterRegistrationGroup) params.append('registration_group', s.filterRegistrationGroup);
                    if (s.filterSEN !== 'all') params.append('sen', s.filterSEN);
                    if (s.filterEAL !== 'all') params.append('eal', s.filterEAL);
                    const res = await fetch('/canvasdashboard/students?' + params.toString());
                    if (!res.ok) {
                        s.studentsError = 'Failed to load students';
                        s.studentsLoading = false;
                        return;
                    }
                    const data = await res.json();
                    const rows = Array.isArray(data) ? data : (data.students || []);
                    s.students = rows.map(function(row) {
                        return {
                            id: row.id,
                            registration_group: row.registration_group || '',
                            display: (row.firstname || '') + ' ' + (row.lastname || '') + (row.registration_group ? ' (' + row.registration_group + ')' : '')
                        };
                    });
                } catch (e) {
                    s.studentsError = e.message || 'Error loading students';
                }
                s.studentsLoading = false;
            },

            startLessonPlanAction(targetLabel, targetType) {
                const s = store.call(this);
                s.setAction('lesson_plan', { targetLabel: targetLabel || '', targetType: targetType || 'reg_group' });
                s.lessonPlanMessages = [];
            },

            handleCloseLessonPlanConfirm(ev) {
                if (typeof window.canvasRequestExit === 'function') {
                    window.canvasRequestExit((ev && ev.detail) || {});
                }
            },

            closeImageCreatorAction() {
                if (typeof window.canvasRequestExit === 'function') {
                    window.canvasRequestExit({});
                }
            },

            showImageCreatorFullSize(imageUrl) {
                if (!imageUrl) return;
                window.open(imageUrl, '_blank', 'noopener');
            },

            scrollChatToBottom() {
                const s = Alpine.store('canvas');
                let el = document.getElementById('canvas-chat-messages-right');
                if (s.currentAction === 'lesson_plan') el = document.getElementById('canvas-lesson-chat-main');
                else if (s.currentAction === 'quiz') el = document.getElementById('canvas-quiz-chat-messages');
                else if (s.currentAction === 'eal_lesson') el = document.getElementById('canvas-eal-chat-messages');
                else if (s.currentAction === 'online_lesson') el = document.getElementById('canvas-online-chat-messages');
                if (el) {
                    el.scrollTo({ top: el.scrollHeight, behavior: 'smooth' });
                    s.chatScrollAtBottom = true;
                }
            },

            scrollChatToBottomInstant() {
                const s = Alpine.store('canvas');
                let el = document.getElementById('canvas-chat-messages-right');
                if (s.currentAction === 'lesson_plan') el = document.getElementById('canvas-lesson-chat-main');
                else if (s.currentAction === 'quiz') el = document.getElementById('canvas-quiz-chat-messages');
                else if (s.currentAction === 'eal_lesson') el = document.getElementById('canvas-eal-chat-messages');
                else if (s.currentAction === 'online_lesson') el = document.getElementById('canvas-online-chat-messages');
                if (el) {
                    el.scrollTop = el.scrollHeight;
                    s.chatScrollAtBottom = true;
                }
            },

            /** Scroll the lesson-plan (right) chat to bottom on next frame after new content. */
            ensureLessonPlanChatScrolled() {
                requestAnimationFrame(() => this.scrollChatToBottomInstant());
            },

            updateChatScrollAtBottom(ev) {
                const el = ev.target;
                const atBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 24;
                Alpine.store('canvas').chatScrollAtBottom = atBottom;
            },

            scrollDashboardChatToBottom() {
                const el = document.getElementById('canvas-chat-messages');
                if (el) {
                    el.scrollTo({ top: el.scrollHeight, behavior: 'smooth' });
                    Alpine.store('canvas').dashboardChatScrollAtBottom = true;
                }
            },

            scrollDashboardChatToBottomInstant() {
                const el = document.getElementById('canvas-chat-messages');
                if (el) {
                    el.scrollTop = el.scrollHeight;
                    Alpine.store('canvas').dashboardChatScrollAtBottom = true;
                }
            },

            /** If we're showing the main dashboard chat, scroll it to bottom on next frame (e.g. after new message). */
            ensureDashboardChatScrolled() {
                const s = store.call(this);
                if (s.chatOnRight) return;
                requestAnimationFrame(() => this.scrollDashboardChatToBottomInstant());
            },

            updateDashboardChatScrollAtBottom(ev) {
                const el = ev.target;
                const atBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 24;
                Alpine.store('canvas').dashboardChatScrollAtBottom = atBottom;
            },

            selectLessonPlanAgent(agent) {
                const s = store.call(this);
                if (!agent || !agent.id || s.currentAction !== 'lesson_plan' || s.lessonPlan.wizardActive || s.lessonPlan.step !== 2) return;
                s.lessonPlan.data.ai_agent_id = agent.id;
                s.lessonPlan.data.subject = (agent.subject && String(agent.subject).trim()) || agent.name || '';
                s.lessonPlan.step = 3;
                s.lessonPlanMessages.push({ role: 'user', content: agent.name || agent.subject || 'Subject' });
                this.pushLessonPlanAssistantMessageWithTyping('What resources are available?');
                if (typeof scheduleSaveCanvasState === 'function') scheduleSaveCanvasState();
            },

            selectQuizAgent(agent) {
                const s = store.call(this);
                if (!agent || !agent.id || s.currentAction !== 'quiz' || !s.quiz || s.quiz.step !== 2) return;
                s.quiz.data.ai_agent_id = agent.id;
                s.quiz.data.ai_agent = agent.id;
                s.quiz.data.subject = (agent.subject && String(agent.subject).trim()) || agent.name || '';
                s.quiz.step = 3;
                s.quiz.messages.push({ role: 'user', content: agent.name || agent.subject || 'Subject' });
                s.quiz.messages.push({ role: 'assistant', content: 'How many questions and which curriculum year? (e.g. 5 for Year 7)' });
                window.dispatchEvent(new CustomEvent('canvas-ensure-lesson-plan-chat-scrolled'));
            },

            async submitQuizCreate() {
                const s = store.call(this);
                await submitQuizCreateForStore(s);
            },

            async pollQuizTask() {
                const s = store.call(this);
                await pollQuizTaskForStore(s);
            },

            async saveCanvasQuiz() {
                const s = store.call(this);
                await saveCanvasQuizForStore(s);
            },

            async regenerateQuizHtmlCanvas() {
                const s = store.call(this);
                await regenerateQuizHtmlCanvasForStore(s);
            },

            async submitEalCreate() {
                const s = store.call(this);
                await submitEalCreateForStore(s);
            },

            async pollEalTask() {
                const s = store.call(this);
                await pollEalTaskForStore(s);
            },

            async submitOnlineCreate() {
                const s = store.call(this);
                await submitOnlineCreateForStore(s);
            },

            async pollOnlineLessonTask() {
                const s = store.call(this);
                await pollOnlineLessonTaskForStore(s);
            },

            async pollLessonPlanTask() {
                const s = store.call(this);
                if (!s.lessonPlan.taskId) return;
                const url = taskStatusUrl.replace('__TASK_ID__', s.lessonPlan.taskId);
                try {
                    const res = await fetch(url);
                    const data = await res.json();
                    if (data.state === 'SUCCESS' && data.result && data.result.draft_id) {
                        s.lessonPlan.draftId = data.result.draft_id;
                        s.lessonPlan.step = 5;
                        s.lessonPlan.wizardActive = false;
                        s.lessonPlan.chatMode = 'ask';
                        persistLessonPlanDraft(data.result.draft_id);
                        const contentUrl = draftContentUrl.replace('__DRAFT_ID__', data.result.draft_id);
                        const cr = await fetch(contentUrl);
                        if (cr.ok) {
                            s.lessonPlan.content = await cr.json();
                            s.lessonPlanMessages = [];
                            this.pushLessonPlanAssistantMessageWithTyping('Lesson plan created. It\'s shown in the canvas.');
                            fetchLessonPlanWelcomeTips(s);
                        }
                        s.lessonPlan.loading = false;
                        s.lessonPlan.taskId = null;
                        this.ensureLessonPlanChatScrolled();
                        return;
                    }
                    if (data.state === 'SUCCESS' && data.result && (data.result.status === 'error' || !data.result.draft_id)) {
                        s.lessonPlan.error = data.result.message || 'Task completed with an error.';
                        this.pushLessonPlanAssistantMessageWithTyping('Error: ' + (s.lessonPlan.error));
                        s.lessonPlan.loading = false;
                        s.lessonPlan.taskId = null;
                        if (!s.lessonPlan.draftId) { s.lessonPlan.wizardActive = true; s.lessonPlan.wizardStep = 5; }
                        this.ensureLessonPlanChatScrolled();
                        return;
                    }
                    if (data.state === 'FAILURE') {
                        s.lessonPlan.error = data.error || 'Task failed';
                        this.pushLessonPlanAssistantMessageWithTyping('Error: ' + (s.lessonPlan.error));
                        s.lessonPlan.loading = false;
                        s.lessonPlan.taskId = null;
                        if (!s.lessonPlan.draftId) { s.lessonPlan.wizardActive = true; s.lessonPlan.wizardStep = 5; }
                        this.ensureLessonPlanChatScrolled();
                        return;
                    }
                } catch (e) {
                    s.lessonPlan.error = e.message || 'Poll failed';
                    s.lessonPlan.loading = false;
                    s.lessonPlan.taskId = null;
                    if (!s.lessonPlan.draftId) { s.lessonPlan.wizardActive = true; s.lessonPlan.wizardStep = 5; }
                    return;
                }
                setTimeout(() => this.pollLessonPlanTask(), 1500);
            },

            async send() {
                const s = store.call(this);
                if (s.isAlertOnlySchool && !s.currentAction) return;
                const text = s.inputText.trim();

                if (s.currentAction === 'eal_lesson' && s.ealLesson && !s.ealLesson.loading) {
                    s.inputText = '';
                    return;
                }

                if (s.currentAction === 'online_lesson' && s.onlineLesson && !s.onlineLesson.loading) {
                    s.inputText = '';
                    return;
                }

                if (s.currentAction === 'lesson_plan') {
                    s.errorMsg = '';
                    if (text.toLowerCase() === 'start over') {
                        s.lessonPlanMessages.push({ role: 'user', content: text });
                        s.inputText = '';
                        s.lessonPlan = initialLessonPlan();
                        s.lessonPlanExport = initialLessonPlanExport();
                        clearPersistedLessonPlanDraft();
                        s.lessonPlanSelectionMenu = null;
                        s.lessonPlanAmendingAt = null;
                        s.lessonPlanMessages = [];
                        var lpReset = window.CanvasFeatures && window.CanvasFeatures.lesson_plan;
                        if (lpReset && typeof lpReset.initLessonPlanWizard === 'function') lpReset.initLessonPlanWizard(s, s.actionContext);
                        return;
                    }
                    if (s.lessonPlan.wizardActive && !s.lessonPlan.draftId) {
                        return;
                    }
                    if (s.lessonPlan.step === 5 && s.lessonPlan.draftId) {
                        if (s.lessonPlanMessages.length > 0) {
                            const last = s.lessonPlanMessages[s.lessonPlanMessages.length - 1];
                            if (last.role === 'user' && last.content === text) return;
                        }
                    }
                    s.lessonPlanMessages.push({ role: 'user', content: text });
                    s.inputText = '';
                    if (s.lessonPlan.step === 5 && s.lessonPlan.draftId) {
                        s.lessonPlan.loading = true;
                        const topic = (s.lessonPlan.content && s.lessonPlan.content.topic) || s.lessonPlan.data.topic || 'this lesson';
                        const contextMessage = 'Lesson plan context: Topic is "' + topic + '". The user is chatting about the lesson. When you suggest changes or improvements, be specific about what you would change: name the section, paragraph, or element (e.g. "I would add a short plenary section at the end", "I would simplify the learning objectives to focus on...", "I would add a differentiation bullet under Resources"). Do not modify the lesson plan yourself—only describe clearly what changes you recommend so the teacher can apply them if they want.\n\nMessage: ' + text;
                        const history = s.lessonPlanMessages.slice(0, -1).slice(-10).map(function(m) { return { role: m.role, content: m.content }; });
                        const assistantIndex = s.lessonPlanMessages.length;
                        s.lessonPlanMessages.push({ role: 'assistant', content: '', fromAsk: true });
                        try {
                            const res = await fetch(streamUrlSafe, {
                                method: 'POST',
                                headers: { 'Content-Type': 'application/json' },
                                body: JSON.stringify({
                                    message: contextMessage,
                                    ai_model: s.aiModel,
                                    ai_persona_id: (s.aiPersonaId !== null && s.aiPersonaId !== undefined && s.aiPersonaId !== '') ? String(s.aiPersonaId) : undefined,
                                    history: history
                                }),
                                credentials: 'include'
                            });
                            if (!res.ok || !res.body) {
                                this.typeLastLessonPlanMessage('Failed to get a response.');
                                s.lessonPlan.loading = false;
                                return;
                            }
                            const reader = res.body.getReader();
                            const decoder = new TextDecoder();
                            let buf = '';
                            while (true) {
                                const { value, done } = await reader.read();
                                if (done) break;
                                buf += decoder.decode(value, { stream: true });
                                const lines = buf.split('\n');
                                buf = lines.pop() || '';
                                for (let i = 0; i < lines.length; i++) {
                                    const line = lines[i];
                                    if (line.startsWith('data: ')) {
                                        try {
                                            const data = JSON.parse(line.slice(6));
                                            if (data.error) {
                                                this.typeLastLessonPlanMessage(data.error);
                                                break;
                                            }
                                            if (data.done) break;
                                            if (data.text) {
                                                s.lessonPlanMessages[assistantIndex].content += data.text;
                                                this.ensureLessonPlanChatScrolled();
                                            }
                                        } catch (_) {}
                                    }
                                }
                            }
                        } catch (e) {
                            this.typeLastLessonPlanMessage('Error: ' + (e.message || 'Request failed'));
                        }
                        s.lessonPlan.loading = false;
                        return;
                    }
                    if (s.lessonPlan.step === 5 && s.lessonPlan.draftId && s.lessonPlan.chatMode === 'action') {
                        this.pushLessonPlanAssistantMessageWithTyping('Updating the lesson plan…');
                        try {
                            const enhanceUrl = enhanceLessonPlanUrl.replace('__DRAFT_ID__', s.lessonPlan.draftId);
                            const history = s.lessonPlanMessages.slice(0, -1).map(m => ({ role: m.role, content: m.content }));
                            s.lessonPlan.lastEnhancePrompt = text;
                            const res = await fetch(enhanceUrl, {
                                method: 'POST',
                                headers: { 'Content-Type': 'application/json' },
                                body: JSON.stringify({
                                    section: 'main',
                                    prompt: text,
                                    conversation_history: history.slice(-10),
                                    ai_model: s.aiModel
                                })
                            });
                            const data = await res.json();
                            if (res.status === 202 && data.task_id) {
                                this.pollEnhanceTask(data.task_id);
                            } else if (res.ok && data.status === 'success' && data.content) {
                                if (!s.lessonPlan.content) s.lessonPlan.content = {};
                                s.lessonPlan.content.main_content = data.content;
                                this.typeLastLessonPlanMessage("I've updated the lesson plan based on your request: \"" + text.replace(/"/g, '\u201c') + "\". The changes are shown in the canvas.");
                                s.lessonPlan.loading = false;
                            } else {
                                this.typeLastLessonPlanMessage('Error: ' + (data.error || 'Failed to update lesson plan'));
                                s.lessonPlan.loading = false;
                            }
                        } catch (e) {
                            this.typeLastLessonPlanMessage('Error: ' + (e.message || 'Network error'));
                            s.lessonPlan.loading = false;
                        }
                        return;
                    }
                    return;
                }

                if (s.currentAction === 'quiz' && s.quiz && !s.quiz.wizardActive && s.quiz.quizId) {
                    return;
                }

                if (s.currentAction === 'quiz' && s.quiz && s.quiz.wizardActive) {
                    return;
                }

                if (!text || s.loading) return;
                const normalised = text.toLowerCase().replace(/\s+/g, ' ').trim();

                if (s.pendingLessonPlanConfirmRegGroup) {
                    const yesNo = normalised === 'yes' || normalised === 'no';
                    if (yesNo) {
                        const confirmed = normalised === 'yes';
                        const groupName = s.pendingLessonPlanConfirmRegGroup;
                        s.pendingLessonPlanConfirmRegGroup = null;
                        s.messages.push({ role: 'user', content: text });
                        s.inputText = '';
                        if (confirmed) {
                            this.startLessonPlanAction(groupName, 'reg_group');
                        } else {
                            s.lessonPlanTopicFromChat = groupName.charAt(0).toUpperCase() + groupName.slice(1).toLowerCase();
                            s.openLessonPlanRegGroupFlow('For which registration group should this lesson plan be? The lesson will be about ' + s.lessonPlanTopicFromChat + '.');
                        }
                        return;
                    }
                }

                const lessonPlanMatch = normalised.match(/^lesson plan (.+)$/);
                if (lessonPlanMatch) {
                    const topicOrReg = lessonPlanMatch[1].trim();
                    if (!topicOrReg) {
                        s.messages.push({ role: 'user', content: text });
                        s.inputText = '';
                        s.openLessonPlanRegGroupFlow();
                        return;
                    }
                    const groups = s.registrationGroups || [];
                    const matchedGroup = groups.find(g => (g || '').toLowerCase().trim() === topicOrReg.toLowerCase());
                    s.messages.push({ role: 'user', content: text });
                    s.inputText = '';
                    if (matchedGroup) {
                        const label = matchedGroup;
                        s.pendingLessonPlanConfirmRegGroup = label;
                        this.startConfirmMessageTyping(label);
                        this.ensureDashboardChatScrolled();
                        return;
                    }
                    const topicLabel = topicOrReg.charAt(0).toUpperCase() + topicOrReg.slice(1).toLowerCase();
                    s.lessonPlanTopicFromChat = topicLabel;
                    s.openLessonPlanRegGroupFlow('For which registration group should this lesson plan be? The lesson will be about ' + topicLabel + '.');
                    return;
                }

                if (normalised === 'lesson plan') {
                    s.messages.push({ role: 'user', content: text });
                    s.inputText = '';
                    s.openLessonPlanRegGroupFlow();
                    return;
                }

                /* Broader lesson-plan intent: e.g. "I want a lesson plan", "can you create a lesson plan for Apollo" */
                const wantsLessonPlan = /lesson plan(s)?/.test(normalised) && /(want|need|create|make|give me|can you|could you|please|i'?d like|i would like|get me|help me with)/.test(normalised);
                if (wantsLessonPlan) {
                    const forMatch = normalised.match(/for\s+(.+?)(?:\s*[.?!]?\s*)$/);
                    const topicOrReg = forMatch ? forMatch[1].trim() : '';
                    s.messages.push({ role: 'user', content: text });
                    s.inputText = '';
                    if (!topicOrReg) {
                        s.openLessonPlanRegGroupFlow();
                        return;
                    }
                    const groups = s.registrationGroups || [];
                    const matchedGroup = groups.find(g => (g || '').toLowerCase().trim() === topicOrReg.toLowerCase());
                    if (matchedGroup) {
                        const label = matchedGroup;
                        s.pendingLessonPlanConfirmRegGroup = label;
                        this.startConfirmMessageTyping(label);
                        return;
                    }
                    const topicLabel = topicOrReg.charAt(0).toUpperCase() + topicOrReg.slice(1).toLowerCase();
                    s.lessonPlanTopicFromChat = topicLabel;
                    s.openLessonPlanRegGroupFlow('For which registration group should this lesson plan be? The lesson will be about ' + topicLabel + '.');
                    return;
                }

                /* Image intent: e.g. "I need an image of an aeroplane", "create a picture of a cat" – open image creator and pre-fill (precedence: lesson plan checked first above) */
                const imageOfMatch = normalised.match(/(?:image|picture|photo|illustration|drawing)\s+of\s+(.+?)(?:\s*[.?!]?\s*)$/);
                const drawMatch = normalised.match(/draw\s+(.+?)(?:\s*[.?!]?\s*)$/);
                const createImageMatch = normalised.match(/(?:create|generate|make)\s+(?:an?\s+)?(?:image|picture|photo)\s+(?:of\s+)?(.+?)(?:\s*[.?!]?\s*)$/);
                const needWantImageMatch = normalised.match(/(?:i need|i want)\s+(?:an?\s+)?(?:image|picture|photo)\s+(?:of\s+)?(.+?)(?:\s*[.?!]?\s*)$/);
                let imageDescription = '';
                if (imageOfMatch) imageDescription = imageOfMatch[1].trim();
                else if (drawMatch) imageDescription = drawMatch[1].trim();
                else if (createImageMatch) imageDescription = createImageMatch[1].trim();
                else if (needWantImageMatch) imageDescription = needWantImageMatch[1].trim();
                else if (/(?:need|want|create|generate|make|draw)\s+(?:an?\s+)?(?:image|picture|photo)/.test(normalised)) imageDescription = text.trim();
                if (imageDescription !== '' || /(?:need|want|create|generate|make|draw)\s+(?:an?\s+)?(?:image|picture|photo)/.test(normalised)) {
                    s.messages.push({ role: 'user', content: text });
                    s.inputText = '';
                    s.setAction('image_creator');
                    s.imageCreatorFromChat = true;
                    s.imageCreatorPrompt = imageDescription || text.trim();
                    this.pushAssistantMessageWithTyping("I've opened the image creator with your description. You can adjust it and tap Generate.");
                    return;
                }

                if (s.showLessonPlanRegGroupChoice && !s.currentAction) s.showLessonPlanRegGroupChoice = false;
                s.errorMsg = '';
                if (s.personaSwitchPending) {
                    s.errorMsg = 'Switching agent context...';
                    return;
                }
                if (!s.canvasChatId) {
                    try {
                        const boot = await fetch(canvasThreadsNewUrlSafe || '/canvasdashboard/chats/new', {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            credentials: 'include',
                            body: JSON.stringify({
                                ai_persona_id: (s.aiPersonaId !== null && s.aiPersonaId !== undefined) ? String(s.aiPersonaId || '') : ''
                            })
                        });
                        const bootData = await boot.json().catch(function() { return {}; });
                        if (boot.ok && bootData && bootData.thread_id) {
                            s.canvasChatId = String(bootData.thread_id);
                            if (typeof syncCanvasUrlParams === 'function') syncCanvasUrlParams(s);
                        }
                    } catch (_) {}
                }
                s.messages.push({ role: 'user', content: text });
                s.inputText = '';
                s.messages.push({ role: 'assistant', content: '' });
                this.ensureDashboardChatScrolled();
                if (typeof scheduleSaveCanvasState === 'function') scheduleSaveCanvasState();
                s.loading = true;
                const history = s.messages.slice(0, -1).map(m => {
                    var item = { role: m.role, content: m.content };
                    if (m.tool_suggestions && m.tool_suggestions.length) item.tool_suggestions = m.tool_suggestions;
                    if (m.tool_topic) item.tool_topic = m.tool_topic;
                    if (m.image_url) item.image_url = m.image_url;
                    if (m.image_prompt) item.image_prompt = m.image_prompt;
                    if (m.work_link && m.work_link.kind && m.work_link.id) item.work_link = m.work_link;
                    return item;
                });
                const body = {
                    message: text,
                    history,
                    thread_id: (s.canvasChatId || ''),
                    ai_model: mainCanvasChatModel,
                    ai_persona_id: (s.aiPersonaId !== null && s.aiPersonaId !== undefined && s.aiPersonaId !== '') ? String(s.aiPersonaId) : undefined
                };
                if ((s.sessionNotebookSelections || []).length > 0) {
                    body.rag_mode = 'persona_rag';
                    body.selected_document_ids = (s.sessionNotebookSelections || []).map(function(x) { return String(x.id); });
                    body.selected_document_titles = (s.sessionNotebookSelections || []).reduce(function(acc, x) {
                        var key = String((x && x.id) || '').trim();
                        var val = String((x && x.title) || '').trim();
                        if (key && val) acc[key] = val;
                        return acc;
                    }, {});
                }
                if ((s.sessionUploadFiles || []).length > 0) {
                    body.temp_upload_refs = (s.sessionUploadFiles || []).map(function(x) { return String(x.ref); });
                }
                try {
                    const res = await fetch(streamUrlSafe, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
                    if (!res.ok) {
                        this.typeLastDashboardMessage('Request failed: ' + res.status);
                        s.loading = false;
                        return;
                    }
                    const reader = res.body.getReader();
                    const decoder = new TextDecoder();
                    let buf = '';
                    const assistantIndex = s.messages.length - 1;
                    var markdownRefreshTimer = null;
                    var self = this;
                    function scheduleMarkdownRefresh() {
                        if (markdownRefreshTimer) clearTimeout(markdownRefreshTimer);
                        markdownRefreshTimer = setTimeout(function() {
                            canvasFinalizeAssistantMessageAtIndex(s, assistantIndex);
                        }, 250);
                    }
                    while (true) {
                        const { value, done } = await reader.read();
                        if (done) break;
                        buf += decoder.decode(value, { stream: true });
                        const events = buf.split('\n\n');
                        buf = events.pop() || '';
                        for (const event of events) {
                            const line = event.split('\n').find(l => l.startsWith('data: '));
                            if (!line) continue;
                            try {
                                const data = JSON.parse(line.slice(6));
                                if (data.error) { this.typeLastDashboardMessage('Error: ' + data.error); break; }
                                if (data.thread_id) {
                                    s.canvasChatId = String(data.thread_id);
                                    if (typeof syncCanvasUrlParams === 'function') syncCanvasUrlParams(s);
                                }
                                if (data.tool_suggestions && data.tool_suggestions.length) {
                                    var withPills = s.messages[assistantIndex] || { role: 'assistant', content: '' };
                                    s.messages[assistantIndex] = Object.assign({}, withPills, {
                                        tool_suggestions: data.tool_suggestions,
                                        tool_topic: data.tool_topic || withPills.tool_topic || ''
                                    });
                                }
                                if (data.text) {
                                    var cur = s.messages[assistantIndex] || { role: 'assistant', content: '' };
                                    s.messages[assistantIndex] = Object.assign({}, cur, {
                                        content: (cur.content || '') + data.text
                                    });
                                    scheduleMarkdownRefresh();
                                    if (!s.chatOnRight) {
                                        requestAnimationFrame(() => self.scrollDashboardChatToBottomInstant());
                                    }
                                }
                                if (data.done) {
                                    if (markdownRefreshTimer) clearTimeout(markdownRefreshTimer);
                                    canvasFinalizeAssistantMessageAtIndex(s, assistantIndex);
                                    break;
                                }
                            } catch (_) {}
                        }
                    }
                    if (markdownRefreshTimer) clearTimeout(markdownRefreshTimer);
                    canvasFinalizeAssistantMessageAtIndex(s, assistantIndex);
                } catch (e) {
                    s.errorMsg = e.message || 'Network error';
                    if (s.messages[s.messages.length - 1].content === '') this.typeLastDashboardMessage('Failed to get response.');
                }
                s.loading = false;
                if (typeof s.loadRecentChats === 'function') s.loadRecentChats();
                if (!s.chatOnRight) {
                    requestAnimationFrame(() => document.getElementById('canvas-main-chat-input')?.focus());
                    if (typeof scheduleSaveCanvasState === 'function') scheduleSaveCanvasState();
                }
            },

            async pollEnhanceTask(taskId) {
                const s = store.call(this);
                const url = taskStatusUrl.replace('__TASK_ID__', taskId);
                try {
                    const res = await fetch(url);
                    const data = await res.json();
                    if (data.state === 'SUCCESS' && data.result) {
                        if (data.result.content != null && s.lessonPlan && s.lessonPlan.content) {
                            s.lessonPlan.content.main_content = data.result.content;
                            s.lessonPlanJustUpdated = true;
                            setTimeout(() => { s.lessonPlanJustUpdated = false; }, 600);
                            var promptText = (s.lessonPlan.lastEnhancePrompt || '').replace(/"/g, '\u201c');
                            this.typeLastLessonPlanMessage(promptText ? "I've updated the lesson plan based on your request: \"" + promptText + "\". The changes are shown in the canvas." : "I've updated the lesson plan. It's shown in the canvas.");
                            s.lessonPlan.lastEnhancePrompt = '';
                        }
                        s.lessonPlan.loading = false;
                        s.lessonPlanAmendingAt = null;
                        return;
                    }
                    if (data.state === 'FAILURE') {
                        this.typeLastLessonPlanMessage('Error: ' + (data.error || 'Failed to update lesson plan'));
                        s.lessonPlan.loading = false;
                        s.lessonPlanAmendingAt = null;
                        return;
                    }
                } catch (e) {
                    this.typeLastLessonPlanMessage('Error: ' + (e.message || 'Network error'));
                    s.lessonPlan.loading = false;
                    s.lessonPlanAmendingAt = null;
                    return;
                }
                setTimeout(() => this.pollEnhanceTask(taskId), 1500);
            },
        };
    });
});
