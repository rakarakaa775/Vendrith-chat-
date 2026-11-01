"use client";

import { useEffect, useMemo, useState } from "react";
import { filterConversations } from "../lib/filter-conversations.mjs";
import { createLocalChatStore, type ChatMessage } from "../lib/chat-engine.mjs";
import { createSupabaseBrowserClient } from "../lib/supabase/browser";

type Conversation = {
  id: string;
  initials: string;
  name: string;
  message: string;
  time: string;
  unread: number;
  online: boolean;
  tone: string;
};

const conversations: Conversation[] = [
  { id: "elaria", initials: "EL", name: "Elaria Moonwhisper", message: "The northern gate is ready.", time: "09:42", unread: 2, online: true, tone: "violet" },
  { id: "thorne", initials: "TH", name: "Thorne Ashford", message: "Did you find the map fragment?", time: "Yesterday", unread: 0, online: true, tone: "green" },
  { id: "myrin", initials: "MY", name: "Myrin Vale", message: "I left the supplies near the docks.", time: "Yesterday", unread: 0, online: false, tone: "gold" },
  { id: "kael", initials: "KA", name: "Kael of the Vale", message: "See you at the guild hall.", time: "Mon", unread: 0, online: false, tone: "blue" }
];

const initialMessages: Record<string, ChatMessage[]> = {
  elaria: [
    { id: "el-1", clientMessageId: "el-1", conversationId: "elaria", senderId: "elaria", sender: "Elaria", body: "The northern gate is ready. The scouts have returned with news from the old forest.", createdAt: "2026-11-01T09:38:00.000Z", time: "09:38", mine: false, status: "saved_locally" },
    { id: "el-2", clientMessageId: "el-2", conversationId: "elaria", senderId: "local-player", sender: "You", body: "That was faster than expected. Did they find a safe route?", createdAt: "2026-11-01T09:40:00.000Z", time: "09:40", mine: true, status: "saved_locally" },
    { id: "el-3", clientMessageId: "el-3", conversationId: "elaria", senderId: "elaria", sender: "Elaria", body: "Yes. I marked it on the map. We should meet before sunset.", createdAt: "2026-11-01T09:42:00.000Z", time: "09:42", mine: false, status: "saved_locally" }
  ],
  thorne: [{ id: "th-1", clientMessageId: "th-1", conversationId: "thorne", senderId: "thorne", sender: "Thorne", body: "Did you find the map fragment?", createdAt: "2026-10-31T09:00:00.000Z", time: "Yesterday", mine: false, status: "saved_locally" }],
  myrin: [{ id: "my-1", clientMessageId: "my-1", conversationId: "myrin", senderId: "myrin", sender: "Myrin", body: "I left the supplies near the docks.", createdAt: "2026-10-31T08:00:00.000Z", time: "Yesterday", mine: false, status: "saved_locally" }],
  kael: [{ id: "ka-1", clientMessageId: "ka-1", conversationId: "kael", senderId: "kael", sender: "Kael", body: "See you at the guild hall.", createdAt: "2026-10-26T08:00:00.000Z", time: "Mon", mine: false, status: "saved_locally" }]
};

function createStore() {
  return createLocalChatStore(window.localStorage, { seed: initialMessages });
}

export default function ChatPreview({ authenticatedLabel }: { authenticatedLabel?: string }) {
  const [selectedId, setSelectedId] = useState(conversations[0].id);
  const [mobileShowList, setMobileShowList] = useState(false);
  const [search, setSearch] = useState("");
  const [draft, setDraft] = useState("");
  const [sendError, setSendError] = useState("");
  const [pending, setPending] = useState(false);
  const [failedRequest, setFailedRequest] = useState<{ conversationId: string; clientMessageId: string; body: string } | null>(null);
  const [storageProblem, setStorageProblem] = useState<"corrupt" | "invalid" | "unavailable" | null>(null);
  const [messagesByConversation, setMessagesByConversation] = useState(initialMessages);

  useEffect(() => {
    try {
      setMessagesByConversation(createStore().load());
    } catch (error) {
      const code = (error as { code?: string })?.code;
      if (code === "corrupt_local_store") setStorageProblem("corrupt");
      else if (code === "invalid_local_store") setStorageProblem("invalid");
      else setStorageProblem("unavailable");
      setSendError(error instanceof Error ? error.message : "Local message storage is unavailable.");
    }
  }, []);

  const selected = conversations.find((chat) => chat.id === selectedId) ?? conversations[0];
  const selectedMessages = messagesByConversation[selected.id] ?? [];
  const filteredConversations = useMemo(() => {
    const searchable = conversations.map((chat) => ({
      ...chat,
      message: messagesByConversation[chat.id]?.at(-1)?.body ?? chat.message
    }));
    return filterConversations(searchable, search);
  }, [search, messagesByConversation]);

  async function saveMessage(request: { conversationId: string; clientMessageId: string; body: string }) {
    if (pending || storageProblem === "corrupt" || storageProblem === "invalid") return;
    setPending(true);
    setSendError("");
    await new Promise((resolve) => window.setTimeout(resolve, 0));
    try {
      const result = createStore().send({
        conversationId: request.conversationId,
        senderId: "local-player",
        clientMessageId: request.clientMessageId,
        body: request.body,
        sender: "You",
        mine: true
      });
      setMessagesByConversation((current) => ({ ...current, [request.conversationId]: result.messages }));
      setDraft((current) => current === request.body ? "" : current);
      setFailedRequest(null);
      setSendError("");
    } catch (error) {
      setFailedRequest(request);
      setSendError(error instanceof Error ? error.message : "Message could not be saved on this device.");
    } finally {
      setPending(false);
    }
  }

  function handleSend(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!draft.trim() || pending) return;
    void saveMessage({
      conversationId: selected.id,
      clientMessageId: window.crypto.randomUUID(),
      body: draft
    });
  }

  function handleDownloadBackup() {
    try {
      const raw = createStore().exportRaw();
      if (raw === null) {
        setSendError("No saved local data was found to back up.");
        return;
      }
      const blob = new Blob([raw], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = "vendrith-chat-local-backup.json";
      link.click();
      URL.revokeObjectURL(url);
      setSendError("A copy of the existing local data was prepared for download.");
    } catch {
      setSendError("The browser could not read local data for backup. Do not reset this browser's storage.");
    }
  }

  function handleResetLocalData() {
    const confirmed = window.confirm("This will replace the unreadable local preview data with the original sample conversations. Download a backup first if you want to preserve the existing raw data. Continue?");
    if (!confirmed) return;
    try {
      const restored = createStore().reset({ confirmed: true });
      setMessagesByConversation(restored);
      setStorageProblem(null);
      setFailedRequest(null);
      setSendError("Local preview data was reset to the sample conversations.");
    } catch (error) {
      setSendError(error instanceof Error ? error.message : "Local data could not be reset.");
    }
  }

  return (
    <main className={`app-shell ${mobileShowList ? "mobile-list-open" : "mobile-chat-open"}`}>
      <aside className="sidebar">
        <div className="brand">
          <div className="brand-mark">V</div>
          <div><strong>VENDRITH</strong><span>PLAYER MESSENGER</span></div>
        </div>
        <div className="profile">
          <div className="avatar avatar-you">V</div>
          <div className="profile-copy"><strong>{authenticatedLabel ?? "Adventurer"}</strong><span>{authenticatedLabel ? "Non-production test account" : "Local preview"}</span></div>
          {authenticatedLabel ? <button className="icon-button" aria-label="Sign out" type="button" onClick={async () => { await createSupabaseBrowserClient().auth.signOut(); window.location.assign("/login"); }}>↗</button> : <button className="icon-button" aria-label="Profile options" disabled>···</button>}
        </div>
        <div className="section-heading"><span>MESSAGES</span><button className="icon-button" aria-label="New conversation" disabled>＋</button></div>
        <nav className="nav-tabs" aria-label="Chat sections">
          <button className="nav-tab active" type="button">Chats <span>4</span></button>
          <button className="nav-tab" type="button" disabled>Friends</button>
          <button className="nav-tab" type="button" disabled>Groups</button>
        </nav>
        <label className="search-box"><span>⌕</span><input aria-label="Search conversations" placeholder="Search conversations" value={search} onChange={(event) => setSearch(event.target.value)} /></label>
        <div className="conversation-list">
          {filteredConversations.map((chat) => (
            <button className={`conversation ${selectedId === chat.id ? "selected" : ""}`} key={chat.id} type="button" onClick={() => { setSelectedId(chat.id); setMobileShowList(false); }}>
              <span className={`avatar avatar-${chat.tone}`}>{chat.initials}</span>
              <span className="conversation-copy"><strong>{chat.name}</strong><span>{chat.message}</span></span>
              <span className="conversation-meta"><time>{chat.time}</time>{chat.unread > 0 && <i>{chat.unread}</i>}</span>
              {chat.online && <b className="online-dot" />}
            </button>
          ))}
          {filteredConversations.length === 0 && <p className="empty-search">No conversations found.</p>}
        </div>
        <div className="sidebar-footer"><span className="status-dot" /> Local preview · Messages stay on this device</div>
      </aside>

      <section className="chat-panel" aria-label="Conversation">
        <header className="chat-header">
          <button className="mobile-back icon-button" type="button" aria-label="Back to conversations" onClick={() => setMobileShowList(true)}>←</button>
          <div className={`avatar avatar-${selected.tone}`}>{selected.initials}</div>
          <div className="chat-person"><strong>{selected.name}</strong><span>{selected.online ? <><i className="online-dot" /> Preview presence</> : "Sample conversation"}</span></div>
          <div className="chat-actions"><button className="icon-button" aria-label="Search in conversation" disabled>⌕</button><button className="icon-button" aria-label="More options" disabled>···</button></div>
        </header>
        <div className="chat-background" aria-live="polite">
          <div className="date-divider"><span>CONVERSATION</span></div>
          {selectedMessages.map((message) => (
            <div className={`message-row ${message.mine ? "mine" : "theirs"}`} key={message.id}>
              {!message.mine && <div className="message-avatar">{selected.initials}</div>}
              <div className="bubble-wrap">
                {!message.mine && <span className="sender">{message.sender}</span>}
                <div className="bubble">{message.body}</div>
                <time>{message.time}{message.mine && message.status === "saved_locally" && <span className="read-mark"> · Saved on this device</span>}</time>
              </div>
            </div>
          ))}
          {storageProblem && <div className="storage-recovery" role="alert">
            <strong>{storageProblem === "corrupt" ? "Saved chat data could not be read" : storageProblem === "invalid" ? "Saved chat data has an unsupported format" : "Browser storage is unavailable"}</strong>
            <p>{storageProblem === "unavailable" ? "Your browser may block local storage or have run out of space. Your message draft is kept in the composer." : "The existing data has not been automatically deleted or overwritten. Download a copy before choosing to reset the local preview."}</p>
            {storageProblem !== "unavailable" && <div className="recovery-actions"><button type="button" onClick={handleDownloadBackup}>Download data backup</button><button type="button" onClick={handleResetLocalData}>Reset local preview</button></div>}
          </div>}
          <div className="preview-notice"><span>✦</span><div><strong>{authenticatedLabel ? "Non-production authentication · Local chat storage" : "Local preview mode"}</strong><p>{authenticatedLabel ? "Your test identity is verified by the isolated non-production Auth project. Message history is still saved only in this browser on this device; remote delivery and synchronization are not enabled." : "Messages are saved only in this browser on this device. They are not delivered to another player or synchronized with a server."}</p>{authenticatedLabel && <a className="backend-console-link" href="/test-chat">Open non-production backend test console</a>}</div></div>
        </div>
        <form className="composer" onSubmit={handleSend}>
          <input aria-label="Message composer" placeholder="Write a message..." value={draft} onChange={(event) => { setDraft(event.target.value); setFailedRequest(null); setSendError(""); }} maxLength={4000} disabled={pending || storageProblem === "corrupt" || storageProblem === "invalid"} />
          <button type="submit" className="send-button" aria-label="Save message locally" disabled={!draft.trim() || pending || storageProblem === "corrupt" || storageProblem === "invalid"}>➤</button>
        </form>
        <div className="composer-feedback" role="status">
          <span>{pending ? "Saving on this device…" : sendError || String(draft.length) + "/4000 characters · Local storage only"}</span>
          {failedRequest && <button className="retry-button" type="button" disabled={pending} onClick={() => void saveMessage(failedRequest)}>Retry saving to {conversations.find((chat) => chat.id === failedRequest.conversationId)?.name ?? "conversation"}</button>}
        </div>
        <div className="mobile-footnote">Vendrith Chat · Local preview only</div>
      </section>
    </main>
  );
}
