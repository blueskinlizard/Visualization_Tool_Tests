import { useState } from 'react'
import reactLogo from './assets/react.svg'
import viteLogo from '/vite.svg'
import './App.css'
import DeckGLScript from './deckgl_script/DeckGLScript'
import ReagraphScript from './reagraph_script/ReagraphScript'
import CosmosGLScript from './cosmosgl_script/CosmosGLScript'

function App() {
  const [visType, setVisType] = useState('cosmosgl');
  const [edgeLimit, setEdgeLimit] = useState(25000);

  return (
    <>
      <div>
        <div style={{
          position: 'absolute',
          top: '10px',
          right: '10px',
          background: 'rgba(0,0,0,0.8)',
          color: 'white',
          padding: '15px',
          borderRadius: '8px',
          zIndex: 1000
        }}>
          <div style={{ marginBottom: '15px' }}>
            <label style={{ display: 'block', marginBottom: '5px' }}>
              Visualization:
            </label>
            <select 
              value={visType} 
              onChange={(e) => setVisType(e.target.value)}
              style={{ padding: '5px', width: '100%' }}
            >
              <option value="reagraph">Reagraph</option>
              <option value="deckgl">DeckGL</option>
              <option value="stardust">Stardust</option>
              <option value="cosmosgl">Cosmosgl</option>
            </select>
          </div>
          
          <div>
            <label style={{ display: 'block', marginBottom: '5px' }}>
              Edge Limit: {edgeLimit}
            </label>
            <input 
              type="range" 
              min="1000" 
              max="50000" 
              step="1000"
              value={edgeLimit}
              onChange={(e) => setEdgeLimit(Number(e.target.value))}
              style={{ width: '100%' }}
            />
          </div>
        </div>

        {visType === 'reagraph' && <ReagraphScript edgeLimit={edgeLimit} />}
        {visType === 'deckgl' && <DeckGLScript edgeLimit={edgeLimit} />}
        {visType === 'stardust' && (
          <iframe 
            src="/src/stardust_script/index.html" 
            style={{ width: '100vw', height: '100vh', border: 'none' }}
            title="Stardust Visualization"
          />
        )}
        {visType === 'cosmosgl' && <CosmosGLScript edgeLimit={edgeLimit} />}
      </div>
    </>
  )
}

export default App
