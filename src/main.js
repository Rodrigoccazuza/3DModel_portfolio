import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import './style.css';

const canvas = document.querySelector('#portrait');
const area = document.querySelector('.model-area');
const hero = document.querySelector('.hero');
const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(35, 1, 0.1, 100);
camera.position.set(0, 0.51, 2.4);
camera.lookAt(0, 0.49, 0);

const renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: true, powerPreference: 'high-performance' });
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.35;
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));

scene.add(new THREE.HemisphereLight(0xe1f0e4, 0x46503f, 2.3));
const key = new THREE.DirectionalLight(0xfff3dc, 3.2);
key.position.set(-2, 3, 4);
scene.add(key);
const rim = new THREE.DirectionalLight(0xb7db87, 2.8);
rim.position.set(2, 1, -2);
scene.add(rim);

let head, eyeL, eyeR, face, smileIndex;
let mx = 0, my = 0, scroll = 0;
const clamp = THREE.MathUtils.clamp;
const damp = THREE.MathUtils.damp;
const clock = new THREE.Clock();

new GLTFLoader().load(`${import.meta.env.BASE_URL}hero_head.glb`, (gltf) => {
  const portrait = gltf.scene;
  head = portrait.getObjectByName('CTRL_Head');
  eyeL = portrait.getObjectByName('CTRL_Eye_L');
  eyeR = portrait.getObjectByName('CTRL_Eye_R');
  face = portrait.getObjectByName('HeroHead_webMesh');
  smileIndex = face?.morphTargetDictionary?.smile;
  // The supplied preview animation controls these same bones. This page drives them directly.
  scene.add(portrait);
  resize();
}, undefined, (error) => {
  console.error('Unable to load the portrait model:', error);
  area.insertAdjacentHTML('beforeend', '<p class="load-error">The 3D portrait could not load.</p>');
});

function resize() {
  const width = area.clientWidth;
  const height = area.clientHeight;
  camera.aspect = width / height;
  // Bring the portrait forward on narrow screens without cropping the face.
  camera.position.z = width < 550 ? 2.12 : 2.4;
  camera.updateProjectionMatrix();
  renderer.setSize(width, height, false);
}
new ResizeObserver(resize).observe(area);

window.addEventListener('pointermove', (event) => {
  if (event.pointerType === 'touch') return;
  const rect = hero.getBoundingClientRect();
  mx = clamp(((event.clientX - rect.left) / rect.width - 0.5) * 2, -1, 1);
  my = clamp(((event.clientY - rect.top) / rect.height - 0.5) * 2, -1, 1);
}, { passive: true });
window.addEventListener('pointerleave', () => { mx = 0; my = 0; });
window.addEventListener('scroll', () => {
  const rect = hero.getBoundingClientRect();
  scroll = clamp(-rect.top / Math.max(rect.height * 0.7, 1), 0, 1);
}, { passive: true });

function animate() {
  requestAnimationFrame(animate);
  const dt = Math.min(clock.getDelta(), 0.05);
  if (head && eyeL && eyeR) {
    const motion = reducedMotion.matches ? 0 : 1;
    const gazeX = mx * motion;
    const gazeY = my * motion;
    // Eye movement leads; head movement follows more slowly. Scroll adds a small turn.
    const eyeYaw = clamp(gazeX * 0.48, -0.52, 0.52);
    const eyePitch = clamp(gazeY * 0.29, -0.44, 0.44);
    for (const eye of [eyeL, eyeR]) {
      eye.rotation.x = damp(eye.rotation.x, eyePitch, 9, dt);
      eye.rotation.y = damp(eye.rotation.y, eyeYaw, 9, dt);
    }
    head.rotation.x = damp(head.rotation.x, gazeY * 0.16 + scroll * 0.12 * motion, 3, dt);
    head.rotation.y = damp(head.rotation.y, gazeX * 0.28 + scroll * 0.20 * motion, 3, dt);
    head.rotation.z = damp(head.rotation.z, -gazeX * 0.055, 3, dt);
    if (face && smileIndex !== undefined) {
      face.morphTargetInfluences[smileIndex] = damp(face.morphTargetInfluences[smileIndex], scroll * 0.8 * motion, 2.5, dt);
    }
  }
  renderer.render(scene, camera);
}
resize();
animate();
