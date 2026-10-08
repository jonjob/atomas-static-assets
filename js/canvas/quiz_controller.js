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

    window.CanvasFeatures = window.CanvasFeatures || {};
    window.CanvasFeatures.quiz = {
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
