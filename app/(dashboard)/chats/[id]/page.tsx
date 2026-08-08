"use client";

import { useParams } from "next/navigation";
import ChatView from "../../components/ChatView";

export default function ChatByIdPage() {
  const params = useParams<{ id: string }>();
  const chatId = params?.id ?? "";

  return <ChatView chatId={chatId} />;
}
