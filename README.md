# Lumina Chat - Local AI Interface

Lumina Chat is a lightweight, responsive, and aesthetically premium Flask-based web interface designed to connect to a local LM Studio server running **Qwen 3.5 9B** (or any other LLM) on your local network.

## Features

- **Dynamic Connection Configuration:** Configure your LM Studio API endpoint (local or remote IP) directly from the interface.
- **Deep Reasoning Parser (Think Mode):** Parses Qwen's `<think>` tags dynamically to render the AI's reasoning process in an expandable, beautifully styled brain box.
- **MongoDB History:** Automatically saves conversation lists, messages, and active settings in a MongoDB instance.
- **Prompt Starters:** Interactive prompt grid for coding, math, writing, and debugging.
- **Syntax Highlighting & Code Copy:** Full copy-to-clipboard buttons and PrismJS syntax highlighting on code blocks.
- **Network Shared:** Built to run on `0.0.0.0`, allowing access from other computers on the same router/network.

---

## Getting Started

### 📋 Prerequisites

1. **Python 3.8+** installed.
2. **MongoDB** installed and running on your system (defaults to `mongodb://localhost:27017/` database `lumina_chat`).
   - If your MongoDB is hosted on another machine, set the environment variable: `MONGO_URI=mongodb://YOUR_IP:27017/` before starting.

---

### 🚀 Setup & Execution

#### Option 1: Using the Startup Scripts (Recommended)

Simply run the startup script for your Operating System. This script will automatically create a virtual environment (`.venv`), install all requirements, and start the server:

- **macOS / Linux:**
  ```bash
  ./start.sh
  ```
- **Windows:**
  Double-click `start.bat` or run:
  ```cmd
  start.bat
  ```

---

#### Option 2: Manual Setup

If you prefer to set up the environment manually:

1. **Clone the repository:**
   ```bash
   git clone <your-repo-link>
   cd lm
   ```

2. **Create a virtual environment (`venv`):**
   - **macOS/Linux:**
     ```bash
     python3 -m venv .venv
     ```
   - **Windows:**
     ```cmd
     python -m venv .venv
     ```

3. **Activate the virtual environment:**
   - **macOS/Linux:**
     ```bash
     source .venv/bin/activate
     ```
   - **Windows (Command Prompt):**
     ```cmd
     .venv\Scripts\activate.bat
     ```
   - **Windows (PowerShell):**
     ```powershell
     .venv\Scripts\Activate.ps1
     ```

4. **Install the dependencies:**
   ```bash
   pip install -r requirements.txt
   ```

5. **Start the Flask server:**
   ```bash
   python app.py
   ```

Open [http://localhost:5001](http://localhost:5001) in your browser.

---

## 🌐 Connecting to LM Studio on Another PC

If you are running LM Studio on a separate machine on the same router:

1. On the **LM Studio PC**, navigate to the **Local Server** tab.
2. In **Server Settings**, change the **Host Binding** from `127.0.0.1` (localhost) to **`0.0.0.0`** (this allows connections from other local devices).
3. Start the server.
4. On the **Lumina Chat PC**, open the interface, click **Connection Settings** in the bottom left, enter the LM Studio PC's local IP (e.g. `http://192.168.1.15:1234/v1`), and click **Save Changes**.
