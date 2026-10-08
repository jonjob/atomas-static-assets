(function () {
    'use strict';

    /**
     * Canvas center panel: school system administration (SharePoint SEN/EAL lists, email convention).
     * Reads boot data from #canvas-app-config (systemAdminBootstrap); refreshes via GET …/api/bootstrap.
     */
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

    function systemAdminPanel() {
        var C = readCanvasConfig();
        var boot = C.systemAdminBootstrap || { allowed: false };
        var urls = {
            bootstrapUrl: (C.systemAdminBootstrapUrl || '').trim(),
            createSite: (C.createSharepointSiteUrl || '').trim(),
            senList: (C.createSenSharepointListUrl || '').trim(),
            ealList: (C.createEalSharepointListUrl || '').trim(),
            emailConvention: (C.systemAdminUpdateEmailConventionUrl || '').trim(),
            notebookAgentCategories: (C.notebookAgentDocumentCategoriesUrl || '').trim(),
            personaThemes: (C.systemAdminPersonaThemesUrl || '').trim()
        };

        return {
            allowed: !!boot.allowed,
            senListExists: !!boot.sen_list_exists,
            senListUrl: boot.sen_list_url || '',
            ealListExists: !!boot.eal_list_exists,
            ealListUrl: boot.eal_list_url || '',
            sharepointSites: boot.sharepoint_sites || [],
            emailConvention: boot.staff_email_convention || 'forename.surname',
            isSuperadmin: !!boot.is_superadmin,
            bootstrapLoading: false,
            senSiteId: '',
            ealSiteId: '',
            newSiteNameSen: '',
            newSiteNameEal: '',
            senBusy: false,
            ealBusy: false,
            emailBusy: false,
            senStatus: '',
            senStatusOk: false,
            ealStatus: '',
            ealStatusOk: false,
            emailStatus: '',
            emailStatusOk: false,
            notebookAgentCategoriesUrl: urls.notebookAgentCategories,
            personaThemesUrl: urls.personaThemes,

            applyBootstrap: function (d) {
                if (!d || !d.allowed) {
                    this.allowed = false;
                    return;
                }
                this.allowed = true;
                this.senListExists = !!d.sen_list_exists;
                this.senListUrl = d.sen_list_url || '';
                this.ealListExists = !!d.eal_list_exists;
                this.ealListUrl = d.eal_list_url || '';
                this.sharepointSites = d.sharepoint_sites || [];
                this.emailConvention = d.staff_email_convention || 'forename.surname';
                this.isSuperadmin = !!d.is_superadmin;
            },

            refresh: async function () {
                var u = urls.bootstrapUrl;
                if (!u) return;
                this.bootstrapLoading = true;
                try {
                    var r = await fetch(u, { credentials: 'include' });
                    var data = await r.json().catch(function () { return {}; });
                    if (!r.ok) {
                        this.allowed = false;
                        return;
                    }
                    this.applyBootstrap(data);
                } catch (e) {
                    this.allowed = false;
                } finally {
                    this.bootstrapLoading = false;
                }
            },

            init: function () {
                if (!this.allowed || !urls.bootstrapUrl) return;
                if (this.senListExists && this.ealListExists) return;
                this.refresh();
            },

            createSharepointSite: async function (which) {
                var name = which === 'eal' ? String(this.newSiteNameEal || '').trim() : String(this.newSiteNameSen || '').trim();
                if (!name) {
                    window.alert('Please enter a site name.');
                    return;
                }
                var busyKey = which === 'eal' ? 'ealBusy' : 'senBusy';
                var statusKey = which === 'eal' ? 'ealStatus' : 'senStatus';
                var okKey = which === 'eal' ? 'ealStatusOk' : 'senStatusOk';
                var siteKey = which === 'eal' ? 'ealSiteId' : 'senSiteId';
                var nameKey = which === 'eal' ? 'newSiteNameEal' : 'newSiteNameSen';
                this[busyKey] = true;
                this[statusKey] = 'Creating site…';
                this[okKey] = true;
                try {
                    var r = await fetch(urls.createSite, {
                        method: 'POST',
                        credentials: 'include',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ site_name: name })
                    });
                    var data = await r.json().catch(function () { return {}; });
                    if (r.ok && data.site_id) {
                        this.sharepointSites = (this.sharepointSites || []).concat([
                            {
                                id: String(data.site_id),
                                displayName: data.site_name || name,
                                webUrl: data.web_url || '',
                                name: name
                            }
                        ]);
                        this[siteKey] = String(data.site_id);
                        this[nameKey] = '';
                        this[statusKey] = 'SharePoint site created.';
                        this[okKey] = true;
                    } else {
                        throw new Error(parseErrorResponse(r, data));
                    }
                } catch (e) {
                    this[statusKey] = String(e.message || e);
                    this[okKey] = false;
                } finally {
                    this[busyKey] = false;
                }
            },

            createSenList: async function () {
                if (!this.senSiteId || !urls.senList) return;
                this.senBusy = true;
                this.senStatus = 'Creating SEN list…';
                this.senStatusOk = true;
                try {
                    var r = await fetch(urls.senList, {
                        method: 'POST',
                        credentials: 'include',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ site_id: this.senSiteId })
                    });
                    var data = await r.json().catch(function () { return {}; });
                    if (r.ok && data.success) {
                        this.senStatus = 'SEN list created.';
                        this.senStatusOk = true;
                        await this.refresh();
                    } else {
                        throw new Error(parseErrorResponse(r, data));
                    }
                } catch (e) {
                    this.senStatus = String(e.message || e);
                    this.senStatusOk = false;
                } finally {
                    this.senBusy = false;
                }
            },

            createEalList: async function () {
                if (!this.ealSiteId || !urls.ealList) return;
                this.ealBusy = true;
                this.ealStatus = 'Creating EAL list…';
                this.ealStatusOk = true;
                try {
                    var r = await fetch(urls.ealList, {
                        method: 'POST',
                        credentials: 'include',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ site_id: this.ealSiteId })
                    });
                    var data = await r.json().catch(function () { return {}; });
                    if (r.ok && data.success) {
                        this.ealStatus = 'EAL list created.';
                        this.ealStatusOk = true;
                        await this.refresh();
                    } else {
                        throw new Error(parseErrorResponse(r, data));
                    }
                } catch (e) {
                    this.ealStatus = String(e.message || e);
                    this.ealStatusOk = false;
                } finally {
                    this.ealBusy = false;
                }
            },

            saveEmailConvention: async function () {
                if (!urls.emailConvention) return;
                this.emailBusy = true;
                this.emailStatus = 'Saving…';
                this.emailStatusOk = true;
                try {
                    var r = await fetch(urls.emailConvention, {
                        method: 'POST',
                        credentials: 'include',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ staff_email_convention: this.emailConvention })
                    });
                    var data = await r.json().catch(function () { return {}; });
                    if (r.ok && data.success) {
                        this.emailStatus = 'Saved.';
                        this.emailStatusOk = true;
                    } else {
                        throw new Error(data.error || parseErrorResponse(r, data));
                    }
                } catch (e) {
                    this.emailStatus = String(e.message || e);
                    this.emailStatusOk = false;
                } finally {
                    this.emailBusy = false;
                }
            }
        };
    }

    window.systemAdminPanel = systemAdminPanel;
})();
