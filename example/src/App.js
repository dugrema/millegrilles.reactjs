import React, {useState} from 'react'
import {Container, Button} from 'react-bootstrap'

// import Thumbnails from './Thumbnails'
// import ListeFichiers from './ListeFichiers'
// import TailleEcran from './TailleEcran'
// import Previews from './Previews'
// import FilePicker from './FilePickerExample'
// import LayoutApplication from './LayoutApplicationExemple'
// import ConnexionClientExemple from './ConnexionClientExemple'
import ChiffrageWorkerExemple from './ChiffrageWorkerExemple'

const App = () => {

  const [page, setPage] = useState('')

  if(page) {
    let PageCls = ''
    switch(page) {
      // case 'Thumbnails': PageCls = Thumbnails; break;
      // case 'ListeFichiers': PageCls = ListeFichiers; break;
      // case 'TailleEcran': PageCls = TailleEcran; break;
      // case 'Previews': PageCls = Previews; break
      // case 'FilePicker': PageCls = FilePicker; break;
      // case 'LayoutApplication': PageCls = LayoutApplication; break;
      // case 'ConnexionClientExemple': PageCls = ConnexionClientExemple; break;
      case 'ChiffrageWorkerExemple': PageCls = ChiffrageWorkerExemple; break;
      default:
    }
    if(PageCls) return (
      <PageCls retour={()=>{setPage('')}} />
    )
  }  

  return (
    <Container>
      <h2>Choisir module</h2>
      <ul>
        <li><Button onClick={()=>setPage('Thumbnails')}>Thumbnails</Button></li>
        <li><Button onClick={()=>setPage('ListeFichiers')}>ListeFichiers</Button></li>
        <li><Button onClick={()=>setPage('TailleEcran')}>TailleEcran</Button></li>
        <li><Button onClick={()=>setPage('Previews')}>Previews</Button></li>
        <li><Button onClick={()=>setPage('FilePicker')}>FilePicker</Button></li>
        <li><Button onClick={()=>setPage('LayoutApplication')}>LayoutApplication</Button></li>
        <li><Button onClick={()=>setPage('ConnexionClientExemple')}>ConnexionClientExemple</Button></li>
        <li><Button onClick={()=>setPage('ChiffrageWorkerExemple')}>ChiffrageWorkerExemple</Button></li>
      </ul>
    </Container>
  )
}

export default App
