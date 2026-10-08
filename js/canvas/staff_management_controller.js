(function() {
    'use strict';

    function normalizeStaffSubView(subView) {
        var v = subView || 'staff';
        if (['job_titles', 'registration_groups', 'years', 'subject_areas'].indexOf(v) < 0) v = 'staff';
        return v;
    }

    function initialStaffManagementState(context) {
        var staffSubView = normalizeStaffSubView(context && context.subView);
        return {
            staffAccounts: [],
            trustUsers: [],
            jobTitleOptions: [],
            registrationGroups: [],
            yearGroups: [],
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
    }

    function loadContextIntoStore(store, url, attempt) {
        if (!store || !store.staffManagement) return;
        var self = store;
        var tryNum = attempt || 0;
        fetch(url, { credentials: 'include' })
            .then(function(r) {
                if (r.status === 403 && tryNum < 2) {
                    return new Promise(function(resolve) {
                        setTimeout(resolve, 400 * (tryNum + 1));
                    }).then(function() {
                        return loadContextIntoStore(store, url, tryNum + 1);
                    });
                }
                return r.json().then(function(data) {
                    return { ok: r.ok, data: data };
                });
            })
            .then(function(result) {
                if (!result || !result.data) return;
                var data = result.data;
                if (self.staffManagement && !data.error) {
                    self.staffManagement.staffAccounts = data.staff_accounts || [];
                    self.staffManagement.trustUsers = data.trust_users || [];
                    var rest = (data.job_title_options || []).filter(function(t) { return String(t).toLowerCase() !== 'staff'; });
                    self.staffManagement.jobTitleOptions = ['Staff'].concat(rest);
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
                if (tryNum < 2) {
                    setTimeout(function() {
                        loadContextIntoStore(store, url, tryNum + 1);
                    }, 400 * (tryNum + 1));
                    return;
                }
                if (self.staffManagement) {
                    self.staffManagement.staffAccounts = [];
                    self.staffManagement.trustUsers = [];
                    self.staffManagement.loading = false;
                    self.staffManagement.error = 'Failed to load staff management.';
                }
            });
    }

    window.CanvasFeatures = window.CanvasFeatures || {};
    window.CanvasFeatures.staff_management = {
        normalizeStaffSubView: normalizeStaffSubView,
        initialStaffManagementState: initialStaffManagementState,
        loadContextIntoStore: loadContextIntoStore,
        onSetActionStaffManagement: function(store, context, deps) {
            if (
                store.staffManagement &&
                store.staffManagement.loading &&
                !store.staffManagement.error
            ) {
                return;
            }
            store.staffManagement = initialStaffManagementState(context || {});
            var url =
                (deps && deps.staffManagementContextUrl)
                    ? deps.staffManagementContextUrl
                    : '/api/staff_management/context';
            loadContextIntoStore(store, url);
        }
    };
})();

