// Dashboard tile: the case picture with live LED colours and each bay's
// temperature or state, plus mode / night / alert in the tile header.
(() => {
    'use strict';

    const API = '/plugins/ugreen-led-control/api.php';
    const LANG = ['de', 'en', 'es'].includes(window.UGREEN_LED_LANG) ? window.UGREEN_LED_LANG : 'en';
    const TEXTS = window.ULC_I18N || { de: {}, en: {}, es: {} };

    const t = (key, vars = {}) => String(TEXTS[LANG]?.[key] ?? TEXTS.en[key] ?? TEXTS.de[key] ?? key)
        .replace(/\{(\w+)\}/g, (_, name) => String(vars[name] ?? ''));

    // "auto" follows Unraid: light when the page behind the plugin is light.
    function resolveTheme(setting) {
        if (setting === 'light' || setting === 'dark') return setting;

        for (let el = document.body; el; el = el.parentElement) {
            const match = getComputedStyle(el).backgroundColor.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)(?:,\s*([\d.]+))?/);
            if (match && (match[4] === undefined || Number(match[4]) > 0.5)) {
                const [r, g, b] = [match[1], match[2], match[3]].map(Number);
                return (0.299 * r + 0.587 * g + 0.114 * b) > 140 ? 'light' : 'dark';
            }
        }
        return 'dark';
    }

    const state = { status: {}, leds: {}, bays: [], layout: '' };

    async function get(action) {
        const response = await fetch(`${API}?action=${action}`, { credentials: 'same-origin' });
        const data = await response.json();

        if (!response.ok || data.ok === false) throw new Error(data.error || `HTTP ${response.status}`);
        return data;
    }

    function rgbToHex(value) {
        const parts = String(value).trim().split(/\s+/).map(Number);
        if (parts.length < 3 || parts.some(Number.isNaN)) return '#ffffff';
        return '#' + parts.slice(0, 3).map(n => Math.max(0, Math.min(255, n)).toString(16).padStart(2, '0')).join('');
    }

    const disks = () => (state.status.leds || []).filter(led => led.startsWith('disk'));

    function build(nas) {
        const bays = disks();
        const layout = bays.join();

        if (state.layout === layout) return;
        state.layout = layout;

        nas.style.setProperty('--bays', String(bays.length || 1));
        nas.innerHTML =
            '<div class="ulc-nas-bays">' +
            bays.map((led, i) => `
                <div class="ulc-bay">
                    <span class="ulc-bay-no">${String(i + 1).padStart(2, '0')}</span>
                    <span class="ulc-bay-info" data-bay-info="${led}"></span>
                    <span class="ulc-bay-knob"></span>
                    <span class="ulc-led" data-led="${led}"></span>
                </div>`).join('') +
            '</div>' +
            '<div class="ulc-nas-front">' +
            '<span class="ulc-led" data-led="power"></span><span class="ulc-led-label">Power</span>' +
            '<span class="ulc-led" data-led="netdev"></span><span class="ulc-led-label">LAN</span>' +
            '<span class="ulc-nas-brand">UGREEN</span>' +
            '</div>';
    }

    function paintLeds(root) {
        root.querySelectorAll('.ulc-led[data-led]').forEach(element => {
            const s = state.leds[element.dataset.led];
            if (!s) return;

            const brightness = Number(s.brightness) || 0;
            const effect = brightness > 0 ? s.effect : 'none';

            element.classList.toggle('off', brightness === 0);
            element.classList.toggle('fx-breath', effect === 'breath');
            element.classList.toggle('fx-blink', effect === 'blink');
            element.style.setProperty('--c', rgbToHex(s.color));
            element.style.setProperty('--level', (brightness / 255).toFixed(2));
            element.style.setProperty('--speed', `${(Number(s.on_ms) || 1200) + (Number(s.off_ms) || 900)}ms`);
        });
    }

    function paintBays(root) {
        root.querySelectorAll('[data-bay-info]').forEach(element => {
            const bay = state.bays.find(b => b.led === element.dataset.bayInfo);
            let text = '';
            let kind = '';

            if (bay && bay.device) {
                if (bay.error) {
                    text = t('case.error');
                    kind = 'error';
                } else if (bay.smart_warnings) {
                    text = 'SMART';
                    kind = 'warning';
                } else if (bay.standby) {
                    text = t('bays.standby');
                    kind = 'standby';
                } else {
                    text = bay.temp != null ? `${bay.temp}°` : 'OK';
                }
            }

            element.textContent = text;
            element.className = `ulc-bay-info ${kind}`;
            element.title = bay && bay.device
                ? [t('led.bay', { n: bay.bay }), bay.slot, bay.status ? t(`disk.${bay.status}`) : ''].filter(Boolean).join(' · ')
                : '';
        });
    }

    function paintHeader(online) {
        const line = document.getElementById('ulc-dash-state');
        if (!line) return;

        if (!online) {
            line.textContent = t('offline');
            return;
        }

        const parts = [state.status.mode === 'status' ? t('mode.status') : t('mode.manual')];
        if (state.status.night) parts.push(t('head.night'));

        line.innerHTML = '';
        line.append(parts.join(' · '));

        if (state.status.alert_active) {
            const alert = document.createElement('span');
            alert.className = 'ulc-dash-alert';
            alert.textContent = ` · ${t('head.alert')}`;
            line.append(alert);
        }
    }

    async function loadSlow(root) {
        try {
            [state.status, { bays: state.bays }] = await Promise.all([get('status'), get('bays')]);
            build(root.querySelector('[data-nas]'));
            paintHeader(true);
            paintBays(root);
            paintLeds(root);
        } catch (error) {
            paintHeader(false);
        }
    }

    async function loadLeds(root) {
        try {
            state.leds = (await get('all')).leds || {};
            paintLeds(root);
        } catch (error) {
            // The next round tries again; the header shows offline after loadSlow fails.
        }
    }

    async function init() {
        const root = document.getElementById('ulc-dash');
        if (!root) return;

        root.dataset.theme = resolveTheme(window.UGREEN_LED_THEME);
        root.dataset.size = window.UGREEN_LED_DASH_SIZE === 'full' ? 'full' : 'compact';

        const settings = document.getElementById('ulc-dash-settings');
        if (settings) settings.title = t('dash.settings');

        await loadSlow(root);
        await loadLeds(root);

        setInterval(() => { if (!document.hidden) loadLeds(root); }, 10000);
        setInterval(() => { if (!document.hidden) loadSlow(root); }, 30000);
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();
