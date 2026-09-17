"use client";
import { useEffect, useRef, useCallback } from "react";
import { io, Socket } from "socket.io-client";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";

type EventName = "score-updated" | "standings-updated" | "bracket-updated";

export function useLiveTournament(
  tournamentId: string | null,
  handlers: Partial<Record<EventName, (data: any) => void>>
) {
  const socketRef = useRef<Socket | null>(null);
  const handlersRef = useRef(handlers);
  handlersRef.current = handlers;

  useEffect(() => {
    if (!tournamentId) return;
    const socket = io(API_URL, { transports: ["websocket"] });
    socketRef.current = socket;

    socket.on("connect", () => {
      socket.emit("join:tournament", tournamentId);
    });

    (Object.entries(handlersRef.current) as [EventName, (d: any) => void][]).forEach(([event, handler]) => {
      socket.on(event, handler);
    });

    return () => {
      socket.emit("leave:tournament", tournamentId);
      socket.disconnect();
    };
  }, [tournamentId]);
}
