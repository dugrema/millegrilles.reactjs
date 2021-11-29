import React from 'react'

import { LayoutApplication, HeaderApplication, FooterApplication } from 'millegrilles.reactjs'
import 'millegrilles.reactjs/dist/index.css'

const App = () => {
  return (
    <LayoutApplication>
      <HeaderApplication>Header</HeaderApplication>
      <p>Create React Library Example <span role="img">😄</span></p>
      <FooterApplication>Fotter</FooterApplication>
    </LayoutApplication>
  )
}

export default App
