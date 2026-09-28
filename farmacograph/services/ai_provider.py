"""AI Provider abstraction layer for multiple LLM providers."""

from __future__ import annotations

import os
from typing import Any, Protocol
from dataclasses import dataclass


@dataclass
class AIProviderConfig:
    """Configuration for an AI provider."""
    provider: str
    api_key: str
    model: str
    base_url: str | None = None


class AIProvider(Protocol):
    """Protocol for AI providers."""

    async def generate(
        self,
        prompt: str,
        system_prompt: str | None = None,
        temperature: float = 0.7,
        max_tokens: int = 2000,
    ) -> str:
        """Generate text from prompt."""
        ...


class OpenAIProvider:
    """OpenAI API provider."""

    def __init__(self, config: AIProviderConfig):
        self.api_key = config.api_key
        self.model = config.model
        self.base_url = config.base_url or "https://api.openai.com/v1"

    async def generate(
        self,
        prompt: str,
        system_prompt: str | None = None,
        temperature: float = 0.7,
        max_tokens: int = 2000,
    ) -> str:
        import httpx

        messages = []
        if system_prompt:
            messages.append({"role": "system", "content": system_prompt})
        messages.append({"role": "user", "content": prompt})

        async with httpx.AsyncClient() as client:
            response = await client.post(
                f"{self.base_url}/chat/completions",
                headers={
                    "Authorization": f"Bearer {self.api_key}",
                    "Content-Type": "application/json",
                },
                json={
                    "model": self.model,
                    "messages": messages,
                    "temperature": temperature,
                    "max_tokens": max_tokens,
                },
                timeout=60.0,
            )
            response.raise_for_status()
            data = response.json()
            return data["choices"][0]["message"]["content"]


class AnthropicProvider:
    """Anthropic Claude API provider."""

    def __init__(self, config: AIProviderConfig):
        self.api_key = config.api_key
        self.model = config.model

    async def generate(
        self,
        prompt: str,
        system_prompt: str | None = None,
        temperature: float = 0.7,
        max_tokens: int = 2000,
    ) -> str:
        import httpx

        messages = [{"role": "user", "content": prompt}]

        async with httpx.AsyncClient() as client:
            response = await client.post(
                "https://api.anthropic.com/v1/messages",
                headers={
                    "x-api-key": self.api_key,
                    "anthropic-version": "2023-06-01",
                    "Content-Type": "application/json",
                },
                json={
                    "model": self.model,
                    "messages": messages,
                    "system": system_prompt or "",
                    "temperature": temperature,
                    "max_tokens": max_tokens,
                },
                timeout=60.0,
            )
            response.raise_for_status()
            data = response.json()
            return data["content"][0]["text"]


class OllamaProvider:
    """Ollama local LLM provider."""

    def __init__(self, config: AIProviderConfig):
        self.model = config.model
        self.base_url = config.base_url or "http://localhost:11434"

    async def generate(
        self,
        prompt: str,
        system_prompt: str | None = None,
        temperature: float = 0.7,
        max_tokens: int = 2000,
    ) -> str:
        import httpx

        full_prompt = prompt
        if system_prompt:
            full_prompt = f"{system_prompt}\n\n{prompt}"

        async with httpx.AsyncClient() as client:
            response = await client.post(
                f"{self.base_url}/api/generate",
                json={
                    "model": self.model,
                    "prompt": full_prompt,
                    "stream": False,
                    "options": {
                        "temperature": temperature,
                        "num_predict": max_tokens,
                    },
                },
                timeout=120.0,
            )
            response.raise_for_status()
            data = response.json()
            return data["response"]


def create_provider(config: AIProviderConfig) -> AIProvider:
    """Create an AI provider based on configuration."""
    providers = {
        "openai": OpenAIProvider,
        "anthropic": AnthropicProvider,
        "ollama": OllamaProvider,
    }

    provider_class = providers.get(config.provider.lower())
    if not provider_class:
        raise ValueError(f"Unknown provider: {config.provider}")

    return provider_class(config)


# Available models for each provider
AVAILABLE_MODELS = {
    "openai": [
        {"id": "gpt-4o", "name": "GPT-4o (Recommended)"},
        {"id": "gpt-4o-mini", "name": "GPT-4o Mini (Fast)"},
        {"id": "gpt-4-turbo", "name": "GPT-4 Turbo"},
        {"id": "gpt-3.5-turbo", "name": "GPT-3.5 Turbo"},
    ],
    "anthropic": [
        {"id": "claude-3-5-sonnet-20241022", "name": "Claude 3.5 Sonnet (Recommended)"},
        {"id": "claude-3-opus-20240229", "name": "Claude 3 Opus"},
        {"id": "claude-3-haiku-20240307", "name": "Claude 3 Haiku (Fast)"},
    ],
    "ollama": [
        {"id": "llama3.1", "name": "Llama 3.1"},
        {"id": "mistral", "name": "Mistral"},
        {"id": "mixtral", "name": "Mixtral"},
        {"id": "phi3", "name": "Phi-3"},
    ],
}
