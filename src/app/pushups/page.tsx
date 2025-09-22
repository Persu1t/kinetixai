"use client";
import React, { useEffect, useRef, useState } from "react";
import { initMediapipe } from "@/utils/mediapipeInit";
import { PoseLandmarker } from "@mediapipe/tasks-vision";
import { calculateAngle, drawLine, drawPoint, midpoint } from "@/utils/angleCalc";
import { createAISession } from "../../utils/AIsession";
import { Button } from "@/components/ui/button";
import { usePathname } from "next/navigation";

const Page = () => {
  const poseRef = useRef<PoseLandmarker | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const rafIdRef = useRef<number | null>(null);
  const minElbowAngleRef = useRef<number>(Infinity);
  const elbowAngleRef = useRef<number | null>(null);
  const landmarksRef = useRef<any[]>([]); // ✅ store latest landmarks
  const lastElbowAngleRef = useRef<number | null>(null);
  const pushUpStageRef = useRef<"up" | "down">("up");
  const pushUpCountRef = useRef<number>(0);
  const startNoseYRef = useRef<number | null>(0);
  const smoothedNoseDispRef = useRef(0);
  const aiSessionRef = useRef(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  const [session, setSession] = useState(false);
  const [showSkeleton, setShowSkeleton] = useState(false);

  const sessionRef = useRef(session);
  const showSkeletonRef = useRef(showSkeleton);

  const [aiLoading, setAiLoading] = useState(true);

  const [pushUpCount, setPushUpCount] = useState(0);
  const [pushUpStage, setPushUpStage] = useState<"up" | "down">("up");
  const [elbowAngle, setElbowAngle] = useState(0);
  const [bodySag, setBodySag] = useState(0);
  const [repHistrory, setRepHistory] = useState([]);
  const minHipRef = useRef<number | null>(null);
  const maxHipRef = useRef<number | null>(null);

  const repHistoryRef = useRef<any[]>([]);

  const lastRepTimeRef = useRef(0);

  const smooth = (prev: number, cur: number) => prev * 0.7 + cur * 0.3;

  const draw = () => {
    const ctx = canvasRef.current?.getContext("2d");
    if (!ctx || !videoRef.current) {
      return
    };
    ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);
    if (!showSkeletonRef.current) {
      return
    };

    const lm = landmarksRef.current;
    const shoulderMidPoint = midpoint(lm[11], lm[12]);
    const hipMidPoint = midpoint(lm[23], lm[24]);

    // points
    drawPoint(ctx, shoulderMidPoint, "blue");
    drawPoint(ctx, hipMidPoint, "blue");
    [11, 13, 15, 12, 14, 16, 23, 25, 27, 24, 26, 28].forEach((i) =>
      drawPoint(ctx, lm[i], "red")
    );

    // lines
    drawLine(ctx, lm[11], shoulderMidPoint);
    drawLine(ctx, lm[12], shoulderMidPoint);
    drawLine(ctx, lm[23], hipMidPoint);
    drawLine(ctx, lm[24], hipMidPoint);
    drawLine(ctx, shoulderMidPoint, hipMidPoint);
    drawLine(ctx, lm[11], lm[13]);
    drawLine(ctx, lm[13], lm[15]);
    drawLine(ctx, lm[12], lm[14]);
    drawLine(ctx, lm[14], lm[16]);
    drawLine(ctx, lm[23], lm[25]);
    drawLine(ctx, lm[25], lm[27]);
    drawLine(ctx, lm[24], lm[26]);
    drawLine(ctx, lm[26], lm[28]);
  };

  const calc = () => {
    if (landmarksRef.current.length === 0) return;

    const lm = landmarksRef.current;

    // Midpoints
    const shoulderMid = midpoint(lm[11], lm[12]);
    const hipMid = midpoint(lm[23], lm[24]);
    const ankleMid = midpoint(lm[27], lm[28]);


    // Angles
    const leftElbow = calculateAngle(lm[11], lm[13], lm[15]);
    const rightElbow = calculateAngle(lm[12], lm[14], lm[16]);
    const avgElbow = (leftElbow + rightElbow) / 2;

    const bodyAngle = calculateAngle(shoulderMid, hipMid, ankleMid);
    const bodySag = 180 - bodyAngle;

    // Nose landmark (keypoint 0)
    const noseY = lm[0].y;
    const torsoLength = Math.abs(shoulderMid.y - ankleMid.y);

    setBodySag(bodySag);

    // Thresholds
    const DOWN_THRESHOLD = 115;      // bent elbow
    const UP_THRESHOLD = 160;       // straight arm
    const MIN_DEPTH = 95;           // must reach <= this
    const MIN_NOSE_MOVE = 0.12;     // nose must move down ≥ 15% torso length
    const MIN_REP_INTERVAL = 400;   // ms
    const ELBOW_UI_UPDATE_MS = 100;

    // --- Smooth elbow angle ---
    const smoothed = smooth(elbowAngleRef.current || avgElbow, avgElbow);
    elbowAngleRef.current = smoothed;
    minElbowAngleRef.current = Math.min(minElbowAngleRef.current, smoothed);

    // --- Throttled React update ---
    const now = Date.now();
    if (
      Math.abs(smoothed - elbowAngle) > 0.6 ||
      now - lastElbowAngleRef.current > ELBOW_UI_UPDATE_MS
    ) {
      lastElbowAngleRef.current = now;
      setElbowAngle(Number(smoothed.toFixed(1)));
    }

    // --- Initialize nose baseline if not set ---
    if (startNoseYRef.current === 0) {
      startNoseYRef.current = noseY;
    }

    // Nose displacement (normalized to torso length)
    const noseDisplacement = (noseY - startNoseYRef.current) / torsoLength;

    const smoothNoseDisplacement = smooth(smoothedNoseDispRef.current || noseDisplacement, noseDisplacement);
    smoothedNoseDispRef.current = smoothNoseDisplacement;


    // --- Stage machine ---
    if (smoothed < DOWN_THRESHOLD && pushUpStageRef.current === "up") {
      pushUpStageRef.current = "down";
      setPushUpStage("down");
    }

    if (smoothed > UP_THRESHOLD && pushUpStageRef.current === "down") {
      if (
        now - lastRepTimeRef.current > MIN_REP_INTERVAL &&
        minElbowAngleRef.current <= MIN_DEPTH &&
        smoothNoseDisplacement >= MIN_NOSE_MOVE
      ) {
        // ✅ Valid rep
        lastRepTimeRef.current = now;
        pushUpStageRef.current = "up";
        pushUpCountRef.current += 1;
        const minElbowAngle = minElbowAngleRef.current;

        setRepHistory(prev => [
          ...prev,
          {
            rep: pushUpCountRef.current,
            minElbowAngle,
            bodySag,
            avgElbow,
            noseDisplacement: smoothNoseDisplacement,
          },
        ]);

        // Reset trackers
        minElbowAngleRef.current = Infinity;
        startNoseYRef.current = noseY; // 🔄 reset baseline at the top
        setPushUpStage("up");
        setPushUpCount(pushUpCountRef.current);
      } else {
        // ❌ Not deep enough
        pushUpStageRef.current = "up";
        setPushUpStage("up");
      }
    }
  };

  useEffect(() => {
    repHistoryRef.current = repHistrory
  }, [repHistrory])

  useEffect(() => {
    sessionRef.current = session;
  }, [session]);
  useEffect(() => {
    showSkeletonRef.current = showSkeleton;
  }, [showSkeleton]);

  // --- 1. Mount camera + AI + landmark detection ---
  useEffect(() => {

    let mounted = true;

    const init = async () => {
      poseRef.current = await initMediapipe();

      if (videoRef.current) {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: "environment" },
        });
        await navigator.mediaDevices.enumerateDevices();
        videoRef.current.srcObject = stream;
        videoRef.current.onloadedmetadata = () => {
          videoRef.current?.play();
          rafIdRef.current = requestAnimationFrame(detectPose);
        };
      }
    };

    const detectPose = async () => {
      try {
        if (!mounted) return;
        const poseLandmarker = poseRef.current;
        if (!poseLandmarker || !videoRef.current) {
          rafIdRef.current = requestAnimationFrame(detectPose);
          return;
        }

        const res = await poseLandmarker.detectForVideo(
          videoRef.current,
          performance.now()
        );

        if (res?.landmarks?.length > 0) {
          landmarksRef.current = res.landmarks[0];
          draw();
          if (sessionRef.current) calc();
        }
      } catch (err) {
        console.error("Pose detection error:", err);
      } finally {
        rafIdRef.current = requestAnimationFrame(detectPose);
      }
    };

    const awakeAI = async () => {
      setAiLoading(true);
      try {
        const aiSession = await createAISession(() => repHistoryRef.current);
        aiSessionRef.current = aiSession;
      } finally {
        setAiLoading(false);
      }
    };

    init();

    awakeAI();



    return () => {
      mounted = false;
      if (rafIdRef.current) cancelAnimationFrame(rafIdRef.current);
      if (videoRef.current?.srcObject) {
        const tracks = (videoRef.current.srcObject as MediaStream).getTracks();
        tracks.forEach((track) => track.stop()); // ✅ Stop camera stream on unmount
      }
      aiSessionRef.current?.close();
    };
  }, []);

  return (
    <>
      <div className="relative w-full max-w-screen-md mx-auto">
        <video ref={videoRef} className="w-full h-auto rounded-lg" playsInline />
        <audio ref={audioRef} autoPlay className="hidden"/>
        <canvas
          ref={canvasRef}
          className="absolute top-0 left-0 w-full h-full rounded-lg"
        />

        {/* Overlay UI */}
        <div className="absolute top-2 left-2 bg-black/60 text-white text-xs sm:text-sm md:text-base p-2 sm:p-3 rounded-lg shadow-md">
          <div>Push-ups: {pushUpCount}</div>
          <div>Stage: {pushUpStage}</div>
          <div>Elbow Angle: {Math.round(elbowAngle)}°</div>
          <div>Body Sag: {Math.round(bodySag)}°</div>
          <div>Hip Movement: {Math.round(minHipRef.current - maxHipRef.current)}</div>
        </div>
        {aiLoading && (
          <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex items-center gap-2 bg-black/70 text-white px-3 py-2 rounded-lg">
            <div className="w-4 h-4 border-2 border-t-transparent border-white rounded-full animate-spin"></div>
            <span>AI loading…</span>
          </div>
        )}
        {aiLoading === false && (
          <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex items-center gap-2 bg-black/70 text-white px-3 py-2 rounded-lg">
            <span>AI Connected</span>
          </div>
        )}
      </div>
      <div className="flex gap-2 mt-4">
        <Button
          onClick={() => setSession(true)}
          className="px-4 py-2 bg-green-600 text-white rounded"
          disabled={session}
        >
          Start Session
        </Button>
        <Button
          onClick={() => setSession(false)}
          className="px-4 py-2 bg-red-600 text-white rounded"
          disabled={!session}
        >
          Stop Session
        </Button>
        <Button
          onClick={() => setShowSkeleton((prev) => !prev)}
          className="px-4 py-2 bg-blue-600 text-white rounded"
          disabled={session}
        >
          {showSkeleton ? "Hide Skeleton" : "Show Skeleton"}
        </Button>
      </div>
    </>
  );
};

export default Page;