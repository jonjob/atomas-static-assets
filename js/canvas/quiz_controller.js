(function() {
    'use strict';

    function readQuizBootConfig() {
        var el = document.getElementById('canvas-app-config');
        if (!el || !el.textContent) return {};
        try {
            return JSON.parse(el.textContent);
        } catch (e) {
            return {};
        }
    }

    function initialQuizExport() {
        return {
            loading: false,
            error: '',
            successLink: '',
            pupilLink: '',
            teacherLink: ''
        };
    }

    function initialQuiz() {
        return {
            wizardActive: true,
            wizardStep: 1,
            wizardRegMode: 'school',
            wizardError: '',
            taskId: null,
            quizId: null,
            quizPublicUrl: null,
            htmlTemplateId: 'classic',
            quizPreviewNonce: 0,
            outputFormat: 'interactive_html',
            outputMode: 'interactive_html',
            quizPanelExpanded: false,
            quizSaveLoading: false,
            quizRegenerateLoading: false,
            content: null,
            questions: null,
            data: {
                num_questions: 5,
                include_answers: true,
                topic: ''
            },
            contentSource: 'paste',
            uploadedContentText: '',
            sourceUrl: '',
            sourceUrlLoading: false,
            sourceUrlError: '',
            difficulty: 'standard',
            questionTypeMix: { mc: true, fib: true, tf: true },
            answerDocumentMode: 'teacher',
            notebookSelections: [],
            sourcePreview: { charCount: 0, wordCount: 0, estimatedQuestions: 0, hint: '' },
            quizExport: initialQuizExport(),
            loading: false,
            error: '',
            selectionMenu: null,
            amendingAt: null,
            step: 1,
            messages: [],
            addQuestionModalOpen: false,
            addQuestionGenerating: false
        };
    }

    function defaultQuizQuestion() {
        return {
            id: 'quiz-' + Date.now() + '-' + Math.floor(Math.random() * 1000),
            type: 'mc',
            question: '',
            options: ['', '', '', ''],
            correct: 1,
            image_url: '',
            image_alt: '',
            image_prompt: '',
            image_prompt_enhancing: false,
            image_generating: false
        };
    }

    function normalizeQuestionForEditor(q) {
        if (!q || typeof q !== 'object') return defaultQuizQuestion();
        var out = Object.assign({}, q);
        if (!out.id) out.id = 'quiz-' + Date.now() + '-' + Math.floor(Math.random() * 1000);
        out.image_url = out.image_url || '';
        out.image_alt = out.image_alt || '';
        out.image_prompt = out.image_prompt || '';
        out.image_prompt_enhancing = !!out.image_prompt_enhancing;
        out.image_generating = !!out.image_generating;
        if (out.type === 'fib' && (out.answer === undefined || out.answer === null) && out.correct !== undefined && out.correct !== null) {
            out.answer = out.correct;
        }
        if (out.type === 'tf' && (out.answer === undefined || out.answer === null) && out.correct !== undefined && out.correct !== null) {
            var c = out.correct;
            out.answer = typeof c === 'string' ? c.toLowerCase() === 'true' : !!c;
        }
        if (out.type === 'mc') {
            var o = out.options ? out.options.slice() : [];
            while (o.length < 4) o.push('');
            out.options = o.slice(0, 4);
            var ct = out.correct;
            if (typeof ct === 'number' && ct >= 1 && ct <= 4) out.correct = Math.round(ct);
            else if (typeof ct === 'string' && /^[1-4]$/.test(ct.trim())) out.correct = parseInt(ct.trim(), 10);
            else if (ct !== undefined && ct !== null && String(ct).length) {
                var ix = out.options.findIndex(function(x) { return (x || '').trim() === String(ct).trim(); });
                out.correct = ix >= 0 ? ix + 1 : 1;
            } else out.correct = 1;
        }
        if (out.type === 'fib') {
            if (out.answer === undefined || out.answer === null) out.answer = '';
            out.hint = out.hint || '';
        }
        if (out.type === 'tf') {
            if (typeof out.answer !== 'boolean') {
                out.answer = out.answer === 'true' || out.answer === true ||
                    (typeof out.correct === 'string' && out.correct.toLowerCase() === 'true');
            }
            out.explanation = out.explanation || '';
        }
        return out;
    }

    function syncQuizOutputMode(quiz) {
        if (!quiz) return;
        var of = quiz.outputFormat || '';
        if (of === 'interactive_html' || of === 'question_list') {
            quiz.outputMode = of;
        }
    }

    function updateQuizSourcePreview(quiz) {
        if (!quiz) return;
        var text = (quiz.uploadedContentText || '').trim();
        var chars = text.length;
        var words = text ? text.split(/\s+/).filter(Boolean).length : 0;
        var est = words > 0 ? Math.max(1, Math.floor(words / 150)) : 0;
        var hint = '';
        if (text && words < 200) {
            hint = 'Add more source text for better questions.';
        } else if (!text && (quiz.notebookSelections || []).length) {
            hint = 'Content will be retrieved from your school documents at generation time.';
        }
        quiz.sourcePreview = {
            charCount: chars,
            wordCount: words,
            estimatedQuestions: est,
            hint: hint
        };
    }

    function initQuizWizard(store, actionContext) {
        var qz = store.quiz;
        if (!qz) return;
        qz.wizardActive = true;
        qz.wizardError = '';
        qz.wizardStep = 1;
        qz.htmlTemplateId = qz.htmlTemplateId || 'classic';
        qz.outputFormat = 'interactive_html';
        qz.outputMode = 'interactive_html';
        qz.difficulty = qz.difficulty || 'standard';
        qz.questionTypeMix = Object.assign({ mc: true, fib: true, tf: true }, qz.questionTypeMix || {});
        qz.answerDocumentMode = qz.answerDocumentMode || 'teacher';
        qz.notebookSelections = qz.notebookSelections || [];
        qz.quizExport = qz.quizExport || initialQuizExport();
        qz.data = Object.assign({
            num_questions: 5,
            include_answers: true,
            topic: ''
        }, qz.data || {});
        var ctx = actionContext || store.actionContext || {};
        if (ctx.targetType === 'reg_group' && ctx.targetLabel) {
            qz.data.registration_group = String(ctx.targetLabel).trim();
            qz.wizardRegMode = 'from_context';
        } else {
            var urg = store.userRegistrationGroups || [];
            if (urg.length === 1) {
                qz.data.registration_group = urg[0];
                qz.wizardRegMode = 'single';
            } else if (urg.length > 1) {
                qz.wizardRegMode = 'multiple';
                qz.data.registration_group = qz.data.registration_group || '';
            } else {
                qz.wizardRegMode = 'school';
                qz.data.registration_group = qz.data.registration_group || '';
            }
        }
        updateQuizSourcePreview(qz);
    }

    function normalizeCanvasQuizQuestionsFromServer(questions) {
        if (!questions || !questions.length) return [];
        return questions.map(function(q) {
            return normalizeQuestionForEditor(q);
        });
    }

    function suggestQuizHtmlTemplateId(subject, topic, templates) {
        var hay = ((subject || '') + ' ' + (topic || '')).toLowerCase();
        if (!hay.trim()) return 'classic';
        var bestId = 'classic';
        var bestScore = 0;
        (templates || []).forEach(function(t) {
            if (!t || t.id === 'classic') return;
            var score = 0;
            (t.subject_tags || []).forEach(function(tag) {
                var tagL = String(tag || '').toLowerCase();
                if (tagL && hay.indexOf(tagL) >= 0) score += tagL.length > 4 ? 2 : 1;
            });
            if (score > bestScore) {
                bestScore = score;
                bestId = t.id;
            }
        });
        return bestId;
    }

    function applyQuizOutputFormatFromApi(store, qData) {
        if (!store || !store.quiz || !qData) return;
        var of = qData.output_format;
        if (of === 'question_list') {
            store.quiz.outputFormat = 'question_list';
            store.quiz.outputMode = 'question_list';
        } else if (of === 'interactive_html') {
            store.quiz.outputFormat = 'interactive_html';
            store.quiz.outputMode = 'interactive_html';
        }
        if (qData.html_template_id) store.quiz.htmlTemplateId = qData.html_template_id;
    }

    function ensureQuizQuestionsArray(store) {
        if (!store || !store.quiz) return [];
        if (!Array.isArray(store.quiz.questions)) store.quiz.questions = [];
        return store.quiz.questions;
    }

    function addQuizQuestion(store) {
        var questions = ensureQuizQuestionsArray(store);
        questions.push(defaultQuizQuestion());
    }

    function quizHasSourceMaterial(quiz) {
        if (!quiz) return false;
        var hasText = (quiz.uploadedContentText || '').trim().length > 0;
        var hasNb = (quiz.notebookSelections || []).length > 0;
        return hasText || hasNb || !!quiz.quizId;
    }

    function openAddQuestionChoice(store) {
        if (!store || !store.quiz) return;
        store.quiz.addQuestionModalOpen = true;
    }

    function closeAddQuestionChoice(store) {
        if (!store || !store.quiz) return;
        store.quiz.addQuestionModalOpen = false;
    }

    function addManualQuizQuestion(store) {
        closeAddQuestionChoice(store);
        addQuizQuestion(store);
    }

    function generateQuizQuestionFromSource(store) {
        if (!store || !store.quiz) return Promise.resolve();
        var quiz = store.quiz;
        if (quiz.addQuestionGenerating) return Promise.resolve();

        var cfg = readQuizBootConfig();
        var url = cfg.quizGenerateQuestionUrl || '/quiz/generate_question';
        var existing = (quiz.questions || []).map(function(q) {
            return { question: (q && q.question) || '' };
        });

        quiz.addQuestionGenerating = true;
        quiz.error = '';
        return fetch(url, {
            method: 'POST',
            credentials: 'include',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                quiz_id: quiz.quizId || undefined,
                uploaded_content_text: (quiz.uploadedContentText || '').trim() || undefined,
                selected_document_ids: (quiz.notebookSelections || []).map(function(x) {
                    return String(x.id || '');
                }).filter(Boolean),
                subject: quiz.data && quiz.data.subject,
                curriculum_year: quiz.data && quiz.data.curriculum_year,
                registration_group: quiz.data && quiz.data.registration_group,
                topic: quiz.data && quiz.data.topic,
                difficulty: quiz.difficulty || 'standard',
                question_type_mix: quiz.questionTypeMix || { mc: true, fib: true, tf: true },
                ai_model: store.aiModel || undefined,
                existing_questions: existing
            })
        })
            .then(function(res) {
                return res.json().catch(function() { return {}; }).then(function(data) {
                    return { res: res, data: data };
                });
            })
            .then(function(payload) {
                if (!payload.res.ok || !payload.data || !payload.data.success || !payload.data.question) {
                    throw new Error((payload.data && payload.data.error) || 'Could not generate question');
                }
                var questions = ensureQuizQuestionsArray(store);
                questions.push(normalizeQuestionForEditor(payload.data.question));
                closeAddQuestionChoice(store);
            })
            .catch(function(e) {
                quiz.error = (e && e.message) || 'Could not generate question from source material';
            })
            .finally(function() {
                quiz.addQuestionGenerating = false;
            });
    }

    function removeQuizQuestion(store, idx) {
        if (!store || !store.quiz || !Array.isArray(store.quiz.questions)) return;
        var questions = store.quiz.questions;
        if (idx < 0 || idx >= questions.length) return;
        var q = questions[idx];
        var hasContent = (q.question || '').trim() || (q.image_url || '').trim();
        if (hasContent && !window.confirm('Remove this question?')) return;
        questions.splice(idx, 1);
    }

    function moveQuizQuestion(store, idx, direction) {
        if (!store || !store.quiz || !Array.isArray(store.quiz.questions)) return;
        var questions = store.quiz.questions;
        var target = idx + direction;
        if (idx < 0 || idx >= questions.length || target < 0 || target >= questions.length) return;
        var item = questions[idx];
        questions.splice(idx, 1);
        questions.splice(target, 0, item);
    }

    function quizUploadImageUrl(store) {
        var cfg = readQuizBootConfig();
        var tpl = cfg.quizUploadImageUrlTemplate || '/quiz/__QUIZ_ID__/upload_image';
        var quizId = store && store.quiz && store.quiz.quizId;
        if (!quizId) return '';
        return tpl.replace('__QUIZ_ID__', encodeURIComponent(String(quizId)));
    }

    function pollImageCreatorTask(taskId) {
        var cfg = readQuizBootConfig();
        var resultBase = '/image-creator/result/';
        return new Promise(function(resolve) {
            function poll() {
                fetch(resultBase + taskId, { credentials: 'include' })
                    .then(function(r) { return r.json(); })
                    .then(function(data) {
                        if (data.status === 'PENDING') {
                            setTimeout(poll, 1500);
                            return;
                        }
                        if (data.status === 'SUCCESS' && data.image_url) resolve(data.image_url);
                        else resolve(null);
                    })
                    .catch(function() { resolve(null); });
            }
            poll();
        });
    }

    function enhanceQuizQuestionImagePrompt(store, question) {
        if (!store || !question) return Promise.resolve();
        if (question.image_prompt_enhancing) return Promise.resolve();
        var prompt = String(question.image_prompt || '').trim();
        if (!prompt) return Promise.resolve();
        var cfg = readQuizBootConfig();
        var url = cfg.imageCreatorEnhancePromptUrl || '/image_creator/enhance_prompt';
        question.image_prompt_enhancing = true;
        return fetch(url, {
            method: 'POST',
            credentials: 'include',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                prompt: prompt,
                style: store.imageCreatorStyle || 'Photorealistic',
                size: store.imageCreatorSize || '512'
            })
        })
            .then(function(res) { return res.json().catch(function() { return {}; }).then(function(data) { return { res: res, data: data }; }); })
            .then(function(payload) {
                if (payload.res.ok && payload.data && payload.data.enhanced_prompt) {
                    question.image_prompt = payload.data.enhanced_prompt;
                } else {
                    window.alert((payload.data && payload.data.error) || 'Could not enhance image prompt.');
                }
            })
            .catch(function() {
                window.alert('Network error while enhancing image prompt.');
            })
            .finally(function() {
                question.image_prompt_enhancing = false;
            });
    }

    function generateQuizQuestionImage(store, question) {
        if (!store || !question) return Promise.resolve();
        if (question.image_generating) return Promise.resolve();
        var prompt = String(question.image_prompt || '').trim();
        if (!prompt) {
            window.alert('Describe the image you want first.');
            return Promise.resolve();
        }
        var cfg = readQuizBootConfig();
        var submitUrl = cfg.imageCreatorSubmitUrl || '/image_creator';
        var fullPrompt = 'Quiz illustration: ' + prompt;
        var formData = new FormData();
        formData.append('prompt', fullPrompt);
        formData.append('style', store.imageCreatorStyle || 'Photorealistic');
        formData.append('size', store.imageCreatorSize || '512');
        formData.append('model', store.imageCreatorModel || 'runware:400@2');
        question.image_generating = true;
        return fetch(submitUrl, { method: 'POST', body: formData, credentials: 'include' })
            .then(function(res) { return res.json().catch(function() { return {}; }).then(function(data) { return { res: res, data: data }; }); })
            .then(function(payload) {
                if (!payload.res.ok || !payload.data || !payload.data.task_id) {
                    throw new Error((payload.data && payload.data.error) || 'Image generation failed');
                }
                return pollImageCreatorTask(payload.data.task_id);
            })
            .then(function(imageUrl) {
                if (!imageUrl) throw new Error('Image generation did not return a URL.');
                question.image_url = imageUrl;
                question.image_alt = prompt || 'Quiz image';
            })
            .catch(function(e) {
                window.alert((e && e.message) || 'Could not generate image.');
            })
            .finally(function() {
                question.image_generating = false;
            });
    }

    function uploadQuizQuestionImage(store, question, file) {
        if (!store || !question || !file) return Promise.resolve();
        var uploadUrl = quizUploadImageUrl(store);
        if (!uploadUrl) {
            window.alert('Save the quiz first before uploading images.');
            return Promise.resolve();
        }
        var formData = new FormData();
        formData.append('image', file);
        return fetch(uploadUrl, { method: 'POST', body: formData, credentials: 'include' })
            .then(function(res) { return res.json().catch(function() { return {}; }).then(function(data) { return { res: res, data: data }; }); })
            .then(function(payload) {
                if (!payload.res.ok || !payload.data || !payload.data.success || !payload.data.image_url) {
                    throw new Error((payload.data && payload.data.error) || 'Upload failed');
                }
                question.image_url = payload.data.image_url;
                question.image_alt = file.name || question.image_alt || 'Quiz image';
            })
            .catch(function(e) {
                window.alert((e && e.message) || 'Could not upload image.');
            });
    }

    function clearQuizQuestionImage(question) {
        if (!question) return;
        question.image_url = '';
        question.image_alt = '';
    }

    var QUIZ_TYPE_LABELS = { mc: 'Multiple choice', tf: 'True or false', fib: 'Fill the blank' };
    var loadedTemplateFonts = {};

    function ensureQuizTemplateFonts(templates) {
        (templates || []).forEach(function(t) {
            var href = t && t.font_link;
            if (!href || loadedTemplateFonts[href]) return;
            loadedTemplateFonts[href] = true;
            var link = document.createElement('link');
            link.rel = 'stylesheet';
            link.href = href;
            document.head.appendChild(link);
        });
    }

    function quizQuestionContent(q) {
        if (!q) return null;
        return {
            id: q.id, type: q.type, question: q.question || '', options: q.options || null,
            correct: q.correct, answer: q.answer, hint: q.hint || '', explanation: q.explanation || '',
            image_url: q.image_url || ''
        };
    }

    function quizMcCorrectIndex(q) {
        if (!q || q.type !== 'mc') return -1;
        var c = q.correct;
        var n = parseInt(c, 10);
        if (!isNaN(n) && n >= 1 && n <= 4 && String(c).trim() === String(n)) return n - 1;
        if (c !== undefined && c !== null && String(c).length) {
            var ix = (q.options || []).findIndex(function(o) { return (o || '').trim() === String(c).trim(); });
            if (ix >= 0) return ix;
        }
        return 0;
    }

    function quizQuestionIssues(q) {
        var out = [];
        if (!q) return out;
        if (!(q.question || '').trim()) out.push('Add the question text');
        if (q.type === 'mc') {
            var opts = (q.options || []).filter(function(o) { return (o || '').trim(); });
            if (opts.length < 2) out.push('Add at least two answers');
            var ci = quizMcCorrectIndex(q);
            if (!((q.options || [])[ci] || '').trim()) out.push('Pick a correct answer that has text');
        } else if (q.type === 'fib') {
            if (!String(q.answer == null ? '' : q.answer).trim()) out.push('Add the missing word or answer');
        }
        return out;
    }

    function stripCacheBuster(url) {
        if (!url) return '';
        return String(url).replace(/([?&])t=\d+(&|$)/, function(m, pre, post) { return post ? pre : ''; }).replace(/[?&]$/, '');
    }

    function quizEditorUiFactory() {
        var store = function() { return Alpine.store('canvas'); };
        var cfg = readQuizBootConfig();
        return {
            selectedId: null,
            saveState: 'saved',
            lastSavedSig: '',
            publishedSig: '',
            saveTimer: null,
            saveQueued: false,
            designOpen: false,
            linkCopied: false,
            undo: null,
            undoTimer: null,
            imageOpen: false,

            init() {
                var self = this;
                this.resetBaseline();
                this.$watch('draftSig', function(sig) { self.onDraftChanged(sig); });
                this.$watch('$store.canvas.quiz.quizId', function() { self.resetBaseline(); });
            },

            destroy() {
                clearTimeout(this.saveTimer);
                clearTimeout(this.undoTimer);
            },

            resetBaseline() {
                var sig = this.draftSig;
                this.lastSavedSig = sig;
                this.publishedSig = this.qz && this.qz.quizPublicUrl ? sig : '';
                this.saveState = 'saved';
                var first = this.questions[0];
                this.selectedId = first ? first.id : null;
                this.undo = null;
            },

            get qz() { return store().quiz || {}; },
            get questions() { return Array.isArray(this.qz.questions) ? this.qz.questions : []; },
            get templates() { return Array.isArray(cfg.quizHtmlTemplates) ? cfg.quizHtmlTemplates : []; },

            get draftSig() {
                var qz = this.qz;
                return JSON.stringify({
                    t: qz.htmlTemplateId || 'classic',
                    q: this.questions.map(quizQuestionContent)
                });
            },

            get selectedIndex() {
                var qs = this.questions;
                if (!qs.length) return -1;
                var id = this.selectedId;
                var ix = qs.findIndex(function(q) { return q && q.id === id; });
                return ix >= 0 ? ix : 0;
            },
            get selected() {
                var i = this.selectedIndex;
                return i >= 0 ? this.questions[i] : null;
            },
            select(i) {
                var q = this.questions[i];
                if (!q) return;
                this.selectedId = q.id;
                this.imageOpen = !!(q.image_url || q.image_prompt);
            },
            selectNext(dir) {
                var i = this.selectedIndex + dir;
                if (i >= 0 && i < this.questions.length) this.select(i);
            },

            typeLabel(t) { return QUIZ_TYPE_LABELS[t] || 'Question'; },
            issues(q) { return quizQuestionIssues(q); },
            totalIssues() {
                var self = this;
                return this.questions.reduce(function(n, q) { return n + (self.issues(q).length ? 1 : 0); }, 0);
            },

            onDraftChanged(sig) {
                if (!this.qz.quizId) return;
                if (sig === this.lastSavedSig) {
                    if (this.saveState !== 'saving') this.saveState = 'saved';
                    return;
                }
                if (this.saveState !== 'saving') this.saveState = 'dirty';
                var self = this;
                clearTimeout(this.saveTimer);
                this.saveTimer = setTimeout(function() { self.saveNow(); }, 900);
            },

            async saveNow() {
                clearTimeout(this.saveTimer);
                var s = store();
                if (!s.quiz || !s.quiz.quizId) return;
                if (s.quiz.quizSaveLoading) {
                    this.saveQueued = true;
                    return;
                }
                var sig = this.draftSig;
                if (sig === this.lastSavedSig) {
                    this.saveState = 'saved';
                    return;
                }
                this.saveState = 'saving';
                await s.saveCanvasQuiz();
                if (s.quiz.error) {
                    this.saveState = 'error';
                    return;
                }
                this.lastSavedSig = sig;
                var again = this.saveQueued || this.draftSig !== sig;
                this.saveQueued = false;
                this.saveState = again ? 'dirty' : 'saved';
                if (again) {
                    var self = this;
                    this.saveTimer = setTimeout(function() { self.saveNow(); }, 300);
                }
            },

            get isPublished() { return !!this.qz.quizPublicUrl; },
            get publishOutOfDate() { return this.isPublished && this.draftSig !== this.publishedSig; },
            get studentLink() { return stripCacheBuster(this.qz.quizPublicUrl); },

            async publish() {
                var s = store();
                clearTimeout(this.saveTimer);
                var sig = this.draftSig;
                this.saveState = 'saving';
                await s.regenerateQuizHtmlCanvas();
                if (s.quiz.error) {
                    this.saveState = 'error';
                    return;
                }
                this.lastSavedSig = sig;
                this.publishedSig = sig;
                this.saveState = this.draftSig === sig ? 'saved' : 'dirty';
                if (this.saveState === 'dirty') this.onDraftChanged(this.draftSig);
            },

            copyLink() {
                var url = this.studentLink;
                if (!url) return;
                var self = this;
                var done = function() {
                    self.linkCopied = true;
                    setTimeout(function() { self.linkCopied = false; }, 1800);
                };
                if (navigator.clipboard && navigator.clipboard.writeText) {
                    navigator.clipboard.writeText(url).then(done, function() { window.prompt('Copy this link:', url); });
                } else {
                    window.prompt('Copy this link:', url);
                }
            },

            get previewSrc() {
                var qz = this.qz;
                var tpl = cfg.quizPreviewUrlTemplate;
                if (!qz.quizId || !tpl) return '';
                var base = tpl.replace('__QUIZ_ID__', encodeURIComponent(String(qz.quizId)));
                var sep = base.indexOf('?') >= 0 ? '&' : '?';
                var src = base + sep + 'template_id=' + encodeURIComponent(qz.htmlTemplateId || 'classic') +
                    '&t=' + (qz.quizPreviewNonce || 0);
                var sel = this.selected;
                return sel && sel.id ? src + '#' + encodeURIComponent(String(sel.id)) : src;
            },

            addOfType(type) {
                var q = defaultQuizQuestion();
                q.type = type || 'mc';
                q = normalizeQuestionForEditor(q);
                var qs = ensureQuizQuestionsArray(store());
                var at = this.selectedIndex >= 0 ? this.selectedIndex + 1 : qs.length;
                qs.splice(at, 0, q);
                this.selectedId = q.id;
                this.imageOpen = false;
                closeAddQuestionChoice(store());
                this.$nextTick(function() {
                    var el = document.getElementById('quiz-editor-question-text');
                    if (el) el.focus();
                });
            },

            async addFromSource() {
                var before = this.questions.length;
                await generateQuizQuestionFromSource(store());
                var qs = this.questions;
                if (qs.length > before) this.select(qs.length - 1);
            },

            duplicate(i) {
                var qs = this.questions;
                var src = qs[i];
                if (!src) return;
                var copy = normalizeQuestionForEditor(JSON.parse(JSON.stringify(quizQuestionContent(src))));
                copy.id = defaultQuizQuestion().id;
                copy.image_alt = src.image_alt || '';
                copy.image_prompt = src.image_prompt || '';
                qs.splice(i + 1, 0, copy);
                this.selectedId = copy.id;
            },

            move(i, dir) {
                moveQuizQuestion(store(), i, dir);
            },

            remove(i) {
                var qs = this.questions;
                var q = qs[i];
                if (!q) return;
                qs.splice(i, 1);
                var next = qs[Math.min(i, qs.length - 1)];
                this.selectedId = next ? next.id : null;
                var self = this;
                clearTimeout(this.undoTimer);
                this.undo = { q: q, idx: i };
                this.undoTimer = setTimeout(function() { self.undo = null; }, 7000);
            },

            undoRemove() {
                if (!this.undo) return;
                var qs = ensureQuizQuestionsArray(store());
                qs.splice(Math.min(this.undo.idx, qs.length), 0, this.undo.q);
                this.selectedId = this.undo.q.id;
                this.undo = null;
                clearTimeout(this.undoTimer);
            },

            setType(q, type) {
                if (!q || q.type === type) return;
                q.type = type;
                var normalized = normalizeQuestionForEditor(q);
                Object.keys(normalized).forEach(function(k) { q[k] = normalized[k]; });
            },

            generateImage(q) { return generateQuizQuestionImage(store(), q); },
            enhanceImagePrompt(q) { return enhanceQuizQuestionImagePrompt(store(), q); },
            clearImage(q) { clearQuizQuestionImage(q); },
            uploadImage(ev) {
                var file = ev && ev.target && ev.target.files && ev.target.files[0];
                if (ev && ev.target) ev.target.value = '';
                var q = this.selected;
                if (!file || !q) return;
                return uploadQuizQuestionImage(store(), q, file);
            },

            mcCorrectIndex(q) { return quizMcCorrectIndex(q); },
            setMcCorrect(q, i) { if (q) q.correct = i + 1; },
            tfAnswer(q) { return q && (q.answer === true || q.answer === 'true'); },

            templateById(id) {
                var key = String(id || 'classic');
                return this.templates.find(function(t) { return t && t.id === key; }) || this.templates[0] || null;
            },
            get currentTemplate() { return this.templateById(this.qz.htmlTemplateId); },
            chooseTemplate(id) {
                this.qz.htmlTemplateId = id;
                this.designOpen = false;
            },
            loadTemplateFonts() { ensureQuizTemplateFonts(this.templates); }
        };
    }

    if (typeof window.canvasRegisterDeferredAlpineData === 'function') {
        window.canvasRegisterDeferredAlpineData('quizEditorUi', quizEditorUiFactory);
    } else if (typeof Alpine !== 'undefined' && typeof Alpine.data === 'function') {
        Alpine.data('quizEditorUi', quizEditorUiFactory);
    } else {
        document.addEventListener('alpine:init', function() {
            Alpine.data('quizEditorUi', quizEditorUiFactory);
        });
    }

    window.CanvasFeatures = window.CanvasFeatures || {};
    window.CanvasFeatures.quiz = {
        ensureQuizTemplateFonts: ensureQuizTemplateFonts,
        initialQuiz: initialQuiz,
        initialQuizExport: initialQuizExport,
        initQuizWizard: initQuizWizard,
        syncQuizOutputMode: syncQuizOutputMode,
        updateQuizSourcePreview: updateQuizSourcePreview,
        normalizeCanvasQuizQuestionsFromServer: normalizeCanvasQuizQuestionsFromServer,
        normalizeQuestionForEditor: normalizeQuestionForEditor,
        defaultQuizQuestion: defaultQuizQuestion,
        addQuizQuestion: addQuizQuestion,
        quizHasSourceMaterial: quizHasSourceMaterial,
        openAddQuestionChoice: openAddQuestionChoice,
        closeAddQuestionChoice: closeAddQuestionChoice,
        addManualQuizQuestion: addManualQuizQuestion,
        generateQuizQuestionFromSource: generateQuizQuestionFromSource,
        removeQuizQuestion: removeQuizQuestion,
        moveQuizQuestion: moveQuizQuestion,
        enhanceQuizQuestionImagePrompt: enhanceQuizQuestionImagePrompt,
        generateQuizQuestionImage: generateQuizQuestionImage,
        uploadQuizQuestionImage: uploadQuizQuestionImage,
        clearQuizQuestionImage: clearQuizQuestionImage,
        applyQuizOutputFormatFromApi: applyQuizOutputFormatFromApi,
        suggestQuizHtmlTemplateId: suggestQuizHtmlTemplateId,

        onSetActionQuiz: function(store) {
            store.quiz = initialQuiz();
            store.notebookTreeTarget = 'chat';
            initQuizWizard(store, store.actionContext);
        }
    };
})();
