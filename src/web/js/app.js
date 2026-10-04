(() => {
    'use strict';

    const API = '/plugins/ugreen-led-control/api.php';
    const root = document.getElementById('ulc');

    if (!root) return;

    const q = selector => root.querySelector(selector);
    const qa = selector => [...root.querySelectorAll(selector)];
    const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));

    /*
     * ---------------------------------------------------------
     * Static data
     * ---------------------------------------------------------
     */

    const ICONS = {
        nas: '<rect x="3" y="3" width="18" height="18" rx="2"/><path d="M7.5 7v8M12 7v8M16.5 7v8M7 18.5h.01M17 18.5h.01"/>',
        home: '<path d="m3 10 9-7 9 7v10a2 2 0 0 1-2 2h-4v-7H9v7H5a2 2 0 0 1-2-2z"/>',
        bulb: '<path d="M9 18h6M10 22h4"/><path d="M12 2a7 7 0 0 0-4 12.7c.6.5 1 1.3 1 2.1V17h6v-.2c0-.8.4-1.6 1-2.1A7 7 0 0 0 12 2z"/>',
        drives: '<ellipse cx="12" cy="5" rx="9" ry="3"/><path d="M3 5v14c0 1.7 4 3 9 3s9-1.3 9-3V5"/><path d="M3 12c0 1.7 4 3 9 3s9-1.3 9-3"/>',
        sparkles: '<path d="m12 3 1.9 5.1L19 10l-5.1 1.9L12 17l-1.9-5.1L5 10l5.1-1.9z"/><path d="M19 3v4M17 5h4M5 17v4M3 19h4"/>',
        clock: '<circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/>',
        gear: '<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z"/>',
        info: '<circle cx="12" cy="12" r="10"/><path d="M12 16v-4M12 8h.01"/>',
        check: '<path d="M20 6 9 17l-5-5"/>',
        alert: '<path d="M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0z"/><path d="M12 9v4M12 17h.01"/>',
        sun: '<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/>',
        power: '<path d="M12 2v10"/><path d="M18.4 6.6a9 9 0 1 1-12.8 0"/>',
        activity: '<path d="M22 12h-4l-3 9L9 3l-3 9H2"/>',
        network: '<rect x="9" y="2" width="6" height="6" rx="1"/><rect x="2" y="16" width="6" height="6" rx="1"/><rect x="16" y="16" width="6" height="6" rx="1"/><path d="M5 16v-3h14v3M12 12V8"/>',
        wave: '<path d="M2 12c2.5-5 5-5 7.5 0s5 5 7.5 0 3.5-3.5 5-2"/>',
        rainbow: '<path stroke="#ff3b30" d="M22 18a10 10 0 0 0-20 0"/><path stroke="#ffd60a" d="M18.5 18a6.5 6.5 0 0 0-13 0"/><path stroke="#34c759" d="M15 18a3 3 0 0 0-6 0"/>',
        thermo: '<path stroke="#ff6b5e" d="M14 4v10.5a4 4 0 1 1-4 0V4a2 2 0 0 1 4 0z"/>',
        reset: '<path d="M3 12a9 9 0 1 0 3-6.7L3 8"/><path d="M3 3v5h5"/>',
        refresh: '<path d="M21 12a9 9 0 1 1-3-6.7L21 8"/><path d="M21 3v5h-5"/>',
        play: '<path fill="currentColor" d="m7 4 13 8-13 8z"/>'
    };

    const icon = name =>
        `<svg viewBox="0 0 24 24" aria-hidden="true">${ICONS[name] || ''}</svg>`;

    const DEFAULTS = {
        power: '#ffffff',
        netdev: '#00c853',
        disk: '#ffa000',
        error: '#ff3b30',
        brightness: 80
    };

    // on/off times in ms that the driver accepts for breath and blink.
    const SPEEDS = [
        { label: 'Sehr langsam', breath: [3000, 2000], blink: [1000, 1000] },
        { label: 'Langsam', breath: [2000, 1500], blink: [700, 700] },
        { label: 'Mittel', breath: [1200, 900], blink: [450, 450] },
        { label: 'Schnell', breath: [700, 500], blink: [250, 250] },
        { label: 'Sehr schnell', breath: [400, 300], blink: [120, 120] }
    ];

    const EFFECTS = [
        { id: 'static', name: 'Statisch', text: 'Feste Farbe', icon: 'bulb' },
        { id: 'breath', name: 'Atmen', text: 'Sanftes Ein- und Ausblenden', icon: 'wave' },
        { id: 'blink', name: 'Pulsierend', text: 'Gleichmäßiges Blinken', icon: 'activity' },
        { id: 'rainbow', name: 'Regenbogen', text: 'Automatischer Farbwechsel', icon: 'rainbow', soon: true },
        { id: 'temperature', name: 'Temperatur', text: 'Farbe nach Systemtemperatur', icon: 'thermo', soon: true },
        { id: 'off', name: 'Deaktiviert', text: 'LEDs ausschalten', icon: 'power' }
    ];

    const state = {
        model: 'UGREEN NAS',
        bays: 0,
        order: [],
        leds: {},
        status: {},
        bayInfo: [],
        busy: 0,
        tab: 'system',
        target: 'all',
        speed: 2,
        dragging: false
    };

    const disks = () => state.order.filter(led => led.startsWith('disk'));

    const targetLeds = target =>
        target === 'all' ? state.order
            : target === 'disks' ? disks()
                : [target];

    const statusMode = () => state.status.mode === 'status';

    // In status mode the daemon drives disk and network LEDs; only colour and brightness stay manual.
    const managed = led => statusMode() && (led === 'netdev' || led.startsWith('disk'));

    const ledLabel = led =>
        led === 'power' ? 'Power LED'
            : led === 'netdev' ? 'Netzwerk LED'
                : `Schacht ${led.slice(4)}`;

    /*
     * ---------------------------------------------------------
     * Helpers
     * ---------------------------------------------------------
     */

    const escapeHtml = value => String(value).replace(/[&<>"']/g, c => ({
        '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
    })[c]);

    function rgbToHex(value) {
        const parts = String(value).trim().split(/\s+/).map(Number);

        if (parts.length < 3 || parts.some(Number.isNaN)) return '#ffffff';

        return '#' + parts.slice(0, 3)
            .map(n => Math.max(0, Math.min(255, n)).toString(16).padStart(2, '0'))
            .join('');
    }

    function hexToRgb(hex) {
        const value = hex.replace('#', '');

        return {
            r: parseInt(value.slice(0, 2), 16),
            g: parseInt(value.slice(2, 4), 16),
            b: parseInt(value.slice(4, 6), 16)
        };
    }

    const normalizeHex = value => {
        const match = String(value).trim().match(/^#?([0-9a-f]{6})$/i);
        return match ? `#${match[1].toLowerCase()}` : null;
    };

    const levelFromPercent = percent => Math.round(percent * 2.55);

    function setRangeFill(input) {
        const min = Number(input.min) || 0;
        const max = Number(input.max) || 100;
        input.style.setProperty('--fill', `${(input.value - min) / (max - min) * 100}%`);
    }

    function toast(message, type = 'success') {
        const element = q('#ulc-toast');

        element.textContent = message;
        element.className = `ulc-toast show ${type}`;

        if (type === 'error') console.error('[UGREEN LED]', message);

        clearTimeout(element._timer);
        element._timer = setTimeout(() => {
            element.className = 'ulc-toast';
        }, type === 'error' ? 6000 : 2500);
    }

    /*
     * ---------------------------------------------------------
     * API
     * ---------------------------------------------------------
     */

    async function api(params, post = false) {
        const options = { credentials: 'same-origin' };
        let url = API;

        if (post) {
            options.method = 'POST';
            // Unraid rejects POSTs without the WebGUI csrf_token before api.php runs.
            options.body = new URLSearchParams({
                ...params,
                csrf_token: window.UGREEN_LED_CSRF_TOKEN || ''
            });
        } else {
            url += '?' + new URLSearchParams(params);
        }

        const response = await fetch(url, options);
        const text = await response.text();
        let data;

        try {
            data = JSON.parse(text);
        } catch (error) {
            throw new Error(`Ungültige API-Antwort (HTTP ${response.status})`);
        }

        if (!response.ok || data.ok === false) {
            throw new Error(data.error || `API-Fehler (HTTP ${response.status})`);
        }

        return data;
    }

    async function write(leds, action, extra = {}) {
        if (!leds.length) return;

        state.busy++;

        try {
            await api({ action, led: leds.join(','), ...extra }, true);
        } finally {
            state.busy--;
        }
    }

    // Run a user action: report errors and re-read the hardware afterwards.
    async function run(action, success) {
        try {
            await action();
            if (success) toast(success);
        } catch (error) {
            toast(error.message, 'error');
        }

        await refresh();
    }

    /*
     * ---------------------------------------------------------
     * Loading
     * ---------------------------------------------------------
     */

    async function loadStatus() {
        try {
            const data = await api({ action: 'status' });

            state.status = data;
            state.model = data.model || 'UGREEN NAS';

            const order = Array.isArray(data.leds) ? data.leds : [];
            const baysChanged = data.bays !== state.bays || order.join() !== state.order.join();

            state.bays = data.bays;
            state.order = order;

            if (baysChanged) buildLayout();

            renderStatus(true);
            renderMode();
            loadBays();
        } catch (error) {
            renderStatus(false, error.message);
        }
    }

    async function loadBays() {
        try {
            const data = await api({ action: 'bays' });
            state.bayInfo = data.bays || [];
        } catch (error) {
            state.bayInfo = [];
        }

        renderBays();
    }

    async function refresh() {
        if (!state.order.length) return;

        try {
            const data = await api({ action: 'all' });

            // A write started while this read was in flight; its own refresh follows.
            if (state.busy) return;

            const leds = {};

            for (const [name, led] of Object.entries(data.leds || {})) {
                leds[name] = {
                    color: rgbToHex(led.color),
                    brightness: Number(led.brightness) || 0,
                    effect: led.effect || 'none'
                };
            }

            state.leds = leds;
            render();
        } catch (error) {
            renderStatus(false, error.message);
        }
    }

    /*
     * ---------------------------------------------------------
     * Rendering
     * ---------------------------------------------------------
     */

    function renderStatus(online, error) {
        const badge = q('#ulc-online');

        badge.textContent = online ? 'Online' : 'Offline';
        badge.className = `ulc-badge ${online ? 'online' : 'offline'}`;
        badge.title = error || '';

        q('#ulc-banner').hidden = !online;
        q('#ulc-foreign').hidden = !state.status.foreign_monitor;

        qa('[data-model]').forEach(element => {
            element.textContent = state.model;
        });

        q('#ulc-version').textContent = window.UGREEN_LED_VERSION || '';

        const facts = [
            ['Modell', state.model],
            ['Laufwerksschächte', state.bays || '—'],
            ['Treiber', state.status.controller || '—'],
            ['I²C', state.status.i2c_address ? `Bus ${state.status.i2c_bus}, Adresse ${state.status.i2c_address}` : '—'],
            ['Kernel', state.status.kernel || '—'],
            ['ugreenleds-driver Monitor', state.status.foreign_monitor ? 'läuft (überschreibt Laufwerks- und Netzwerk-LED)' : 'läuft nicht'],
            ['Gespeicherte Einstellungen', state.status.settings_saved ? 'ja – werden beim Booten wiederhergestellt' : 'noch keine'],
            ['Plugin-Version', window.UGREEN_LED_VERSION || '—'],
            ['Status', online ? 'Verbunden' : `Keine Verbindung: ${error || ''}`]
        ];

        q('#ulc-facts').innerHTML = facts
            .map(([key, value]) => `<dt>${escapeHtml(key)}</dt><dd>${escapeHtml(value)}</dd>`)
            .join('');
    }

    // Parts that depend on the bay count are built once and then only updated.
    function buildLayout() {
        qa('[data-nas]').forEach(element => {
            element.style.setProperty('--bays', String(disks().length || 1));
            element.innerHTML =
                '<div class="ulc-nas-bays">' +
                disks().map((led, i) => `
                    <div class="ulc-bay">
                        <span class="ulc-bay-no">${String(i + 1).padStart(2, '0')}</span>
                        <span class="ulc-bay-knob"></span>
                        <span class="ulc-led" data-led="${led}"></span>
                    </div>`).join('') +
                '</div>' +
                '<div class="ulc-nas-front">' +
                '<span class="ulc-led" data-led="power"></span><span class="ulc-led-label">Power</span>' +
                '<span class="ulc-led" data-led="netdev"></span><span class="ulc-led-label">LAN</span>' +
                '<span class="ulc-nas-brand">UGREEN</span>' +
                '</div>';
        });

        buildColors();
        buildTable(q('#ulc-led-table'), state.order);
        buildTable(q('#ulc-bay-table'), disks());
    }

    function render() {
        qa('.ulc-led[data-led]').forEach(element => paintLed(element, element.dataset.led));
        renderGeneral();
        renderColors();
        renderEffects();
        renderTables();
    }

    function paintLed(element, led) {
        const s = state.leds[led];

        if (!s) return;

        const on = s.brightness > 0;
        const effect = on ? s.effect : 'none';
        const speed = SPEEDS[state.speed][effect === 'blink' ? 'blink' : 'breath'];

        element.classList.toggle('off', !on);
        element.classList.toggle('fx-breath', effect === 'breath');
        element.classList.toggle('fx-blink', effect === 'blink');
        element.style.setProperty('--c', s.color);
        element.style.setProperty('--level', (s.brightness / 255).toFixed(2));
        element.style.setProperty('--speed', `${speed[0] + speed[1]}ms`);
        element.title = `${ledLabel(led)}: ${s.color.toUpperCase()}, ${Math.round(s.brightness / 2.55)} %`;
    }

    function renderGeneral() {
        const values = state.order.map(led => state.leds[led]?.brightness || 0);
        const max = Math.max(0, ...values);

        q('#ulc-enabled').checked = max > 0;

        if (!state.dragging && max > 0) {
            const percent = Math.round(max / 2.55);
            const slider = q('#ulc-brightness');

            slider.value = percent;
            setRangeFill(slider);
            q('#ulc-brightness-value').textContent = `${percent}%`;
        }
    }

    /* LED colours card */

    function colorRows() {
        if (state.tab === 'bays') {
            return disks().map(led => ({
                key: led,
                label: ledLabel(led),
                icon: 'drives',
                leds: [led],
                def: DEFAULTS.disk
            }));
        }

        return [
            { key: 'power', label: 'Power LED', icon: 'power', leds: ['power'], def: DEFAULTS.power },
            { key: 'netdev', label: 'Netzwerk LED', icon: 'network', leds: ['netdev'], def: DEFAULTS.netdev },
            { key: 'disks', label: 'Laufwerk Aktivität', sub: '(alle Schächte)', icon: 'drives', leds: disks(), def: DEFAULTS.disk },
            { key: 'error', label: 'Laufwerk Fehlermeldung', sub: statusMode() ? '' : '(nur im Statusmodus)', icon: 'alert', leds: [], def: DEFAULTS.error, soon: !statusMode() }
        ].filter(row => row.key === 'error' || row.leds.every(led => state.order.includes(led)));
    }

    const colorInput = (value, disabled = false) => `
        <div class="ulc-color-input">
            <label class="ulc-swatch" style="--c:${value}">
                <input type="color" value="${value}" ${disabled ? 'disabled' : ''} aria-label="Farbe wählen">
            </label>
            <input type="text" value="${value.toUpperCase()}" maxlength="7" spellcheck="false" ${disabled ? 'disabled' : ''} aria-label="Hex-Farbe">
        </div>`;

    function buildColors() {
        const container = q('#ulc-colors');

        container._rows = colorRows();
        container.innerHTML = container._rows.map(row => `
            <div class="ulc-color-row ${row.soon ? 'ulc-disabled' : ''}" data-row="${row.key}">
                ${icon(row.icon)}
                <span>${escapeHtml(row.label)} ${row.sub ? `<small>${escapeHtml(row.sub)}</small>` : ''}</span>
                ${colorInput(row.def, row.soon)}
                <button type="button" class="ulc-icon-btn" data-reset title="Auf Standard zurücksetzen" ${row.soon ? 'disabled' : ''}>${icon('reset')}</button>
            </div>`).join('');

        renderColors();
    }

    function setColorInput(container, value) {
        container.querySelector('.ulc-swatch').style.setProperty('--c', value);
        container.querySelector('input[type="color"]').value = value;
        container.querySelector('input[type="text"]').value = value.toUpperCase();
    }

    function renderColors() {
        const container = q('#ulc-colors');

        for (const row of container._rows || []) {
            const element = container.querySelector(`[data-row="${row.key}"]`);

            if (!element || element.contains(document.activeElement)) continue;

            if (row.key === 'error') {
                setColorInput(element, rgbToHex(state.status.disk_error_color || '255 59 48'));
                continue;
            }

            const led = row.leds[0];
            if (led && state.leds[led]) setColorInput(element, state.leds[led].color);
        }
    }

    /* Effects card */

    function currentEffect(leds) {
        const s = state.leds[leds[0]];

        if (!s) return null;
        if (s.brightness === 0) return 'off';

        return s.effect === 'none' ? 'static' : s.effect;
    }

    function buildEffects() {
        q('#ulc-effects').innerHTML = EFFECTS.map(effect => `
            <button type="button" class="ulc-effect" data-effect="${effect.id}" ${effect.soon ? 'disabled' : ''}>
                ${icon(effect.icon)}
                <strong>${escapeHtml(effect.name)}</strong>
                <small>${effect.soon ? '<em class="ulc-soon">bald</em><br>' : ''}${escapeHtml(effect.text)}</small>
            </button>`).join('');
    }

    function renderEffects() {
        const active = currentEffect(targetLeds(state.target));

        qa('[data-effect]').forEach(button => {
            button.classList.toggle('active', button.dataset.effect === active);
        });
    }

    /* Per-LED tables */

    function buildTable(container, leds) {
        container.innerHTML = leds.map(led => `
            <div class="ulc-led-row" data-led-row="${led}">
                <span class="ulc-led" data-led="${led}"></span>
                <span>${escapeHtml(ledLabel(led))}<small>${led}</small></span>
                ${colorInput('#ffffff')}
                <input type="range" min="0" max="100" step="1" value="0" data-brightness aria-label="Helligkeit">
                <select data-led-effect aria-label="Effekt">
                    <option value="static">Statisch</option>
                    <option value="breath">Atmen</option>
                    <option value="blink">Pulsierend</option>
                    <option value="off">Aus</option>
                </select>
            </div>`).join('');
    }

    function renderTables() {
        qa('[data-led-row]').forEach(row => {
            const led = row.dataset.ledRow;
            const s = state.leds[led];

            if (!s || row.contains(document.activeElement)) return;

            setColorInput(row, s.color);

            const range = row.querySelector('[data-brightness]');
            range.value = Math.round(s.brightness / 2.55);
            setRangeFill(range);

            const effect = row.querySelector('[data-led-effect]');
            effect.value = currentEffect([led]);
            effect.disabled = managed(led);
            effect.title = managed(led) ? 'Im Statusmodus gesteuert' : '';
        });
    }

    function renderMode() {
        const status = statusMode();
        const target = q('#ulc-target');

        q('#ulc-mode').value = status ? 'status' : 'manual';
        q('#ulc-mode-hint').hidden = !status;

        // Effects would fight the daemon on disk and network LEDs.
        [...target.options].forEach(option => {
            option.disabled = status && option.value !== 'power';
        });

        if (status && state.target !== 'power') {
            state.target = 'power';
            target.value = 'power';
        }

        const container = q('#ulc-colors');
        const errorRow = (container._rows || []).find(row => row.key === 'error');

        if (errorRow && errorRow.soon === status) buildColors();

        renderEffects();
        renderTables();
    }

    const STATUS_TEXT = {
        DISK_OK: 'OK',
        DISK_NP: 'nicht zugewiesen',
        DISK_INVALID: 'ungültig',
        DISK_DSBL: 'deaktiviert',
        DISK_DSBL_NEW: 'deaktiviert (neu)',
        DISK_WRONG: 'falsche Platte',
        DISK_NP_MISSING: 'fehlt',
        DISK_NEW: 'neu'
    };

    function renderBays() {
        const container = q('#ulc-bays');

        if (!state.bayInfo.length) {
            container.innerHTML = '<p class="ulc-muted">Keine Zuordnung verfügbar.</p>';
            return;
        }

        container.innerHTML = state.bayInfo.map(bay => {
            const kind = !bay.device ? 'empty' : bay.error ? 'error' : '';
            const text = !bay.device ? 'leer'
                : bay.status ? (STATUS_TEXT[bay.status] || bay.status)
                    : 'außerhalb von Unraid';

            return `
                <div class="ulc-bay-card ${kind}">
                    <strong><span class="ulc-led" data-led="${escapeHtml(bay.led)}"></span>Schacht ${bay.bay}</strong>
                    <small>${bay.device ? `/dev/${escapeHtml(bay.device)}${bay.slot ? ` · ${escapeHtml(bay.slot)}` : ''}` : 'Keine Platte erkannt'}</small>
                    ${bay.serial ? `<small>${escapeHtml(bay.serial)}</small>` : ''}
                    <span class="ulc-state ${kind}">${escapeHtml(text)}</span>
                </div>`;
        }).join('');

        container.querySelectorAll('.ulc-led[data-led]').forEach(element => paintLed(element, element.dataset.led));
    }

    async function setMode(mode) {
        await run(
            () => api({ action: 'mode', value: mode }, true),
            mode === 'status' ? 'Statusmodus aktiv' : 'Manueller Modus aktiv'
        );

        await loadStatus();
    }

    function applyErrorColor(hex) {
        const value = normalizeHex(hex);

        if (!value) {
            toast('Bitte eine Farbe im Format #RRGGBB angeben.', 'error');
            renderColors();
            return;
        }

        state.status.disk_error_color = Object.values(hexToRgb(value)).join(' ');

        return run(
            () => api({ action: 'error_color', ...hexToRgb(value) }, true),
            'Fehlerfarbe gespeichert'
        );
    }

    /*
     * ---------------------------------------------------------
     * Actions
     * ---------------------------------------------------------
     */

    // Show a change in the preview right away; the next refresh confirms it.
    function preview(leds, change) {
        for (const led of leds) {
            if (state.leds[led]) Object.assign(state.leds[led], change);
        }

        qa('.ulc-led[data-led]').forEach(element => paintLed(element, element.dataset.led));
    }

    const globalLevel = () => levelFromPercent(Number(q('#ulc-brightness').value) || DEFAULTS.brightness);

    function applyColor(leds, hex) {
        const value = normalizeHex(hex);

        if (!value) {
            toast('Bitte eine Farbe im Format #RRGGBB angeben.', 'error');
            renderColors();
            return;
        }

        preview(leds, { color: value });

        return run(
            () => write(leds, 'color', hexToRgb(value)),
            'Farbe übernommen'
        );
    }

    async function setEffect(leds, effect) {
        const speed = SPEEDS[state.speed];
        const dark = leds.filter(led => (state.leds[led]?.brightness || 0) === 0);

        if (effect === 'off') {
            await write(leds, 'off');
            return;
        }

        // breath/blink and "static" need a lit LED to be visible.
        if (dark.length) {
            await write(dark, 'brightness', { value: globalLevel() });
        }

        if (effect === 'static') {
            await write(leds, 'stop');
        } else {
            const [on, off] = speed[effect];
            await write(leds, effect, { on, off });
        }
    }

    function applyEffect(leds, effect) {
        const name = EFFECTS.find(e => e.id === effect)?.name || effect;

        preview(leds, effect === 'off'
            ? { brightness: 0 }
            : { effect: effect === 'static' ? 'none' : effect });

        return run(() => setEffect(leds, effect), `Effekt: ${name}`);
    }

    function applyBrightness(leds, percent) {
        const value = levelFromPercent(percent);

        preview(leds, { brightness: value });

        return run(
            () => write(leds, 'brightness', { value }),
            `Helligkeit: ${percent} %`
        );
    }

    async function testLeds() {
        const button = q('#ulc-test');
        const before = JSON.parse(JSON.stringify(state.leds));
        const leds = state.order.filter(led => before[led]?.brightness > 0);

        if (!leds.length) {
            toast('Alle LEDs sind aus – erst einschalten, dann testen.', 'error');
            return;
        }

        button.disabled = true;

        await run(async () => {
            await write(leds, 'blink', { on: 150, off: 150 });
            preview(leds, { effect: 'blink' });
            await sleep(3000);

            // Put every LED back to the effect it had before.
            const groups = { none: [], breath: [], blink: [] };
            leds.forEach(led => (groups[before[led].effect] || groups.none).push(led));

            await write(groups.none, 'stop');

            for (const effect of ['breath', 'blink']) {
                const [on, off] = SPEEDS[state.speed][effect];
                await write(groups[effect], effect, { on, off });
            }
        }, 'Test abgeschlossen');

        button.disabled = false;
    }

    function resetDefaults() {
        if (!window.confirm('Alle LEDs auf die Standardfarben, 80 % Helligkeit und „Statisch“ zurücksetzen?')) {
            return;
        }

        return run(async () => {
            const colors = [
                [['power'], DEFAULTS.power],
                [['netdev'], DEFAULTS.netdev],
                [disks(), DEFAULTS.disk]
            ];

            for (const [leds, hex] of colors) {
                await write(leds.filter(led => state.order.includes(led)), 'color', hexToRgb(hex));
            }

            await write(state.order, 'stop');
            await write(state.order, 'brightness', { value: levelFromPercent(DEFAULTS.brightness) });
        }, 'Standard wiederhergestellt');
    }

    /*
     * ---------------------------------------------------------
     * Navigation
     * ---------------------------------------------------------
     */

    // The effects view shows the same two cards as the overview.
    function showView(view) {
        qa('[data-nav]').forEach(button => button.classList.toggle('active', button.dataset.nav === view));
        qa('.ulc-view').forEach(section => section.classList.toggle('active', section.dataset.view === view));

        const inEffects = view === 'effects';

        q(inEffects ? '[data-slot="effects-view"]' : '[data-slot="effects-home"]').append(q('#ulc-effects-card'));
        q(inEffects ? '[data-slot="settings-view"]' : '[data-slot="settings-home"]').append(q('#ulc-settings-card'));
    }

    /*
     * ---------------------------------------------------------
     * Events
     * ---------------------------------------------------------
     */

    function bindColorInputs(container, applyFor) {
        container.addEventListener('input', event => {
            if (event.target.type !== 'color') return;
            event.target.closest('.ulc-swatch').style.setProperty('--c', event.target.value);
            event.target.closest('.ulc-color-input').querySelector('input[type="text"]').value = event.target.value.toUpperCase();
        });

        container.addEventListener('change', event => {
            const input = event.target;

            if (input.type !== 'color' && input.type !== 'text') return;
            if (!input.closest('.ulc-color-input')) return;

            applyFor(input, input.value);
        });
    }

    function bindEvents() {
        qa('[data-ulc-icon]').forEach(element => {
            element.innerHTML = icon(element.dataset.ulcIcon);
        });

        qa('[data-nav]').forEach(button => {
            button.addEventListener('click', () => showView(button.dataset.nav));
        });

        /* General */

        q('#ulc-enabled').addEventListener('change', event => {
            const on = event.target.checked;

            if (on) {
                applyBrightness(state.order, Number(q('#ulc-brightness').value) || DEFAULTS.brightness);
            } else {
                preview(state.order, { brightness: 0 });
                run(() => write(state.order, 'off'), 'Alle LEDs ausgeschaltet');
            }
        });

        const brightness = q('#ulc-brightness');

        brightness.addEventListener('input', () => {
            state.dragging = true;
            setRangeFill(brightness);
            q('#ulc-brightness-value').textContent = `${brightness.value}%`;
        });

        brightness.addEventListener('change', async () => {
            await applyBrightness(state.order, Number(brightness.value));
            state.dragging = false;
        });

        q('#ulc-mode').addEventListener('change', event => setMode(event.target.value));

        /* Colours */

        qa('[data-tab]').forEach(button => {
            button.addEventListener('click', () => {
                state.tab = button.dataset.tab;
                qa('[data-tab]').forEach(tab => tab.classList.toggle('active', tab === button));
                buildColors();
            });
        });

        const colors = q('#ulc-colors');

        const applyRow = (key, value) => {
            const row = colors._rows.find(r => r.key === key);

            if (!row || row.soon) return;
            if (key === 'error') return applyErrorColor(value);
            if (row.leds.length) return applyColor(row.leds, value);
        };

        bindColorInputs(colors, (input, value) => applyRow(input.closest('[data-row]').dataset.row, value));

        colors.addEventListener('click', event => {
            const button = event.target.closest('[data-reset]');
            if (!button || button.disabled) return;

            const key = button.closest('[data-row]').dataset.row;
            const row = colors._rows.find(r => r.key === key);
            if (row) applyRow(key, row.def);
        });

        /* Effects */

        q('#ulc-effects').addEventListener('click', event => {
            const button = event.target.closest('[data-effect]');
            if (!button || button.disabled) return;

            applyEffect(targetLeds(state.target), button.dataset.effect);
        });

        q('#ulc-target').addEventListener('change', event => {
            state.target = event.target.value;
            renderEffects();
        });

        const speed = q('#ulc-speed');

        speed.addEventListener('input', () => {
            setRangeFill(speed);
            q('#ulc-speed-value').textContent = SPEEDS[speed.value].label;
        });

        speed.addEventListener('change', () => {
            state.speed = Number(speed.value);

            try {
                localStorage.setItem('ulc-speed', speed.value);
            } catch (error) {
                // Storage may be blocked; the speed then just isn't remembered.
            }

            const leds = targetLeds(state.target);
            const effect = currentEffect(leds);

            if (effect === 'breath' || effect === 'blink') {
                applyEffect(leds, effect);
            } else {
                render();
            }
        });

        /* Preview */

        q('#ulc-test').addEventListener('click', testLeds);
        q('#ulc-reset').addEventListener('click', resetDefaults);

        /* Per-LED tables */

        for (const table of [q('#ulc-led-table'), q('#ulc-bay-table')]) {
            bindColorInputs(table, (input, value) => applyColor([input.closest('[data-led-row]').dataset.ledRow], value));

            table.addEventListener('input', event => {
                if (event.target.matches('[data-brightness]')) setRangeFill(event.target);
            });

            table.addEventListener('change', event => {
                const row = event.target.closest('[data-led-row]');
                if (!row) return;

                const led = row.dataset.ledRow;

                if (event.target.matches('[data-brightness]')) {
                    applyBrightness([led], Number(event.target.value));
                } else if (event.target.matches('[data-led-effect]')) {
                    applyEffect([led], event.target.value);
                }
            });
        }
    }

    /*
     * ---------------------------------------------------------
     * Init
     * ---------------------------------------------------------
     */

    async function init() {
        try {
            const saved = localStorage.getItem('ulc-speed');
            if (saved !== null && SPEEDS[Number(saved)]) state.speed = Number(saved);
        } catch (error) {
            // No storage: keep the default speed.
        }

        const speed = q('#ulc-speed');
        speed.value = state.speed;
        q('#ulc-speed-value').textContent = SPEEDS[state.speed].label;

        qa('input[type="range"]').forEach(setRangeFill);

        buildEffects();
        bindEvents();

        await loadStatus();
        await refresh();

        setInterval(() => {
            if (!document.hidden && !state.busy && !state.dragging) refresh();
        }, 4000);

        setInterval(() => {
            if (!document.hidden) loadStatus();
        }, 30000);
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();
