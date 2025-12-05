import { useState } from 'react'
import reactLogo from './assets/react.svg'
import viteLogo from '/vite.svg'
import './App.css'


import ReagraphScript from './reagraph_script/ReagraphScript'

function App() {

  return (
    <>
      <div>
          <p className="title">
            Output visualization:
          </p>
          <ReagraphScript />
      </div>
      
    </>
  )
}

export default App
