import { ChatAnthropic } from "@langchain/anthropic";
import { ChatOpenAI } from "@langchain/openai";
import { SystemMessage, HumanMessage, AIMessage } from "@langchain/core/messages";
import { ApiKeyStore, LlmProvider } from "@/shared/types";

interface CallLlmParams {
  provider: LlmProvider;
  model: string;
  messages: Array<{ role: "system" | "user" | "assistant"; content: string }>;
  apiKeys: ApiKeyStore;
}

export async function callLlm({ provider, model, messages, apiKeys }: CallLlmParams): Promise<string> {
  // Get the API key for the provider
  const apiKeyEntry = apiKeys[provider];
  if (!apiKeyEntry || !apiKeyEntry.key) {
    throw new Error(`API key for provider ${provider} is missing`);
  }

  // Create the chat model based on the provider
  let chatModel;
  switch (provider) {
    case "nvidia":
      // NVIDIA NIM uses the OpenAI-compatible API
      chatModel = new ChatOpenAI({
        model,
        apiKey: apiKeyEntry.key,
        configuration: {
          baseURL: "https://integrate.api.nvidia.com/v1",
        },
        temperature: 0.2,
      });
      break;
    case "openai":
      chatModel = new ChatOpenAI({
        model,
        apiKey: apiKeyEntry.key,
        temperature: 0.2,
      });
      break;
    case "anthropic":
      chatModel = new ChatAnthropic({
        model,
        apiKey: apiKeyEntry.key,
        temperature: 0.2,
      });
      break;
    default:
      throw new Error(`Unsupported provider: ${provider}`);
  }

  // Convert messages to the format expected by LangChain
  const lcMessages = messages.map((m) => {
    if (m.role === "system") {
      return new SystemMessage(m.content);
    } else if (m.role === "user") {
      return new HumanMessage(m.content);
    } else if (m.role === "assistant") {
      return new AIMessage(m.content);
    }
    throw new Error(`Unknown message role: ${m.role}`);
  });

  // Call the model
  const response = await chatModel.invoke(lcMessages);
  return response.content.toString();
}