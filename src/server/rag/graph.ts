import { Annotation, END, START, StateGraph } from "@langchain/langgraph";
import { callLlm } from "@/server/rag/providers";
import type { ApiKeyStore, LlmProvider, RagDocument } from "@/shared/types";

type RagState = {
  question: string;
  temperature: number;
  topP: number;
  maxTokens: number;
  documents: RagDocument[];
  answer: string;
  provider: LlmProvider;
  model: string;
  apiKeys: ApiKeyStore;
};

const RagStateAnnotation = Annotation.Root({
  question: Annotation<string>(),
  temperature: Annotation<number>(),
  topP: Annotation<number>(),
  maxTokens: Annotation<number>(),
  documents: Annotation<RagDocument[]>(),
  answer: Annotation<string>(),
  provider: Annotation<LlmProvider>(),
  model: Annotation<string>(),
  apiKeys: Annotation<ApiKeyStore>(),
});

function formatDocumentContext(documents: RagDocument[]) {
  return documents
    .map(
      (document, index) =>
        `Source ${index + 1}: ${document.title}\nSource name: ${document.sourceName}\nContent:\n${document.content}`
    )
    .join("\n\n---\n\n");
}

async function answerQuestion(state: RagState) {
  const context = state.documents.length > 0 ? formatDocumentContext(state.documents) : "No retrieved context.";
  const response = await callLlm({
    provider: state.provider,
    model: state.model,
    temperature: state.temperature,
    topP: state.topP,
    maxTokens: state.maxTokens,
    messages: [
      { role: "system", content: "You are the assistant for Multi-Source Agentic RAG Platform. Answer only from supplied context when possible. If context misses answer, say what is missing. Cite source numbers inline like [1], [2]. Keep answer concise and specific." },
      { role: "user", content: `Question:\n${state.question}\n\nContext:\n${context}` },
    ],
    apiKeys: state.apiKeys,
  });
  return { answer: response };
}

export async function runRagGraph(
  question: string,
  options: {
    temperature?: number;
    topP?: number;
    maxTokens?: number;
    provider?: LlmProvider;
    model?: string;
    apiKeys?: ApiKeyStore;
    documents?: RagDocument[];
  } = {}
) {
  const {
    temperature = 0.2,
    topP = 0.9,
    maxTokens = 4096,
    provider = "nvidia",
    model = "meta/llama-3.1-70b-instruct",
    apiKeys = {},
    documents = [],
  } = options;

  // In-context RAG: documents come from the client (keyword search via OPFS).
  // No server-side retrieval needed.
  const graph = new StateGraph(RagStateAnnotation)
    .addNode("respond", answerQuestion)
    .addEdge(START, "respond")
    .addEdge("respond", END)
    .compile();

  const result = await graph.invoke({
    question,
    temperature,
    topP,
    maxTokens,
    provider,
    model,
    apiKeys,
    documents,
  });

  return {
    answer: result.answer,
    documents: result.documents,
  };
}

export function formatAnswerSourceList(documents: RagDocument[]) {
  return documents.map((document, index) => ({
    rank: index + 1,
    title: document.title,
    sourceName: document.sourceName,
    sourceUrl: document.sourceUrl,
    similarity: document.similarity ?? null,
  }));
}