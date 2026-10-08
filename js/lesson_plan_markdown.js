/**
 * Lesson plan markdown: headings/tables-friendly preprocess, IMAGE_REQUEST placeholders, marked output.
 * Depends on global `marked` (loaded before this script).
 */
(function (global) {
    'use strict';

    function escapeHtml(s) {
        return String(s)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;');
    }

    /** Models often emit **Starter** on its own line instead of ## Starter */
    function promoteBoldOnlyLinesToHeadings(md) {
        if (!md || typeof md !== 'string') return md || '';
        return md.replace(/^\*\*([^*\n]+)\*\*\s*$/gm, function (_, t) {
            return '## ' + String(t).trim();
        });
    }

    function isTableRow(line) {
        var s = String(line || '').trim();
        return s.length >= 2 && s.charAt(0) === '|' && s.charAt(s.length - 1) === '|' && (s.match(/\|/g) || []).length >= 2;
    }

    function isSeparatorRow(line) {
        var s = String(line || '').trim();
        if (s.indexOf('|') < 0 || s.indexOf('-') < 0) return false;
        return String(s.replace(/[\s|\-:]/g, '')) === '';
    }

    function tableColumnCount(line) {
        var s = String(line || '').trim();
        if (s.length < 2 || s.charAt(0) !== '|' || s.charAt(s.length - 1) !== '|') return 0;
        var inner = s.slice(1, -1);
        return Math.max(0, inner.split('|').length);
    }

    function ensureGfmTableSeparators(md) {
        if (!md || typeof md !== 'string') return md || '';
        var lines = md.split('\n');
        var out = [];
        for (var i = 0; i < lines.length; i++) {
            out.push(lines[i]);
            var nxt = lines[i + 1];
            if (
                nxt !== undefined &&
                isTableRow(lines[i]) &&
                isTableRow(nxt) &&
                !isSeparatorRow(nxt)
            ) {
                var n = tableColumnCount(lines[i]);
                if (n >= 2) {
                    out.push('| ' + new Array(n).fill('---').join(' | ') + ' |');
                }
            }
        }
        return out.join('\n');
    }

    function escapeAttr(s) {
        // Use HTML escaping for quotes too, plus apostrophe escaping for safety in attributes.
        return escapeHtml(String(s || '')).replace(/'/g, '&#39;');
    }

    function placeholderHtml(desc, i) {
        var raw = String(desc || '').trim();
        var d = escapeHtml(raw);
        var da = escapeAttr(raw);
        var idx = Number(i) || 0;
        return (
            '\n\n<span class="lesson-plan-image-request" ' +
            'data-desc="' + da + '" data-i="' + idx + '">' +
            '<span class="lesson-plan-image-request-label">Image suggestion</span>' +
            '<span class="lesson-plan-image-request-desc">' + d + '</span>' +
            '<span class="mt-3 flex flex-wrap gap-2">' +
            '<button type="button" ' +
            'class="lp-image-ph-remove bg-red-500 hover:bg-red-600 text-white text-xs font-semibold px-2 py-1 rounded transition" ' +
            'data-action="remove" ' +
            'data-i="' + idx + '">' +
            'Remove' +
            '</button>' +
            '<label class="lp-image-ph-upload bg-blue-500 hover:bg-blue-600 text-white text-xs font-semibold px-2 py-1 rounded transition cursor-pointer flex items-center gap-2">' +
            'Upload your own image' +
            '<input type="file" ' +
            'class="lp-image-ph-file hidden" accept="image/*" ' +
            '/>' +
            '</label>' +
            '<button type="button" ' +
            'class="lp-image-ph-generate bg-purple-500 hover:bg-purple-600 text-white text-xs font-semibold px-2 py-1 rounded transition" ' +
            'data-action="generate" ' +
            'data-i="' + idx + '">' +
            'Generate AI image' +
            '</button>' +
            '</span>' +
            '</span>\n\n'
        );
    }

    function preprocessImageRequestPlaceholders(md) {
        if (!md || typeof md !== 'string') return md || '';
        // Convert placeholders into real Markdown images so the Markdown renderer places them
        // exactly where images would appear. Later, `postprocessBrokenImageTags` replaces those
        // IMAGE_REQUEST images with the interactive widget (preserving layout).
        var re = /!\[IMAGE_REQUEST:([^\]]+)\]|^IMAGE_REQUEST:\s*(.+)$/gim;
        return md.replace(re, function (_, desc1, desc2) {
            var desc = (desc1 || desc2 || '').trim();
            // Convert to a markdown image that *will render* as <img>.
            // Important: keep the URL/src part free of spaces, otherwise some parsers
            // will treat the whole `![...](...)` as literal text.
            // We keep the description in the ALT text so our post-processor can recover it.
            return '![' + 'IMAGE_REQUEST:' + desc + '](IMAGE_REQUEST)';
        });
    }

    function postprocessBrokenImageTags(html) {
        if (!html || typeof html !== 'string') return html;
        // Some markdown parsers may still turn `![IMAGE_REQUEST:...]` into <img> tags.
        // When that happens, convert them back into interactive placeholders.
        var imgIdx = 0;
        return html.replace(/<img\b[^>]*>/gi, function (full) {
            if (!/IMAGE_REQUEST/i.test(full)) return full;
            var altM = full.match(/\balt=["']([^"']*)["']/i);
            var srcM = full.match(/\bsrc=["']([^"']*)["']/i);
            var desc = '';
            if (altM && /IMAGE_REQUEST/i.test(altM[1])) {
                desc = altM[1].replace(/^IMAGE_REQUEST:\s*/i, '').trim();
            } else if (srcM && /IMAGE_REQUEST/i.test(srcM[1])) {
                desc = srcM[1].replace(/^IMAGE_REQUEST:\s*/i, '').trim();
            }
            imgIdx++;
            return placeholderHtml(desc, imgIdx);
        });
    }

    /** Wrap each <table> so overflow scrolls and borders align */
    function wrapTables(html) {
        if (!html || typeof html !== 'string') return html;
        return html
            .replace(/<table(\b[^>]*)>/gi, '<div class="lesson-plan-table-wrap"><table$1>')
            .replace(/<\/table>/gi, '</table></div>');
    }

    function renderLessonPlanMarkdown(md) {
        if (typeof marked === 'undefined') {
            return String(md || '')
                .replace(/</g, '&lt;')
                .replace(/>/g, '&gt;')
                .replace(/\n/g, '<br>');
        }
        var pre = promoteBoldOnlyLinesToHeadings(md || '');
        pre = ensureGfmTableSeparators(pre);
        pre = preprocessImageRequestPlaceholders(pre);
        var html = marked.parse(pre);
        html = postprocessBrokenImageTags(html);
        html = wrapTables(html);
        return html;
    }

    global.LessonPlanMarkdown = {
        renderLessonPlanMarkdown: renderLessonPlanMarkdown,
        promoteBoldOnlyLinesToHeadings: promoteBoldOnlyLinesToHeadings,
        ensureGfmTableSeparators: ensureGfmTableSeparators,
        preprocessImageRequestPlaceholders: preprocessImageRequestPlaceholders,
        postprocessBrokenImageTags: postprocessBrokenImageTags,
        wrapTables: wrapTables,
        escapeHtml: escapeHtml,
    };
})(typeof window !== 'undefined' ? window : this);
