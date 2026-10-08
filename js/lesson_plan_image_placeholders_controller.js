(function (global) {
    'use strict';

    function escapeAltTextForMarkdown(s) {
        // Alt text is placed inside [...]; escape closing bracket.
        return String(s || '').replace(/\]/g, '\\]');
    }

    function getDraftId() {
        // Edit view defines DRAFT_ID via Jinja.
        try {
            if (typeof DRAFT_ID !== 'undefined' && DRAFT_ID) return DRAFT_ID;
        } catch (e) {}
        // Some pages might expose it directly on window.
        if (global && global.DRAFT_ID) return global.DRAFT_ID;
        // Preview view will set LPPreviewDraftId (if we wire it).
        if (global && global.LPPreviewDraftId) return global.LPPreviewDraftId;
        // Canvas dashboard lesson plan flow.
        try {
            if (global.Alpine && typeof global.Alpine.store === 'function') {
                var canvasStore = global.Alpine.store('canvas');
                if (canvasStore && canvasStore.lessonPlan && canvasStore.lessonPlan.draftId) {
                    return canvasStore.lessonPlan.draftId;
                }
            }
        } catch (e) {}
        return null;
    }

    function getMarkdownState() {
        // Edit view: const draftContent = { main: ..., sen: ..., eal: ... }
        if (typeof draftContent !== 'undefined' && draftContent) return draftContent;
        // Preview view: window.LPPreviewMarkdown
        if (global && global.LPPreviewMarkdown) return global.LPPreviewMarkdown;
        return null;
    }

    function getSectionFromPlaceholderEl(phEl) {
        if (!phEl) return null;

        // Edit view placeholders render inside: `${section}-content-body`
        var node = phEl;
        while (node) {
            if (node.id) {
                var m = node.id.match(/^(main|sen|eal)-content-body$/);
                if (m && m[1]) return m[1];
            }
            node = node.parentElement;
        }

        // Preview view placeholders are wrapped with: data-section="main|sen|eal"
        var wrapper = phEl.closest('[data-section]');
        if (wrapper) return wrapper.getAttribute('data-section');

        // Canvas dashboard lesson-plan view container
        var canvasLp = phEl.closest('#canvas-lesson-plan-content');
        if (canvasLp) return 'main';

        return null;
    }

    function renderSection(section) {
        // Edit view has updateContentView(section)
        if (typeof global.updateContentView === 'function') {
            global.updateContentView(section);
            return;
        }

        // Preview view: rerender into wrapper
        if (global.LPPreviewMarkdown && global.LessonPlanMarkdown && section) {
            var wrapper = document.querySelector('[data-section="' + section + '"]');
            if (!wrapper) return;
            var md = global.LPPreviewMarkdown[section] || '';
            wrapper.innerHTML = global.LessonPlanMarkdown.renderLessonPlanMarkdown(md);
        }
    }

    function getPlaceholderData(phEl) {
        var i = parseInt(phEl.getAttribute('data-i') || '0', 10);
        var desc = phEl.getAttribute('data-desc') || '';
        return { i: i, desc: desc };
    }

    function findNthPlaceholderMatch(markdown, nth) {
        // Matches BOTH:
        // - ![IMAGE_REQUEST:desc]                (alt-only placeholder form)
        // - ![IMAGE_REQUEST:desc](IMAGE_REQUEST) (image placeholder form after preprocessing)
        // - IMAGE_REQUEST: desc                 (start-of-line fallback)
        //
        // We capture desc from either:
        // - alt+src:    ![IMAGE_REQUEST:desc](IMAGE_REQUEST)
        // - alt-only:  ![IMAGE_REQUEST:desc] (NOT followed by "(")
        // - line form: IMAGE_REQUEST: desc (start-of-line)
        var re = /!\[IMAGE_REQUEST:([^\]]+?)\]\(([^)]*)\)|!\[IMAGE_REQUEST:([^\]]+?)\](?!\()|^IMAGE_REQUEST:\s*(.+)$/gim;
        re.lastIndex = 0;
        var count = 0;
        var m;
        while ((m = re.exec(markdown)) !== null) {
            count++;
            if (count === nth) {
                var full = m[0];
                // Groups:
                // 1: desc in alt+src form
                // 3: desc in alt-only form
                // 4: desc in line form
                var desc = (m[1] || m[3] || m[4] || '').trim();
                return { full: full, desc: desc, start: m.index, end: m.index + full.length };
            }
            // Safety: prevent infinite loop on zero-width matches (shouldn't happen here).
            if (m.index === re.lastIndex) re.lastIndex++;
        }
        return null;
    }

    function updateDraftSection(section, newMarkdown) {
        var draftId = getDraftId();
        if (!draftId) return Promise.reject(new Error('Missing draftId'));

        return fetch('/lesson_plan/update_content/' + draftId, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ section: section, content: newMarkdown }),
            credentials: 'include'
        }).then(function (resp) {
            if (!resp.ok) return resp.json().catch(function () { return {}; }).then(function (d) { throw new Error(d.error || 'Failed to update content'); });
            return resp.json().catch(function () { return {}; });
        });
    }

    function getLessonPlanRenderer() {
        if (global && global.LessonPlanMarkdown && typeof global.LessonPlanMarkdown.renderLessonPlanMarkdown === 'function') {
            return global.LessonPlanMarkdown.renderLessonPlanMarkdown;
        }
        return null;
    }

    function reRenderSection(section, newMarkdown) {
        var renderer = getLessonPlanRenderer();
        if (!renderer) return;

        // Editor view: update `${section}-content-body`
        var bodyDiv = document.getElementById(section + '-content-body');
        if (bodyDiv) {
            bodyDiv.innerHTML = renderer(newMarkdown || '');
            return;
        }

        // Preview view: update `[data-section="..."]`
        var wrapper = document.querySelector('[data-section="' + section + '"]');
        if (wrapper) {
            wrapper.innerHTML = renderer(newMarkdown || '');
            return;
        }

        // Canvas dashboard: update Alpine store so x-html rerenders.
        try {
            if (global.Alpine && typeof global.Alpine.store === 'function') {
                var canvasStore = global.Alpine.store('canvas');
                if (canvasStore && canvasStore.lessonPlan && canvasStore.lessonPlan.content) {
                    if (section === 'main') {
                        canvasStore.lessonPlan.content.main_content = newMarkdown || '';
                    } else if (section === 'sen') {
                        canvasStore.lessonPlan.content.sen_adaptations_content = newMarkdown || '';
                    } else if (section === 'eal') {
                        canvasStore.lessonPlan.content.eal_adaptations_content = newMarkdown || '';
                    }
                    canvasStore.lessonPlanJustUpdated = true;
                    setTimeout(function () {
                        canvasStore.lessonPlanJustUpdated = false;
                    }, 600);
                }
            }
        } catch (e) {
            // no-op
        }
    }

    async function fetchDraftMarkdown(draftId) {
        var resp = await fetch('/lesson_plan/draft/' + draftId + '/content', { credentials: 'include' });
        if (!resp.ok) {
            var d = await resp.json().catch(function () { return {}; });
            throw new Error(d.error || 'Failed to load draft content');
        }
        var data = await resp.json();
        // Normalize backend response keys to the section names used on the frontend.
        return {
            main: data.main_content || '',
            sen: data.sen_adaptations_content || '',
            eal: data.eal_adaptations_content || ''
        };
    }

    function buildPlaceholderToken(desc) {
        var cleaned = String(desc || '').trim().replace(/\]/g, '');
        if (!cleaned) cleaned = 'image supporting this part of the lesson';
        return '![IMAGE_REQUEST:' + cleaned + '](IMAGE_REQUEST)';
    }

    function buildImageMarkdown(alt, url) {
        var safeAlt = escapeAltTextForMarkdown(alt || 'Generated image');
        return '![' + safeAlt + '](' + String(url || '').trim() + ')';
    }

    function appendTokenToMarkdown(md, token) {
        var t = String(md || '');
        var joiner = /\n$/.test(t) ? '\n' : '\n\n';
        return t + joiner + token + '\n';
    }

    function insertTokenAfterAnchor(md, anchorText, token) {
        var src = String(md || '');
        var anchor = String(anchorText || '').trim();
        if (!anchor) return null;
        var idx = src.indexOf(anchor);
        if (idx < 0) return null;
        var at = idx + anchor.length;
        return src.slice(0, at) + '\n\n' + token + '\n\n' + src.slice(at);
    }

    function _normalizeWhitespace(s) {
        return String(s || '').replace(/\u00a0/g, ' ').replace(/\s+/g, ' ').trim();
    }

    function _normalizedWithMap(src) {
        var text = String(src || '');
        var out = '';
        var map = [];
        var prevWs = false;
        for (var i = 0; i < text.length; i++) {
            var ch = text.charAt(i);
            var isWs = /\s/.test(ch);
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
        return { text: out, map: map };
    }

    function _locateAnchorRange(src, anchorText) {
        var source = String(src || '');
        var anchorRaw = String(anchorText || '');
        if (!anchorRaw.trim()) return null;

        // Fast path: exact match
        var direct = source.indexOf(anchorRaw);
        if (direct >= 0) {
            return { start: direct, end: direct + anchorRaw.length };
        }

        // Fallback: normalized whitespace matching (handles rendered-text vs markdown spacing/newlines)
        var normAnchor = _normalizeWhitespace(anchorRaw);
        if (!normAnchor) return null;
        var norm = _normalizedWithMap(source);
        var pos = norm.text.indexOf(normAnchor);
        if (pos < 0) {
            // Fallback: try a shorter phrase (helps when rendered text differs slightly
            // from markdown source, e.g. list markers/formatting).
            var words = normAnchor.split(' ').filter(Boolean);
            if (words.length >= 6) {
                var first = words.slice(0, Math.min(8, words.length)).join(' ');
                var last = words.slice(Math.max(0, words.length - 8)).join(' ');
                pos = norm.text.indexOf(first);
                if (pos < 0) {
                    var lastPos = norm.text.indexOf(last);
                    if (lastPos >= 0) pos = Math.max(0, lastPos - Math.max(0, first.length - 1));
                }
                if (pos < 0) return null;
                normAnchor = first;
            } else {
                return null;
            }
        }
        var startSrc = norm.map[pos];
        var endNorm = pos + normAnchor.length - 1;
        var endSrc = (endNorm >= 0 && endNorm < norm.map.length) ? (norm.map[endNorm] + 1) : startSrc + normAnchor.length;
        return { start: startSrc, end: endSrc };
    }

    function insertBlockAfterSentence(md, anchorText, blockMarkdown) {
        var src = String(md || '');
        var anchor = String(anchorText || '').trim();
        if (!anchor) return null;
        var range = _locateAnchorRange(src, anchor);
        if (!range) return null;
        var afterAnchor = range.end;
        var sentenceEnd = -1;
        for (var i = afterAnchor; i < src.length; i++) {
            var ch = src.charAt(i);
            if (ch === '.' || ch === '!' || ch === '?') {
                sentenceEnd = i + 1;
                break;
            }
            if (ch === '\n') break;
        }
        var at = sentenceEnd > 0 ? sentenceEnd : afterAnchor;
        return src.slice(0, at) + '\n\n' + blockMarkdown + '\n\n' + src.slice(at);
    }

    function getCanvasSelectedText() {
        try {
            if (global.Alpine && typeof global.Alpine.store === 'function') {
                var s = global.Alpine.store('canvas');
                if (s && s.lessonPlanSelectionMenu && s.lessonPlanSelectionMenu.text) {
                    return String(s.lessonPlanSelectionMenu.text || '').trim();
                }
            }
        } catch (e) {}
        return '';
    }

    function isHiddenByClass(el) {
        return !!(el && el.classList && el.classList.contains('hidden'));
    }

    function tryInsertAtEditorCursor(section, token) {
        var editor = document.getElementById(section + '-content-editor');
        if (!editor || isHiddenByClass(editor)) return null;
        var val = String(editor.value || '');
        var start = Number(editor.selectionStart || 0);
        var end = Number(editor.selectionEnd || start);
        var inserted = val.slice(0, start) + token + val.slice(end);
        editor.value = inserted;
        return inserted;
    }

    async function insertPlaceholder(section, desc, options) {
        var draftId = getDraftId();
        if (!draftId || !section) throw new Error('Missing draft id or section');
        var state = await fetchDraftMarkdown(draftId);
        var md = (state && state[section]) ? state[section] : '';
        var token = buildPlaceholderToken(desc);
        var opts = options || {};

        // Prefer textarea cursor insertion when manual edit is open (edit page).
        var fromEditor = tryInsertAtEditorCursor(section, token);
        var newMd = null;
        if (fromEditor != null) {
            newMd = fromEditor;
        } else if (opts.anchorText) {
            newMd = insertBlockAfterSentence(md, opts.anchorText, token) || insertTokenAfterAnchor(md, opts.anchorText, token);
        } else {
            // Canvas fallback: if selection menu exists, insert after selected text.
            var selectedAnchor = getCanvasSelectedText();
            if (selectedAnchor) newMd = insertBlockAfterSentence(md, selectedAnchor, token) || insertTokenAfterAnchor(md, selectedAnchor, token);
        }

        if (newMd == null) {
            newMd = appendTokenToMarkdown(md, token);
        }

        await updateDraftSection(section, newMd);
        reRenderSection(section, newMd);
        return newMd;
    }

    async function insertImageMarkdown(section, altText, imageUrl, options) {
        var draftId = getDraftId();
        if (!draftId || !section) throw new Error('Missing draft id or section');
        var url = String(imageUrl || '').trim();
        if (!url) throw new Error('Missing image URL');
        var state = await fetchDraftMarkdown(draftId);
        var md = (state && state[section]) ? state[section] : '';
        var block = buildImageMarkdown(altText || 'Generated image', url);
        var opts = options || {};
        var newMd = null;

        var fromEditor = tryInsertAtEditorCursor(section, block);
        if (fromEditor != null) {
            newMd = fromEditor;
        } else if (opts.anchorText) {
            newMd = insertBlockAfterSentence(md, opts.anchorText, block) || insertTokenAfterAnchor(md, opts.anchorText, block);
        } else {
            var selectedAnchor = getCanvasSelectedText();
            if (selectedAnchor) newMd = insertBlockAfterSentence(md, selectedAnchor, block) || insertTokenAfterAnchor(md, selectedAnchor, block);
        }

        if (newMd == null) newMd = appendTokenToMarkdown(md, block);
        await updateDraftSection(section, newMd);
        reRenderSection(section, newMd);
        return newMd;
    }

    function getDropAnchorText(zone, event) {
        try {
            var range = null;
            if (document.caretRangeFromPoint) {
                range = document.caretRangeFromPoint(event.clientX, event.clientY);
            } else if (document.caretPositionFromPoint) {
                var pos = document.caretPositionFromPoint(event.clientX, event.clientY);
                if (pos) {
                    range = document.createRange();
                    range.setStart(pos.offsetNode, pos.offset);
                    range.collapse(true);
                }
            }
            if (!range) return '';
            var node = range.startContainer;
            if (!zone.contains(node)) return '';
            var el = node.nodeType === 1 ? node : node.parentElement;
            if (!el) return '';
            var block = el.closest('p, li, h1, h2, h3, h4, h5, h6, td, th, blockquote, div');
            if (!block || !zone.contains(block)) return '';
            var text = String(block.textContent || '').replace(/\s+/g, ' ').trim();
            if (!text) return '';
            if (text.length <= 240) return text;
            var m = text.match(/[^.!?]+[.!?]?/g);
            if (m && m.length) {
                var sentence = m[0].trim();
                if (sentence) return sentence;
            }
            return text.slice(0, 200).trim();
        } catch (e) {
            return '';
        }
    }

    function getDropAnchorTextFromTarget(target, zone) {
        try {
            var t = target;
            if (t && t.nodeType === 3 && t.parentElement) t = t.parentElement;
            if (!t || !zone || !zone.contains(t)) return '';
            var block = t.closest('p, li, h1, h2, h3, h4, h5, h6, td, th, blockquote');
            if (!block || !zone.contains(block)) return '';
            var text = String(block.textContent || '').replace(/\s+/g, ' ').trim();
            if (!text) return '';
            if (text.length <= 240) return text;
            return text.slice(0, 240).trim();
        } catch (e) {
            return '';
        }
    }

    var lastDropAnchorBySection = {};

    async function handleRemovePlaceholder(phEl) {
        var section = getSectionFromPlaceholderEl(phEl);
        var data = getPlaceholderData(phEl);
        var draftId = getDraftId();
        if (!section || !draftId) return;
        var state = await fetchDraftMarkdown(draftId);
        var md = (state && state[section]) ? state[section] : '';
        var match = findNthPlaceholderMatch(md, data.i);
        if (!match) {
            alert('Could not find the placeholder in the saved markdown (Remove).');
            return;
        }

        var newMd = md.slice(0, match.start) + md.slice(match.end);
        await updateDraftSection(section, newMd);
        reRenderSection(section, newMd);
    }

    async function handleUploadPlaceholder(phEl, file) {
        var section = getSectionFromPlaceholderEl(phEl);
        var draftId = getDraftId();
        if (!section || !draftId) return;

        var data = getPlaceholderData(phEl);
        var state = await fetchDraftMarkdown(draftId);
        var md = (state && state[section]) ? state[section] : '';
        var match = findNthPlaceholderMatch(md, data.i);
        if (!match) {
            alert('Could not find the placeholder in the saved markdown (Upload).');
            return;
        }

        var formData = new FormData();
        formData.append('image', file);
        formData.append('draft_id', draftId);

        var uploadResp = await fetch('/lesson_plan/upload_image', {
            method: 'POST',
            body: formData,
            credentials: 'include'
        });
        var uploadData = await uploadResp.json().catch(function () { return {}; });
        if (!uploadResp.ok || !uploadData.success || !uploadData.image_url) {
            alert(uploadData.error || 'Image upload failed');
            return;
        }

        var altText = escapeAltTextForMarkdown(match.desc || data.desc);
        var replacement = '![' + altText + '](' + uploadData.image_url + ')';
        var newMd = md.slice(0, match.start) + replacement + md.slice(match.end);

        await updateDraftSection(section, newMd);
        reRenderSection(section, newMd);
    }

    async function pollImageCreatorTask(taskId) {
        function sleep(ms) {
            return new Promise(function (resolve) { setTimeout(resolve, ms); });
        }
        while (true) {
            var resp = await fetch('/image-creator/result/' + taskId, { credentials: 'include' }).catch(function () { return null; });
            if (!resp) {
                await sleep(1500);
                continue;
            }
            var data = await resp.json().catch(function () { return {}; });
            if (data && (data.status === 'SUCCESS' || data.status === 'success') && data.image_url) return data.image_url;
            // tools.py returns: {"status":"error","error":"..."} on FAILURE
            if (data && (data.status === 'FAILURE' || data.status === 'error' || data.status === 'ERROR')) {
                throw new Error(data.error || 'Image generation failed');
            }
            await sleep(1500);
        }
    }

    async function handleGeneratePlaceholder(phEl) {
        var section = getSectionFromPlaceholderEl(phEl);
        var draftId = getDraftId();
        if (!section || !draftId) return;

        var data = getPlaceholderData(phEl);
        var state = await fetchDraftMarkdown(draftId);
        var md = (state && state[section]) ? state[section] : '';
        var match = findNthPlaceholderMatch(md, data.i);
        if (!match) {
            alert('Could not find the placeholder in the saved markdown (Generate AI).');
            return;
        }

        if (phEl.getAttribute('data-processing') === '1') return;
        phEl.setAttribute('data-processing', '1');
        phEl.style.opacity = '0.75';
        var genBtn = phEl.querySelector('.lp-image-ph-generate[data-action="generate"]');
        if (genBtn) {
            genBtn.disabled = true;
            genBtn.dataset.prevText = genBtn.textContent;
            genBtn.textContent = 'Generating...';
        }

        // Basic image generation (less optimal) using existing image_creator pipeline.
        // We avoid injecting the teacher/pupil name into the prompt; the placeholder description is the only input.
        var prompt = 'Illustration for lesson plan: ' + match.desc;
        var style = 'Photorealistic';
        var size = '512';
        var model = 'runware:400@2';

        var formData = new FormData();
        formData.append('prompt', prompt);
        formData.append('style', style);
        formData.append('size', size);
        formData.append('model', model);

        var submitResp = await fetch('/image_creator', {
            method: 'POST',
            body: formData,
            credentials: 'include'
        }).catch(function () { return null; });

        if (!submitResp || !submitResp.ok) {
            phEl.setAttribute('data-processing', '0');
            phEl.style.opacity = '';
            if (genBtn) {
                genBtn.disabled = false;
                if (genBtn.dataset && genBtn.dataset.prevText) genBtn.textContent = genBtn.dataset.prevText;
            }
            alert('AI image generation request failed');
            return;
        }

        var submitData = await submitResp.json().catch(function () { return {}; });
        if (!submitData || !submitData.task_id) {
            phEl.setAttribute('data-processing', '0');
            phEl.style.opacity = '';
            if (genBtn) {
                genBtn.disabled = false;
                if (genBtn.dataset && genBtn.dataset.prevText) genBtn.textContent = genBtn.dataset.prevText;
            }
            alert('AI image generation did not return a task id');
            return;
        }

        var imageUrl;
        try {
            imageUrl = await pollImageCreatorTask(submitData.task_id);
        } catch (e) {
            phEl.setAttribute('data-processing', '0');
            phEl.style.opacity = '';
            if (genBtn) {
                genBtn.disabled = false;
                if (genBtn.dataset && genBtn.dataset.prevText) genBtn.textContent = genBtn.dataset.prevText;
            }
            alert(String(e && e.message ? e.message : e));
            return;
        }

        var altText = escapeAltTextForMarkdown(match.desc || data.desc);
        var replacement = '![' + altText + '](' + imageUrl + ')';
        var newMd = md.slice(0, match.start) + replacement + md.slice(match.end);

        await updateDraftSection(section, newMd);
        phEl.setAttribute('data-processing', '0');
        phEl.style.opacity = '';
        if (genBtn) {
            genBtn.disabled = false;
            if (genBtn.dataset && genBtn.dataset.prevText) genBtn.textContent = genBtn.dataset.prevText;
        }
        reRenderSection(section, newMd);
    }

    // ---- Event wiring ----

    document.addEventListener('click', function (e) {
        var target = e.target;
        // Normalize text-node clicks to their parent element.
        if (target && target.nodeType === 3 && target.parentElement) {
            target = target.parentElement;
        }
        if (!target || !target.closest) return;

        var removeBtn = target.closest('.lp-image-ph-remove[data-action="remove"]');
        if (removeBtn) {
            var phEl = removeBtn.closest('.lesson-plan-image-request');
            handleRemovePlaceholder(phEl).catch(function (err) {
                alert((err && err.message) ? err.message : 'Remove failed');
            });
            return;
        }

        var genBtn = target.closest('.lp-image-ph-generate[data-action="generate"]');
        if (genBtn) {
            var phEl2 = genBtn.closest('.lesson-plan-image-request');
            handleGeneratePlaceholder(phEl2).catch(function (err) {
                alert((err && err.message) ? err.message : 'Generate failed');
            });
            return;
        }
    });

    document.addEventListener('change', function (e) {
        var t = e.target;
        if (!t || !t.matches) return;
        if (t.matches('.lp-image-ph-file')) {
            var phEl = t.closest('.lesson-plan-image-request');
            var file = (t.files && t.files[0]) ? t.files[0] : null;
            if (!file) return;
            handleUploadPlaceholder(phEl, file).catch(function (err) {
                alert((err && err.message) ? err.message : 'Upload failed');
            });
            // Reset input so selecting the same file again triggers change.
            try { t.value = ''; } catch (err) {}
        }
    });

    function parseImageMarkdownToken(md) {
        var raw = String(md || '').trim();
        // Greedy URL group so query strings / nested parentheses still parse.
        var m = raw.match(/^!\[([\s\S]*?)\]\((.+)\)$/);
        if (!m || !m[2]) return null;
        return { alt: m[1] || 'image', url: String(m[2] || '').trim() };
    }

    function looksLikeImageUrl(url) {
        var u = String(url || '').trim();
        if (!u || !/^https?:\/\//i.test(u)) return false;
        if (/\.(png|jpe?g|gif|webp|svg)(\?|#|$)/i.test(u)) return true;
        // Generated/uploaded lesson images often lack a file extension in the path.
        if (/\/image|\/media|\/upload|blob\.|supabase|runware|oaidalle/i.test(u)) return true;
        return false;
    }

    function firstUriFromList(uriList) {
        var lines = String(uriList || '').split(/\r?\n/);
        for (var i = 0; i < lines.length; i++) {
            var line = String(lines[i] || '').trim();
            if (line && line.charAt(0) !== '#') return line;
        }
        return '';
    }

    document.addEventListener('dragstart', function (e) {
        var t = e.target;
        if (t && t.nodeType === 3 && t.parentElement) t = t.parentElement;
        if (!t || !t.closest || !e.dataTransfer) return;

        var imageEl = t.closest('[data-lp-workspace-image], [data-lp-image-url], [data-lp-image-markdown]');
        if (imageEl) {
            var url = imageEl.getAttribute('data-lp-image-url') || imageEl.dataset.lpImageUrl || '';
            var alt = imageEl.getAttribute('data-lp-image-alt') || imageEl.dataset.lpImageAlt || 'Lesson image';
            var imageMd = imageEl.getAttribute('data-lp-image-markdown') || imageEl.dataset.lpImageMarkdown || '';
            if (!url && imageEl.tagName === 'IMG') {
                url = imageEl.getAttribute('src') || imageEl.src || '';
                if (!alt || alt === 'Lesson image') alt = imageEl.getAttribute('alt') || alt;
            }
            if (!imageMd && url) imageMd = buildImageMarkdown(alt, url);
            if (imageMd || url) {
                if (!imageMd && url) imageMd = buildImageMarkdown(alt, url);
                e.dataTransfer.setData('application/x-lp-image-markdown', imageMd);
                if (url) e.dataTransfer.setData('application/x-lp-image-url', url);
                e.dataTransfer.setData('application/x-lp-image-alt', alt || 'Lesson image');
                // Prefer markdown in text/plain so a failed custom-type read still inserts an image.
                e.dataTransfer.setData('text/plain', imageMd || url);
                e.dataTransfer.effectAllowed = 'copy';
                return;
            }
        }

        var dragEl = t.closest('[data-lp-placeholder-draggable]');
        if (!dragEl) return;
        var desc = dragEl.getAttribute('data-desc') || dragEl.dataset.desc || 'image suggestion';
        e.dataTransfer.setData('text/plain', desc);
        e.dataTransfer.setData('application/x-lp-placeholder-desc', desc);
        e.dataTransfer.effectAllowed = 'copy';
    });

    document.addEventListener('dragover', function (e) {
        var t = e.target;
        if (t && t.nodeType === 3 && t.parentElement) t = t.parentElement;
        if (!t || !t.closest) return;
        var zone = t.closest('[data-lp-drop-section], #canvas-lesson-plan-content');
        if (!zone) return;
        e.preventDefault();
        if (e.dataTransfer) e.dataTransfer.dropEffect = 'copy';
        var section = zone.getAttribute('data-lp-drop-section') || (zone.id === 'canvas-lesson-plan-content' ? 'main' : 'main');
        var hoverAnchor = getDropAnchorTextFromTarget(t, zone);
        if (hoverAnchor) lastDropAnchorBySection[section] = hoverAnchor;
    });

    document.addEventListener('drop', function (e) {
        var t = e.target;
        if (t && t.nodeType === 3 && t.parentElement) t = t.parentElement;
        if (!t || !t.closest) return;
        var zone = t.closest('[data-lp-drop-section], #canvas-lesson-plan-content');
        if (!zone) return;
        e.preventDefault();
        var section = zone.getAttribute('data-lp-drop-section') || (zone.id === 'canvas-lesson-plan-content' ? 'main' : null);
        if (!section) section = 'main';
        var anchorText = getDropAnchorText(zone, e) || lastDropAnchorBySection[section] || '';
        var imageMarkdown = '';
        var imageUrl = '';
        var imageAlt = '';
        var desc = '';
        var plain = '';
        var uriList = '';
        if (e.dataTransfer) {
            imageMarkdown = e.dataTransfer.getData('application/x-lp-image-markdown') || '';
            imageUrl = e.dataTransfer.getData('application/x-lp-image-url') || '';
            imageAlt = e.dataTransfer.getData('application/x-lp-image-alt') || '';
            desc = e.dataTransfer.getData('application/x-lp-placeholder-desc') || '';
            plain = e.dataTransfer.getData('text/plain') || '';
            uriList = e.dataTransfer.getData('text/uri-list') || '';
        }

        var parsed = parseImageMarkdownToken(imageMarkdown) || parseImageMarkdownToken(plain);
        if (parsed && parsed.url) {
            insertImageMarkdown(section, parsed.alt || 'image', parsed.url, { anchorText: anchorText }).catch(function (err) {
                alert((err && err.message) ? err.message : 'Drop image insert failed');
            });
            return;
        }
        if (imageUrl) {
            insertImageMarkdown(section, imageAlt || 'image', imageUrl, { anchorText: anchorText }).catch(function (err) {
                alert((err && err.message) ? err.message : 'Drop image insert failed');
            });
            return;
        }
        var maybeUrl = firstUriFromList(uriList) || (looksLikeImageUrl(plain) ? plain.trim() : '');
        if (maybeUrl && looksLikeImageUrl(maybeUrl)) {
            insertImageMarkdown(section, imageAlt || 'image', maybeUrl, { anchorText: anchorText }).catch(function (err) {
                alert((err && err.message) ? err.message : 'Drop image insert failed');
            });
            return;
        }

        // Placeholder drag only — never treat a failed image drop as an "image suggestion".
        if (!desc && !plain) return;
        if (!desc && parseImageMarkdownToken(plain)) return;
        insertPlaceholder(section, desc || plain || 'image suggestion', { anchorText: anchorText }).catch(function (err) {
            alert((err && err.message) ? err.message : 'Drop insert failed');
        });
    });

    global.LessonPlanPlaceholderWorkspace = {
        insertPlaceholder: function (section, desc, options) {
            return insertPlaceholder(section, desc, options || {});
        },
        insertInferredSection: function (desc, options) {
            var section = 'main';
            var activeBody = document.querySelector('.tab-panel:not(.hidden) [id$="-content-body"]');
            if (activeBody && activeBody.id) {
                var m = activeBody.id.match(/^(main|sen|eal)-content-body$/);
                if (m && m[1]) section = m[1];
            }
            return insertPlaceholder(section, desc, options || {});
        },
        insertImage: function (section, altText, imageUrl, options) {
            return insertImageMarkdown(section, altText, imageUrl, options || {});
        },
        buildImageMarkdown: function (altText, imageUrl) {
            return buildImageMarkdown(altText, imageUrl);
        }
    };
})(typeof window !== 'undefined' ? window : this);

