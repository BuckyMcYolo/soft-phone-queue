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
import { Device, Call } from "@twilio/voice-sdk"
import { toast } from "sonner"

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
  status: "failed" | "queued" | "in_progress" | "completed" | "on_hold"
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
  const [twiloDevice, setTwiloDevice] = useState<Device | null>(null)
  const [activeCall, setActiveCall] = useState<Call | null>(null)

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
          queryClient.invalidateQueries({ queryKey: ["queue"] })

          break
        case "incoming-call":
          handleIncomingCall(message.data.caller)
          queryClient.invalidateQueries({ queryKey: ["queue"] })

          break
        case "call-updated":
          handleCallUpdate(message.data.call)
          queryClient.invalidateQueries({ queryKey: ["queue"] })

          break
        default:
          queryClient.invalidateQueries({ queryKey: ["queue"] })
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
  })

  //Phone functions
  async function getAudioDevices() {
    try {
      await navigator.mediaDevices.getUserMedia({ audio: true })
    } catch (e) {
      alert("Please plug in a microphone and allow access to use this feature.")
    }
  }

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
        setActiveCall(conn)
        // Handle incoming call if needed
      })

      device.on("connect", (conn) => {
        console.log("Call connected:", conn)
        setActiveCall(conn)
      })

      device.on("disconnect", (conn) => {
        console.log("Call disconnected:", conn)
        setActiveCall(null)
      })

      setTwiloDevice(device)

      // Cleanup function
      return () => {
        if (device) {
          device.destroy()
        }
        setActiveCall(null)
      }
    }
  }, [dataToken])

  // Transform backend data to frontend format
  useEffect(() => {
    if (queueData) {
      const transformedQueue = queueData
        .filter((item) => item.status === "queued" || item.status === "on_hold")
        .map((item) => ({
          id: item.id,
          callSid: item.callSid,
          callerNumber: item.callerNumber,
          callerName: item.callerName,
          status:
            item.status === "on_hold"
              ? ("on-hold" as const)
              : ("waiting" as const),
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
      // Update queue wait times
      setCallQueue((prev) =>
        prev.map((caller) => ({
          ...caller,
          waitTime: calculateWaitTime(caller.joinedAt),
        }))
      )

      // Update current call wait time
      setCurrentCall((prev) => {
        if (prev) {
          return {
            ...prev,
            waitTime: calculateWaitTime(prev.joinedAt),
          }
        }
        return prev
      })
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
    toast("Incoming call from " + incomingCaller.callerName, {
      description: "Click to answer or decline",
      action: {
        label: "Answer",
        onClick: () => answerCall(incomingCaller),
      },
      icon: <PhoneCall className="w-6 h-6" />,
      duration: 5000,
    })
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
      setIsOnHold(false) // Reset hold state when answering

      if (twiloDevice) {
        console.log(
          "Twilio Device is ready, connecting to call:",
          caller.callSid
        )
        // Use Twilio Device to connect the call
        const call = await twiloDevice.connect({
          params: {
            callSid: caller.callSid,
          },
        })

        call.on("accept", () => {
          console.log("Call accepted")
          setActiveCall(call)
        })

        call.on("error", (error) => {
          console.error("Call error:", error)
          toast.error("Call failed to connect")
        })

        call.on("disconnect", () => {
          console.log("Call disconnected")
          setActiveCall(null)
          setCurrentCall(null)
          setIsOnHold(false)
          setIsMuted(false)
        })
      }
    } catch (error) {
      console.error("Error answering call:", error)
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

      // Disconnect the active Twilio call
      if (activeCall) {
        activeCall.disconnect()
      }
    } catch (error) {
      console.error("Error ending call:", error)
    }
  }

  const toggleMute = async () => {
    if (activeCall) {
      // Use the tracked active connection to mute/unmute
      if (isMuted) {
        activeCall.mute(false)
      } else {
        activeCall.mute(true)
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
          isCurrentlyOnHold: isOnHold,
        }),
      })

      if (!response.ok) {
        throw new Error("Failed to hold call")
      }

      if (!isOnHold) {
        // Putting on hold - clear current call and add back to queue
        setCurrentCall(null)
        setIsOnHold(false)
        setIsMuted(false)

        // Disconnect the active Twilio call
        if (activeCall) {
          activeCall.disconnect()
        }

        toast.success("Call placed on hold")
      } else {
        // Taking off hold
        setIsOnHold(false)
        toast.success("Call resumed")
      }
    } catch (error) {
      console.error("Error holding call:", error)
      toast.error("Failed to put call on hold")
    }
  }

  const switchToCall = async (caller: Caller) => {
    // If there's a current call, put it on hold first
    if (currentCall && !isOnHold) {
      await toggleHold()
    }

    // Answer the new call
    await answerCall(caller)
  }

  const getInitials = (name: string) => {
    return name
      .split(" ")
      .map((n) => n[0])
      .join("")
      .toUpperCase()
  }

  // Check if a caller is currently active
  const isCallerActive = (caller: Caller) => {
    return currentCall?.callSid === caller.callSid
  }

  return (
    <div className="min-h-screen bg-gray-50 p-4">
      <div className="max-w-6xl mx-auto">
        <h1 className="text-3xl font-bold text-gray-900 mb-6">
          Soft Phone Demo - (628) 200-7486
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
                {callQueue.map((caller) => {
                  const isActive = isCallerActive(caller)
                  return (
                    <div
                      key={caller.callSid}
                      className={`border rounded-lg p-4 cursor-pointer transition-all duration-200 ${
                        isActive
                          ? "border-blue-500 bg-blue-50 shadow-md"
                          : "border-gray-200 hover:bg-gray-50"
                      }`}
                      onClick={() => switchToCall(caller)}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center space-x-3">
                          <div
                            className={`w-10 h-10 rounded-full flex items-center justify-center font-medium text-sm ${
                              isActive
                                ? "bg-blue-500 text-white"
                                : "bg-gray-300 text-gray-700"
                            }`}
                          >
                            {getInitials(caller.callerName)}
                          </div>
                          <div>
                            <p
                              className={`font-medium ${
                                isActive ? "text-blue-900" : "text-gray-900"
                              }`}
                            >
                              {caller.callerName}
                            </p>
                            <p
                              className={`text-sm ${
                                isActive ? "text-blue-700" : "text-gray-600"
                              }`}
                            >
                              {caller.callerNumber}
                            </p>
                          </div>
                        </div>
                        <div className="text-right">
                          <p
                            className={`text-sm font-medium ${
                              isActive ? "text-blue-900" : "text-gray-900"
                            }`}
                          >
                            {caller.waitTime}
                          </p>
                          <span
                            className={`text-xs px-2 py-1 rounded-full font-medium ${
                              caller.status === "on-hold"
                                ? "bg-yellow-100 text-yellow-800"
                                : isActive
                                ? "bg-blue-100 text-blue-800"
                                : "bg-gray-100 text-gray-800"
                            }`}
                          >
                            {caller.status === "on-hold"
                              ? "On Hold"
                              : isActive
                              ? "Active"
                              : "Waiting"}
                          </span>
                        </div>
                      </div>
                      {isActive && (
                        <div className="mt-2 pt-2 border-t border-blue-200">
                          <p className="text-xs text-blue-600 font-medium">
                            Currently connected
                          </p>
                        </div>
                      )}
                    </div>
                  )
                })}

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
                  {activeCall && (
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
