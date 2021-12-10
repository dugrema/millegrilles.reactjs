import { expose as comlinkExpose } from 'comlink'
import * as ChiffrageClient from '@dugrema/millegrilles.reactjs/src/chiffrageClient.js'
import * as X509Client from '@dugrema/millegrilles.reactjs/src/x509Client'
// Re-exporter toutes les fonctions via comlink
comlinkExpose({
    ...ChiffrageClient,
    ...X509Client
})
