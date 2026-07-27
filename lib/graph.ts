import { HumanMessage, SystemMessage } from "@langchain/core/messages";
import { Annotation, END, START, StateGraph } from "@langchain/langgraph";
import { createNimChatModel } from "@/lib/nim";
import { retrieveDocuments } from "@/lib/retrieval";
import type { RagDocument } from "@/lib/types";

type RagState = {
  question: string;
  topK: number;
  documents: RagDocument[];
  answer: string;
};

const RagStateAnnotation = Annotation.Root({
  question: Annotation<string>(),
  topK: Annotation<number>(),
  documents: Annotation<RagDocument[]>(),
  answer: Annotation<string>()
});

function formatDocumentContext(documents: RagDocument[]) {
  return documents
    .map(
      (document, index) =>
        `Source ${index + 1}: ${document.title}\nSource name: ${document.sourceName}\nScore: ${document.similarity?.toFixed(3) ?? "n/a"}\nContent:\n${document.content}`
    )
    .join("\n\n---\n\n");
}

async function answerQuestion(question: string, documents: RagDocument[]) {
  const chatModel = createNimChatModel();
  const context = documents.length > 0 ? formatDocumentContext(documents) : "No retrieved context.";
  const response = await chatModel.invoke([
    new SystemMessage(
      "You are the assistant for Multi-Source Agentic RAG Platform. Answer only from supplied context when possible. If context misses answer, say what is missing. Cite source numbers inline like [1], [2]. Keep answer concise and specific."
    ),
    new HumanMessage(`Question:\n${question}\n\nContext:\n${context}`)
  ]);

  if (typeof response.content === "string") {
    return response.content;
  }

  if (Array.isArray(response.content)) {
    return response.content.map((part) => (typeof part === "string" ? part : JSON.stringify(part))).join("\n");
  }

  return String(response.content);
}

export async function runRagGraph(question: string, topK = 4) {
  const graph = new StateGraph(RagStateAnnotation)
    .addNode("retrieve", async (state: RagState) => ({
      documents: await retrieveDocuments(state.question, state.topK)
    }))
    .addNode("answer", async (state: RagState) => ({
      answer: await answerQuestion(state.question, state.documents)
    }))
    .addEdge(START, "retrieve")
    .addEdge("retrieve", "answer")
    .addEdge("answer", END)
    .compile();

  const result = await graph.invoke({ question, topK });

  return {
    answer: result.answer,
    documents: result.documents
  };
}

export function formatAnswerSourceList(documents: RagDocument[]) {
  return documents.map((document, index) => ({
    rank: index + 1,
    title: document.title,
    sourceName: document.sourceName,
    sourceUrl: document.sourceUrl,
    similarity: document.similarity ?? null
  }));
}