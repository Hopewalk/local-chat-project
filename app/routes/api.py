import json
import requests
from flask import Blueprint, Response, jsonify, request
from app.db import db
from app.models import SettingModel, ConversationModel, MessageModel
from app.forms import SettingsForm, ChatForm, RenameForm

api_bp = Blueprint('api', __name__)

def normalize_api_url(url):
    if not url:
        return ""
    url = url.strip().rstrip('/')
    if not url.endswith('/v1'):
        url = f"{url}/v1"
    return url

def get_api_url():
    # Load strictly from SettingModel (UI settings)
    db_base = SettingModel.get('api_url')
    if db_base:
        return normalize_api_url(db_base)
    return 'http://localhost:1234/v1'

def get_model_name():
    # Load strictly from SettingModel (UI settings)
    db_model = SettingModel.get('model_name')
    if db_model:
        return db_model.strip()
    return 'qwen/qwen3.5-9b'

@api_bp.route('/settings', methods=['GET', 'POST'])
def handle_settings():
    if request.method == 'POST':
        form = SettingsForm(request.json)
        if not form.validate():
            return jsonify({"status": "error", "errors": form.errors}), 400
            
        if form.api_url:
            SettingModel.set('api_url', form.api_url)
        if form.model_name:
            SettingModel.set('model_name', form.model_name)
        if form.system_prompt:
            SettingModel.set('system_prompt', form.system_prompt)
        if form.temperature:
            SettingModel.set('temperature', form.temperature)
            
        return jsonify({
            "status": "success", 
            "api_url": get_api_url(), 
            "model_name": get_model_name(),
            "system_prompt": SettingModel.get('system_prompt', 'You are a helpful assistant.'),
            "temperature": float(SettingModel.get('temperature', '0.7')),
            "mongo_status": db.ping()
        })
    
    return jsonify({
        "api_url": get_api_url(),
        "model_name": get_model_name(),
        "system_prompt": SettingModel.get('system_prompt', 'You are a helpful assistant.'),
        "temperature": float(SettingModel.get('temperature', '0.7')),
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
    if request.method == 'POST':
        data = request.json or {}
        title = data.get('title', 'New Chat').strip()
        new_conv = ConversationModel.create(title)
        if new_conv is None:
            return jsonify({"status": "error", "message": "Database not connected"}), 500
        return jsonify(new_conv)
    
    return jsonify(ConversationModel.list_all())

@api_bp.route('/conversations/<conv_id>', methods=['DELETE', 'PUT'])
def modify_conversation(conv_id):
    if request.method == 'DELETE':
        success = ConversationModel.delete(conv_id)
        if not success:
            return jsonify({"status": "error", "message": "Failed to delete conversation"}), 500
        return jsonify({"status": "success"})
    
    elif request.method == 'PUT':
        form = RenameForm(request.json)
        if not form.validate():
            return jsonify({"status": "error", "errors": form.errors}), 400
        
        success = ConversationModel.rename(conv_id, form.title)
        if not success:
            return jsonify({"status": "error", "message": "Failed to rename conversation"}), 500
        return jsonify({"status": "success", "title": form.title})

@api_bp.route('/conversations/<conv_id>/messages', methods=['GET'])
def get_messages(conv_id):
    return jsonify(MessageModel.get_history(conv_id))

@api_bp.route('/chat', methods=['POST'])
def chat():
    form = ChatForm(request.json)
    if not form.validate():
        return jsonify({"status": "error", "errors": form.errors}), 400
        
    conv_id = form.conversation_id
    user_message = form.message
    think_mode = form.think_mode

    # Check if conversation exists, if not create it
    if not ConversationModel.exists(conv_id):
        ConversationModel.create(user_message[:30] + ('...' if len(user_message) > 30 else ''))

    # Save user message
    MessageModel.save(conv_id, "user", user_message)
    
    # Retrieve chat history for context
    history = MessageModel.get_history(conv_id)
    
    # Setup system prompt from settings
    system_prompt = SettingModel.get('system_prompt', 'You are a helpful assistant.')
    
    # Modify for Think Mode if active
    if think_mode:
        system_prompt += "\nIMPORTANT: You MUST show your step-by-step thinking process inside <think>...</think> tags before you provide the final response. For example:\n<think>\nThinking process goes here...\n</think>\nYour actual response here."
    else:
        system_prompt += "\nIMPORTANT: Provide a direct response. Do not use <think> tags or output a thinking process."
        
    # Build payload messages
    api_messages = [{"role": "system", "content": system_prompt}] + history
    
    api_url = get_api_url()
    model_name = get_model_name()
    temperature = float(SettingModel.get('temperature', '0.7'))
    
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
            if full_response:
                MessageModel.save(conv_id, "assistant", full_response)
                
        except requests.exceptions.RequestException as e:
            error_msg = f"Error connecting to LM Studio API: {str(e)}. Please check if your LM Studio server is running and the API endpoint is correct."
            yield f"data: {json.dumps({'error': error_msg})}\n\n"
            
    return Response(generate(), mimetype='text/event-stream')
