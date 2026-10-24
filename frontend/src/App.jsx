
import { useState } from "react";
import "./App.css";

const API_URL = "http://127.0.0.1:8000/api/chat";

const INITIAL_PROJECTS = [
  { id: 1, name: "My first project" },
];

const SUGGESTIONS = [
  {
    icon: "☷",
    title: "Define requirements",
    description: "Turn an idea into clear, testable requirements.",
    prompt:
      "Help me define clear, testable requirements for my software project. Ask me any essential questions first.",
  },
  {
    icon: "⑂",
    title: "Create a development plan",
    description: "Break the project into actionable tasks.",
    prompt:
      "Help me create a step-by-step development plan with tasks, dependencies, priorities, and acceptance criteria.",
  },
  {
    icon: "◇",
    title: "Review constraints",
    description: "Identify risks, assumptions, and limitations.",
    prompt:
      "Help me identify the requirements, constraints, assumptions, risks, and edge cases for my project.",
  },
  {
    icon: "✓",
    title: "Plan verification",
    description: "Define how to prove the implementation works.",
    prompt:
      "Help me design a verification plan with testable acceptance criteria, test cases, and evidence required for each requirement.",
  },
];

const NAV_ITEMS = [
  { label: "Workspace", icon: "▦", text: "Overview" },
  { label: "Requirements", icon: "☷", text: "Requirements" },
  { label: "Development plan", icon: "⑂", text: "Development plan" },
  { label: "Verification", icon: "◇", text: "Verification" },
];

function formatMessage(content = "") {
  return content.split("\n").map((line, index) => (
    <span key={index}>
      {line}
      {index < content.split("\n").length - 1 && <br />}
    </span>
  ));
}

export default function App() {
  const [input, setInput] = useState("");
  const [messages, setMessages] = useState([]);
  const [activePage, setActivePage] = useState("Workspace");
  const [projects, setProjects] = useState(INITIAL_PROJECTS);
  const [activeProject, setActiveProject] = useState(1);
  const [showProjects, setShowProjects] = useState(true);
  const [isSending, setIsSending] = useState(false);
  const [apiStatus, setApiStatus] = useState("unknown");

  const currentProject =
    projects.find((project) => project.id === activeProject) ||
    projects[0];

  function newChat() {
    setMessages([]);
    setInput("");
    setActivePage("Workspace");
    setIsSending(false);
  }

  function createProject() {
    const name = window.prompt("Enter a name for your project:");
    if (!name || !name.trim()) return;

    const project = {
      id: Date.now(),
      name: name.trim(),
    };

    setProjects((current) => [...current, project]);
    setActiveProject(project.id);
    setMessages([]);
    setActivePage("Workspace");
    setShowProjects(true);
  }

  async function sendMessage(text = input) {
    const content = text.trim();

    if (!content || isSending) return;

    const userMessage = {
      id: Date.now(),
      role: "user",
      content,
    };

    const previousHistory = messages
      .filter(
        (message) =>
          (message.role === "user" || message.role === "assistant") &&
          !message.pending &&
          !message.error
      )
      .slice(-20)
      .map(({ role, content }) => ({ role, content }));

    setMessages((current) => [...current, userMessage]);
    setInput("");
    setActivePage("Workspace");
    setIsSending(true);

    const responseId = Date.now() + 1;

    setMessages((current) => [
      ...current,
      {
        id: responseId,
        role: "assistant",
        content: "Gemma is thinking...",
        pending: true,
      },
    ]);

    try {
      const response = await fetch(API_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        body: JSON.stringify({
          message: content,
          history: previousHistory,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(
          data.detail || `Request failed (${response.status})`
        );
      }

      if (!data.reply) {
        throw new Error("The AI returned an empty response.");
      }

      setApiStatus("connected");

      setMessages((current) =>
        current.map((message) =>
          message.id === responseId
            ? {
                ...message,
                content: data.reply,
                pending: false,
                model: data.model,
              }
            : message
        )
      );
    } catch (error) {
      setApiStatus("error");

      setMessages((current) =>
        current.map((message) =>
          message.id === responseId
            ? {
                ...message,
                content:
                  "I couldn't get a response from Gemma.\n\n" +
                  (error.message ||
                    "Check that Ollama and the AICD Gate backend are running."),
                pending: false,
                error: true,
              }
            : message
        )
      );
    } finally {
      setIsSending(false);
    }
  }

  function chooseSuggestion(prompt) {
    sendMessage(prompt);
  }

  function selectPage(page) {
    setActivePage(page);
  }

  function renderWorkspace() {
    if (messages.length === 0) {
      return (
        <div className="welcome-screen">
          <div className="welcome-icon">✳</div>

          <div className="welcome-eyebrow">
            YOUR DEVELOPMENT WORKSPACE
          </div>

          <h1>Build with clarity.</h1>

          <p className="welcome-description">
            Turn your ideas into structured requirements, actionable plans,
            and verifiable software. Let's make your next project easier to
            build and easier to trust.
          </p>

          <div className="suggestion-grid">
            {SUGGESTIONS.map((suggestion) => (
              <button
                className="suggestion-card"
                key={suggestion.title}
                onClick={() => chooseSuggestion(suggestion.prompt)}
                disabled={isSending}
              >
                <span className="suggestion-icon">
                  {suggestion.icon}
                </span>
                <strong>{suggestion.title}</strong>
                <span className="suggestion-description">
                  {suggestion.description}
                </span>
                <span className="suggestion-arrow">↗</span>
              </button>
            ))}
          </div>
        </div>
      );
    }

    return (
      <div className="conversation">
        {messages.map((message) => (
          <div
            className={`message-row ${message.role === "user" ? "user-message" : "assistant-message"}`}
            key={message.id}
          >
            {message.role === "assistant" && (
              <div className="message-avatar">A</div>
            )}

            <div className="message-content">
              <div className="message-author">
                {message.role === "user" ? "You" : "AICD Gate"}
                {message.pending && (
                  <span className="thinking-label"> · Working</span>
                )}
              </div>

              <div
                className={`message-bubble ${message.pending ? "pending-message" : ""} ${message.error ? "error-message" : ""}`}
              >
                {formatMessage(message.content)}
              </div>

              {message.role === "assistant" &&
                !message.pending &&
                !message.error && (
                  <div className="message-meta">
                    <span>Local AI · {message.model || "Gemma"}</span>
                    <button
                      className="copy-message-button"
                      onClick={() => {
                        navigator.clipboard?.writeText(message.content);
                      }}
                      title="Copy response"
                    >
                      Copy
                    </button>
                  </div>
                )}
            </div>
          </div>
        ))}
      </div>
    );
  }

  function renderPageContent() {
    if (activePage === "Requirements") {
      return (
        <div className="section-page">
          <div className="section-icon">☷</div>
          <h1>Requirements</h1>
          <p>
            Define what the software must do and how each requirement will
            be tested.
          </p>
          <div className="section-panel">
            <h3>Start with a clear objective</h3>
            <p>
              Describe your project in the chat, and ask Gemma to identify
              functional requirements, non-functional requirements,
              constraints, and acceptance criteria.
            </p>
            <button
              className="primary-button"
              onClick={() =>
                sendMessage(
                  "Help me define the requirements for my current project. Ask me the most important clarifying questions first."
                )
              }
            >
              Define requirements <span>→</span>
            </button>
          </div>
        </div>
      );
    }

    if (activePage === "Development plan") {
      return (
        <div className="section-page">
          <div className="section-icon">⑂</div>
          <h1>Development plan</h1>
          <p>
            Break your project into manageable tasks with explicit
            dependencies and completion criteria.
          </p>
          <div className="section-panel">
            <h3>Plan the implementation</h3>
            <p>
              Ask Gemma to propose a task breakdown, identify blockers, and
              specify what evidence is needed to mark each task complete.
            </p>
            <button
              className="primary-button"
              onClick={() =>
                sendMessage(
                  "Create a development plan for my current project. Break it into ordered tasks with dependencies, risks, and acceptance criteria. Clearly label any assumptions."
                )
              }
            >
              Create development plan <span>→</span>
            </button>
          </div>
        </div>
      );
    }

    if (activePage === "Verification") {
      return (
        <div className="section-page">
          <div className="section-icon">◇</div>
          <h1>Verification</h1>
          <p>
            Establish evidence that requirements are met instead of relying
            on AI claims alone.
          </p>
          <div className="section-panel">
            <h3>Verify before accepting</h3>
            <p>
              Generate test cases, define expected results, and identify
              which checks require actual execution or human review.
            </p>
            <button
              className="primary-button"
              onClick={() =>
                sendMessage(
                  "Create a verification plan for my current project. Include testable acceptance criteria, positive and negative test cases, expected results, and the evidence required before a requirement can be marked verified."
                )
              }
            >
              Plan verification <span>→</span>
            </button>
          </div>
        </div>
      );
    }

    return renderWorkspace();
  }

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <button
          className="brand"
          onClick={newChat}
          aria-label="AICD Gate home"
        >
          <span className="brand-mark">A</span>
          <span className="brand-copy">
            <strong>AICD Gate</strong>
            <small>Development workspace</small>
          </span>
        </button>

        <button className="new-chat-button" onClick={newChat}>
          <span>＋</span> New conversation
          <span className="shortcut">Ctrl K</span>
        </button>

        <div className="sidebar-section-label">WORKSPACE</div>

        <nav className="side-nav">
          {NAV_ITEMS.map((item) => (
            <button
              key={item.label}
              className={
                activePage === item.label
                  ? "nav-item active"
                  : "nav-item"
              }
              onClick={() => selectPage(item.label)}
            >
              <span className="nav-icon">{item.icon}</span>
              {item.text}
            </button>
          ))}
        </nav>

        <div className="project-section-heading">
          <span className="sidebar-section-label">YOUR PROJECTS</span>
          <button
            className="icon-button"
            onClick={() => setShowProjects((value) => !value)}
            aria-label="Toggle projects"
          >
            {showProjects ? "−" : "+"}
          </button>
        </div>

        {showProjects && (
          <div className="project-list">
            {projects.map((project) => (
              <button
                key={project.id}
                className={
                  activeProject === project.id
                    ? "project-item selected"
                    : "project-item"
                }
                onClick={() => {
                  setActiveProject(project.id);
                  setMessages([]);
                  setActivePage("Workspace");
                }}
              >
                <span className="project-dot" />
                <span className="project-name">{project.name}</span>
                {activeProject === project.id && (
                  <span className="project-arrow">›</span>
                )}
              </button>
            ))}

            <button className="add-project" onClick={createProject}>
              <span>＋</span> Add project
            </button>
          </div>
        )}

        <div className="sidebar-bottom">
          <div className="model-status">
            <span
              className={`status-dot ${apiStatus === "connected" ? "status-online" : apiStatus === "error" ? "status-error" : ""}`}
            />
            <div>
              <strong>Local AI</strong>
              <small>
                {apiStatus === "connected"
                  ? "Gemma connected"
                  : apiStatus === "error"
                    ? "Connection issue"
                    : "Gemma 3 · Ollama"}
              </small>
            </div>
          </div>

          <div className="privacy-note">
            <span>⌑</span> Designed for local AI workflows
          </div>
        </div>
      </aside>

      <main className="main-panel">
        <header className="topbar">
          <div className="breadcrumb">
            <span>{currentProject?.name || "Workspace"}</span>
            <span className="breadcrumb-separator">/</span>
            <strong>
              {activePage === "Workspace" ? "Overview" : activePage}
            </strong>
          </div>

          <div className="topbar-actions">
            <span className="local-badge">
              <span className="status-dot" />
              Local environment
            </span>
            <button
              className="help-button"
              onClick={() =>
                window.alert(
                  "AICD Gate helps structure requirements, plan implementation, and define verification criteria. AI suggestions should be checked against real evidence."
                )
              }
            >
              Help
            </button>
          </div>
        </header>

        <section className="workspace-content">
          {renderPageContent()}
        </section>

        <footer className="composer-area">
          <form
            className="chat-composer"
            onSubmit={(event) => {
              event.preventDefault();
              sendMessage();
            }}
          >
            <textarea
              className="chat-input"
              value={input}
              onChange={(event) => setInput(event.target.value)}
              placeholder="Describe what you're building or ask AICD Gate..."
              rows={2}
              disabled={isSending}
              onKeyDown={(event) => {
                if (
                  event.key === "Enter" &&
                  !event.shiftKey &&
                  !event.nativeEvent.isComposing
                ) {
                  event.preventDefault();
                  sendMessage();
                }
              }}
            />

            <div className="composer-toolbar">
              <div className="composer-hint">
                <span>↵</span> to send · Shift + Enter for a new line
              </div>

              <button
                className="send-button"
                type="submit"
                disabled={!input.trim() || isSending}
                aria-label="Send message"
              >
                {isSending ? "…" : "↑"}
              </button>
            </div>
          </form>

          <p className="composer-disclaimer">
            AI-generated suggestions require review. A response alone does
            not prove that code or requirements have been verified.
          </p>
        </footer>
      </main>
    </div>
  );
}
