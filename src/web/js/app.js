(() => {
    'use strict';


    const state = {
        selectedLed: 'power',
        brightness: 128,
        color: '#ffffff',
        effect: 'static',
        leds: [],
        writeInProgress: false,
        colorTimer: null,
        pollTimer: null
    };

    const $ = selector => document.querySelector(selector);

    /*
     * ---------------------------------------------------------
     * API
     * ---------------------------------------------------------
     */

    const api = async (url, options = {}) => {

        const response = await fetch(url, {
            credentials: 'same-origin',
            ...options
        });

        const text = await response.text();

        let data;

        try {
            data = JSON.parse(text);
        } catch (error) {
            throw new Error(
                `Ungültige API-Antwort (HTTP ${response.status})`
            );
        }

        if (!response.ok || data.ok === false) {
            throw new Error(
                data.error ||
                `API-Fehler (HTTP ${response.status})`
            );
        }

        return data;
    };

    /*
     * Send an LED command to api.php. Unraid rejects POSTs
     * without the WebGUI csrf_token before api.php runs.
     */
    const post = payload => {

        const body = new URLSearchParams({
            ...payload,
            csrf_token: window.UGREEN_LED_CSRF_TOKEN || ''
        });

        return api(
            '/plugins/ugreen-led-control/api.php',
            {
                method: 'POST',
                body
            }
        );
    };

    function hexToRgb(hex) {

        const value = hex.replace('#', '');

        return {
            r: parseInt(value.substring(0, 2), 16),
            g: parseInt(value.substring(2, 4), 16),
            b: parseInt(value.substring(4, 6), 16)
        };
    }

    function rgbToHex(value) {

        const parts = value
            .trim()
            .split(/\s+/)
            .map(Number);

        if (parts.length < 3) {
            return '#ffffff';
        }

        return '#' + parts
            .slice(0, 3)
            .map(value =>
                Math.max(0, Math.min(255, value))
                    .toString(16)
                    .padStart(2, '0')
            )
            .join('');
    }

    function setMessage(message, type = 'info') {

        const element = $('#led-message');

        if (!element) return;

        element.textContent = message;
        element.className = `message ${type}`;

        if (type === 'error') console.error('[UGREEN LED]', message);

        clearTimeout(element._timer);

        element._timer = setTimeout(() => {
            element.textContent = '';
            element.className = 'message';
        }, 3000);
    }

    function updateColorPreview(color) {

        const preview = $('#color-preview');

        if (!preview) return;

        preview.style.background = color;
        preview.style.boxShadow = `0 0 35px ${color}99`;
    }

    /*
     * ---------------------------------------------------------
     * Status
     * ---------------------------------------------------------
     */

    function renderStatus(data) {

        const online = $('#connection-status');

        if (online) {

            online.innerHTML =
                '<span class="status-dot"></span> Online';

            online.classList.add('online');
        }

        const controller = $('#controller-status');

        if (controller) {
            controller.textContent =
                data.controller || '—';
        }

        const address = $('#controller-address');

        if (address) {

            address.textContent =
                `${data.model || 'UGREEN'} · ` +
                `I²C ${data.i2c_address || '—'}`;
        }
    }

    async function loadStatus() {

        if (state.writeInProgress) return;

        try {

            const data = await api(
                '/plugins/ugreen-led-control/api.php?action=status'
            );

            state.leds = Array.isArray(data.leds) ? data.leds : [];

            renderStatus(data);

        } catch (error) {

            const online = $('#connection-status');

            if (online) {

                online.innerHTML =
                    '<span class="status-dot offline"></span> Offline';

                online.classList.remove('online');
            }
        }
    }

    async function loadLed(led) {

        if (state.writeInProgress) return;

        try {

            const data = await api(
                `/plugins/ugreen-led-control/api.php?action=led&led=${encodeURIComponent(led)}`
            );

            state.selectedLed = led;
            state.brightness = Number(data.brightness) || 0;
            state.color = rgbToHex(
                data.color || '255 255 255'
            );

            const brightness = $('#brightness');

            if (brightness) {
                brightness.value = state.brightness;
            }

            const brightnessValue =
                $('#brightness-value');

            if (brightnessValue) {

                brightnessValue.textContent =
                    `${Math.round(
                        state.brightness / 255 * 100
                    )} %`;
            }

            const color = $('#color');

            if (color) {
                color.value = state.color;
            }

            updateColorPreview(state.color);

            state.effect =
                data.effect === 'none' ? 'static' : data.effect;

            document
                .querySelectorAll('[data-effect]')
                .forEach(button => {

                    button.classList.toggle(
                        'active',
                        button.dataset.effect === state.effect
                    );
                });

            document
                .querySelectorAll('.led-card')
                .forEach(card => {

                    card.classList.toggle(
                        'active',
                        card.dataset.led === led
                    );
                });

        } catch (error) {

            setMessage(
                `LED konnte nicht geladen werden: ${error.message}`,
                'error'
            );
        }
    }

    /*
     * ---------------------------------------------------------
     * LED Visual
     * ---------------------------------------------------------
     */

    function updateLedVisual(led, data) {

        const element = document.querySelector(
            `.nas-led[data-led="${led}"]`
        );

        if (!element) return;

        element.style.setProperty(
            '--led-color',
            rgbToHex(
                data.color || '255 255 255'
            )
        );

        const brightness =
            Number(data.brightness || 0) / 255;

        element.style.setProperty(
            '--led-opacity',
            Math.max(0.08, brightness)
        );
    }

    /*
     * ---------------------------------------------------------
     * WRITE LOCK
     * ---------------------------------------------------------
     */

    async function executeWrite(callback) {

        if (state.writeInProgress) {
            return;
        }

        state.writeInProgress = true;

        try {

            await callback();

        } finally {

            state.writeInProgress = false;
        }

        /*
         * Read the actual hardware state after the write.
         */
        await loadLed(state.selectedLed);
    }

    /*
     * ---------------------------------------------------------
     * Brightness
     * ---------------------------------------------------------
     */

    async function changeBrightness(value) {

        const brightness = Number(value);

        state.brightness = brightness;

        $('#brightness-value').textContent =
            `${Math.round(
                brightness / 255 * 100
            )} %`;

        await executeWrite(async () => {

            try {

                await post({
                    action: 'brightness',
                    led: state.selectedLed,
                    value: brightness
                });

                setMessage(
                    'Helligkeit übernommen',
                    'success'
                );

            } catch (error) {

                setMessage(
                    `Helligkeit: ${error.message}`,
                    'error'
                );
            }
        });
    }

    /*
     * ---------------------------------------------------------
     * Color
     * ---------------------------------------------------------
     */

    async function changeColor(value) {

        state.color = value;

        updateColorPreview(value);


        const rgb = hexToRgb(value);

        try {

            const result = await post({
                action: 'color',
                led: state.selectedLed,
                r: rgb.r,
                g: rgb.g,
                b: rgb.b
            });

            setMessage(
                'Farbe übernommen',
                'success'
            );

            /*
             * Update the selected LED from the real hardware.
             */
            const data = await api(
                `/plugins/ugreen-led-control/api.php?action=led&led=${encodeURIComponent(state.selectedLed)}`
            );

            state.color = rgbToHex(
                data.color || '255 255 255'
            );

            updateColorPreview(state.color);

        } catch (error) {

            setMessage(
                `Farbe: ${error.message}`,
                'error'
            );
        }
    }


    /*
     * ---------------------------------------------------------
     * Effects
     * ---------------------------------------------------------
     */

    async function setEffect(effect) {

        await executeWrite(async () => {

            try {

                if (effect === 'static') {

                    await post({
                        action: 'stop',
                        led: state.selectedLed
                    });

                    await post({
                        action: 'brightness',
                        led: state.selectedLed,
                        value: state.brightness
                    });

                } else if (effect === 'blink') {

                    await post({
                        action: 'blink',
                        led: state.selectedLed,
                        on: 500,
                        off: 500
                    });

                } else if (effect === 'breath') {

                    await post({
                        action: 'breath',
                        led: state.selectedLed,
                        on: 1000,
                        off: 500
                    });
                }

                state.effect = effect;

                setMessage(
                    `Effekt: ${effect}`,
                    'success'
                );

            } catch (error) {

                setMessage(
                    `Effekt: ${error.message}`,
                    'error'
                );
            }
        });
    }

    /*
     * ---------------------------------------------------------
     * Navigation
     * ---------------------------------------------------------
     */

    function selectNavigation() {

        document
            .querySelectorAll('.sidebar-item')
            .forEach(item => {

                item.addEventListener(
                    'click',
                    event => {

                        event.preventDefault();

                        document
                            .querySelectorAll('.sidebar-item')
                            .forEach(x =>
                                x.classList.remove('active')
                            );

                        item.classList.add('active');

                        const target =
                            item.dataset.section;

                        document
                            .querySelectorAll('.content-section')
                            .forEach(section => {

                                section.classList.toggle(
                                    'active',
                                    section.dataset.section === target
                                );
                            });
                    }
                );
            });
    }

    /*
     * ---------------------------------------------------------
     * Events
     * ---------------------------------------------------------
     */

    function bindEvents() {

        document
            .querySelectorAll('.led-card')
            .forEach(card => {

                card.addEventListener(
                    'click',
                    () => loadLed(card.dataset.led)
                );
            });

        $('#brightness').addEventListener(
            'change',
            event =>
                changeBrightness(event.target.value)
        );

        $('#color').addEventListener(
            'change',
            event =>
                changeColor(event.target.value)
        );

        document
            .querySelectorAll('[data-effect]')
            .forEach(button => {

                button.addEventListener(
                    'click',
                    async () => {

                        document
                            .querySelectorAll('[data-effect]')
                            .forEach(x =>
                                x.classList.remove('active')
                            );

                        button.classList.add('active');

                        await setEffect(
                            button.dataset.effect
                        );
                    }
                );
            });

        $('#all-off').addEventListener(
            'click',
            async () => {

                await executeWrite(async () => {

                    try {

                        for (const led of state.leds) {

                            await post({
                                action: 'off',
                                led
                            });
                        }

                        setMessage(
                            'Alle LEDs ausgeschaltet',
                            'success'
                        );

                    } catch (error) {

                        setMessage(
                            `Fehler: ${error.message}`,
                            'error'
                        );
                    }
                });
            }
        );
    }

    /*
     * ---------------------------------------------------------
     * Polling
     * ---------------------------------------------------------
     */

    function startPolling() {

        clearInterval(state.pollTimer);

        state.pollTimer = setInterval(
            async () => {

                if (state.writeInProgress) {
                    return;
                }

                await loadStatus();

            },
            5000
        );
    }

    /*
     * ---------------------------------------------------------
     * Init
     * ---------------------------------------------------------
     */

    async function init() {

        selectNavigation();
        bindEvents();

        await loadStatus();
        await loadLed(state.selectedLed);

        startPolling();
    }

    document.addEventListener(
        'DOMContentLoaded',
        init
    );

})();
