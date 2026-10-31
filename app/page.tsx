const conversations = [
  { initials: "EL", name: "Elaria Moonwhisper", message: "The northern gate is ready.", time: "09:42", unread: 2, online: true, tone: "violet" },
  { initials: "TH", name: "Thorne Ashford", message: "Did you find the map fragment?", time: "Yesterday", unread: 0, online: true, tone: "green" },
  { initials: "MY", name: "Myrin Vale", message: "I left the supplies near the docks.", time: "Yesterday", unread: 0, online: false, tone: "gold" },
  { initials: "KA", name: "Kael of the Vale", message: "See you at the guild hall.", time: "Mon", unread: 0, online: false, tone: "blue" }
];

export default function Home() {
  return (
    <main className="app-shell">
      <aside className="sidebar">
        <div className="brand">
          <div className="brand-mark">V</div>
          <div><strong>VENDRITH</strong><span>PLAYER MESSENGER</span></div>
        </div>
        <div className="profile">
          <div className="avatar avatar-you">R</div>
          <div className="profile-copy"><strong>Adventurer</strong><span>Local preview</span></div>
          <button className="icon-button" aria-label="Profile options">···</button>
        </div>
        <div className="section-heading"><span>MESSAGES</span><button className="icon-button" aria-label="New conversation">＋</button></div>
        <nav className="nav-tabs" aria-label="Chat sections">
          <button className="nav-tab active">Chats <span>4</span></button>
          <button className="nav-tab">Friends</button>
          <button className="nav-tab">Groups</button>
        </nav>
        <label className="search-box"><span>⌕</span><input aria-label="Search conversations" placeholder="Search conversations" /></label>
        <div className="conversation-list">
          {conversations.map((chat, index) => (
            <button className={`conversation ${index === 0 ? "selected" : ""}`} key={chat.name}>
              <span className={`avatar avatar-${chat.tone}`}>{chat.initials}</span>
              <span className="conversation-copy"><strong>{chat.name}</strong><span>{chat.message}</span></span>
              <span className="conversation-meta"><time>{chat.time}</time>{chat.unread > 0 && <i>{chat.unread}</i>}</span>
              {chat.online && <b className="online-dot" />}
            </button>
          ))}
        </div>
        <div className="sidebar-footer"><span className="status-dot" /> Preview mode · Messages are not sent</div>
      </aside>

      <section className="chat-panel" aria-label="Conversation preview">
        <header className="chat-header">
          <div className="avatar avatar-violet">EL</div>
          <div className="chat-person"><strong>Elaria Moonwhisper</strong><span><i className="online-dot" /> Online in Vendrith</span></div>
          <div className="chat-actions"><button className="icon-button" aria-label="Search in conversation">⌕</button><button className="icon-button" aria-label="More options">···</button></div>
        </header>
        <div className="chat-background">
          <div className="date-divider"><span>TODAY</span></div>
          <div className="message-row theirs"><div className="message-avatar">EL</div><div className="bubble-wrap"><span className="sender">Elaria</span><div className="bubble">The northern gate is ready. The scouts have returned with news from the old forest.</div><time>09:38</time></div></div>
          <div className="message-row mine"><div className="bubble-wrap"><div className="bubble">That was faster than expected. Did they find a safe route?</div><time>09:40 <span className="read-mark">✓✓</span></time></div></div>
          <div className="message-row theirs"><div className="message-avatar">EL</div><div className="bubble-wrap"><span className="sender">Elaria</span><div className="bubble">Yes. I marked it on the map. We should meet before sunset.</div><time>09:42</time></div></div>
          <div className="preview-notice"><span>✦</span><div><strong>Design preview</strong><p>These sample messages are illustrative only. Chat delivery and storage are not connected yet.</p></div></div>
        </div>
        <form className="composer" action="#">
          <button type="button" className="icon-button attach" aria-label="Attachments (not available in preview)">＋</button>
          <input aria-label="Message composer" placeholder="Write a message..." disabled />
          <button type="button" className="send-button" disabled aria-label="Send message">➤</button>
        </form>
        <div className="mobile-footnote">Vendrith Chat · Preview only</div>
      </section>
    </main>
  );
}