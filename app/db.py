import pymongo
from flask import current_app

class Database:
    def __init__(self):
        self.client = None
        self.db = None
        self.settings_col = None
        self.conversations_col = None
        self.messages_col = None

    def init_app(self, app):
        mongo_uri = app.config['MONGO_URI']
        db_name = app.config['MONGO_DB']
        
        try:
            self.client = pymongo.MongoClient(mongo_uri, serverSelectionTimeoutMS=2000)
            self.db = self.client[db_name]
            
            # Collections
            self.settings_col = self.db['settings']
            self.conversations_col = self.db['conversations']
            self.messages_col = self.db['messages']
            
            # Test connection
            self.client.server_info()
            app.logger.info(f"Successfully connected to MongoDB at {mongo_uri}")
            
            # Initialize default settings
            self.init_defaults(app)
        except Exception as e:
            app.logger.error(f"Could not connect to MongoDB: {str(e)}")

    def init_defaults(self, app):
        if self.settings_col is not None:
            if not self.settings_col.find_one({"key": "system_prompt"}):
                self.settings_col.insert_one({"key": "system_prompt", "value": "You are a helpful assistant."})
            if not self.settings_col.find_one({"key": "temperature"}):
                self.settings_col.insert_one({"key": "temperature", "value": "0.7"})

    def get_setting(self, key, default=None):
        if self.settings_col is None:
            return default
        try:
            row = self.settings_col.find_one({"key": key})
            return row['value'] if row else default
        except Exception as e:
            print("Error getting setting:", e)
            return default

    def set_setting(self, key, value):
        if self.settings_col is None:
            return
        try:
            self.settings_col.update_one({"key": key}, {"$set": {"value": value}}, upsert=True)
        except Exception as e:
            print("Error setting setting:", e)

    def ping(self):
        if self.client is None:
            return False
        try:
            self.client.server_info()
            return True
        except Exception:
            return False

# Singleton database instance
db = Database()
