// import React from 'react'
// import 'bootstrap/dist/css/bootstrap.min.css'
// import 'react-bootstrap/dist/react-bootstrap.min.js'

import './styles.module.css'

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

import LayoutApplication, { HeaderApplication, FooterApplication, IconeConnexion } from './LayoutApplication'
export { LayoutApplication, HeaderApplication, FooterApplication, IconeConnexion }

import { trouverLabelImage, trouverLabelVideo } from './labelsRessources'
export { trouverLabelImage, trouverLabelVideo }

import {
  ouvrirDB, getUsager, updateUsager, getListeUsagers, supprimerUsager,
  saveCleDechiffree, getCleDechiffree,
  entretienCache,
} from './dbUsager'
export {
    ouvrirDB, getUsager, updateUsager, getListeUsagers, supprimerUsager,
    saveCleDechiffree, getCleDechiffree,
    entretienCache,
}

import { repondreRegistrationChallenge } from './webauthn'
export { repondreRegistrationChallenge }

import * as ChiffrageClient from './chiffrageClient.js'
export { ChiffrageClient }

import * as ConnexionClient from './connexionClient'
export { ConnexionClient }

import * as X509Client from './x509Client'
export { X509Client }

import * as FiletransferDownloadClient from './filetransferDownloadClient.js'
export { FiletransferDownloadClient }
