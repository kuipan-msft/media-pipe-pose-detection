import React, { useEffect } from 'react';

import '@tensorflow/tfjs-core';
// Register WebGL backend.
import '@tensorflow/tfjs-backend-webgl';

import '@mediapipe/pose';
import '@mediapipe/drawing_utils';
// import '@mediapipe/control_utils_3d';
// import '@mediapipe/control_utils';
import { Pose, Results, POSE_CONNECTIONS, POSE_LANDMARKS_LEFT, POSE_LANDMARKS_RIGHT, POSE_LANDMARKS_NEUTRAL } from '@mediapipe/pose';
import { drawConnectors, drawLandmarks } from '@mediapipe/drawing_utils';
// import { VERSION as FaceMeshVersion, FaceMesh, FACEMESH_FACE_OVAL, FACEMESH_LEFT_EYE, FACEMESH_LEFT_EYEBROW, FACEMESH_LEFT_IRIS, FACEMESH_LIPS, FACEMESH_RIGHT_EYE, FACEMESH_RIGHT_EYEBROW, FACEMESH_RIGHT_IRIS, FACEMESH_TESSELATION, Results, NormalizedLandmarkList, LandmarkConnectionArray } from '@mediapipe/face_mesh';

let RENDER_PREDICTION_ON_FRAME_HANDLE = -1;
let canvasContext: CanvasRenderingContext2D | null;
const roseGlasses = new Image();
const flowerCrown = new Image();

const startStreaming = async (video: HTMLVideoElement, stream: MediaStream): Promise<void> => {
  video.srcObject = stream;
  video.play();
}

const getVideoFeed = async (): Promise<MediaStream | undefined> => {
  try {
  const stream = await navigator.mediaDevices.getUserMedia({video: true});
  return stream;
  } catch (error) {
    console.error('Could not get camera feed!');
    alert((error as Error).message);
  }
}

let activeEffect = 'mask';
const drawResult = async (detectionResults: Results) => {
  console.log('rendering result');

  if (!canvasContext) {
    const canvas = document.getElementById('augmentedVideo') as HTMLCanvasElement;
    canvas.width = detectionResults.image.width;
    canvas.height = detectionResults.image.height;
    canvasContext = canvas.getContext('2d');

    if (!canvasContext) {
      alert('No canvas to draw on found');
      return;
    }
  }

  // Draw the overlays.
  canvasContext.save();
  canvasContext.clearRect(0, 0, detectionResults.image.width, detectionResults.image.height);

  const drawBackground = document.getElementById('backgroundToggle') as HTMLInputElement;
  if (drawBackground?.checked) {
    canvasContext.drawImage(detectionResults.image, 0, 0, detectionResults.image.width, detectionResults.image.height);
  }

  if (detectionResults.segmentationMask) {
    canvasContext.drawImage(
      detectionResults.segmentationMask, 0, 0, detectionResults.image.width,
      detectionResults.image.height);

    // Only overwrite existing pixels.
    if (activeEffect === 'mask' || activeEffect === 'both') {
      canvasContext.globalCompositeOperation = 'source-in';
      // This can be a color or a texture or whatever...
      canvasContext.fillStyle = 'gray';//'rgba(0, 0, 0, 0.2)'//'#00FF007F'; // 'gray';;
      canvasContext.fillRect(0, 0, detectionResults.image.width, detectionResults.image.height);
    } else {
      canvasContext.globalCompositeOperation = 'source-out';
      canvasContext.fillStyle = '#0000FF7F';
      canvasContext.fillRect(0, 0, detectionResults.image.width, detectionResults.image.height);
    }

    // Only overwrite missing pixels.
    canvasContext.globalCompositeOperation = 'destination-atop';
    canvasContext.drawImage(
      detectionResults.image, 0, 0, detectionResults.image.width, detectionResults.image.height);

    canvasContext.globalCompositeOperation = 'source-over';
  } else {
    canvasContext.drawImage(
      detectionResults.image, 0, 0, detectionResults.image.width, detectionResults.image.height);
  }

  if (detectionResults.poseLandmarks) {
    drawConnectors(
      canvasContext, detectionResults.poseLandmarks, POSE_CONNECTIONS,
      { visibilityMin: 0.65, color: 'white' });
    drawLandmarks(
      canvasContext,
      Object.values(POSE_LANDMARKS_LEFT)
        .map(index => detectionResults.poseLandmarks[index]),
      { visibilityMin: 0.65, color: 'white', fillColor: 'rgb(255,138,0)' });
    drawLandmarks(
      canvasContext,
      Object.values(POSE_LANDMARKS_RIGHT)
        .map(index => detectionResults.poseLandmarks[index]),
      { visibilityMin: 0.65, color: 'white', fillColor: 'rgb(0,217,231)' });
    drawLandmarks(
      canvasContext,
      Object.values(POSE_LANDMARKS_NEUTRAL)
        .map(index => detectionResults.poseLandmarks[index]),
      { visibilityMin: 0.65, color: 'white', fillColor: 'white' });
  }
  canvasContext.restore();
}

// const getTopLeftBottomRight = (landmarks: NormalizedLandmarkList, KNOWN_LANDMARK: LandmarkConnectionArray, scale: {width: number; height: number}) => {
//   const xVals = KNOWN_LANDMARK.map((index) => landmarks[index[0]].x);
//   const yVals = KNOWN_LANDMARK.map((index) => landmarks[index[0]].y);

//   return {
//     top: Math.min(...yVals) * scale.height,
//     left: Math.min(...xVals) * scale.width,
//     bottom: Math.max(...yVals) * scale.height,
//     right: Math.max(...xVals) * scale.width,
//   };
// }

const doFaceDetection = async (detector: Pose, video: HTMLVideoElement) => {
  RENDER_PREDICTION_ON_FRAME_HANDLE = requestAnimationFrame(async () => {
    await detector.send({ image: video });
    await doFaceDetection(detector, video);
  });
}

const start = async () => {
  console.log('Starting Stream');
  const videoFeed = await getVideoFeed();
  if (!videoFeed) return;

  console.log('Starting Video Feed');
  const videoElement = document.getElementById('originalVideo') as HTMLVideoElement;
  await startStreaming(videoElement, videoFeed);

  const pose = new Pose({locateFile: (file) => {
    return `https://cdn.jsdelivr.net/npm/@mediapipe/pose/${file}`;
  }});
  pose.setOptions({
    modelComplexity: 1,
    smoothLandmarks: true,
    enableSegmentation: true,
    smoothSegmentation: true,
    minDetectionConfidence: 0.5,
    minTrackingConfidence: 0.5
  });
  pose.onResults(async (results) => {
    drawResult(results);
  });
  doFaceDetection(pose, videoElement);
}

function App() {

  useEffect(() => {
    roseGlasses.src = 'rose_glasses.png';
    flowerCrown.src = 'flowercrown.png';
  }, [])

  return (
    <div>
      <button onClick={start}>Detect</button>
      <button onClick={
        () => {
          console.log('Stopping Detection');
          cancelAnimationFrame(RENDER_PREDICTION_ON_FRAME_HANDLE);
          RENDER_PREDICTION_ON_FRAME_HANDLE = -1
        }
      }>Stop</button>
      <br />

      <select id="drawOption" defaultValue="funFilter">
        <option value="mesh">Mesh</option>
        <option value="landmarks">Landmarks</option>
        <option value="funFilter">Fun Filter 🎉</option>
        <option value="none">none</option>
      </select>
      <br />

      <input id="backgroundToggle" type="checkbox" defaultChecked={true} />
      <label htmlFor="backgroundToggle">Show Background</label>

      <div>
        <video id='originalVideo' autoPlay />
        <canvas id='augmentedVideo' />
      </div>
    </div>
  );
}

export default App;
