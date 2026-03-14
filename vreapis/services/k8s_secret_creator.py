import json
import logging
import os

import requests

from django.conf import settings


logger = logging.getLogger(__name__)


class K8sSecretCreator:
    def __init__(self):
        self.url = os.environ['K8S_SECRET_CREATOR_URL']
        self.token = os.environ['K8S_SECRET_CREATOR_TOKEN']

    def create_secret(self, data):
        resp = requests.post(
            self.url,
            verify=(not settings.ALLOW_INSECURE_TLS),
            headers={
                'accept': 'application/json',
                'Content-Type': 'application/json',
                'X-Auth': self.token,
                },
            data=json.dumps(data),
            )
        if resp.status_code != 200:
            logger.error(f"Secret submission failed: {resp.json()}")
        resp.raise_for_status()
        return resp.json()
