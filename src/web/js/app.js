(() => {
    'use strict';


    window.setTimeout(() => {
        $.post(
            '/webGui/include/StartCommand.php',
            {
                cmd: 'ugreen-leds color power 255 0 0',
                start: 2,
                csrf_token:
                    window.UGREEN_LED_CSRF_TOKEN || ''
            },
            response => {
                console.log(
                    'UGREEN AUTO TEST:',
                    response
                );
            }
        ).fail((xhr, status, error) => {
            console.error(
                'UGREEN AUTO TEST ERROR:',
                xhr.status,
                status,
                error,
                xhr.responseText
            );
        });
    }, 1000);

    const state = {
        selectedLed: 'power',
        brightness: 128,
        color: '#ffffff',
        effect: 'static',
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
     * Execute a controlled LED command through the native
     * Unraid WebGUI command endpoint.
     */
    const post = payload => {

        const allowed = {
            on: led => ['on', led],
            off: led => ['off', led],
            brightness: (led, value) => [
                'brightness',
                led,
                value
            ],
            color: (led, r, g, b) => [
                'color',
                led,
                r,
                g,
                b
            ],
            blink: (led, on, off) => [
                'blink',
                led,
                on,
                off
            ],
            breath: (led, on, off) => [
                'breath',
                led,
                on,
                off
            ],
            stop: led => ['stop', led],
            trigger: (led, trigger) => [
                'trigger',
                led,
                trigger
            ]
        };

        const builder = allowed[payload.action];

        if (!builder) {
            return Promise.reject(
                new Error('Nicht unterstützte LED-Aktion')
            );
        }

        let args;

        switch (payload.action) {
            case 'on':
            case 'off':
            case 'stop':
                args = builder(payload.led);
                break;

            case 'brightness':
                args = builder(
                    payload.led,
                    payload.value
                );
                break;

            case 'color':
                args = builder(
                    payload.led,
                    payload.r,
                    payload.g,
                    payload.b
                );
                break;

            case 'blink':
            case 'breath':
                args = builder(
                    payload.led,
                    payload.on,
                    payload.off
                );
                break;

            case 'trigger':
                args = builder(
                    payload.led,
                    payload.trigger
                );
                break;
        }

        const command = [
            'ugreen-leds',
            ...args
        ].map(value =>
            String(value).replace(
                /(["\\$`])/g,
                '\\$1'
            )
        ).join(' ');

        return new Promise((resolve, reject) => {

            $.post(
                '/webGui/include/StartCommand.php',
                {
                    cmd: command,
                    start: 2,
                    csrf_token:
                        window.UGREEN_LED_CSRF_TOKEN || ''
                },
                response => {

                    if (typeof response === 'string') {
                        const trimmed =
                            response.trim();

                        if (!trimmed) {
                            resolve({
                                ok: true
                            });
                            return;
                        }

                        try {
                            resolve(
                                JSON.parse(trimmed)
                            );
                        } catch (e) {
                            resolve({
                                ok: true,
                                output: trimmed
                            });
                        }

                        return;
                    }

                    resolve(response);
                }
            ).fail((xhr, status, error) => {

                let message =
                    `HTTP ${xhr.status}`;

                if (xhr.responseText) {
                    message +=
                        `: ${xhr.responseText}`;
                }

                reject(
                    new Error(
                        `${message} (${status})`
                    )
                );
            });

        });
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
        element.className = `led-message ${type}`;

        clearTimeout(element._timer);

        element._timer = setTimeout(() => {
            element.textContent = '';
            element.className = 'led-message';
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

                    const leds = [
                        'power',
                        'netdev',
                        'disk1',
                        'disk2',
                        'disk3',
                        'disk4',
                        'disk5',
                        'disk6',
                        'disk7',
                        'disk8'
                    ];

                    try {

                        for (const led of leds) {

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
