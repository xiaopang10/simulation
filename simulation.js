// Add this at the top of simulation.js
const satellite = window.satellite;

// Helper function to parse TLE epoch
function parseTLEEpoch(tleLine1) {
    const year = parseInt(tleLine1.substr(18, 2));
    const fullYear = year < 57 ? 2000 + year : 1900 + year;
    const dayOfYear = parseFloat(tleLine1.substr(20, 12));
    const epochDate = new Date(fullYear, 0, 1);
    epochDate.setDate(epochDate.getDate() + Math.floor(dayOfYear) - 1);
    const fractionalDay = dayOfYear % 1;
    const hours = Math.floor(fractionalDay * 24);
    const minutes = Math.floor((fractionalDay * 24 - hours) * 60);
    const seconds = Math.floor(((fractionalDay * 24 - hours) * 60 - minutes) * 60);
    epochDate.setHours(hours, minutes, seconds);
    return epochDate;
}

// Main function to set up and run the simulation
async function main() {
    // Fetch real satellite data from Celestrak
    const url = "https://celestrak.org/NORAD/elements/gp.php?GROUP=starlink&FORMAT=tle";
    const response = await fetch(url);
    const tleData = await response.text();
    const lines = tleData.split('\n');
    const satellites = [];

    // Parse the TLE data into satellite objects
    for (let i = 0; i < lines.length - 2; i += 3) {
        const name = lines[i].trim();
        const line1 = lines[i + 1].trim();
        const line2 = lines[i + 2].trim();
        const satrec = satellite.twoline2rv(line1, line2);
        const epochDate = parseTLEEpoch(line1);
        satellites.push({ name, satrec, epochDate });
    }

    // Limit satellites for performance
    const numToTrack = 50;
    const trackedSatellites = satellites.slice(0, numToTrack);

    // Set up Three.js scene
    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
    camera.position.z = 5;
    const renderer = new THREE.WebGLRenderer();
    renderer.setSize(window.innerWidth, window.innerHeight);
    document.getElementById('scene').appendChild(renderer.domElement);

    // Add Earth
    const earthGeometry = new THREE.SphereGeometry(1, 32, 32);
    const earthTexture = new THREE.TextureLoader().load('earth.jpg');
    const earthMaterial = new THREE.MeshPhongMaterial({ map: earthTexture });
    const earth = new THREE.Mesh(earthGeometry, earthMaterial);
    scene.add(earth);

    // Add universe background
    const starsGeometry = new THREE.SphereGeometry(100, 32, 32);
    const starsTexture = new THREE.TextureLoader().load('stars.jpg');
    const starsMaterial = new THREE.MeshBasicMaterial({ map: starsTexture, side: THREE.BackSide });
    const stars = new THREE.Mesh(starsGeometry, starsMaterial);
    scene.add(stars);

    // Add satellites
    const satelliteGeometry = new THREE.SphereGeometry(0.02, 8, 8);
    const satelliteMaterial = new THREE.MeshBasicMaterial({ color: 0xff0000 });
    const satelliteMeshes = trackedSatellites.map(() => {
        const mesh = new THREE.Mesh(satelliteGeometry, satelliteMaterial);
        scene.add(mesh);
        return mesh;
    });

    // Add lighting
    const sunLight = new THREE.DirectionalLight(0xffffff, 1);
    sunLight.position.set(5, 3, 5);
    scene.add(sunLight);
    const ambientLight = new THREE.AmbientLight(0x333333);
    scene.add(ambientLight);

    // Add controls
    const controls = new THREE.OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.25;
    controls.screenSpacePanning = false;
    controls.minDistance = 1.1;
    controls.maxDistance = 100;

    // Animation loop
    const clock = new THREE.Clock();
    const siderealDay = 86164;
    const rotationRate = 2 * Math.PI / siderealDay;

    function animate() {
        requestAnimationFrame(animate);
        const delta = clock.getDelta();
        const now = new Date();

        // Update satellite positions
        trackedSatellites.forEach((sat, index) => {
            const minutesSinceEpoch = (now - sat.epochDate) / 60000;
            const [e, r, v] = sat.satrec.sgp4(minutesSinceEpoch);
            if (e === 0) {
                satelliteMeshes[index].position.set(r[0] / 6371, r[1] / 6371, r[2] / 6371);
            }
        });

        // Rotate Earth
        earth.rotation.y += rotationRate * delta;

        controls.update();
        renderer.render(scene, camera);
    }

    animate();

    // Make it responsive
    window.addEventListener('resize', () => {
        camera.aspect = window.innerWidth / window.innerHeight;
        camera.updateProjectionMatrix();
        renderer.setSize(window.innerWidth, window.innerHeight);
    });
}

main(); 