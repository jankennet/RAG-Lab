import { Annotation, END, START, StateGraph } from "@langchain/langgraph";
import { retrieveDocuments } from "@/server/rag/retrieval";
import { callLlm } from "@/server/rag/providers";
import type { ApiKeyStore, LlmProvider, RagDocument } from "@/shared/types";

// We'll keep the helper functions in this file to avoid circular dependencies.

type RagState = {
  question: string;
  topK: number;
  documents: RagDocument[];
  answer: string;
  provider: LlmProvider;
  model: string;
  apiKeys: ApiKeyStore;
};

const RagStateAnnotation = Annotation.Root({
  question: Annotation<string>(),
  topK: Annotation<number>(),
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
        `Source ${index + 1}: ${document.title}\nSource name: ${document.sourceName}\nScore: ${document.similarity?.toFixed(3) ?? "n/a"}\nContent:\n${document.content}`
    )
    .join("\n\n---\n\n");
}

async function answerQuestion(state: RagState) {
  const context = state.documents.length > 0 ? formatDocumentContext(state.documents) : "No retrieved context.";
  const response = await callLlm({
    provider: state.provider,
    model: state.model,
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
  options: { topK?: number; provider?: LlmProvider; model?: string; apiKeys?: ApiKeyStore } = {}
) {
  const {
    topK = 4,
    provider = "nvidia",
    model = "meta/llama-3.1-70b-instruct",
    apiKeys = {}
  } = options;

  const graph = new StateGraph(RagStateAnnotation)
    .addNode("retrieve", async (state: RagState) => ({
      documents: await retrieveDocuments(state.question, state.topK, state.provider, state.apiKeys),
    }))
    .addNode("respond", answerQuestion)
    .addEdge(START, "retrieve")
    .addEdge("retrieve", "respond")
    .addEdge("respond", END)
    .compile();

  const result = await graph.invoke({
    question,
    topK,
    provider,
    model,
    apiKeys
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