# Hope Chat - Local AI Interface

Hope Chat is a lightweight, responsive, and aesthetically premium Flask-based web interface designed to connect to an LM Studio server or other LLMs on your local network.

---

## ✨ Features

- **🎨 Multi-Theme Support (daisyUI):** Select from multiple dark and light themes (Dim, Night, Dracula, Synthwave, Light, Cupcake, Forest) dynamically. The choice is persisted in `localStorage`.
- **⚙️ UI-driven Configuration:** Manage the LM Studio API endpoint URL, model selection, custom System instructions, and creativity Temperature directly from the interface. Settings are saved permanently in MongoDB.
- **🗂️ Multiple Conversations History:** Start, rename, or delete conversation logs easily from a responsive slide-out sidebar drawer.
- **🧠 Deep Reasoning Parser (Think Mode):** Parses Qwen's `<think>...</think>` tags dynamically to render the AI's reasoning steps in an expandable, beautifully styled brain box.
- **📥 Markdown Exporter:** Download your active chat history as a clean Markdown (`.md`) file with a single click.
- **💾 MongoDB Backend:** Automatically saves conversation states, messages, and settings in MongoDB.
- **🚀 Code Highlighting & Copying:** Full copy-to-clipboard buttons and PrismJS syntax highlighting on code blocks.

---

## 📂 Project Architecture

The project is structured according to the **Flask Application Factory Pattern** for modularity and scalability:

```text
/Users/hope/Desktop/chat/lm/
├── config.py             # Config class loading variables from .env
├── run.py                # Server entrypoint launcher
├── app/                  # Main application package
│   ├── __init__.py       # Application Factory (registers blueprints & initialises database)
│   ├── db.py             # MongoDB connection client setup
│   ├── models/           # Data models package
│   │   ├── __init__.py   # Models exporter
│   │   ├── setting.py    # SettingModel (gets/sets settings in MongoDB)
│   │   ├── conversation.py # ConversationModel (CRUD operations on chats)
│   │   └── message.py    # MessageModel (saves/loads messages)
│   ├── forms/            # Request validation package
│   │   ├── __init__.py   # Forms exporter
│   │   ├── settings_form.py # SettingsForm (validates settings payload)
│   │   ├── chat_form.py  # ChatForm (validates messages)
│   │   └── rename_form.py # RenameForm (validates renaming)
│   ├── routes/           # Blueprints router package
│   │   ├── __init__.py
│   │   ├── main.py       # Main view routes
│   │   └── api.py        # API routing blueprint
│   ├── templates/
│   │   └── index.html    # daisyUI HTML structure
│   └── static/
│       └── js/
│           └── chat.js   # Client-side script handling SSE streaming, export & theme
├── scripts/              # Startup scripts folder
│   ├── start.sh          # Linux/macOS launcher script
│   └── start.bat         # Windows launcher script
└── requirements.txt      # Dependency configurations
```

---


