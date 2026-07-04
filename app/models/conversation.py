import datetime
import uuid
import pymongo
from app.db import db

class ConversationModel:
    @staticmethod
    def create(title="New Chat"):
        if db.conversations_col is None:
            return None
        conv_id = str(uuid.uuid4())
        db.conversations_col.insert_one({
            "_id": conv_id,
            "title": title,
            "created_at": datetime.datetime.now(datetime.timezone.utc)
        })
        return {"id": conv_id, "title": title}

    @staticmethod
    def list_all():
        if db.conversations_col is None:
            return []
        rows = db.conversations_col.find().sort("created_at", pymongo.DESCENDING)
        conversations = []
        for r in rows:
            conversations.append({
                "id": r["_id"],
                "title": r["title"],
                "created_at": r["created_at"].isoformat() if isinstance(r["created_at"], datetime.datetime) else str(r["created_at"])
            })
        return conversations

    @staticmethod
    def rename(conv_id, title):
        if db.conversations_col is None:
            return False
        db.conversations_col.update_one({"_id": conv_id}, {"$set": {"title": title}})
        return True

    @staticmethod
    def delete(conv_id):
        if db.conversations_col is None or db.messages_col is None:
            return False
        db.conversations_col.delete_one({"_id": conv_id})
        db.messages_col.delete_many({"conversation_id": conv_id})
        return True

    @staticmethod
    def exists(conv_id):
        if db.conversations_col is None:
            return False
        return db.conversations_col.count_documents({"_id": conv_id}) > 0
