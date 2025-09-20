import { PoseLandmarker, FilesetResolver } from "@mediapipe/tasks-vision";

export const initMediapipe = async ()=>{
    const vision = await FilesetResolver.forVisionTasks(
        "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@latest/wasm"
    )

    return PoseLandmarker.createFromOptions(vision, {
        baseOptions:{
            modelAssetPath: "https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_lite/float16/latest/pose_landmarker_lite.task"
        },
        runningMode: "VIDEO",
        numPoses: 1,
    })
}