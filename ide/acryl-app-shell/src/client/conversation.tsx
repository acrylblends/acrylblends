/**
 * The conversation renderer, offered to whatever occupies the right column (docs/plans/ide-host-inversion.md section 31, question 2): the chat is a
 * tab of the right panel in 125, and it renders the same keyed `main` slot entry the centre used to receive. The frame owns the renderer, so it is
 * handed down as a value instead of being re-created by the panel.
 */

import { createContext, useContext, type ReactNode } from 'react'

const ConversationRendererContext = createContext<(() => ReactNode) | undefined>(undefined)

export function ConversationRendererProvider({
  render,
  children,
}: {
  render: () => ReactNode
  children: ReactNode
}) {
  return <ConversationRendererContext.Provider value={render}>{children}</ConversationRendererContext.Provider>
}

/** The frame's conversation renderer, or undefined outside the frame (a surface that renders its own chat). */
export function useConversationRenderer(): (() => ReactNode) | undefined {
  return useContext(ConversationRendererContext)
}
