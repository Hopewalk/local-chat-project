class ChatForm:
    def __init__(self, data):
        self.data = data or {}
        self.errors = {}
        self.conversation_id = None
        self.message = None
        self.think_mode = False

    def validate(self):
        # 1. Conversation ID validation (required UUID string)
        conv_id = self.data.get('conversation_id', '').strip()
        if not conv_id:
            self.errors['conversation_id'] = "conversation_id is required"
        else:
            self.conversation_id = conv_id

        # 2. Message validation (required non-empty string)
        message = self.data.get('message', '').strip()
        if not message:
            self.errors['message'] = "message cannot be empty"
        else:
            self.message = message

        # 3. Think Mode
        self.think_mode = bool(self.data.get('think_mode', False))

        return len(self.errors) == 0
