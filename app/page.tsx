"use client"

import React, { useEffect, useState } from "react"
import {
  Phone,
  PhoneCall,
  PhoneOff,
  Pause,
  Play,
  Volume2,
  VolumeX,
} from "lucide-react"
import { useChannel, useConnectionStateListener } from "ably/react"
import { Button } from "@/components/ui/button"
import { useQuery, useQueryClient } from "@tanstack/react-query"
import { Device } from "@twilio/voice-sdk"

interface Caller {
  id: number
  callSid: string
  callerNumber: string
  callerName: string
  status: "waiting" | "on-hold" | "in_progress"
  joinedAt: string
  waitTime: string
}

interface TwilioToken {
  token: string
  identity: string
}

interface CallQueue {
  id: number
  status: "failed" | "queued" | "in_progress" | "completed"
  createdAt: string
  updatedAt: string
  callSid: string
  callerNumber: string
  callerName: string
}

const SoftPhoneApp = () => {
  const [isWSConnected, setIsWSConnected] = useState(false)
  const [currentCall, setCurrentCall] = useState<Caller | null>(null)
  const [callQueue, setCallQueue] = useState<Caller[]>([])
  const [isMuted, setIsMuted] = useState(false)
  const [isOnHold, setIsOnHold] = useState(false)
  const [incomingCall, setIncomingCall] = useState<Caller | null>(null)
  const [twiloDevice, setTwiloDevice] = useState<Device | null>(null)
  const [activeConnection, setActiveConnection] = useState<any>(null)

  const queryClient = useQueryClient()

  useConnectionStateListener("connected", () => {
    console.log("Connected to Ably!")
    setIsWSConnected(true)
  })

  // Ably real-time message handling
  const { channel } = useChannel(
    process.env.NEXT_PUBLIC_ABLY_CHANNEL!,
    (message) => {
      console.log("Received Ably message:", message)

      switch (message.name) {
        case "queue-updated":
          handleQueueUpdate(message.data.queue)
          break
        case "incoming-call":
          handleIncomingCall(message.data.caller)
          break
        case "call-updated":
          handleCallUpdate(message.data.call)
          break
        default:
          console.log("Unknown message type:", message.name)
      }
    }
  )

  const { data: dataToken } = useQuery<TwilioToken>({
    queryKey: ["twilio-token"],
    queryFn: async (): Promise<{
      token: string
      identity: string
    }> => {
      const response = await fetch("/api/twilio-token-generator")
      if (!response.ok) {
        throw new Error("Failed to fetch Twilio token")
      }
      return response.json()
    },
    staleTime: Infinity,
    retry: false,
    refetchOnReconnect: false,
    refetchOnWindowFocus: false,
    refetchInterval: false,
    refetchIntervalInBackground: false,
  })

  const { data: queueData, isLoading: isQueueLoading } = useQuery<CallQueue[]>({
    queryKey: ["queue"],
    queryFn: async () => {
      const response = await fetch("/api/queue")
      if (!response.ok) {
        throw new Error("Failed to fetch queue")
      }
      return response.json()
    },
    refetchInterval: 5000, // Fallback polling every 5 seconds
  })

  // Initialize Twilio Device
  useEffect(() => {
    if (dataToken) {
      console.log("Initializing Twilio Device")
      const device = new Device(dataToken.token)

      // Set up device event listeners
      device.on("ready", () => {
        console.log("Twilio Device ready")
      })

      device.on("error", (error) => {
        console.error("Twilio Device error:", error)
      })

      device.on("incoming", (conn) => {
        console.log("Incoming call received:", conn)
        setActiveConnection(conn)
        // Handle incoming call if needed
      })

      device.on("connect", (conn) => {
        console.log("Call connected:", conn)
        setActiveConnection(conn)
      })

      device.on("disconnect", (conn) => {
        console.log("Call disconnected:", conn)
        setActiveConnection(null)
      })

      setTwiloDevice(device)

      // Cleanup function
      return () => {
        if (device) {
          device.destroy()
        }
        setActiveConnection(null)
      }
    }
  }, [dataToken])

  // Transform backend data to frontend format
  useEffect(() => {
    if (queueData) {
      const transformedQueue = queueData
        .filter((item) => item.status === "queued")
        .map((item) => ({
          id: item.id,
          callSid: item.callSid,
          callerNumber: item.callerNumber,
          callerName: item.callerName,
          status: "waiting" as const,
          joinedAt: item.createdAt,
          waitTime: calculateWaitTime(item.createdAt),
        }))

      setCallQueue(transformedQueue)
    }
  }, [queueData])

  // Calculate wait time based on when they joined
  const calculateWaitTime = (joinedAt: string): string => {
    const now = new Date()
    const joined = new Date(joinedAt)
    const diffInSeconds = Math.floor((now.getTime() - joined.getTime()) / 1000)

    const minutes = Math.floor(diffInSeconds / 60)
    const seconds = diffInSeconds % 60

    return `${minutes}:${seconds.toString().padStart(2, "0")}`
  }

  // Update wait times every second
  useEffect(() => {
    const interval = setInterval(() => {
      setCallQueue((prev) =>
        prev.map((caller) => ({
          ...caller,
          waitTime: calculateWaitTime(caller.joinedAt),
        }))
      )
    }, 1000)

    return () => clearInterval(interval)
  }, [])

  // Ably message handlers
  const handleQueueUpdate = (queue: CallQueue[]) => {
    console.log("Queue updated:", queue)
    queryClient.invalidateQueries({ queryKey: ["queue"] })
  }

  const handleIncomingCall = (caller: any) => {
    console.log("Incoming call:", caller)
    const incomingCaller: Caller = {
      id: caller.id,
      callSid: caller.callSid,
      callerNumber: caller.callerNumber,
      callerName: caller.callerName,
      status: "waiting",
      joinedAt: caller.joinedAt || new Date().toISOString(),
      waitTime: "0:00",
    }
    setIncomingCall(incomingCaller)
    queryClient.invalidateQueries({ queryKey: ["queue"] })
  }

  const handleCallUpdate = (call: any) => {
    console.log("Call updated:", call)
    if (call === null) {
      setCurrentCall(null)
      setIsOnHold(false)
      setIsMuted(false)
    } else {
      setCurrentCall(call)
    }
  }

  // Call control functions
  const answerCall = async (caller: Caller) => {
    try {
      const response = await fetch("/api/call-control", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          action: "answer",
          callSid: caller.callSid,
          callData: caller,
        }),
      })

      if (!response.ok) {
        throw new Error("Failed to answer call")
      }

      setCurrentCall(caller)
      setIncomingCall(null)
      setCallQueue((prev) => prev.filter((c) => c.callSid !== caller.callSid))
    } catch (error) {
      console.error("Error answering call:", error)
    }
  }

  const declineCall = async (caller: Caller) => {
    try {
      const response = await fetch("/api/call-control", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          action: "decline",
          callSid: caller.callSid,
        }),
      })

      if (!response.ok) {
        throw new Error("Failed to decline call")
      }

      setIncomingCall(null)
      setCallQueue((prev) => prev.filter((c) => c.callSid !== caller.callSid))
    } catch (error) {
      console.error("Error declining call:", error)
    }
  }

  const endCall = async () => {
    if (!currentCall) return

    try {
      const response = await fetch("/api/call-control", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          action: "end",
          callSid: currentCall.callSid,
        }),
      })

      if (!response.ok) {
        throw new Error("Failed to end call")
      }

      setCurrentCall(null)
      setIsOnHold(false)
      setIsMuted(false)
    } catch (error) {
      console.error("Error ending call:", error)
    }
  }

  const toggleMute = async () => {
    if (activeConnection) {
      // Use the tracked active connection to mute/unmute
      if (isMuted) {
        activeConnection.mute(false)
      } else {
        activeConnection.mute(true)
      }
      setIsMuted(!isMuted)
    } else {
      // Fallback for demo - just toggle UI state
      setIsMuted(!isMuted)
    }
  }

  const toggleHold = async () => {
    if (!currentCall) return

    try {
      const response = await fetch("/api/call-control", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          action: "hold",
          callSid: currentCall.callSid,
        }),
      })

      if (!response.ok) {
        throw new Error("Failed to hold call")
      }

      setIsOnHold(!isOnHold)
    } catch (error) {
      console.error("Error holding call:", error)
    }
  }

  const switchToCall = async (caller: Caller) => {
    if (currentCall) {
      // Put current call on hold first
      await toggleHold()

      // Add current call back to queue with hold status
      setCallQueue((prev) => [...prev, { ...currentCall, status: "on-hold" }])
    }

    // Answer the new call
    await answerCall(caller)
  }

  // const formatTime = (seconds: number) => {
  //   const mins = Math.floor(seconds / 60)
  //   const secs = seconds % 60
  //   return `${mins}:${secs.toString().padStart(2, "0")}`
  // }

  const getInitials = (name: string) => {
    return name
      .split(" ")
      .map((n) => n[0])
      .join("")
      .toUpperCase()
  }

  return (
    <div className="min-h-screen bg-gray-50 p-4">
      <div className="max-w-6xl mx-auto">
        <h1 className="text-3xl font-bold text-gray-900 mb-6">
          Soft Phone Demo
        </h1>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Main Call Interface */}
          <div className="lg:col-span-2">
            <div className="bg-white rounded-xl shadow-lg border border-gray-200">
              <div className="p-6 border-b border-gray-200">
                <h2 className="text-xl font-semibold text-gray-900 flex items-center gap-2">
                  <Phone className="w-5 h-5" />
                  Active Call
                </h2>
              </div>
              <div className="p-6">
                {currentCall ? (
                  <div className="text-center">
                    <div className="mb-6">
                      <div className="w-24 h-24 bg-blue-500 rounded-full flex items-center justify-center mx-auto mb-4 text-white text-xl font-bold">
                        {getInitials(currentCall.callerName)}
                      </div>
                      <h3 className="text-2xl font-semibold text-gray-900">
                        {currentCall.callerName}
                      </h3>
                      <p className="text-gray-600 text-lg">
                        {currentCall.callerNumber}
                      </p>
                      <div className="flex items-center justify-center gap-2 mt-3">
                        <span
                          className={`px-3 py-1 rounded-full text-sm font-medium ${
                            isOnHold
                              ? "bg-yellow-100 text-yellow-800"
                              : "bg-green-100 text-green-800"
                          }`}
                        >
                          {isOnHold ? "On Hold" : "Connected"}
                        </span>
                        <span className="text-sm text-gray-500">
                          {currentCall.waitTime}
                        </span>
                      </div>
                    </div>

                    <div className="flex justify-center space-x-4">
                      <button
                        onClick={toggleMute}
                        className={`w-14 h-14 rounded-full flex items-center justify-center transition-all duration-200 ${
                          isMuted
                            ? "bg-red-500 text-white hover:bg-red-600"
                            : "bg-gray-200 text-gray-700 hover:bg-gray-300"
                        }`}
                      >
                        {isMuted ? (
                          <VolumeX className="w-6 h-6" />
                        ) : (
                          <Volume2 className="w-6 h-6" />
                        )}
                      </button>

                      <button
                        onClick={toggleHold}
                        className={`w-14 h-14 rounded-full flex items-center justify-center transition-all duration-200 ${
                          isOnHold
                            ? "bg-yellow-500 text-white hover:bg-yellow-600"
                            : "bg-gray-200 text-gray-700 hover:bg-gray-300"
                        }`}
                      >
                        {isOnHold ? (
                          <Play className="w-6 h-6" />
                        ) : (
                          <Pause className="w-6 h-6" />
                        )}
                      </button>

                      <button
                        onClick={endCall}
                        className="w-14 h-14 rounded-full bg-red-500 text-white flex items-center justify-center hover:bg-red-600 transition-all duration-200"
                      >
                        <PhoneOff className="w-6 h-6" />
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="text-center py-16">
                    <Phone className="w-20 h-20 text-gray-300 mx-auto mb-4" />
                    <p className="text-gray-500 text-lg">No active call</p>
                    {isQueueLoading && (
                      <p className="text-gray-400 text-sm mt-2">
                        Loading queue...
                      </p>
                    )}
                  </div>
                )}
              </div>
            </div>

            {/* Incoming Call Modal */}
            {incomingCall && (
              <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
                <div className="bg-white rounded-xl shadow-2xl p-6 max-w-sm w-full mx-4">
                  <div className="text-center">
                    <div className="mb-6">
                      <div className="w-20 h-20 bg-green-500 rounded-full flex items-center justify-center mx-auto mb-4 animate-pulse">
                        <PhoneCall className="w-10 h-10 text-white" />
                      </div>
                      <h3 className="text-xl font-semibold mb-2 text-gray-900">
                        Incoming Call
                      </h3>
                      <p className="text-lg font-medium text-gray-800 mb-1">
                        {incomingCall.callerName}
                      </p>
                      <p className="text-gray-600">
                        {incomingCall.callerNumber}
                      </p>
                    </div>

                    <div className="flex space-x-4">
                      <button
                        onClick={() => declineCall(incomingCall)}
                        className="flex-1 bg-red-500 text-white py-3 px-6 rounded-lg hover:bg-red-600 transition-colors font-medium"
                      >
                        Decline
                      </button>
                      <button
                        onClick={() => answerCall(incomingCall)}
                        className="flex-1 bg-green-500 text-white py-3 px-6 rounded-lg hover:bg-green-600 transition-colors font-medium"
                      >
                        Answer
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Call Queue */}
          <div className="bg-white rounded-xl shadow-lg border border-gray-200">
            <div className="p-6 border-b border-gray-200">
              <div className="flex items-center justify-between">
                <h2 className="text-xl font-semibold text-gray-900">
                  Call Queue
                </h2>
                <span className="bg-blue-100 text-blue-800 text-sm font-medium px-3 py-1 rounded-full">
                  {callQueue.length}
                </span>
              </div>
            </div>
            <div className="p-6">
              <div className="space-y-3">
                {callQueue.map((caller) => (
                  <div
                    key={caller.callSid}
                    className="border border-gray-200 rounded-lg p-4 hover:bg-gray-50 cursor-pointer transition-colors"
                    onClick={() => switchToCall(caller)}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-3">
                        <div className="w-10 h-10 bg-gray-300 rounded-full flex items-center justify-center text-gray-700 font-medium text-sm">
                          {getInitials(caller.callerName)}
                        </div>
                        <div>
                          <p className="font-medium text-gray-900">
                            {caller.callerName}
                          </p>
                          <p className="text-sm text-gray-600">
                            {caller.callerNumber}
                          </p>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="text-sm font-medium text-gray-900">
                          {caller.waitTime}
                        </p>
                        <span
                          className={`text-xs px-2 py-1 rounded-full font-medium ${
                            caller.status === "on-hold"
                              ? "bg-yellow-100 text-yellow-800"
                              : "bg-blue-100 text-blue-800"
                          }`}
                        >
                          {caller.status === "on-hold" ? "On Hold" : "Waiting"}
                        </span>
                      </div>
                    </div>
                  </div>
                ))}

                {callQueue.length === 0 && !isQueueLoading && (
                  <div className="text-center py-12">
                    <p className="text-gray-500">No calls in queue</p>
                  </div>
                )}

                {isQueueLoading && (
                  <div className="text-center py-12">
                    <p className="text-gray-400">Loading queue...</p>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Status Bar */}
        <div className="mt-6 bg-white rounded-xl shadow-lg border border-gray-200">
          <div className="p-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-6">
                {isWSConnected ? (
                  <div className="flex items-center space-x-2">
                    <div className="w-3 h-3 bg-green-500 rounded-full"></div>
                    <span className="text-sm text-gray-600 font-medium">
                      Connected
                    </span>
                  </div>
                ) : (
                  <div className="flex items-center space-x-2">
                    <div className="w-3 h-3 bg-red-500 rounded-full"></div>
                    <span className="text-sm text-gray-600 font-medium">
                      Disconnected
                    </span>
                  </div>
                )}
                <div className="flex items-center space-x-2">
                  <span className="text-sm text-gray-600">Queue:</span>
                  <span className="bg-gray-100 text-gray-800 text-sm font-medium px-2 py-1 rounded">
                    {callQueue.length}
                  </span>
                </div>
                <div className="flex items-center space-x-2">
                  <span className="text-sm text-gray-600">
                    Twilio: {twiloDevice ? "Ready" : "Loading"}
                  </span>
                  {activeConnection && (
                    <span className="text-xs bg-green-100 text-green-800 px-2 py-1 rounded">
                      Audio Connected
                    </span>
                  )}
                </div>
              </div>
              <div className="text-sm text-gray-500">
                Live Demo • DB + Ably + Twilio
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export default SoftPhoneApp
