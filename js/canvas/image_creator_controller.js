(function() {
    'use strict';

    var GALLERY_LIMIT = 12;

    function readCanvasAppConfig() {
        var el = document.getElementById('canvas-app-config');
        if (!el || !el.textContent) return {};
        try {
            return JSON.parse(el.textContent);
        } catch (e) {
            return {};
        }
    }

    var cfg = readCanvasAppConfig();
    var submitUrl = cfg.imageCreatorSubmitUrl || '/image_creator';
    var enhancePromptUrl = cfg.imageCreatorEnhancePromptUrl || '/image_creator/enhance_prompt';
    var resultBaseUrl = '/image-creator/result/';

    function getStore() {
        return (typeof Alpine !== 'undefined' && Alpine.store) ? Alpine.store('canvas') : null;
    }

    function resetImageCreatorState(store, context) {
        // Keep defaults aligned with the existing shell implementation.
        store.imageCreatorPrompt = '';
        store.imageCreatorStyle = (context && context.imageCreatorStyle) || 'Photorealistic';
        store.imageCreatorSize = (context && context.imageCreatorSize) || '512';
        store.imageCreatorModel = (context && context.imageCreatorModel) || 'runware:400@2';
        store.imageCreatorLoading = false;
        store.imageCreatorEnhancing = false;
        store.imageCreatorResult = null;
        store.imageCreatorTaskId = null;
        // The gallery is per browser session, so it survives leaving and reopening the tool.
        if (!Array.isArray(store.imageCreatorGallery)) store.imageCreatorGallery = [];
    }

    function addToGallery(store, item) {
        if (!Array.isArray(store.imageCreatorGallery)) store.imageCreatorGallery = [];
        var list = store.imageCreatorGallery.filter(function(g) { return g.image_url !== item.image_url; });
        list.unshift(item);
        store.imageCreatorGallery = list.slice(0, GALLERY_LIMIT);
    }

    function fileExtensionFor(url, blob) {
        var type = (blob && blob.type) || '';
        if (type.indexOf('png') !== -1) return 'png';
        if (type.indexOf('webp') !== -1) return 'webp';
        if (type.indexOf('jpeg') !== -1 || type.indexOf('jpg') !== -1) return 'jpg';
        var m = /\.(png|jpe?g|webp)(?:\?|#|$)/i.exec(url || '');
        return m ? m[1].toLowerCase().replace('jpeg', 'jpg') : 'png';
    }

    // `id` is sent to the server and must match a key in IMAGE_CREATOR_STYLE_PRESETS (services/image_service.py), lowercased.
    var STYLES = [
        { id: 'Photorealistic', swatch: 'photorealistic', label: 'Photo', hint: 'True to life' },
        { id: 'Cartoon', swatch: 'cartoon', label: 'Cartoon', hint: 'Bold and playful' },
        { id: 'Storybook', swatch: 'storybook', label: 'Storybook', hint: 'Picture-book warmth' },
        { id: 'Watercolor', swatch: 'watercolor', label: 'Watercolour', hint: 'Soft painted' },
        { id: '3D Render', swatch: 'render', label: '3D render', hint: 'Smooth and shiny' },
        { id: 'Colouring Page', swatch: 'colouring', label: 'Colouring', hint: 'Line art to colour' },
        { id: 'Diagram', swatch: 'diagram', label: 'Diagram', hint: 'Clear and labelled' },
        { id: 'Pencil Sketch', swatch: 'sketch', label: 'Sketch', hint: 'Hand-drawn pencil' },
        { id: 'Oil Painting', swatch: 'oil', label: 'Oil paint', hint: 'Classic brushwork' },
        { id: 'Comic Book', swatch: 'comic', label: 'Comic', hint: 'Inked and punchy' },
        { id: 'Anime', swatch: 'anime', label: 'Anime', hint: 'Vivid lines' },
        { id: 'Pixel Art', swatch: 'pixel', label: 'Pixel art', hint: 'Retro game' },
        { id: 'Claymation', swatch: 'clay', label: 'Claymation', hint: 'Handmade clay' },
        { id: 'Abstract', swatch: 'abstract', label: 'Abstract', hint: 'Shapes and colour' }
    ];

    var IDEAS = [
        'A friendly volcano erupting, labelled cross-section for a science lesson',
        'Ancient Roman market street at sunrise, busy with traders',
        'The water cycle over mountains and a lake, simple and clear',
        'A cosy classroom reading corner with beanbags and fairy lights',
        'Planets of the solar system lined up to scale against deep space',
        'A Victorian street scene in winter with gas lamps and snow'
    ];

    function imageCreatorPanelFactory() {
        return {
            styles: STYLES,
            ideas: IDEAS,
            copied: false,
            notice: '',
            stylesAtStart: true,
            stylesAtEnd: false,

            init() {
                this.$nextTick(() => {
                    this.revealSelectedStyle('auto');
                    this.updateStyleEdges();
                });
                this.$watch('$store.canvas.imageCreatorStyle', () => this.$nextTick(() => this.revealSelectedStyle('smooth')));
            },

            updateStyleEdges() {
                var el = this.$refs.styleTrack;
                if (!el) return;
                this.stylesAtStart = el.scrollLeft <= 2;
                this.stylesAtEnd = el.scrollLeft + el.clientWidth >= el.scrollWidth - 2;
            },

            scrollStyles(direction) {
                var el = this.$refs.styleTrack;
                if (!el) return;
                el.scrollBy({ left: direction * el.clientWidth * 0.8, behavior: 'smooth' });
            },

            revealSelectedStyle(behavior) {
                var el = this.$refs.styleTrack;
                var tile = el && el.querySelector('.ic-style.is-selected');
                if (!tile) return;
                var left = tile.offsetLeft;
                var right = left + tile.offsetWidth;
                if (left < el.scrollLeft || right > el.scrollLeft + el.clientWidth) {
                    el.scrollTo({ left: left - (el.clientWidth - tile.offsetWidth) / 2, behavior: behavior || 'smooth' });
                }
            },

            useIdea(text) {
                var s = getStore();
                if (!s || s.imageCreatorLoading) return;
                s.imageCreatorPrompt = text;
                this.$nextTick(() => {
                    var ta = this.$refs.prompt;
                    if (ta) ta.focus();
                });
            },

            enhanceImageCreatorPrompt() {
                const s = getStore();
                const prompt = (s.imageCreatorPrompt || '').trim();
                if (!prompt) return;
                this.notice = '';
                s.imageCreatorEnhancing = true;
                fetch(enhancePromptUrl, {
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
                    .then((res) => {
                        s.imageCreatorEnhancing = false;
                        if (res.ok && res.data && res.data.enhanced_prompt) {
                            s.imageCreatorPrompt = res.data.enhanced_prompt;
                        } else {
                            this.notice = (res.data && res.data.error) || 'Could not enhance prompt.';
                        }
                    })
                    .catch(() => {
                        s.imageCreatorEnhancing = false;
                        this.notice = 'Network error while enhancing prompt.';
                    });
            },

            generateImageCreator() {
                const s = getStore();
                const prompt = (s.imageCreatorPrompt || '').trim();
                if (!prompt || s.imageCreatorLoading || s.imageCreatorEnhancing) return;
                this.notice = '';
                s.imageCreatorUsedPrompt = prompt;
                s.imageCreatorResult = null;
                s.imageCreatorLoading = true;
                const formData = new FormData();
                formData.append('prompt', prompt);
                formData.append('style', s.imageCreatorStyle || 'Photorealistic');
                formData.append('size', s.imageCreatorSize || '512');
                formData.append('model', s.imageCreatorModel || 'runware:400@2');
                fetch(submitUrl, { method: 'POST', body: formData, credentials: 'include' })
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
                const s = getStore();
                fetch(resultBaseUrl + taskId, { credentials: 'include' })
                    .then(r => r.json())
                    .then(data => {
                        if (data.status === 'PENDING') {
                            setTimeout(() => this.pollImageCreatorResult(taskId), 1500);
                            return;
                        }
                        s.imageCreatorLoading = false;
                        if (data.status === 'SUCCESS' && data.image_url) {
                            s.imageCreatorResult = { image_url: data.image_url, prompt: s.imageCreatorUsedPrompt || '' };
                            addToGallery(s, {
                                image_url: data.image_url,
                                prompt: s.imageCreatorUsedPrompt || '',
                                style: s.imageCreatorStyle || 'Photorealistic',
                                size: s.imageCreatorSize || '512'
                            });
                        }
                        else s.imageCreatorResult = { error: data.error || 'Image generation failed' };
                    })
                    .catch(() => {
                        s.imageCreatorLoading = false;
                        s.imageCreatorResult = { error: 'An error occurred while checking the result' };
                    });
            },

            regenerate() {
                const s = getStore();
                const last = (s.imageCreatorResult && s.imageCreatorResult.prompt) || s.imageCreatorUsedPrompt || '';
                if (last && !(s.imageCreatorPrompt || '').trim()) s.imageCreatorPrompt = last;
                this.generateImageCreator();
            },

            showFromGallery(item) {
                const s = getStore();
                if (!item || s.imageCreatorLoading) return;
                s.imageCreatorResult = { image_url: item.image_url, prompt: item.prompt || '' };
                s.imageCreatorUsedPrompt = item.prompt || '';
                if (item.prompt) s.imageCreatorPrompt = item.prompt;
                if (item.style) s.imageCreatorStyle = item.style;
                if (item.size) s.imageCreatorSize = item.size;
            },

            isShowing(item) {
                const s = getStore();
                return !!(item && s.imageCreatorResult && s.imageCreatorResult.image_url === item.image_url);
            },

            copyPrompt() {
                const s = getStore();
                const text = (s.imageCreatorResult && s.imageCreatorResult.prompt) || s.imageCreatorUsedPrompt || '';
                if (!text || !navigator.clipboard) return;
                navigator.clipboard.writeText(text).then(() => {
                    this.copied = true;
                    setTimeout(() => { this.copied = false; }, 1600);
                }).catch(() => {});
            },

            downloadImage(url) {
                if (!url) return;
                fetch(url, { mode: 'cors' })
                    .then(function(r) {
                        if (!r.ok) throw new Error(String(r.status));
                        return r.blob();
                    })
                    .then(function(blob) {
                        var href = URL.createObjectURL(blob);
                        var a = document.createElement('a');
                        a.href = href;
                        a.download = 'atomas-image-' + Date.now() + '.' + fileExtensionFor(url, blob);
                        document.body.appendChild(a);
                        a.click();
                        a.remove();
                        setTimeout(function() { URL.revokeObjectURL(href); }, 1000);
                    })
                    .catch(function() {
                        window.open(url, '_blank', 'noopener');
                    });
            }
        };
    }

    if (typeof window.canvasRegisterDeferredAlpineData === 'function') {
        window.canvasRegisterDeferredAlpineData('imageCreatorPanel', imageCreatorPanelFactory);
    } else if (typeof Alpine !== 'undefined' && typeof Alpine.data === 'function') {
        Alpine.data('imageCreatorPanel', imageCreatorPanelFactory);
    } else {
        document.addEventListener('alpine:init', function() {
            Alpine.data('imageCreatorPanel', imageCreatorPanelFactory);
        });
    }

    window.CanvasFeatures = window.CanvasFeatures || {};
    window.CanvasFeatures.image_creator = {
        onSetActionImageCreator: function(store, context) {
            if (!store) return;
            resetImageCreatorState(store, context || {});
        }
    };
})();
