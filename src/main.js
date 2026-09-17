import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import './style.css';

const canvas = document.querySelector('#portrait');
const area = document.querySelector('.portrait-stage');
const hero = document.querySelector('.hero');
const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');

const scene = new THREE.Scene();
scene.background = new THREE.Color('#f3f0e8');
const camera = new THREE.PerspectiveCamera(35, 1, 0.1, 100);
camera.position.set(0, 0.51, 2.4);
camera.lookAt(0, 0.49, 0);

let renderer;
try {
  renderer = new THREE.WebGLRenderer({ canvas, alpha: false, antialias: true, preserveDrawingBuffer: true });
} catch (error) {
  area.querySelector('.model-loading').textContent = '3D IS UNAVAILABLE IN THIS BROWSER';
  throw error;
}
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.35;
renderer.setPixelRatio(Math.min(devicePixelRatio, 1.5));
canvas.addEventListener('webglcontextlost', (event) => {
  event.preventDefault();
  area.classList.remove('model-ready');
  area.dataset.modelState = 'context-lost';
  area.querySelector('.model-loading').textContent = '3D RENDERING STOPPED — RELOAD THIS PAGE';
});

scene.add(new THREE.HemisphereLight(0xf8f0db, 0x4f5e50, 2.2));
const key = new THREE.DirectionalLight(0xfff5e8, 3.1);
key.position.set(-2, 3, 4);
scene.add(key);
const rim = new THREE.DirectionalLight(0xffba8a, 2.6);
rim.position.set(2, 1, -2);
scene.add(rim);

let modelRoot, head, eyeL, eyeR, face, smileIndex;
let mx = 0, my = 0, scroll = 0;
let isHovering = false;
let validationFrames = 0;
const clamp = THREE.MathUtils.clamp;
const damp = THREE.MathUtils.damp;
const clock = new THREE.Clock();

new GLTFLoader().load(`${import.meta.env.BASE_URL}portrait-interactive.glb`, (gltf) => {
  modelRoot = gltf.scene;
  head = modelRoot.getObjectByName('CTRL_Head');
  eyeL = modelRoot.getObjectByName('CTRL_Eye_L');
  eyeR = modelRoot.getObjectByName('CTRL_Eye_R');
  face = modelRoot.getObjectByName('HeroHead_webMesh');
  if (!head || !eyeL || !eyeR) {
    area.querySelector('.model-loading').textContent = '3D RIG COULD NOT LOAD';
    return;
  }
  smileIndex = face?.morphTargetDictionary?.smile;
  // The supplied preview animation controls these same bones. This page drives them directly.
  scene.add(modelRoot);
  if (!reducedMotion.matches) head.rotation.y = -0.22;
  resize();
  area.dataset.modelState = 'rendering';
}, undefined, (error) => {
  console.error('Unable to load the portrait model:', error);
  area.querySelector('.model-loading').textContent = '3D MODEL COULD NOT LOAD';
});

function resize() {
  const width = Math.max(area.clientWidth, 1);
  const height = Math.max(area.clientHeight, 1);
  camera.aspect = width / height;
  // Bring the portrait forward on narrow screens without cropping the face.
  camera.position.z = width < 550 ? 2.15 : 2.4;
  camera.updateProjectionMatrix();
  renderer.setSize(width, height, false);
}
new ResizeObserver(resize).observe(area);

function portraitIsVisibleInBuffer() {
  const gl = renderer.getContext();
  const pixel = new Uint8Array(4);
  gl.readPixels(Math.floor(canvas.width / 2), Math.floor(canvas.height / 2), 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, pixel);
  return Math.abs(pixel[0] - 243) + Math.abs(pixel[1] - 240) + Math.abs(pixel[2] - 232) > 35;
}

function trackPointer(clientX, clientY) {
  const rect = hero.getBoundingClientRect();
  mx = clamp(((clientX - rect.left) / rect.width - 0.5) * 2.4, -1, 1);
  my = clamp(((clientY - rect.top) / rect.height - 0.5) * 2.2, -1, 1);
  area.dataset.gaze = `${mx.toFixed(2)},${my.toFixed(2)}`;
}
window.addEventListener('pointermove', (event) => {
  if (event.pointerType === 'touch') return;
  trackPointer(event.clientX, event.clientY);
}, { passive: true });
area.addEventListener('pointerenter', (event) => {
  if (event.pointerType === 'touch') return;
  isHovering = true;
  trackPointer(event.clientX, event.clientY);
});
area.addEventListener('pointerleave', () => { isHovering = false; });
hero.addEventListener('touchstart', (event) => {
  const touch = event.touches[0];
  if (touch) {
    isHovering = true;
    trackPointer(touch.clientX, touch.clientY);
  }
}, { passive: true });
hero.addEventListener('touchmove', (event) => {
  const touch = event.touches[0];
  if (touch) trackPointer(touch.clientX, touch.clientY);
}, { passive: true });
hero.addEventListener('touchend', () => { mx = 0; my = 0; isHovering = false; }, { passive: true });
window.addEventListener('pointerleave', () => { mx = 0; my = 0; });
window.addEventListener('scroll', () => {
  const rect = hero.getBoundingClientRect();
  scroll = clamp(-rect.top / Math.max(rect.height * 0.7, 1), 0, 1);
}, { passive: true });

function animate() {
  requestAnimationFrame(animate);
  const dt = Math.min(clock.getDelta(), 0.05);
  if (head && eyeL && eyeR) {
    const targetScale = isHovering ? (reducedMotion.matches ? 1.035 : 1.09) : 1;
    modelRoot.scale.setScalar(damp(modelRoot.scale.x, targetScale, 6, dt));
    // Reduced motion keeps intentional input available with a smaller range.
    const motion = reducedMotion.matches ? 0.55 : 1;
    const gazeX = mx * motion;
    const gazeY = my * motion;
    // Eye movement leads; head movement follows more slowly. Scroll adds a small turn.
    const eyeYaw = clamp(gazeX * 0.48, -0.52, 0.52);
    const eyePitch = clamp(gazeY * 0.29, -0.44, 0.44);
    for (const eye of [eyeL, eyeR]) {
      eye.rotation.x = damp(eye.rotation.x, eyePitch, 9, dt);
      eye.rotation.y = damp(eye.rotation.y, eyeYaw, 9, dt);
    }
    head.rotation.x = damp(head.rotation.x, gazeY * 0.22 + scroll * 0.12 * motion, 4, dt);
    head.rotation.y = damp(head.rotation.y, gazeX * 0.42 + scroll * 0.20 * motion, 4, dt);
    head.rotation.z = damp(head.rotation.z, -gazeX * 0.055, 3, dt);
    if (face && smileIndex !== undefined) {
      face.morphTargetInfluences[smileIndex] = damp(face.morphTargetInfluences[smileIndex], scroll * 0.8 * motion, 2.5, dt);
    }
  }
  renderer.render(scene, camera);
  if (modelRoot && !area.classList.contains('model-ready') && area.dataset.modelState !== 'context-lost') {
    validationFrames += 1;
    if (validationFrames % 8 === 0) {
      try {
        if (portraitIsVisibleInBuffer()) {
          area.classList.add('model-ready');
          area.dataset.modelState = 'interactive';
        } else if (validationFrames >= 120) {
          area.dataset.modelState = 'render-failed';
          area.querySelector('.model-loading').textContent = '3D DID NOT RENDER IN THIS BROWSER';
        }
      } catch (error) {
        area.dataset.modelState = 'render-failed';
        area.querySelector('.model-loading').textContent = '3D RENDERING FAILED IN THIS BROWSER';
        console.error('Portrait framebuffer check failed:', error);
      }
    }
  }
}
resize();
animate();
