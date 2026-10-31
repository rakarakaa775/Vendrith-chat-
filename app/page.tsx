"use client";

import { useMemo, useState } from "react";
import { filterConversations } from "@/lib/filter-conversations.mjs";

const conversations = [
  { initials: "EL", name: "Elaria Moonwhisper", message: "The northern gate is ready.", time: "09:42", unread: 2, online: true, tone: "violet", messages: [{ sender: "Elaria", body: "The northern gate is ready. The scouts have returned with news from the old forest.", time: "09:38", mine: false }, { sender: "You", body: "That was faster than expected. Did they find a safe route?", time: "09:40", mine: true }, { sender: "Elaria", body: "Yes. I marked it on the map. We should meet before sunset.", time: "09:42", mine: false }] },
  { initials: "TH", name: "Thorne Ashford", message: "Did you find the map fragment?", time: "Yesterday", unread: 0, online: true, tone: "green", messages: [{ sender: "Thorne", body: "Did you find the map fragment?", time: "Yesterday", mine: false }] },
  { initials: "MY", name: "Myrin Vale", message: "I left the supplies near the docks.", time: "Yesterday", unread: 0, online: false, tone: "gold", messages: [{ sender: "Myrin", body: "I left the supplies near the docks.", time: "Yesterday", mine: false }] },
  { initials: "KA", name: "Kael of the Vale", message: "See you at the guild hall.", time: "Mon", unread: 0, online: false, tone: "blue", messages: [{ sender: "Kael", body: "See you at the guild hall.", time: "Mon", mine: false }] }
];

export default function Home() {
  const [selectedName, setSelectedName] = useState(conversations[0].name);
  const [mobileShowList, setMobileShowList] = useState(false);
  const [search, setSearch] = useState("");
  const selected = conversations.find((chat) => chat.name === selectedName) ?? conversations[0];
  const filteredConversations = useMemo(
    () => filterConversations(conversations, search),
    [search]
  );

  return (
    <main className={`app-shell ${mobileShowList ? "mobile-list-open" : "mobile-chat-open"}`}>
      <aside className="sidebar">
        <div className="brand">
          <div className="brand-mark">V</div>
          <div><strong>VENDRITH</strong><span>PLAYER MESSENGER</span></div>
        </div>
        <div className="profile">
          <div className="avatar avatar-you">V</div>
          <div className="profile-copy"><strong>Adventurer</strong><span>Local preview</span></div>
          <button className="icon-button" aria-label="Profile options" disabled>···</button>
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
            <button className={`conversation ${selectedName === chat.name ? "selected" : ""}`} key={chat.name} type="button" onClick={() => { setSelectedName(chat.name); setMobileShowList(false); }}>
              <span className={`avatar avatar-${chat.tone}`}>{chat.initials}</span>
              <span className="conversation-copy"><strong>{chat.name}</strong><span>{chat.message}</span></span>
              <span className="conversation-meta"><time>{chat.time}</time>{chat.unread > 0 && <i>{chat.unread}</i>}</span>
              {chat.online && <b className="online-dot" />}
            </button>
          ))}
          {filteredConversations.length === 0 && <p className="empty-search">No conversations found.</p>}
        </div>
        <div className="sidebar-footer"><span className="status-dot" /> Preview mode · Messages are not sent</div>
      </aside>

      <section className="chat-panel" aria-label="Conversation preview">
        <header className="chat-header">
          <button className="mobile-back icon-button" type="button" aria-label="Back to conversations" onClick={() => setMobileShowList(true)}>←</button>
          <div className={`avatar avatar-${selected.tone}`}>{selected.initials}</div>
          <div className="chat-person"><strong>{selected.name}</strong><span>{selected.online ? <><i className="online-dot" /> Online in Vendrith</> : "Last seen recently"}</span></div>
          <div className="chat-actions"><button className="icon-button" aria-label="Search in conversation" disabled>⌕</button><button className="icon-button" aria-label="More options" disabled>···</button></div>
        </header>
        <div className="chat-background">
          <div className="date-divider"><span>TODAY</span></div>
          {selected.messages.map((message, index) => (
            <div className={`message-row ${message.mine ? "mine" : "theirs"}`} key={`${selected.name}-${index}`}>
              {!message.mine && <div className="message-avatar">{selected.initials}</div>}
              <div className="bubble-wrap">{!message.mine && <span className="sender">{message.sender}</span>}<div className="bubble">{message.body}</div><time>{message.time}{message.mine && <span className="read-mark"> ✓✓</span>}</time></div>
            </div>
          ))}
          <div className="preview-notice"><span>✦</span><div><strong>Design preview</strong><p>These sample messages are illustrative only. Chat delivery and storage are not connected yet.</p></div></div>
        </div>
        <form className="composer" onSubmit={(event) => event.preventDefault()}>
          <button type="button" className="icon-button attach" aria-label="Attachments (not available in preview)" disabled>＋</button>
          <input aria-label="Message composer" placeholder="Messaging is not available in preview" disabled />
          <button type="submit" className="send-button" disabled aria-label="Send message">➤</button>
        </form>
        <div className="mobile-footnote">Vendrith Chat · Preview only</div>
      </section>
    </main>
  );
}
