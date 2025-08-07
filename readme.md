# Speech-to-Speech WebSocket API Documentation

## 🚀 Getting Started

Welcome to the Speech-to-Speech WebSocket API! This real-time API enables voice conversations with AI, supporting custom function calls and high-quality audio streaming.

### Base Endpoint
```
wss://sts.aivoco.on.cloud.vispark.in
```

## 🔧 Prerequisites

Before connecting, ensure you have:
- **API Key**: Get yours at [https://tally.so/r/mVOKY6](https://tally.so/r/mVOKY6)
- **Socket.IO Client**: For WebSocket communication
- **Audio Input Source**: Any system capable of providing Base64-encoded PCM audio data

## 📦 Installation

### Browser (CDN)
```html
<script src="https://cdnjs.cloudflare.com/ajax/libs/socket.io/4.7.2/socket.io.min.js"></script>
```

### Node.js
```bash
npm install socket.io-client
```

## 🔗 Establishing Connection

### Step 1: Initialize WebSocket Connection

```javascript
// Browser Environment
const socket = io('wss://sts.aivoco.on.cloud.vispark.in');

// Node.js Environment
const io = require('socket.io-client');
const socket = io('wss://sts.aivoco.on.cloud.vispark.in');
```

### Step 2: Handle Connection Events

```javascript
// Connection established
socket.on('connect', function() {
    console.log('✅ Connected to Speech-to-Speech API');
    console.log('Connection ID:', socket.id);
});

// Connection failed
socket.on('disconnect', function(reason) {
    console.log('❌ Disconnected:', reason);
    // Handle reconnection logic here
});

// Connection errors
socket.on('connect_error', function(error) {
    console.error('🚫 Connection Error:', error);
});
```

## 🔐 Authentication

### Step 3: Authenticate Your Session

Before starting a voice call, authenticate using your API key:

```javascript
// Authentication happens during start_call event
const authKey = 'your_api_key_here';
const systemMessage = 'You are a helpful AI assistant.';
const voiceChoice = 'female'; // or 'male'

socket.emit('start_call', {
    auth_key: authKey,
    system_message: systemMessage,
    voice_choice: voiceChoice,
    custom_functions: [] // We'll add functions later
});
```

### Step 4: Handle Authentication Response

```javascript
// Authentication successful
socket.on('auth_success', function(data) {
    console.log('🎉 Authentication successful');
    console.log('Available credits:', data.credits);
});

// Authentication failed
socket.on('auth_failed', function(data) {
    console.error('🚫 Authentication failed:', data.message);
    console.log('Available credits:', data.credits);
});
```

## 🎤 Audio Input Requirements

The Speech-to-Speech API accepts audio data in the following format:

### Audio Input Format
- **Encoding**: Base64-encoded PCM (Pulse Code Modulation)
- **Sample Rate**: 16kHz
- **Channels**: Mono (single channel)
- **Bit Depth**: 16-bit signed integers
- **Data Format**: Raw PCM audio converted to Base64 string

### Input Sources & Use Cases

**1. Web Applications**
```javascript
// Browser microphone input
const stream = await navigator.mediaDevices.getUserMedia({
    audio: { sampleRate: 16000, channelCount: 1 }
});
```

**2. SIP Trunking & Phone Systems**
```javascript
// Audio from phone calls via SIP trunking
const sipAudioStream = getSipAudioStream(); // Your SIP implementation
const base64Audio = convertToBase64PCM(sipAudioStream);
```

**3. Mobile Applications**
```javascript
// Native mobile app audio capture
const mobileAudio = captureDeviceAudio();
const processedAudio = convertToPCM16kHz(mobileAudio);
```

**4. Server-to-Server Integration**
```javascript
// Pre-recorded audio files or streaming services
const audioFile = fs.readFileSync('audio.wav');
const base64Audio = convertWavToPCMBase64(audioFile);
```

### Audio Processing Pipeline
```
Audio Source → PCM 16kHz Conversion → Base64 Encoding → WebSocket → S2S Model
```

### Step 5: Audio Data Transmission

The core requirement is sending Base64-encoded PCM audio data to the WebSocket:

```javascript
// Generic audio data transmission
socket.emit('audio_data', {
    audio_data: base64EncodedPCMAudio,    // Base64 string of PCM data
    has_audio: hasSignificantAudio,       // Boolean: audio presence detection
    max_amplitude: maxAmplitudeLevel      // Float: peak audio level (0.0-1.0)
});
```

**Example: Converting any audio source to required format**
```javascript
function convertToRequiredFormat(audioBuffer) {
    // Convert audio to 16kHz mono PCM
    const pcmData = new Int16Array(audioBuffer.length);
    for (let i = 0; i < audioBuffer.length; i++) {
        // Convert float32 (-1.0 to 1.0) to int16 (-32768 to 32767)
        pcmData[i] = Math.max(-32768, Math.min(32767, audioBuffer[i] * 32767));
    }
    
    // Convert to Base64
    const base64Audio = btoa(String.fromCharCode.apply(null, new Uint8Array(pcmData.buffer)));
    
    return base64Audio;
}
```

**Example: Browser Implementation**
```javascript
async function setupBrowserAudio() {
    const stream = await navigator.mediaDevices.getUserMedia({
        audio: { sampleRate: 16000, channelCount: 1 }
    });
    
    const audioContext = new AudioContext({ sampleRate: 16000 });
    const source = audioContext.createMediaStreamSource(stream);
    const processor = audioContext.createScriptProcessor(1024, 1, 1);
    
    processor.onaudioprocess = (event) => {
        const inputData = event.inputBuffer.getChannelData(0);
        const base64Audio = convertToRequiredFormat(inputData);
        
        socket.emit('audio_data', {
            audio_data: base64Audio,
            has_audio: detectAudioPresence(inputData),
            max_amplitude: getMaxAmplitude(inputData)
        });
    };
    
    source.connect(processor);
    processor.connect(audioContext.destination);
}
```

**Example: SIP/Phone Integration**
```javascript
function handleSipAudio(sipAudioStream) {
    // Process SIP audio stream (implementation depends on your SIP stack)
    sipAudioStream.on('audio', (audioChunk) => {
        // Ensure audio is 16kHz mono PCM
        const processedAudio = resampleTo16kHz(audioChunk);
        const base64Audio = convertToRequiredFormat(processedAudio);
        
        socket.emit('audio_data', {
            audio_data: base64Audio,
            has_audio: true,
            max_amplitude: calculateAmplitude(processedAudio)
        });
    });
}
```


## 🎯 Session Management

### Step 7: Handle Session Events

```javascript
let isCallActive = false;
let callStartTime = null;

// Session ready - call started successfully
socket.on('session_ready', function(data) {
    console.log('🚀 Voice session started');
    console.log('Message:', data.message);
    console.log('Credits available:', data.credits_available);
    console.log('Cost per minute:', data.cost_per_minute);
    console.log('Functions loaded:', data.functions_loaded);
    
    isCallActive = true;
    callStartTime = Date.now();
    
    // Enable stop button, disable start button
    document.getElementById('stopCall').disabled = false;
    document.getElementById('startCall').disabled = true;
});

// Session ended
socket.on('session_ended', function(data) {
    console.log('⏹️ Voice session ended');
    console.log('Reason:', data.reason);
    
    if (data.total_credits_used) {
        console.log('Total credits used:', data.total_credits_used);
        console.log('Remaining credits:', data.remaining_credits);
    }
    
    isCallActive = false;
    callStartTime = null;
    
    // Reset UI
    document.getElementById('startCall').disabled = false;
    document.getElementById('stopCall').disabled = true;
    
    // Stop audio processing
    stopAudio();
});
```

## 🔊 Audio Output Handling

The API returns synthesized speech as Base64-encoded audio data that needs to be decoded and played back.

### Step 6: Audio Response Processing

```javascript
// Receive audio responses from the S2S model
socket.on('audio_response', function(data) {
    playAudioResponse(data.audio_data);
});

function playAudioResponse(base64AudioData) {
    try {
        // Decode Base64 to binary audio data
        const binaryString = atob(base64AudioData);
        const bytes = new Uint8Array(binaryString.length);
        for (let i = 0; i < binaryString.length; i++) {
            bytes[i] = binaryString.charCodeAt(i);
        }
        
        // Convert PCM to playable audio format
        const pcmData = new Int16Array(bytes.buffer);
        const floatData = new Float32Array(pcmData.length);
        for (let i = 0; i < pcmData.length; i++) {
            floatData[i] = pcmData[i] / 32768.0;  // Convert to float32
        }
        
        // Platform-specific playback implementation
        playAudioData(floatData);
        
    } catch (error) {
        console.error('Audio playback error:', error);
    }
}
```

### Platform-Specific Playback Examples

**Browser/Web Application:**
```javascript
let audioContext = new AudioContext({ sampleRate: 24000 });

function playAudioData(floatData) {
    const audioBuffer = audioContext.createBuffer(1, floatData.length, 24000);
    audioBuffer.getChannelData(0).set(floatData);
    
    const source = audioContext.createBufferSource();
    source.buffer = audioBuffer;
    source.connect(audioContext.destination);
    source.start();
}
```

**SIP/Phone System Integration:**
```javascript
function playToSipChannel(floatData) {
    // Convert to format expected by your SIP stack
    const sipAudioFormat = convertToSipFormat(floatData);
    sipChannel.playAudio(sipAudioFormat);
}
```

**Mobile/Native Application:**
```javascript
function playOnMobileDevice(floatData) {
    // Use platform audio APIs (iOS AVAudioEngine, Android AudioTrack, etc.)
    nativeAudioPlayer.playPCMData(floatData);
}
```


## 📝 Text Response Logging

### Step 9: Handle Text Responses

```javascript
// Receive AI text responses (for logging/display)
socket.on('text_response', function(data) {
    console.log('🤖 AI Response:', data.text);
    
    // Display in UI if needed
    const logElement = document.getElementById('conversation-log');
    if (logElement) {
        const timestamp = new Date().toLocaleTimeString();
        logElement.innerHTML += `<div class="ai-message">[${timestamp}] AI: ${data.text}</div>`;
    }
});
```

## 🛑 Stopping a Call

### Step 10: End Session

```javascript
function stopCall() {
    console.log('🛑 Stopping voice call...');
    socket.emit('stop_call');
    stopAudio();
}

function stopAudio() {
    // Stop audio queue
    audioQueue = [];
    isPlayingStream = false;
    
    // Stop media stream
    if (mediaStream) {
        mediaStream.getTracks().forEach(track => track.stop());
        mediaStream = null;
    }
    
    // Close audio context
    if (audioContext) {
        audioContext.close();
        audioContext = null;
    }
    
    // Disconnect processor
    if (processor) {
        processor.disconnect();
        processor = null;
    }
    
    console.log('🔇 Audio stopped');
}
```


## 🚨 Error Handling

### Common Connection Issues

```javascript
// Handle various error scenarios
socket.on('error', function(data) {
    console.error('API Error:', data.message);
    
    switch(data.type) {
        case 'insufficient_credits':
            alert('Insufficient credits. Please add more credits to continue.');
            break;
        case 'invalid_api_key':
            alert('Invalid API key. Please check your credentials.');
            break;
        case 'rate_limit_exceeded':
            alert('Rate limit exceeded. Please wait before making another request.');
            break;
        default:
            alert(`Error: ${data.message}`);
    }
    
    // Reset call state
    isCallActive = false;
    stopAudio();
});

// Network connection issues
socket.on('reconnect_attempt', (attemptNumber) => {
    console.log(`Reconnection attempt ${attemptNumber}`);
});

socket.on('reconnect_failed', () => {
    console.error('Failed to reconnect to server');
    alert('Connection lost. Please refresh the page.');
});
```

## 🔧 Complete Example

### Full Implementation

Reffer 
https://github.com/aivocofounders/Connect-S2S-WebSocket/tree/main/Demo

Interact with Websockets Via CLI
https://github.com/aivocofounders/Connect-S2S-WebSocket/tree/main/Test_S2S_on_CLI
