import datetime
import uuid
import pymongo
from app.db import db

class MessageModel:
    @staticmethod
    def save(conv_id, role, content):
        if db.messages_col is None:
            return None
        msg_id = str(uuid.uuid4())
        db.messages_col.insert_one({
            "_id": msg_id,
            "conversation_id": conv_id,
            "role": role,
            "content": content,
            "created_at": datetime.datetime.now(datetime.timezone.utc)
        })
        return msg_id

    @staticmethod
    def get_history(conv_id):
        if db.messages_col is None:
            return []
        rows = db.messages_col.find({"conversation_id": conv_id}).sort("created_at", pymongo.ASCENDING)
        messages = []
        for r in rows:
            messages.append({
                "role": r["role"],
                "content": r["content"]
            })
        return messages
