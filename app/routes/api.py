import datetime
import json
import os
import uuid
import pymongo
import requests
from flask import Blueprint, Response, jsonify, request, current_app
from app.db import db

api_bp = Blueprint('api', __name__)

def normalize_api_url(url):
    if not url:
        return ""
    url = url.strip().rstrip('/')
    if not url.endswith('/v1'):
        url = f"{url}/v1"
    return url

def get_api_url():
    # Priority: 1. Database config (UI settings), 2. Environment config
    db_base = db.get_setting('api_url')
    if db_base:
        return normalize_api_url(db_base)
    
    env_base = current_app.config.get('BASE_URL')
    if env_base:
        return normalize_api_url(env_base)
    return 'http://localhost:1234/v1'

def get_model_name():
    # Priority: 1. Database config (UI settings), 2. Environment config
    db_model = db.get_setting('model_name')
    if db_model:
        return db_model.strip()
        
    env_model = current_app.config.get('MODEL_NAME')
    if env_model:
        return env_model.strip()
    return 'qwen/qwen3.5-9b'

@api_bp.route('/settings', methods=['GET', 'POST'])
def handle_settings():
    if request.method == 'POST':
        data = request.json or {}
        api_url = data.get('api_url', '').strip().rstrip('/')
        model_name = data.get('model_name', '').strip()
        system_prompt = data.get('system_prompt', '').strip()
        temperature = data.get('temperature', '0.7').strip()
        
        if api_url:
            db.set_setting('api_url', api_url)
        if model_name:
            db.set_setting('model_name', model_name)
        if system_prompt:
            db.set_setting('system_prompt', system_prompt)
        if temperature:
            db.set_setting('temperature', temperature)
            
        return jsonify({
            "status": "success", 
            "api_url": get_api_url(), 
            "model_name": get_model_name(),
            "system_prompt": db.get_setting('system_prompt', 'You are a helpful assistant.'),
            "temperature": float(db.get_setting('temperature', '0.7')),
            "mongo_status": db.ping()
        })
    
    return jsonify({
        "api_url": get_api_url(),
        "model_name": get_model_name(),
        "system_prompt": db.get_setting('system_prompt', 'You are a helpful assistant.'),
        "temperature": float(db.get_setting('temperature', '0.7')),
        "mongo_status": db.ping()
    })

@api_bp.route('/models', methods=['GET'])
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
@api_bp.route('/conversations', methods=['GET', 'POST'])
def handle_conversations():
    if db.conversations_col is None:
        return jsonify([])
    if request.method == 'POST':
        data = request.json or {}
        conv_id = str(uuid.uuid4())
        title = data.get('title', 'New Chat').strip()
        
        db.conversations_col.insert_one({
            "_id": conv_id,
            "title": title,
            "created_at": datetime.datetime.now(datetime.timezone.utc)
        })
        return jsonify({"id": conv_id, "title": title})
    
    # GET method
    rows = db.conversations_col.find().sort("created_at", pymongo.DESCENDING)
    conversations = []
    for r in rows:
        conversations.append({
            "id": r["_id"],
            "title": r["title"],
            "created_at": r["created_at"].isoformat() if isinstance(r["created_at"], datetime.datetime) else str(r["created_at"])
        })
    return jsonify(conversations)

@api_bp.route('/conversations/<conv_id>', methods=['DELETE', 'PUT'])
def modify_conversation(conv_id):
    if db.conversations_col is None or db.messages_col is None:
        return jsonify({"status": "error", "message": "Database not connected"}), 500
    if request.method == 'DELETE':
        db.conversations_col.delete_one({"_id": conv_id})
        db.messages_col.delete_many({"conversation_id": conv_id})
        return jsonify({"status": "success"})
    
    elif request.method == 'PUT':
        data = request.json or {}
        title = data.get('title', '').strip()
        if not title:
            return jsonify({"status": "error", "message": "Title cannot be empty"}), 400
        
        db.conversations_col.update_one({"_id": conv_id}, {"$set": {"title": title}})
        return jsonify({"status": "success", "title": title})

@api_bp.route('/conversations/<conv_id>/messages', methods=['GET'])
def get_messages(conv_id):
    if db.messages_col is None:
        return jsonify([])
    rows = db.messages_col.find({"conversation_id": conv_id}).sort("created_at", pymongo.ASCENDING)
    messages = []
    for r in rows:
        messages.append({
            "role": r["role"],
            "content": r["content"]
        })
    return jsonify(messages)

@api_bp.route('/chat', methods=['POST'])
def chat():
    data = request.json
    conv_id = data.get('conversation_id')
    user_message = data.get('message', '').strip()
    think_mode = data.get('think_mode', False)
    
    if not conv_id or not user_message:
        return jsonify({"status": "error", "message": "Missing conversation_id or message"}), 400
        
    if db.messages_col is None or db.conversations_col is None:
        return jsonify({"status": "error", "message": "Database not connected"}), 500

    # Check if conversation exists, if not create it
    conv = db.conversations_col.find_one({"_id": conv_id})
    if not conv:
        db.conversations_col.insert_one({
            "_id": conv_id,
            "title": user_message[:30] + ('...' if len(user_message) > 30 else ''),
            "created_at": datetime.datetime.now(datetime.timezone.utc)
        })

    # Save user message
    user_msg_id = str(uuid.uuid4())
    db.messages_col.insert_one({
        "_id": user_msg_id,
        "conversation_id": conv_id,
        "role": "user",
        "content": user_message,
        "created_at": datetime.datetime.now(datetime.timezone.utc)
    })
    
    # Retrieve chat history for context
    rows = db.messages_col.find({"conversation_id": conv_id}).sort("created_at", pymongo.ASCENDING)
    history = []
    for r in rows:
        history.append({"role": r['role'], "content": r['content']})
    
    # Setup system prompt from settings
    system_prompt = db.get_setting('system_prompt', 'You are a helpful assistant.')
    
    # Modify for Think Mode if active
    if think_mode:
        system_prompt += "\nIMPORTANT: You MUST show your step-by-step thinking process inside <think>...</think> tags before you provide the final response. For example:\n<think>\nThinking process goes here...\n</think>\nYour actual response here."
    else:
        system_prompt += "\nIMPORTANT: Provide a direct response. Do not use <think> tags or output a thinking process."
        
    # Build payload messages
    api_messages = [{"role": "system", "content": system_prompt}] + history
    
    api_url = get_api_url()
    model_name = get_model_name()
    temperature = float(db.get_setting('temperature', '0.7'))
    
    headers = {
        "Content-Type": "application/json"
    }
    
    payload = {
        "model": model_name,
        "messages": api_messages,
        "stream": True,
        "temperature": temperature
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
            if full_response and db.messages_col is not None:
                assist_msg_id = str(uuid.uuid4())
                db.messages_col.insert_one({
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
