import React, {useState} from 'react'
import {Container, Button} from 'react-bootstrap'

import Thumbnails from './Thumbnails'
import ListeFichiers from './ListeFichiers'
import TailleEcran from './TailleEcran'
import Previews from './Previews'
import VideoPlayer from './VideoPlayer'
import FilePicker from './FilePickerExample'
import LayoutApplication from './LayoutApplicationExemple'
import WorkerExemple from './WorkerExemple'
import DbUsagerExemple from './DbUsagerExemple'
import DetecterSupport from './DetecterSupport'
import TransfertFichiers from './TransfertFichiers'
import ChiffrageEd25519 from './ChiffrageEd25519'
import HachageWasm from './HachageWasm'
import ChiffrageWasm from './ChiffrageWasm'

const App = () => {

  const [page, setPage] = useState('')

  if(page) {
    let PageCls = ''
    switch(page) {
      case 'Thumbnails': PageCls = Thumbnails; break;
      case 'ListeFichiers': PageCls = ListeFichiers; break;
      case 'TailleEcran': PageCls = TailleEcran; break;
      case 'Previews': PageCls = Previews; break
      case 'VideoPlayer': PageCls = VideoPlayer; break
      case 'FilePicker': PageCls = FilePicker; break;
      case 'LayoutApplication': PageCls = LayoutApplication; break;
      case 'WorkerExemple': PageCls = WorkerExemple; break;
      case 'DbUsagerExemple': PageCls = DbUsagerExemple; break;
      case 'DetecterSupport': PageCls = DetecterSupport; break;
      case 'TransfertFichiers': PageCls = TransfertFichiers; break;
      case 'FilePicker': PageCls = FilePicker; break;
      case 'ChiffrageEd25519': PageCls = ChiffrageEd25519; break;
      case 'HachageWasm': PageCls = HachageWasm; break;
      case 'ChiffrageWasm': PageCls = ChiffrageWasm; break;
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
        <li><Button onClick={()=>setPage('VideoPlayer')}>Video Player</Button></li>
        <li><Button onClick={()=>setPage('FilePicker')}>FilePicker</Button></li>
        <li><Button onClick={()=>setPage('LayoutApplication')}>LayoutApplication</Button></li>
        <li><Button onClick={()=>setPage('WorkerExemple')}>WorkerExemple</Button></li>
        <li><Button onClick={()=>setPage('DbUsagerExemple')}>DbUsagerExemple</Button></li>
        <li><Button onClick={()=>setPage('DetecterSupport')}>DetecterSupport</Button></li>
        <li><Button onClick={()=>setPage('TransfertFichiers')}>TransfertFichiers</Button></li>
        <li><Button onClick={()=>setPage('FilePicker')}>File Picker</Button></li>
        <li><Button onClick={()=>setPage('ChiffrageEd25519')}>ChiffrageEd25519</Button></li>
        <li><Button onClick={()=>setPage('HachageWasm')}>HachageWasm</Button></li>
        <li><Button onClick={()=>setPage('ChiffrageWasm')}>ChiffrageWasm</Button></li>
      </ul>
    </Container>
  )
}

export default App
