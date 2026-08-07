import { Annotation, END, START, StateGraph } from "@langchain/langgraph";
import { callLlm } from "@/server/rag/providers";
import type { ApiKeyStore, LlmProvider, RagDocument } from "@/shared/types";

type RagState = {
  question: string;
  temperature: number;
  topP: number;
  maxTokens: number;
  documents: RagDocument[];
  conversationHistory: { role: "user" | "assistant"; content: string }[];
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
  conversationHistory: Annotation<Array<{ role: "user" | "assistant"; content: string }>>(),
  answer: Annotation<string>(),
  provider: Annotation<LlmProvider>(),
  model: Annotation<string>(),
  apiKeys: Annotation<any>(),
});

function formatDocumentContext(documents: RagDocument[]) {
  if (documents.length === 0) return "No retrieved context.";
  return documents
    .map(
      (doc, index) => {
        const sim = doc.similarity !== undefined ? ` (relevance: ${(doc.similarity * 100).toFixed(0)}%)` : "";
        return `Source ${index + 1}: ${doc.title}${sim}\nSource name: ${doc.sourceName}\nContent:\n${doc.content}`;
      },
    )
    .join("\n\n---\n\n");
}

async function answerQuestion(state: RagState) {
  const context = formatDocumentContext(state.documents);
  const response = await callLlm({
    provider: state.provider,
    model: state.model,
    temperature: state.temperature,
    topP: state.topP,
    maxTokens: state.maxTokens,
    messages: [
      {
        role: "system",
        content:
          "Answer as helpful chat assistant. Use provided documents when relevant. Be concise — 1-3 sentences. " +
          "If documents contain relevant info, answer directly even if partial. " +
          "If documents do not address question, answer from conversation history or general knowledge.",
      },
      ...state.conversationHistory,
      {
        role: "user",
        content: `Question:\n${state.question}\n\nContext:\n${context}`,
      },
    ],
    apiKeys: state.apiKeys,
  });
  return { answer: response };
}

// ── Two-node graph: retrieve → respond ────────────────────────────
// `retrieve` is only added when `enableRetrieval: true`.
// The existing `runRagGraph` (no retrieval) is kept for backward compat.

async function retrieveDocuments(state: RagState): Promise<Partial<RagState>> {
  // Injected by runRagGraphWithRetrieval via the retrieve function
  const retrieveFn = (state as unknown as { _retrieve: () => Promise<RagDocument[]> })._retrieve;
  if (!retrieveFn) {
    return { documents: [] };
  }
  const documents = await retrieveFn();
  return { documents };
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
    conversationHistory?: { role: "user" | "assistant"; content: string }[];
  } = {},
) {
  const {
    temperature = 0.2,
    topP = 0.9,
    maxTokens = 4096,
    provider = "nvidia",
    model = "meta/llama-3.3-70b-instruct",
    apiKeys = {},
    documents = [],
    conversationHistory = [],
  } = options;

  // In-context RAG: documents come from client. No server-side retrieval.
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
    conversationHistory,
  });

  return { answer: result.answer, documents: result.documents };
}

/**
 * Full RAG pipeline with server-side retrieval.
 * `retrieve` is an async function that returns RagDocument[].
 */
export async function runRagGraphWithRetrieval(
  question: string,
  retrieve: () => Promise<RagDocument[]>,
  options: {
    temperature?: number;
    topP?: number;
    maxTokens?: number;
    provider?: LlmProvider;
    model?: string;
    apiKeys?: ApiKeyStore;
  } = {},
) {
  const {
    temperature = 0.2,
    topP = 0.9,
    maxTokens = 4096,
    provider = "nvidia",
    model = "meta/llama-3.3-70b-instruct",
    apiKeys = {},
  } = options;

  const graph = new StateGraph(RagStateAnnotation)
    .addNode("retrieve", retrieveDocuments)
    .addNode("respond", answerQuestion)
    .addEdge(START, "retrieve")
    .addEdge("retrieve", "respond")
    .addEdge("respond", END)
    .compile();

  // Inject retrieve function into state context
  const initialState = {
    question,
    temperature,
    topP,
    maxTokens,
    provider,
    model,
    apiKeys,
    documents: [] as RagDocument[],
    _retrieve: retrieve,
  } as RagState & { _retrieve: () => Promise<RagDocument[]> };

  const result = await graph.invoke(initialState);

  return { answer: result.answer, documents: result.documents };
}

export function formatAnswerSourceList(documents: RagDocument[]) {
  return documents.map((doc, index) => ({
    rank: index + 1,
    title: doc.title,
    sourceName: doc.sourceName,
    sourceUrl: doc.sourceUrl,
    similarity: doc.similarity ?? null,
  }));
}