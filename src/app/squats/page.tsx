"use client";
import React, { useEffect, useRef, useState } from "react";
import { initMediapipe } from "@/utils/mediapipeInit";
import { PoseLandmarker } from "@mediapipe/tasks-vision";
import { calculateAngle, drawLine, drawPoint, midpoint } from "@/utils/angleCalc";
import { createAISession } from "../../utils/AIsession";
import { Button } from "@/components/ui/button";

const SquatPage = () => {
  const poseRef = useRef<PoseLandmarker | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const rafIdRef = useRef<number | null>(null);
  const landmarksRef = useRef<any[]>([]);
  const aiSessionRef = useRef(null);

  // --- Refs for real-time calc ---
  const kneeAngleRef = useRef(0);
  const torsoAngleRef = useRef(0);
  const hipDispRef = useRef(0);

  const squatStageRef = useRef<"up" | "down">("up");
  const squatCountRef = useRef(0);
  const minKneeAngleRef = useRef<number>(Infinity);
  const lastRepTimeRef = useRef(0);

  // --- State for UI display ---
  const [squatCount, setSquatCount] = useState(0);
  const [squatStage, setSquatStage] = useState<"up" | "down">("up");
  const [kneeAngle, setKneeAngle] = useState(0);
  const [torsoAngle, setTorsoAngle] = useState(0);
  const [hipDisplacement, setHipDisplacement] = useState(0);
  const [isSpeakerOn, setIsSpeakerOn] = useState(false);
  const [cameraFacing, setCameraFacing] = useState<"user" | "environment">("environment");

  const [session, setSession] = useState(false);
  const [showSkeleton, setShowSkeleton] = useState(false);

  const [aiLoading, setAiLoading] = useState(true);

  const sessionRef = useRef(session);
  const showSkeletonRef = useRef(showSkeleton);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const repHistoryRef = useRef<any[]>([]);

  // --- Smooth helper ---
  const smooth = (prev: number, cur: number) => prev * 0.7 + cur * 0.3;

  const draw = () => {
    const ctx = canvasRef.current?.getContext("2d");
    if (!ctx || !videoRef.current) return;

    ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);
    if (!showSkeletonRef.current) return;

    const lm = landmarksRef.current;

    // key points
    [11, 12, 23, 24, 25, 26, 27, 28].forEach((i) =>
      drawPoint(ctx, lm[i], "red")
    );

    // body lines
    drawLine(ctx, lm[11], lm[23]);
    drawLine(ctx, lm[12], lm[24]);
    drawLine(ctx, lm[23], lm[25]);
    drawLine(ctx, lm[25], lm[27]);
    drawLine(ctx, lm[24], lm[26]);
    drawLine(ctx, lm[26], lm[28]);
  };

  const calc = () => {
    if (landmarksRef.current.length === 0) return;
    const lm = landmarksRef.current;

    const hipMid = midpoint(lm[23], lm[24]);
    const ankleMid = midpoint(lm[27], lm[28]);
    const shoulderMid = midpoint(lm[11], lm[12]);

    const leftKnee = calculateAngle(lm[23], lm[25], lm[27]);
    const rightKnee = calculateAngle(lm[24], lm[26], lm[28]);
    const avgKnee = (leftKnee + rightKnee) / 2;

    const torso = calculateAngle(lm[11], hipMid, ankleMid);
    const torsoLength = Math.abs(shoulderMid.y - ankleMid.y);


    // hip vertical displacement
    const hipDisp = Math.abs((lm[23].y - lm[27].y) / torsoLength);

    // smooth
    const smoothedKnee = smooth(kneeAngleRef.current || avgKnee, avgKnee);
    const smoothedTorso = smooth(torsoAngleRef.current || torso, torso);
    const smoothedHip = smooth(hipDispRef.current || hipDisp, hipDisp);

    kneeAngleRef.current = smoothedKnee;
    torsoAngleRef.current = smoothedTorso;
    hipDispRef.current = smoothedHip;

    // thresholds
    const DOWN_THRESHOLD = 105; // knees bent
    const UP_THRESHOLD = 160; // standing straight
    const MIN_DEPTH = 95; // valid squat depth
    const MIN_REP_INTERVAL = 400; // ms
    const MIN_HIP_MOVEMENT = 0.1;

    const now = Date.now();

    if (smoothedKnee < DOWN_THRESHOLD && squatStageRef.current === "up") {
      squatStageRef.current = "down";
      setSquatStage("down");
    }

    if (smoothedKnee > UP_THRESHOLD && squatStageRef.current === "down") {
      if (
        now - lastRepTimeRef.current > MIN_REP_INTERVAL &&
        minKneeAngleRef.current <= MIN_DEPTH && smoothedHip >= MIN_HIP_MOVEMENT
      ) {
        squatCountRef.current += 1;
        lastRepTimeRef.current = now;
        const minKneeAngle = minKneeAngleRef.current;
        repHistoryRef.current.push({
          rep: squatCountRef.current,
          kneeAngle: smoothedKnee,
          minKneeAngle,
          torsoAngle: smoothedTorso,
          hipDisp: smoothedHip,
        });

        setSquatCount(squatCountRef.current);
      }

      squatStageRef.current = "up";
      setSquatStage("up");
      minKneeAngleRef.current = Infinity;
    }

    if (squatStageRef.current === "down") {
      minKneeAngleRef.current = Math.min(minKneeAngleRef.current, smoothedKnee);
    }
  };

  // --- Throttled UI updates ---
  useEffect(() => {
    const interval = setInterval(() => {
      setKneeAngle(Number(kneeAngleRef.current.toFixed(1)));
      setTorsoAngle(Number(torsoAngleRef.current.toFixed(1)));
      setHipDisplacement(Number(hipDispRef.current.toFixed(2)));
    }, 200); // update UI every 200ms
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    const awakeAI = async () => {
      setAiLoading(true);
      try {
        const aiSession = await createAISession(() => repHistoryRef.current);
        aiSessionRef.current = aiSession;
      } finally {
        setAiLoading(false);
      }
    };

    awakeAI();

    return () => {
      aiSessionRef.current?.close();
    }
  }, [])
  useEffect(() => {
    sessionRef.current = session;
  }, [session]);
  useEffect(() => {
    showSkeletonRef.current = showSkeleton;
  }, [showSkeleton]);

  // --- Init camera + Mediapipe ---
  useEffect(() => {
    let mounted = true;

    const init = async () => {
      poseRef.current = await initMediapipe();

      if (videoRef.current) {
        const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: cameraFacing } });
        const devices = await navigator.mediaDevices.enumerateDevices();
        console.log(devices)
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


    init();

    return () => {
      mounted = false;
      if (rafIdRef.current) cancelAnimationFrame(rafIdRef.current);
      if (videoRef.current?.srcObject) {
        const tracks = (videoRef.current.srcObject as MediaStream).getTracks();
        tracks.forEach((track) => track.stop()); // ✅ Stop camera stream on unmount
      }
    };
  }, [cameraFacing]);

  return (
    <>
      <div className="relative w-full max-w-screen-md mx-auto">
        <video ref={videoRef} className="w-full h-auto rounded-lg" playsInline />
        <audio ref={audioRef} autoPlay playsInline style={{ display: "none" }} />
        <canvas
          ref={canvasRef}
          className="absolute top-0 left-0 w-full h-full rounded-lg"
        />

        {/* Overlay UI */}
        <div className="absolute top-2 left-2 text-white text-xs sm:text-sm md:text-base p-2 sm:p-3 rounded-lg shadow-md flex justify-between w-[90%] items-center sm:flex-row">
          <div className="text-3xl font-bold text-yellow-400 drop-shadow-lg">Squats: {squatCount}</div>
          <div className="bg-black/60 backdrop-blur-sm p-2 rounded-md">
            <div>Stage: {squatStage}</div>
            <div>Knee Angle: {Math.round(kneeAngle)}°</div>
            <div>Torso Angle: {Math.round(torsoAngle)}°</div>
            <div>Hip Displacement: {hipDisplacement.toFixed(2)}</div>
          </div>
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

      <div className="flex flex-wrap gap-2 mt-4 justify-center">
        <Button
          onClick={() => setSession(true)}
          className="flex-1 min-w-[120px] px-3 py-2 bg-green-600 text-white rounded text-sm sm:text-base"
          disabled={session}
        >
          Start Session
        </Button>
        <Button
          onClick={() => setSession(false)}
          className="flex-1 min-w-[120px] px-3 py-2 bg-red-600 text-white rounded text-sm sm:text-base"
          disabled={!session}
        >
          Stop Session
        </Button>
        <Button
          onClick={() => setShowSkeleton((prev) => !prev)}
          className="flex-1 min-w-[120px] px-3 py-2 bg-blue-600 text-white rounded text-sm sm:text-base"
          disabled={session}
        >
          {showSkeleton ? "Hide Skeleton" : "Show Skeleton"}
        </Button>
        <Button
          onClick={() =>
            setCameraFacing((prev) => (prev === "user" ? "environment" : "user"))
          }
          className="flex-1 min-w-[120px] px-3 py-2 bg-purple-600 text-white rounded text-sm sm:text-base"
          disabled={session}
        >
          Switch Camera
        </Button>
      </div>
    </>
  );
};

export default SquatPage;
