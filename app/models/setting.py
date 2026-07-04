from app.db import db

class SettingModel:
    @staticmethod
    def get(key, default=None):
        if db.settings_col is None:
            return default
        try:
            row = db.settings_col.find_one({"key": key})
            return row['value'] if row else default
        except Exception as e:
            print("Error getting setting:", e)
            return default

    @staticmethod
    def set(key, value):
        if db.settings_col is None:
            return False
        try:
            db.settings_col.update_one({"key": key}, {"$set": {"value": value}}, upsert=True)
            return True
        except Exception as e:
            print("Error setting setting:", e)
            return False
