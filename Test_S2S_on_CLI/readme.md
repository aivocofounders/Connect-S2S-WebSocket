
# AIVOCO Terminal Voice AI Client

This is a terminal-based audio call client that connects to AIVOCO's speech-to-speech AI server via WebSockets. It streams microphone audio in real-time, receives AI-generated speech, plays it through speakers, and handles dynamic function calls during the conversation.

## Features

- Real-time microphone streaming
- AI-generated audio playback
- Live function calls triggered by the AI
- Authentication via API key
- Credit-based usage system
- Custom functions (e.g., getWeather, getCurrentTime, saveNote)

## Requirements

- Node.js v14+
- Microphone and speaker access
- Unix or Windows terminal

## Installation

```bash
npm install
````

## Run the Client

```bash
node index.js
```

## WebSocket Endpoint

Production:

```
wss://sts.aivoco.on.cloud.vispark.in
```


## Available Commands

| Command                             | Description                                   |
| ----------------------------------- | --------------------------------------------- |
| `start <auth_key> [system_message]` | Starts a voice call session                   |
| `stop`                              | Stops the ongoing voice session               |
| `status`                            | Displays current call status and credit usage |
| `functions`                         | Lists all available custom functions          |
| `help`                              | Shows the command menu and usage guide        |
| `exit`                              | Exits the application                         |

If Auth Key Not Avaiable please raise request: https://tally.so/r/mVOKY6

## Custom Functions

The following functions can be triggered by the AI during the conversation, if defined in the function:

### 1. getWeather

Returns current weather information for a city.

**Parameters:**

* `city` (string, required)
* `units` (string, optional) - "celsius" or "fahrenheit"

### 2. getCurrentTime

Returns current time in a specified timezone.

**Parameters:**

* `timezone` (string, optional)

### 3. saveNote

Saves a note to a local file.

**Parameters:**

* `content` (string, required)
* `filename` (string, optional)

---

## WebSocket Events

### Client → Server

| Event Name          | Payload Description                                                                              |
| ------------------- | ------------------------------------------------------------------------------------------------ |
| `start_call`        | Starts a session. Requires `auth_key`, `system_message`, `voice_choice`, and `custom_functions`. |
| `stop_call`         | Stops the current session.                                                                       |
| `audio_data`        | Sends real-time audio buffer. Contains `audio_data`, `has_audio`, and `max_amplitude`.           |
| `function_response` | Returns the result of a previously triggered function call.                                      |

### Server → Client

| Event Name        | Description                                                              |
| ----------------- | ------------------------------------------------------------------------ |
| `connect`         | Triggered when WebSocket connection is established.                      |
| `disconnect`      | Triggered when the client disconnects.                                   |
| `auth_success`    | Authentication succeeded. Returns available credits.                     |
| `auth_failed`     | Authentication failed. Includes reason message.                          |
| `session_ready`   | Session successfully started. Returns session info like cost per minute. |
| `session_ended`   | Session ended. May include reason and total credits used.                |
| `text_response`   | AI sends back a textual response.                                        |
| `audio_response`  | AI sends back base64-encoded PCM audio (24kHz).                          |
| `function_called` | AI triggers a registered function with arguments and a call ID.          |
| `function_result` | Server returns result after function call is processed.                  |
| `error`           | Generic error message from server.                                       |

---

## Audio Specifications

* Microphone Input:

  * Format: PCM 16-bit
  * Sample Rate: 16,000 Hz
  * Mono channel

* Speaker Output:

  * Format: PCM 16-bit
  * Sample Rate: 24,000 Hz
  * Mono channel

---

## Example Usage

```bash
start your-api-key You are a helpful assistant that can access tools like weather, time, and note-taking.
```

Example AI queries during conversation:

* "What's the weather in Mumbai?"
* "What time is it in London?"
* "Save this as a note."

---

## Notes

* All function results are automatically returned to the AI in real-time to continue the conversational flow.
* The client logs essential activity with timestamps for debugging and analysis.

---

## Folder Structure

```
project-root/
├── index.js          // Main application file
├── notes/            // Folder where notes are saved via `saveNote`
└── README.md         // This documentation file
```

