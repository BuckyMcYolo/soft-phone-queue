"use client"

import React from "react"
import * as Ably from "ably"
import { AblyProvider, ChannelProvider } from "ably/react"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"

const Providers = ({ children }: { children: React.ReactNode }) => {
  const client = new Ably.Realtime({
    key: process.env.NEXT_PUBLIC_ABLY_API_KEY,
  })

  const queryClient = new QueryClient()

  return (
    <QueryClientProvider client={queryClient}>
      <AblyProvider client={client}>
        <ChannelProvider channelName="soft-phone-queue">
          {children}
        </ChannelProvider>
      </AblyProvider>
    </QueryClientProvider>
  )
}

export default Providers
