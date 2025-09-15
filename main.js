// Remove all import statements

// Use global THREE and OrbitControls
const w = 56;
const h = 56;
const scene = new THREE.Scene();

// Setup camera with perspective projection
const camera = new THREE.PerspectiveCamera(75, w / h, 0.1, 1000);
// Move camera further back so the earth fits the card
camera.position.z = 2.1;

// Initialize the WebGL renderer and add it to the new container
const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
renderer.setPixelRatio(window.devicePixelRatio); // Add this line for high-res rendering
renderer.setSize(w, h);
const container = document.getElementById('container');
container.appendChild(renderer.domElement);

// Color management for Three.js r153+ (CDN version)
if (THREE.ColorManagement) {
  THREE.ColorManagement.enabled = true;
}
renderer.toneMapping = THREE.ACESFilmicToneMapping;

// Create a group to hold Earth and its components
const earthGroup = new THREE.Group();
// Rotate +90deg around Y so longitude 0 is at the center
earthGroup.rotation.y = Math.PI / 2;
scene.add(earthGroup);

// OrbitControls, but disable all interaction
if (!THREE.OrbitControls) {
  throw new Error("OrbitControls not found on THREE. Make sure the OrbitControls.js script is loaded after three.min.js and before main.js.");
}
const controls = new THREE.OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;  // Enable smooth damping
controls.dampingFactor = 0.25; // Set damping factor
controls.enableZoom = false;
controls.enablePan = false;
controls.enableRotate = false;

// Define Earth geometry and textures
const detail = 12;
const loader = new THREE.TextureLoader();
const geometry = new THREE.IcosahedronGeometry(1, detail);

// Earth base material (with texture mapping)
const material = new THREE.MeshPhongMaterial({
  map: loader.load("./earth_output/textures/00_earthmap1k.jpg"),
  specularMap: loader.load("./earth_output/textures/02_earthspec1k.png"),
  bumpMap: loader.load("./earth_output/textures/01_earthbump1k.jpg"),
  bumpScale: 0.04,
  shininess: 8, // Lower shininess for softer, less intense highlights
  specular: new THREE.Color(0x111111), // Much dimmer specular highlights
  color: new THREE.Color(0xaaaaaa), // Slightly dimmer base color
});
material.map.colorSpace = THREE.SRGBColorSpace; // Set texture to sRGB color space

// Create Earth mesh and add it to the Earth group
const earthMesh = new THREE.Mesh(geometry, material);
earthGroup.add(earthMesh);

// Create lights mesh with an emissive texture (to represent city lights)
const lightsMat = new THREE.MeshBasicMaterial({
  map: loader.load("./earth_output/textures/03_earthlights1k.jpg"),
  blending: THREE.AdditiveBlending, // Use additive blending for glow effect
});
const lightsMesh = new THREE.Mesh(geometry, lightsMat);
earthGroup.add(lightsMesh);

// Add directional light (simulating the sun)
const sunLight = new THREE.DirectionalLight(0xffffff, 0.9); // Lower intensity
sunLight.position.set(-2, 0.5, 1.5);
scene.add(sunLight);

// Add ambient light to brighten shadows
const ambientLight = new THREE.AmbientLight(0xffffff, 0.48); // Lower intensity
scene.add(ambientLight);

// Add tilt controls for buttons
const tiltStep = 5 * 40; // degrees per second

let tiltUpActive = false;
let tiltSideActive = false;

function tiltAroundAxis(axis, angleRad) {
  const q = new THREE.Quaternion();
  q.setFromAxisAngle(axis, angleRad);
  earthGroup.quaternion.premultiply(q);
}

const tiltUpBtn = document.getElementById('tiltUp');
const tiltSideBtn = document.getElementById('tiltSide');

tiltUpBtn.addEventListener('mouseenter', () => { tiltUpActive = true; setTimeout(() => { unsetLanguageText();}, 1); });
tiltUpBtn.addEventListener('mouseleave', () => { tiltUpActive = false; setTimeout(() => { updateLangDisplay();}, 100); });
tiltSideBtn.addEventListener('mouseenter', () => { tiltSideActive = true; setTimeout(() => { unsetLanguageText();}, 1); });
tiltSideBtn.addEventListener('mouseleave', () => { tiltSideActive = false; setTimeout(() => { updateLangDisplay();}, 100); });

let lastTime = performance.now();

let requestId = -1;
setLanguageText("Select language", -1);

let lastLangQuery = { lat: null, lon: null };
let lastLangResult = "";
let langLookupTimeout = null;
let lastCoordsForLang = { lat: null, lon: null };

async function fetchCountryCode(lat, lon) {
  const url = `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${lat}&lon=${lon}&zoom=5&addressdetails=1`;
  try {
    const resp = await fetch(url, {
      headers: { 'Accept-Language': 'en' }
    });
    if (!resp.ok) return null;
    const data = await resp.json();
    if (data.address && data.address.country_code) {
      return data.address.country_code.toUpperCase();
    }
    return null;
  } catch (e) {
    if (e.name === "AbortError") return null;
    return null;
  }
}

async function fetchMainLanguage(countryCode) {
  // Use REST Countries API v3.1
  const url = `https://restcountries.com/v3.1/alpha/${countryCode}`;
  try {
    const resp = await fetch(url);
    if (!resp.ok) return null;
    const data = await resp.json();
    if (Array.isArray(data) && data[0] && data[0].languages) {
      // Return the first language in the object
      const langs = Object.values(data[0].languages);
      return langs.length > 0 ? langs[0] : null;
    }
    return null;
  } catch (e) {
    if (e.name === "AbortError") return null;
    return null;
  }
}

function updateLanguage(lat, lon) {
  let token = ++requestId;
  if (
    lastLangQuery.lat !== null &&
    Math.abs(lat - lastLangQuery.lat) < 2 &&
    Math.abs(lon - lastLangQuery.lon) < 2
  ) {
    setLanguageText(lastLangResult || "Select language", token);
    return;
  }
  lastLangQuery = { lat, lon };
  fetchCountryCode(lat, lon).then(countryCode => {
    if (!countryCode) {
      setLanguageText("Select language", token);
      lastLangResult = "Select language";
      return;
    }
    fetchMainLanguage(countryCode).then(language => {
      if (language === null) return; // Aborted or not found
      lastLangResult = language || "Select language";
      setLanguageText(lastLangResult, token);
    });
  });
}


function setLanguageText(newText, token) {
  if (token != requestId) {
    return;
  }
  languageDisplay.textContent = newText;
  languageDisplay.classList.remove('slide-fade-out');
  languageDisplay.classList.add('slide-fade-in');
}

function unsetLanguageText() {
  languageDisplay.classList.remove('slide-fade-in');
  languageDisplay.classList.add('slide-fade-out');
}

function getCenterLatLon() {
  // Get camera's forward direction in world space
  const forward = new THREE.Vector3();
  camera.getWorldDirection(forward);

  // Transform forward vector into earthGroup's local space
  const invQuat = earthGroup.quaternion.clone().invert();
  const localDir = forward.clone().applyQuaternion(invQuat).normalize();

  // Flip signs to match geographic convention
  // Latitude: -arcsin(y)
  // Longitude: -atan2(z, x)
  const lat = -Math.asin(localDir.y) * 180 / Math.PI;
  const lon = -Math.atan2(localDir.z, localDir.x) * 180 / Math.PI;

  return {
    lat: lat,
    lon: lon
  };
}

function updateLangDisplay() {
  const { lat, lon } = getCenterLatLon();

  // Debounce language lookup
  if (
    lastCoordsForLang.lat === null ||
    Math.abs(lat - lastCoordsForLang.lat) > 0.01 ||
    Math.abs(lon - lastCoordsForLang.lon) > 0.01
  ) {
    lastCoordsForLang = { lat, lon };
    updateLanguage(lat, lon);
  }
}

function animate() {
  requestAnimationFrame(animate);

  const now = performance.now();
  const delta = (now - lastTime) / 1000; // seconds
  lastTime = now;

  // Invert the up-down tilt direction for the down arrow
  if (tiltUpActive) {
    const right = new THREE.Vector3();
    camera.getWorldDirection(right);
    right.cross(camera.up).normalize();
    tiltAroundAxis(right, THREE.MathUtils.degToRad(tiltStep * delta));
  }
  if (tiltSideActive) {
    const up = new THREE.Vector3();
    up.copy(camera.up).normalize();
    tiltAroundAxis(up, THREE.MathUtils.degToRad(tiltStep * delta));
  }

  controls.update();
  renderer.render(scene, camera);
}

// Handle window resizing for card layout
function handleWindowResize() {
  // Keep fixed card size, but update renderer/camera if container size changes
  const w = 56;
  const h = 56;
  camera.aspect = w / h;
  camera.updateProjectionMatrix();
  renderer.setSize(w, h);
  renderer.setPixelRatio(window.devicePixelRatio); // Ensure pixel ratio is updated on resize
}
window.addEventListener('resize', handleWindowResize, false);

// Start the animation loop
animate();