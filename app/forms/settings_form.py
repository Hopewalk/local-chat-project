class SettingsForm:
    def __init__(self, data):
        self.data = data or {}
        self.errors = {}
        self.api_url = None
        self.model_name = None
        self.system_prompt = None
        self.temperature = None

    def validate(self):
        # 1. API URL validation
        api_url = self.data.get('api_url', '').strip()
        if api_url:
            if not (api_url.startswith('http://') or api_url.startswith('https://')):
                self.errors['api_url'] = "API URL must start with http:// or https://"
            else:
                self.api_url = api_url

        # 2. Model Name validation
        model_name = self.data.get('model_name', '').strip()
        if model_name:
            self.model_name = model_name

        # 3. System Prompt validation
        system_prompt = self.data.get('system_prompt', '').strip()
        if system_prompt:
            self.system_prompt = system_prompt

        # 4. Temperature validation
        temp_val = self.data.get('temperature')
        if temp_val is not None:
            try:
                temp_float = float(temp_val)
                if not (0.0 <= temp_float <= 1.0):
                    self.errors['temperature'] = "Temperature must be between 0.0 and 1.0"
                else:
                    self.temperature = str(temp_float)
            except ValueError:
                self.errors['temperature'] = "Temperature must be a valid number"

        return len(self.errors) == 0
