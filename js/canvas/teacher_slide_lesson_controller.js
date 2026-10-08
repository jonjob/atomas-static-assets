(function() {
    'use strict';

    function initialLessonSlideCreatorState() {
        return {
            lessonId: null,
            publishedUrl: '',
            previewUrl: 'about:blank',
            activeStep: 'setup',
            viewMode: 'edit',
            selectedSlideIndex: 0,
            selectedSlideKey: '',
            suppressSlideClick: false,
            loading: false,
            saving: false,
            publishing: false,
            fillingComponents: false,
            error: '',
            imageWarning: '',
            publishSuccess: '',
            status: '',
            buildStep: 0,
            buildProgress: 0,
            autoSaveTimer: null,
            autoSaveStatusTimer: null,
            autoSaveStatus: '',   // '' | 'pending' | 'saving' | 'saved' | 'error'
            shareOpen: false,
            publishedDirty: false,
            copyFeedback: '',
            copyFeedbackTimer: null,
            dragFromIndex: null,
            dragOverIndex: null,
            dirtySlideKeys: {},
            components: {},
            themePacks: [],
            slides: [],
            data: {
                title: '',
                subject: '',
                curriculum_year: '',
                lesson_goal: '',
                duration_minutes: 50,
                pedagogy_mode: 'explicit_instruction',
                phase_structure: 'Hook, Explain, Model, Check, Practise, Reflect',
                tone: 'clear, calm, energetic',
                notes: '',
                ai_model: 'azure/gpt-6-luna',
                theme: { pack: 'amber', accent: '#ffbf00' },
                audio: { background_url: '', background_label: '' }
            }
        };
    }

    function clone(obj) {
        try { return JSON.parse(JSON.stringify(obj || {})); } catch (_) { return {}; }
    }

    /** Build text from canvas lesson plan (if any) for slide AI; truncated for API limits. */
    function lessonPlanContextForSlides(canvasStore) {
        var lp = canvasStore && canvasStore.lessonPlan;
        if (!lp) return '';
        var parts = [];
        if (lp.content && lp.content.topic) parts.push('Topic: ' + String(lp.content.topic).trim());
        var d = lp.data || {};
        if (d.learning_objectives) parts.push('Learning objectives: ' + String(d.learning_objectives).trim());
        if (d.success_criteria) parts.push('Success criteria: ' + String(d.success_criteria).trim());
        if (lp.content && lp.content.main_content) parts.push('Lesson plan:\n' + String(lp.content.main_content));
        var s = parts.join('\n\n').trim();
        if (s.length > 14000) s = s.slice(0, 14000) + '\n…';
        return s;
    }

    function lessonPlanDraftIdForSlides(canvasStore) {
        var lp = canvasStore && canvasStore.lessonPlan;
        if (!lp || !lp.draftId) return '';
        return String(lp.draftId).trim();
    }

    function defaultSlide(index, slideType) {
        var st = slideType || 'explain';
        var payload = {
            eyebrow: 'Explain',
            main_text: 'What should pupils think about here?',
            supporting_text: '',
            visual_prompt: '',
            image_url: '',
            image_caption: '',
            image_fit: 'cover',
            image_focal: '50% 50%',
            video_url: '',
            quote_text: '',
            attribution: '',
            countdown_seconds: 0
        };
        var tit = 'New slide';
        if (st === 'separator') {
            payload.eyebrow = 'Section';
            payload.main_text = '';
            payload.supporting_text = '';
            tit = 'Section break';
        } else if (st === 'quote') {
            payload.eyebrow = 'Quote';
            payload.quote_text = 'A memorable line for discussion.';
            payload.main_text = payload.quote_text;
            tit = 'Quote';
        } else if (st === 'countdown') {
            payload.eyebrow = 'Think time';
            payload.countdown_seconds = 60;
            payload.main_text = 'Think before we share ideas.';
            tit = 'Countdown';
        } else if (st === 'video') {
            payload.eyebrow = 'Video';
            payload.main_text = 'What should pupils notice while watching?';
            payload.video_url = '';
            tit = 'Video';
        } else if (st === 'image_showcase') {
            payload.eyebrow = 'Visual';
            payload.main_text = 'What do you notice?';
            payload.image_url = '';
            payload.image_caption = '';
            tit = 'Image';
        }
        return {
            id: null,
            slide_index: index || 0,
            slide_type: st,
            title: tit,
            layout: 'statement',
            speaker_notes: '',
            background: { style: 'gradient', value: '' },
            audio: { cue_url: '', cue_label: '' },
            payload: payload,
            components: []
        };
    }

    function defaultComponent(type) {
        if (type === 'quiz') {
            return { component_type: 'quiz', title: 'Quick check', payload: { questions: [{ question: 'Which answer is best?', options: ['A', 'B', 'C', 'D'], answer: 0, explanation: 'Reveal the reasoning.' }] } };
        }
        if (type === 'sorter') {
            return { component_type: 'sorter', title: 'Sort the examples', payload: { categories: [{ name: 'Group A', items: ['Example 1'] }, { name: 'Group B', items: ['Example 2'] }] } };
        }
        if (type === 'timeline') {
            return { component_type: 'timeline', title: 'Sequence', payload: { events: [{ date: 'Step 1', label: 'Start', description: 'First step' }] } };
        }
        if (type === 'worked_example') {
            return { component_type: 'worked_example', title: 'Worked example', payload: { steps: ['Start with the problem.', 'Show the key method.', 'Reveal the final answer.'] } };
        }
        if (type === 'sound_cue') {
            return { component_type: 'sound_cue', title: 'Sound cue', payload: { label: 'Attention chime', audio_url: '' } };
        }
        return { component_type: 'reveal_cards', title: 'Reveal cards', payload: { cards: [{ front: 'Question', back: 'Reveal answer' }] } };
    }

    function normalizeSlide(slide, index) {
        var out = Object.assign(defaultSlide(index), slide || {});
        out.slide_index = index;
        out.background = Object.assign({ style: 'gradient', value: '' }, out.background || {});
        out.audio = Object.assign({ cue_url: '', cue_label: '' }, out.audio || {});
        out.payload = Object.assign(
            {
                eyebrow: '',
                main_text: '',
                supporting_text: '',
                visual_prompt: '',
                image_url: '',
                image_caption: '',
                image_fit: 'cover',
                image_focal: '50% 50%'
            },
            out.payload || {}
        );
        if (!out.payload.image_fit) out.payload.image_fit = 'cover';
        if (!out.payload.image_focal) out.payload.image_focal = '50% 50%';
        out.components = Array.isArray(out.components) ? out.components : [];
        out.components = out.components.map(function(comp) {
            comp.payload = comp.payload || {};
            return comp;
        });
        out._aiImage = defaultAiImageState();
        out._mediaTab = 'upload';
        out._clientKey = (slide && slide._clientKey) || out.id || ('tmp-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 8));
        return out;
    }

    function prepareSlideForSave(slide) {
        var out = clone(slide);
        delete out._aiImage;
        delete out._mediaTab;
        delete out._clientKey;
        (out.components || []).forEach(function(comp) {
            if (comp.component_type === 'sorter' && comp.payload && Array.isArray(comp.payload.categories)) {
                comp.payload.categories.forEach(function(cat) {
                    if (typeof cat.items === 'string') {
                        cat.items = cat.items.split(/\r?\n|,/).map(function(item) { return item.trim(); }).filter(Boolean);
                    }
                });
            }
        });
        return out;
    }

    function isTrustedSlideImageHost(host) {
        host = String(host || '').toLowerCase();
        if (!host) return false;
        if (host.indexOf('cloudfront.net') >= 0 || host.indexOf('amazonaws.com') >= 0) return true;
        if (host.indexOf('runware.ai') >= 0) return true;
        return false;
    }

    function slideIdentity(slide) {
        if (!slide) return '';
        return String(slide.id || slide._clientKey || '');
    }

    function indexOfSlideIdentity(slides, key) {
        if (!key || !slides || !slides.length) return -1;
        for (var i = 0; i < slides.length; i++) {
            if (slideIdentity(slides[i]) === key) return i;
        }
        return -1;
    }

    function setSelectedSlide(state, indexOrSlide) {
        if (!state) return;
        var slides = state.slides || [];
        var idx = typeof indexOrSlide === 'number' ? indexOrSlide : slides.indexOf(indexOrSlide);
        if (idx < 0 || idx >= slides.length) idx = 0;
        state.selectedSlideIndex = idx;
        state.selectedSlideKey = slideIdentity(slides[idx]);
    }

    function syncSelectedSlide(state) {
        if (!state || !(state.slides || []).length) return state.selectedSlideIndex || 0;
        var idx = indexOfSlideIdentity(state.slides, state.selectedSlideKey);
        if (idx < 0) idx = Math.max(0, Math.min(state.selectedSlideIndex || 0, state.slides.length - 1));
        state.selectedSlideIndex = idx;
        state.selectedSlideKey = slideIdentity(state.slides[idx]);
        return idx;
    }

    function slidePersistKey(slide, index) {
        if (slide && slide.id) return 'id:' + slide.id;
        return 'idx:' + String(index == null ? 0 : index);
    }

    function markPublishedDirtyIfLive(state) {
        if (state && state.publishedUrl) state.publishedDirty = true;
    }

    function markSlideDirty(state, slide, index) {
        if (!state) return;
        if (!state.dirtySlideKeys || typeof state.dirtySlideKeys !== 'object') state.dirtySlideKeys = {};
        var idx = index == null ? (state.selectedSlideIndex || 0) : index;
        var target = slide || ((state.slides || [])[idx]);
        state.dirtySlideKeys[slidePersistKey(target, idx)] = true;
    }

    function clearSlideDirty(state, slide, index) {
        if (!state || !state.dirtySlideKeys) return;
        var idx = index == null ? (state.selectedSlideIndex || 0) : index;
        var target = slide || ((state.slides || [])[idx]);
        delete state.dirtySlideKeys[slidePersistKey(target, idx)];
    }

    function normalizeTeacherSlideImageUrl(raw) {
        var s = String(raw || '').trim();
        if (!s) return '';
        var wrapped = s.match(/\((https?:\/\/[^)\s]+)\)/i);
        if (wrapped && wrapped[1]) s = wrapped[1].trim();
        var u;
        try { u = new URL(s); } catch (_) { return ''; }
        var proto = (u.protocol || '').toLowerCase();
        if (proto !== 'http:' && proto !== 'https:') return '';
        var host = (u.hostname || '').toLowerCase();
        var path = u.pathname || '';
        if (isTrustedSlideImageHost(host)) return s;
        if (host === 'upload.wikimedia.org') {
            var parts = path.split('/');
            var fname = decodeURIComponent(parts[parts.length - 1] || '').trim();
            return fname ? ('https://commons.wikimedia.org/wiki/Special:FilePath/' + encodeURIComponent(fname)) : '';
        }
        if (host === 'commons.wikimedia.org') {
            var m1 = path.match(/\/wiki\/Special:FilePath\/(.+)$/i);
            if (m1 && m1[1]) {
                var f1 = decodeURIComponent(m1[1]).trim();
                return f1 ? ('https://commons.wikimedia.org/wiki/Special:FilePath/' + encodeURIComponent(f1)) : '';
            }
            var m2 = path.match(/\/wiki\/File:(.+)$/i);
            if (m2 && m2[1]) {
                var f2 = decodeURIComponent(m2[1]).trim();
                return f2 ? ('https://commons.wikimedia.org/wiki/Special:FilePath/' + encodeURIComponent(f2)) : '';
            }
        }
        if (!/\.(png|jpe?g|gif|webp|svg|avif|bmp)(?:$|\?)/i.test(path)) return '';
        return s;
    }

    function sanitizeSlideImagesWithNotice(slide, state) {
        if (!slide || !state) return;
        var changes = [];
        slide.payload = slide.payload || {};
        slide.background = slide.background || {};

        var oldImg = String(slide.payload.image_url || '').trim();
        var newImg = normalizeTeacherSlideImageUrl(oldImg);
        if (oldImg !== newImg) {
            slide.payload.image_url = newImg;
            changes.push(newImg ? 'Slide image URL was normalized.' : 'Slide image URL was removed (invalid direct image URL).');
        }

        if (String(slide.background.style || '').toLowerCase() === 'image') {
            var oldBg = String(slide.background.value || '').trim();
            var newBg = normalizeTeacherSlideImageUrl(oldBg);
            if (oldBg !== newBg) {
                slide.background.value = newBg;
                changes.push(newBg ? 'Background image URL was normalized.' : 'Background image URL was removed (invalid direct image URL).');
            }
        }

        if (changes.length) state.imageWarning = changes.join(' ');
    }

    function applyBundle(store, bundle) {
        var state = store.teacherSlideLesson;
        if (!state || !bundle) return;
        var lesson = bundle.lesson || {};
        state.lessonId = lesson.id || state.lessonId;
        state.publishedUrl = lesson.published_url || '';
        state.status = lesson.status || 'draft';
        state.data.title = lesson.title || state.data.title || '';
        state.data.subject = lesson.subject || state.data.subject || '';
        state.data.curriculum_year = lesson.curriculum_year || state.data.curriculum_year || '';
        state.data.lesson_goal = lesson.lesson_goal || state.data.lesson_goal || '';
        state.data.pedagogy_mode = lesson.pedagogy_mode || state.data.pedagogy_mode || 'explicit_instruction';
        state.data.duration_minutes = lesson.duration_minutes || state.data.duration_minutes || 50;
        state.data.theme = Object.assign({ accent: '#ffbf00' }, lesson.theme || state.data.theme || {});
        state.data.audio = Object.assign({ background_url: '', background_label: '' }, lesson.audio || state.data.audio || {});
        var keepKey = state.selectedSlideKey;
        state.slides = (bundle.slides || []).map(normalizeSlide);
        if (!state.slides.length) state.slides = [defaultSlide(0)];
        if (keepKey) state.selectedSlideKey = keepKey;
        syncSelectedSlide(state);
        state.activeStep = 'editor';
        state.previewUrl = state.lessonId ? (getBaseUrl() + '/' + encodeURIComponent(state.lessonId) + '/preview?t=' + Date.now()) : 'about:blank';
        if (state.lessonId) syncLessonSlideUrl(state.lessonId);
    }

    var config = {
        baseUrl: '/teacher_slide_lessons',
        componentsUrl: '/teacher_slide_lessons/components/definitions',
        uploadImageUrlTemplate: '/teacher_slide_lessons/__LESSON_ID__/upload_image',
        generateImageUrlTemplate: '/teacher_slide_lessons/__LESSON_ID__/generate_image',
        generateImageResultUrlTemplate: '/teacher_slide_lessons/__LESSON_ID__/generate_image/result/__TASK_ID__',
        enhanceImagePromptUrlTemplate: '/teacher_slide_lessons/__LESSON_ID__/enhance_image_prompt',
        imageModels: [],
        imageStyles: ['Photorealistic', 'Illustration', 'Watercolour', 'Diagram', 'Cartoon', 'Pixel art', 'Whiteboard sketch']
    };

    function defaultImageModelId() {
        var models = Array.isArray(config.imageModels) ? config.imageModels : [];
        var picked = models.find(function(m) { return m && m.default; });
        if (picked && picked.id) return String(picked.id);
        if (models.length && models[0] && models[0].id) return String(models[0].id);
        return 'runware:400@2';
    }

    function defaultAiImageState() {
        return {
            status: 'idle',        // idle | enhancing | generating | success | error
            taskId: '',
            prompt: '',
            style: 'Photorealistic',
            size: '768',
            model: defaultImageModelId(),
            error: '',
            recent: []             // up to 4 most recent runware urls
        };
    }

    function buildSlideImagePromptSeed(slide, state) {
        if (!slide) return '';
        var p = slide.payload || {};
        var data = (state && state.data) || {};
        var bits = [
            String(p.visual_prompt || '').trim(),
            String(p.main_text || '').trim(),
            String(slide.title || '').trim(),
            String(data.subject || '').trim(),
            String(data.curriculum_year || '').trim()
        ].filter(Boolean);
        return bits.join(' ').slice(0, 240);
    }

    function getBaseUrl() {
        return config.baseUrl || '/teacher_slide_lessons';
    }

    function teacherSlideTaskStatusUrl(taskId) {
        var tpl = (typeof taskStatusUrl !== 'undefined' && taskStatusUrl)
            ? taskStatusUrl
            : '/task_status/__TASK_ID__';
        return tpl.replace('__TASK_ID__', taskId);
    }

    function pollTeacherSlideTask(taskId, onSuccess, onFailure) {
        var url = teacherSlideTaskStatusUrl(taskId);
        function tick() {
            fetch(url, { credentials: 'include' })
                .then(function(r) { return r.json(); })
                .then(function(sdata) {
                    if (sdata.state === 'SUCCESS' && sdata.result !== undefined) {
                        var result = sdata.result;
                        if (result && typeof result === 'object' && result.success === false) {
                            onFailure(String(result.error || result.detail || 'Task failed'));
                            return;
                        }
                        onSuccess(result);
                    } else if (sdata.state === 'FAILURE') {
                        onFailure(String(sdata.error || sdata.status || 'Task failed'));
                    } else {
                        setTimeout(tick, 1500);
                    }
                })
                .catch(function() { onFailure('Network error while checking task status'); });
        }
        tick();
    }

    function syncLessonSlideUrl(lessonId) {
        if (!lessonId || typeof window === 'undefined') return;
        try {
            var url = new URL(window.location.href);
            url.searchParams.set('canvas_action', 'lesson_slide_creator');
            url.searchParams.set('teacher_slide_lesson_id', String(lessonId));
            window.history.replaceState(null, '', url.toString());
        } catch (_) {}
    }

    async function loadLesson(store, lessonId) {
        if (!store || !store.teacherSlideLesson || !lessonId) return;
        var state = store.teacherSlideLesson;
        state.loading = true;
        state.error = '';
        try {
            var res = await fetch(getBaseUrl() + '/' + encodeURIComponent(lessonId), { credentials: 'include' });
            var data = await res.json().catch(function() { return {}; });
            if (!res.ok || !data.success) throw new Error(data.detail || data.error || 'Could not load slide lesson.');
            applyBundle(store, data);
            syncLessonSlideUrl(lessonId);
        } catch (e) {
            state.error = (e && e.message) || 'Could not load slide lesson.';
        } finally {
            state.loading = false;
        }
    }

    window.CanvasFeatures = window.CanvasFeatures || {};
    window.CanvasFeatures.lesson_slide_creator = {
        initialLessonSlideCreatorState: initialLessonSlideCreatorState,
        loadLesson: loadLesson,
        onSetActionLessonSlideCreator: function(store, context, opts) {
            config = Object.assign(config, opts || {});
            store.teacherSlideLesson = initialLessonSlideCreatorState();
            var topicHint = context && context.topicHint ? String(context.topicHint).trim() : '';
            if (topicHint) {
                store.teacherSlideLesson.data.title = topicHint;
                store.teacherSlideLesson.data.lesson_goal = topicHint;
            }
            if (context && context.lessonId) {
                store.teacherSlideLesson.lessonId = context.lessonId;
                loadLesson(store, context.lessonId);
            }
            fetch(config.componentsUrl, { credentials: 'include' })
                .then(function(r) { return r.json(); })
                .then(function(data) {
                    if (store.teacherSlideLesson && data.success) {
                        store.teacherSlideLesson.components = data.components || {};
                        store.teacherSlideLesson.themePacks = data.theme_packs || [];
                    }
                })
                .catch(function() {});
        }
    };

    function lessonSlideCreatorPanelFactory() {
        const store = function() { return Alpine.store('canvas'); };
        return {
                get state() { return store().teacherSlideLesson || initialLessonSlideCreatorState(); },
                get selectedSlide() {
                    var st = this.state;
                    if (!st.slides.length) st.slides.push(defaultSlide(0));
                    var idx = indexOfSlideIdentity(st.slides, st.selectedSlideKey);
                    if (idx < 0) idx = Math.max(0, Math.min(st.selectedSlideIndex || 0, st.slides.length - 1));
                    return st.slides[idx] || st.slides[0];
                },
                isSlideSelected(slide, idx) {
                    var st = this.state;
                    if (st.selectedSlideKey && slide) return slideIdentity(slide) === st.selectedSlideKey;
                    return st.selectedSlideIndex === idx;
                },
                selectedSlideNumber() {
                    var st = this.state;
                    var idx = indexOfSlideIdentity(st.slides, st.selectedSlideKey);
                    if (idx < 0) idx = st.selectedSlideIndex || 0;
                    return idx + 1;
                },
                themePackSelected(pack) {
                    var theme = (this.state.data && this.state.data.theme) || {};
                    var packId = String(theme.pack || '').trim();
                    if (packId) return packId === pack.id;
                    var accent = String(theme.accent || '').trim().toLowerCase();
                    return (!accent || accent === '#ffbf00') && pack.id === 'amber';
                },
                selectThemePack(pack) {
                    if (!pack || !pack.id) return;
                    var st = this.state;
                    var theme = Object.assign({}, st.data.theme || {});
                    theme.pack = pack.id;
                    theme.accent = pack.accent || theme.accent || '';
                    st.data.theme = theme;
                    if (st.lessonId) this.saveMeta();
                },
                subjectOptions() { return store().canvasSubjectsList || store().subjectsList || []; },
                subjectChoices() {
                    var options = (this.subjectOptions() || []).slice();
                    var current = String((this.state.data && this.state.data.subject) || '').trim();
                    if (current && !options.some(function(name) { return String(name).toLowerCase() === current.toLowerCase(); })) {
                        options.unshift(current);
                    }
                    return options;
                },
                yearGroups() {
                    var rows = store().canvasNcYearsList || [];
                    var buckets = {};
                    var order = [];
                    rows.forEach(function(row) {
                        var year = (row && (row.ncYear || row.nc_year)) || '';
                        if (!year) return;
                        var keystage = (row && row.keystage) && String(row.keystage).trim() ? String(row.keystage).trim() : 'Years';
                        if (!buckets[keystage]) { buckets[keystage] = []; order.push(keystage); }
                        if (buckets[keystage].indexOf(year) < 0) buckets[keystage].push(year);
                    });
                    var groups = order.length
                        ? order.map(function(keystage) { return { keystage: keystage, years: buckets[keystage] }; })
                        : [];
                    if (!groups.length) {
                        var flat = store().canvasYearsList || store().yearsList || [];
                        if (flat.length) groups = [{ keystage: 'Years', years: flat.slice() }];
                    }
                    var current = String((this.state.data && this.state.data.curriculum_year) || '').trim();
                    var known = groups.some(function(group) {
                        return (group.years || []).some(function(year) { return String(year).toLowerCase() === current.toLowerCase(); });
                    });
                    if (current && !known) groups.unshift({ keystage: 'Saved year', years: [current] });
                    return groups;
                },
                goToLessonDetails() {
                    var st = this.state;
                    st.activeStep = 'setup';
                    st.viewMode = 'edit';
                    st.shareOpen = false;
                },
                goToSlides() {
                    var st = this.state;
                    if (!st.lessonId) return;
                    st.activeStep = 'editor';
                    st.viewMode = 'edit';
                    st.shareOpen = false;
                },
                toggleSharePanel() {
                    var st = this.state;
                    if (!st.lessonId) return;
                    st.shareOpen = !st.shareOpen;
                },
                shareStatusText() {
                    var st = this.state;
                    if (!st.publishedUrl) return 'Not shared yet. Preview first if you want to check, then publish for the class.';
                    if (st.publishedDirty) return 'Edits are saved, but the class page is out of date. Update to push them live.';
                    return 'Live class page.';
                },
                async openPrivatePreview() {
                    var st = this.state;
                    if (!st.lessonId) return;
                    if (!(await this.saveAllSlides({ refreshPreview: true }))) return;
                    if (st.previewUrl && st.previewUrl !== 'about:blank') {
                        window.open(st.previewUrl, '_blank', 'noopener');
                    }
                },
                async copyPublishedLink() {
                    var st = this.state;
                    var url = st.publishedUrl;
                    if (!url) return;
                    try {
                        if (navigator.clipboard && navigator.clipboard.writeText) {
                            await navigator.clipboard.writeText(url);
                        } else {
                            var ta = document.createElement('textarea');
                            ta.value = url;
                            document.body.appendChild(ta);
                            ta.select();
                            document.execCommand('copy');
                            document.body.removeChild(ta);
                        }
                        st.copyFeedback = 'Copied';
                        clearTimeout(st.copyFeedbackTimer);
                        st.copyFeedbackTimer = setTimeout(function() { st.copyFeedback = ''; }, 2000);
                    } catch (_) {
                        st.copyFeedback = 'Could not copy';
                    }
                },
                scheduleAutoSave() {
                    var st = this.state;
                    if (!st.lessonId) return;
                    markSlideDirty(st);
                    clearTimeout(st.autoSaveTimer);
                    st.autoSaveStatus = 'pending';
                    var self = this;
                    st.autoSaveTimer = setTimeout(function() {
                        st.autoSaveTimer = null;
                        if (!st.saving) self.saveCurrentSlide();
                    }, 1400);
                },
                markCurrentSlideDirty() {
                    markSlideDirty(this.state);
                },
                isSlideDirty(index) {
                    var st = this.state;
                    if (!st.dirtySlideKeys) return false;
                    var idx = index == null ? st.selectedSlideIndex : index;
                    var slide = (st.slides || [])[idx];
                    return !!st.dirtySlideKeys[slidePersistKey(slide, idx)];
                },
                async persistSlideAfterMutation(opts) {
                    opts = opts || {};
                    var st = this.state;
                    if (!st.lessonId) return;
                    markSlideDirty(st);
                    if (opts.immediate === false) {
                        this.scheduleAutoSave();
                        return;
                    }
                    if (st.autoSaveTimer !== null) {
                        clearTimeout(st.autoSaveTimer);
                        st.autoSaveTimer = null;
                    }
                    await this.saveCurrentSlide({ refreshPreview: !!opts.refreshPreview });
                },
                async selectSlide(index) {
                    var st = this.state;
                    if (st.suppressSlideClick) return;
                    if (st.lessonId && !st.saving) {
                        if (st.autoSaveTimer !== null) {
                            clearTimeout(st.autoSaveTimer);
                            st.autoSaveTimer = null;
                            await this.saveCurrentSlide();
                        } else if (this.isSlideDirty(st.selectedSlideIndex)) {
                            await this.saveCurrentSlide();
                        }
                    }
                    setSelectedSlide(st, Math.max(0, Math.min(index, st.slides.length - 1)));
                },
                async generateStoryboard() {
                    var st = this.state;
                    if (!st.data.title.trim() || !st.data.lesson_goal.trim()) {
                        st.error = 'Add a title and lesson goal first.';
                        return;
                    }
                    if (!String(st.data.subject || '').trim() || !String(st.data.curriculum_year || '').trim()) {
                        st.error = 'Choose a subject and curriculum year.';
                        return;
                    }
                    st.loading = true;
                    st.error = '';
                    st.imageWarning = '';
                    st.buildStep = 0;
                    st.buildProgress = 0;

                    // Build infographic – advance step at realistic intervals and tick progress bar
                    var _buildTimers = [];
                    var _buildStepDelays = [0, 5500, 11000, 18000, 26000, 34000];
                    _buildStepDelays.forEach(function(delay, i) {
                        _buildTimers.push(setTimeout(function() { if (st.loading) st.buildStep = i; }, delay));
                    });
                    var _buildStart = Date.now();
                    var _buildInterval = setInterval(function() {
                        if (!st.loading) { clearInterval(_buildInterval); return; }
                        st.buildProgress = Math.min(96, Math.round((Date.now() - _buildStart) / 430));
                    }, 250);
                    _buildTimers.push(_buildInterval);

                    try {
                        var cs = store();
                        var lpCtx = lessonPlanContextForSlides(cs);
                        var storyPayload = Object.assign({}, st.data, {
                            lesson_plan_context: lpCtx,
                            lesson_plan_draft_id: lessonPlanDraftIdForSlides(cs)
                        });
                        var res = await fetch(getBaseUrl() + '/generate_storyboard', {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            credentials: 'include',
                            body: JSON.stringify(storyPayload)
                        });
                        var data = await res.json().catch(function() { return {}; });
                        if (!res.ok || !data.success) throw new Error(data.detail || data.error || 'Storyboard generation failed.');
                        if (res.status === 202 && data.task_id) {
                            if (data.lesson && data.lesson.id) {
                                st.lessonId = data.lesson.id;
                                syncLessonSlideUrl(st.lessonId);
                            }
                            await new Promise(function(resolve, reject) {
                                pollTeacherSlideTask(data.task_id, function(result) {
                                    applyBundle(store(), result);
                                    syncLessonSlideUrl(st.lessonId);
                                    if (typeof scheduleSaveCanvasState === 'function') scheduleSaveCanvasState();
                                    resolve();
                                }, function(err) { reject(new Error(err)); });
                            });
                        } else {
                            applyBundle(store(), data);
                            syncLessonSlideUrl(st.lessonId);
                            if (typeof scheduleSaveCanvasState === 'function') scheduleSaveCanvasState();
                        }
                    } catch (e) {
                        st.error = (e && e.message) || 'Storyboard generation failed.';
                    } finally {
                        _buildTimers.forEach(function(t) { clearTimeout(t); clearInterval(t); });
                        if (!st.error) { st.buildStep = 5; st.buildProgress = 100; }
                        st.loading = false;
                    }
                },
                async saveMeta() {
                    var st = this.state;
                    if (!st.lessonId) return this.generateStoryboard();
                    st.saving = true;
                    st.error = '';
                    st.imageWarning = '';
                    try {
                        var res = await fetch(getBaseUrl() + '/' + encodeURIComponent(st.lessonId), {
                            method: 'PATCH',
                            headers: { 'Content-Type': 'application/json' },
                            credentials: 'include',
                            body: JSON.stringify(st.data)
                        });
                        var data = await res.json().catch(function() { return {}; });
                        if (!res.ok || !data.success) throw new Error(data.detail || data.error || 'Save failed.');
                        st.status = 'Saved';
                        st.autoSaveStatus = 'saved';
                        markPublishedDirtyIfLive(st);
                        clearTimeout(st.autoSaveStatusTimer);
                        st.autoSaveStatusTimer = setTimeout(function() {
                            if (st.autoSaveStatus === 'saved') st.autoSaveStatus = '';
                        }, 2500);
                    } catch (e) {
                        st.error = (e && e.message) || 'Save failed.';
                    } finally {
                        st.saving = false;
                    }
                },
                addSlide() {
                    var st = this.state;
                    var next = st.slides.length;
                    st.slides.push(normalizeSlide(defaultSlide(next), next));
                    setSelectedSlide(st, st.slides.length - 1);
                    markSlideDirty(st);
                },
                addFillerSlide(kind) {
                    var st = this.state;
                    var map = {
                        quote: 'quote',
                        countdown: 'countdown',
                        separator: 'separator',
                        video: 'video',
                        image_showcase: 'image_showcase'
                    };
                    var slideType = map[kind] || 'explain';
                    var next = st.slides.length;
                    st.slides.push(normalizeSlide(defaultSlide(next, slideType), next));
                    setSelectedSlide(st, st.slides.length - 1);
                    markSlideDirty(st);
                },
                async uploadSlideImage(ev) {
                    var input = ev && ev.target;
                    var file = input && input.files && input.files[0];
                    if (!file) return;
                    await this._uploadFileToSlide(file);
                    if (input) input.value = '';
                },
                async _uploadFileToSlide(file) {
                    if (!file) return;
                    var st = this.state;
                    if (!st.lessonId) {
                        st.error = 'Generate or load the lesson first, then upload.';
                        return;
                    }
                    if (file.type && file.type.indexOf('image/') !== 0) {
                        st.error = 'That file is not an image.';
                        return;
                    }
                    st.error = '';
                    st.imageWarning = '';
                    try {
                        var tpl = (config.uploadImageUrlTemplate || '').trim() || '/teacher_slide_lessons/__LESSON_ID__/upload_image';
                        var url = tpl.replace('__LESSON_ID__', encodeURIComponent(String(st.lessonId)));
                        var fd = new FormData();
                        fd.append('image', file);
                        var res = await fetch(url, { method: 'POST', body: fd, credentials: 'include' });
                        var data = await res.json().catch(function() { return {}; });
                        if (!res.ok || !data.success || !data.image_url) {
                            throw new Error(data.error || data.detail || 'Image upload failed.');
                        }
                        var slide = this.selectedSlide;
                        slide.payload = slide.payload || {};
                        slide.payload.image_url = data.image_url;
                        await this.persistSlideAfterMutation({ refreshPreview: true });
                    } catch (e) {
                        st.error = (e && e.message) || 'Image upload failed.';
                    }
                },
                onSlideImageDrop(ev) {
                    try {
                        if (ev && ev.preventDefault) ev.preventDefault();
                    } catch (_) {}
                    var dt = ev && ev.dataTransfer;
                    var file = dt && dt.files && dt.files[0];
                    if (file) this._uploadFileToSlide(file);
                },
                onSlideImagePaste(ev) {
                    var items = (ev && ev.clipboardData && ev.clipboardData.items) || [];
                    for (var i = 0; i < items.length; i++) {
                        var it = items[i];
                        if (it && it.kind === 'file') {
                            var f = it.getAsFile();
                            if (f) {
                                this._uploadFileToSlide(f);
                                if (ev.preventDefault) ev.preventDefault();
                                return;
                            }
                        }
                    }
                },
                aiImageState(slide) {
                    slide = slide || this.selectedSlide;
                    if (!slide) return defaultAiImageState();
                    if (!slide._aiImage) slide._aiImage = defaultAiImageState();
                    if (!slide._aiImage.prompt) {
                        slide._aiImage.prompt = buildSlideImagePromptSeed(slide, this.state);
                    }
                    return slide._aiImage;
                },
                imageStylesList() {
                    return Array.isArray(config.imageStyles) && config.imageStyles.length ? config.imageStyles : ['Photorealistic'];
                },
                imageModelsList() {
                    return Array.isArray(config.imageModels) ? config.imageModels : [];
                },
                useRecentAiImage(slide, url) {
                    if (!slide || !url) return;
                    slide.payload = slide.payload || {};
                    slide.payload.image_url = String(url);
                    if (slide._aiImage) slide._aiImage.status = 'success';
                    this.persistSlideAfterMutation({ refreshPreview: true });
                },
                _pushRecentAiImage(slide, url) {
                    var ai = slide._aiImage = slide._aiImage || defaultAiImageState();
                    var u = String(url || '').trim();
                    if (!u) return;
                    ai.recent = (ai.recent || []).filter(function(x) { return x !== u; });
                    ai.recent.unshift(u);
                    if (ai.recent.length > 4) ai.recent = ai.recent.slice(0, 4);
                },
                async enhanceSlideImagePrompt(slide) {
                    slide = slide || this.selectedSlide;
                    if (!slide) return;
                    var ai = this.aiImageState(slide);
                    var st = this.state;
                    if (!st.lessonId) { st.error = 'Generate or load the lesson first.'; return; }
                    var prompt = String(ai.prompt || '').trim();
                    if (!prompt) prompt = buildSlideImagePromptSeed(slide, st);
                    if (!prompt) { ai.error = 'Add a slide title or description first.'; return; }
                    ai.status = 'enhancing';
                    ai.error = '';
                    try {
                        var tpl = (config.enhanceImagePromptUrlTemplate || '').trim() || '/teacher_slide_lessons/__LESSON_ID__/enhance_image_prompt';
                        var url = tpl.replace('__LESSON_ID__', encodeURIComponent(String(st.lessonId)));
                        var res = await fetch(url, {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            credentials: 'include',
                            body: JSON.stringify({ prompt: prompt, style: ai.style, size: ai.size })
                        });
                        var data = await res.json().catch(function() { return {}; });
                        if (!res.ok || !data.success || !data.enhanced_prompt) {
                            throw new Error(data.error || data.detail || 'Could not enhance prompt.');
                        }
                        ai.prompt = data.enhanced_prompt;
                        ai.status = 'idle';
                    } catch (e) {
                        ai.error = (e && e.message) || 'Could not enhance prompt.';
                        ai.status = 'error';
                    }
                },
                async generateSlideImage(slide) {
                    slide = slide || this.selectedSlide;
                    if (!slide) return;
                    var ai = this.aiImageState(slide);
                    var st = this.state;
                    if (!st.lessonId) { st.error = 'Generate or load the lesson first.'; return; }
                    var prompt = String(ai.prompt || '').trim();
                    if (!prompt) prompt = buildSlideImagePromptSeed(slide, st);
                    if (!prompt) { ai.error = 'Add a slide title or description first.'; return; }
                    ai.prompt = prompt;
                    ai.status = 'generating';
                    ai.error = '';
                    ai.taskId = '';
                    try {
                        var tpl = (config.generateImageUrlTemplate || '').trim() || '/teacher_slide_lessons/__LESSON_ID__/generate_image';
                        var url = tpl.replace('__LESSON_ID__', encodeURIComponent(String(st.lessonId)));
                        var fd = new FormData();
                        fd.append('prompt', prompt);
                        fd.append('style', ai.style || 'Photorealistic');
                        fd.append('size', ai.size || '768');
                        fd.append('model', ai.model || defaultImageModelId());
                        var res = await fetch(url, { method: 'POST', body: fd, credentials: 'include' });
                        var data = await res.json().catch(function() { return {}; });
                        if (!res.ok || !data.success || !data.task_id) {
                            throw new Error(data.error || data.detail || 'Image generation failed.');
                        }
                        ai.taskId = data.task_id;
                        var self = this;
                        await new Promise(function(resolve, reject) {
                            self._pollSlideImageTask(slide, ai.taskId, resolve, reject);
                        });
                        await this.persistSlideAfterMutation({ refreshPreview: true });
                    } catch (e) {
                        ai.error = (e && e.message) || 'Image generation failed.';
                        ai.status = 'error';
                    }
                },
                _pollSlideImageTask(slide, taskId, resolve, reject) {
                    var st = this.state;
                    var ai = this.aiImageState(slide);
                    var tpl = (config.generateImageResultUrlTemplate || '').trim() || '/teacher_slide_lessons/__LESSON_ID__/generate_image/result/__TASK_ID__';
                    var url = tpl
                        .replace('__LESSON_ID__', encodeURIComponent(String(st.lessonId)))
                        .replace('__TASK_ID__', encodeURIComponent(String(taskId)));
                    var self = this;
                    function tick() {
                        fetch(url, { credentials: 'include' })
                            .then(function(r) { return r.json(); })
                            .then(function(d) {
                                var statusUp = String(d && d.status || '').toUpperCase();
                                if (statusUp === 'SUCCESS' && d.image_url) {
                                    slide.payload = slide.payload || {};
                                    slide.payload.image_url = String(d.image_url);
                                    self._pushRecentAiImage(slide, d.image_url);
                                    ai.status = 'success';
                                    resolve();
                                } else if (statusUp === 'FAILURE' || statusUp === 'ERROR' || d.error) {
                                    ai.status = 'error';
                                    ai.error = String(d.error || 'Image generation failed.');
                                    reject(new Error(ai.error));
                                } else {
                                    setTimeout(tick, 1500);
                                }
                            })
                            .catch(function(err) {
                                ai.status = 'error';
                                ai.error = (err && err.message) || 'Network error while generating image.';
                                reject(err);
                            });
                    }
                    tick();
                },
                async deleteSelectedSlide() {
                    var st = this.state;
                    var slide = this.selectedSlide;
                    if (st.slides.length <= 1) return;
                    if (!confirm('Delete this slide?')) return;
                    if (slide.id && st.lessonId) {
                        await fetch(getBaseUrl() + '/' + encodeURIComponent(st.lessonId) + '/slides/' + encodeURIComponent(slide.id), {
                            method: 'DELETE',
                            credentials: 'include'
                        }).catch(function() {});
                    }
                    st.slides.splice(st.selectedSlideIndex, 1);
                    setSelectedSlide(st, Math.max(0, st.selectedSlideIndex - 1));
                    if (st.lessonId) await this.persistSlideOrder();
                },
                async persistSlideOrder() {
                    var st = this.state;
                    if (!st.lessonId || !st.slides || !st.slides.length) return true;
                    var ids = st.slides.map(function(s) { return s && s.id; }).filter(Boolean);
                    if (!ids.length) return true;
                    try {
                        var res = await fetch(
                            getBaseUrl() + '/' + encodeURIComponent(st.lessonId) + '/slides/reorder',
                            {
                                method: 'POST',
                                headers: { 'Content-Type': 'application/json' },
                                credentials: 'include',
                                body: JSON.stringify({ slide_ids: ids })
                            }
                        );
                        var data = await res.json().catch(function() { return {}; });
                        if (!res.ok || !data.success) {
                            throw new Error(data.detail || data.error || 'Could not save slide order.');
                        }
                        return true;
                    } catch (e) {
                        st.error = (e && e.message) || 'Could not save slide order.';
                        return false;
                    }
                },
                async moveSelectedSlide(direction) {
                    return this.moveSlideAt(this.state.selectedSlideIndex, direction);
                },
                async moveSlideAt(from, direction) {
                    return this.moveSlideTo(from, from + direction);
                },
                async moveSlideTo(from, to) {
                    var st = this.state;
                    if (from == null || to == null || from === to) return;
                    if (from < 0 || to < 0 || from >= st.slides.length || to >= st.slides.length) return;
                    var keepKey = st.selectedSlideKey || slideIdentity(st.slides[st.selectedSlideIndex]);
                    var item = st.slides.splice(from, 1)[0];
                    st.slides.splice(to, 0, item);
                    for (var i = 0; i < st.slides.length; i++) st.slides[i].slide_index = i;
                    st.selectedSlideKey = keepKey;
                    syncSelectedSlide(st);
                    if (st.lessonId) {
                        var ok = await this.persistSlideOrder();
                        if (ok) markPublishedDirtyIfLive(st);
                    }
                },
                onSlideDragStart(ev, idx) {
                    var st = this.state;
                    st.dragFromIndex = idx;
                    st.dragOverIndex = idx;
                    st.suppressSlideClick = true;
                    if (ev && ev.dataTransfer) {
                        ev.dataTransfer.effectAllowed = 'move';
                        try { ev.dataTransfer.setData('text/plain', String(idx)); } catch (_) {}
                    }
                },
                onSlideDragOver(ev, idx) {
                    if (ev && ev.dataTransfer) ev.dataTransfer.dropEffect = 'move';
                    this.state.dragOverIndex = idx;
                },
                async onSlideDrop(ev, idx) {
                    var st = this.state;
                    var from = st.dragFromIndex;
                    st.dragFromIndex = null;
                    st.dragOverIndex = null;
                    st.suppressSlideClick = true;
                    if (from == null) return;
                    await this.moveSlideTo(from, idx);
                },
                onSlideDragEnd() {
                    var st = this.state;
                    st.dragFromIndex = null;
                    st.dragOverIndex = null;
                    st.suppressSlideClick = true;
                    setTimeout(function() { st.suppressSlideClick = false; }, 80);
                },
                async addComponent(type) {
                    var slide = this.selectedSlide;
                    var st = this.state;
                    slide.components.push(defaultComponent(type));
                    var idx = slide.components.length - 1;
                    var cs = store();
                    var lpCtx = lessonPlanContextForSlides(cs);
                    var draftId = lessonPlanDraftIdForSlides(cs);
                    var goal = (st.data && st.data.lesson_goal) ? String(st.data.lesson_goal).trim() : '';
                    if (!lpCtx && !goal && !draftId) {
                        await this.persistSlideAfterMutation({ refreshPreview: true });
                        return;
                    }
                    st.fillingComponents = true;
                    st.error = '';
                    try {
                        var res = await fetch(getBaseUrl() + '/populate_slide_components', {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            credentials: 'include',
                            body: JSON.stringify({
                                ai_model: (st.data && st.data.ai_model) || 'azure/gpt-6-luna',
                                lesson_plan_context: lpCtx,
                                lesson_plan_draft_id: draftId,
                                lesson_goal: goal,
                                subject: (st.data && st.data.subject) || '',
                                title: (st.data && st.data.title) || '',
                                slide: {
                                    title: slide.title,
                                    slide_type: slide.slide_type,
                                    speaker_notes: slide.speaker_notes,
                                    payload: slide.payload,
                                    components: slide.components
                                },
                                component_indices: [idx]
                            })
                        });
                        var data = await res.json().catch(function() { return {}; });
                        if (!res.ok || !data.success) {
                            throw new Error(data.detail || data.error || 'Could not fill component from lesson context.');
                        }
                        if (res.status === 202 && data.task_id) {
                            await new Promise(function(resolve, reject) {
                                pollTeacherSlideTask(data.task_id, function(result) {
                                    if (!result || !Array.isArray(result.components)) {
                                        reject(new Error('Invalid task result'));
                                        return;
                                    }
                                    slide.components = result.components;
                                    resolve();
                                }, function(err) { reject(new Error(err)); });
                            });
                        } else if (Array.isArray(data.components)) {
                            slide.components = data.components;
                        } else {
                            throw new Error(data.detail || data.error || 'Could not fill component from lesson context.');
                        }
                    } catch (e) {
                        st.error = (e && e.message) || 'Could not fill component from lesson context.';
                    } finally {
                        st.fillingComponents = false;
                        if (!st.error) await this.persistSlideAfterMutation({ refreshPreview: true });
                    }
                },
                async refillAllSlideComponents() {
                    var slide = this.selectedSlide;
                    var st = this.state;
                    if (!slide.components || !slide.components.length) {
                        st.error = 'Add at least one component first.';
                        return;
                    }
                    var cs = store();
                    var lpCtx = lessonPlanContextForSlides(cs);
                    var draftId = lessonPlanDraftIdForSlides(cs);
                    var goal = (st.data && st.data.lesson_goal) ? String(st.data.lesson_goal).trim() : '';
                    if (!lpCtx && !goal && !draftId) {
                        st.error = 'Add a learning goal, open a lesson plan in this canvas, or save a lesson plan draft so we can match content.';
                        return;
                    }
                    st.fillingComponents = true;
                    st.error = '';
                    try {
                        var res = await fetch(getBaseUrl() + '/populate_slide_components', {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            credentials: 'include',
                            body: JSON.stringify({
                                ai_model: (st.data && st.data.ai_model) || 'azure/gpt-6-luna',
                                lesson_plan_context: lpCtx,
                                lesson_plan_draft_id: draftId,
                                lesson_goal: goal,
                                subject: (st.data && st.data.subject) || '',
                                title: (st.data && st.data.title) || '',
                                slide: {
                                    title: slide.title,
                                    slide_type: slide.slide_type,
                                    speaker_notes: slide.speaker_notes,
                                    payload: slide.payload,
                                    components: slide.components
                                }
                            })
                        });
                        var data = await res.json().catch(function() { return {}; });
                        if (!res.ok || !data.success) {
                            throw new Error(data.detail || data.error || 'Could not refill components.');
                        }
                        if (res.status === 202 && data.task_id) {
                            await new Promise(function(resolve, reject) {
                                pollTeacherSlideTask(data.task_id, function(result) {
                                    if (!result || !Array.isArray(result.components)) {
                                        reject(new Error('Invalid task result'));
                                        return;
                                    }
                                    slide.components = result.components;
                                    resolve();
                                }, function(err) { reject(new Error(err)); });
                            });
                        } else if (Array.isArray(data.components)) {
                            slide.components = data.components;
                        } else {
                            throw new Error(data.detail || data.error || 'Could not refill components.');
                        }
                    } catch (e) {
                        st.error = (e && e.message) || 'Could not refill components.';
                    } finally {
                        st.fillingComponents = false;
                        if (!st.error) await this.persistSlideAfterMutation({ refreshPreview: true });
                    }
                },
                removeComponent(index) {
                    this.selectedSlide.components.splice(index, 1);
                    this.persistSlideAfterMutation({ refreshPreview: true });
                },
                addRevealCard(comp) {
                    comp.payload.cards = comp.payload.cards || [];
                    comp.payload.cards.push({ front: 'Prompt', back: 'Reveal' });
                },
                addQuizOption(question) {
                    question.options = question.options || [];
                    question.options.push('New option');
                },
                addSorterCategory(comp) {
                    comp.payload.categories = comp.payload.categories || [];
                    comp.payload.categories.push({ name: 'New category', items: ['New item'] });
                },
                addTimelineEvent(comp) {
                    comp.payload.events = comp.payload.events || [];
                    comp.payload.events.push({ date: 'Step', label: 'Label', description: '' });
                },
                addWorkedStep(comp) {
                    comp.payload.steps = comp.payload.steps || [];
                    comp.payload.steps.push('Reveal the next step.');
                },
                async _saveSlideRecord(slide, st, opts) {
                    opts = opts || {};
                    if (!st.lessonId || !slide) return false;
                    sanitizeSlideImagesWithNotice(slide, st);
                    var payload = prepareSlideForSave(slide);
                    payload.slide_index = slide.slide_index;
                    try {
                        var url = getBaseUrl() + '/' + encodeURIComponent(st.lessonId) + '/slides';
                        var method = 'POST';
                        if (payload.id) {
                            url = getBaseUrl() + '/' + encodeURIComponent(st.lessonId) + '/slides/' + encodeURIComponent(payload.id);
                            method = 'PATCH';
                        }
                        var res = await fetch(url, {
                            method: method,
                            headers: { 'Content-Type': 'application/json' },
                            credentials: 'include',
                            body: JSON.stringify(payload)
                        });
                        var data = await res.json().catch(function() { return {}; });
                        if (!res.ok || !data.success) {
                            throw new Error(data.detail || data.error || 'Slide save failed.');
                        }
                        if (data.slide && data.slide.id) {
                            slide.id = data.slide.id;
                        } else if (data.slides && Array.isArray(data.slides)) {
                            var matchId = payload.id;
                            var matchIndex = payload.slide_index;
                            for (var si = 0; si < data.slides.length; si++) {
                                var savedRow = data.slides[si];
                                if (!savedRow) continue;
                                if (matchId && String(savedRow.id) === String(matchId)) {
                                    slide.id = savedRow.id;
                                    break;
                                }
                                if (!matchId && Number(savedRow.slide_index) === Number(matchIndex)) {
                                    slide.id = savedRow.id;
                                    break;
                                }
                            }
                        }
                        return data;
                    } catch (e) {
                        if (!opts.suppressError) st.error = (e && e.message) || 'Slide save failed.';
                        return null;
                    }
                },
                async saveCurrentSlide(opts) {
                    opts = opts || {};
                    var st = this.state;
                    if (!st.lessonId) {
                        st.error = 'Generate the storyboard first, then save slides.';
                        return false;
                    }
                    var slideIndex = st.selectedSlideIndex || 0;
                    var slide = this.selectedSlide;
                    slide.slide_index = slideIndex;
                    st.saving = true;
                    st.autoSaveStatus = 'saving';
                    st.error = '';
                    try {
                        var data = await this._saveSlideRecord(slide, st);
                        if (!data) {
                            st.autoSaveStatus = 'error';
                            return false;
                        }
                        if (data.slides && Array.isArray(data.slides)) applyBundle(store(), data);
                        clearSlideDirty(st, slide, slideIndex);
                        markPublishedDirtyIfLive(st);
                        if (opts.refreshPreview) {
                            st.previewUrl = getBaseUrl() + '/' + encodeURIComponent(st.lessonId) + '/preview?t=' + Date.now();
                        }
                        st.autoSaveStatus = 'saved';
                        clearTimeout(st.autoSaveStatusTimer);
                        st.autoSaveStatusTimer = setTimeout(function() {
                            if (st.autoSaveStatus === 'saved') st.autoSaveStatus = '';
                        }, 2500);
                        return true;
                    } catch (e) {
                        st.error = (e && e.message) || 'Slide save failed.';
                        st.autoSaveStatus = 'error';
                        return false;
                    } finally {
                        st.saving = false;
                    }
                },
                async saveAllSlides(opts) {
                    opts = opts || {};
                    var st = this.state;
                    if (!st.lessonId) {
                        st.error = 'Generate the storyboard first, then save slides.';
                        return false;
                    }
                    if (st.autoSaveTimer !== null) {
                        clearTimeout(st.autoSaveTimer);
                        st.autoSaveTimer = null;
                    }
                    var hadDirtySlides = !!(st.dirtySlideKeys && Object.keys(st.dirtySlideKeys).length);
                    st.saving = true;
                    st.autoSaveStatus = 'saving';
                    st.error = '';
                    var selectedBefore = st.selectedSlideIndex || 0;
                    try {
                        if (!(await this.persistSlideOrder())) return false;
                        var lastData = null;
                        for (var i = 0; i < (st.slides || []).length; i++) {
                            st.slides[i].slide_index = i;
                            lastData = await this._saveSlideRecord(st.slides[i], st, { suppressError: true });
                            if (!lastData) {
                                st.error = st.error || ('Could not save slide ' + (i + 1) + '.');
                                st.autoSaveStatus = 'error';
                                return false;
                            }
                        }
                        if (lastData && lastData.slides && Array.isArray(lastData.slides)) applyBundle(store(), lastData);
                        st.selectedSlideIndex = Math.max(0, Math.min(selectedBefore, st.slides.length - 1));
                        st.dirtySlideKeys = {};
                        if (hadDirtySlides) markPublishedDirtyIfLive(st);
                        if (opts.refreshPreview) {
                            st.previewUrl = getBaseUrl() + '/' + encodeURIComponent(st.lessonId) + '/preview?t=' + Date.now();
                        }
                        st.autoSaveStatus = 'saved';
                        clearTimeout(st.autoSaveStatusTimer);
                        st.autoSaveStatusTimer = setTimeout(function() {
                            if (st.autoSaveStatus === 'saved') st.autoSaveStatus = '';
                        }, 2500);
                        return true;
                    } catch (e) {
                        st.error = (e && e.message) || 'Slide save failed.';
                        st.autoSaveStatus = 'error';
                        return false;
                    } finally {
                        st.saving = false;
                    }
                },
                async repairLessonImages() {
                    var st = this.state;
                    if (!st.lessonId) {
                        st.error = 'Generate the storyboard first.';
                        return;
                    }
                    st.saving = true;
                    st.error = '';
                    st.imageWarning = '';
                    try {
                        var url = getBaseUrl() + '/' + encodeURIComponent(st.lessonId) + '/repair_images';
                        var res = await fetch(url, {
                            method: 'POST',
                            credentials: 'include'
                        });
                        var data = await res.json().catch(function() { return {}; });
                        if (!res.ok || !data.success) throw new Error(data.detail || data.error || 'Image repair failed.');
                        applyBundle(store(), data);
                        st.status = data.message || 'Image links repaired.';
                        if ((data.changed_count || 0) === 0) {
                            st.imageWarning = 'No broken image links were changed. If images are still broken, the source file may not exist on Wikimedia Commons.';
                        }
                        st.previewUrl = getBaseUrl() + '/' + encodeURIComponent(st.lessonId) + '/preview?t=' + Date.now();
                    } catch (e) {
                        st.error = (e && e.message) || 'Image repair failed.';
                    } finally {
                        st.saving = false;
                    }
                },
                async publish() {
                    var st = this.state;
                    if (!st.lessonId) {
                        st.error = 'Generate the storyboard first.';
                        return;
                    }
                    if (!(await this.saveAllSlides({ refreshPreview: false }))) return;
                    st.publishing = true;
                    st.error = '';
                    st.publishSuccess = '';
                    try {
                        var res = await fetch(getBaseUrl() + '/' + encodeURIComponent(st.lessonId) + '/publish', {
                            method: 'POST',
                            credentials: 'include'
                        });
                        var data = await res.json().catch(function() { return {}; });
                        if (!res.ok || !data.success) throw new Error(data.detail || data.error || 'Publish failed.');
                        applyBundle(store(), data);
                        st.publishedUrl = data.published_url || '';
                        st.status = 'published';
                        st.publishedDirty = false;
                        st.shareOpen = true;
                        st.publishSuccess = 'Class page is live. Use Share to copy the link or update it after more edits.';
                        this.refreshPreview();
                    } catch (e) {
                        st.error = (e && e.message) || 'Publish failed.';
                    } finally {
                        st.publishing = false;
                    }
                },
                async togglePreviewDeck() {
                    var st = this.state;
                    if (!st.lessonId) return;
                    if (st.viewMode === 'preview') {
                        st.viewMode = 'edit';
                        st.activeStep = 'editor';
                        return;
                    }
                    st.activeStep = 'editor';
                    st.shareOpen = false;
                    if (!(await this.saveAllSlides({ refreshPreview: true }))) return;
                    st.viewMode = 'preview';
                },
                refreshPreview() {
                    var st = this.state;
                    if (st.lessonId) st.previewUrl = getBaseUrl() + '/' + encodeURIComponent(st.lessonId) + '/preview?t=' + Date.now();
                }
            };
    }

    if (typeof window.canvasRegisterDeferredAlpineData === 'function') {
        window.canvasRegisterDeferredAlpineData('lessonSlideCreatorPanel', lessonSlideCreatorPanelFactory);
    } else {
        document.addEventListener('alpine:init', function() {
            Alpine.data('lessonSlideCreatorPanel', lessonSlideCreatorPanelFactory);
        });
        if (typeof Alpine !== 'undefined' && typeof Alpine.data === 'function') {
            Alpine.data('lessonSlideCreatorPanel', lessonSlideCreatorPanelFactory);
        }
    }

    function readCanvasBootConfig() {
        var el = document.getElementById('canvas-app-config');
        if (!el || !el.textContent) return {};
        try { return JSON.parse(el.textContent); } catch (e) { return {}; }
    }

    function bootstrapLessonSlideCreatorIfActive() {
        if (typeof Alpine === 'undefined' || !Alpine.store) return;
        var store;
        try { store = Alpine.store('canvas'); } catch (e) { return; }
        if (!store || store.currentAction !== 'lesson_slide_creator') return;
        if (store.teacherSlideLesson) return;
        var feature = window.CanvasFeatures && window.CanvasFeatures.lesson_slide_creator;
        if (!feature || typeof feature.onSetActionLessonSlideCreator !== 'function') return;
        var boot = readCanvasBootConfig();
        feature.onSetActionLessonSlideCreator(store, store.actionContext || {}, {
            baseUrl: boot.teacherSlideLessonsBaseUrl || config.baseUrl,
            componentsUrl: boot.teacherSlideComponentsUrl || config.componentsUrl,
            uploadImageUrlTemplate: boot.teacherSlideLessonUploadImageUrlTemplate || config.uploadImageUrlTemplate,
            generateImageUrlTemplate: boot.teacherSlideGenerateImageUrlTemplate || config.generateImageUrlTemplate,
            generateImageResultUrlTemplate: boot.teacherSlideGenerateImageResultUrlTemplate || config.generateImageResultUrlTemplate,
            enhanceImagePromptUrlTemplate: boot.teacherSlideEnhanceImagePromptUrlTemplate || config.enhanceImagePromptUrlTemplate,
            imageModels: boot.teacherSlideImageModels || config.imageModels,
            imageStyles: boot.teacherSlideImageStyles || config.imageStyles
        });
    }

    bootstrapLessonSlideCreatorIfActive();
})();
