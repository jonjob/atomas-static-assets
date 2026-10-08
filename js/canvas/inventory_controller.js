(function () {
    'use strict';

    function inventoryControllerFactory() {
        return {
                activeTab: 'intune',

                // Intune tab state
                intuneLoading: false,
                syncLoading: false,
                syncError: '',
                intuneLastSyncAt: '',

                // Shape returned from API:
                // {
                //   windows: { devices: [...] },
                //   ipad: { devices: [...] },
                //   android: { devices: [...] },
                //   chromebook: { devices: [...] }
                // }
                intuneGroups: {},
                intuneAllDevices: [],

                // Users tab (derived from intuneGroups after load)
                inventoryUsersGroups: [],
                inventoryUsersUnassigned: [],

                // Other tab state
                otherEquipmentList: [],
                otherEquipmentListLoading: false,
                otherEquipmentListError: '',
                otherEquipmentModalOpen: false,
                otherEquipmentEditingId: null,
                otherEquipmentLoading: false,
                otherEquipmentError: '',
                otherEquipmentSuccess: '',
                otherEquipmentForm: {
                    device_category: 'printer',
                    connected_to_device_id: '',
                    name: '',
                    serial_number: ''
                },

                async loadIntuneDevices() {
                    this.syncError = '';
                    this.intuneLoading = true;
                    try {
                        const r = await fetch('/api/inventory/intune/devices', { credentials: 'include' });
                        const data = await r.json();
                        if (!r.ok || data.error) throw new Error(data.error || 'Failed to load Intune devices');

                        this.intuneGroups = data.intune_groups || {};
                        this.intuneAllDevices = data.all_devices || [];
                        this.intuneLastSyncAt = data.last_sync_at || '';

                        // Normalize per-device UI fields
                        const normalize = (d) => {
                            d.actionLoading = false;
                            // Prefill assignment input with current Supabase value (so reassign is easy).
                            d.assignPrimaryUserUpn = d.assignPrimaryUserUpn || d.primary_user || '';
                            return d;
                        };

                        for (const type of Object.keys(this.intuneGroups || {})) {
                            const list = (this.intuneGroups[type] && this.intuneGroups[type].devices) || [];
                            this.intuneGroups[type].devices = (list || []).map(normalize);
                        }

                        this.rebuildInventoryUsersByAssignee();
                        this.intuneLoading = false;
                    } catch (e) {
                        this.intuneLoading = false;
                        this.syncError = e && e.message ? e.message : 'Failed to load Intune devices';
                        this.intuneGroups = {};
                        this.intuneAllDevices = [];
                        this.inventoryUsersGroups = [];
                        this.inventoryUsersUnassigned = [];
                    }
                },

                deviceTypeLabel(deviceType) {
                    const map = {
                        windows: 'Windows',
                        ipad: 'iPad',
                        android: 'Android',
                        chromebook: 'Chromebook',
                        other: 'Other'
                    };
                    return map[deviceType] || deviceType;
                },

                rebuildInventoryUsersByAssignee() {
                    const map = new Map();
                    const unassigned = [];

                    const collect = (d) => {
                        const supa = (d.primary_user || '').trim();
                        const intune = (d.intune_primary_user_upn || '').trim();
                        const effective = supa || intune;
                        if (!effective) {
                            unassigned.push(d);
                            return;
                        }
                        const key = effective.toLowerCase();
                        if (!map.has(key)) {
                            map.set(key, { upn: effective, devices: [] });
                        }
                        map.get(key).devices.push(d);
                    };

                    for (const type of Object.keys(this.intuneGroups || {})) {
                        const list = (this.intuneGroups[type] && this.intuneGroups[type].devices) || [];
                        list.forEach(collect);
                    }

                    const groups = Array.from(map.values()).map((g) => {
                        g.devices = (g.devices || []).slice().sort((a, b) => {
                            const an = (a.name || a.serial_number || '').toLowerCase();
                            const bn = (b.name || b.serial_number || '').toLowerCase();
                            return an.localeCompare(bn);
                        });
                        return g;
                    });
                    groups.sort((a, b) => a.upn.localeCompare(b.upn));
                    unassigned.sort((a, b) => {
                        const an = (a.name || a.serial_number || '').toLowerCase();
                        const bn = (b.name || b.serial_number || '').toLowerCase();
                        return an.localeCompare(bn);
                    });

                    this.inventoryUsersGroups = groups;
                    this.inventoryUsersUnassigned = unassigned;
                },

                otherEquipmentCategoryLabel(cat) {
                    const map = {
                        printer: 'Printer',
                        switch: 'Switch',
                        monitor: 'Monitor',
                        keyboard: 'Keyboard',
                        mouse: 'Mouse'
                    };
                    if (!cat) return '—';
                    return map[cat] || cat.replace(/_/g, ' ');
                },

                otherEquipmentHostLabel(item) {
                    const id = item && item.connected_to_device_id;
                    if (!id) return '';
                    const devices = this.intuneAllDevices || [];
                    const d = devices.find((x) => String(x.id) === String(id));
                    if (!d) return '(unknown host)';
                    return d.name || d.serial_number || d.intune_device_id || '(device)';
                },

                resetOtherEquipmentForm() {
                    this.otherEquipmentEditingId = null;
                    this.otherEquipmentForm = {
                        device_category: 'printer',
                        connected_to_device_id: '',
                        name: '',
                        serial_number: ''
                    };
                },

                openAddOtherEquipmentModal() {
                    this.otherEquipmentError = '';
                    this.otherEquipmentSuccess = '';
                    this.resetOtherEquipmentForm();
                    this.otherEquipmentModalOpen = true;
                },

                openEditOtherEquipment(item) {
                    if (!item || !item.id) return;
                    this.otherEquipmentError = '';
                    this.otherEquipmentSuccess = '';
                    this.otherEquipmentEditingId = item.id;
                    const hostId = item.connected_to_device_id;
                    this.otherEquipmentForm = {
                        device_category: item.device_category || 'printer',
                        connected_to_device_id: hostId != null && hostId !== '' ? String(hostId) : '',
                        name: item.name || '',
                        serial_number: item.serial_number || ''
                    };
                    this.otherEquipmentModalOpen = true;
                },

                closeOtherEquipmentModal() {
                    this.otherEquipmentModalOpen = false;
                    this.otherEquipmentError = '';
                    this.otherEquipmentSuccess = '';
                },

                async loadOtherEquipment() {
                    this.otherEquipmentListLoading = true;
                    this.otherEquipmentListError = '';
                    try {
                        const r = await fetch('/api/inventory/other-equipment', { credentials: 'include' });
                        const data = await r.json();
                        if (!r.ok || data.error) throw new Error(data.error || 'Failed to load equipment');
                        this.otherEquipmentList = data.items || [];
                    } catch (e) {
                        this.otherEquipmentList = [];
                        this.otherEquipmentListError = e && e.message ? e.message : 'Failed to load other equipment';
                    } finally {
                        this.otherEquipmentListLoading = false;
                    }
                },

                async syncIntune() {
                    this.syncError = '';
                    this.syncLoading = true;
                    try {
                        const r = await fetch('/api/inventory/intune/sync', {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            credentials: 'include'
                        });
                        const data = await r.json();
                        if (!r.ok || data.error) throw new Error(data.error || 'Intune sync failed');

                        if (data.task_id) {
                            const taskId = data.task_id;
                            const deadline = Date.now() + 300000;
                            while (Date.now() < deadline) {
                                const tr = await fetch('/task_status/' + encodeURIComponent(taskId), { credentials: 'include' });
                                const td = await tr.json();
                                if (td.state === 'SUCCESS') break;
                                if (td.state === 'FAILURE') throw new Error(td.error || 'Intune sync task failed');
                                await new Promise(function(resolve) { setTimeout(resolve, 2000); });
                            }
                        }

                        await this.loadIntuneDevices();
                        await this.loadOtherEquipment();
                    } catch (e) {
                        this.syncError = e && e.message ? e.message : 'Intune sync failed';
                    } finally {
                        this.syncLoading = false;
                    }
                },

                async useIntunePrimary(device) {
                    if (!device || !device.id) return;
                    device.actionLoading = true;
                    try {
                        const r = await fetch(`/api/inventory/devices/${device.id}/use-intune-primary`, {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            credentials: 'include'
                        });
                        const data = await r.json();
                        if (!r.ok || data.error) throw new Error(data.error || 'Failed to apply Intune primary user');
                        await this.loadIntuneDevices();
                    } catch (e) {
                        this.syncError = e && e.message ? e.message : 'Failed to apply Intune primary user';
                    } finally {
                        device.actionLoading = false;
                    }
                },

                async keepSupabasePrimary(device) {
                    if (!device || !device.id) return;
                    device.actionLoading = true;
                    try {
                        const r = await fetch(`/api/inventory/devices/${device.id}/keep-supabase-primary`, {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            credentials: 'include'
                        });
                        const data = await r.json();
                        if (!r.ok || data.error) throw new Error(data.error || 'Failed to keep Supabase primary user');
                        await this.loadIntuneDevices();
                    } catch (e) {
                        this.syncError = e && e.message ? e.message : 'Failed to keep Supabase primary user';
                    } finally {
                        device.actionLoading = false;
                    }
                },

                async assignPrimaryUser(device) {
                    if (!device || !device.id) return;
                    if (!device.assignPrimaryUserUpn || !device.assignPrimaryUserUpn.trim()) return;

                    device.actionLoading = true;
                    try {
                        const r = await fetch(`/api/inventory/devices/${device.id}/assign-primary-user`, {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            credentials: 'include',
                            body: JSON.stringify({ primary_user_upn: device.assignPrimaryUserUpn.trim() })
                        });
                        const data = await r.json();
                        if (!r.ok || data.error) throw new Error(data.error || 'Failed to assign primary user');
                        await this.loadIntuneDevices();
                    } catch (e) {
                        this.syncError = e && e.message ? e.message : 'Failed to assign primary user';
                    } finally {
                        device.actionLoading = false;
                    }
                },

                async submitOtherEquipmentModal() {
                    this.otherEquipmentError = '';
                    this.otherEquipmentSuccess = '';
                    const name = (this.otherEquipmentForm.name || '').trim();
                    if (!name) {
                        this.otherEquipmentError = 'Name is required.';
                        return;
                    }

                    this.otherEquipmentLoading = true;
                    try {
                        const payload = {
                            device_category: this.otherEquipmentForm.device_category,
                            connected_to_device_id: this.otherEquipmentForm.connected_to_device_id || null,
                            name: name,
                            serial_number: this.otherEquipmentForm.serial_number || null
                        };

                        const editing = this.otherEquipmentEditingId;
                        const url = editing
                            ? `/api/inventory/other-equipment/${encodeURIComponent(editing)}`
                            : '/api/inventory/other-equipment';
                        const method = editing ? 'PATCH' : 'POST';

                        const r = await fetch(url, {
                            method,
                            headers: { 'Content-Type': 'application/json' },
                            credentials: 'include',
                            body: JSON.stringify(payload)
                        });
                        const data = await r.json();
                        if (!r.ok || data.error) throw new Error(data.error || 'Failed to save equipment');

                        await this.loadOtherEquipment();
                        this.otherEquipmentModalOpen = false;
                        this.otherEquipmentEditingId = null;
                        this.resetOtherEquipmentForm();
                        this.otherEquipmentSuccess = editing ? 'Equipment updated.' : 'Equipment added.';
                    } catch (e) {
                        this.otherEquipmentError = e && e.message ? e.message : 'Failed to save equipment';
                    } finally {
                        this.otherEquipmentLoading = false;
                    }
                },

                init() {
                    this.loadIntuneDevices();
                    this.loadOtherEquipment();
                    this.$watch('activeTab', (tab) => {
                        if (tab === 'other') this.loadOtherEquipment();
                    });
                }
            };
    }

    if (typeof window.canvasRegisterDeferredAlpineData === 'function') {
        window.canvasRegisterDeferredAlpineData('inventoryController', inventoryControllerFactory);
    } else if (typeof Alpine !== 'undefined' && typeof Alpine.data === 'function') {
        Alpine.data('inventoryController', inventoryControllerFactory);
    } else {
        document.addEventListener('alpine:init', function () {
            Alpine.data('inventoryController', inventoryControllerFactory);
        });
    }
})();

