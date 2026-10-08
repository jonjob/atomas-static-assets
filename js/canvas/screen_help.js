/**
 * Contextual help for the current canvas tool.
 * Content is keyed by currentAction; UI lives in the shared chrome bar.
 */
(function() {
    'use strict';

    var FALLBACK = {
        title: 'This screen',
        steps: ['No help for this screen yet. Ask your school Atomas contact if you need a walkthrough.']
    };

    var CANVAS_SCREEN_HELP = {
        my_lessons: {
            title: 'My lessons',
            steps: [
                'This list shows lesson plans, quizzes, slide lessons, EAL lessons, online curriculum lessons, and SEN activities you have saved.',
                'Use the chips to show one type.',
                'Open a row to carry on in the tool that created it.'
            ]
        },
        lesson_plan: {
            title: 'Create lesson plan',
            steps: [
                'Work through the guided steps: class and year, subject, pupils, aims, then equipment.',
                'Generate the plan, then use the edit workspace to refine the text.',
                'Create or upload an image in the workspace and drag it onto the plan, or use Insert image.',
                'Highlight text in the plan for quick actions such as Simplify, Expand, or Create image.',
                'Export to OneNote, Word, or PDF when you are happy with it.'
            ],
            notes: [
                'Exit discards an unsaved generated plan — export first if you need to keep it.'
            ]
        },
        quiz: {
            title: 'Create quiz',
            steps: [
                'Upload or paste source material, or pick notebook documents if your school uses Notebook.',
                'Choose the class context and generate the quiz.',
                'Review questions in the canvas, then edit or add items as needed.',
                'Use the chat panel on the right to ask for changes to this quiz.'
            ]
        },
        image_creator: {
            title: 'Create image',
            steps: [
                'Describe the image in the prompt. Be specific about subject, style, and what to avoid.',
                'Pick a style and size, then optionally Enhance prompt before generating.',
                'Generate the image and click it to view full size.',
                'Use a generated image in a lesson plan from that tool’s edit workspace.'
            ]
        },
        eal_lesson: {
            title: 'Create interactive EAL lesson',
            steps: [
                'Follow the wizard: aims, topic, and any extra notes for the class.',
                'Generate the interactive lesson, then review slides and activities in the editor.',
                'Adjust wording or visuals, then save before you Exit.'
            ],
            notes: [
                'Exit asks you to confirm because unsaved lesson work may be lost.'
            ]
        },
        online_lesson: {
            title: 'Online curriculum lesson',
            steps: [
                'Complete the wizard with curriculum context and the lesson goal.',
                'Generate the online lesson, then edit content in the lesson editor.',
                'Save your work before leaving the tool.'
            ]
        },
        lesson_slide_creator: {
            title: 'Lesson Slide Creator',
            steps: [
                'Fill in Lesson details (title, subject, year, and goal), then generate the slide storyboard.',
                'Edit slides — text, images, and activities autosave as you work.',
                'Use Preview to check the class whiteboard view.',
                'When you are ready, use Share to publish a live class page and copy the link.'
            ]
        },
        sen_planning: {
            title: 'SEN Planning',
            steps: [
                'Open the week or pupil context you need to plan for.',
                'Review suggested supports and adjust them for the class.',
                'Use the chat on the right to ask for simpler language or more visual supports.',
                'Save or export the plan according to your school’s usual process.'
            ]
        },
        student_work_marking: {
            title: 'Schoolwork Marker',
            steps: [
                'Create or open a marking scheme for the class and task.',
                'Upload each pupil’s work (photo or file) on their card — click or drop the file.',
                'Run marking when uploads are ready, then review comments before sharing.',
                'Check that names and files match before you accept the marks.'
            ]
        },
        email: {
            title: 'Email',
            steps: [
                'Describe the message you want in the chat, including audience and tone.',
                'Review the draft, then edit it before sending.',
                'Send only when the recipient list and wording are correct.'
            ]
        },
        alert_system: {
            title: 'School alerts',
            steps: [
                'Use Full lockdown only for a genuine emergency. It sends immediately to subscribed clients.',
                'Partial lockdown, shelter in place, medical, and animal loose use their own screen colour and sound.',
                'For other notices, write a custom alert and check the wording before you send.',
                'Send a connection test to check that staff devices are listening, without a siren.'
            ],
            notes: [
                'Alerts go out immediately. Double-check before you tap send.',
                'The activity feed lists alerts sent for this school. All clear appears on an open lockdown entry. Each alert shows how many connected clients confirmed they received it.',
                'Connected is the number of staff clients heard from in the last few minutes. Admins create site zones and place each reporting device into a zone.'
            ]
        },
        inventory: {
            title: 'Inventory',
            steps: [
                'Browse devices synced from Intune and other school equipment.',
                'Filter or search to find a device, then open it to see assignment details.',
                'Record other equipment (printers, peripherals) with a name and serial if you have one.'
            ]
        },
        teams_meetings: {
            title: 'Teams Meetings',
            steps: [
                'Review upcoming or recent Teams meetings for your school.',
                'Open a meeting to see details or related actions available in Atomas.',
                'Use Exit to return to workspace chat when you are done.'
            ]
        },
        it_compliance: {
            title: 'IT Compliance',
            steps: [
                'This screen summarises IT compliance status for the school.',
                'Open Backup, Cyber, or Filtering from here (or the nav) for the detail views.',
                'Use the figures to spot gaps; follow your trust process for follow-up.'
            ]
        },
        it_backup: {
            title: 'Backup status',
            steps: [
                'Check whether school backups are healthy and when they last ran.',
                'Investigate any failed or overdue backups with your IT process.',
                'Return to IT Compliance for the wider picture.'
            ]
        },
        it_cyber: {
            title: 'Cyber status',
            steps: [
                'Review the school’s cyber posture and any highlighted risks.',
                'Open an item for more detail where it is offered.',
                'Return to IT Compliance when you are finished.'
            ]
        },
        it_filtering: {
            title: 'Filtering and monitoring',
            steps: [
                'See filtering and monitoring status for the school.',
                'Use the summary to confirm coverage is as expected.',
                'Raise issues through your usual IT or safeguarding route.'
            ]
        },
        student_passwords: {
            title: 'Student Details',
            steps: [
                'Choose a registration group from the dropdown to list those pupils (or All Groups for the whole school).',
                'Search by name, or download a CSV of the current list.',
                'Select a group, then Print QR codes to produce TAP login cards for that class.',
                'Pupils scan a card, then use Temporary Access Pass on Microsoft login (Atomas browser extension helps paste it).'
            ],
            notes: [
                'QR print needs a registration group selected first.',
                'Each TAP is one-time and lasts about 60 minutes. Print or redeem again if it expires.'
            ]
        },
        staff_management: {
            title: 'Staff Account Management',
            steps: [
                'Search or browse staff accounts for this school.',
                'Open a person to review or update their Atomas access.',
                'Use the info icons on the page where a field needs extra explanation.',
                'Save changes before you leave the screen.'
            ]
        },
        system_admin: {
            title: 'System administration',
            steps: [
                'This area is for school or trust administrators.',
                'Add or rename sites used by SEN/EAL and other school settings as labelled on the page.',
                'Change only what you intend — settings here affect how tools behave for staff.'
            ]
        },
        classroom_teams: {
            title: 'Teams Classrooms',
            steps: [
                'See Teams classes linked to your school.',
                'Open a class to review membership or related classroom actions.',
                'Use your school’s Teams process if a class is missing or out of date.'
            ]
        },
        notebook_admin: {
            title: 'Atomas Notebook',
            steps: [
                'Notebook holds school documents the AI can use when you ask it to.',
                'Add a document with a title, optional description, file or URL, and topics.',
                'Keep categories up to date so staff can find the right sources.',
                'Documents here can be selected when you create quizzes or chat with context.'
            ]
        },
        notebook_curriculum: {
            title: 'Notebook — Curriculum',
            steps: [
                'This list is curriculum documents available to the AI.',
                'Add or update items that teachers should be able to draw on for lessons.',
                'Use clear titles and topics so they are easy to find later.'
            ]
        },
        notebook_marking_rubrics: {
            title: 'Notebook — Marking rubrics',
            steps: [
                'Store marking rubrics the Schoolwork Marker and chat can use.',
                'Add a rubric with a clear title and the year or subject in topics.',
                'Keep only current rubrics so marking stays consistent.'
            ]
        },
        notebook_staff: {
            title: 'Notebook — Staff documents',
            steps: [
                'These are staff-facing documents (policies, guidance) for the notebook.',
                'Upload or link the file and give it a title staff will recognise.',
                'Remove or replace outdated documents so answers stay current.'
            ]
        },
        notebook_app_documents: {
            title: 'Notebook — App documents',
            steps: [
                'App-level documents are shared more widely than a single school notebook.',
                'Add only material that should be available at that wider scope.',
                'This view is typically limited to super-admins.'
            ]
        },
        notebook_trust_staff: {
            title: 'Notebook — Trust staff',
            steps: [
                'Trust staff documents are shared across schools in the trust.',
                'Add trust-wide guidance here rather than in a single school notebook.',
                'This view is for trust notebook admins.'
            ]
        },
        notebook_agent_categories: {
            title: 'Notebook agent categories',
            steps: [
                'Categories control which notebook documents an agent may use.',
                'Review the category list and which documents sit in each one.',
                'Change access only when you intend an agent to see more or less material.'
            ]
        },
        persona_themes: {
            title: 'Persona themes',
            steps: [
                'Choose colours and surface tints for a persona’s workspace look.',
                'Preview the theme, then save so it applies when that persona is active.',
                'Use Exit to return to the main workspace.'
            ]
        },
        sharepoint_favourites: {
            title: 'SharePoint Favourites',
            steps: [
                'Mark SharePoint sites you use often so they are easier to reach in Atomas.',
                'Add or remove favourites from the list on this screen.',
                'Favourites are per user — they do not change anyone else’s list.'
            ]
        },
        sod_home: {
            title: 'School Overview DB — Home',
            steps: [
                'School Overview DB (SOD) is for seasonal school-level indicators.',
                'Use Seasons, Indicators, Data entry, and Visualizations in the bar above.',
                'Start on Home for an overview, then open the section you need.'
            ]
        },
        sod_seasons: {
            title: 'School Overview DB — Seasons',
            steps: [
                'Seasons are the time periods you collect SOD data against (for example a term).',
                'Create or select a season before entering data.',
                'Keep season names clear so reports stay easy to read.'
            ]
        },
        sod_indicators: {
            title: 'School Overview DB — Indicators',
            steps: [
                'Indicators are the measures you track (for example attendance or wellbeing).',
                'Add or edit indicators that your school or trust has agreed to collect.',
                'Do not rename live indicators without checking existing data entry.'
            ]
        },
        sod_data_entry: {
            title: 'School Overview DB — Data entry',
            steps: [
                'Pick the season, then enter or update scores for each indicator.',
                'Add a note where the rating needs context.',
                'Save as you go so visualizations stay up to date.'
            ]
        },
        sod_visualizations: {
            title: 'School Overview DB — Visualizations',
            steps: [
                'Choose the season to see charts and comparison tables.',
                'Hover or tap a cell where notes are available for extra context.',
                'Use this view for SLT discussion, not as a replacement for source data entry.'
            ]
        }
    };

    var open = false;
    var lastAction = null;
    var bound = false;

    function getStore() {
        if (typeof Alpine === 'undefined' || typeof Alpine.store !== 'function') return null;
        return Alpine.store('canvas');
    }

    function getHelp(action) {
        if (action && Object.prototype.hasOwnProperty.call(CANVAS_SCREEN_HELP, action)) {
            return CANVAS_SCREEN_HELP[action];
        }
        return FALLBACK;
    }

    function els() {
        return {
            root: document.querySelector('[data-canvas-screen-help]'),
            btn: document.getElementById('canvas-screen-help-btn'),
            panel: document.getElementById('canvas-screen-help-panel'),
            title: document.querySelector('[data-canvas-screen-help-title]'),
            steps: document.querySelector('[data-canvas-screen-help-steps]'),
            notes: document.querySelector('[data-canvas-screen-help-notes]'),
            notesList: document.querySelector('[data-canvas-screen-help-notes-list]')
        };
    }

    function currentAction() {
        var store = getStore();
        return store && store.currentAction ? store.currentAction : null;
    }

    function toolTitle(action) {
        var store = getStore();
        if (store && typeof store.currentToolTitle === 'function') {
            try {
                return store.currentToolTitle() || 'this screen';
            } catch (e) {}
        }
        var help = getHelp(action);
        return (help && help.title) || 'this screen';
    }

    function render(action) {
        var nodes = els();
        if (!nodes.panel) return;
        var help = getHelp(action);
        var title = help.title || FALLBACK.title;
        if (nodes.title) nodes.title.textContent = title;
        if (nodes.btn) {
            nodes.btn.setAttribute('aria-label', 'Help for ' + (action ? toolTitle(action) : title));
            nodes.btn.setAttribute('aria-expanded', open ? 'true' : 'false');
        }
        if (nodes.steps) {
            nodes.steps.innerHTML = '';
            (help.steps || []).forEach(function(step) {
                var li = document.createElement('li');
                li.textContent = step;
                nodes.steps.appendChild(li);
            });
        }
        var notes = help.notes || [];
        if (nodes.notes) {
            nodes.notes.hidden = notes.length === 0;
        }
        if (nodes.notesList) {
            nodes.notesList.innerHTML = '';
            notes.forEach(function(note) {
                var li = document.createElement('li');
                li.textContent = note;
                nodes.notesList.appendChild(li);
            });
        }
        nodes.panel.hidden = !open;
        if (nodes.root) nodes.root.classList.toggle('is-open', open);
    }

    function setOpen(next) {
        open = !!next;
        if (open && !currentAction()) open = false;
        render(currentAction());
    }

    function toggle() {
        setOpen(!open);
    }

    function onDocumentClick(e) {
        if (!open) return;
        var nodes = els();
        if (!nodes.root) return;
        if (nodes.root.contains(e.target)) return;
        setOpen(false);
    }

    function onKeydown(e) {
        if (!open) return;
        if (e.key === 'Escape' || e.key === 'Esc') {
            setOpen(false);
            var nodes = els();
            if (nodes.btn) nodes.btn.focus();
        }
    }

    function bind() {
        if (bound) return;
        var nodes = els();
        if (!nodes.btn || !nodes.panel) return;
        bound = true;
        nodes.btn.addEventListener('click', function(e) {
            e.preventDefault();
            e.stopPropagation();
            toggle();
        });
        document.addEventListener('click', onDocumentClick);
        document.addEventListener('keydown', onKeydown);
    }

    function sync(action) {
        if (action !== lastAction) {
            lastAction = action;
            if (!action) open = false;
        }
        render(action);
    }

    window.CanvasScreenHelp = {
        get: getHelp,
        open: function() { setOpen(true); },
        close: function() { setOpen(false); },
        toggle: toggle,
        sync: sync
    };

    function watchStore() {
        var store = getStore();
        if (!store) return;
        if (typeof Alpine.effect === 'function') {
            Alpine.effect(function() {
                sync(store.currentAction || null);
            });
            return;
        }
        lastAction = store.currentAction || null;
        render(lastAction);
    }

    function init() {
        bind();
        watchStore();
        render(currentAction());
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', function() {
            bind();
        });
    } else {
        bind();
    }

    document.addEventListener('alpine:init', function() {
        // Store exists after canvas_dashboard.js alpine:init; run on next tick.
        setTimeout(init, 0);
    });
})();
