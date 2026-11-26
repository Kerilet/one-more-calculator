const {
    createApp,
    ref,
    computed,
    watch,
    nextTick,
    onMounted,
    onUnmounted
} = Vue;

createApp({
    setup() {
        const stack = ref([]);
        const display = ref('0');
        const result = ref(0);
        const operator = ref(null);
        const firstOperand = ref(null);
        const waitingForOperand = ref(false);
        const justEvaluated = ref(false);
        const error = ref('');
        const videoModalStart = ref(null);
        const videoModalVideoId = ref(null);
        const playerOrigin = window.location.origin === 'null'
            ? ''
            : `&origin=${encodeURIComponent(window.location.origin)}`;
        const videoModalUrl = computed(() => videoModalStart.value === null || videoModalVideoId.value === null
            ? ''
            : `https://www.youtube-nocookie.com/embed/${videoModalVideoId.value}?start=${videoModalStart.value}&autoplay=1&rel=0&enablejsapi=1${playerOrigin}`);
        let typedLetters = '';
        let youtubeApiPromise;
        let videoPlayer;

        function loadYouTubeApi() {
            if (window.YT && window.YT.Player) {
                return Promise.resolve(window.YT);
            }

            if (!youtubeApiPromise) {
                youtubeApiPromise = new Promise((resolve, reject) => {
                    const previousCallback = window.onYouTubeIframeAPIReady;
                    window.onYouTubeIframeAPIReady = () => {
                        resolve(window.YT);
                        if (typeof previousCallback === 'function') {
                            previousCallback();
                        }
                    };

                    const script = document.createElement('script');
                    script.src = 'https://www.youtube.com/iframe_api';
                    script.async = true;
                    script.onerror = () => {
                        youtubeApiPromise = null;
                        reject(new Error('Unable to load the YouTube IFrame API.'));
                    };
                    document.head.appendChild(script);
                });
            }

            return youtubeApiPromise;
        }

        function destroyVideoPlayer() {
            if (videoPlayer) {
                videoPlayer.destroy();
                videoPlayer = null;
            }
        }

        watch(videoModalUrl, async (url) => {
            if (!url) {
                destroyVideoPlayer();
                return;
            }

            await nextTick();
            try {
                const YT = await loadYouTubeApi();
                if (videoModalUrl.value !== url) return;

                destroyVideoPlayer();
                videoPlayer = new YT.Player('video-player', {
                    events: {
                        onStateChange(event) {
                            if (event.data === YT.PlayerState.ENDED && videoModalUrl.value === url) {
                                closeVideoModal();
                            }
                        }
                    }
                });
            } catch (error) {
                console.error('Unable to detect when the YouTube video ends.', error);
            }
        });

        function buttonCreation() {
            return [7, 8, 9, '/', 4, 5, 6, '*', 1, 2, 3, '-', 0, '.', '=', '+'];
        }

        function buttonPress(value) {
            if (typeof value === 'number') {
                inputDigit(String(value));
            } else if (value === '.') {
                inputDecimal();
            } else if (['+', '-', '*', '/'].includes(value)) {
                chooseOperator(value);
            } else if (value === '=') {
                compute();
            }
        }

        function inputDigit(digit) {
            error.value = '';
            if (waitingForOperand.value || justEvaluated.value) {
                display.value = digit;
                waitingForOperand.value = false;
                justEvaluated.value = false;
            } else {
                display.value = display.value === '0' ? digit : display.value + digit;
            }
            stack.value = [display.value];
        }

        function inputDecimal() {
            error.value = '';
            if (waitingForOperand.value || justEvaluated.value) {
                display.value = '0.';
                waitingForOperand.value = false;
                justEvaluated.value = false;
            } else if (!display.value.includes('.')) {
                display.value += '.';
            }
            stack.value = [display.value];
        }

        function chooseOperator(nextOperator) {
            error.value = '';
            const inputValue = Number(display.value);

            if (operator.value && waitingForOperand.value) {
                operator.value = nextOperator;
                stack.value = [firstOperand.value, nextOperator];
                return;
            }

            if (firstOperand.value === null) {
                firstOperand.value = inputValue;
            } else if (operator.value) {
                const calculated = calculate(firstOperand.value, inputValue, operator.value);
                if (calculated === null) return;
                firstOperand.value = calculated;
                display.value = formatNumber(calculated);
            }

            operator.value = nextOperator;
            waitingForOperand.value = true;
            justEvaluated.value = false;
            result.value = firstOperand.value;
            stack.value = [firstOperand.value, nextOperator];
        }

        function calculate(left, right, operation) {
            if (operation === '+') return left + right;
            if (operation === '-') return left - right;
            if (operation === '*') return left * right;
            if (operation === '/') {
                if (right === 0) {
                    error.value = 'Cannot divide by zero';
                    openVideoModal('LqYkRphJFvo', 53);
                    return null;
                }
                return left / right;
            }
            return right;
        }

        function formatNumber(value) {
            if (!Number.isFinite(value)) {
                error.value = 'Result is out of range';
                return '0';
            }
            return String(Number.parseFloat(value.toPrecision(12)));
        }

        async function compute() {
            if (operator.value === null || firstOperand.value === null) return;

            const calculated = calculate(firstOperand.value, Number(display.value), operator.value);
            if (calculated === null) {
                stack.value = [];
                operator.value = null;
                firstOperand.value = null;
                waitingForOperand.value = false;
                return;
            }

            const expression = `${formatNumber(firstOperand.value)} ${operator.value} ${display.value}`;
            display.value = formatNumber(calculated);
            result.value = calculated;
            stack.value = [expression, '=', display.value];
            operator.value = null;
            firstOperand.value = null;
            waitingForOperand.value = false;
            justEvaluated.value = true;
        }

        function openVideoModal(videoId, start) {
            videoModalVideoId.value = videoId;
            videoModalStart.value = start;
        }

        function closeVideoModal() {
            videoModalStart.value = null;
            videoModalVideoId.value = null;
        }

        function clear() {
            stack.value = [];
            result.value = 0;
            display.value = '0';
            operator.value = null;
            firstOperand.value = null;
            waitingForOperand.value = false;
            justEvaluated.value = false;
            error.value = '';
            closeVideoModal();
            typedLetters = '';
        }

        function backspace() {
            if (waitingForOperand.value || justEvaluated.value) return;
            display.value = display.value.length > 1
                ? display.value.slice(0, -1)
                : '0';
            stack.value = [display.value];
        }

        function handleKeydown(event) {
            if (event.key === 'Escape') {
                if (videoModalStart.value !== null) {
                    closeVideoModal();
                } else {
                    clear();
                }
                return;
            }

            if (videoModalStart.value !== null) return;

            if (/^[a-z]$/i.test(event.key)) {
                typedLetters = (typedLetters + event.key).slice(-5);
                if (typedLetters.toLowerCase() === 'troll') {
                    openVideoModal('YeAp15OmW2s', 92);
                    typedLetters = '';
                }
            } else {
                typedLetters = '';
            }

            if (/^[0-9]$/.test(event.key)) {
                inputDigit(event.key);
            } else if (event.key === '.') {
                inputDecimal();
            } else if (['+', '-', '*', '/'].includes(event.key)) {
                chooseOperator(event.key);
            } else if (event.key === 'Enter' || event.key === '=') {
                event.preventDefault();
                compute();
            } else if (event.key === 'Backspace') {
                backspace();
            }
        }

        onMounted(() => window.addEventListener('keydown', handleKeydown));
        onUnmounted(() => {
            window.removeEventListener('keydown', handleKeydown);
            destroyVideoPlayer();
        });

        return {
            stack,
            display,
            result,
            buttonCreation,
            buttonPress,
            clear,
            backspace,
            compute,
            error,
            videoModalStart,
            videoModalUrl,
            closeVideoModal
        }
    }
}).mount('#app')