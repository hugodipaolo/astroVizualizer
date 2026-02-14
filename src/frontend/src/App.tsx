import { useState, useEffect, useRef } from 'react';
import { Canvas } from '@react-three/fiber';
import { OrbitControls, Stars } from '@react-three/drei';
import axios from 'axios';
import AsteroidScene from './components/AsteroidScene';
import './App.css';

function App() {
  const [sceneData, setSceneData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedAsteroid, setSelectedAsteroid] = useState<null | any>(null);
  const [resetSignal, setResetSignal] = useState(0);
  const [showPanel, setShowPanel] = useState(true);
  const controlsRef = useRef<any>(null);

  useEffect(() => {
    const fetchSceneData = async () => {
      try {
        const response = await axios.get('/api/v1/viz/3d-scene');
        setSceneData(response.data);
        setLoading(false);
      } catch (err) {
        // Log full error and show details to help debugging
        // eslint-disable-next-line no-console
        console.error('Error fetching scene data', err);
        if (axios.isAxiosError(err)) {
          setError(
            `Failed to load asteroid data: ${err.message} ${err.response ? `(status ${err.response.status})` : ''}`
          );
        } else {
          setError(String(err));
        }
        setLoading(false);
      }
    };

    fetchSceneData();
  }, []);

  if (loading) {
    return <div className="loading">Loading asteroid data...</div>;
  }

  if (error) {
    return <div className="error">{error}</div>;
  }

  return (
    <div className="app">
      {showPanel && (
        <aside className="info-panel">
          <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center'}}>
            <h3>Scene Info</h3>
            <div style={{display:'flex',gap:8}}>
              <button
                className="reset-btn"
                onClick={() => {
                  // clear selection so nothing remains highlighted
                  setSelectedAsteroid(null);
                  // ensure orbit controls allow rotation if ref is available
                  if (controlsRef?.current) {
                    try {
                      // some controls implementations expose enableRotate
                      // otherwise ensure controls are enabled
                      // @ts-ignore
                      if (typeof controlsRef.current.enableRotate !== 'undefined') controlsRef.current.enableRotate = true;
                      // @ts-ignore
                      if (typeof controlsRef.current.enabled !== 'undefined') controlsRef.current.enabled = true;
                    } catch (e) {
                      // ignore
                    }
                  }
                  setResetSignal((s) => s + 1);
                }}
              >
                Center on Sun
              </button>
              <button className="reset-btn" onClick={() => {
                if (!sceneData) return;
                const blob = new Blob([JSON.stringify(sceneData, null, 2)], { type: 'application/json' });
                const url = URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = 'scene.json';
                a.click();
                URL.revokeObjectURL(url);
              }}>Export</button>
              <button className="reset-btn" onClick={() => setShowPanel(false)}>Hide</button>
            </div>
          </div>
        {sceneData?.metadata ? (
          <div className="meta">
            <div><strong>Count:</strong> {sceneData.metadata.count}</div>
            <div><strong>Time:</strong> {sceneData.metadata.time_point ?? 'Now'}</div>
            <div><strong>Coords:</strong> {sceneData.metadata.coordinate_system}</div>
          </div>
        ) : (
          <div>No metadata available</div>
        )}

        <h4>Asteroids</h4>
        <div className="asteroid-list">
          {sceneData?.asteroids?.slice(0, 20).map((a: any) => (
            <button
              key={a.id}
              className={`asteroid-item ${selectedAsteroid?.id === a.id ? 'selected' : ''}`}
              onClick={() => setSelectedAsteroid(a)}
            >
              {a.name}
            </button>
          ))}
        </div>

        {selectedAsteroid && (
          <div className="selected-details">
            <h5>Selected</h5>
            <div><strong>{selectedAsteroid.name}</strong></div>
            <div>Size: {selectedAsteroid.size.toFixed(3)}</div>
            <div>Position: [{selectedAsteroid.position.map((v: number) => v.toFixed(2)).join(', ')}]</div>
          </div>
        )}
      </aside>)}
      <Canvas camera={{ position: [0, 20, 20], fov: 60 }}>
        <color attach="background" args={['#000']} />
        <Stars radius={100} depth={50} count={5000} factor={4} saturation={0} />
        <OrbitControls ref={controlsRef} enablePan enableZoom enableRotate />
        <ambientLight intensity={0.5} />
        <pointLight position={[10, 10, 10]} intensity={1.5} />
        {sceneData && (
          <AsteroidScene
            data={sceneData}
            highlightId={selectedAsteroid?.id ?? null}
            resetSignal={resetSignal}
            controlsRef={controlsRef}
            onSelect={(id: string) => {
              const found = sceneData.asteroids.find((a: any) => a.id === id);
              if (found) setSelectedAsteroid(found);
            }}
          />
        )}
      </Canvas>
      {!showPanel && (
        <button className="reset-btn" style={{position:'fixed', right:12, top:12, zIndex:1400}} onClick={() => setShowPanel(true)}>Show Panel</button>
      )}
    </div>
  );
}

export default App;
