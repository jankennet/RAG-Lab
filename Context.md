# I want this as a SaaS where a user can: input their own API-keys Nvidia nim, open-ai, antropic, and then, maybe supabase(?) I still don't know.

# The goal of the project: User can Upload their own datasets or test other datasets from url or what, then have a chat page where they will ask the agent what they want.

# UI should take inspiration from ChatGPT or Claude

app/
│
├── (dashboard)
│ ├── layout.tsx
│ │
│ ├── page.tsx // Chat
│ │
│ ├── datasets/
│ │ page.tsx
│ │ [id]/
│ │ page.tsx
│ │
│ ├── settings/
│ │ page.tsx
│ │
│ └── components/
│ Sidebar.tsx
│ Header.tsx
│ ChatInput.tsx
│ ChatMessage.tsx
│ DatasetCard.tsx
│ SourceCard.tsx
│ ApiKeyCard.tsx
│ ModelSelector.tsx
│
├── api/
│
└── globals.css

# Newly added Structure
