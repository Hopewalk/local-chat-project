class RenameForm:
    def __init__(self, data):
        self.data = data or {}
        self.errors = {}
        self.title = None

    def validate(self):
        title = self.data.get('title', '').strip()
        if not title:
            self.errors['title'] = "Title cannot be empty"
        else:
            self.title = title

        return len(self.errors) == 0
