(function() {
    'use strict';

    function myLessonsPanelFactory() {
        return {
            items: [],
            filter: 'all',
            subjectFilter: '',
            yearFilter: '',
            deletingId: '',
            loading: true,
            error: '',
            init: function() {
                this.load();
            },
            load: function() {
                var self = this;
                self.loading = true;
                self.error = '';
                fetch('/api/canvas/my_lessons', { credentials: 'include' })
                    .then(function(r) { return r.ok ? r.json() : Promise.reject(new Error('Could not load lessons')); })
                    .then(function(data) {
                        self.items = (data && data.items) || [];
                        self.loading = false;
                    })
                    .catch(function() {
                        self.loading = false;
                        self.error = 'Could not load your lessons.';
                    });
            },
            storeLists: function() {
                if (typeof Alpine === 'undefined' || typeof Alpine.store !== 'function') return null;
                return Alpine.store('canvas');
            },
            subjectChoices: function() {
                var store = this.storeLists();
                return (store && store.canvasSubjectsList) || [];
            },
            yearGroups: function() {
                var store = this.storeLists();
                var rows = (store && store.canvasNcYearsList) || [];
                var buckets = {};
                var order = [];
                rows.forEach(function(row) {
                    var year = (row && (row.ncYear || row.nc_year)) || '';
                    if (!year) return;
                    var keystage = (row && row.keystage) && String(row.keystage).trim() ? String(row.keystage).trim() : 'Years';
                    if (!buckets[keystage]) { buckets[keystage] = []; order.push(keystage); }
                    if (buckets[keystage].indexOf(year) < 0) buckets[keystage].push(year);
                });
                if (order.length) return order.map(function(keystage) { return { keystage: keystage, years: buckets[keystage] }; });
                var flat = (store && store.canvasYearsList) || [];
                if (flat.length) return [{ keystage: 'Years', years: flat.slice() }];
                return [];
            },
            visibleItems: function() {
                var filter = this.filter || 'all';
                var subject = String(this.subjectFilter || '').trim().toLowerCase();
                var year = String(this.yearFilter || '').trim().toLowerCase();
                return (this.items || []).filter(function(item) {
                    if (filter !== 'all' && item.kind !== filter) return false;
                    if (subject && String(item.subject || '').trim().toLowerCase() !== subject) return false;
                    if (year && String(item.curriculum_year || '').trim().toLowerCase() !== year) return false;
                    return true;
                });
            },
            metaLabel: function(item) {
                var bits = [item && item.label ? item.label : 'Lesson'];
                if (item && item.subject) bits.push(item.subject);
                if (item && item.curriculum_year) bits.push(item.curriculum_year);
                var when = this.whenLabel(item);
                if (when) bits.push(when);
                return bits.join(' · ');
            },
            openItem: function(item) {
                if (!item) return;
                var store = Alpine.store('canvas');
                if (store && typeof store.openSavedWork === 'function') store.openSavedWork(item.kind, item.id);
            },
            removeItem: function(item) {
                if (!item || !item.kind || !item.id || this.deletingId) return;
                var name = item.title || 'this lesson';
                if (!window.confirm('Delete “' + name + '”? This removes the saved lesson.')) return;
                var self = this;
                var key = item.kind + ':' + item.id;
                self.deletingId = key;
                self.error = '';
                fetch('/api/canvas/my_lessons/' + encodeURIComponent(item.kind) + '/' + encodeURIComponent(item.id), {
                    method: 'DELETE',
                    credentials: 'include'
                }).then(function(r) {
                    return r.json().catch(function() { return {}; }).then(function(data) {
                        if (!r.ok) throw new Error((data && data.error) || 'Could not delete that lesson.');
                        self.items = (self.items || []).filter(function(row) {
                            return !(row.kind === item.kind && String(row.id) === String(item.id));
                        });
                    });
                }).catch(function(err) {
                    self.error = (err && err.message) || 'Could not delete that lesson.';
                }).then(function() {
                    if (self.deletingId === key) self.deletingId = '';
                });
            },
            whenLabel: function(item) {
                var raw = item && item.updated_at;
                if (!raw) return '';
                var date = new Date(raw);
                if (isNaN(date.getTime())) return '';
                return date.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
            }
        };
    }

    if (typeof window.canvasRegisterDeferredAlpineData === 'function') {
        window.canvasRegisterDeferredAlpineData('myLessonsPanel', myLessonsPanelFactory);
    } else {
        document.addEventListener('alpine:init', function() {
            Alpine.data('myLessonsPanel', myLessonsPanelFactory);
        });
    }
})();
