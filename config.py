import os
from dotenv import load_dotenv

load_dotenv()

class Config:
    SECRET_KEY = os.environ.get('SECRET_KEY', 'hope-chat-secret-key-129847192')
    
    # MongoDB Config
    MONGO_URI = os.environ.get('MONGO_URI', 'mongodb://localhost:27017/')
    MONGO_DB = os.environ.get('MONGO_DB', 'hope_chat')
    
    # Flask Server Settings
    PORT = int(os.environ.get('FLASK_PORT', 5001))
    DEBUG = os.environ.get('FLASK_DEBUG', 'True').lower() in ('true', '1', 't', 'y', 'yes')
