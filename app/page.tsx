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
// import * as Ably from "ably"
import { useChannel, useConnectionStateListener } from "ably/react"
import { Button } from "@/components/ui/button"
import { useQuery, useQueryClient } from "@tanstack/react-query"
import { Device, Call } from "@twilio/voice-sdk"
interface Caller {
  id: number
  number: string
  name: string
  waitTime: string
  status: "waiting" | "on-hold"
}

interface TwilioToken {
  token: string
  identity: string
}

const SoftPhoneApp = () => {
  const [isWSConnected, setIsWSConnected] = useState(false)
  const [currentCall, setCurrentCall] = useState<Caller | null>(null)
  const [callQueue, setCallQueue] = useState<Caller[]>([
    {
      id: 1,
      number: "+1-555-0123",
      name: "John Smith",
      waitTime: "2:34",
      status: "waiting",
    },
    {
      id: 2,
      number: "+1-555-0456",
      name: "Sarah Johnson",
      waitTime: "1:12",
      status: "waiting",
    },
    {
      id: 3,
      number: "+1-555-0789",
      name: "Mike Davis",
      waitTime: "0:45",
      status: "waiting",
    },
  ])
  const [isMuted, setIsMuted] = useState(false)
  const [isOnHold, setIsOnHold] = useState(false)
  const [incomingCall, setIncomingCall] = useState<Caller | null>(null)
  const [twiloDevice, setTwiloDevice] = useState<Device | null>(null)

  useConnectionStateListener("connected", () => {
    console.log("Connected to Ably!")
    setIsWSConnected(true)
  })

  const { channel } = useChannel("soft-phone-queue", "main", (message) => {
    // setMessages((previousMessages) => [...previousMessages, message])
    console.log("Received message:", message)
  })

  const { data: dataToken, isLoading: dataTokenLoading } =
    useQuery<TwilioToken>({
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
      // staleTime: Infinity,
      // retry: false,
      // refetchOnReconnect: false,
      // refetchOnWindowFocus: false,
      // refetchInterval: false,
      // refetchIntervalInBackground: false,
    })

  const queryClient = useQueryClient()

  useEffect(() => {
    if (dataToken) {
      console.log("token retrieved")
      const device = new Device(dataToken.token)
      // startUpClient(device)
      setTwiloDevice(device)
    }
  }, [dataToken])

  // useEffect(() => {
  //   const timer = setTimeout(() => {
  //     if (!currentCall && callQueue.length > 0) {
  //       setIncomingCall(callQueue[0])
  //     }
  //   }, 2000)
  //   return () => clearTimeout(timer)
  // }, [currentCall, callQueue])

  const answerCall = (caller: Caller) => {
    setCurrentCall(caller)
    setIncomingCall(null)
    setCallQueue((prev) => prev.filter((c) => c.id !== caller.id))
  }

  const declineCall = (caller: Caller) => {
    setIncomingCall(null)
    setCallQueue((prev) => prev.filter((c) => c.id !== caller.id))
  }

  const endCall = () => {
    setCurrentCall(null)
    setIsOnHold(false)
    setIsMuted(false)
  }

  const toggleMute = () => {
    setIsMuted(!isMuted)
  }

  const toggleHold = () => {
    setIsOnHold(!isOnHold)
  }

  const switchToCall = (caller: Caller) => {
    if (currentCall) {
      setCallQueue((prev) => [...prev, { ...currentCall, status: "on-hold" }])
    }
    setCurrentCall(caller)
    setCallQueue((prev) => prev.filter((c) => c.id !== caller.id))
    setIsOnHold(false)
  }

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60)
    const secs = seconds % 60
    return `${mins}:${secs.toString().padStart(2, "0")}`
  }

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
                        {getInitials(currentCall.name)}
                      </div>
                      <h3 className="text-2xl font-semibold text-gray-900">
                        {currentCall.name}
                      </h3>
                      <p className="text-gray-600 text-lg">
                        {currentCall.number}
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
                          {formatTime(Math.floor(Math.random() * 300) + 60)}
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
                        {incomingCall.name}
                      </p>
                      <p className="text-gray-600">{incomingCall.number}</p>
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
                    key={caller.id}
                    className="border border-gray-200 rounded-lg p-4 hover:bg-gray-50 cursor-pointer transition-colors"
                    onClick={() => switchToCall(caller)}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-3">
                        <div className="w-10 h-10 bg-gray-300 rounded-full flex items-center justify-center text-gray-700 font-medium text-sm">
                          {getInitials(caller.name)}
                        </div>
                        <div>
                          <p className="font-medium text-gray-900">
                            {caller.name}
                          </p>
                          <p className="text-sm text-gray-600">
                            {caller.number}
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

                {callQueue.length === 0 && (
                  <div className="text-center py-12">
                    <p className="text-gray-500">No calls in queue</p>
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
              </div>
              <div className="text-sm text-gray-500">
                Demo Mode • Next.js + Ably + Twilio
              </div>
            </div>
          </div>
        </div>
      </div>

      <Button
        onClick={() => {
          channel.publish("main", "Here is my first message!")
        }}
      >
        Publish WS Message
      </Button>
    </div>
  )
}

export default SoftPhoneApp
