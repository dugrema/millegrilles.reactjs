// import React from 'react'
// import 'bootstrap/dist/css/bootstrap.min.css'
// import 'react-bootstrap/dist/react-bootstrap.min.js'

// import './styles.module.css'

// Components a exporter
import { Thumbnail,  ThumbnailFooter, ThumbnailHeader, ThumbnailBoutonContexte } 
    from './Thumbnail'
export { Thumbnail,  ThumbnailFooter, ThumbnailHeader, ThumbnailBoutonContexte }

import { FormatteurTaille, FormatterDate, FormatterDuree } 
    from './Formatters'
export { FormatteurTaille, FormatterDate, FormatterDuree }

import { ListeFichiers, MenuContextuel } 
    from './ListeFichiers'
export { ListeFichiers, MenuContextuel }

import { detecterAppareilsDisponibles, supporteFormatWebp, supporteFormatWebm, supporteFileStream, isTouchEnabled } 
    from './detecterAppareils'
export { detecterAppareilsDisponibles, supporteFormatWebp, supporteFormatWebm, supporteFileStream, isTouchEnabled }

import ModalViewer from './ModalViewer'
export { ModalViewer }

import FilePicker from './FilePicker'
export { FilePicker }

import LayoutApplication, { HeaderApplication, FooterApplication } from './LayoutApplication'
export { LayoutApplication, HeaderApplication, FooterApplication }
