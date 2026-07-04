import json
import sqlite3
import uuid
import requests
from flask import Flask, Response, jsonify, render_template, request

app = Flask(__name__)
DB_FILE = "conversations.db"


def get_db_connection():
    conn = sqlite3.connect(DB_FILE)
    conn.row_factory = sqlite3.Row
    return conn


def init_db():
    conn = get_db_connection()
    cursor = conn.cursor()

    # Settings table
    cursor.execute(
        """
        CREATE TABLE IF NOT EXISTS settings (
            key TEXT PRIMARY KEY,
            value TEXT
        )
    """
    )

    # Conversations table
    cursor.execute(
        """
        CREATE TABLE IF NOT EXISTS conversations (
            id TEXT PRIMARY KEY,
            title TEXT NOT NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    """
    )

    # Messages table
    cursor.execute(
        """
        CREATE TABLE IF NOT EXISTS messages (
            id TEXT PRIMARY KEY,
            conversation_id TEXT NOT NULL,
            role TEXT NOT NULL,
            content TEXT NOT NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (conversation_id) REFERENCES conversations (id) ON DELETE CASCADE
        )
    """
    )

    # Insert default settings if not exists
    cursor.execute(
        "INSERT OR IGNORE INTO settings (key, value) VALUES ('api_url', 'http://localhost:1234/v1')"
    )
    cursor.execute(
        "INSERT OR IGNORE INTO settings (key, value) VALUES ('model_name', 'qwen2.5-7b-instruct')"
    )

    conn.commit()
    conn.close()


# Initialize the database
init_db()


def get_setting(key, default=None):
    conn = get_db_connection()
    row = conn.execute("SELECT value FROM settings WHERE key = ?", (key,)).fetchone()
    conn.close()
    return row["value"] if row else default


def set_setting(key, value):
    conn = get_db_connection()
    conn.execute(
        "INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)", (key, value)
    )
    conn.commit()
    conn.close()


@app.route("/")
def index():
    return render_template("index.html")


# Settings Endpoints
@app.route("/api/settings", methods=["GET", "POST"])
def handle_settings():
    if request.method == "POST":
        data = request.json
        api_url = data.get("api_url", "").strip().rstrip("/")
        model_name = data.get("model_name", "").strip()

        if api_url:
            set_setting("api_url", api_url)
        if model_name:
            set_setting("model_name", model_name)

        return jsonify(
            {
                "status": "success",
                "api_url": get_setting("api_url"),
                "model_name": get_setting("model_name"),
            }
        )

    return jsonify(
        {"api_url": get_setting("api_url"), "model_name": get_setting("model_name")}
    )


@app.route("/api/models", methods=["GET"])
def get_available_models():
    api_url = get_setting("api_url")
    try:
        response = requests.get(f"{api_url}/models", timeout=3)
        if response.status_code == 200:
            models_data = response.json()
            # Extract model IDs
            models = [m["id"] for m in models_data.get("data", [])]
            return jsonify({"status": "success", "models": models})
        return jsonify(
            {
                "status": "error",
                "message": f"API returned status {response.status_code}",
                "models": [],
            }
        )
    except Exception as e:
        return jsonify(
            {
                "status": "error",
                "message": f"Could not connect to API: {str(e)}",
                "models": [],
            }
        )


# Conversations Endpoints
@app.route("/api/conversations", methods=["GET", "POST"])
def handle_conversations():
    conn = get_db_connection()
    if request.method == "POST":
        data = request.json or {}
        conv_id = str(uuid.uuid4())
        title = data.get("title", "New Chat").strip()
        conn.execute(
            "INSERT INTO conversations (id, title) VALUES (?, ?)", (conv_id, title)
        )
        conn.commit()
        conn.close()
        return jsonify({"id": conv_id, "title": title})

    # GET method
    rows = conn.execute(
        "SELECT id, title, created_at FROM conversations ORDER BY created_at DESC"
    ).fetchall()
    conversations = [dict(r) for r in rows]
    conn.close()
    return jsonify(conversations)


@app.route("/api/conversations/<conv_id>", methods=["DELETE", "PUT"])
def modify_conversation(conv_id):
    conn = get_db_connection()
    if request.method == "DELETE":
        conn.execute("DELETE FROM conversations WHERE id = ?", (conv_id,))
        conn.execute("DELETE FROM messages WHERE conversation_id = ?", (conv_id,))
        conn.commit()
        conn.close()
        return jsonify({"status": "success"})

    elif request.method == "PUT":
        data = request.json or {}
        title = data.get("title", "").strip()
        if not title:
            return jsonify({"status": "error", "message": "Title cannot be empty"}), 400
        conn.execute(
            "UPDATE conversations SET title = ? WHERE id = ?", (title, conv_id)
        )
        conn.commit()
        conn.close()
        return jsonify({"status": "success", "title": title})


@app.route("/api/conversations/<conv_id>/messages", methods=["GET"])
def get_messages(conv_id):
    conn = get_db_connection()
    rows = conn.execute(
        "SELECT role, content FROM messages WHERE conversation_id = ? ORDER BY created_at ASC",
        (conv_id,),
    ).fetchall()
    messages = [dict(r) for r in rows]
    conn.close()
    return jsonify(messages)


# Chat stream
@app.route("/api/chat", methods=["POST"])
def chat():
    data = request.json
    conv_id = data.get("conversation_id")
    user_message = data.get("message", "").strip()
    think_mode = data.get("think_mode", False)

    if not conv_id or not user_message:
        return (
            jsonify(
                {"status": "error", "message": "Missing conversation_id or message"}
            ),
            400,
        )

    conn = get_db_connection()

    # Check if conversation exists, if not create it
    conv = conn.execute(
        "SELECT id FROM conversations WHERE id = ?", (conv_id,)
    ).fetchone()
    if not conv:

        conn.execute(
            "INSERT INTO conversations (id, title) VALUES (?, ?)",
            (conv_id, user_message[:30] + ("..." if len(user_message) > 30 else "")),
        )

    # Save user message
    user_msg_id = str(uuid.uuid4())
    conn.execute(
        "INSERT INTO messages (id, conversation_id, role, content) VALUES (?, ?, 'user', ?)",
        (user_msg_id, conv_id, user_message),
    )
    conn.commit()

    # Retrieve chat history for context
    rows = conn.execute(
        "SELECT role, content FROM messages WHERE conversation_id = ? ORDER BY created_at ASC",
        (conv_id,),
    ).fetchall()
    history = []
    for r in rows:
        history.append({"role": r["role"], "content": r["content"]})

    conn.close()

    # Setup prompt modifier for Think Mode if toggled
    # If think mode is enabled, we append instructions to prompt or system.
    # LM Studio and Qwen 3.5 support system instructions. We insert or modify system prompt.
    system_prompt = "You are a helpful assistant."
    if think_mode:
        system_prompt += "\nIMPORTANT: You MUST show your step-by-step thinking process inside <think>...</think> tags before you provide the final response. For example:\n<think>\nThinking process goes here...\n</think>\nYour actual response here."
    else:
        system_prompt += "\nIMPORTANT: Provide a direct response. Do not use <think> tags or output a thinking process."

    # Build payload messages
    api_messages = [{"role": "system", "content": system_prompt}] + history

    api_url = get_setting("api_url")
    model_name = get_setting("model_name")

    headers = {"Content-Type": "application/json"}

    payload = {
        "model": model_name,
        "messages": api_messages,
        "stream": True,
        "temperature": 0.7,
    }

    def generate():
        assistant_content = []
        try:
            response = requests.post(
                f"{api_url}/chat/completions",
                headers=headers,
                json=payload,
                stream=True,
                timeout=10,
            )

            if response.status_code != 200:
                error_msg = f"Error: API returned status code {response.status_code}"
                yield f"data: {json.dumps({'error': error_msg})}\n\n"
                return

            for line in response.iter_lines():
                if line:
                    decoded = line.decode("utf-8")
                    if decoded.startswith("data: "):
                        data_str = decoded[6:]
                        if data_str.strip() == "[DONE]":
                            break
                        try:
                            chunk_json = json.loads(data_str)
                            delta = chunk_json.get("choices", [{}])[0].get("delta", {})
                            content = delta.get("content", "")
                            if content:
                                assistant_content.append(content)
                                yield f"data: {json.dumps({'content': content})}\n\n"
                        except json.JSONDecodeError:
                            continue

            # Stream completed, save to database
            full_response = "".join(assistant_content)
            if full_response:
                db_conn = get_db_connection()
                assist_msg_id = str(uuid.uuid4())
                db_conn.execute(
                    "INSERT INTO messages (id, conversation_id, role, content) VALUES (?, ?, 'assistant', ?)",
                    (assist_msg_id, conv_id, full_response),
                )
                db_conn.commit()
                db_conn.close()

        except requests.exceptions.RequestException as e:
            error_msg = f"Error connecting to LM Studio API: {str(e)}. Please check if your LM Studio server is running and the API endpoint is correct."
            yield f"data: {json.dumps({'error': error_msg})}\n\n"

    return Response(generate(), mimetype="text/event-stream")


if __name__ == "__main__":
    app.run(host="0.0.0.0", port=5001, debug=True)
