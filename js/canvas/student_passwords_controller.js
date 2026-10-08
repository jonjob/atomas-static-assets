(function() {
    'use strict';

    function initialStudentPasswordsState() {
        return {
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
    }

    function loadContextIntoStore(store, url) {
        if (!store || !store.studentPasswords) return;
        var self = store;
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

    window.CanvasFeatures = window.CanvasFeatures || {};
    window.CanvasFeatures.student_passwords = {
        onSetActionStudentPasswords: function(store, context, deps) {
            store.studentPasswords = initialStudentPasswordsState();
            var url =
                deps && deps.studentPasswordsContextUrl
                    ? deps.studentPasswordsContextUrl
                    : (typeof studentPasswordsContextUrl !== 'undefined' ? studentPasswordsContextUrl : '/api/student_passwords/context');
            loadContextIntoStore(store, url);
        }
    };
})();

