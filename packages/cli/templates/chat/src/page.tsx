import type { Conversation, Message } from './db.ts'
import { doorEnabled } from './door.ts'

export const chatPage = (
  conversations: Conversation[],
  current: Conversation | undefined,
  messages: Message[],
): string =>
  (
    <html lang="en">
      <head>
        <meta charset="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <title>Chat</title>
        <style
          dangerouslySetInnerHTML={{
            __html:
              'body{font:16px system-ui;max-width:48rem;margin:2rem auto;padding:0 1rem}.row{white-space:pre-wrap;margin:.75rem 0}.user{font-weight:600}.error{color:#b00020}textarea{width:100%;box-sizing:border-box;padding:.5rem}nav a{margin-right:.75rem}',
          }}
        />
      </head>
      <body>
        <h1>Chat</h1>
        <nav>
          <a href="/">New chat</a>
          {conversations.map((c) => (
            <a href={`/?c=${c.id}`}>{c.title}</a>
          ))}
        </nav>
        <div id="log">
          {messages.map((m) => (
            <p class={`row ${m.role}`}>{m.content}</p>
          ))}
        </div>
        <div id="chat" data-conversation={current ? String(current.id) : ''} />
        <script type="module" src="/client/chat.tsx" />
        {doorEnabled() ? <script type="module" src="/api/acryl-door/page.js" /> : null}
      </body>
    </html>
  ).toString()
