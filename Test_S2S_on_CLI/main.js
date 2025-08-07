const io = require('socket.io-client');
const mic = require('mic');
const Speaker = require('speaker');
const readline = require('readline');
const fs = require('fs');

// Configuration
const WEBSOCKET_URL = 'https://sts.aivoco.on.cloud.vispark.in';
// const WEBSOCKET_URL = 'http://localhost:11002'; // Uncomment for local testing

class AudioCallClient {
    constructor() {
        this.socket = null;
        this.isCallActive = false;
        this.micInstance = null;
        this.speaker = null;
        this.callStartTime = null;
        this.currentCredits = 0;
        this.functionCallCount = 0;
        
        // Audio settings
        this.audioConfig = {
            rate: 16000,
            channels: 1,
            debug: false,
            exitOnSilence: 6
        };
        
        // Custom functions for demonstration
        this.customFunctions = [
            {
                name: 'getWeather',
                description: 'Get current weather information for a specific city',
                parameters: [
                    { name: 'city', type: 'string', description: 'City name', required: true },
                    { name: 'units', type: 'string', description: 'Temperature units (celsius/fahrenheit)', required: false }
                ]
            },
            {
                name: 'getCurrentTime',
                description: 'Get current time for a specific timezone',
                parameters: [
                    { name: 'timezone', type: 'string', description: 'Timezone (e.g., America/New_York)', required: false }
                ]
            },
            {
                name: 'saveNote',
                description: 'Save a note to a file',
                parameters: [
                    { name: 'content', type: 'string', description: 'Note content', required: true },
                    { name: 'filename', type: 'string', description: 'File name', required: false }
                ]
            }
        ];
        
        this.setupReadline();
    }
    
    setupReadline() {
        this.rl = readline.createInterface({
            input: process.stdin,
            output: process.stdout
        });
    }
    
    log(message, type = 'INFO') {
        const timestamp = new Date().toLocaleTimeString();
        const prefix = {
            'INFO': '🔵',
            'SUCCESS': '✅',
            'ERROR': '❌',
            'AI': '🤖',
            'FUNCTION': '🔧',
            'AUDIO': '🎵'
        }[type] || '📝';
        
        console.log(`[${timestamp}] ${prefix} ${message}`);
    }
    
    connect() {
        this.log('Connecting to WebSocket server...', 'INFO');
        
        this.socket = io(WEBSOCKET_URL, {
            transports: ['websocket', 'polling']
        });
        
        this.setupSocketListeners();
    }
    
    setupSocketListeners() {
        this.socket.on('connect', () => {
            this.log('Connected to server successfully', 'SUCCESS');
        });
        
        this.socket.on('disconnect', () => {
            this.log('Disconnected from server', 'ERROR');
            this.cleanup();
        });
        
        this.socket.on('auth_success', (data) => {
            this.log('Authentication successful', 'SUCCESS');
            this.currentCredits = data.credits;
            this.log(`Credits available: ${data.credits}`, 'INFO');
        });
        
        this.socket.on('auth_failed', (data) => {
            this.log(`Authentication failed: ${data.message}`, 'ERROR');
        });
        
        this.socket.on('session_ready', (data) => {
            this.log(`Voice session started - ${data.message}`, 'SUCCESS');
            this.log(`Functions loaded: ${data.functions_loaded || 0}`, 'FUNCTION');
            this.log(`Cost per minute: ${data.cost_per_minute || 1.0} credits`, 'INFO');
            
            this.isCallActive = true;
            this.callStartTime = Date.now();
            this.setupAudio();
        });
        
        this.socket.on('session_ended', (data) => {
            let message = 'Voice session ended';
            if (data.reason === 'insufficient_user_credits') {
                message += ' (Out of credits)';
            }
            
            this.log(message, 'INFO');
            if (data.total_credits_used) {
                this.log(`Total credits used: ${data.total_credits_used.toFixed(4)}`, 'INFO');
            }
            
            this.cleanup();
        });
        
        this.socket.on('text_response', (data) => {
            this.log(`AI: ${data.text}`, 'AI');
        });
        
        this.socket.on('audio_response', (data) => {
            // Log audio reception (but not too frequently)
            if (Math.random() < 0.1) { // Only log 10% of audio chunks to avoid spam
                this.log('🎵 Receiving AI audio response...', 'AUDIO');
            }
            this.playAudio(data.audio_data);
        });
        
        this.socket.on('function_called', (data) => {
            this.log(`🔧 AI requested function: ${data.function_name}`, 'FUNCTION');
            this.log(`📋 Function arguments: ${JSON.stringify(data.arguments)}`, 'FUNCTION');
            this.log(`🆔 Call ID: ${data.call_id}`, 'FUNCTION');
            
            // This is triggered automatically by the AI during audio conversation
            // when it determines a function call is needed
            this.handleFunctionCall(data.function_name, data.arguments, data.call_id);
        });
        
        this.socket.on('function_result', (data) => {
            this.log(`✅ Function execution completed: ${data.function_name}`, 'SUCCESS');
            this.log(`📊 Result preview: ${JSON.stringify(data.result).substring(0, 100)}...`, 'INFO');
        });
        
        this.socket.on('error', (data) => {
            this.log(`Error: ${data.message}`, 'ERROR');
            this.cleanup();
        });
    }
    
    setupAudio() {
        try {
            // Setup microphone with proper settings
            this.micInstance = mic({
                rate: 16000,
                channels: 1,
                debug: false,
                exitOnSilence: 6,
                fileType: 'raw'  // Important: use raw format
            });
            
            const micInputStream = this.micInstance.getAudioStream();
            
            micInputStream.on('data', (data) => {
                if (this.isCallActive) {
                    // Data is already in the right format from mic
                    // Convert buffer to Int16Array properly
                    const pcmData = new Int16Array(data.buffer, data.byteOffset, data.byteLength / 2);
                    
                    // Check for significant audio
                    let hasSignificantAudio = false;
                    let maxAmplitude = 0;
                    
                    for (let i = 0; i < pcmData.length; i++) {
                        const amplitude = Math.abs(pcmData[i]) / 32768;
                        maxAmplitude = Math.max(maxAmplitude, amplitude);
                        if (amplitude > 0.01) {  // Increased threshold
                            hasSignificantAudio = true;
                        }
                    }
                    
                    // Send raw buffer as base64
                    const audioData = data.toString('base64');
                    this.socket.emit('audio_data', {
                        audio_data: audioData,
                        has_audio: hasSignificantAudio,
                        max_amplitude: maxAmplitude
                    });
                }
            });
            
            micInputStream.on('error', (err) => {
                this.log(`Microphone error: ${err.message}`, 'ERROR');
            });
            
            // Setup speaker with correct settings for AI audio output
            this.speaker = new Speaker({
                channels: 1,
                bitDepth: 16,
                sampleRate: 24000,  // AI returns 24kHz audio
                signed: true,
                float: false
            });
            
            this.speaker.on('error', (err) => {
                this.log(`Speaker error: ${err.message}`, 'ERROR');
            });
            
            this.micInstance.start();
            this.log('Audio setup complete - microphone active', 'AUDIO');
            
        } catch (error) {
            this.log(`Audio setup failed: ${error.message}`, 'ERROR');
        }
    }
    
    playAudio(base64AudioData) {
        try {
            // Decode base64 to buffer
            const audioBuffer = Buffer.from(base64AudioData, 'base64');
            
            // The audio from AI is already in the correct Int16 PCM format at 24kHz
            // We just need to write it directly to the speaker
            if (this.speaker && !this.speaker.destroyed && !this.speaker.writableEnded) {
                const success = this.speaker.write(audioBuffer);
                
                if (!success) {
                    // If speaker buffer is full, wait for drain
                    this.speaker.once('drain', () => {
                        this.log('Speaker buffer drained, ready for more audio', 'AUDIO');
                    });
                }
            } else {
                this.log('Speaker not available for playback', 'ERROR');
            }
            
        } catch (error) {
            this.log(`Audio playback error: ${error.message}`, 'ERROR');
        }
    }
    
    async handleFunctionCall(functionName, args, callId) {
        try {
            this.log(`🔧 Processing function: ${functionName}`, 'FUNCTION');
            this.log(`📝 With arguments: ${JSON.stringify(args)}`, 'FUNCTION');
            
            let result;
            
            switch (functionName) {
                case 'getWeather':
                    result = await this.getWeather(args);
                    break;
                case 'getCurrentTime':
                    result = await this.getCurrentTime(args);
                    break;
                case 'saveNote':
                    result = await this.saveNote(args);
                    break;
                default:
                    result = {
                        error: `Function '${functionName}' not implemented`,
                        message: 'This function is not yet implemented by the developer',
                        available_functions: this.customFunctions.map(f => f.name)
                    };
            }
            
            // Send response back to the AI model via WebSocket
            this.socket.emit('function_response', {
                call_id: callId,
                function_name: functionName,
                result: result
            });
            
            this.log(`✅ Response sent for ${functionName}`, 'SUCCESS');
            
        } catch (error) {
            this.log(`❌ Function execution error: ${error.message}`, 'ERROR');
            
            // Send error response back to AI model
            this.socket.emit('function_response', {
                call_id: callId,
                function_name: functionName,
                result: {
                    error: error.message,
                    status: 'failed'
                }
            });
        }
    }
    
    // Example function implementations
    async getWeather(args) {
        const city = args.city || 'Unknown';
        this.log(`Getting weather for ${city}...`, 'FUNCTION');
        
        // Simulate API delay
        await new Promise(resolve => setTimeout(resolve, 1000));
        
        // Mock weather data (replace with real API)
        const mockData = {
            city: city,
            temperature: Math.floor(Math.random() * 30 + 5) + '°C',
            condition: ['Sunny', 'Cloudy', 'Rainy', 'Partly cloudy'][Math.floor(Math.random() * 4)],
            humidity: Math.floor(Math.random() * 40 + 40) + '%',
            wind_speed: Math.floor(Math.random() * 20 + 5) + ' km/h'
        };
        
        return {
            status: 'success',
            data: mockData,
            message: `Weather retrieved for ${city}`
        };
    }
    
    async getCurrentTime(args) {
        const timezone = args.timezone || 'UTC';
        this.log(`Getting time for timezone: ${timezone}`, 'FUNCTION');
        
        try {
            const now = new Date();
            const timeString = timezone === 'UTC' 
                ? now.toUTCString() 
                : now.toLocaleString('en-US', { timeZone: timezone });
            
            return {
                status: 'success',
                data: {
                    timezone: timezone,
                    current_time: timeString,
                    timestamp: now.getTime()
                },
                message: `Current time retrieved for ${timezone}`
            };
        } catch (error) {
            return {
                status: 'error',
                error: `Invalid timezone: ${timezone}`,
                message: 'Please provide a valid timezone'
            };
        }
    }
    
    async saveNote(args) {
        const content = args.content || '';
        const filename = args.filename || `note_${Date.now()}.txt`;
        
        this.log(`Saving note to ${filename}...`, 'FUNCTION');
        
        try {
            const fullPath = `./notes/${filename}`;
            
            // Create notes directory if it doesn't exist
            if (!fs.existsSync('./notes')) {
                fs.mkdirSync('./notes');
            }
            
            fs.writeFileSync(fullPath, content);
            
            return {
                status: 'success',
                data: {
                    filename: filename,
                    path: fullPath,
                    size: content.length
                },
                message: `Note saved successfully to ${filename}`
            };
        } catch (error) {
            return {
                status: 'error',
                error: error.message,
                message: 'Failed to save note'
            };
        }
    }
    
    startCall(authKey, systemMessage = '', voiceChoice = 'alloy') {
        if (!authKey) {
            this.log('Authentication key is required', 'ERROR');
            return;
        }
        
        this.log('Starting voice call...', 'INFO');
        this.log(`Using ${this.customFunctions.length} custom functions`, 'FUNCTION');
        
        this.socket.emit('start_call', {
            auth_key: authKey,
            system_message: systemMessage,
            voice_choice: voiceChoice,
            custom_functions: this.customFunctions
        });
    }
    
    stopCall() {
        this.log('Stopping voice call...', 'INFO');
        this.socket.emit('stop_call');
        this.cleanup();
    }
    
    cleanup() {
        this.isCallActive = false;
        
        if (this.micInstance) {
            try {
                this.micInstance.stop();
                this.log('Microphone stopped', 'AUDIO');
            } catch (e) {
                this.log('Error stopping microphone', 'ERROR');
            }
            this.micInstance = null;
        }
        
        if (this.speaker && !this.speaker.destroyed) {
            try {
                // Properly close the speaker stream
                this.speaker.end();
                this.log('Speaker stream ended', 'AUDIO');
            } catch (e) {
                this.log('Error closing speaker', 'ERROR');
            }
            this.speaker = null;
        }
        
        this.log('Audio cleanup complete', 'INFO');
    }
    
    showMenu() {
        console.log('\n' + '='.repeat(60));
        console.log('🎤 AIVOCO Terminal Audio Call Client');
        console.log('='.repeat(60));
        console.log('HOW IT WORKS:');
        console.log('1. Start a voice call with your API key');
        console.log('2. Talk to the AI naturally through your microphone');
        console.log('3. AI will automatically call functions when needed');
        console.log('4. Function results are sent back to continue conversation');
        console.log('');
        console.log('COMMANDS:');
        console.log('  start <auth_key> [system_message] - Start voice call');
        console.log('  stop                              - Stop current call');
        console.log('  status                           - Show current status');
        console.log('  functions                        - List loaded functions');
        console.log('  help                            - Show this menu');
        console.log('  exit                            - Exit application');
        console.log('');
        console.log('EXAMPLE FUNCTION TRIGGERS:');
        console.log('  "What\'s the weather in London?" → calls getWeather');
        console.log('  "What time is it in New York?"  → calls getCurrentTime');
        console.log('  "Save this as a note"           → calls saveNote');
        console.log('='.repeat(60));
        console.log(`Status: ${this.isCallActive ? '🔴 Call Active' : '🟢 Ready'}`);
        console.log(`Credits: ${this.currentCredits}`);
        console.log(`Functions Available: ${this.customFunctions.length}`);
        console.log('='.repeat(60) + '\n');
    }
    
    handleCommand(input) {
        const parts = input.trim().split(' ');
        const command = parts[0].toLowerCase();
        
        switch (command) {
            case 'start':
                if (parts.length < 2) {
                    this.log('Usage: start <auth_key> [system_message]', 'ERROR');
                    break;
                }
                const authKey = parts[1];
                const systemMessage = parts.slice(2).join(' ') || 'You are a helpful AI assistant with access to various functions.';
                this.startCall(authKey, systemMessage);
                break;
                
            case 'stop':
                this.stopCall();
                break;
                
            case 'status':
                console.log(`\nStatus: ${this.isCallActive ? '🔴 Call Active' : '🟢 Ready'}`);
                console.log(`Credits: ${this.currentCredits}`);
                console.log(`Functions loaded: ${this.customFunctions.length}`);
                if (this.callStartTime) {
                    const duration = (Date.now() - this.callStartTime) / 1000;
                    console.log(`Call duration: ${Math.floor(duration)}s`);
                }
                break;
                
            case 'functions':
                console.log('\n📋 Loaded Functions:');
                this.customFunctions.forEach((func, index) => {
                    console.log(`${index + 1}. ${func.name} - ${func.description}`);
                });
                break;
                
            case 'help':
                this.showMenu();
                break;
                
            case 'exit':
                this.log('Shutting down...', 'INFO');
                this.cleanup();
                if (this.socket) {
                    this.socket.disconnect();
                }
                process.exit(0);
                break;
                
            default:
                this.log('Unknown command. Type "help" for available commands.', 'ERROR');
        }
    }
    
    start() {
        this.connect();
        this.showMenu();
        
        this.rl.on('line', (input) => {
            this.handleCommand(input);
        });
        
        // Graceful shutdown
        process.on('SIGINT', () => {
            this.log('\nReceived SIGINT, shutting down gracefully...', 'INFO');
            this.cleanup();
            if (this.socket) {
                this.socket.disconnect();
            }
            process.exit(0);
        });
    }
}

// Usage
const client = new AudioCallClient();
client.start();