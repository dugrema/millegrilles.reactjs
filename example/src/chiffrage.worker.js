import { expose as comlinkExpose } from 'comlink'
import { ChiffrageClient } from '@dugrema/millegrilles.reactjs'
// Re-exporter toutes les fonctions via comlink
comlinkExpose(ChiffrageClient)
