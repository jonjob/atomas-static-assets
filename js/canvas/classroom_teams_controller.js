(function () {
    'use strict';

    function readCanvasConfig() {
        try {
            var el = document.getElementById('canvas-app-config');
            if (el && el.textContent) {
                return JSON.parse(el.textContent);
            }
        } catch (e) {}
        return {};
    }

    function parseErrorResponse(r, data) {
        if (data && data.detail !== undefined) {
            var d = data.detail;
            if (typeof d === 'string') return d;
            if (Array.isArray(d) && d.length && d[0].msg) return d.map(function (x) { return x.msg; }).join('; ');
            return JSON.stringify(d);
        }
        if (data && data.error) return String(data.error);
        return r.statusText || 'Request failed';
    }

    function isoDateSlice(v) {
        if (v === null || v === undefined) return '';
        var s = String(v);
        if (s.length >= 10 && s.indexOf('-') === 4) return s.slice(0, 10);
        return s;
    }

    function mergeTaskPollResponse(data) {
        if (data && data.state === 'SUCCESS' && data.result && typeof data.result === 'object') {
            var o = Object.assign({}, data, data.result);
            return o;
        }
        return data;
    }

    function classroomTeamsPanel() {
        var C = readCanvasConfig();
        var boot = C.classroomTeamsBootstrap || { allowed: false };
        var urls = {
            bootstrap: (C.classroomTeamsBootstrapUrl || '').trim(),
            updateYear: (C.classroomTeamsUpdateAcademicYearUrl || '').trim(),
            createTeams: (C.classroomTeamsCreateTeamsUrl || '').trim(),
            archiveTeam: (C.classroomTeamsArchiveTeamUrl || '').trim(),
            taskStatusTpl: (C.classroomTeamsTaskStatusUrlTemplate || '').trim()
        };

        function taskStatusUrl(taskId) {
            var tid = String(taskId || '').trim();
            if (!tid) return '';
            if (urls.taskStatusTpl) return urls.taskStatusTpl.replace('__TASK_ID__', tid);
            return '/classroom_teams_task_status/' + encodeURIComponent(tid);
        }

        var ay = boot.academic_year_dates || null;
        var initStart = ay && ay.start_date ? isoDateSlice(ay.start_date) : '';
        var initEnd = ay && ay.end_date ? isoDateSlice(ay.end_date) : '';

        return {
            allowed: !!boot.allowed,
            registrationGroups: boot.registration_groups || [],
            yearGroups: boot.year_groups || [],
            currentTeams: boot.current_teams || [],
            archivedTeams: boot.archived_teams || [],
            academicYearDates: boot.academic_year_dates || null,
            currentYear: boot.current_year != null ? boot.current_year : null,
            tab: 'current',
            startDate: initStart,
            endDate: initEnd,
            selectedRg: [],
            selectedYears: [],
            updateYearBusy: false,
            createBusy: false,
            archiveBusy: false,
            archiveTeamId: '',
            progressVisible: false,
            progressBarPct: 0,
            progressStatus: '',
            progressDetails: '',
            progressOk: true,
            pollTimer: null,
            inlineError: '',
            inlineSuccess: '',
            noStaffGroups: [],

            applyBootstrap: function (d) {
                if (!d || !d.allowed) {
                    this.allowed = false;
                    return;
                }
                this.allowed = true;
                this.registrationGroups = d.registration_groups || [];
                this.yearGroups = d.year_groups || [];
                this.currentTeams = d.current_teams || [];
                this.archivedTeams = d.archived_teams || [];
                this.academicYearDates = d.academic_year_dates || null;
                this.currentYear = d.current_year != null ? d.current_year : null;
                var ay2 = d.academic_year_dates || null;
                if (ay2 && ay2.start_date) this.startDate = isoDateSlice(ay2.start_date);
                if (ay2 && ay2.end_date) this.endDate = isoDateSlice(ay2.end_date);
            },

            refresh: async function () {
                this.inlineError = '';
                if (!urls.bootstrap) return;
                try {
                    var r = await fetch(urls.bootstrap, { credentials: 'include' });
                    var data = await r.json().catch(function () { return {}; });
                    if (!r.ok) {
                        throw new Error(parseErrorResponse(r, data));
                    }
                    this.applyBootstrap(data);
                } catch (e) {
                    this.inlineError = String(e.message || e);
                }
            },

            saveAcademicYear: async function () {
                if (!urls.updateYear) return;
                this.updateYearBusy = true;
                this.inlineError = '';
                this.inlineSuccess = '';
                try {
                    var r = await fetch(urls.updateYear, {
                        method: 'POST',
                        credentials: 'include',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                            start_date: this.startDate,
                            end_date: this.endDate
                        })
                    });
                    var data = await r.json().catch(function () { return {}; });
                    if (!r.ok || !data.success) {
                        throw new Error(data.error || parseErrorResponse(r, data));
                    }
                    this.inlineSuccess = 'Academic year dates updated.';
                    await this.refresh();
                } catch (e) {
                    this.inlineError = String(e.message || e);
                } finally {
                    this.updateYearBusy = false;
                }
            },

            startCreateTeams: async function () {
                var self = this;
                if (!urls.createTeams || (!this.selectedRg.length && !this.selectedYears.length)) {
                    this.inlineError = 'Select at least one registration group or year group.';
                    return;
                }
                if (!this.currentYear) {
                    this.inlineError = 'Configure academic year dates first.';
                    return;
                }
                this.createBusy = true;
                this.inlineError = '';
                this.inlineSuccess = '';
                this.noStaffGroups = [];
                this.progressVisible = true;
                this.progressOk = true;
                this.progressBarPct = 0;
                this.progressStatus = 'Submitting request…';
                this.progressDetails = '';
                try {
                    var r = await fetch(urls.createTeams, {
                        method: 'POST',
                        credentials: 'include',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                            registration_groups: this.selectedRg,
                            year_groups: this.selectedYears
                        })
                    });
                    var data = await r.json().catch(function () { return {}; });
                    if (r.status === 202 && data.task_id) {
                        self.pollTaskStatus(data.task_id);
                    } else {
                        throw new Error(parseErrorResponse(r, data));
                    }
                } catch (e) {
                    this.progressVisible = false;
                    this.inlineError = String(e.message || e);
                    this.createBusy = false;
                }
            },

            clearPoll: function () {
                if (this.pollTimer) {
                    clearInterval(this.pollTimer);
                    this.pollTimer = null;
                }
            },

            pollTaskStatus: function (taskId) {
                var self = this;
                var url = taskStatusUrl(taskId);
                if (!url) {
                    self.inlineError = 'Task status URL not configured.';
                    self.createBusy = false;
                    self.progressVisible = false;
                    return;
                }
                this.clearPoll();
                this.pollTimer = setInterval(function () {
                    fetch(url, { credentials: 'include' })
                        .then(function (response) { return response.json(); })
                        .then(function (raw) {
                            var data = mergeTaskPollResponse(raw);
                            if (data.state === 'SUCCESS') {
                                self.clearPoll();
                                self.handleTaskSuccess(data);
                            } else if (data.state === 'FAILURE') {
                                self.clearPoll();
                                self.handleTaskFailure(data);
                            } else if (data.state === 'PROGRESS' || data.state === 'PENDING') {
                                self.updateProgress(data);
                            }
                        })
                        .catch(function (err) {
                            self.clearPoll();
                            self.handleTaskFailure({ error: 'Error checking task status: ' + (err && err.message ? err.message : String(err)) });
                        });
                }, 2000);
            },

            updateProgress: function (data) {
                var current = data.current || 0;
                var total = data.total || 1;
                var percentage = total > 0 ? Math.round((current / total) * 100) : 0;
                this.progressBarPct = percentage;
                this.progressStatus = data.status || 'Processing…';
                var details = '';
                if (data.current_group) {
                    details = 'Processing: ' + data.current_group;
                }
                if (data.step) {
                    var stepNames = {
                        starting: 'Starting',
                        getting_staff: 'Getting staff members',
                        getting_students: 'Getting students',
                        creating_class: 'Creating educationClass',
                        creating_team: 'Creating Team',
                        waiting_provisioning: 'Waiting for Team provisioning',
                        adding_owners: 'Adding owners',
                        adding_members: 'Adding members',
                        saving_database: 'Saving to database'
                    };
                    details += (details ? ' — ' : '') + (stepNames[data.step] || data.step);
                }
                if (total > 1) {
                    details += (details ? ' | ' : '') + 'Group ' + (current + 1) + ' of ' + total;
                }
                this.progressDetails = details;
            },

            handleTaskSuccess: function (data) {
                var self = this;
                this.progressBarPct = 100;
                var noStaffErrors = [];
                if (data.results && Array.isArray(data.results)) {
                    data.results.forEach(function (result) {
                        if (result && result.reason === 'no_staff' && result.registration_group) {
                            noStaffErrors.push(result.registration_group);
                        }
                    });
                }
                if (data.errors && Array.isArray(data.errors)) {
                    data.errors.forEach(function (error) {
                        if (typeof error === 'string' && error.indexOf('No staff members found for') !== -1) {
                            var match = error.match(/No staff members found for ([^-]+?)(?:\s*-|$)/);
                            if (match) {
                                var group = match[1].trim();
                                if (group && noStaffErrors.indexOf(group) === -1) noStaffErrors.push(group);
                            }
                        }
                    });
                }
                if (noStaffErrors.length > 0) {
                    this.progressStatus = 'Task completed with errors';
                    this.progressDetails = 'Some classes have no staff assigned.';
                    this.noStaffGroups = noStaffErrors;
                    this.progressOk = false;
                    this.createBusy = false;
                    this.refresh();
                    return;
                }
                this.progressStatus = 'Task completed successfully';
                var message = 'Successfully created ' + (data.success_count || 0) + ' team(s)';
                if (data.error_count > 0) {
                    message += '. ' + data.error_count + ' error(s) occurred.';
                }
                if (data.errors && data.errors.length > 0) {
                    message += ' ' + data.errors.slice(0, 5).join('; ');
                }
                this.progressDetails = message;
                this.progressOk = true;
                this.createBusy = false;
                this.selectedRg = [];
                this.selectedYears = [];
                this.refresh();
            },

            handleTaskFailure: function (data) {
                this.progressBarPct = 100;
                this.progressStatus = 'Task failed';
                this.progressDetails = data.error || 'An error occurred while creating teams';
                this.progressOk = false;
                this.createBusy = false;
            },

            confirmArchive: function (teamId) {
                if (!teamId) return;
                if (!window.confirm('Archive this team? It will be hidden from the current list but remains in Microsoft Teams.')) return;
                this.archiveTeam(teamId);
            },

            archiveTeam: async function (teamId) {
                if (!urls.archiveTeam || !teamId) return;
                this.archiveBusy = true;
                this.inlineError = '';
                this.inlineSuccess = '';
                try {
                    var r = await fetch(urls.archiveTeam, {
                        method: 'POST',
                        credentials: 'include',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ team_id: teamId })
                    });
                    var data = await r.json().catch(function () { return {}; });
                    if (!r.ok || !data.success) {
                        throw new Error(data.error || parseErrorResponse(r, data));
                    }
                    this.inlineSuccess = 'Team archived.';
                    await this.refresh();
                } catch (e) {
                    this.inlineError = String(e.message || e);
                } finally {
                    this.archiveBusy = false;
                }
            },

            openStaffRegistrationGroups: function () {
                var s = Alpine.store('canvas');
                if (s && typeof s.setAction === 'function') {
                    s.setAction('staff_management', { subView: 'registration_groups' });
                }
            },

            teamKind: function (team) {
                if (!team) return '';
                var label = team.registration_group != null ? String(team.registration_group) : '';
                var years = this.yearGroups || [];
                for (var i = 0; i < years.length; i++) {
                    if (String(years[i]).toLowerCase() === label.toLowerCase()) return 'Year group';
                }
                return 'Registration group';
            },

            teamLabel: function (team) {
                if (!team) return '';
                var rg = team.registration_group != null ? String(team.registration_group) : '';
                var y = team.academic_year != null ? String(team.academic_year) : '';
                return (rg + ' ' + y).trim();
            },

            shortTeamId: function (tid) {
                var s = String(tid || '');
                if (s.length <= 8) return s;
                return s.slice(0, 8) + '…';
            }
        };
    }

    window.classroomTeamsPanel = classroomTeamsPanel;
})();
