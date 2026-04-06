/**
 * AI Pokédex - Logic Controller
 * Handles Camera, Gemini API, PokéAPI, and UI Transitions
 */

const PokedexApp = {
    // API Configuration
    GEMINI_API_KEY: localStorage.getItem('pokedex_api_key') || 'AIzaSyAvDcurzevvw2cXK4hLEozVc-1Yq44Zr0I', 
    BASE_URL: 'https://generativelanguage.googleapis.com',
    POKEAPI_URL: 'https://pokeapi.co/api/v2/pokemon/',
    
    // State
    stream: null,
    currentPokemon: null,
    isScanning: false,
    isMuted: false,
    chatHistory: [],

    // Selectors
    elements: {
        video: document.getElementById('camera-feed'),
        canvas: document.getElementById('capture-canvas'),
        scanBtn: document.getElementById('scan-btn'),
        statusOverlay: document.getElementById('status-overlay'),
        statusText: document.getElementById('status-text'),
        progressFill: document.getElementById('progress-fill'),
        resultCard: document.getElementById('result-card'),
        pkName: document.getElementById('pk-name'),
        pkSprite: document.getElementById('pk-sprite'),
        pkTypes: document.getElementById('pk-types'),
        detailOverlay: document.getElementById('detail-overlay'),
        dataView: document.getElementById('data-view'),
        chatView: document.getElementById('chat-view'),
        settingsModal: document.getElementById('settings-modal'),
        apiKeyInput: document.getElementById('api-key-input')
    },

    init() {
        this.setupEventListeners();
        this.startCamera();
        this.elements.apiKeyInput.value = this.GEMINI_API_KEY;
        console.log('Pokédex Initialized');
    },

    setupEventListeners() {
        this.elements.scanBtn.addEventListener('click', () => this.identifyPokemon());
        
        document.getElementById('close-result').addEventListener('click', () => {
            this.elements.resultCard.classList.remove('active');
        });

        document.getElementById('view-details').addEventListener('click', () => {
            this.showDetails();
        });

        document.getElementById('back-to-scan').addEventListener('click', () => {
            this.elements.detailOverlay.classList.remove('active');
        });

        document.getElementById('settings-btn').addEventListener('click', () => {
            this.elements.settingsModal.classList.add('active');
        });

        document.getElementById('close-settings').addEventListener('click', () => {
            this.elements.settingsModal.classList.remove('active');
        });

        document.getElementById('save-settings').addEventListener('click', () => {
            this.GEMINI_API_KEY = this.elements.apiKeyInput.value;
            localStorage.setItem('pokedex_api_key', this.GEMINI_API_KEY);
            this.elements.settingsModal.classList.remove('active');
            alert('Settings Saved!');
        });

        document.getElementById('chat-btn').addEventListener('click', () => {
            this.elements.dataView.style.display = 'none';
            this.elements.chatView.style.display = 'block';
        });

        document.getElementById('send-btn').addEventListener('click', () => this.handleChatInput());
        document.getElementById('chat-input').addEventListener('keypress', (e) => {
            if (e.key === 'Enter') this.handleChatInput();
        });
    },

    async startCamera() {
        try {
            const constraints = {
                video: { facingMode: 'environment' } // Prefer back camera for mobile
            };
            this.stream = await navigator.mediaDevices.getUserMedia(constraints);
            this.elements.video.srcObject = this.stream;
            this.updateStatus('SYSTEM READY', 100);
            setTimeout(() => this.elements.statusOverlay.classList.remove('active'), 1000);
        } catch (err) {
            console.error('Camera Error:', err);
            this.updateStatus('CAMERA ERROR', 0);
            alert('Could not access camera. Please ensure permissions are granted.');
        }
    },

    updateStatus(text, progress) {
        this.elements.statusOverlay.classList.add('active');
        this.elements.statusText.innerText = text;
        this.elements.progressFill.style.width = `${progress}%`;
    },

    async identifyPokemon() {
        if (this.isScanning) return;
        if (!this.GEMINI_API_KEY) {
            alert('Please set your Gemini API Key in settings first.');
            return;
        }

        this.isScanning = true;
        this.updateStatus('ANALYZING VISUAL DATA...', 30);
        this.elements.resultCard.classList.remove('active');

        try {
            // 1. Capture Frame
            const imageData = this.captureFrame();
            
            // 2. Send to Gemini Vision
            const prompt = "Identify the Pokemon in this image. It might be a picture, a toy, a figurine, or a digital screen. Provide ONLY the name of the Pokemon. If not a Pokemon, say 'UNKNOWN'.";
            const pokemonName = await this.callGeminiVision(imageData, prompt);

            if (pokemonName === 'UNKNOWN') {
                this.updateStatus('NO POKEMON DETECTED', 100);
                setTimeout(() => this.elements.statusOverlay.classList.remove('active'), 2000);
                this.isScanning = false;
                return;
            }

            this.updateStatus(`QUERYING ARCHIVES: ${pokemonName}...`, 60);

            // 3. Get Stats from PokeAPI
            const pokeData = await this.fetchPokeData(pokemonName.toLowerCase().replace(/[^a-z0-9-]/g, ''));
            
            if (pokeData) {
                this.displayResult(pokeData);
                this.currentPokemon = pokeData;
            } else {
                throw new Error('Pokemon data not found');
            }

        } catch (err) {
            console.error('Identification Error:', err);
            this.updateStatus('SCAN FAILED', 0);
            alert('Error during scan: ' + err.message);
        } finally {
            this.isScanning = false;
            setTimeout(() => this.elements.statusOverlay.classList.remove('active'), 1000);
        }
    },

    captureFrame() {
        const { video, canvas } = this.elements;
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
        // Returns base64 string without the prefix
        return canvas.toDataURL('image/jpeg', 0.8).split(',')[1];
    },

    async callGeminiVision(base64Image, prompt) {
        // We'll try common variations including the newer 2.0 models and stable aliases
        const variations = [
            'v1beta/models/gemini-2.0-flash',
            'v1beta/models/gemini-1.5-flash-latest',
            'v1beta/models/gemini-1.5-flash',
            'v1/models/gemini-1.5-flash',
            'v1beta/models/gemini-flash-latest'
        ];

        let lastError = null;

        for (const modelPath of variations) {
            try {
                const url = `${this.BASE_URL}/${modelPath}:generateContent?key=${this.GEMINI_API_KEY}`;
                const response = await fetch(url, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        contents: [{
                            parts: [
                                { text: prompt },
                                { inlineData: { mimeType: 'image/jpeg', data: base64Image } }
                            ]
                        }]
                    })
                });

                const data = await response.json();
                if (response.ok) {
                    return data.candidates[0].content.parts[0].text.trim();
                } else {
                    lastError = data.error?.message || 'Unknown API error';
                    console.warn(`Retry failing for ${modelPath}: ${lastError}`);
                }
            } catch (err) {
                lastError = err.message;
            }
        }
        
        throw new Error(`Gemini API failed: ${lastError}`);
    },

    async fetchPokeData(name) {
        try {
            const res = await fetch(`${this.POKEAPI_URL}${name}`);
            if (!res.ok) return null;
            return await res.json();
        } catch (err) {
            return null;
        }
    },

    displayResult(data) {
        this.elements.pkName.innerText = data.name.toUpperCase();
        this.elements.pkSprite.src = data.sprites.other['official-artwork'].front_default || data.sprites.front_default;
        
        // Types
        this.elements.pkTypes.innerHTML = '';
        data.types.forEach(t => {
            const badge = document.createElement('span');
            badge.className = `type-badge`;
            badge.style.backgroundColor = `var(--type-${t.type.name})`;
            badge.innerText = t.type.name;
            this.elements.pkTypes.appendChild(badge);
        });

        this.elements.resultCard.classList.add('active');
        
        // --- Speak about the Pokemon ---
        this.narrate(data);
        
        // Audio feedback (Optional simple beep)
        this.playBeep(800, 0.1);
    },

    async narrate(data) {
        if (this.isMuted) return;

        try {
            // 1. Fetch flavor text (entry) from species endpoint
            const speciesRes = await fetch(data.species.url);
            const speciesData = await speciesRes.json();
            
            // Find English entry (preferably from a recent game)
            const entry = speciesData.flavor_text_entries.find(e => e.language.name === 'en');
            const cleanEntry = entry ? entry.flavor_text.replace(/\f/g, ' ') : `Identity confirmed: ${data.name}. This is a ${data.types.map(t => t.type.name).join(' and ')} type Pokémon.`;

            // 2. Speak it
            this.speak(`${data.name}. ${cleanEntry}`);
        } catch (err) {
            console.warn('TTS Error:', err);
            this.speak(`${data.name} identified.`);
        }
    },

    speak(text) {
        if (this.isMuted) return;
        
        // Cancel any current speech
        window.speechSynthesis.cancel();
        
        const utterance = new SpeechSynthesisUtterance(text);
        
        // Try to find a deeper or more robotic voice
        const voices = window.speechSynthesis.getVoices();
        const googleVoice = voices.find(v => v.name.includes('Google US English')) || voices[0];
        
        utterance.voice = googleVoice;
        utterance.pitch = 0.8;  // Slightly deeper for "Dex" feel
        utterance.rate = 1.0;
        utterance.volume = 0.8;

        window.speechSynthesis.speak(utterance);
    },

    showDetails() {
        const data = this.currentPokemon;
        if (!data) return;

        this.elements.dataView.style.display = 'block';
        this.elements.chatView.style.display = 'none';

        const statsHtml = data.stats.map(s => `
            <div class="stat-row">
                <span class="stat-name">${s.stat.name.toUpperCase()}</span>
                <div class="stat-bar-container">
                    <div class="stat-bar-fill" style="width: ${Math.min(100, (s.base_stat / 255) * 100)}%; background: var(--type-${data.types[0].type.name});"></div>
                </div>
                <span class="stat-val">${s.base_stat}</span>
            </div>
        `).join('');

        const abilities = data.abilities.map(a => a.ability.name.replace('-', ' ')).join(', ');

        this.elements.dataView.innerHTML = `
            <div class="pk-detail-card">
                <div class="pk-header-large">
                    <img src="${data.sprites.other.showdown?.front_default || data.sprites.front_default}" class="pk-gif">
                    <div class="pk-title-box">
                        <h2>#${String(data.id).padStart(3, '0')} ${data.name.toUpperCase()}</h2>
                        <div class="pk-types-large">
                            ${data.types.map(t => `<span class="type-badge" style="background: var(--type-${t.type.name})">${t.type.name}</span>`).join('')}
                        </div>
                    </div>
                </div>
                
                <div class="pk-info-grid">
                    <div class="info-item"><strong>HEIGHT:</strong> ${data.height/10}m</div>
                    <div class="info-item"><strong>WEIGHT:</strong> ${data.weight/10}kg</div>
                    <div class="info-item"><strong>ABILITIES:</strong> ${abilities}</div>
                </div>

                <div class="pk-stats">
                    <h3>BASE PARAMETERS</h3>
                    ${statsHtml}
                </div>
            </div>

            <style>
                .pk-detail-card { color: white; }
                .pk-header-large { display: flex; align-items: center; gap: 20px; margin-bottom: 20px; }
                .pk-gif { width: 80px; }
                .pk-info-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; margin-bottom: 20px; font-size: 0.8rem; background: rgba(0,0,0,0.3); padding: 10px; border-radius: 8px; }
                .stat-row { display: flex; align-items: center; gap: 10px; margin-bottom: 5px; font-size: 0.7rem; }
                .stat-name { width: 80px; font-weight: bold; }
                .stat-bar-container { flex: 1; height: 6px; background: #333; border-radius: 3px; overflow: hidden; }
                .stat-bar-fill { height: 100%; transition: width 1s; }
                .stat-val { width: 30px; text-align: right; }
                .pk-stats h3 { font-size: 0.9rem; margin-bottom: 10px; color: var(--pk-blue); border-bottom: 1px solid #333; padding-bottom: 5px; }
            </style>
        `;

        this.elements.detailOverlay.classList.add('active');
        
        // Reset chat for this pokemon
        this.chatHistory = [];
        document.getElementById('chat-history').innerHTML = `<div class="message system">SYSTEM: Connected to ${data.name.toUpperCase()} behavior database. Ask anything.</div>`;
    },

    async handleChatInput() {
        const input = document.getElementById('chat-input');
        const text = input.value.trim();
        if (!text || !this.currentPokemon) return;

        input.value = '';
        this.addMessage('user', text);

        try {
            const prompt = `You are a Pokedex from the Pokemon world. The user is asking about ${this.currentPokemon.name}. 
            Context: It is a ${this.currentPokemon.types.map(t => t.type.name).join('/')} type Pokemon.
            Question: ${text}
            Provide a detailed, lore-friendly answer about its behavior, features, habitation, or battle strategy. Be concise but informative.`;

            const aiResponse = await this.callGeminiText(prompt);
            this.addMessage('pokedex', aiResponse);
        } catch (err) {
            this.addMessage('system', 'ERROR: Communication link disrupted.');
        }
    },

    async callGeminiText(prompt) {
        const variations = [
            'v1beta/models/gemini-2.0-flash',
            'v1beta/models/gemini-1.5-flash-latest',
            'v1beta/models/gemini-1.5-flash',
            'v1/models/gemini-1.5-flash',
            'v1beta/models/gemini-flash-latest'
        ];

        let lastError = null;
        for (const modelPath of variations) {
            try {
                const url = `${this.BASE_URL}/${modelPath}:generateContent?key=${this.GEMINI_API_KEY}`;
                const response = await fetch(url, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        contents: [{ parts: [{ text: prompt }] }]
                    })
                });

                const data = await response.json();
                if (response.ok) {
                    return data.candidates[0].content.parts[0].text;
                }
                lastError = data.error?.message || 'Unknown API error';
            } catch (err) {
                lastError = err.message;
            }
        }
        throw new Error(lastError);
    },

    addMessage(sender, text) {
        const history = document.getElementById('chat-history');
        const msg = document.createElement('div');
        msg.className = `message ${sender}`;
        msg.innerHTML = `<strong>${sender.toUpperCase()}:</strong> ${text}`;
        history.appendChild(msg);
        history.scrollTop = history.scrollHeight;
    },

    playBeep(freq, dur) {
        try {
            const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
            const osc = audioCtx.createOscillator();
            const gain = audioCtx.createGain();
            osc.connect(gain);
            gain.connect(audioCtx.destination);
            osc.frequency.value = freq;
            gain.gain.setValueAtTime(0.1, audioCtx.currentTime);
            gain.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + dur);
            osc.start();
            osc.stop(audioCtx.currentTime + dur);
        } catch(e) {}
    }
};

// Start the app
window.onload = () => PokedexApp.init();
