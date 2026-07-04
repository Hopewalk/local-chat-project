import datetime
import json
import os
import uuid
import pymongo
import requests
from flask import Flask, Response, jsonify, render_template, request
from dotenv import load_dotenv

# Load environment variables from .env file
load_dotenv()

app = Flask(__name__)

# MongoDB Configuration
MONGO_URI = os.environ.get('MONGO_URI', 'mongodb://localhost:27017/')
db_name = os.environ.get('MONGO_DB', 'lumina_chat')

try:
    mongo_client = pymongo.MongoClient(MONGO_URI, serverSelectionTimeoutMS=2000)
    db = mongo_client[db_name]
    
    # Collections
    settings_col = db['settings']
    conversations_col = db['conversations']
    messages_col = db['messages']
    
    # Test connection
    mongo_client.server_info()
    print(f"Connected to MongoDB at {MONGO_URI}")
except Exception as e:
    print(f"Warning: Could not connect to MongoDB: {str(e)}")
    print("Please make sure MongoDB is running.")

def init_db():
    # Insert default settings if not exists
    if not settings_col.find_one({"key": "api_url"}):
        settings_col.insert_one({"key": "api_url", "value": "http://localhost:1234/v1"})
    if not settings_col.find_one({"key": "model_name"}):
        settings_col.insert_one({"key": "model_name", "value": "qwen/qwen3.5-9b"})

# Initialize database defaults
try:
    init_db()
except Exception as e:
    print("Failed to initialize database defaults:", e)

def get_setting(key, default=None):
    try:
        row = settings_col.find_one({"key": key})
        return row['value'] if row else default
    except Exception as e:
        print("Error getting setting:", e)
        return default

def normalize_api_url(url):
    if not url:
        return ""
    url = url.strip().rstrip('/')
    if not url.endswith('/v1'):
        url = f"{url}/v1"
    return url

def get_api_url():
    # If BASE_URL is set in environment, prioritize it. Otherwise fallback to database setting.
    env_base = os.environ.get('BASE_URL')
    if env_base:
        return normalize_api_url(env_base)
    return normalize_api_url(get_setting('api_url', 'http://localhost:1234/v1'))

def get_model_name():
    # If MODEL_NAME is set in environment, prioritize it. Otherwise fallback to database setting.
    env_model = os.environ.get('MODEL_NAME')
    if env_model:
        return env_model.strip()
    return get_setting('model_name', 'qwen/qwen3.5-9b')

def set_setting(key, value):
    try:
        settings_col.update_one({"key": key}, {"$set": {"value": value}}, upsert=True)
    except Exception as e:
        print("Error setting setting:", e)

@app.route('/')
def index():
    return render_template('index.html')

# Settings Endpoints
@app.route('/api/settings', methods=['GET', 'POST'])
def handle_settings():
    if request.method == 'POST':
        data = request.json
        api_url = data.get('api_url', '').strip().rstrip('/')
        model_name = data.get('model_name', '').strip()
        
        if api_url:
            set_setting('api_url', api_url)
        if model_name:
            set_setting('model_name', model_name)
            
        return jsonify({"status": "success", "api_url": get_api_url(), "model_name": get_model_name()})
    
    return jsonify({
        "api_url": get_api_url(),
        "model_name": get_model_name()
    })

@app.route('/api/models', methods=['GET'])
def get_available_models():
    api_url = get_api_url()
    try:
        response = requests.get(f"{api_url}/models", timeout=3)
        if response.status_code == 200:
            models_data = response.json()
            models = [m['id'] for m in models_data.get('data', [])]
            return jsonify({"status": "success", "models": models})
        return jsonify({"status": "error", "message": f"API returned status {response.status_code}", "models": []})
    except Exception as e:
        return jsonify({"status": "error", "message": f"Could not connect to API: {str(e)}", "models": []})

# Conversations Endpoints
@app.route('/api/conversations', methods=['GET', 'POST'])
def handle_conversations():
    if request.method == 'POST':
        data = request.json or {}
        conv_id = str(uuid.uuid4())
        title = data.get('title', 'New Chat').strip()
        
        conversations_col.insert_one({
            "_id": conv_id,
            "title": title,
            "created_at": datetime.datetime.now(datetime.timezone.utc)
        })
        return jsonify({"id": conv_id, "title": title})
    
    # GET method
    rows = conversations_col.find().sort("created_at", pymongo.DESCENDING)
    conversations = []
    for r in rows:
        conversations.append({
            "id": r["_id"],
            "title": r["title"],
            "created_at": r["created_at"].isoformat() if isinstance(r["created_at"], datetime.datetime) else str(r["created_at"])
        })
    return jsonify(conversations)

@app.route('/api/conversations/<conv_id>', methods=['DELETE', 'PUT'])
def modify_conversation(conv_id):
    if request.method == 'DELETE':
        conversations_col.delete_one({"_id": conv_id})
        messages_col.delete_many({"conversation_id": conv_id})
        return jsonify({"status": "success"})
    
    elif request.method == 'PUT':
        data = request.json or {}
        title = data.get('title', '').strip()
        if not title:
            return jsonify({"status": "error", "message": "Title cannot be empty"}), 400
        
        conversations_col.update_one({"_id": conv_id}, {"$set": {"title": title}})
        return jsonify({"status": "success", "title": title})

@app.route('/api/conversations/<conv_id>/messages', methods=['GET'])
def get_messages(conv_id):
    rows = messages_col.find({"conversation_id": conv_id}).sort("created_at", pymongo.ASCENDING)
    messages = []
    for r in rows:
        messages.append({
            "role": r["role"],
            "content": r["content"]
        })
    return jsonify(messages)

# Chat stream
@app.route('/api/chat', methods=['POST'])
def chat():
    data = request.json
    conv_id = data.get('conversation_id')
    user_message = data.get('message', '').strip()
    think_mode = data.get('think_mode', False)
    
    if not conv_id or not user_message:
        return jsonify({"status": "error", "message": "Missing conversation_id or message"}), 400
    
    # Check if conversation exists, if not create it
    conv = conversations_col.find_one({"_id": conv_id})
    if not conv:
        conversations_col.insert_one({
            "_id": conv_id,
            "title": user_message[:30] + ('...' if len(user_message) > 30 else ''),
            "created_at": datetime.datetime.now(datetime.timezone.utc)
        })
        
    # Save user message
    user_msg_id = str(uuid.uuid4())
    messages_col.insert_one({
        "_id": user_msg_id,
        "conversation_id": conv_id,
        "role": "user",
        "content": user_message,
        "created_at": datetime.datetime.now(datetime.timezone.utc)
    })
    
    # Retrieve chat history for context
    rows = messages_col.find({"conversation_id": conv_id}).sort("created_at", pymongo.ASCENDING)
    history = []
    for r in rows:
        history.append({"role": r['role'], "content": r['content']})
    
    # Setup prompt modifier for Think Mode
    system_prompt = "You are a helpful assistant."
    if think_mode:
        system_prompt += "\nIMPORTANT: You MUST show your step-by-step thinking process inside <think>...</think> tags before you provide the final response. For example:\n<think>\nThinking process goes here...\n</think>\nYour actual response here."
    else:
        system_prompt += "\nIMPORTANT: Provide a direct response. Do not use <think> tags or output a thinking process."
        
    # Build payload messages
    api_messages = [{"role": "system", "content": system_prompt}] + history
    
    api_url = get_api_url()
    model_name = get_model_name()
    
    headers = {
        "Content-Type": "application/json"
    }
    
    payload = {
        "model": model_name,
        "messages": api_messages,
        "stream": True,
        "temperature": 0.7
    }
    
    def generate():
        assistant_content = []
        try:
            response = requests.post(f"{api_url}/chat/completions", headers=headers, json=payload, stream=True, timeout=10)
            
            if response.status_code != 200:
                error_msg = f"Error: API returned status code {response.status_code}"
                yield f"data: {json.dumps({'error': error_msg})}\n\n"
                return
                
            for line in response.iter_lines():
                if line:
                    decoded = line.decode('utf-8')
                    if decoded.startswith("data: "):
                        data_str = decoded[6:]
                        if data_str.strip() == "[DONE]":
                            break
                        try:
                            chunk_json = json.loads(data_str)
                            delta = chunk_json.get('choices', [{}])[0].get('delta', {})
                            content = delta.get('content', '')
                            if content:
                                assistant_content.append(content)
                                yield f"data: {json.dumps({'content': content})}\n\n"
                        except json.JSONDecodeError:
                            continue
                            
            # Stream completed, save to database
            full_response = "".join(assistant_content)
            if full_response:
                assist_msg_id = str(uuid.uuid4())
                messages_col.insert_one({
                    "_id": assist_msg_id,
                    "conversation_id": conv_id,
                    "role": "assistant",
                    "content": full_response,
                    "created_at": datetime.datetime.now(datetime.timezone.utc)
                })
                
        except requests.exceptions.RequestException as e:
            error_msg = f"Error connecting to LM Studio API: {str(e)}. Please check if your LM Studio server is running and the API endpoint is correct."
            yield f"data: {json.dumps({'error': error_msg})}\n\n"
            
    return Response(generate(), mimetype='text/event-stream')

if __name__ == '__main__':
    flask_port = int(os.environ.get('FLASK_PORT', 5001))
    flask_debug = os.environ.get('FLASK_DEBUG', 'True').lower() in ('true', '1', 't', 'y', 'yes')
    app.run(host='0.0.0.0', port=flask_port, debug=flask_debug)
